import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as siteData from "../lib/site-data.ts";

function sourceModule(source, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(compiled, {
    module, exports: module.exports, Request, Response, Date, Error,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  });
  return module.exports;
}
const load = (file, dependencies) => sourceModule(readFileSync(resolve(file), "utf8"), dependencies);

test("ADMIN deletes its last event, saves an empty list in Supabase and renders no default event", async () => {
  const publicContent = load("lib/public-content.ts");
  const sectionSave = load("lib/admin-section-save.ts", { "@/lib/public-content": publicContent });
  const versions = load("lib/site-content-version.ts");
  const version = "2026-10-30T12:00:00.000Z";
  const event = {
    ...siteData.createDefaultEvent(), id: "last-event", name: "6TO EVENTO INTERNACIONAL",
    heroHeadlineHighlight: "6TO EVENTO INTERNACIONAL", badgeDate: "1 al 4 de octubre 2026",
    highlightItems: [{ label: "Redes del afiche", value: "Redes anteriores" }], published: true,
  };
  const row = {
    slug: "main", nav_items: [{ id: "nav-about", label: "Club", href: "/#quienes" }],
    quienes: "<p>Historia existente del club</p>",
    fotos: [{ url: "/assets/logo-motoclub.jpeg", titulo: "Logo", descripcion: "Conservar" }],
    events: [event], novedades: [{ ...siteData.createDefaultNewsItem(), id: "keep-news", title: "Conservar novedad" }],
    settings: { featuredEventId: "obsolete-event", clubName: "Moto Club Jujuy", footerLegal: "Conservar" },
    updated_at: version,
  };
  const before = structuredClone(row);
  const updates = [];
  const admin = { from(table) {
    assert.equal(table, "site_content");
    let values;
    const filters = {};
    return {
      update(next) { values = next; updates.push({ values, filters }); return this; },
      select() { return this; },
      eq(key, value) { filters[key] = value; return this; },
      async maybeSingle() {
        if (values) {
          assert.equal(filters.slug, "main");
          assert.equal(filters.updated_at, row.updated_at);
          Object.assign(row, structuredClone(values));
        }
        return { data: structuredClone(row), error: null };
      },
    };
  } };
  const store = load("lib/site-content-store.ts", {
    "@/lib/supabase-admin": { getSupabaseAdmin: () => admin },
    "@/lib/site-data": siteData, "@/lib/site-content-version": versions,
  });
  const route = load("app/api/site-content/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/api-auth": {}, "@/lib/motoclub-api": {}, "@/lib/site-data": siteData,
    "@/lib/admin-section-save": sectionSave, "@/lib/site-content-store": store,
    "@/lib/site-content-version": versions,
    "@/lib/supabase-admin": { getSupabaseAdmin: () => admin, validateAdminCredentials: () => true },
  });
  // Older ADMIN tabs can still submit a stale selection along with an empty list.
  const prepared = sectionSave.prepareAdminSectionChanges("events", {
    events: [], featuredEventId: "obsolete-event",
  }, (await store.readSiteContentState()).state);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.changes.settings.featuredEventId, "");

  const component = ts.createSourceFile("admin-panel.tsx",
    readFileSync(resolve("components/admin-panel.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  const names = ["persistSection", "handleRemoveSelectedEvent", "handleSaveEvents"];
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) {
      declarations.push(`const ${node.getText(component)};`);
    }
    ts.forEachChild(node, collect);
  }
  collect(component);
  assert.equal(declarations.length, names.length);
  const handlers = declarations.join("\n") + "\nmodule.exports = { handleRemoveSelectedEvent, handleSaveEvents };";
  const ui = {
    eventsDraft: [event], selectedEventId: event.id, featuredEventDraftId: "obsolete-event",
    fotoError: "", eventoGuardado: "", saveConflict: "", updatedAt: version,
    user: "admin", pass: "test", window: { confirm: () => true },
    getContentVersion: () => ui.updatedAt,
    async fetch(url, options) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.section, "events");
      assert.deepEqual(payload.sectionData, { events: [], featuredEventId: "" });
      return route.PUT(new Request("https://example.test" + url, options));
    },
    saveContent(content, updatedAt, settings) { ui.content = content; ui.updatedAt = updatedAt; ui.settings = settings; },
    flashMessage(setter, message) { setter(message); }, openSaveModal() {}, setSettingsDraft() {},
  };
  for (const key of ["eventsDraft", "selectedEventId", "featuredEventDraftId", "featuredEventId", "fotoError", "eventoGuardado", "saveConflict"]) {
    ui["set" + key[0].toUpperCase() + key.slice(1)] = (value) => {
      ui[key] = typeof value === "function" ? value(ui[key]) : value;
    };
  }
  const call = (name) => sourceModule(handlers, {}, {
    ...ui, selectedEvent: ui.eventsDraft.find((item) => item.id === ui.selectedEventId),
  })[name]();
  call("handleRemoveSelectedEvent");
  assert.equal(ui.eventsDraft.length, 0);
  assert.equal(ui.featuredEventDraftId, "");
  assert.equal(ui.selectedEventId, "");
  ui.featuredEventDraftId = "stale-before-save";
  await call("handleSaveEvents");
  assert.equal(ui.fotoError, "");
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0].values).sort(), ["events", "settings", "updated_at"]);
  assert.deepEqual(row.events, []);
  assert.equal(row.settings.featuredEventId, "");
  assert.equal(ui.featuredEventDraftId, "");
  assert.equal(ui.featuredEventId, "");
  for (const key of ["nav_items", "quienes", "fotos", "novedades"]) assert.deepEqual(row[key], before[key]);
  assert.deepEqual(row.settings, { ...before.settings, featuredEventId: "" });

  const reloaded = (await store.readSiteContentState()).state;
  assert.deepEqual(reloaded.content.events, []);
  assert.deepEqual(siteData.normalizeContent(null).events, []);
  const { PublicSections } = load("components/public-sections.tsx", {
    react: React, "react/jsx-runtime": jsxRuntime,
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "@/components/photo-carousel": { PhotoCarousel: () => null },
    "@/lib/site-data": siteData, "@/lib/public-content": publicContent,
    "@/lib/supabase": { hasSupabaseConfig: () => true, supabase: {} },
    "@/lib/use-motoclub-content": { useMotoclubContent: () => ({
      content: reloaded.content, siteSettings: reloaded.settings,
      featuredEventId: reloaded.settings.featuredEventId, contentReady: true,
    }) },
  });
  const html = renderToStaticMarkup(React.createElement(PublicSections));
  assert.doesNotMatch(html, /id="evento"|6TO EVENTO INTERNACIONAL|6 Motoencuentro|Redes del afiche|1 al 4 de octubre 2026/);
  assert.match(html, /Historia existente del club/);
});
