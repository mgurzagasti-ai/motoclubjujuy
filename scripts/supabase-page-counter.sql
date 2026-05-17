create table if not exists public.page_counters (
  slug text primary key,
  total_visits bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.page_counters (slug, total_visits)
values ('home', 0)
on conflict (slug) do nothing;

create or replace function public.increment_page_visits(page_slug text)
returns bigint
language plpgsql
security definer
as $$
declare
  next_total bigint;
begin
  insert into public.page_counters (slug, total_visits)
  values (page_slug, 1)
  on conflict (slug)
  do update set
    total_visits = public.page_counters.total_visits + 1,
    updated_at = now()
  returning total_visits into next_total;

  return next_total;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.page_counters to anon, authenticated;
grant execute on function public.increment_page_visits(text) to anon, authenticated;

alter table public.page_counters enable row level security;

create policy "public can read page counters"
on public.page_counters
for select
to anon, authenticated
using (true);
