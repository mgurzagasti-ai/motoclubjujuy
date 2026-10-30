create table if not exists public.site_content (
  slug text primary key,
  nav_items jsonb not null default '[]'::jsonb,
  quienes text not null,
  fotos jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  novedades jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content
add column if not exists nav_items jsonb not null default '[]'::jsonb;

alter table public.site_content
add column if not exists fotos jsonb not null default '[]'::jsonb;

alter table public.site_content
add column if not exists settings jsonb not null default '{}'::jsonb;

insert into public.site_content (slug, nav_items, quienes, fotos, events, novedades, settings)
values (
  'main',
  '[
    { "id": "nav-inicio", "href": "/#inicio", "label": "Inicio" },
    { "id": "nav-evento", "href": "/#evento", "label": "Evento 2026" },
    { "id": "nav-alojamientos", "href": "/alojamientos-sugeridos", "label": "Alojamientos sugeridos" },
    { "id": "nav-novedades", "href": "/#novedades", "label": "Novedades" },
    { "id": "nav-quienes", "href": "/#quienes", "label": "Quienes somos" },
    { "id": "nav-fotos", "href": "/#fotos", "label": "Galeria" },
    { "id": "nav-admin", "href": "/admin", "label": "Admin" }
  ]'::jsonb,
  '<p>Moto Club Jujuy es una comunidad motera que une amistad, aventura y compromiso con la ruta. Nuestro nuevo perfil visual refleja lo que somos: identidad jujeña, pasión por viajar y una familia abierta a todas las marcas.</p><p>Durante el año organizamos salidas, encuentros y recorridos por paisajes únicos del norte argentino. Hoy estamos enfocados en el 6 Motoencuentro Internacional, una convocatoria pensada para recibir a motoviajeros de toda la región.</p>',
  '[
    {
      "url": "/assets/evento-motoencuentro.jpeg",
      "titulo": "Afiche oficial del 6 Motoencuentro Internacional",
      "descripcion": "Nueva difusion del evento 2026."
    },
    {
      "url": "/assets/logo-motoclub.jpeg",
      "titulo": "Logo oficial Moto Club Jujuy",
      "descripcion": "Identidad visual del club."
    }
  ]'::jsonb,
  '[]'::jsonb,
  '[
    {
      "id": "news-main",
      "title": "Nueva rodada anunciada",
      "tag": "Novedad principal",
      "date": "Mayo 2026",
      "description": "Compartimos la agenda del club con nuevas salidas, encuentros y actividades para toda la comunidad motera.",
      "imageUrl": "/assets/evento-motoencuentro.jpeg",
      "imageAlt": "Afiche de actividad de Moto Club Jujuy"
    }
  ]'::jsonb,
  '{
    "heroTitle": "Moto Club Jujuy",
    "heroSubtitle": "Comunidad, ruta y encuentros",
    "heroImage": "",
    "contactText": "Escribinos para sumarte al club o conocer proximos eventos.",
    "featuredEventId": ""
  }'::jsonb
)
on conflict (slug) do nothing;

-- Events are managed only through ADMIN/API. Never seed or overwrite them here.
update public.site_content
set nav_items = nav_items || '[{ "id": "nav-alojamientos", "href": "/alojamientos-sugeridos", "label": "Alojamientos sugeridos" }]'::jsonb
where slug = 'main'
  and jsonb_typeof(nav_items) = 'array'
  and not exists (
    select 1
    from jsonb_array_elements(nav_items) as item
    where item->>'id' = 'nav-alojamientos'
      or item->>'href' = 'https://sites.google.com/view/5tomotoencuentrojujuy/alojamientos-sugeridos'
      or lower(item->>'label') = 'alojamientos sugeridos'
  );

update public.site_content
set nav_items = (
  select jsonb_agg(
    case
      when item->>'id' = 'nav-alojamientos'
        or item->>'href' = 'https://sites.google.com/view/5tomotoencuentrojujuy/alojamientos-sugeridos'
        or lower(item->>'label') = 'alojamientos sugeridos'
      then '{ "id": "nav-alojamientos", "href": "/alojamientos-sugeridos", "label": "Alojamientos sugeridos" }'::jsonb
      else item
    end
  )
  from jsonb_array_elements(nav_items) as item
)
where slug = 'main'
  and jsonb_typeof(nav_items) = 'array';

grant usage on schema public to anon, authenticated;
grant select on public.site_content to anon, authenticated;

alter table public.site_content enable row level security;

create policy "public can read site content"
on public.site_content
for select
to anon, authenticated
using (true);
