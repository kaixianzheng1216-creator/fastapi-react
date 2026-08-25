import { KnowledgeDocumentPreview } from "@/app/admin/knowledge-bases/_components/knowledge-document-preview";

export default async function KnowledgeDocumentPreviewPage({
  params,
}: {
  params: Promise<{ knowledgeBaseId: string; documentId: string }>;
}) {
  const { knowledgeBaseId, documentId } = await params;

  return (
    <KnowledgeDocumentPreview
      knowledgeBaseId={knowledgeBaseId}
      documentId={documentId}
    />
  );
}
