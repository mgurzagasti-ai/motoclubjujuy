export type MotoPhoto = {
  url: string;
  titulo: string;
  descripcion: string;
};

export type InfoItem = {
  label: string;
  value: string;
};

export type EventDay = {
  day: string;
  detail: string;
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
};

export type MotoclubContent = {
  quienes: string;
  fotos: MotoPhoto[];
  events: ClubEvent[];
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
  };
}

export const defaultContent: MotoclubContent = {
  quienes: `
    <p>Moto Club Jujuy es una comunidad motera que une amistad, aventura y compromiso con la ruta. Nuestro nuevo perfil visual refleja lo que somos: identidad jujeña, pasión por viajar y una familia abierta a todas las marcas.</p>
    <p>Durante el año organizamos salidas, encuentros y recorridos por paisajes únicos del norte argentino. Hoy estamos enfocados en el 6 Motoencuentro Internacional, una convocatoria pensada para recibir a motoviajeros de toda la región.</p>
  `,
  fotos: internalImageOptions,
  events: [createDefaultEvent()],
};
