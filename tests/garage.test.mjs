import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { validateGarageDraft } from "../lib/garage.ts";

const draft = {
  title: "Honda Tornado", description: "Moto en buen estado y con papeles.",
  category_slug: "motos", price: null, whatsapp: "+54 9 388 1234567",
  images: ["https://example.test/photo.jpg"],
};
const owner = "11111111-1111-4111-8111-111111111111";
const listingId = "22222222-2222-4222-8222-222222222222";
const version = "2026-10-23T12:00:00.000Z";

function route(path, dependencies) {
  const source = readFileSync(resolve(path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandboxModule = { exports: {} };
  runInNewContext(compiled, {
    module: sandboxModule, exports: sandboxModule.exports, Request, Response, URL, Date, File, FormData,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return sandboxModule.exports;
}

const next = { "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } } };
const garage = { "@/lib/garage": { validateGarageDraft } };

test("Garage rejects missing or excess photos and malformed WhatsApp", () => {
  assert.equal(validateGarageDraft(draft).ok, true);
  assert.match(validateGarageDraft({ ...draft, images: [] }).error, /fotos/);
  assert.match(validateGarageDraft({ ...draft, images: Array(6).fill("https://example.test/photo.jpg") }).error, /fotos/);
  assert.match(validateGarageDraft({ ...draft, whatsapp: "123" }).error, /WhatsApp/);
});

test("public Garage applies approved filter and exposes only public columns", async () => {
  const filters = [];
  let columns = "";
  const chain = {
    select(value) { columns = value; return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    order() { return this; }, limit() { return this; },
    then(resolve) { resolve({ data: [], error: null }); },
  };
  const { GET } = route("app/api/garage/route.ts", {
    ...next, "@/lib/supabase": { supabase: { from: () => chain } },
  });
  const response = await GET(new Request("http://localhost/api/garage"));
  assert.equal(response.status, 200);
  assert.deepEqual(filters, [["status", "approved"]]);
  assert.doesNotMatch(columns, /owner_id|status|submitted_at/);
});

test("member submission derives owner and pending status from verified session", async () => {
  let inserted;
  const client = { from: () => ({
    insert(value) { inserted = value; return this; },
    select() { return this; },
    single: async () => ({ data: { id: listingId, status: "pending" }, error: null }),
  }) };
  const { POST } = route("app/api/garage/mine/route.ts", {
    ...next, ...garage,
    "@/lib/garage-auth": { memberContext: async () => ({ user: { id: owner }, client }), garageMemberApproved: async () => true },
    "@/lib/garage-references": { validateGarageReferences: async () => null },
  });
  const response = await POST(new Request("http://localhost/api/garage/mine", {
    method: "POST", body: JSON.stringify({ ...draft, owner_id: "foreign", status: "approved" }),
  }));
  assert.equal(response.status, 201);
  assert.equal(inserted.owner_id, owner);
  assert.equal(inserted.status, "pending");
  assert.equal(inserted.price, null);
});

test("member edit filters by owner and version; stale update returns conflict", async () => {
  const filters = [];
  let changes;
  const client = { from: () => ({
    update(value) { changes = value; return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    select() { return this; },
    maybeSingle: async () => ({ data: null, error: null }),
  }) };
  const { PUT } = route("app/api/garage/mine/[id]/route.ts", {
    ...next, ...garage,
    "@/lib/garage-auth": { memberContext: async () => ({ user: { id: owner }, client }), garageMemberApproved: async () => true },
    "@/lib/garage-references": { validateGarageReferences: async () => null },
  });
  const response = await PUT(new Request(`http://localhost/api/garage/mine/${listingId}`, {
    method: "PUT", body: JSON.stringify({ ...draft, expectedUpdatedAt: version }),
  }), { params: Promise.resolve({ id: listingId }) });
  assert.equal(response.status, 409);
  assert.equal(changes.status, "pending");
  assert.deepEqual(filters, [["id", listingId], ["owner_id", owner], ["updated_at", version]]);
});

test("member route rejects unauthenticated writes before reading the body", async () => {
  const { POST } = route("app/api/garage/mine/route.ts", {
    ...next, ...garage,
    "@/lib/garage-auth": { memberContext: async () => null, garageMemberApproved: async () => { throw new Error("must not run"); } },
    "@/lib/garage-references": { validateGarageReferences: async () => { throw new Error("must not run"); } },
  });
  const response = await POST(new Request("http://localhost/api/garage/mine", { method: "POST", body: "invalid" }));
  assert.equal(response.status, 401);
});

test("ADMIN edit returns listing to pending and checks current version", async () => {
  let updated;
  const filters = [];
  const admin = { from: () => ({
    update(value) { updated = value; return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    select() { return this; },
    maybeSingle: async () => ({ data: { id: listingId, status: "pending" }, error: null }),
  }) };
  const { PATCH } = route("app/api/admin/garage/route.ts", {
    ...next, ...garage,
    "@/lib/garage-auth": { garageAdminContext: () => admin },
    "@/lib/photo-security": { MAX_PHOTO_BYTES: 4 * 1024 * 1024 },
    "@/lib/garage-storage": {},
  });
  const response = await PATCH(new Request("http://localhost/api/admin/garage", {
    method: "PATCH", body: JSON.stringify({ id: listingId, draft, status: "approved", expectedUpdatedAt: version }),
  }));
  assert.equal(response.status, 200);
  assert.equal(updated.status, "pending");
  assert.equal(updated.title, draft.title);
  assert.deepEqual(filters, [["id", listingId], ["updated_at", version]]);
});

test("upload limit blocks Cloudinary before any external upload", async () => {
  let externalUploads = 0;
  const query = {
    select() { return this; }, eq() { return this; }, gte() { return this; },
    then(resolve) { resolve({ count: 20, error: null }); },
  };
  const { POST } = route("app/api/garage/upload/route.ts", {
    ...next,
    "node:crypto": { randomUUID: () => "test-reservation" },
    "@/lib/garage-auth": { memberContext: async () => ({ user: { id: owner } }), garageMemberApproved: async () => true },
    "@/lib/supabase-admin": { getSupabaseAdmin: () => ({ from: () => query }) },
    "@/lib/photo-security": { MAX_PHOTO_BYTES: 4 * 1024 * 1024, validatePhotoFile: async () => null },
    "@/lib/garage": { GARAGE_MAX_UPLOADS_PER_HOUR: 20 },
    "@/lib/garage-storage": { storeGaragePhoto: async () => { externalUploads += 1; } },
  });
  const form = new FormData();
  form.set("file", new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
  const response = await POST(new Request("http://localhost/api/garage/upload", { method: "POST", body: form }));
  assert.equal(response.status, 429);
  assert.equal(externalUploads, 0);
});

test("registered but unapproved member cannot submit an advert", async () => {
  let writes = 0;
  const { POST } = route("app/api/garage/mine/route.ts", {
    ...next, ...garage,
    "@/lib/garage-auth": {
      memberContext: async () => ({ user: { id: owner }, client: { from: () => { writes += 1; } } }),
      garageMemberApproved: async () => false,
    },
    "@/lib/garage-references": { validateGarageReferences: async () => { throw new Error("must not run"); } },
  });
  const response = await POST(new Request("http://localhost/api/garage/mine", {
    method: "POST", body: JSON.stringify(draft),
  }));
  assert.equal(response.status, 403);
  assert.equal(writes, 0);
});

test("membership request binds user ID and cannot self-approve", async () => {
  let inserted;
  const client = { from: () => ({
    insert(value) { inserted = value; return this; }, select() { return this; },
    single: async () => ({ data: { status: "pending" }, error: null }),
  }) };
  const { POST } = route("app/api/garage/membership/route.ts", {
    ...next, "@/lib/garage-auth": { memberContext: async () => ({ user: { id: owner }, client }) },
  });
  const response = await POST(new Request("http://localhost/api/garage/membership", {
    method: "POST", body: JSON.stringify({ user_id: "foreign", status: "approved" }),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(inserted), ["user_id"]);
  assert.equal(inserted.user_id, owner);
});

test("unapproved member cannot upload a photo", async () => {
  let externalUploads = 0;
  const { POST } = route("app/api/garage/upload/route.ts", {
    ...next,
    "node:crypto": { randomUUID: () => "test-reservation" },
    "@/lib/garage-auth": { memberContext: async () => ({ user: { id: owner } }), garageMemberApproved: async () => false },
    "@/lib/supabase-admin": { getSupabaseAdmin: () => { throw new Error("must not run"); } },
    "@/lib/photo-security": { MAX_PHOTO_BYTES: 4 * 1024 * 1024 },
    "@/lib/garage": { GARAGE_MAX_UPLOADS_PER_HOUR: 20 },
    "@/lib/garage-storage": { storeGaragePhoto: async () => { externalUploads += 1; } },
  });
  const response = await POST(new Request("http://localhost/api/garage/upload", { method: "POST" }));
  assert.equal(response.status, 403);
  assert.equal(externalUploads, 0);
});

test("ADMIN alone can approve a member with confirmed email", async () => {
  let updated;
  const admin = {
    auth: { admin: { getUserById: async () => ({
      data: { user: { email: "miembro@example.test", email_confirmed_at: version, is_anonymous: false } }, error: null,
    }) } },
    from: () => ({
      update(value) { updated = value; return this; }, eq() { return this; }, is() { return this; }, select() { return this; },
      maybeSingle: async () => ({ data: { user_id: owner, status: "approved" }, error: null }),
    }),
  };
  const { PATCH } = route("app/api/admin/garage/members/route.ts", {
    ...next, "@/lib/garage-auth": { garageAdminContext: () => admin },
  });
  const response = await PATCH(new Request("http://localhost/api/admin/garage/members", {
    method: "PATCH", body: JSON.stringify({ userId: owner, status: "approved", expectedStatus: "pending", expectedReviewedAt: null }),
  }));
  assert.equal(response.status, 200);
  assert.equal(updated.status, "approved");
});

test("Garage SQL is additive and guards ownership, membership and public visibility", () => {
  const sql = readFileSync(resolve("scripts/supabase-garage.sql"), "utf8");
  assert.doesNotMatch(sql, /^\s*(?:drop|truncate|delete|update)\b/im);
  assert.doesNotMatch(sql, /^\s*alter table public\.(?!garage_)\w+/im);
  assert.match(sql, /create policy garage_members_request_own[\s\S]*?status = 'pending'/i);
  assert.match(sql, /create policy garage_listings_read[\s\S]*?status = 'approved'/i);
  assert.match(sql, /create policy garage_listings_read[\s\S]*?garage_member_is_approved\(owner_id\)/i);
  assert.match(sql, /create policy garage_listings_insert_own[\s\S]*?garage_members[\s\S]*?status = 'approved'/i);
  assert.match(sql, /garage_photo_not_owned/);
});
