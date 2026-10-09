import { AuthLayout } from "@/components/layout/auth-layout";
import { InvitationForm } from "./invitation-form";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthLayout>
      <InvitationForm token={token} />
    </AuthLayout>
  );
}
