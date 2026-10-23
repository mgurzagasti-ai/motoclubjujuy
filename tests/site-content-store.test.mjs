import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadTypeScriptModule(path, dependencies = {}) {
  const source = readFileSync(resolve(path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandboxModule = { exports: {} };

  runInNewContext(compiled, {
    module: sandboxModule,
    exports: sandboxModule.exports,
    require: (name) => {
      if (!(name in dependencies)) {
        throw new Error(`Dependencia inesperada: ${name}`);
      }
      return dependencies[name];
    },
  });

  return sandboxModule.exports;
}

function memorySiteContent(initialRow) {
  let row = structuredClone(initialRow);
  let writes = 0;

  return {
    get row() {
      return structuredClone(row);
    },
    get writes() {
      return writes;
    },
    deletePhoto(nextVersion) {
      row = { ...row, fotos: [], updated_at: nextVersion };
    },
    from(table) {
      assert.equal(table, "site_content");
      let values;
      const filters = new Map();

      const query = {
        update(nextValues) {
          values = nextValues;
          return query;
        },
        eq(column, value) {
          filters.set(column, value);
          return query;
        },
        select() {
          return query;
        },
        maybeSingle() {
          if (filters.get("slug") !== row.slug || filters.get("updated_at") !== row.updated_at) {
            return Promise.resolve({ data: null, error: null });
          }

          row = { ...row, ...structuredClone(values) };
          writes += 1;
          return Promise.resolve({ data: structuredClone(row), error: null });
        },
      };

      return query;
    },
  };
}

function createWriter(database) {
  return createStore(database).writeSiteContentState;
}

function createStore(database) {
  const version = loadTypeScriptModule("lib/site-content-version.ts");
  const store = loadTypeScriptModule("lib/site-content-store.ts", {
    "@/lib/supabase-admin": { getSupabaseAdmin: () => database },
    "@/lib/site-data": { normalizeContent: (content) => content },
    "@/lib/site-content-version": version,
  });
  return store;
}

const initialVersion = "2026-10-22T12:35:55.715Z";
const deletedPhoto = {
  url: "https://res.cloudinary.com/example/image/upload/v1/motoclub/photo.jpg",
  publicId: "motoclub/photo",
  titulo: "Foto",
  descripcion: "",
};

function initialRow() {
  return {
    slug: "main",
    nav_items: [],
    quienes: "Contenido inicial",
    fotos: [deletedPhoto],
    events: [],
    novedades: [],
    settings: {},
    updated_at: initialVersion,
  };
}

function snapshot(quienes = "Contenido inicial") {
  return {
    content: {
      navItems: [],
      quienes,
      fotos: [deletedPhoto],
      events: [],
      novedades: [],
    },
    settings: {},
    updatedAt: initialVersion,
  };
}

test("dos guardados con la misma versión permiten una sola escritura", async () => {
  const database = memorySiteContent(initialRow());
  const writeSiteContentState = createWriter(database);

  const results = await Promise.all([
    writeSiteContentState(snapshot("Edición A")),
    writeSiteContentState(snapshot("Edición B")),
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.status === 409).length, 1);
  assert.equal(database.writes, 1);
  assert.equal(database.row.quienes, "Edición A");
  assert.notEqual(database.row.updated_at, initialVersion);
});

test("un guardado anterior al borrado no restaura la referencia de la foto", async () => {
  const database = memorySiteContent(initialRow());
  const writeSiteContentState = createWriter(database);
  database.deletePhoto("2026-10-22T12:35:55.716Z");

  const result = await writeSiteContentState(snapshot("Edición en pestaña antigua"));

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(database.writes, 0);
  assert.deepEqual(database.row.fotos, []);
  assert.equal(database.row.quienes, "Contenido inicial");
});

test("un guardado parcial solo escribe su columna y exige updated_at vigente", async () => {
  const database = memorySiteContent({ ...initialRow(), events: [{ id: "old", name: "" }] });
  const { writeSiteContentChanges } = createStore(database);
  const saved = await writeSiteContentChanges({ settings: { heroTitle: "Portada" } }, initialVersion);

  assert.equal(saved.ok, true);
  assert.equal(database.row.settings.heroTitle, "Portada");
  assert.equal(database.row.quienes, "Contenido inicial");
  assert.deepEqual(database.row.events, [{ id: "old", name: "" }]);
  assert.deepEqual(database.row.fotos, [deletedPhoto]);

  const stale = await writeSiteContentChanges({ novedades: [] }, initialVersion);
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 409);
  assert.equal(database.writes, 1);
});
