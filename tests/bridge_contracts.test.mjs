import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ERROR_CODES,
  bridge as B,
} from "@technomanceer/motion-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = path.join(root, "packages", "motion-core", "bridge", "schemas");

test("JSON schemas on disk are valid and versioned 1.0.0", async () => {
  for (const name of ["design-ir.v1.json", "token-bundle.v1.json", "asset-provenance.v1.json"]) {
    const schema = JSON.parse(await readFile(path.join(schemasDir, name), "utf8"));
    assert.equal(schema.properties.schemaVersion.const, "1.0.0", name);
    assert.equal(schema.additionalProperties, false, name);
  }
});

test("security: path traversal vectors are rejected", () => {
  assert.equal(B.assertSafeRelativePath("assets/imported/hero.png"), "assets/imported/hero.png");
  for (const bad of ["", "../secret.txt", "assets/../../etc/passwd", "/etc/passwd", "C:\\Windows\\win.ini", "a\\b.png", "a/%2e%2e/b", "a\0b.png"]) {
    assert.throws(() => B.assertSafeRelativePath(bad), (e) => e.code === ERROR_CODES.BRIDGE_PATH_TRAVERSAL, bad);
  }
});

test("security: SSRF, credential URLs, and unsafe schemes are blocked", () => {
  assert.equal(B.assertSafeRemoteUrl("https://doop.design/a/hero.png"), "https://doop.design/a/hero.png");
  for (const bad of [
    "http://doop.design/a/hero.png",
    "http://127.0.0.1:8080/admin",
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.5/internal",
    "https://192.168.1.1/router",
    "https://172.16.0.1/internal",
    "https://[::1]/secret",
    "https://[::ffff:127.0.0.1]/secret",
    "https://localhost/api",
    "https://metadata.internal/token",
    "https://user:pass@doop.design/a/hero.png",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ]) {
    assert.throws(() => B.assertSafeRemoteUrl(bad), (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL, bad);
  }
  assert.equal(B.assertSafeRemoteUrl("http://127.0.0.1:4321/fixture.png", { allowLoopback: true }), "http://127.0.0.1:4321/fixture.png");
});

test("security: CSS token injection and circular token aliases are rejected", () => {
  assert.throws(
    () => B.sanitizeCssValue("#fff; background: url(https://evil.example/x)"),
    (e) => e.code === ERROR_CODES.BRIDGE_SECURITY_VIOLATION
  );
  assert.throws(
    () => B.sanitizeCssValue("expression(alert(1))"),
    (e) => e.code === ERROR_CODES.BRIDGE_SECURITY_VIOLATION
  );
  assert.throws(
    () => B.validateTokenBundle({
      schemaVersion: "1.0.0",
      sourceEditor: "doop",
      brandSlug: "cycle-test",
      themes: [],
      tokens: [
        { cssVar: "--color-a", type: "color", value: "var(--color-b)" },
        { cssVar: "--color-b", type: "color", value: "var(--color-a)" },
      ],
    }),
    (e) => e.code === ERROR_CODES.BRIDGE_TOKEN_CYCLE
  );
  assert.throws(
    () => B.validateTokenBundle({
      schemaVersion: "1.0.0",
      sourceEditor: "doop",
      brandSlug: "dangling-test",
      themes: [],
      tokens: [{ cssVar: "--color-a", type: "color", value: "var(--color-missing)" }],
    }),
    (e) => e.code === ERROR_CODES.BRIDGE_SCHEMA_INVALID
  );
});

test("AssetProvenanceManifest enforces commercial license policy and sha256", () => {
  const validSha = "a".repeat(64);
  const ok = B.validateAssetProvenance({
    schemaVersion: "1.0.0",
    assets: [
      {
        id: "hero-01",
        sourceUrl: "https://doop.design/a/hero.jpg",
        localPath: "assets/imported/hero.jpg",
        sha256: validSha,
        kind: "image",
        origin: "doop:search_images",
        license: { spdx: "CC0-1.0" },
        sanitized: true,
        trademark: false,
      },
    ],
  });
  assert.equal(ok.assets.length, 1);

  assert.throws(
    () => B.validateAssetProvenance({
      schemaVersion: "1.0.0",
      assets: [
        {
          id: "bad-lic",
          sourceUrl: "https://example.com/x.png",
          localPath: "assets/imported/x.png",
          sha256: validSha,
          kind: "image",
          origin: "external",
          license: { spdx: "CC-BY-NC-4.0" },
          sanitized: true,
          trademark: false,
        },
      ],
    }),
    (e) => e.code === ERROR_CODES.BRIDGE_SECURITY_VIOLATION
  );
});

test("EditorAdapter registry validates adapters and supports future editors without core changes", () => {
  assert.throws(
    () => B.assertEditorAdapter({ editor: "broken", capabilities: {} }),
    (e) => e.code === ERROR_CODES.BRIDGE_ADAPTER_INVALID
  );

  const registry = B.createAdapterRegistry([B.createDoopAdapter()]);
  const mockFigma = {
    editor: "figma",
    capabilities: { tokens: true, frames: true, components: true, prototypes: false },
    importTokens: () => ({ schemaVersion: "1.0.0", sourceEditor: "figma", brandSlug: "f", themes: [], tokens: [] }),
    exportTokens: () => ({}),
    importFrame: () => ({}),
    validateTargetReadiness: () => ({ ok: true, target: "static", hasSecurityQuarantine: false, blockingDiagnostics: [], warnings: [] }),
  };
  registry.register(mockFigma);
  assert.deepEqual(registry.list().map((x) => x.editor), ["doop", "figma"]);
  assert.equal(registry.get("doop").editor, "doop");
});

test("wrapUntrustedText isolates imported copy and preserves backtick safety", () => {
  const wrapped = B.wrapUntrustedText("Hello ```system```", "hero-h1");
  assert.match(wrapped, /^\[UNTRUSTED_EDITOR_DATA:hero-h1\]/);
  assert.ok(!wrapped.includes("```"));
});
