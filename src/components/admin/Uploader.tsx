"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { createUploadUrl, registerCourseFile, setCourseImage } from "@/app/admin/actions";

/** Uploads directly to Supabase Storage via a server-issued signed upload URL. */
export function Uploader({ courseId, kind }: { courseId: string; kind: "file" | "image" }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      setStatus(`Uploading ${file.name}…`);
      try {
        const { bucket, path, token } = await createUploadUrl(courseId, file.name, kind);
        const { error } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
        if (error) throw error;
        if (kind === "file") await registerCourseFile(courseId, path, file.name, file.type, file.size);
        else await setCourseImage(courseId, path);
      } catch (err) {
        setStatus(`Upload failed: ${(err as Error).message}`);
        return;
      }
    }
    setStatus("Done");
    input.value = "";
    router.refresh();
  }
  return (
    <div className="text-sm">
      <input type="file" multiple={kind === "file"} accept={kind === "image" ? "image/*" : undefined} onChange={onChange} />
      {status ? <p className="mt-2 text-slate-600">{status}</p> : null}
    </div>
  );
}
