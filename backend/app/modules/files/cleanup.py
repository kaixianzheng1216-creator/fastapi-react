import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, select

from app.db.session import engine
from app.modules.conversations.models import ConversationFile
from app.modules.files import service
from app.modules.files.models import StoredFile
from app.modules.knowledge.models import KnowledgeDocument

FILE_RETENTION = timedelta(hours=24)

FILE_CLEANUP_INTERVAL_SECONDS = 6 * 60 * 60

FILE_CLEANUP_ERROR_LOG = "清理未引用文件失败"

logger = logging.getLogger(__name__)


async def run_file_cleanup() -> None:
    while True:
        try:
            await asyncio.to_thread(clean_stale_files)
        except Exception:
            logger.exception(FILE_CLEANUP_ERROR_LOG)

        await asyncio.sleep(FILE_CLEANUP_INTERVAL_SECONDS)


def clean_stale_files() -> int:
    with Session(engine) as session:
        linked_file_ids = select(ConversationFile.stored_file_id)
        knowledge_file_ids = select(KnowledgeDocument.stored_file_id)

        statement = (
            select(StoredFile.id)
            .where(
                col(StoredFile.created_at) < datetime.now(UTC) - FILE_RETENTION,
                col(StoredFile.id).not_in(linked_file_ids),
                col(StoredFile.id).not_in(knowledge_file_ids),
            )
            .with_for_update(skip_locked=True)
        )

        file_ids = list(session.exec(statement).all())

        service.delete_files(session=session, file_ids=file_ids)

        return len(file_ids)
