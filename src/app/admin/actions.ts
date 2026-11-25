"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseUsdToCents } from "@/lib/money";
import { setOrderStatus } from "@/lib/payments/record";
import { sendMail } from "@/lib/mail/mailgun";
import { affiliateInviteEmail } from "@/lib/mail/templates";
import { env } from "@/lib/env";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and hyphens");
const optText = z.string().trim().transform((s) => (s === "" ? null : s));
const uuidOrNull = z.string().transform((s) => (s === "" ? null : s)).pipe(z.uuid().nullable());

function fail(msg: string): never {
  throw new Error(msg);
}

// ---------------------------------------------------------------- courses
const courseSchema = z.object({
  title: z.string().trim().min(1),
  slug,
  short_description: optText,
  description: optText,
  category_id: uuidOrNull,
  level_id: uuidOrNull,
  page_count: z.string().transform((s) => (s.trim() === "" ? null : Number(s))).pipe(z.number().int().positive().nullable()),
  price: z.string(),
  sort_order: z.coerce.number().int().default(0),
  is_visible: z.string().optional().transform((v) => v === "on"),
});

export async function saveCourse(formData: FormData) {
  const { supabase } = await assertRole("admin");
  const raw = Object.fromEntries(formData);
  const p = courseSchema.safeParse(raw);
  if (!p.success) fail(p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { price, ...rest } = p.data;
  const price_cents = price.trim() === "" ? null : parseUsdToCents(price) ?? fail("Invalid price");
  const id = String(raw.id ?? "");
  const row = { ...rest, price_cents };
  const res = id
    ? await supabase.from("courses").update(row).eq("id", id).select("id").single()
    : await supabase.from("courses").insert(row).select("id").single();
  if (res.error) fail(res.error.message);
  revalidatePath("/", "layout");
  redirect(`/admin/courses/${res.data.id}/?saved=1`);
}

export async function toggleCourseVisibility(id: string, visible: boolean) {
  const { supabase } = await assertRole("admin");
  const { error } = await supabase.from("courses").update({ is_visible: visible }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/admin/courses/");
}

/** Signed upload URL so large files go straight from the browser to private storage. */
export async function createUploadUrl(courseId: string, fileName: string, kind: "file" | "image") {
  await assertRole("admin");
  z.uuid().parse(courseId);
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
  const bucket = kind === "file" ? "course-files" : "course-images";
  const path = `${courseId}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) fail(error?.message ?? "Could not create upload URL");
  return { bucket, path: data.path, token: data.token };
}

export async function registerCourseFile(courseId: string, path: string, fileName: string, mime: string, size: number) {
  const { supabase } = await assertRole("admin");
  if (!path.startsWith(`${courseId}/`)) fail("Invalid path");
  const { error } = await supabase.from("course_files").insert({ course_id: courseId, storage_path: path, file_name: fileName.slice(0, 200), mime_type: mime.slice(0, 100), size_bytes: size });
  if (error) fail(error.message);
  revalidatePath(`/admin/courses/${courseId}/`);
}

export async function setCourseImage(courseId: string, path: string) {
  const { supabase } = await assertRole("admin");
  if (!path.startsWith(`${courseId}/`)) fail("Invalid path");
  const url = supabaseAdmin().storage.from("course-images").getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("courses").update({ image_url: url }).eq("id", courseId);
  if (error) fail(error.message);
  revalidatePath(`/admin/courses/${courseId}/`);
}

export async function deleteCourseFile(fileId: string) {
  const { supabase } = await assertRole("admin");
  const { data: f } = await supabase.from("course_files").select("course_id, storage_path").eq("id", fileId).single();
  if (!f) fail("Not found");
  await supabaseAdmin().storage.from("course-files").remove([f.storage_path]);
  await supabase.from("course_files").delete().eq("id", fileId);
  revalidatePath(`/admin/courses/${f.course_id}/`);
}

// ---------------------------------------------------------------- categories & levels
export async function saveCategory(formData: FormData) {
  const { supabase } = await assertRole("admin");
  const p = z
    .object({ id: z.string().optional(), name: z.string().trim().min(1), slug, description: optText, sort_order: z.coerce.number().int().default(0) })
    .parse(Object.fromEntries(formData));
  const { id, ...row } = p;
  const res = id ? await supabase.from("categories").update(row).eq("id", id) : await supabase.from("categories").insert(row);
  if (res.error) fail(res.error.message);
  revalidatePath("/", "layout");
}

export async function deleteCategory(id: string) {
  const { supabase } = await assertRole("admin");
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
}

export async function saveLevel(formData: FormData) {
  const { supabase } = await assertRole("admin");
  const p = z.object({ id: z.string().optional(), name: z.string().trim().min(1), sort_order: z.coerce.number().int().default(0) }).parse(Object.fromEntries(formData));
  const { id, ...row } = p;
  const res = id ? await supabase.from("levels").update(row).eq("id", id) : await supabase.from("levels").insert(row);
  if (res.error) fail(res.error.message);
  revalidatePath("/admin/categories/");
}

// ---------------------------------------------------------------- offers
export async function saveOffer(formData: FormData) {
  const { supabase } = await assertRole("admin");
  const raw = Object.fromEntries(formData);
  const p = z
    .object({
      name: z.string().trim().min(1),
      slug,
      description: optText,
      price: z.string(),
      visibility: z.enum(["public", "affiliate_only"]),
      sort_order: z.coerce.number().int().default(0),
      is_active: z.string().optional().transform((v) => v === "on"),
    })
    .parse(raw);
  const courseIds = formData.getAll("course_ids").map(String);
  if (!courseIds.length) fail("Select at least one course");
  const price_cents = parseUsdToCents(p.price) ?? fail("Invalid price");
  const { price: _price, ...rest } = p;
  void _price;
  const id = String(raw.id ?? "");
  const res = id
    ? await supabase.from("offers").update({ ...rest, price_cents }).eq("id", id).select("id").single()
    : await supabase.from("offers").insert({ ...rest, price_cents }).select("id").single();
  if (res.error) fail(res.error.message);
  const offerId = res.data.id;
  await supabase.from("offer_courses").delete().eq("offer_id", offerId);
  const ins = await supabase.from("offer_courses").insert(courseIds.map((course_id) => ({ offer_id: offerId, course_id })));
  if (ins.error) fail(ins.error.message);
  revalidatePath("/", "layout");
  redirect(`/admin/offers/${offerId}/?saved=1`);
}

// ---------------------------------------------------------------- affiliates
export async function createAffiliate(formData: FormData) {
  await assertRole("admin");
  const p = z.object({ name: z.string().trim().min(1), email: z.string().trim().toLowerCase().pipe(z.email()) }).parse(Object.fromEntries(formData));
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("profiles").select("id, role").eq("email", p.email).maybeSingle();
  if (existing && existing.role !== "customer") fail("This email already belongs to an admin or affiliate");
  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email: p.email, email_confirm: true });
    if (error || !data.user) fail(error?.message ?? "Could not create user");
    userId = data.user.id;
  }
  await admin.from("profiles").update({ role: "affiliate", full_name: p.name }).eq("id", userId);
  const { data: aff, error } = await admin.from("affiliates").insert({ user_id: userId, name: p.name, email: p.email }).select("id").single();
  if (error) fail(error.message);
  await sendAffiliateInvite(p.email, p.name);
  redirect(`/admin/affiliates/${aff.id}/?created=1`);
}

async function sendAffiliateInvite(email: string, name: string) {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) fail(error?.message ?? "Could not create invite link");
  const u = new URL("/auth/confirm/", env.siteUrl());
  u.searchParams.set("token_hash", data.properties.hashed_token);
  u.searchParams.set("type", "recovery");
  u.searchParams.set("next", "/partners/set-password/");
  await sendMail(affiliateInviteEmail(email, name, u.toString()));
}

export async function resendAffiliateInvite(affiliateId: string) {
  const { supabase } = await assertRole("admin");
  const { data: a } = await supabase.from("affiliates").select("email, name").eq("id", affiliateId).single();
  if (!a) fail("Not found");
  await sendAffiliateInvite(a.email, a.name);
}

export async function updateAffiliate(formData: FormData) {
  const { supabase } = await assertRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const name = z.string().trim().min(1).parse(formData.get("name"));
  const is_active = formData.get("is_active") === "on";
  const offerIds = formData.getAll("offer_ids").map(String);
  const { error } = await supabase.from("affiliates").update({ name, is_active }).eq("id", id);
  if (error) fail(error.message);
  await supabase.from("affiliate_offers").delete().eq("affiliate_id", id);
  if (offerIds.length) {
    const ins = await supabase.from("affiliate_offers").insert(offerIds.map((offer_id) => ({ affiliate_id: id, offer_id })));
    if (ins.error) fail(ins.error.message);
  }
  revalidatePath(`/admin/affiliates/${id}/`);
  redirect(`/admin/affiliates/${id}/?saved=1`);
}

export async function revokeLink(linkId: string) {
  const { supabase } = await assertRole("admin");
  const { error } = await supabase.from("payment_links").update({ is_revoked: true }).eq("id", linkId);
  if (error) fail(error.message);
  revalidatePath("/admin/affiliates/", "layout");
}

// ---------------------------------------------------------------- orders & blocks
export async function markOrder(orderId: string, status: "refunded" | "chargeback") {
  await assertRole("admin");
  z.uuid().parse(orderId);
  // Records the refund/chargeback locally and revokes course access. Issue the
  // actual refund in the Authorize.Net merchant interface (or it arrives via webhook).
  await setOrderStatus(orderId, status);
  revalidatePath("/admin/transactions/");
}

export async function releaseBlock(blockId: string) {
  const { supabase, user } = await assertRole("admin");
  const { error } = await supabase.from("card_blocks").update({ released_at: new Date().toISOString(), released_by: user.id }).eq("id", blockId);
  if (error) fail(error.message);
  revalidatePath("/admin/blocks/");
}
