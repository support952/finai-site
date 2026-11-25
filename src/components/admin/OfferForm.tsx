import { saveOffer } from "@/app/admin/actions";

export function OfferForm({ offer, courses, selected }: { offer?: any; courses: { id: string; title: string }[]; selected: string[] }) {
  const o = offer ?? {};
  return (
    <form action={saveOffer} className="card space-y-4">
      {o.id ? <input type="hidden" name="id" value={o.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Name</label><input name="name" className="input" required defaultValue={o.name ?? ""} /></div>
        <div><label className="label">Slug</label><input name="slug" className="input" required defaultValue={o.slug ?? ""} /></div>
        <div><label className="label">Price (USD)</label><input name="price" className="input" required defaultValue={o.price_cents ? (o.price_cents / 100).toFixed(2) : ""} /></div>
        <div><label className="label">Visibility</label>
          <select name="visibility" className="input" defaultValue={o.visibility ?? "public"}>
            <option value="public">Public on site</option>
            <option value="affiliate_only">Affiliate-only (payment links only)</option>
          </select></div>
        <div><label className="label">Sort order</label><input name="sort_order" type="number" className="input" defaultValue={o.sort_order ?? 0} /></div>
        <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={o.is_active ?? true} /> Active (can be purchased)</label>
      </div>
      <div><label className="label">Description</label><input name="description" className="input" defaultValue={o.description ?? ""} /></div>
      <fieldset>
        <legend className="label">Included courses</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="course_ids" value={c.id} defaultChecked={selected.includes(c.id)} /> {c.title}</label>
          ))}
        </div>
      </fieldset>
      <button className="btn-primary">Save offer</button>
    </form>
  );
}
