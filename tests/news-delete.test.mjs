import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as siteData from "../lib/site-data.ts";

function loadSource(source, dependencies = {}, globals = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
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

const load = (file, dependencies) => loadSource(readFileSync(resolve(file), "utf8"), dependencies);
const publicContent = load("lib/public-content.ts");
const sectionSave = load("lib/admin-section-save.ts", { "@/lib/public-content": publicContent });
const versions = load("lib/site-content-version.ts");
const version = "2026-10-25T12:00:00.000Z";
const target = { ...siteData.createDefaultNewsItem(), id: "delete-me", title: "Nueva novedad", createdAt: version };
const survivor = { ...target, id: "keep-me", title: "  Otra novedad  ", description: "Texto guardado" };

// Execute the actual ADMIN handlers rather than a replacement implementation.
const component = ts.createSourceFile("admin-panel.tsx",
  readFileSync(resolve("components/admin-panel.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function collect(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
      ["persistSection", "handleRemoveSelectedNews"].includes(node.name.text)) {
    declarations.set(node.name.text, `const ${node.getText(component)};`);
  }
  ts.forEachChild(node, collect);
}
collect(component);
const handlers = [...declarations.values()].join("\n") + "\nmodule.exports = { handleRemoveSelectedNews };";

function scenario({ failure = false, stale = false, race = false } = {}) {
  const row = {
    slug: "main", nav_items: [], quienes: "Conservar", fotos: [], events: [],
    novedades: structuredClone([target, survivor]), settings: { clubName: "Conservar" }, updated_at: version,
  };
  const updates = [];
  const admin = { from(table) {
    assert.equal(table, "site_content");
    let update;
    const filters = {};
    return {
      update(values) { update = values; updates.push({ values, filters }); return this; },
      select() { return this; },
      eq(key, value) { filters[key] = value; return this; },
      async maybeSingle() {
        if (update) {
          if (failure) return { data: null, error: { message: "Guardado no disponible" } };
          if (race) row.updated_at = "2026-10-25T12:01:00.000Z";
          if (filters.updated_at !== row.updated_at) return { data: null, error: null };
          Object.assign(row, structuredClone(update));
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
  const ui = {
    content: siteData.normalizeContent({ navItems: [], quienes: row.quienes, fotos: [], events: [], novedades: row.novedades }),
    newsDraft: structuredClone([target, { ...survivor, description: "Borrador sin guardar" }]),
    selectedNewsId: target.id, newsError: "", novedadGuardada: "", isSavingNews: false,
    user: "admin", pass: "test", updatedAt: stale ? "2026-10-25T11:59:00.000Z" : version,
    window: { confirm: () => true },
    getContentVersion: () => ui.updatedAt,
    async fetch(url, options) {
      assert.equal(url, "/api/site-content");
      assert.equal(options.method, "PUT");
      return route.PUT(new Request("https://example.test" + url, options));
    },
    saveContent(content, updatedAt) { ui.content = content; ui.updatedAt = updatedAt; },
    setFeaturedEventId() {}, setSettingsDraft() {}, setFeaturedEventDraftId() {},
    flashMessage(setter, message) { setter(message); }, openSaveModal() {},
  };
  for (const key of ["newsDraft", "selectedNewsId", "newsError", "novedadGuardada", "isSavingNews", "saveConflict"]) {
    ui["set" + key[0].toUpperCase() + key.slice(1)] = (value) => {
      ui[key] = typeof value === "function" ? value(ui[key]) : value;
    };
  }
  const remove = async () => loadSource(handlers, {}, {
    ...ui, selectedNews: ui.newsDraft.find((item) => item.id === ui.selectedNewsId),
  }).handleRemoveSelectedNews();
  return { row, ui, updates, remove };
}

test("deleting news persists only its ID, preserves updated_at protection and reports failed saves", async () => {
  assert.equal(component.parseDiagnostics.length, 0);
  assert.equal(declarations.size, 2);
  const saved = scenario();
  const otherColumns = ({ novedades, updated_at, ...rest }) => rest;
  const originalOtherColumns = structuredClone(otherColumns(saved.row));
  await saved.remove();
  assert.deepEqual(saved.row.novedades, [survivor]);
  assert.deepEqual(otherColumns(saved.row), originalOtherColumns);
  assert.deepEqual(Object.keys(saved.updates[0].values).sort(), ["novedades", "updated_at"]);
  assert.equal(saved.updates[0].filters.updated_at, version);
  assert.equal(saved.ui.newsDraft[0].description, "Borrador sin guardar");
  assert.equal(publicContent.publishedNews(saved.ui.content.novedades).length, 1);
  assert.match(saved.ui.novedadGuardada, /eliminada correctamente/);
  assert.notEqual(saved.ui.updatedAt, version);
  assert.equal(saved.ui.isSavingNews, false);

  await saved.remove(); // Delete the remaining item, including the empty-list normalization path.
  assert.deepEqual(saved.row.novedades, []);
  assert.deepEqual(siteData.normalizeContent(saved.ui.content).novedades, []);
  assert.equal(publicContent.publishedNews(saved.ui.content.novedades).length, 0);
  assert.deepEqual(saved.ui.newsDraft, []);

  for (const options of [{ failure: true }, { stale: true }, { race: true }]) {
    const rejected = scenario(options);
    await rejected.remove();
    assert.deepEqual(rejected.row.novedades, [target, survivor]);
    assert.equal(rejected.ui.newsDraft[0].id, target.id);
    assert.equal(rejected.ui.selectedNewsId, target.id);
    assert.match(rejected.ui.newsError, /No se pudo eliminar la novedad/);
    assert.equal(rejected.ui.novedadGuardada, "");
    assert.equal(rejected.ui.isSavingNews, false);
    if (options.stale) assert.equal(rejected.updates.length, 0);
    if (options.race || options.stale) assert.match(rejected.ui.saveConflict, /cambió/);
  }
});
