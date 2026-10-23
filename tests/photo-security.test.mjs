import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PHOTO_BYTES,
  isCloudinaryImageUrlForPublicId,
  parseAdminPhotoAuthorization,
  planPhotoDeletion,
  validatePhotoFile,
} from "../lib/photo-security.ts";

test("admin photo credentials reject missing or malformed Basic headers", () => {
  assert.equal(parseAdminPhotoAuthorization(null), null);
  assert.equal(parseAdminPhotoAuthorization("Bearer token"), null);
  assert.equal(parseAdminPhotoAuthorization("Basic !!!"), null);

  const encoded = Buffer.from("admin:clave con ñ", "utf8").toString("base64");
  assert.deepEqual(parseAdminPhotoAuthorization(`Basic ${encoded}`), {
    username: "admin",
    password: "clave con ñ",
  });
});

test("photo validation rejects disguised and oversized files", async () => {
  const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validType = new File([pngSignature], "foto.png", { type: "image/png" });
  const disguised = new File(["not an image"], "foto.png", { type: "image/png" });
  const oversized = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "foto.png", {
    type: "image/png",
  });

  assert.equal(await validatePhotoFile(validType), null);
  assert.match(await validatePhotoFile(disguised), /no coincide/);
  assert.match(await validatePhotoFile(oversized), /4 MB/);
});

test("photo deletion refuses a file still used by an event", () => {
  const photo = {
    publicId: "gallery/photo",
    url: "https://res.cloudinary.com/club/image/upload/v123/gallery/photo.jpg",
  };
  const content = {
    fotos: [photo],
    events: [{ posterUrl: photo.url, dayItems: [] }],
    novedades: [],
    quienes: "",
  };

  assert.deepEqual(planPhotoDeletion(content, {}, photo.publicId, "club"), {
    ok: false,
    reason: "in-use",
  });

  content.events = [];
  assert.deepEqual(planPhotoDeletion(content, {}, photo.publicId, "club"), { ok: true, photos: [] });
});

test("Cloudinary identity accepts transformed URLs but not another account, host or public ID", () => {
  const publicId = "gallery/photo.v2";
  const matches = (url) => isCloudinaryImageUrlForPublicId(url, "club", publicId);

  assert.equal(matches("https://res.cloudinary.com/club/image/upload/v123/gallery/photo.v2.jpg"), true);
  assert.equal(matches("https://res.cloudinary.com/club/image/upload/c_fill,w_300/f_auto/v123/gallery/photo.v2.webp"), true);
  assert.equal(matches("https://res.cloudinary.com/club/image/upload/c_fill,w_300/gallery/photo.v2.avif"), true);
  assert.equal(matches("https://res.cloudinary.com/club/image/upload/gallery/photo.v2.jpg"), true);
  assert.equal(matches("https://res.cloudinary.com/other/image/upload/v123/gallery/photo.v2.jpg"), false);
  assert.equal(matches("https://res.cloudinary.com.evil.test/club/image/upload/v123/gallery/photo.v2.jpg"), false);
  assert.equal(matches("https://res.cloudinary.com/club/image/fetch/v123/gallery/photo.v2.jpg"), false);
  assert.equal(matches("https://res.cloudinary.com/club/image/upload/v123/gallery/photo.v2-extra.jpg"), false);
  assert.equal(matches("https://res.cloudinary.com/club/image/upload/other/gallery/photo.v2.jpg"), false);
});

test("photo deletion detects transformed references across public sections", () => {
  const publicId = "gallery/photo";
  const photo = {
    publicId,
    url: "https://res.cloudinary.com/club/image/upload/v123/gallery/photo.jpg",
  };
  const transformed = "https://res.cloudinary.com/club/image/upload/c_fill,w_300/v123/gallery/photo.webp";
  const empty = () => ({ fotos: [photo], events: [], novedades: [], quienes: "" });

  const event = empty();
  event.events = [{ posterUrl: transformed, dayItems: [] }];
  assert.deepEqual(planPhotoDeletion(event, {}, publicId, "club"), { ok: false, reason: "in-use" });

  const news = empty();
  news.novedades = [{ imageUrl: transformed }];
  assert.deepEqual(planPhotoDeletion(news, {}, publicId, "club"), { ok: false, reason: "in-use" });

  assert.deepEqual(planPhotoDeletion(empty(), { heroImage: transformed }, publicId, "club"), {
    ok: false,
    reason: "in-use",
  });

  const about = empty();
  about.quienes = `<p><img src="${transformed}" alt="Moto Club"></p>`;
  assert.deepEqual(planPhotoDeletion(about, {}, publicId, "club"), { ok: false, reason: "in-use" });
});

test("photo deletion refuses a mismatched gallery identity", () => {
  const publicId = "gallery/photo";
  const content = {
    fotos: [{ publicId, url: "https://res.cloudinary.com/other/image/upload/v123/gallery/photo.jpg" }],
    events: [],
    novedades: [],
    quienes: "",
  };

  assert.deepEqual(planPhotoDeletion(content, {}, publicId, "club"), { ok: false, reason: "not-owned" });
  content.fotos[0].url = "https://res.cloudinary.com/club/image/upload/v123/gallery/another.jpg";
  assert.deepEqual(planPhotoDeletion(content, {}, publicId, "club"), { ok: false, reason: "not-owned" });
});
