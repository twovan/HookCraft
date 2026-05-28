-- Allow public template browsing without requiring the service role key.
-- Draft, pending, and unpublished templates remain hidden from anonymous users.
drop policy if exists "public can read published templates" on public.templates;

create policy "public can read published templates"
  on public.templates
  for select
  to anon
  using (status = 'published');
