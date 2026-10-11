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
  const exports = {}; cache.set(path, exports);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, { exports, URL, URLSearchParams, require: name => load(name.startsWith("@/")
    ? resolve(root, `${name.slice(2)}.ts`) : resolve(dirname(path), `${name}.ts`)) });
  return exports;
}
const navigation = load(resolve(root, "lib/search-navigation.ts"));
const { getPublicCatalog } = load(resolve(root, "lib/public-catalog.ts"));
const { searchPublicStores } = load(resolve(root, "lib/public-store-search.ts"));
const { requestRadii } = load(resolve(root, "lib/buyer-requests.ts"));
const coordinates = { latitude: -31.65, longitude: -64.43 };
const options = { query: "café", category: "", filters: [], sort: "recommended", page: 0 };

test("radio local por defecto, límites y URL sin coordenadas", () => {
  assert.equal(navigation.readSearchNavigation(new URLSearchParams()).radiusKm, 20);
  for (const radius of [5, 10, 20, 50]) {
    const state = navigation.readSearchNavigation(new URLSearchParams(`q=café&radius=${radius}&page=2`));
    const url = navigation.writeSearchNavigation(new URLSearchParams(), state);
    assert.equal(navigation.readSearchNavigation(url).radiusKm, radius);
    assert.equal(navigation.readSearchNavigation(url).page, 2);
    assert.equal(url.has("latitude"), false);
  }
  for (const radius of [0, 30, 500, NaN]) assert.equal(navigation.readSearchNavigation(new URLSearchParams(`radius=${radius}`)).radiusKm, 20);
  assert.equal(navigation.readSearchNavigation(new URLSearchParams("filters=nearby")).radiusKm, 5);
  assert.equal(JSON.stringify(requestRadii), "[5,10,20]");
});

test("sin ubicación ni localidad no se consulta catálogo ni tiendas nacionales", async () => {
  const client = { rpc() { throw new Error("No debe consultar"); } };
  assert.equal((await getPublicCatalog(client, options)).total, 0);
  assert.equal((await searchPublicStores(client, "café", {})).length, 0);
  assert.equal((await getPublicCatalog(client, { ...options, buyerLocation: { latitude: NaN, longitude: 0 } })).total, 0);
});

test("productos: coordenadas, radio y página viajan a PostgreSQL; cero local no hidrata catálogo", async () => {
  const calls = [];
  const client = { rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: [{ product_ids: [], total: 0 }], error: null }); }, from() { throw new Error("No debe cargar catálogo nacional"); } };
  const result = await getPublicCatalog(client, { ...options, buyerLocation: coordinates, radiusKm: 10, page: 2 });
  assert.equal(result.total, 0);
  assert.equal(calls[0].args.p_radius_km, 10);
  assert.equal(calls[0].args.p_latitude, coordinates.latitude);
  assert.equal(calls[0].args.p_longitude, coordinates.longitude);
  assert.equal(calls[0].args.p_offset, 48);
});

test("tiendas reciben el mismo radio y ubicación; localidad sólo cuando es conocida", async () => {
  const calls = [];
  const client = { rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: [], error: null }); } };
  await searchPublicStores(client, "panadería", { buyerLocation: coordinates, radiusKm: 50 });
  assert.equal(calls[0].args.p_radius_km, 50);
  assert.equal(calls[0].args.p_latitude, coordinates.latitude);
  await getPublicCatalog(client, { ...options, locality: "Alta Gracia" });
  assert.equal(calls[1].args.p_locality, "Alta Gracia");
  assert.equal(calls[1].args.p_latitude, null);
});
