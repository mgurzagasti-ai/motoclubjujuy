export type MotoPhoto = {
  url: string;
  titulo: string;
  descripcion: string;
  publicId?: string;
};

export type InfoItem = {
  label: string;
  value: string;
};

export type EventDay = {
  day: string;
  detail: string;
};

export type NewsItem = {
  id: string;
  createdAt: string;
  title: string;
  tag: string;
  date: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
};

export type ClubEvent = {
  id: string;
  name: string;
  heroEyebrow: string;
  heroHeadlinePrefix: string;
  heroHeadlineHighlight: string;
  heroDescription: string;
  summaryEyebrow: string;
  summaryTitlePrefix: string;
  summaryTitleHighlight: string;
  sectionTitlePrefix: string;
  sectionTitleHighlight: string;
  badgeDate: string;
  badgeLocation: string;
  dateNumbers: string;
  dateMonth: string;
  posterUrl: string;
  posterAlt: string;
  metaItems: InfoItem[];
  highlightItems: InfoItem[];
  dayItems: EventDay[];
  socialItems: InfoItem[];
  contactItems: InfoItem[];
  registrationTitle: string;
  registrationDescription: string;
  registrationHref: string;
  registrationLabel: string;
};

export type MotoclubContent = {
  quienes: string;
  fotos: MotoPhoto[];
  events: ClubEvent[];
  novedades: NewsItem[];
};

export const storageKey = "motoclub_data";

export const internalImageOptions: MotoPhoto[] = [
  {
    url: "/assets/evento-motoencuentro.jpeg",
    titulo: "Afiche oficial del 6 Motoencuentro Internacional",
    descripcion: "Nueva difusión del evento 2026.",
  },
  {
    url: "/assets/logo-motoclub.jpeg",
    titulo: "Logo oficial Moto Club Jujuy",
    descripcion: "Identidad visual del club.",
  },
];

export function normalizeEvent(event: Partial<ClubEvent> | undefined, index = 0): ClubEvent {
  const fallbackEvent = createDefaultEvent();

  return {
    ...fallbackEvent,
    ...event,
    id: event?.id || `event-restored-${index}`,
    metaItems: Array.isArray(event?.metaItems) ? event.metaItems : fallbackEvent.metaItems,
    highlightItems: Array.isArray(event?.highlightItems)
      ? event.highlightItems
      : fallbackEvent.highlightItems,
    dayItems: Array.isArray(event?.dayItems) ? event.dayItems : fallbackEvent.dayItems,
    socialItems: Array.isArray(event?.socialItems) ? event.socialItems : fallbackEvent.socialItems,
    contactItems: Array.isArray(event?.contactItems)
      ? event.contactItems
      : fallbackEvent.contactItems,
  };
}

export function normalizeNewsItem(item: Partial<NewsItem> | undefined, index = 0): NewsItem {
  const fallbackNews = createDefaultNewsItem();
  const fallbackCreatedAtFromId =
    typeof item?.id === "string" && /^news-\d+$/.test(item.id)
      ? new Date(Number(item.id.replace("news-", ""))).toISOString()
      : fallbackNews.createdAt;

  return {
    ...fallbackNews,
    ...item,
    id: item?.id || `news-restored-${index}`,
    createdAt: item?.createdAt || fallbackCreatedAtFromId,
  };
}

export function sortNewsNewestFirst(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.createdAt || "");
    const timeB = Date.parse(b.createdAt || "");

    if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
      return 0;
    }

    if (Number.isNaN(timeA)) {
      return 1;
    }

    if (Number.isNaN(timeB)) {
      return -1;
    }

    return timeB - timeA;
  });
}

export function normalizeContent(parsed: Partial<MotoclubContent> | null | undefined): MotoclubContent {
  return {
    quienes: parsed?.quienes || defaultContent.quienes,
    fotos: Array.isArray(parsed?.fotos) ? parsed!.fotos : defaultContent.fotos,
    events:
      Array.isArray(parsed?.events) && parsed.events.length
        ? parsed.events.map((event, index) => normalizeEvent(event, index))
        : defaultContent.events,
    novedades:
      Array.isArray(parsed?.novedades) && parsed.novedades.length
        ? parsed.novedades.map((item, index) => normalizeNewsItem(item, index))
        : defaultContent.novedades,
  };
}

