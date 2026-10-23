import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSiteContentVersionCurrent,
  nextSiteContentUpdatedAt,
} from "../lib/site-content-version.ts";

test("la versión esperada coincide solo con el estado que se leyó", () => {
  const current = "2026-10-22T12:35:55.715Z";

  assert.equal(isSiteContentVersionCurrent(current, current), true);
  assert.equal(isSiteContentVersionCurrent("2026-10-22T12:35:55.714Z", current), false);
  assert.equal(isSiteContentVersionCurrent(null, current), false);
  assert.equal(isSiteContentVersionCurrent(null, undefined), true);
  assert.equal(isSiteContentVersionCurrent(current, undefined), false);
});

test("la próxima versión avanza aunque se escriba en el mismo milisegundo", () => {
  const nowMs = Date.parse("2026-10-22T12:35:55.715Z");
  const previous = new Date(nowMs).toISOString();

  assert.equal(nextSiteContentUpdatedAt(previous, nowMs), "2026-10-22T12:35:55.716Z");
  assert.ok(Date.parse(nextSiteContentUpdatedAt(undefined, nowMs)) > nowMs);
});

test("la próxima versión supera un valor anterior futuro o con microsegundos", () => {
  const nowMs = Date.parse("2026-10-22T12:35:55.715Z");

  assert.equal(
    nextSiteContentUpdatedAt("2026-10-22T12:35:55.999456+00:00", nowMs),
    "2026-10-22T12:35:56.000Z"
  );
});
