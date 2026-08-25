import { SkillDetail } from "@/app/(authenticated)/skills/_components/skill-detail";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillName: string }>;
}) {
  const { skillName } = await params;

  return <SkillDetail skillName={skillName} />;
}
