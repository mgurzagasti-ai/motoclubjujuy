create table if not exists public.site_content (
  slug text primary key,
  quienes text not null,
  events jsonb not null default '[]'::jsonb,
  novedades jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_content (slug, quienes, events, novedades)
values (
  'main',
  '<p>Moto Club Jujuy es una comunidad motera que une amistad, aventura y compromiso con la ruta. Nuestro nuevo perfil visual refleja lo que somos: identidad jujeña, pasión por viajar y una familia abierta a todas las marcas.</p><p>Durante el año organizamos salidas, encuentros y recorridos por paisajes únicos del norte argentino. Hoy estamos enfocados en el 6 Motoencuentro Internacional, una convocatoria pensada para recibir a motoviajeros de toda la región.</p>',
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
      "registrationHref": "https://wa.me/5493880000000",
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
  ]'::jsonb
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
