import { SetPasswordForm } from "@/components/SetPasswordForm";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PartnerSetPassword() {
  await requireRole("affiliate", "/partners/login/");
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-bold">Set your password</h1>
      <SetPasswordForm redirectTo="/partners/" />
    </div>
  );
}
