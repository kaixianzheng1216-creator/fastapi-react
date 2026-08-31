import { KnowledgeBaseDetail } from "@/app/admin/knowledge-bases/_components/base-detail";

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ knowledgeBaseId: string }>;
}) {
  const { knowledgeBaseId } = await params;

  return <KnowledgeBaseDetail knowledgeBaseId={knowledgeBaseId} />;
}
