import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as siteData from "../lib/site-data.ts";

function sourceModule(source, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    module, exports: module.exports, Date, Error, Event, Request, Response,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  });
  return module.exports;
}
const load = (file, dependencies, globals) => sourceModule(readFileSync(resolve(file), "utf8"), dependencies, globals);
const publicContent = load("lib/public-content.ts");
const sectionSave = load("lib/admin-section-save.ts", { "@/lib/public-content": publicContent });
const versions = load("lib/site-content-version.ts");
const initialVersion = "2026-10-25T12:00:00.000Z";
const initialMenu = [
  { id: "nav-inicio", href: "/#inicio", label: "Inicio", adminManaged: true },
  { id: "nav-admin", href: "/admin", label: "ADMIN", adminManaged: true },
];
const component = ts.createSourceFile("admin-panel.tsx",
  readFileSync(resolve("components/admin-panel.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function collect(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
      ["persistSection", "moveNavItem", "updateNavItem", "handleRemoveNavItem", "handleSaveNavItems"].includes(node.name.text)) {
    declarations.set(node.name.text, `const ${node.getText(component)};`);
  }
  ts.forEachChild(node, collect);
}
collect(component);
const handlers = [...declarations.values()].join("\n") +
  "\nmodule.exports = { moveNavItem, updateNavItem, handleRemoveNavItem, handleSaveNavItems };";

function scenario({ failure = false, stale = false, race = false } = {}) {
  const row = {
    slug: "main", nav_items: structuredClone(initialMenu), quienes: "Conservar", fotos: [], events: [],
    novedades: [{ id: "news-keep", title: "Conservar" }], settings: { clubName: "Conservar" }, updated_at: initialVersion,
  };
  const updates = [];
  const admin = { from(table) {
    assert.equal(table, "site_content");
    let update;
    const filters = {};
    return {
      update(values) { update = values; updates.push({ values, filters }); return this; },
      select() { return this; }, eq(key, value) { filters[key] = value; return this; },
      async maybeSingle() {
        if (update) {
          if (failure) return { data: null, error: { message: "Guardado no disponible" } };
          if (race) row.updated_at = "2099-01-01T00:00:00.000Z";
          if (row.updated_at !== filters.updated_at) return { data: null, error: null };
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
  const readContent = () => siteData.normalizeContent({
    navItems: row.nav_items, quienes: row.quienes, fotos: row.fotos, events: row.events, novedades: row.novedades,
  });
  const listeners = new Map();
  const notifications = [];
  const pending = [];
  const window = {
    location: { hash: "" },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(event) { notifications.push(event.type); listeners.get(event.type)?.(event); return true; },
  };
  let publicState = { content: readContent(), siteSettings: row.settings, contentReady: true };
  const refreshSupabaseContent = () => {
    const request = store.readSiteContentState().then(({ state }) => {
      publicState = { content: state.content, siteSettings: state.settings, contentReady: true };
    });
    pending.push(request);
    return request;
  };
  let mounted = false;
  const navbar = load("components/navbar.tsx", {
    react: {
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
      useMemo: (calculate) => calculate(), useEffect: (effect) => { if (!mounted) effect(); },
    },
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
    "next/image": { default: ({ priority, unoptimized, ...props }) => createElement("img", props) },
    "@/lib/site-data": siteData, "@/lib/public-content": publicContent,
    "@/lib/use-motoclub-content": { useMotoclubContent: () => ({ ...publicState, refreshSupabaseContent }) },
  }, { window, document: { getElementById: () => null } });
  const renderMenu = () => {
    const markup = renderToStaticMarkup(navbar.Navbar());
    mounted = true;
    const links = markup.split('class="nav-links">')[1].split("</div>")[0];
    return Array.from(links.matchAll(/href="([^"]+)"/g), ([, href]) => href);
  };
  const ui = {
    content: readContent(), navDraft: siteData.getEditableNavItems(readContent().navItems),
    updatedAt: stale ? "2026-10-25T11:59:00.000Z" : initialVersion,
    isSavingNav: false, navError: "", navSaved: "", user: "admin", pass: "test", window,
    ...siteData,
    getContentVersion: () => ui.updatedAt,
    async fetch(url, options) { return route.PUT(new Request("https://example.test" + url, options)); },
    saveContent(content, updatedAt) { ui.content = content; ui.updatedAt = updatedAt; },
    setFeaturedEventId() {}, setSettingsDraft() {}, setFeaturedEventDraftId() {},
    flashMessage(setter, message) { setter(message); },
  };
  for (const key of ["navDraft", "navError", "navSaved", "isSavingNav", "saveConflict"]) {
    ui["set" + key[0].toUpperCase() + key.slice(1)] = (value) => {
      ui[key] = typeof value === "function" ? value(ui[key]) : value;
    };
  }
  const call = (name, ...args) => sourceModule(handlers, {}, ui)[name](...args);
  const reload = () => {
    publicState = { content: readContent(), siteSettings: row.settings, contentReady: true };
    ui.navDraft = siteData.getEditableNavItems(readContent().navItems, row.settings.garageNavVisible);
    return renderMenu();
  };
  renderMenu(); // Mount the actual navbar's save listener.
  return { row, ui, updates, notifications, renderMenu, reload, call,
    async save() { await call("handleSaveNavItems"); await Promise.all(pending); } };
}

test("navbar ADMIN persists movement and Garage visibility/removal, refreshes public order and rejects stale saves", async () => {
  assert.equal(component.parseDiagnostics.length, 0);
  assert.equal(declarations.size, 5);
  const saved = scenario();
  assert.deepEqual(saved.renderMenu(), ["/#inicio", "/admin", "/garage"]);
  assert.equal(saved.ui.navDraft.at(-1).href, "/garage");
  const { nav_items, updated_at, ...otherContent } = structuredClone(saved.row);
  saved.call("moveNavItem", 2, -1);
  saved.call("moveNavItem", 1, -1);
  saved.call("moveNavItem", 0, 1);
  await saved.save();
  assert.deepEqual(saved.renderMenu(), ["/#inicio", "/garage", "/admin"]);
  assert.deepEqual(saved.reload(), saved.renderMenu());
  assert.deepEqual(saved.row.nav_items.map((item) => item.href), saved.renderMenu());
  assert.deepEqual(Object.keys(saved.updates[0].values).sort(), ["nav_items", "updated_at"]);
  assert.equal(saved.updates[0].filters.updated_at, initialVersion);
  const { nav_items: reordered, updated_at: changedVersion, ...unchanged } = saved.row;
  assert.deepEqual(unchanged, otherContent);
  assert.notEqual(changedVersion, updated_at);
  assert.equal(saved.notifications[0], siteData.navbarSavedEvent);

  saved.call("updateNavItem", 1, "visible", false);
  await saved.save();
  assert.deepEqual(saved.renderMenu(), ["/#inicio", "/admin"]);
  assert.deepEqual(saved.reload(), ["/#inicio", "/admin"]);
  saved.call("updateNavItem", 1, "visible", true);
  await saved.save();
  assert.deepEqual(saved.renderMenu(), ["/#inicio", "/garage", "/admin"]);
  const duplicate = [...saved.row.nav_items, { id: "duplicate", label: "GARAGE", href: "/garage/" }];
  assert.equal(siteData.getEditableNavItems(duplicate).length, 3);
  assert.equal(siteData.getEditableNavItems(initialMenu, false).at(-1).visible, false);

  saved.call("handleRemoveNavItem", 1);
  await saved.save();
  assert.deepEqual(saved.renderMenu(), ["/#inicio", "/admin"]);
  assert.deepEqual(saved.reload(), ["/#inicio", "/admin"]);
  saved.ui.navDraft = [];
  await saved.save();
  assert.deepEqual(saved.row.nav_items, []);
  assert.deepEqual(saved.reload(), []);

  for (const options of [{ failure: true }, { stale: true }, { race: true }]) {
    const rejected = scenario(options);
    rejected.call("moveNavItem", 2, -1);
    await rejected.save();
    assert.deepEqual(rejected.row.nav_items, nav_items);
    assert.deepEqual(rejected.renderMenu(), ["/#inicio", "/admin", "/garage"]);
    assert.match(rejected.ui.navError, /No se pudo guardar el menú/);
    assert.equal(rejected.ui.isSavingNav, false);
    assert.equal(rejected.ui.navSaved, "");
    assert.equal(rejected.notifications.length, 0);
    assert.equal(rejected.ui.navDraft[1].href, "/garage");
    if (options.stale) assert.equal(rejected.updates.length, 0);
  }
});