export function createDefaultNewsItem(): NewsItem {
  return {
    id: `news-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: "Nueva novedad",
    tag: "Borrador",
    date: "",
    description: "",
    imageUrl: "",
    imageAlt: "",
  };
}

export function createDefaultEvent(): ClubEvent {
  return {
    id: `event-${Date.now()}`,
    name: "6 Motoencuentro Internacional",
    heroEyebrow: "Moto viajeros - Multimarcas",
    heroHeadlinePrefix: "Rodamos juntos hacia el",
    heroHeadlineHighlight: "6 Motoencuentro Internacional",
    heroDescription:
      "Moto Club Jujuy presenta su nueva imagen y el gran encuentro que recorrerá Jujuy, Quebrada y Yungas. Cuatro días para compartir ruta, amistad y pasión por las dos ruedas.",
    summaryEyebrow: "Próximo gran encuentro",
    summaryTitlePrefix: "Nueva fecha,",
    summaryTitleHighlight: "nueva energía",
    sectionTitlePrefix: "6 Motoencuentro",
    sectionTitleHighlight: "Internacional",
    badgeDate: "1 al 4 de octubre 2026",
    badgeLocation: "Jujuy - Quebrada - Yungas",
    dateNumbers: "01 02 03 04",
    dateMonth: "Octubre 2026",
    posterUrl: "/assets/evento-motoencuentro.jpeg",
    posterAlt: "Afiche oficial del 6 Motoencuentro Internacional",
    metaItems: [
      {
        label: "Evento principal",
        value: "6 Motoencuentro Internacional",
      },
      {
        label: "Recorrido",
        value: "Jujuy, Quebrada y Yungas",
      },
      {
        label: "Convocatoria",
        value: "Moto viajeros y multimarcas de Argentina y países vecinos",
      },
    ],
    highlightItems: [
      {
        label: "Países invitados",
        value: "Argentina, Chile, Bolivia, Brasil, Paraguay y Perú",
      },
      {
        label: "Instagram",
        value: "@motoclubjujuy.oficial",
      },
      {
        label: "Redes del afiche",
        value: "Facebook: motoclubjujuy | Instagram: motoclubjujuy2015",
      },
    ],
    dayItems: [
      {
        day: "Jueves 1",
        detail: "Recepción, acreditaciones y bienvenida a las delegaciones.",
      },
      {
        day: "Viernes 2",
        detail: "Primeras salidas, recorridos y actividades de integración.",
      },
      {
        day: "Sábado 3",
        detail:
          "Jornada central del encuentro con presencia de motoviajeros y multimarcas.",
      },
      {
        day: "Domingo 4",
        detail: "Cierre del encuentro y última rodada compartida.",
      },
    ],
    socialItems: [
      {
        label: "Instagram oficial",
        value: "@motoclubjujuy.oficial",
      },
      {
        label: "Facebook",
        value: "motoclubjujuy",
      },
      {
        label: "Instagram histórico",
        value: "motoclubjujuy2015",
      },
    ],
    contactItems: [
      {
        label: "Zona del encuentro",
        value: "Jujuy, Quebrada y Yungas",
      },
      {
        label: "Fecha confirmada",
        value: "1, 2, 3 y 4 de octubre de 2026",
      },
      {
        label: "Tipo de evento",
        value: "Internacional - Moto viajeros - Multimarcas",
      },
    ],
    registrationTitle: "Inscripción abierta",
    registrationDescription:
      "Reservá tu lugar para el encuentro y recibí la información principal de acreditación, costos y puntos de salida.",
    registrationHref: "https://wa.me/5493880000000",
    registrationLabel: "Inscribirme ahora",
  };
}

export const defaultContent: MotoclubContent = {
  quienes: `
    <p>Moto Club Jujuy es una comunidad motera que une amistad, aventura y compromiso con la ruta. Nuestro nuevo perfil visual refleja lo que somos: identidad jujeña, pasión por viajar y una familia abierta a todas las marcas.</p>
    <p>Durante el año organizamos salidas, encuentros y recorridos por paisajes únicos del norte argentino. Hoy estamos enfocados en el 6 Motoencuentro Internacional, una convocatoria pensada para recibir a motoviajeros de toda la región.</p>
  `,
  fotos: internalImageOptions,
  events: [createDefaultEvent()],
  novedades: [createDefaultNewsItem()],
};
