TEXT_CONTENT_TYPES = {
    "application/json",
    "text/csv",
    "text/markdown",
    "text/plain",
}

IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

DOCUMENT_FORMAT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "text/csv": "csv",
    "text/html": "html",
    "text/markdown": "md",
    "text/plain": "md",
}

DOCLING_CONTENT_TYPES = (
    set(DOCUMENT_FORMAT_BY_CONTENT_TYPE) - TEXT_CONTENT_TYPES - IMAGE_CONTENT_TYPES
)

DOCUMENT_CONTENT_TYPES = TEXT_CONTENT_TYPES | DOCLING_CONTENT_TYPES

KNOWLEDGE_CONTENT_TYPES = DOCUMENT_CONTENT_TYPES | IMAGE_CONTENT_TYPES

CHAT_CONTENT_TYPES = KNOWLEDGE_CONTENT_TYPES
