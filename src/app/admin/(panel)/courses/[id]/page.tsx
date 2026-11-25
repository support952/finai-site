import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { CourseForm } from "@/components/admin/CourseForm";
import { Uploader } from "@/components/admin/Uploader";
import { deleteCourseFile } from "../../../actions";

export default async function EditCourse({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireRole("admin", "/admin/login/");
  const [{ data: course }, { data: categories }, { data: levels }, { data: files }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("levels").select("id, name").order("sort_order"),
    supabase.from("course_files").select("id, file_name, size_bytes, created_at").eq("course_id", id).order("created_at"),
  ]);
  if (!course) notFound();
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">{course.title}</h1>
      {sp.saved ? <p className="rounded bg-green-50 p-3 text-sm text-green-800">Saved.</p> : null}
      <CourseForm course={course} categories={categories ?? []} levels={levels ?? []} />
      <section className="card">
        <h2 className="mb-3 font-semibold">Course files (private storage)</h2>
        <ul className="mb-4 space-y-2 text-sm">
          {(files ?? []).map((f) => (
            <li key={f.id} className="flex items-center justify-between">
              <span>{f.file_name} <span className="text-slate-500">({Math.round((f.size_bytes ?? 0) / 1024)} KB)</span></span>
              <form action={deleteCourseFile.bind(null, f.id)}><button className="text-red-600 underline">Delete</button></form>
            </li>
          ))}
          {(files ?? []).length === 0 ? <li className="text-slate-500">No files yet.</li> : null}
        </ul>
        <Uploader courseId={course.id} kind="file" />
      </section>
      <section className="card">
        <h2 className="mb-3 font-semibold">Course image (public)</h2>
        {course.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.image_url} alt="" className="mb-3 h-40 rounded object-cover" />
        ) : null}
        <Uploader courseId={course.id} kind="image" />
      </section>
    </div>
  );
}
