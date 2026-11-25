-- Storage buckets. course-files is PRIVATE: files are only ever served through
-- short-lived signed URLs created server-side after a course_access check.
insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('course-images', 'course-images', true)
on conflict (id) do nothing;

-- Admins manage objects in both buckets. No other policies exist, so customers,
-- affiliates and anonymous users cannot list or read course-files directly.
create policy "admin manage course files" on storage.objects for all to authenticated
  using (bucket_id in ('course-files','course-images') and public.is_admin())
  with check (bucket_id in ('course-files','course-images') and public.is_admin());
