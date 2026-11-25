import { SetPasswordForm } from "@/components/SetPasswordForm";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSetPassword() {
  await requireRole("admin", "/admin/login/");
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-bold">Set admin password</h1>
      <SetPasswordForm redirectTo="/admin/" />
    </div>
  );
}
