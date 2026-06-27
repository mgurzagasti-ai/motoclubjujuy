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
  '[
    {
      "id": "event-main",
      "name": "6 Motoencuentro Internacional",
      "heroEyebrow": "Moto viajeros - Multimarcas",
      "heroHeadlinePrefix": "Rodamos juntos hacia el",
      "heroHeadlineHighlight": "6 Motoencuentro Internacional",
      "heroDescription": "Moto Club Jujuy presenta su nueva imagen y el gran encuentro que recorrera Jujuy, Quebrada y Yungas. Cuatro dias para compartir ruta, amistad y pasion por las dos ruedas.",
      "summaryEyebrow": "Proximo gran encuentro",
      "summaryTitlePrefix": "Nueva fecha,",
      "summaryTitleHighlight": "nueva energia",
      "sectionTitlePrefix": "6 Motoencuentro",
      "sectionTitleHighlight": "Internacional",
      "badgeDate": "1 al 4 de octubre 2026",
      "badgeLocation": "Jujuy - Quebrada - Yungas",
      "dateNumbers": "01 02 03 04",
      "dateMonth": "Octubre 2026",
      "posterUrl": "/assets/evento-motoencuentro.jpeg",
      "posterAlt": "Afiche oficial del 6 Motoencuentro Internacional",
      "metaItems": [
        { "label": "Evento principal", "value": "6 Motoencuentro Internacional" },
        { "label": "Recorrido", "value": "Jujuy, Quebrada y Yungas" },
        { "label": "Convocatoria", "value": "Moto viajeros y multimarcas de Argentina y paises vecinos" }
      ],
      "highlightItems": [
        { "label": "Paises invitados", "value": "Argentina, Chile, Bolivia, Brasil, Paraguay y Peru" },
        { "label": "Instagram", "value": "@motoclubjujuy.oficial" },
        { "label": "Redes del afiche", "value": "Facebook: motoclubjujuy | Instagram: motoclubjujuy2015" }
      ],
      "dayItems": [
        { "day": "Jueves 1", "detail": "Recepcion, acreditaciones y bienvenida a las delegaciones." },
        { "day": "Viernes 2", "detail": "Primeras salidas, recorridos y actividades de integracion." },
        { "day": "Sabado 3", "detail": "Jornada central del encuentro con presencia de motoviajeros y multimarcas." },
        { "day": "Domingo 4", "detail": "Cierre del encuentro y ultima rodada compartida." }
      ],
      "socialItems": [
        { "label": "Instagram oficial", "value": "@motoclubjujuy.oficial" },
        { "label": "Facebook", "value": "motoclubjujuy" },
        { "label": "Instagram historico", "value": "motoclubjujuy2015" }
      ],
      "contactItems": [
        { "label": "Zona del encuentro", "value": "Jujuy, Quebrada y Yungas" },
        { "label": "Fecha confirmada", "value": "1, 2, 3 y 4 de octubre de 2026" },
        { "label": "Tipo de evento", "value": "Internacional - Moto viajeros - Multimarcas" }
      ],
      "registrationTitle": "Inscripcion abierta",
      "registrationDescription": "Reserva tu lugar para el encuentro y recibi la informacion principal de acreditacion, costos y puntos de salida.",
      "registrationHref": "https://wa.me/5493883443222",
      "registrationLabel": "Inscribirme ahora"
    }
  ]'::jsonb,
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
    "heroImage": "/assets/evento-motoencuentro.jpeg",
    "contactText": "Escribinos para sumarte al club o conocer proximos eventos.",
    "featuredEventId": "event-main"
  }'::jsonb
)
on conflict (slug) do nothing;

grant usage on schema public to anon, authenticated;
grant select on public.site_content to anon, authenticated;

alter table public.site_content enable row level security;

create policy "public can read site content"
on public.site_content
for select
to anon, authenticated
using (true);
