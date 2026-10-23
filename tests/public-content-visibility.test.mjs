import test from "node:test";
import assert from "node:assert/strict";
import { imageUrl, publishedEvents, publishedNews, publishedPhotos } from "../lib/public-content.ts";

test("an empty published event cannot become the featured event", () => {
  const events = [
    { id: "empty", name: " ", published: true },
    { id: "kept", name: "Encuentro vigente", published: true },
    { id: "hidden", name: "Oculto", published: false },
  ];

  assert.deepEqual(publishedEvents(events).map((event) => event.id), ["kept"]);
  assert.deepEqual(publishedEvents([events[0], events[2]]), []);
});

test("unpublished and empty news disappear while a text-only news item remains", () => {
  const news = [
    { id: "text", title: "Comunicado", imageUrl: "", published: true },
    { id: "empty", title: " ", imageUrl: "https://example.com/photo.jpg", published: true },
    { id: "hidden", title: "Reservado", imageUrl: "https://example.com/photo.jpg", published: false },
  ];

  assert.deepEqual(publishedNews(news).map((item) => item.id), ["text"]);
});

test("gallery omits hidden, empty and unsafe image URLs", () => {
  const photos = [
    { id: "visible", url: "https://example.com/photo.jpg", published: true },
    { id: "hidden", url: "https://example.com/hidden.jpg", published: false },
    { id: "missing", url: "   ", published: true },
    { id: "unsafe", url: "javascript:alert(1)", published: true },
  ];

  assert.deepEqual(publishedPhotos(photos).map((photo) => photo.id), ["visible"]);
  assert.equal(imageUrl("/assets/logo.jpeg"), "/assets/logo.jpeg");
  assert.equal(imageUrl("//other.example/photo.jpg"), null);
});
