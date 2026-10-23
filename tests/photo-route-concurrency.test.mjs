import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("DELETE con versión antigua no actualiza Supabase ni borra en Cloudinary", async () => {
  const source = readFileSync(resolve("app/api/photos/route.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandboxModule = { exports: {} };
  let databaseCalls = 0;
  let cloudinaryCalls = 0;
  let deletionPlans = 0;
  const oldVersion = "2026-10-22T12:35:55.715Z";
  const currentVersion = "2026-10-22T12:35:55.716Z";

  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/lib/cloudinary": {
      getCloudinaryConfig: () => ({
        cloudName: "club",
        folder: "motoclubjujuy/gallery",
        apiKey: "local-test",
        apiSecret: "local-test",
      }),
    },
    "@/lib/photo-security": {
      parseAdminPhotoAuthorization: () => ({ username: "admin", password: "local-test" }),
      planPhotoDeletion: () => {
        deletionPlans += 1;
        throw new Error("No debe planificar un borrado con versión vieja.");
      },
    },
    "@/lib/supabase-admin": {
      validateAdminCredentials: () => true,
      getSupabaseAdmin: () => {
        databaseCalls += 1;
        throw new Error("No debe abrir una escritura de Supabase con versión vieja.");
      },
    },
    "@/lib/site-content-store": {
      readSiteContentState: async () => ({
        ok: true,
        state: {
          content: { navItems: [], quienes: "", fotos: [], events: [], novedades: [] },
          settings: {},
          updatedAt: currentVersion,
        },
      }),
    },
    "@/lib/site-content-version": {
      isSiteContentVersionCurrent: (expected, current) => expected === current,
    },
  };

  runInNewContext(compiled, {
    module: sandboxModule,
    exports: sandboxModule.exports,
    require: (name) => {
      if (!(name in dependencies)) {
        throw new Error(`Dependencia inesperada: ${name}`);
      }
      return dependencies[name];
    },
    fetch: async () => {
      cloudinaryCalls += 1;
      throw new Error("No debe llamar a Cloudinary con versión vieja.");
    },
  });

  const request = new Request("http://localhost/api/photos", {
    method: "DELETE",
    headers: { Authorization: "Basic local-test", "Content-Type": "application/json" },
    body: JSON.stringify({
      publicId: "motoclubjujuy/gallery/photo",
      expectedUpdatedAt: oldVersion,
    }),
  });
  const response = await sandboxModule.exports.DELETE(request);

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /cambió en otra pestaña/);
  assert.equal(deletionPlans, 0);
  assert.equal(databaseCalls, 0);
  assert.equal(cloudinaryCalls, 0);
});
