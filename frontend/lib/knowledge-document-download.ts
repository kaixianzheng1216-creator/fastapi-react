import {
  knowledgeDocumentsDownloadOriginalDocument,
  knowledgeDocumentsReadDocumentPreview,
} from "@/lib/client";

export async function downloadOriginalKnowledgeDocument(
  documentId: string,
): Promise<void> {
  const { data } = await knowledgeDocumentsDownloadOriginalDocument({
    path: { document_id: documentId },
    throwOnError: true,
  });

  const frame = document.createElement("iframe");

  frame.hidden = true;

  frame.title = "下载原文件";

  frame.src = data.downloadUrl;

  document.body.appendChild(frame);

  window.setTimeout(() => frame.remove(), 60_000);
}

export async function downloadMarkdownKnowledgeDocument(
  documentId: string,
): Promise<void> {
  const { data } = await knowledgeDocumentsReadDocumentPreview({
    path: { document_id: documentId },
    throwOnError: true,
  });

  saveMarkdownDocument(data.filename, data.content);
}

function saveMarkdownDocument(filename: string, content: string): void {
  const extensionIndex = filename.lastIndexOf(".");

  const basename =
    extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;

  const blobUrl = URL.createObjectURL(
    new Blob([content], { type: "text/markdown;charset=utf-8" }),
  );

  const anchor = document.createElement("a");

  anchor.href = blobUrl;

  anchor.download = `${basename}.md`;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
