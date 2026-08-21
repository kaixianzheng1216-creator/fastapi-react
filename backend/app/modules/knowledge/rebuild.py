import argparse
import sys
import uuid

from sqlalchemy import update
from sqlmodel import Session, col

from app.db.session import engine
from app.modules.knowledge.models import KnowledgeDocument, get_datetime_utc


def rebuild(knowledge_base_id: uuid.UUID | None) -> int:
    conditions = [col(KnowledgeDocument.status) == "ready"]

    if knowledge_base_id is not None:
        conditions.append(col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id)

    with Session(engine) as session:
        result = session.exec(
            update(KnowledgeDocument)
            .where(*conditions)
            .values(
                status="pending",
                error_message=None,
                processing_started_at=None,
                updated_at=get_datetime_utc(),
            )
        )
        session.commit()

    return result.rowcount


def main() -> None:
    parser = argparse.ArgumentParser(description="重建知识库向量索引")
    parser.add_argument("knowledge_base_id", nargs="?", type=uuid.UUID)
    arguments = parser.parse_args()
    count = rebuild(arguments.knowledge_base_id)
    sys.stdout.write(f"已提交 {count} 个文档重建任务\n")


if __name__ == "__main__":
    main()
