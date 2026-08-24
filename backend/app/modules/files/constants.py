TEXT_CONTENT_TYPES = {
    "application/json",
    "text/csv",
    "text/markdown",
    "text/plain",
}

DOCUMENT_FORMAT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/html": "html",
}

DOCLING_CONTENT_TYPES = set(DOCUMENT_FORMAT_BY_CONTENT_TYPE)

DOCUMENT_CONTENT_TYPES = TEXT_CONTENT_TYPES | DOCLING_CONTENT_TYPES

CHAT_CONTENT_TYPES = {
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
    *DOCUMENT_CONTENT_TYPES,
}
