import Link from "next/link";
import { listCourses, listPublicOffers } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";
import { Placeholder } from "@/components/Placeholder";
import { site } from "@/config/site";
import { usd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [courses, offers] = await Promise.all([listCourses(), listPublicOffers()]);
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page py-16 md:py-24">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-brand-900 md:text-5xl">
            <Placeholder>Home page headline from finaisolutions.co</Placeholder>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-700"><Placeholder>Hero sub-heading / intro paragraph</Placeholder></p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/courses/" className="btn-primary">Browse courses</Link>
            <Link href="/pricing/" className="btn-secondary">See pricing</Link>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Courses</h2>
          <Link href="/courses/" className="text-sm font-semibold text-brand-600 hover:underline">All {courses.length} courses →</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.slice(0, 8).map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="container-page py-14">
          <h2 className="mb-6 text-2xl font-bold">Bundles</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {offers.map((o) => (
              <div key={o.id} className="card">
                <h3 className="text-lg font-semibold">{o.name}</h3>
                <p className="mt-1 text-3xl font-bold">{usd(o.price_cents)}</p>
                <p className="mt-1 text-sm text-slate-600">{o.courses.length} courses</p>
                <Link href={`/checkout/?offer=${o.slug}`} className="btn-primary mt-4 w-full">Buy {o.name}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="mb-3 text-2xl font-bold">About {site.name}</h2>
        <p className="max-w-3xl text-slate-700"><Placeholder>Home page &quot;about&quot; / value proposition section</Placeholder></p>
      </section>
    </>
  );
}
