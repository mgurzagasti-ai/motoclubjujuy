export type MotoPhoto = {
  id?: string;
  url: string;
  titulo: string;
  descripcion: string;
  publicId?: string;
  category?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type InfoItem = {
  label: string;
  value: string;
};

export type EventDay = {
  day: string;
  detail: string;
  imageUrl?: string;
  imageAlt?: string;
};

export type NavItem = {
  id: string;
  href: string;
  label: string;
  visible?: boolean;
  adminManaged?: boolean;
  garageManaged?: boolean;
};

export const navbarSavedEvent = "motoclub:navbar-saved";

export function getEditableNavItems(items: NavItem[], legacyGarageVisible = true): NavItem[] {
  const managed = items.some((item) => item.garageManaged === true);
  let hasGarage = false;
  const navItems = items.filter((item) => {
    const garage = item.id === "nav-garage" || item.href.trim().replace(/\/+$/, "") === "/garage";
    if (!garage) return true;
    if (hasGarage) return false;
    hasGarage = true;
    return true;
  }).map((item) => {
    const garage = item.id === "nav-garage" || item.href.trim().replace(/\/+$/, "") === "/garage";
    return garage && !managed && !legacyGarageVisible ? { ...item, visible: false } : item;
  });

  // Adopt the old appended link once. Saved menus and explicit empty lists are authoritative.
  if (!hasGarage && !managed && items.length > 0) {
    navItems.push({ id: "nav-garage", href: "/garage", label: "Garage", visible: legacyGarageVisible });
  }
  return navItems;
}

export type NewsItem = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  title: string;
  tag: string;
  date: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  slug?: string;
  summary?: string;
  content?: string;
  coverImage?: string;
  published?: boolean;
};

export type ClubEvent = {
  id: string;
  name: string;
  date?: string;
  location?: string;
  coverImage?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  navItems: NavItem[];
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

export const suggestedLodgingNavItem: NavItem = {
  id: "nav-alojamientos",
  href: "/alojamientos-sugeridos",
  label: "Alojamientos sugeridos",
};

export const defaultNavItems: NavItem[] = [
  { id: "nav-inicio", href: "/#inicio", label: "Inicio" },
  { id: "nav-evento", href: "/#evento", label: "Evento 2026" },
  suggestedLodgingNavItem,
  { id: "nav-novedades", href: "/#novedades", label: "Novedades" },
  { id: "nav-quienes", href: "/#quienes", label: "Quienes somos" },
  { id: "nav-fotos", href: "/#fotos", label: "Galeria" },
  { id: "nav-admin", href: "/admin", label: "Admin" },
  { id: "nav-contacto", href: "/#footer", label: "Contacto" },
];

function slugifyRouteSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeNavHref(value: string | undefined, fallbackHref: string) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return fallbackHref;
  }

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/#")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("#")) {
    return `/${trimmedValue}`;
  }

  if (trimmedValue.startsWith("/")) {
    const normalizedPath = trimmedValue
      .split("/")
      .map((segment, index) => (index === 0 ? "" : slugifyRouteSegment(segment)))
      .join("/");

    return normalizedPath === "/" ? fallbackHref : normalizedPath;
  }

  const slug = slugifyRouteSegment(trimmedValue);
  return slug ? `/${slug}` : fallbackHref;
}

export function normalizeEvent(event: Partial<ClubEvent> | undefined, index = 0): ClubEvent {
  const template = createDefaultEvent();
  const source = event ?? {};
  const blankEvent = Object.fromEntries(Object.entries(template).map(([key, value]) =>
    [key, Array.isArray(value) ? [] : typeof value === "string" ? "" : value]
  )) as unknown as ClubEvent;
  return {
    ...blankEvent,
    ...source,
    id: source.id || `event-restored-${index}`,
    metaItems: Array.isArray(source.metaItems) ? source.metaItems : [],
    highlightItems: Array.isArray(source.highlightItems) ? source.highlightItems : [],
    dayItems: Array.isArray(source.dayItems) ? source.dayItems.map((item) => ({
      day: item?.day ?? "",
      detail: item?.detail ?? "",
      imageUrl: item?.imageUrl ?? "",
      imageAlt: item?.imageAlt ?? "",
    })) : [],
    socialItems: Array.isArray(source.socialItems) ? source.socialItems : [],
    contactItems: Array.isArray(source.contactItems) ? source.contactItems : [],
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
    title: "",
    tag: "",
    ...item,
    id: item?.id || `news-restored-${index}`,
    createdAt: item?.createdAt || fallbackCreatedAtFromId,
  };
}

