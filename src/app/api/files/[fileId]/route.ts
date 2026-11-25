import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Course file download. RLS on course_files only returns files of courses the
 * signed-in user currently has access to; we then mint a 60-second signed URL
 * from the private bucket.
 */
export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/my-account/login/", req.url));
  const { data: file } = await supabase.from("course_files").select("storage_path, file_name").eq("id", fileId).maybeSingle();
  if (!file) return new NextResponse("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const { data, error } = await supabaseAdmin()
    .storage.from("course-files")
    .createSignedUrl(file.storage_path, 60, download ? { download: file.file_name } : undefined);
  if (error || !data) return new NextResponse("Unavailable", { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "cache-control": "no-store" } });
}
