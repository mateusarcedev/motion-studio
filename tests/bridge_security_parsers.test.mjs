import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ERROR_CODES, assertSafeSvg, bridge as B, validateSvg } from "@technomanceer/motion-core";
import { createStaticServer } from "../packages/motion-core/lib/static-server.mjs";

test("security parsers: defeats HTML entity/control-char obfuscation, nested tags, and event handlers", () => {
  const nasty = `
    <!doctype html>
    <html>
      <head>
        <base href="https://evil.example/" />
        <meta http-equiv="refresh" content="0;url=https://evil.example/phish" />
        <link rel="stylesheet" href="https://127.0.0.1/internal.css" />
      </head>
      <body>
        <scr<script>ipt>alert(1)</script>
        <img/src="https://cdn.example/ok.png"/onerror=alert(1) />
        <a href="&#106;&#97;&#x76;a&#x09;script:alert(document.cookie)">js1</a>
        <a href="file:///etc/passwd">local1</a>
        <a href="/etc/passwd">local2</a>
        <a href="../secret.env">local3</a>
        <iframe srcdoc="<script>alert(1)</script>"></iframe>
        <img srcset="https://cdn.example/1x.png 1x, http://169.254.169.254/2x.png 2x" />
      </body>
    </html>
  `;
  const res = B.scanUntrustedHtml(nasty);
  assert.ok(!res.sanitizedHtml.includes("<base"));
  assert.ok(!res.sanitizedHtml.includes("http-equiv"));
  assert.ok(!res.sanitizedHtml.includes("alert(1)"));
  assert.ok(!res.sanitizedHtml.includes("onerror"));
  assert.ok(!res.sanitizedHtml.includes("javascript:"));
  assert.ok(!res.sanitizedHtml.includes("file:///etc/passwd"));
  assert.ok(!res.sanitizedHtml.includes("/etc/passwd"));
  assert.ok(!res.sanitizedHtml.includes("../secret.env"));
  assert.ok(!res.sanitizedHtml.includes("169.254.169.254"));
  assert.ok(!res.sanitizedHtml.includes("srcdoc"));
  assert.ok(res.sanitizedHtml.includes("https://cdn.example/1x.png 1x"));
  assert.ok(res.securityFindings.some((f) => f.code === "BASE_TAG_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "UNSAFE_META_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "EVENT_HANDLER_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "UNSAFE_URL_SCHEME_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "LOCAL_RESOURCE_REF_BLOCKED"));
  assert.ok(res.securityFindings.some((f) => f.code === "UNSAFE_SRCSET_STRIPPED"));
});

test("security parsers: css-tree defeats CSS escapes, comments, @import, and obfuscated url()", () => {
  const obfuscatedCss = `
    @\\69mport "https://evil.example/leak.css";
    .a {
      background: u/*split*/rl("http://169.254.169.254/latest");
      width: \\65xpression(alert(1));
      behavior: url("https://evil.example/evil.htc");
      color: #1F6F50;
    }
    .b {
      background-image: \\75\\72\\6c("https://cdn.example/hero.jpg");
    }
  `;
  const res = B.inspectAndSanitizeCss(obfuscatedCss, { context: "stylesheet" });
  assert.ok(!res.css.includes("@import"));
  assert.ok(!res.css.includes("169.254.169.254"));
  assert.ok(!res.css.includes("expression"));
  assert.ok(!res.css.includes("behavior"));
  assert.ok(res.css.includes("#1F6F50") || res.css.includes("#1f6f50"));
  assert.ok(res.extractedUrls.some((u) => u.url === "https://cdn.example/hero.jpg"));
  assert.ok(res.securityFindings.some((f) => f.code === "CSS_IMPORT_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "UNSAFE_CSS_URL_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "CSS_EXPRESSION_STRIPPED"));
  assert.ok(res.securityFindings.some((f) => f.code === "UNSAFE_CSS_PROPERTY_STRIPPED"));

  // Token CSS escape attack blocked in sanitizeCssValue
  assert.throws(
    () => B.sanitizeCssValue("\\75\\72\\6c(https://evil.example/x)"),
    (e) => e.code === ERROR_CODES.BRIDGE_SECURITY_VIOLATION
  );
});

test("security parsers: SVG sanitizer blocks obfuscated CSS @import/url() inside <style> and style attr", () => {
  const evilSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <style>@\\69mport "https://evil.example/x.css";</style>
    <rect width="24" height="24" style="fill:\\75rl(http://169.254.169.254/a)" />
    <image href="&#106;avascript:alert(1)" />
    <foreignObject width="10" height="10"><div /></foreignObject>
    <circle cx="12" cy="12" r="5"><animate attributeName="r" from="1" to="5" dur="1s" /></circle>
  </svg>`;
  const r = validateSvg(evilSvg);
  assert.equal(r.status, "WARN");
  assert.ok(!r.svg.includes("evil.example"));
  assert.ok(!r.svg.includes("169.254.169.254"));
  assert.ok(!r.svg.includes("javascript"));
  assert.ok(!r.svg.includes("foreignObject"));
  assert.ok(!r.svg.includes("<animate"));
  assert.throws(() => assertSafeSvg(evilSvg, { strict: true }), (e) => e.code === ERROR_CODES.SVG_UNSAFE);
});

test("security parsers: static-server refuses symlink escape outside project root", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "motion-srv-sym-"));
  const secret = path.join(os.tmpdir(), `motion-secret-${Date.now()}.txt`);
  await writeFile(secret, "TOP_SECRET");
  await writeFile(path.join(dir, "index.html"), "<!doctype html><html><body>ok</body></html>");
  await symlink(secret, path.join(dir, "leak.txt"));
  const { server, listen } = createStaticServer(path.join(dir, "index.html"));
  const port = await listen();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/leak.txt`);
    assert.equal(res.status, 403);
    const missing = await fetch(`http://127.0.0.1:${port}/does-not-exist.txt`);
    assert.equal(missing.status, 404);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
    await rm(secret, { force: true });
  }
});
