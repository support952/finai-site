import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/money";
import { toggleCourseVisibility } from "../../actions";

export default async function AdminCourses() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, slug, price_cents, is_visible, page_count, category:categories(name), level:levels(name), course_files(count)")
    .order("sort_order");
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Courses</h1><Link href="/admin/courses/new/" className="btn-primary">Add course</Link></div>
      <table className="table mt-6 bg-white">
        <thead><tr><th>Title</th><th>Category</th><th>Level</th><th>Pages</th><th>Price</th><th>Files</th><th>Visible</th><th /></tr></thead>
        <tbody>
          {(courses ?? []).map((c: any) => (
            <tr key={c.id}>
              <td><Link href={`/admin/courses/${c.id}/`} className="font-medium text-brand-600 hover:underline">{c.title}</Link><div className="text-xs text-slate-500">/product/{c.slug}/</div></td>
              <td>{c.category?.name ?? "—"}</td><td>{c.level?.name ?? "—"}</td><td>{c.page_count ?? "—"}</td>
              <td>{usd(c.price_cents)}</td><td>{c.course_files?.[0]?.count ?? 0}</td>
              <td>{c.is_visible ? "Yes" : "Hidden"}</td>
              <td>
                <form action={toggleCourseVisibility.bind(null, c.id, !c.is_visible)}>
                  <button className="text-sm underline">{c.is_visible ? "Hide" : "Show"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
