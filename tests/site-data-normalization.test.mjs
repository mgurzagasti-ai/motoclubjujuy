import assert from "node:assert/strict";
import test from "node:test";
import { defaultContent, normalizeContent } from "../lib/site-data.ts";

test("an administrator can remove all entries without restoring sample content", () => {
  const normalized = normalizeContent({
    navItems: [],
    quienes: "",
    fotos: [],
    events: [],
    novedades: [],
  });

  assert.deepEqual(normalized.navItems, []);
  assert.equal(normalized.quienes, "");
  assert.deepEqual(normalized.fotos, []);
  assert.deepEqual(normalized.events, []);
  assert.deepEqual(normalized.novedades, []);
});

test("normalization preserves an edited lodging link and hidden menu entries", () => {
  const navItems = [
    { id: "nav-alojamientos", label: "Hospedajes", href: "/hospedajes", visible: false },
    { id: "nav-garage", label: "Garage", href: "/garage", visible: true },
  ];

  assert.deepEqual(normalizeContent({ navItems }).navItems, navItems);
  assert.deepEqual(normalizeContent({ navItems: [navItems[1]] }).navItems, [navItems[1]]);
});

test("default menu still appears when no saved menu is present", () => {
  assert.deepEqual(normalizeContent(null).navItems, defaultContent.navItems);
});

test("legacy saved menus keep Contacto once; a later ADMIN removal stays removed", () => {
  const legacyMenu = [
    { id: "nav-inicio", href: "/#inicio", label: "Inicio" },
    { id: "nav-admin", href: "/admin", label: "Admin" },
  ];
  const upgraded = normalizeContent({ navItems: legacyMenu }).navItems;
  assert.equal(upgraded.at(-1).id, "nav-contacto");

  const adminSavedWithoutContact = legacyMenu.map((item) => ({ ...item, adminManaged: true }));
  assert.deepEqual(normalizeContent({ navItems: adminSavedWithoutContact }).navItems, adminSavedWithoutContact);
});

test("cleared event day fields stay cleared after loading saved content", () => {
  const event = {
    ...defaultContent.events[0],
    dayItems: [{ day: "", detail: "", imageUrl: "", imageAlt: "" }],
  };

  assert.deepEqual(normalizeContent({ events: [event] }).events[0].dayItems, event.dayItems);
});
