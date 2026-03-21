-- FrameFlow — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ============================================================
-- 1. Projects table
-- ============================================================
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,                 -- owner (auth.uid())
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  thumbnail   text,                          -- storage path or data URL
  config      jsonb not null default '{}'::jsonb,
  results     jsonb not null default '{}'::jsonb
);

-- Index for sorting by most recent
create index if not exists idx_projects_updated_at on projects (updated_at desc);

-- Index for filtering by owner
create index if not exists idx_projects_user_id on projects (user_id);

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

-- Authenticated users can upload to project-images
create policy "Authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'project-images' and auth.role() = 'authenticated');

-- Authenticated users can update their own uploads
create policy "Authenticated update"
  on storage.objects for update
  using (bucket_id = 'project-images' and auth.role() = 'authenticated');

-- Authenticated users can delete their own uploads
create policy "Authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'project-images' and auth.role() = 'authenticated');

-- ============================================================
-- 3. RLS — enforce per-user access on projects
-- ============================================================
alter table projects enable row level security;

-- Users can only see their own projects
create policy "Users read own projects"
  on projects for select
  using (auth.uid() = user_id);

-- Users can only insert projects they own
create policy "Users insert own projects"
  on projects for insert
  with check (auth.uid() = user_id);

-- Users can only update their own projects
create policy "Users update own projects"
  on projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only delete their own projects
create policy "Users delete own projects"
  on projects for delete
  using (auth.uid() = user_id);
