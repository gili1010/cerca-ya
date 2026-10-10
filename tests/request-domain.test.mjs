import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => load(name.startsWith("@/")
    ? resolve(root, "../src", `${name.slice(2)}.ts`)
    : resolve(dirname(path), `${name}.ts`)) });
  return exports;
}
const root = dirname(fileURLToPath(import.meta.url));
const domain = load(resolve(root, "../src/lib/request-domain.ts"));
const { createMockRequests } = load(resolve(root, "../src/data/requests.ts"));
const { createMockOffers } = load(resolve(root, "../src/data/offers.ts"));
const { businesses } = load(resolve(root, "../src/data/businesses.ts"));
const now = "2026-09-27T18:00:00.000Z";
const fresh = () => ({ version: 1, requests: createMockRequests(new Date(now)), offers: createMockOffers(new Date(now)) });
const buyerId = "comprador-demo";
const requestInput = { title: "  Sensor Ford Ka 2019  ", description: "Motor 1.5", category: "Automotor", neededWhen: "Lo necesito hoy", radiusKm: 5 };
const offerInput = { productName: "Sensor compatible", description: "Producto nuevo disponible", price: 28500, pickupAvailable: true, deliveryAvailable: false, estimatedDelivery: "", alternative: false };

test("create request assigns unique sequential ID, trims title, starts OPEN with no offers", () => {
  const result = domain.addRequest(fresh(), requestInput, buyerId, now);
  assert.equal(result.request.id, "PED-1003");
  assert.equal(result.request.title, "Sensor Ford Ka 2019");
  assert.equal(result.request.status, "OPEN");
  assert.equal(result.request.offersCount, 0);
  assert.equal(domain.addRequest(result.database, requestInput, buyerId, now).request.id, "PED-1004");
});
test("offering updates exactly the correct request and derives its count", () => {
  const { database, request } = domain.addRequest(fresh(), requestInput, buyerId, now);
  const result = domain.addOffer(database, request.id, businesses[0], offerInput, now);
  assert.equal(result.offer.requestId, request.id);
  assert.equal(result.offer.businessName, businesses[0].name);
  assert.equal(result.database.requests.find(r => r.id === request.id).offersCount, 1);
  assert.equal(result.database.requests.find(r => r.id === "PED-1001").offersCount, 3);
  assert.equal(database.offers.length, 3);
});
test("closed and cancelled requests reject offers, including stale form submissions", () => {
  for (const status of ["CLOSED", "CANCELLED"]) {
    const closed = domain.changeRequestStatus(fresh(), "PED-1001", status, buyerId);
    assert.throws(() => domain.addOffer(closed, "PED-1001", businesses[0], offerInput, now), /cerrado/);
    assert.throws(() => domain.reserveOffer(closed, "OFE-1001", buyerId), /cerrado/);
  }
});
test("reserve selects one offer and closes its request; a second reservation is rejected", () => {
  const database = domain.reserveOffer(fresh(), "OFE-1002", buyerId);
  const request = database.requests.find(r => r.id === "PED-1001");
  assert.equal(request.status, "CLOSED");
  assert.equal(request.reservedOfferId, "OFE-1002");
  assert.throws(() => domain.reserveOffer(database, "OFE-1003", buyerId), /cerrado/);
  assert.equal(database.requests.find(r => r.id === "PED-1002").status, "OPEN");
});
test("rejects out-of-radius businesses, invalid price, empty titles and no fulfillment", () => {
  const { database, request } = domain.addRequest(fresh(), requestInput, buyerId, now);
  assert.throws(() => domain.addOffer(database, request.id, businesses[2], offerInput, now), /radio/);
  for (const price of [0, -1, NaN, Infinity, 1.001]) assert.ok(domain.validateOffer({ ...offerInput, price }));
  assert.ok(domain.validateRequest({ ...requestInput, title: "   " }));
  assert.ok(domain.validateOffer({ ...offerInput, pickupAvailable: false }));
  assert.ok(domain.validateOffer({ ...offerInput, deliveryAvailable: true }));
});
test("buyers cannot close or reserve someone else's request", () => {
  assert.throws(() => domain.changeRequestStatus(fresh(), "PED-1001", "CLOSED", "otro-comprador"), /pedido/);
  assert.throws(() => domain.reserveOffer(fresh(), "OFE-1001", "otro-comprador"), /pedido/);
});
test("storage roundtrip preserves reservation and repairs denormalized offer count", () => {
  const database = domain.reserveOffer(fresh(), "OFE-1002", buyerId);
  database.requests[0].offersCount = 99;
  const restored = domain.parseDatabase(JSON.stringify(database));
  assert.equal(restored.requests[0].reservedOfferId, "OFE-1002");
  assert.equal(restored.requests[0].offersCount, 3);
  assert.equal(restored.offers.length, 3);
});
test("corrupt, foreign-version and orphaned stored records are rejected", () => {
  assert.equal(domain.parseDatabase("not-json"), null);
  assert.equal(domain.parseDatabase('{"version":2,"requests":[],"offers":[]}'), null);
  const orphan = fresh(); orphan.offers[0].requestId = "PED-9999";
  assert.equal(domain.parseDatabase(JSON.stringify(orphan)), null);
  const duplicate = fresh(); duplicate.requests.push(duplicate.requests[0]);
  assert.equal(domain.parseDatabase(JSON.stringify(duplicate)), null);
  const wrongReservation = fresh(); wrongReservation.requests[1].status = "CLOSED"; wrongReservation.requests[1].reservedOfferId = "OFE-1001";
  assert.equal(domain.parseDatabase(JSON.stringify(wrongReservation)), null);
});
