-- Photo Studio — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ============================================================
-- 1. Projects table
-- ============================================================
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  thumbnail   text,                          -- storage path or data URL
  config      jsonb not null default '{}'::jsonb,
  results     jsonb not null default '{}'::jsonb
);

-- Index for sorting by most recent
create index if not exists idx_projects_updated_at on projects (updated_at desc);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- ============================================================
-- 2. Storage bucket for project images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

-- Allow public read access (images are not sensitive)
create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'project-images');

-- Allow anonymous insert/update/delete (no auth for now)
create policy "Anonymous upload"
  on storage.objects for insert
  with check (bucket_id = 'project-images');

create policy "Anonymous update"
  on storage.objects for update
  using (bucket_id = 'project-images');

create policy "Anonymous delete"
  on storage.objects for delete
  using (bucket_id = 'project-images');

-- ============================================================
-- 3. RLS — disable for projects table (no auth yet)
-- ============================================================
alter table projects enable row level security;

create policy "Allow all on projects"
  on projects for all
  using (true)
  with check (true);