export function createDefaultNavItem(index = 0): NavItem {
  const defaultItem = defaultNavItems[index];

  if (defaultItem) {
    return defaultItem;
  }

  return {
    id: `nav-${Date.now()}-${index}`,
    href: "/nueva-pagina",
    label: "Nuevo item",
  };
}

export function normalizeNavItem(item: Partial<NavItem> | undefined, index = 0): NavItem {
  const fallbackItem = createDefaultNavItem(index);

  return {
    ...fallbackItem,
    ...item,
    id: item?.id || `nav-restored-${index}`,
    href: normalizeNavHref(item?.href, fallbackItem.href),
    label: typeof item?.label === "string" ? item.label.trim() : fallbackItem.label,
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
  const navItems = Array.isArray(parsed?.navItems)
    ? parsed.navItems.map((item, index) => normalizeNavItem(item, index))
    : defaultContent.navItems;
  const isLegacyMenu =
    navItems.some((item) => item.id === "nav-inicio") &&
    navItems.some((item) => item.id === "nav-admin") &&
    !navItems.some((item) => item.adminManaged);
  const hasContact = navItems.some((item) => item.id === "nav-contacto" || item.href === "/#footer");
  const normalizedNavItems = isLegacyMenu && !hasContact
    ? [...navItems, { id: "nav-contacto", href: "/#footer", label: "Contacto" }]
    : navItems;

  return {
    navItems: normalizedNavItems,
    quienes: typeof parsed?.quienes === "string" ? parsed.quienes : defaultContent.quienes,
    fotos: Array.isArray(parsed?.fotos) ? parsed!.fotos : defaultContent.fotos,
    events: Array.isArray(parsed?.events)
      ? parsed.events.map((event, index) => normalizeEvent(event, index))
      : [],
    novedades: Array.isArray(parsed?.novedades)
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

// New events and missing fields must never inherit a previously advertised event.
export function createDefaultEvent(): ClubEvent {
  return {
    id: `event-${Date.now()}`,
    name: "Nuevo evento",
    heroEyebrow: "",
    heroHeadlinePrefix: "",
    heroHeadlineHighlight: "",
    heroDescription: "",
    summaryEyebrow: "",
    summaryTitlePrefix: "",
    summaryTitleHighlight: "",
    sectionTitlePrefix: "",
    sectionTitleHighlight: "",
    badgeDate: "",
    badgeLocation: "",
    dateNumbers: "",
    dateMonth: "",
    posterUrl: "",
    posterAlt: "",
    metaItems: [],
    highlightItems: [],
    dayItems: [],
    socialItems: [],
    contactItems: [],
    registrationTitle: "",
    registrationDescription: "",
    registrationHref: "",
    registrationLabel: "",
  };
}

export const defaultContent: MotoclubContent = {
  navItems: defaultNavItems,
  quienes: `
    <p>Moto Club Jujuy es una comunidad motera que une amistad, aventura y compromiso con la ruta. Nuestro nuevo perfil visual refleja lo que somos: identidad jujeña, pasión por viajar y una familia abierta a todas las marcas.</p>
    <p>Durante el año organizamos salidas, encuentros y recorridos por paisajes únicos del norte argentino. Hoy estamos enfocados en el 6 Motoencuentro Internacional, una convocatoria pensada para recibir a motoviajeros de toda la región.</p>
  `,
  fotos: internalImageOptions,
  events: [],
  novedades: [createDefaultNewsItem()],
};
