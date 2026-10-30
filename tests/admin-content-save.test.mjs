import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as siteData from "../lib/site-data.ts";

function loadModule(path, dependencies = {}, globals = {}) {
  const source = readFileSync(resolve(path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const sandboxModule = { exports: {} };
  runInNewContext(compiled, {
    ...globals,
    module: sandboxModule,
    exports: sandboxModule.exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return sandboxModule.exports;
}

const version = "2026-10-22T12:35:55.716Z";
const firstEvent = { ...siteData.createDefaultEvent(), id: "event-first" };
const secondEvent = { ...siteData.createDefaultEvent(), id: "event-second", name: "Segundo" };

function createRoute() {
  let saved = null;
  const current = {
    content: siteData.normalizeContent({
      navItems: [], quienes: "", fotos: [], events: [firstEvent, secondEvent], novedades: [],
    }),
    settings: { featuredEventId: firstEvent.id },
    updatedAt: version,
  };
  const route = loadModule("app/api/site-content/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/api-auth": {
      isApiTokenValid: () => ({ ok: true }),
      createApiAuthError: () => Response.json({ error: "No autorizado" }, { status: 401 }),
    },
    "@/lib/motoclub-api": {
      mergeApiSiteContent: () => { throw new Error("Unexpected API merge"); },
      toApiSiteContent: () => ({}),
    },
    "@/lib/site-data": siteData,
    "@/lib/supabase-admin": { getSupabaseAdmin: () => ({}), validateAdminCredentials: () => true },
    "@/lib/site-content-store": {
      readSiteContentState: async () => ({ ok: true, state: current }),
      writeSiteContentState: async (state) => {
        saved = state;
        return { ok: true, state: { ...state, updatedAt: "2026-10-22T12:35:55.717Z" } };
      },
    },
    "@/lib/site-content-version": loadModule("lib/site-content-version.ts"),
  });
  return { PUT: route.PUT, get saved() { return saved; } };
}

function adminRequest(content, featuredEventId = "", settings) {
  return new Request("http://localhost/api/site-content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "test", expectedUpdatedAt: version, content, featuredEventId, settings }),
  });
}

function contentWith(events, navItems = []) {
  return { navItems, quienes: "", fotos: [], events, novedades: [] };
}

test("ADMIN saves empty collections without restoring deleted events or menu items", async () => {
  const route = createRoute();
  const response = await route.PUT(adminRequest(contentWith([])));
  assert.equal(response.status, 200);
  assert.deepEqual(route.saved.content.events, []);
  assert.deepEqual(route.saved.content.navItems, []);
  assert.equal(route.saved.settings.featuredEventId, "");
});

test("ADMIN persists featured event first, including when settings storage is unavailable", async () => {
  const route = createRoute();
  const response = await route.PUT(adminRequest(contentWith([firstEvent, secondEvent]), secondEvent.id));
  assert.equal(response.status, 200);
  assert.equal(route.saved.content.events[0].id, secondEvent.id);
  assert.equal(route.saved.settings.featuredEventId, secondEvent.id);
});

test("ADMIN rejects a hidden featured event and duplicate navigation IDs", async () => {
  const route = createRoute();
  const hidden = { ...secondEvent, published: false };
  const hiddenResponse = await route.PUT(adminRequest(contentWith([firstEvent, hidden]), hidden.id));
  assert.equal(hiddenResponse.status, 400);
  assert.equal(route.saved, null);

  const nav = { id: "same", href: "/#inicio", label: "Inicio" };
  const duplicateResponse = await route.PUT(adminRequest(contentWith([firstEvent], [nav, nav])));
  assert.equal(duplicateResponse.status, 400);
  assert.equal(route.saved, null);
});

test("site content API never invents an event after the last one was deleted", () => {
  const api = loadModule("lib/motoclub-api.ts", { "@/lib/site-data": siteData });
  const emptyState = { content: siteData.normalizeContent(contentWith([])), settings: { featuredEventId: "old-event" } };
  assert.equal(api.toApiSiteContent(emptyState).featuredEventId, "");
  assert.deepEqual(api.mergeApiSiteContent(emptyState, { heroTitle: "Actualizado" }).content.events, []);
});

test("ADMIN saves independent site settings without restoring deleted events", async () => {
  const route = createRoute();
  const response = await route.PUT(adminRequest(contentWith([]), "", {
    clubName: "Club de prueba", lodgingTitle: "Dormir en Jujuy", socialItems: [],
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(route.saved.content.events, []);
  assert.equal(route.saved.settings.clubName, "Club de prueba");
  assert.equal(route.saved.settings.lodgingTitle, "Dormir en Jujuy");
  assert.deepEqual(route.saved.settings.socialItems, []);
});

test("ADMIN rejects unsafe links in site settings", async () => {
  const route = createRoute();
  const response = await route.PUT(adminRequest(contentWith([firstEvent]), firstEvent.id, {
    lodgingLinkUrl: "javascript:alert(1)",
  }));
  assert.equal(response.status, 400);
  assert.equal(route.saved, null);
});

test("event removal regression: ADMIN deletion and hiding stay absent on the public page", async () => {
  const publicContent = loadModule("lib/public-content.ts");
  const event = {
    ...firstEvent,
    name: "6TO EVENTO INTERNACIONAL",
    heroHeadlineHighlight: "6TO EVENTO INTERNACIONAL",
    badgeDate: "1 al 4 de octubre 2026",
    highlightItems: [{ label: "Redes del afiche", value: "Redes anteriores" }],
  };
  const otherContent = {
    navItems: [{ id: "club", href: "/#quienes", label: "Club" }],
    quienes: "<p>Historia existente del club</p>",
    fotos: [],
    novedades: [],
  };

  for (const events of [[], [{ ...event, published: false }]]) {
    const route = createRoute();
    const response = await route.PUT(adminRequest({ ...otherContent, events }));
    assert.equal(response.status, 200);
    const reloaded = siteData.normalizeContent(JSON.parse(JSON.stringify(route.saved.content)));
    assert.deepEqual(reloaded.events, events);
    for (const key of Object.keys(otherContent)) {
      assert.deepEqual(reloaded[key], otherContent[key]);
    }
    const { PublicSections } = loadModule("components/public-sections.tsx", {
      react: React,
      "react/jsx-runtime": jsxRuntime,
      "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
      "@/components/photo-carousel": { PhotoCarousel: () => null },
      "@/lib/site-data": siteData,
      "@/lib/public-content": publicContent,
      "@/lib/supabase": { hasSupabaseConfig: () => true, supabase: {} },
      "@/lib/use-motoclub-content": {
        useMotoclubContent: () => ({ content: reloaded, featuredEventId: event.id, siteSettings: {}, contentReady: true }),
      },
    });
    const html = renderToStaticMarkup(React.createElement(PublicSections));
    assert.doesNotMatch(html, /id="evento"|6TO EVENTO INTERNACIONAL|Redes del afiche|1 al 4 de octubre 2026/);
    assert.match(html, /Historia existente del club/);
  }

  assert.deepEqual(siteData.defaultContent.events, []);
  assert.deepEqual(siteData.normalizeContent(null).events, []);
  assert.deepEqual(siteData.normalizeContent({ events: null }).events, []);
  const partial = siteData.normalizeContent({ events: [{ id: "saved", name: "Evento propio" }] }).events[0];
  assert.equal(partial.name, "Evento propio");
  assert.equal(partial.badgeDate, "");
  assert.deepEqual(partial.dayItems, []);
  assert.deepEqual(partial.highlightItems, []);

  // A failed refresh after an ADMIN change must not keep showing a stale event.
  const states = [];
  let unavailable = false;
  const { useMotoclubContent } = loadModule("lib/use-motoclub-content.ts", {
    react: {
      useEffect: () => {},
      useRef: (current) => ({ current }),
      useState: (value) => {
        const state = { value };
        states.push(state);
        return [value, (next) => { state.value = typeof next === "function" ? next(state.value) : next; }];
      },
    },
    "@/lib/site-data": siteData,
    "@/lib/public-content": publicContent,
    "@/lib/supabase": {
      hasSupabaseConfig: () => true,
      supabase: { from: () => ({ select: () => ({ eq: () => ({
        maybeSingle: async () => unavailable
          ? { data: null, error: { message: "Network unavailable" } }
          : { data: { ...otherContent, nav_items: otherContent.navItems, events: [event], updated_at: version }, error: null },
      }) }) }) },
    },
  }, {
    window: { localStorage: {
      getItem: () => JSON.stringify({ ...otherContent, events: [event] }),
      setItem: () => {},
    } },
  });
  const model = useMotoclubContent();
  await model.refreshSupabaseContent();
  unavailable = true;
  await model.refreshSupabaseContent();
  assert.equal(states[0].value.events.length, 0);
  assert.equal(states[0].value.quienes, otherContent.quienes);
});
