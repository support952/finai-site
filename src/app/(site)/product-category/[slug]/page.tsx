import { notFound } from "next/navigation";
import Link from "next/link";
import { listCategories, listCourses } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [courses, categories] = await Promise.all([listCourses(), listCategories()]);
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const list = courses.filter((c) => c.category?.slug === slug);
  return (
    <div className="container-page py-12">
      <p className="text-sm"><Link href="/courses/" className="text-brand-600 hover:underline">Courses</Link> / {cat.name}</p>
      <h1 className="mt-2 text-3xl font-bold">{cat.name}</h1>
      {cat.description ? <p className="mt-2 text-slate-600">{cat.description}</p> : null}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </div>
  );
}
