import { saveCourse } from "@/app/admin/actions";

interface Props {
  course?: any;
  categories: { id: string; name: string }[];
  levels: { id: string; name: string }[];
}

export function CourseForm({ course, categories, levels }: Props) {
  const c = course ?? {};
  return (
    <form action={saveCourse} className="card space-y-4">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Title</label><input name="title" className="input" required defaultValue={c.title ?? ""} /></div>
        <div><label className="label">Slug (URL: /product/&lt;slug&gt;/)</label><input name="slug" className="input" required defaultValue={c.slug ?? ""} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
        <div><label className="label">Category</label>
          <select name="category_id" className="input" defaultValue={c.category_id ?? ""}><option value="">—</option>{categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><label className="label">Level</label>
          <select name="level_id" className="input" defaultValue={c.level_id ?? ""}><option value="">—</option>{levels.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><label className="label">Page count</label><input name="page_count" type="number" min={1} className="input" defaultValue={c.page_count ?? ""} /></div>
        <div><label className="label">Price (USD) — empty = not sold individually</label><input name="price" className="input" defaultValue={c.price_cents ? (c.price_cents / 100).toFixed(2) : ""} placeholder="e.g. 99.00" /></div>
        <div><label className="label">Sort order</label><input name="sort_order" type="number" className="input" defaultValue={c.sort_order ?? 0} /></div>
        <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" name="is_visible" defaultChecked={c.is_visible ?? true} /> Visible on site</label>
      </div>
      <div><label className="label">Short description</label><input name="short_description" className="input" defaultValue={c.short_description ?? ""} /></div>
      <div><label className="label">Description</label><textarea name="description" rows={10} className="input" defaultValue={c.description ?? ""} /></div>
      <button className="btn-primary">Save course</button>
    </form>
  );
}
