-- GARAGE: ejecutar SOLO en el Supabase original cuando se autorice.
-- Transacción única: falla sin reemplazar objetos si ya existe alguno de estos nombres.
-- Crea objetos nuevos; no altera site_content, eventos ni fotografías existentes.
begin;

create table public.garage_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  label text not null check (char_length(label) between 2 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.garage_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.garage_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  url text not null unique,
  provider text not null,
  storage_key text not null,
  created_at timestamptz not null default now(),
  check (url ~ '^https://'),
  unique (provider, storage_key)
);

create table public.garage_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  category_slug text not null references public.garage_categories(slug) on delete restrict,
  price numeric(12,2) check (price >= 0 and price <= 999999999),
  whatsapp text not null check (char_length(regexp_replace(whatsapp, '\D', '', 'g')) between 8 and 15),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) between 1 and 5),
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden','sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  moderated_at timestamptz
);

create table public.garage_submission_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index garage_listings_public_idx on public.garage_listings (created_at desc) where status = 'approved';
create index garage_listings_owner_idx on public.garage_listings (owner_id, submitted_at desc);
create index garage_uploads_owner_idx on public.garage_uploads (owner_id, created_at desc);
create index garage_submission_events_owner_idx on public.garage_submission_events (owner_id, created_at desc);

insert into public.garage_categories (slug, label) values
  ('motos', 'Motos'), ('repuestos', 'Repuestos'), ('accesorios', 'Accesorios'),
  ('indumentaria', 'Indumentaria'), ('otros', 'Otros');

create function public.garage_upload_guard() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare recent_count integer;
begin
  if new.provider = 'pending' then
    if not exists (select 1 from public.garage_members
      where user_id = new.owner_id and status = 'approved') then
      raise exception 'garage_member_not_approved';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 901));
    select count(*) into recent_count from public.garage_uploads
      where owner_id = new.owner_id and created_at > now() - interval '1 hour';
    if recent_count >= 20 then raise exception 'garage_upload_limit'; end if;
  end if;
  new.created_at := now();
  return new;
end;
$$;
create trigger garage_upload_guard_trigger before insert on public.garage_uploads
for each row execute function public.garage_upload_guard();

-- SECURITY DEFINER cambia current_user, no las claims de la petición.
-- auth.uid()/auth.role() conservan la identidad JWT; un rol NULL no es service_role.
create function public.garage_listing_guard() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare photo_url text;
declare recent_count integer;
declare active_count integer;
declare member_id uuid;
begin
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      member_id := auth.uid();
      if member_id is null or new.owner_id <> member_id then raise exception 'garage_owner_invalid'; end if;
      if not exists (select 1 from public.garage_members where user_id = member_id and status = 'approved') then
        raise exception 'garage_member_not_approved';
      end if;
      new.status := 'pending';
    end if;
    new.created_at := now();
    new.submitted_at := now();
    new.updated_at := now();
  elsif auth.role() is distinct from 'service_role' then
    member_id := auth.uid();
    if member_id is null or old.owner_id <> member_id or new.owner_id <> old.owner_id then
      raise exception 'garage_owner_invalid';
    end if;
    if not exists (select 1 from public.garage_members where user_id = member_id and status = 'approved') then
      raise exception 'garage_member_not_approved';
    end if;
    new.created_at := old.created_at;
    new.moderated_at := null;
    new.updated_at := now();
    if new.status = 'sold' and old.status = 'approved' and
       (new.title, new.description, new.category_slug, new.price, new.whatsapp, new.images)
       is not distinct from
       (old.title, old.description, old.category_slug, old.price, old.whatsapp, old.images) then
      new.submitted_at := old.submitted_at;
      return new;
    end if;
    new.status := 'pending';
    new.submitted_at := now();
  else
    new.updated_at := now();
  end if;

  -- Las imágenes deben provenir de cargas registradas para el dueño, sin atarse a un proveedor.
  for photo_url in select jsonb_array_elements_text(new.images) loop
    if not exists (select 1 from public.garage_uploads where owner_id = new.owner_id and url = photo_url and provider <> 'pending') then
      raise exception 'garage_photo_not_owned';
    end if;
  end loop;

  if auth.role() is distinct from 'service_role' then
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 902));
    select count(*) into recent_count from public.garage_submission_events
      where owner_id = new.owner_id and created_at > now() - interval '1 hour';
    if recent_count >= 5 then raise exception 'garage_limit'; end if;
    if tg_op = 'INSERT' then
      select count(*) into active_count from public.garage_listings
        where owner_id = new.owner_id and status in ('pending','approved');
      if active_count >= 25 then raise exception 'garage_active_limit'; end if;
    end if;
    insert into public.garage_submission_events (owner_id) values (new.owner_id);
  end if;
  return new;
end;
$$;
create trigger garage_listing_guard_trigger before insert or update on public.garage_listings
for each row execute function public.garage_listing_guard();

-- La lectura pública exige autorización vigente sin exponer la tabla de miembros a anon.
create function public.garage_member_is_approved(member_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.garage_members
    where user_id = member_id and status = 'approved');
$$;
revoke all on function public.garage_member_is_approved(uuid) from public;
grant execute on function public.garage_member_is_approved(uuid) to anon, authenticated, service_role;

alter table public.garage_categories enable row level security;
alter table public.garage_members enable row level security;
alter table public.garage_uploads enable row level security;
alter table public.garage_listings enable row level security;
alter table public.garage_submission_events enable row level security;

revoke all on public.garage_categories, public.garage_members, public.garage_uploads, public.garage_listings, public.garage_submission_events from anon, authenticated;
grant select on public.garage_categories to anon, authenticated;
grant select on public.garage_members to authenticated;
grant insert (user_id) on public.garage_members to authenticated;
grant select, insert, update, delete on public.garage_listings to authenticated;
grant select on public.garage_listings to anon;
grant all on public.garage_categories, public.garage_members, public.garage_uploads, public.garage_listings, public.garage_submission_events to service_role;

create policy garage_categories_read on public.garage_categories for select to anon, authenticated
using (active);

create policy garage_members_read_own on public.garage_members for select to authenticated
using (user_id = (select auth.uid()));

create policy garage_members_request_own on public.garage_members for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

create policy garage_listings_read on public.garage_listings for select to anon, authenticated
using ((status = 'approved' and public.garage_member_is_approved(owner_id))
  or owner_id = (select auth.uid()));

create policy garage_listings_insert_own on public.garage_listings for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'pending' and exists (
  select 1 from public.garage_members where user_id = (select auth.uid()) and status = 'approved'
));

create policy garage_listings_update_own on public.garage_listings for update to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.garage_members where user_id = (select auth.uid()) and status = 'approved'
))
with check (owner_id = (select auth.uid()) and status in ('pending','sold') and exists (
  select 1 from public.garage_members where user_id = (select auth.uid()) and status = 'approved'
));

create policy garage_listings_delete_own on public.garage_listings for delete to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.garage_members where user_id = (select auth.uid()) and status = 'approved'
));

commit;
