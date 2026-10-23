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

const oldVersion = "2026-10-22T12:35:55.715Z";
const currentVersion = "2026-10-22T12:35:55.716Z";
const deletedImageUrl = "https://res.cloudinary.com/example/image/upload/v1/motoclub/deleted.jpg";

function createRoute() {
  let writes = 0;
  let reads = 0;
  const current = {
    content: { navItems: [], quienes: "Actual", fotos: [], events: [], novedades: [] },
    settings: {},
    updatedAt: currentVersion,
  };
  const version = loadTypeScriptModule("lib/site-content-version.ts");
  const route = loadTypeScriptModule("app/api/site-content/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/api-auth": {
      isApiTokenValid: () => ({ ok: true }),
      createApiAuthError: () => Response.json({ error: "No autorizado." }, { status: 401 }),
    },
    "@/lib/motoclub-api": {
      mergeApiSiteContent: () => {
        throw new Error("No debe mezclar contenido obsoleto.");
      },
      toApiSiteContent: () => ({}),
    },
    "@/lib/site-data": { normalizeContent: (content) => content },
    "@/lib/supabase-admin": {
      getSupabaseAdmin: () => ({}),
      validateAdminCredentials: () => true,
    },
    "@/lib/site-content-store": {
      readSiteContentState: async () => {
        reads += 1;
        return { ok: true, state: current };
      },
      writeSiteContentState: async () => {
        writes += 1;
        throw new Error("No debe guardar contenido obsoleto.");
      },
    },
    "@/lib/site-content-version": version,
  });

  return { PUT: route.PUT, get reads() { return reads; }, get writes() { return writes; } };
}

function putBody(payload) {
  return new Request("http://localhost/api/site-content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("ADMIN rechaza el snapshot antiguo que restauraría una imagen borrada", async () => {
  const route = createRoute();
  const response = await route.PUT(putBody({
    username: "admin",
    password: "clave",
    expectedUpdatedAt: oldVersion,
    content: {
      navItems: [],
      quienes: "Edición anterior",
      fotos: [{ url: deletedImageUrl, publicId: "motoclub/deleted", titulo: "Foto", descripcion: "" }],
      events: [],
      novedades: [],
    },
  }));

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /no se guardó/i);
  assert.equal(route.reads, 1);
  assert.equal(route.writes, 0);
});

test("la rama API-token rechaza un heroImage antiguo", async () => {
  const route = createRoute();
  const response = await route.PUT(putBody({
    updatedAt: oldVersion,
    heroImage: deletedImageUrl,
  }));

  assert.equal(response.status, 409);
  assert.equal(route.reads, 1);
  assert.equal(route.writes, 0);
});

test("ambas ramas exigen versión antes de consultar o guardar", async () => {
  const route = createRoute();
  const adminResponse = await route.PUT(putBody({
    username: "admin",
    password: "clave",
    content: { navItems: [], quienes: "Viejo", fotos: [], events: [], novedades: [] },
  }));
  const apiResponse = await route.PUT(putBody({ heroImage: deletedImageUrl }));

  assert.equal(adminResponse.status, 428);
  assert.equal(apiResponse.status, 428);
  assert.equal(route.reads, 0);
  assert.equal(route.writes, 0);
});
