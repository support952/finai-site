import { requireRole } from "@/lib/auth";
import { OfferForm } from "@/components/admin/OfferForm";

export default async function NewOffer() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const { data: courses } = await supabase.from("courses").select("id, title").order("sort_order");
  return (<div className="max-w-4xl"><h1 className="mb-6 text-2xl font-bold">New offer</h1><OfferForm courses={courses ?? []} selected={[]} /></div>);
}
