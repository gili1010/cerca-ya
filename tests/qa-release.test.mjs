import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, { exports, URL, URLSearchParams, require: name => load(name.startsWith("@/")
    ? resolve(root, `${name.slice(2)}.ts`) : resolve(dirname(path), `${name}.ts`)) });
  return exports;
}
const phone = load(resolve(root, "lib/phone.ts"));
const { safeRedirect } = load(resolve(root, "lib/auth/redirect.ts"));
const slug = load(resolve(root, "lib/businesses/slug.ts"));
const checkout = load(resolve(root, "lib/reservation-checkout.ts"));
const { merchantOnboardingSteps } = load(resolve(root, "lib/merchant-onboarding.ts"));
const { isProductAvailable } = load(resolve(root, "lib/product-availability.ts"));
const navigation = load(resolve(root, "lib/search-navigation.ts"));

test("search URL roundtrip preserves term, category, filters, sorting and page without location", () => {
  const state = navigation.readSearchNavigation(new URLSearchParams("view=search&q=caf%C3%A9&category=hogar&filters=delivery,confirmed&sort=price&page=2"));
  const url = navigation.writeSearchNavigation(new URLSearchParams("utm_source=qa"), state);
  assert.equal(url.get("q"), "café");
  assert.equal(url.get("utm_source"), "qa");
  assert.equal(url.has("latitude"), false);
  assert.equal(JSON.stringify(navigation.readSearchNavigation(url)), JSON.stringify(state));
});
test("search URL rejects unknown filters, sorting and invalid pagination; home reset is stable", () => {
  const state = navigation.readSearchNavigation(new URLSearchParams("q=lomito&filters=delivery,evil&sort=evil&page=-2"));
  assert.equal(JSON.stringify(state.filters), '["delivery"]');
  assert.equal(state.sort, "recommended");
  assert.equal(state.page, 0);
  const home = { ...state, query: "", category: "", filters: ["today"], view: "home" };
  assert.equal(navigation.writeSearchNavigation(new URLSearchParams(), home).toString(), "");
  assert.equal(navigation.readSearchNavigation(new URLSearchParams("view=home&q=lomito")).view, "home");
});

test("Argentina phone and WhatsApp preserve prefixes without duplication", () => {
  assert.equal(phone.normalizeArgentinaPhone("351 123 4567"), "543511234567");
  assert.equal(phone.argentinaWhatsAppNumber("+54 9 351 123 4567"), "5493511234567");
  assert.equal(phone.argentinaWhatsAppNumber("351 123 4567"), "5493511234567");
  assert.equal(phone.normalizeArgentinaPhone("+1 202 555 0100"), null);
  assert.equal(phone.normalizeArgentinaPhone("123"), null);
});
test("redirects reject external, encoded protocol-relative and backslash targets", () => {
  for (const target of ["https://example.invalid", "//example.invalid", "/%2fexample.invalid", "/\\example.invalid", "/auth/confirm", "/login"]) {
    assert.equal(safeRedirect(target), "/cuenta");
  }
  assert.equal(safeRedirect("/comercio/productos?q=abc#lista"), "/comercio/productos?q=abc#lista");
});
test("custom slug normalizes accents, spaces and repeated hyphens; validates bounds", () => {
  assert.equal(slug.normalizeStoreSlug("  Todito Indumentaría --  "), "todito-indumentaria");
  for (const value of ["ab", "a".repeat(51), "-tienda", "tienda--otra"]) assert.ok(slug.storeSlugValidation(value));
  assert.equal(slug.storeSlugValidation("tienda-123"), "");
});
test("checkout rejects inherited property names as payment methods", () => {
  const input = { ...checkout.emptyReservationCheckout, customer_name: "Comprador QA", customer_phone: "3511234567" };
  for (const payment_method of ["toString", "__proto__", "constructor"]) {
    assert.ok(checkout.validateReservationCheckout({ ...input, payment_method }, "PICKUP"));
  }
  assert.equal(checkout.validateReservationCheckout(input, "PICKUP"), null);
  assert.ok(checkout.validateReservationCheckout(input, "DELIVERY"));
});
test("pickup discards delivery private fields instead of retaining stale address", () => {
  const result = checkout.normalizeReservationCheckout({ ...checkout.emptyReservationCheckout,
    customer_name: " QA ", customer_phone: "3511234567", delivery_address: "Dirección de prueba", delivery_city: "Localidad de prueba" }, "PICKUP");
  assert.equal(result.delivery_address, null);
  assert.equal(result.delivery_city, null);
  assert.equal(result.customer_name, "QA");
});
test("onboarding covers all seven steps and reflects active product count", () => {
  const business = { latitude: 0, longitude: 0, logo_url: "/logo.png", pickup_enabled: true,
    delivery_enabled: false, accepts_cash: true, accepts_transfer: false, store_shared_at: "2026-10-09T00:00:00Z" };
  assert.equal(merchantOnboardingSteps(business, 5).filter(step => step.complete).length, 7);
  assert.equal(merchantOnboardingSteps(business, 4).filter(step => step.complete).length, 6);
  assert.equal(merchantOnboardingSteps({ ...business, store_shared_at: null }, 5).find(step => step.id === "share").complete, false);
});
test("ON_DEMAND availability depends on available_today, not numeric stock", () => {
  assert.equal(isProductAvailable({ stock: 0, database: { product: { inventory_mode: "ON_DEMAND", available_today: true } } }), true);
  assert.equal(isProductAvailable({ stock: 20, database: { product: { inventory_mode: "ON_DEMAND", available_today: false } } }), false);
  assert.equal(isProductAvailable({ stock: 0, database: { product: { inventory_mode: "STOCKED" } } }), false);
});
