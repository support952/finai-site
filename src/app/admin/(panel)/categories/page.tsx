import { requireRole } from "@/lib/auth";
import { deleteCategory, saveCategory, saveLevel } from "../../actions";

export default async function AdminCategories() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const [{ data: cats }, { data: levels }] = await Promise.all([
    supabase.from("categories").select("*, courses(count)").order("sort_order"),
    supabase.from("levels").select("*").order("sort_order"),
  ]);
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="mt-1 text-sm text-slate-600">Shown at /product-category/&lt;slug&gt;/ and as filters on /courses/.</p>
        <div className="mt-4 space-y-3">
          {(cats ?? []).map((c: any) => (
            <div key={c.id} className="card flex flex-wrap items-end gap-3">
              <form action={saveCategory} className="flex flex-1 flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={c.id} />
                <div><label className="label">Name</label><input name="name" className="input" defaultValue={c.name} required /></div>
                <div><label className="label">Slug</label><input name="slug" className="input" defaultValue={c.slug} required /></div>
                <div className="flex-1"><label className="label">Description</label><input name="description" className="input" defaultValue={c.description ?? ""} /></div>
                <div className="w-24"><label className="label">Order</label><input name="sort_order" type="number" className="input" defaultValue={c.sort_order} /></div>
                <button className="btn-secondary">Save</button>
              </form>
              <form action={deleteCategory.bind(null, c.id)}><button className="text-sm text-red-600 underline" title={`${c.courses?.[0]?.count ?? 0} courses`}>Delete</button></form>
            </div>
          ))}
          <form action={saveCategory} className="card flex flex-wrap items-end gap-3">
            <div><label className="label">New category</label><input name="name" className="input" placeholder="Name" required /></div>
            <div><label className="label">Slug</label><input name="slug" className="input" placeholder="slug" required /></div>
            <div className="flex-1"><label className="label">Description</label><input name="description" className="input" /></div>
            <div className="w-24"><label className="label">Order</label><input name="sort_order" type="number" className="input" defaultValue={0} /></div>
            <button className="btn-primary">Add</button>
          </form>
        </div>
      </section>
      <section>
        <h2 className="text-xl font-bold">Levels</h2>
        <div className="mt-4 space-y-3">
          {(levels ?? []).map((l) => (
            <form key={l.id} action={saveLevel} className="card flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={l.id} />
              <div><label className="label">Name</label><input name="name" className="input" defaultValue={l.name} required /></div>
              <div className="w-24"><label className="label">Order</label><input name="sort_order" type="number" className="input" defaultValue={l.sort_order} /></div>
              <button className="btn-secondary">Save</button>
            </form>
          ))}
          <form action={saveLevel} className="card flex flex-wrap items-end gap-3">
            <div><label className="label">New level</label><input name="name" className="input" required /></div>
            <div className="w-24"><label className="label">Order</label><input name="sort_order" type="number" className="input" defaultValue={0} /></div>
            <button className="btn-primary">Add</button>
          </form>
        </div>
      </section>
    </div>
  );
}
