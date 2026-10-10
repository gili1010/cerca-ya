import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the actual pure TypeScript modules without adding a test framework.
function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  runInNewContext(outputText, { exports });
  return exports;
}
const { products: demoProducts, confirmationTime } = loadModule("../src/lib/products.ts");
// Keep these regression cases independent of additional demo inventory.
const fixtureIds = ["taladro", "auriculares", "lampara", "tazas", "herramientas", "mochila", "mascotas", "planta", "parlante", "silla"];
const products = fixtureIds.map(id => {
  const product = demoProducts.find(product => product.id === id);
  assert.ok(product, `Missing catalog fixture: ${id}`);
  return product;
});
const { filterProducts } = loadModule("../src/lib/catalog.ts");
const base = { query: "", category: "Todas", filters: [], favorites: [], favoritesOnly: false, sort: "recommended" };
const find = (options) => filterProducts(products, { ...base, ...options });

test("default catalog excludes tomorrow and distances of 5 km or more", () => {
  const result = find({ filters: ["today", "nearby"] });
  assert.equal(result.length, 8);
  assert.ok(!result.some(p => ["silla", "parlante"].includes(p.id)));
});
test("urgent mode excludes unconfirmed stock and sorts by proximity", () => {
  const result = find({ filters: ["today", "nearby", "confirmed"], sort: "distance" });
  assert.equal(result.length, 7);
  assert.equal(result[0].id, "mascotas");
  assert.ok(result.every(p => p.confirmedMinutesAgo !== null));
  assert.ok(result.every((p, i) => i === 0 || p.distanceKm >= result[i - 1].distanceKm));
});
test("delivery and immediate pickup combine, pickup allows at most 15 minutes", () => {
  const result = find({ filters: ["delivery", "pickup"] });
  assert.equal(result.length, 4);
  assert.ok(result.every(p => p.deliveryToday && p.pickupMinutes <= 15));
});
test("search ignores accents, case and surrounding whitespace", () => {
  assert.equal(find({ query: "  LAMPARA  " })[0].id, "lampara");
  assert.equal(find({ query: "ferreteria norte" })[0].id, "taladro");
  assert.equal(find({ query: "xyz-inexistente" }).length, 0);
});
test("category and favorites can be combined", () => {
  const result = find({ category: "Tecnología", favorites: ["taladro", "auriculares"], favoritesOnly: true });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "auriculares");
});
test("price sorting does not mutate the source catalog", () => {
  const first = products[0].id;
  const result = find({ sort: "price" });
  assert.equal(result[0].id, "mascotas");
  assert.ok(result.every((p, i) => i === 0 || p.price >= result[i - 1].price));
  assert.equal(products[0].id, first);
});
test("demo stock times match the disclosed 15:00 reference", () => {
  assert.equal(confirmationTime(40), "14:20");
  assert.equal(confirmationTime(8), "14:52");
});
