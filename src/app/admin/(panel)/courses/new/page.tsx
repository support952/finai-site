import { requireRole } from "@/lib/auth";
import { CourseForm } from "@/components/admin/CourseForm";

export default async function NewCourse() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const [{ data: categories }, { data: levels }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("levels").select("id, name").order("sort_order"),
  ]);
  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Add course</h1>
      <p className="mb-4 text-sm text-slate-600">Save the course first, then upload its files and image.</p>
      <CourseForm categories={categories ?? []} levels={levels ?? []} />
    </div>
  );
}
