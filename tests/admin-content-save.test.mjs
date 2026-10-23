import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as siteData from "../lib/site-data.ts";

function loadModule(path, dependencies = {}) {
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

const version = "2026-10-22T12:35:55.716Z";
const firstEvent = { ...siteData.defaultContent.events[0], id: "event-first" };
const secondEvent = { ...siteData.defaultContent.events[0], id: "event-second", name: "Segundo" };

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
