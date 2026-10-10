import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const exports = {};
const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/businesses/social-links.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
runInNewContext(outputText, { exports, URL });
const { normalizeSocialLink } = exports;

test("optional profiles accept handles and approved HTTPS URLs", () => {
  for (const input of ["@mitienda", "mitienda", "instagram.com/mitienda", "https://instagram.com/mitienda", "https://www.instagram.com/mitienda/"]) {
    assert.equal(normalizeSocialLink(input, "instagram"), "https://instagram.com/mitienda");
  }
  for (const input of ["mitienda", "facebook.com/mitienda", "https://facebook.com/mitienda", "https://www.facebook.com/mitienda/"]) {
    assert.equal(normalizeSocialLink(input, "facebook"), "https://facebook.com/mitienda");
  }
  assert.equal(normalizeSocialLink("https://facebook.com/profile.php?id=123", "facebook"), "https://facebook.com/profile.php?id=123");
  assert.equal(normalizeSocialLink("  ", "instagram"), null);
});

test("profile links reject scheme/host tricks, credentials and oversized inputs", () => {
  for (const input of ["javascript:alert(1)", "data:text/html,test", "https://example.com/test", "https://instagram.com.evil.com/test", "https://instagram.com@evil.com/test", "https://evil.com@instagram.com/test", "https://instagram.com:8443/test", "https://instagram.com/a/../test", "https://instagram.com/%2e%2e/test", "https://instagram.com/", "http://instagram.com/test", "https://instagram.com/test?redirect=https://evil.com", "x".repeat(301)]) {
    assert.equal(normalizeSocialLink(input, "instagram"), undefined, input);
  }
  assert.equal(normalizeSocialLink("https://instagram.com/test", "facebook"), undefined);
});
