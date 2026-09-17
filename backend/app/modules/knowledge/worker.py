import logging
import multiprocessing
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from typing import Final

from sqlalchemy import update
from sqlmodel import Session, col, select

from app.db.session import engine
from app.db.timestamps import utc_now
from app.modules.files.models import StoredFile
from app.modules.knowledge import vector_store
from app.modules.knowledge.config import settings as knowledge_settings
from app.modules.knowledge.documents import (
    cleanup_deleted_documents,
    document_json_key,
    document_preview_key,
    finish_processing_with_error,
)
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus

POLL_INTERVAL_SECONDS = 2
PROCESSING_TIMEOUT_SECONDS = 15 * 60
PROCESS_START_METHOD: Final = "spawn"
PROCESS_SUCCESS_EXIT_CODE = 0
DOCUMENT_SCHEDULING_ERROR_LOG = "知识库文档处理调度失败"
DOCUMENT_PROCESSING_CANCELLED_LOG = "知识库文档处理已取消：文档已删除"
DOCUMENT_PROCESS_EXIT_ERROR_LOG = "知识库文档处理进程异常退出"
DOCUMENT_PROCESSING_TIMEOUT_LOG = "知识库文档处理超时"
DOCUMENT_PROCESSING_ERROR_MESSAGE = "文档处理失败，请重试"
DOCUMENT_PROCESSING_TIMEOUT_MESSAGE = "文档处理超时"
logger = logging.getLogger(__name__)


def run() -> None:
    """运行知识库文档处理循环。"""
    vector_store.ensure_collection()

    _requeue_processing_documents_after_restart()

    _run_document_queue()


def _run_document_queue() -> None:
    """小文件限时补位，大文件等待到期后排空在途任务并独占处理。"""
    limit = knowledge_settings.KNOWLEDGE_MAX_CONCURRENT_DOCUMENTS

    pending: dict[Future[None], tuple[uuid.UUID, bool]] = {}

    large_wait_started: dict[uuid.UUID, float] = {}

    with ThreadPoolExecutor(max_workers=limit) as executor:
        while True:
            while len(pending) < limit:
                if any(is_large for _, is_large in pending.values()):
                    break

                with Session(engine) as session:
                    claimed = _claim_document(
                        session,
                        has_running_documents=bool(pending),
                        large_wait_started=large_wait_started,
                    )

                if claimed is None:
                    break

                document_id, _ = claimed

                future = executor.submit(_process_document_with_timeout, document_id)

                pending[future] = claimed

            if not pending:
                time.sleep(POLL_INTERVAL_SECONDS)

                continue

            completed, _ = wait(
                pending, timeout=POLL_INTERVAL_SECONDS, return_when=FIRST_COMPLETED
            )

            for future in completed:
                document_id, _ = pending.pop(future)

                try:
                    future.result()
                except Exception:
                    logger.exception(
                        DOCUMENT_SCHEDULING_ERROR_LOG,
                        extra={"document_id": str(document_id)},
                    )

                    finish_processing_with_error(
                        document_id=document_id,
                        status=KnowledgeDocumentStatus.FAILED,
                        error_message=DOCUMENT_PROCESSING_ERROR_MESSAGE,
                    )


def _claim_document(
    session: Session,
    *,
    has_running_documents: bool,
    large_wait_started: dict[uuid.UUID, float],
) -> tuple[uuid.UUID, bool] | None:
    """队首大文件允许小文件限时插队，空闲时立即优先领取大文件。"""
    statement = (
        select(KnowledgeDocument, StoredFile.size)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(
            col(KnowledgeDocument.status) == KnowledgeDocumentStatus.PENDING,
            col(StoredFile.uploaded).is_(True),
        )
        .order_by(col(KnowledgeDocument.created_at), col(KnowledgeDocument.id))
        .with_for_update()
        .limit(1)
    )

    result = session.exec(statement).first()

    if result is None:
        large_wait_started.clear()

        return None

    document, file_size = result

    threshold = knowledge_settings.KNOWLEDGE_LARGE_FILE_THRESHOLD_MB * 1024 * 1024

    is_large = file_size > threshold

    if is_large and has_running_documents:
        if document.id not in large_wait_started:
            large_wait_started.clear()

            large_wait_started[document.id] = time.monotonic()

        if (
            time.monotonic() - large_wait_started[document.id]
            >= knowledge_settings.KNOWLEDGE_LARGE_FILE_WAIT_SECONDS
        ):
            return None

        result = session.exec(
            statement.where(col(StoredFile.size) <= threshold)
        ).first()

        if result is None:
            return None

        document, _ = result
        is_large = False
    else:
        large_wait_started.clear()

    document.status = KnowledgeDocumentStatus.PROCESSING
    document.processing_started_at = utc_now()
    document.processing_finished_at = None

    session.commit()

    return document.id, is_large


def _process_document_with_timeout(document_id: uuid.UUID) -> None:
    """监督处理子进程，在文档删除或超时时终止任务。"""
    process = multiprocessing.get_context(PROCESS_START_METHOD).Process(
        target=_process_document,
        args=(document_id,),
    )

    process.start()

    deadline = time.monotonic() + PROCESSING_TIMEOUT_SECONDS
    deleted = False
    timed_out = False

    try:
        while True:
            process.join(
                min(POLL_INTERVAL_SECONDS, max(0, deadline - time.monotonic()))
            )

            with Session(engine) as session:
                deleted = session.get(KnowledgeDocument, document_id) is None

            if deleted or not process.is_alive():
                break

            if time.monotonic() >= deadline:
                timed_out = True

                break
    finally:
        if process.is_alive():
            process.kill()
            process.join()

        exit_code = process.exitcode

        process.close()

    if deleted:
        cleanup_deleted_documents(
            [document_id],
            [document_json_key(document_id), document_preview_key(document_id)],
            delete_images=True,
        )

        logger.info(
            DOCUMENT_PROCESSING_CANCELLED_LOG,
            extra={"document_id": str(document_id)},
        )

        return

    if timed_out:
        logger.warning(
            DOCUMENT_PROCESSING_TIMEOUT_LOG,
            extra={"document_id": str(document_id)},
        )

        finish_processing_with_error(
            document_id=document_id,
            status=KnowledgeDocumentStatus.TIMED_OUT,
            error_message=DOCUMENT_PROCESSING_TIMEOUT_MESSAGE,
        )

        return

    if exit_code == PROCESS_SUCCESS_EXIT_CODE:
        return

    logger.error(
        DOCUMENT_PROCESS_EXIT_ERROR_LOG,
        extra={"document_id": str(document_id), "exit_code": exit_code},
    )

    finish_processing_with_error(
        document_id=document_id,
        status=KnowledgeDocumentStatus.FAILED,
        error_message=DOCUMENT_PROCESSING_ERROR_MESSAGE,
    )


def _requeue_processing_documents_after_restart() -> None:
    """将 Worker 重启中断的任务重新排队。"""
    with Session(engine) as session:
        session.exec(
            update(KnowledgeDocument)
            .where(col(KnowledgeDocument.status) == KnowledgeDocumentStatus.PROCESSING)
            .values(
                status=KnowledgeDocumentStatus.PENDING,
                error_message=None,
                processing_started_at=None,
                processing_finished_at=None,
            )
        )

        session.commit()


def _process_document(document_id: uuid.UUID) -> None:
    """在 spawn 子进程中加载文档处理库，调度进程不导入它们。"""
    from app.modules.knowledge.processing import process_document

    process_document(document_id)


if __name__ == "__main__":
    run()
