alter table public.site_content
add column if not exists settings jsonb not null default '{}'::jsonb;

update public.site_content
set settings = '{}'::jsonb
where settings is null;
