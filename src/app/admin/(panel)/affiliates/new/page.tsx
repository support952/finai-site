import { requireRole } from "@/lib/auth";
import { createAffiliate } from "../../../actions";

export default async function NewAffiliate() {
  await requireRole("admin", "/admin/login/");
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New affiliate</h1>
      <form action={createAffiliate} className="card space-y-4">
        <div><label className="label">Name</label><input name="name" className="input" required /></div>
        <div><label className="label">Email (login)</label><input name="email" type="email" className="input" required /></div>
        <p className="text-sm text-slate-600">The affiliate receives an email to set their password, then signs in at /partners/login/. Choose their offers on the next screen.</p>
        <button className="btn-primary">Create &amp; send invite</button>
      </form>
    </div>
  );
}
