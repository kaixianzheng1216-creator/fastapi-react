import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
from openai import APITimeoutError

from app.modules.knowledge import summary
from app.modules.knowledge.exceptions import (
    DocumentSummaryTimeoutError,
    DocumentSummaryTooLongError,
    DocumentSummaryUnavailableError,
    KnowledgeDocumentNotFoundError,
    KnowledgeDocumentStateError,
)
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus


class DocumentSummaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.document = KnowledgeDocument(
            id=uuid.uuid4(),
            knowledge_base_id=uuid.uuid4(),
            stored_file_id=uuid.uuid4(),
            status=KnowledgeDocumentStatus.READY,
            summary="旧总结",
        )
        self.session = MagicMock()
        self.session.get.return_value = self.document

        self.read_markdown = self.enterContext(
            patch.object(summary.documents, "read_markdown", return_value="# 正文\n内容")
        )
        self.client_type = self.enterContext(patch.object(summary, "OpenAI"))
        self.client = self.client_type.return_value.__enter__.return_value
        self.client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    finish_reason="stop",
                    message=SimpleNamespace(content="  新总结  "),
                )
            ]
        )

    def generate(self) -> str:
        return summary.generate(session=self.session, document_id=self.document.id)

    def test_generates_from_full_markdown_and_saves_after_success(self) -> None:
        self.assertEqual(self.generate(), "新总结")
        self.assertEqual(self.document.summary, "新总结")
        self.session.commit.assert_called_once()
        self.session.rollback.assert_called_once()
        request = self.client.chat.completions.create.call_args.kwargs
        self.assertEqual(request["messages"][1]["content"], "# 正文\n内容")
        self.assertEqual(self.client_type.call_args.kwargs["max_retries"], 0)

    def test_long_document_is_rejected_without_model_request(self) -> None:
        self.read_markdown.return_value = "文" * (summary.MAX_INPUT_CHARACTERS + 1)
        with self.assertRaises(DocumentSummaryTooLongError):
            self.generate()
        self.client_type.assert_not_called()
        self.session.commit.assert_not_called()

    def test_processing_document_cannot_generate_summary(self) -> None:
        self.document.status = KnowledgeDocumentStatus.PROCESSING
        with self.assertRaises(KnowledgeDocumentStateError):
            self.generate()
        self.read_markdown.assert_not_called()
        self.client_type.assert_not_called()

    def test_timeout_preserves_previous_summary(self) -> None:
        self.client.chat.completions.create.side_effect = APITimeoutError(
            request=httpx.Request("POST", "https://example.com")
        )
        with self.assertRaises(DocumentSummaryTimeoutError):
            self.generate()
        self.assertEqual(self.document.summary, "旧总结")
        self.session.commit.assert_not_called()

    def test_truncated_or_empty_output_is_not_saved(self) -> None:
        for finish_reason, content in [("length", "不完整总结"), ("stop", "")]:
            with self.subTest(finish_reason=finish_reason):
                self.client.chat.completions.create.return_value.choices[0] = (
                    SimpleNamespace(
                        finish_reason=finish_reason,
                        message=SimpleNamespace(content=content),
                    )
                )
                with self.assertRaises(DocumentSummaryUnavailableError):
                    self.generate()
                self.assertEqual(self.document.summary, "旧总结")
                self.session.commit.assert_not_called()

    def test_deleted_document_is_not_saved_after_model_returns(self) -> None:
        self.session.get.side_effect = [self.document, None]
        with self.assertRaises(KnowledgeDocumentNotFoundError):
            self.generate()
        self.session.commit.assert_not_called()

    def test_reprocessing_document_is_not_saved_after_model_returns(self) -> None:
        processing_document = self.document.model_copy(
            update={"status": KnowledgeDocumentStatus.PROCESSING}
        )
        self.session.get.side_effect = [self.document, processing_document]
        with self.assertRaises(KnowledgeDocumentStateError):
            self.generate()
        self.session.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
