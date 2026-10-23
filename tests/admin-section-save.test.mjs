import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as siteData from "../lib/site-data.ts";

function load(path, dependencies = {}) {
  const source = readFileSync(resolve(path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandboxModule = { exports: {} };
  runInNewContext(compiled, {
    module: sandboxModule,
    exports: sandboxModule.exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return sandboxModule.exports;
}

const publicContent = load("lib/public-content.ts");
const sectionSave = load("lib/admin-section-save.ts", { "@/lib/public-content": publicContent });
const version = "2026-10-22T12:35:55.716Z";
const oldEvent = { ...siteData.defaultContent.events[0], id: "old-event", name: "" };
const oldNews = { ...siteData.createDefaultNewsItem(), id: "old-news", title: "", published: false };
const oldPhoto = { url: "/assets/old.jpg", titulo: "", descripcion: "", published: true };

function initialState() {
  return {
    content: { navItems: [], quienes: "", events: [oldEvent], novedades: [oldNews], fotos: [oldPhoto] },
    settings: {},
    updatedAt: version,
  };
}

function createRoute({ authorized = true } = {}) {
  const state = initialState();
  const writes = [];
  const route = load("app/api/site-content/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/api-auth": { isApiTokenValid: () => ({ ok: true }), createApiAuthError: () => Response.json({}, { status: 401 }) },
    "@/lib/motoclub-api": { mergeApiSiteContent: () => { throw new Error("Unexpected API merge"); }, toApiSiteContent: () => ({}) },
    "@/lib/site-data": siteData,
    "@/lib/admin-section-save": sectionSave,
    "@/lib/supabase-admin": { getSupabaseAdmin: () => ({}), validateAdminCredentials: () => authorized },
    "@/lib/site-content-store": {
      readSiteContentState: async () => ({ ok: true, state }),
      writeSiteContentState: async () => { throw new Error("Full save must not run"); },
      writeSiteContentChanges: async (changes, expected) => {
        assert.equal(expected, state.updatedAt);
        writes.push(changes);
        const content = { ...state.content };
        for (const [column, key] of Object.entries({ nav_items: "navItems", quienes: "quienes", fotos: "fotos", events: "events", novedades: "novedades" })) {
          if (column in changes) content[key] = changes[column];
        }
        state.content = content;
        if (changes.settings) state.settings = changes.settings;
        state.updatedAt = "2026-10-22T12:35:55.717Z";
        return { ok: true, state };
      },
    },
    "@/lib/site-content-version": load("lib/site-content-version.ts"),
  });
  return { PUT: route.PUT, state, writes };
}

function request(section, sectionData, expectedUpdatedAt = version) {
  return new Request("http://localhost/api/site-content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "test", section, sectionData, expectedUpdatedAt }),
  });
}

test("one General Settings field saves with incomplete legacy events and optional other settings", async () => {
  const route = createRoute();
  const response = await route.PUT(request("settings", { heroTitle: "Nueva portada", contactItems: [{ label: "", value: "" }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(route.writes[0]), ["settings"]);
  assert.equal(route.state.settings.heroTitle, "Nueva portada");
  assert.equal(route.state.content.events[0].name, "");
  assert.equal(route.state.content.novedades[0].published, false);
});

test("incomplete old records do not acquire example content during normalization", () => {
  const content = siteData.normalizeContent({
    navItems: [], quienes: "", fotos: [], events: [{ id: "old", name: "" }],
    novedades: [{ id: "old-news", title: "" }],
  });
  assert.equal(content.events[0].heroDescription, "");
  assert.deepEqual(content.events[0].dayItems, []);
  assert.equal(content.novedades[0].title, "");
  assert.equal(content.novedades[0].tag, "");
});

test("event and news drafts accept one populated field while the rest remain optional", () => {
  const state = initialState();
  const event = siteData.normalizeEvent({ id: "draft-event", name: "", heroDescription: "Información inicial", published: false });
  const events = sectionSave.prepareAdminSectionChanges("events", { events: [oldEvent, event], featuredEventId: "" }, state);
  assert.equal(events.ok, true);
  assert.equal(events.changes.events[1].heroDescription, "Información inicial");

  const news = { ...siteData.createDefaultNewsItem(), id: "draft-news", title: "", description: "Avance", published: false };
  const novedades = sectionSave.prepareAdminSectionChanges("news", [oldNews, news], state);
  assert.equal(novedades.ok, true);
  assert.equal(novedades.changes.novedades[1].description, "Avance");
});

test("publishing news and hiding photos save only their respective collection", async () => {
  const newsRoute = createRoute();
  const news = [{ ...oldNews, published: true }];
  const newsResponse = await newsRoute.PUT(request("news", news));
  assert.equal(newsResponse.status, 200);
  assert.deepEqual(Object.keys(newsRoute.writes[0]), ["novedades"]);
  assert.equal(newsRoute.state.content.novedades[0].published, true);
  assert.equal(publicContent.publishedNews(newsRoute.state.content.novedades).length, 0);

  const photoRoute = createRoute();
  const photoResponse = await photoRoute.PUT(request("photos", [{ ...oldPhoto, published: false }]));
  assert.equal(photoResponse.status, 200);
  assert.deepEqual(Object.keys(photoRoute.writes[0]), ["fotos"]);
  assert.equal(photoRoute.state.content.fotos[0].published, false);
});

test("invalid field, unauthorized request and stale version do not write", async () => {
  const invalid = createRoute();
  const invalidResponse = await invalid.PUT(request("settings", { heroImage: "javascript:alert(1)" }));
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /heroImage/);
  assert.equal(invalid.writes.length, 0);

  const unauthorized = createRoute({ authorized: false });
  assert.equal((await unauthorized.PUT(request("settings", { heroTitle: "X" }))).status, 401);
  assert.equal(unauthorized.writes.length, 0);

  const stale = createRoute();
  assert.equal((await stale.PUT(request("settings", { heroTitle: "X" }, "2026-10-22T12:35:55.715Z"))).status, 409);
  assert.equal(stale.writes.length, 0);
});
