import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourse, listPublicOffers } from "@/lib/catalog";
import { usd } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCourse((await params).slug);
  return { title: c?.title ?? "Course" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();
  const bundles = (await listPublicOffers()).filter((o) => o.courses.some((c) => c.id === course.id));
  return (
    <div className="container-page grid gap-10 py-12 md:grid-cols-5">
      <div className="md:col-span-3">
        <p className="text-sm"><Link href="/courses/" className="text-brand-600 hover:underline">Courses</Link>
          {course.category ? <> / <Link href={`/product-category/${course.category.slug}/`} className="text-brand-600 hover:underline">{course.category.name}</Link></> : null}</p>
        <h1 className="mt-2 text-3xl font-bold">{course.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
          {course.level ? <span>Level: {course.level.name}</span> : null}
          {course.page_count ? <span>· {course.page_count} pages</span> : <span className="ph-marker">[PLACEHOLDER] page count</span>}
        </div>
        {course.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.image_url} alt="" className="mt-6 w-full rounded-lg object-cover" />
        ) : null}
        <div className="prose-page mt-6 whitespace-pre-line">{course.description}</div>
      </div>
      <aside className="md:col-span-2">
        <div className="card sticky top-6">
          <p className="text-3xl font-bold">{usd(course.price_cents)}</p>
          {course.price_cents ? (
            <Link href={`/checkout/?course=${course.slug}`} className="btn-primary mt-4 w-full">Buy now</Link>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Available in the bundles below.</p>
          )}
          {bundles.length ? (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 text-sm font-semibold">Included in</p>
              <ul className="space-y-2 text-sm">
                {bundles.map((b) => (
                  <li key={b.id} className="flex justify-between"><Link href="/pricing/" className="hover:underline">{b.name}</Link><span>{usd(b.price_cents)}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-6 text-xs text-slate-500">Digital product, delivered instantly after payment. See our <Link href="/refund-policy/" className="underline">Refund Policy</Link>.</p>
        </div>
      </aside>
    </div>
  );
}
