import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { OfferForm } from "@/components/admin/OfferForm";

export default async function EditOffer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireRole("admin", "/admin/login/");
  const [{ data: offer }, { data: courses }, { data: oc }] = await Promise.all([
    supabase.from("offers").select("*").eq("id", id).maybeSingle(),
    supabase.from("courses").select("id, title").order("sort_order"),
    supabase.from("offer_courses").select("course_id").eq("offer_id", id),
  ]);
  if (!offer) notFound();
  const selected = (oc ?? []).map((r) => r.course_id);
  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold">{offer.name}</h1>
      <p className="mb-6 text-sm text-slate-600">{selected.length} courses selected.</p>
      {sp.saved ? <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">Saved.</p> : null}
      <OfferForm offer={offer} courses={courses ?? []} selected={selected} />
    </div>
  );
}
