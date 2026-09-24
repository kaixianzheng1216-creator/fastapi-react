import { KnowledgeDocumentPreview } from "@/app/admin/(project)/knowledge-bases/_components/document-preview";

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
