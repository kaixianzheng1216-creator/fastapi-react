import { libraryDocumentsDownloadOriginalDocument } from "@/lib/client";

export async function downloadOriginalLibraryDocument(
  documentId: string,
): Promise<void> {
  const { data } = await libraryDocumentsDownloadOriginalDocument({
    path: { document_id: documentId },
    throwOnError: true,
  });

  window.location.assign(data.downloadUrl);
}
