import { SkillDetail } from "@/components/skill-detail";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillName: string }>;
}) {
  const { skillName } = await params;

  return <SkillDetail skillName={skillName} />;
}
