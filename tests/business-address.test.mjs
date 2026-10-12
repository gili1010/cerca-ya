import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib");
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {}; cache.set(path, exports);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(outputText, { exports, require: name => load(resolve(dirname(path), `${name}.ts`)) });
  return exports;
}
const { parsePreciseAddress } = load(resolve(root, "reverse-geocoding.ts"));
test("dirección precisa coherente; rechaza centroides, otros lugares y confianza insuficiente", () => {
  const context = { locality: "Anisacate", provinceCode: "AR-X" };
  const address = { country_code: "ar", state_code: "AR-X", state: "Córdoba", city: "Anisacate", street: "Av. Los Aromos", housenumber: "350", result_type: "building", lat: -31.72, lon: -64.4, rank: { confidence: 1, confidence_building_level: 1 } };
  const parsed = parsePreciseAddress(address, context);
  assert.equal(parsed.address, "Av. Los Aromos 350");
  assert.equal(parsed.latitude, address.lat);
  assert.equal(parsed.provinceCode, "AR-X");
  for (const result_type of ["city", "suburb", "locality", "postcode", "street"]) assert.equal(parsePreciseAddress({ ...address, result_type }, context), null);
  for (const patch of [{ country_code: "br" }, { state_code: "AR-S" }, { city: "Alta Gracia" }, { housenumber: "" }, { lat: 100 }, { rank: {} }, { rank: { confidence: 0.8 } }, { rank: { confidence: NaN } }, { rank: { confidence: 1, confidence_building_level: 0.5 } }]) assert.equal(parsePreciseAddress({ ...address, ...patch }, context), null);
  assert.ok(parsePreciseAddress({ ...address, city: "  ANISACATE " }, context));
});
