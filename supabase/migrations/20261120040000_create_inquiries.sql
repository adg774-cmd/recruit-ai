create extension if not exists pgcrypto;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('company', 'agent_provider')),
  company_name text,
  contact_name text,
  email text not null,
  category text,
  agent_specialty text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'spam')),
  admin_notes text not null default '',
  source_path text not null default '/',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_created_at_idx
  on public.inquiries (created_at desc);

create index if not exists inquiries_status_idx
  on public.inquiries (status);

alter table public.inquiries enable row level security;

revoke all on table public.inquiries from anon, authenticated;

create or replace function public.set_inquiries_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at
before update on public.inquiries
for each row execute function public.set_inquiries_updated_at();
