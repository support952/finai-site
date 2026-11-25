import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My courses", robots: { index: false } };

/** Customer area: ONLY courses with active access (enforced by RLS on course_access/course_files). */
export default async function MyCoursesPage() {
  const { supabase, profile } = await requireRole("customer", "/my-account/login/");
  const { data: access } = await supabase
    .from("course_access")
    .select("course:courses(id, title, slug, short_description, course_files(id, file_name, size_bytes))")
    .order("granted_at", { ascending: false });
  const seen = new Set<string>();
  const courses = (access ?? []).map((a: any) => a.course).filter((c: any) => c && !seen.has(c.id) && seen.add(c.id));

  return (
    <div className="container-page py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">My courses</h1>
        <form action="/my-account/logout/" method="post"><button className="btn-secondary">Sign out</button></form>
      </div>
      <p className="mt-1 text-sm text-slate-600">Signed in as {profile.email}</p>
      {courses.length === 0 ? (
        <p className="mt-8 text-slate-600">You don&apos;t have any courses yet. <Link href="/pricing/" className="underline">See bundles</Link>.</p>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {courses.map((c: any) => (
            <div key={c.id} className="card">
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{c.short_description}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {(c.course_files ?? []).length === 0 ? <li className="text-slate-500">Files coming soon.</li> : null}
                {(c.course_files ?? []).map((f: any) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{f.file_name}</span>
                    <span className="flex gap-3">
                      <a className="text-brand-600 hover:underline" href={`/api/files/${f.id}/`} target="_blank" rel="noopener">Read</a>
                      <a className="text-brand-600 hover:underline" href={`/api/files/${f.id}/?download=1`}>Download</a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
