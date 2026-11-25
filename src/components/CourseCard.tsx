import Link from "next/link";
import type { Course } from "@/lib/catalog";
import { usd } from "@/lib/money";

export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="card flex flex-col">
      {course.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.image_url} alt="" className="mb-4 aspect-video w-full rounded object-cover" />
      ) : (
        <div className="mb-4 flex aspect-video w-full items-center justify-center rounded bg-brand-50 text-xs text-brand-700">Image placeholder</div>
      )}
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        {course.category ? <span className="rounded bg-slate-100 px-2 py-0.5">{course.category.name}</span> : null}
        {course.level ? <span className="rounded bg-slate-100 px-2 py-0.5">{course.level.name}</span> : null}
        {course.page_count ? <span className="rounded bg-slate-100 px-2 py-0.5">{course.page_count} pages</span> : null}
      </div>
      <h3 className="text-base font-semibold">
        <Link href={`/product/${course.slug}/`} className="hover:text-brand-600">{course.title}</Link>
      </h3>
      <p className="mt-2 flex-1 text-sm text-slate-600">{course.short_description}</p>
      <p className="mt-4 font-semibold">{usd(course.price_cents)}</p>
    </article>
  );
}
