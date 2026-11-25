import type { Metadata } from "next";
import Link from "next/link";
import { listCategories, listCourses } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const [courses, categories] = await Promise.all([listCourses(), listCategories()]);
  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Courses</h1>
      <nav className="mt-5 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-brand-600 px-3 py-1 text-white">All</span>
        {categories.map((c) => (
          <Link key={c.id} href={`/product-category/${c.slug}/`} className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50">{c.name}</Link>
        ))}
      </nav>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {courses.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </div>
  );
}
