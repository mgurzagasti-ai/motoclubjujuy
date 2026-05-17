create table if not exists public.event_registrations (
  id bigint generated always as identity primary key,
  event_id text not null,
  full_name text not null,
  email text,
  phone text,
  city text,
  notes text,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant insert on public.event_registrations to anon, authenticated;

alter table public.event_registrations enable row level security;

create policy "public can create event registrations"
on public.event_registrations
for insert
to anon, authenticated
with check (true);
