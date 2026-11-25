import "server-only";
import { supabasePublic } from "@/lib/supabase/public";

export interface Course {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  page_count: number | null;
  price_cents: number | null;
  image_url: string | null;
  sort_order: number;
  category: { id: string; slug: string; name: string } | null;
  level: { id: string; name: string } | null;
}

export interface Offer {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  visibility: "public" | "affiliate_only";
  courses: { id: string; slug: string; title: string }[];
}

const COURSE_SELECT =
  "id, slug, title, short_description, description, page_count, price_cents, image_url, sort_order, category:categories(id,slug,name), level:levels(id,name)";

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabasePublic().from("courses").select(COURSE_SELECT).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Course[];
}

export async function getCourse(slug: string): Promise<Course | null> {
  const { data } = await supabasePublic().from("courses").select(COURSE_SELECT).eq("slug", slug).maybeSingle();
  return (data as unknown as Course) ?? null;
}

export async function listCategories() {
  const { data } = await supabasePublic().from("categories").select("id, slug, name, description").order("sort_order");
  return data ?? [];
}

export async function listPublicOffers(): Promise<Offer[]> {
  const { data, error } = await supabasePublic()
    .from("offers")
    .select("id, slug, name, description, price_cents, visibility, offer_courses(course:courses(id, slug, title, sort_order))")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((o: any) => ({
    ...o,
    courses: (o.offer_courses ?? [])
      .map((oc: any) => oc.course)
      .filter(Boolean)
      .sort((a: any, b: any) => a.sort_order - b.sort_order),
  }));
}
