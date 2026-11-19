import test from "node:test";
import assert from "node:assert/strict";
import {
  listMotionComponents,
  validateComponentConfig,
  generateComponentHtml,
} from "../packages/motion-core/components/index.js";
import { listMotionComponents as publicList, generateComponentHtml as publicGenerate, renderMotionComponent } from "../packages/motion-core/index.js";

const componentIds = [
  "animated-counter",
  "animated-ranking",
  "comparison-panel",
  "timeline-sequence",
  "progress-gauge",
  "kinetic-text-reveal",
  "image-reveal",
  "data-callout",
];

const examples = [
  { component: "animated-counter", label: "Requests", value: 128 },
  { component: "animated-ranking", title: "Languages", items: [{ label: "Rust", value: 95 }] },
  { component: "comparison-panel", title: "Latency", items: [{ label: "Before", value: 80 }, { label: "After", value: 35 }] },
  { component: "timeline-sequence", title: "Release", events: [{ time: 1, label: "Request" }] },
  { component: "progress-gauge", label: "Uptime", value: 99.9, max: 100 },
  { component: "kinetic-text-reveal", text: "Small steps, clear systems", revealBy: "word" },
  { component: "image-reveal", src: "images/product.png", alt: "Product surface" },
  { component: "data-callout", value: "42 ms", label: "Median response" },
];

test("component registry exposes eight stable, schema-backed IDs", () => {
  const descriptors = listMotionComponents();
  assert.deepEqual(descriptors.map(({ id }) => id), componentIds);
  for (const descriptor of descriptors) {
    assert.equal(descriptor.schema.$id, `motion-component:${descriptor.id}@1`);
    assert.ok(descriptor.defaults.duration > 0);
    assert.ok(descriptor.defaults.fps > 0);
    assert.equal(descriptor.provenance.kind, "motion-core-native");
  }
});

test("motion-core exposes the component registry and generator programmatically", () => {
  assert.equal(publicList().length, componentIds.length);
  assert.match(publicGenerate({ component: "animated-counter", label: "API", value: 2 }), /data-component-id="animated-counter"/);
});

test("component configs get explicit defaults and preserve composition parameters", () => {
  const normalized = validateComponentConfig({
    component: "animated-ranking",
    title: "Top 3 systems",
    items: [{ label: "A", value: 95 }, { label: "B", value: 80 }],
  });
  assert.equal(normalized.duration, 8);
  assert.equal(normalized.fps, 30);
  assert.equal(normalized.aspectRatio, "9:16");
  assert.equal(normalized.theme.primary, "#2563EB");
  assert.deepEqual(normalized.items.map(({ label }) => label), ["A", "B"]);
});

test("all eight component generators return responsive frame-driven documents", () => {
  for (const example of examples) {
    const html = generateComponentHtml({ ...example, aspectRatio: "16:9", duration: 5, fps: 24 });
    assert.match(html, new RegExp(`data-component-id="${example.component}"`));
    assert.match(html, /viewBox="0 0 /);
    assert.match(html, /data-motion-important=/);
    assert.match(html, /window\.__onFrame__/);
    assert.match(html, /document\.fonts\.ready/);
    assert.doesNotMatch(html, /Math\.random|Date\.now|setTimeout|setInterval|@keyframes/);
    const script = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(script, `${example.component} is missing its frame script`);
    assert.doesNotThrow(() => new Function(script[1]), `${example.component} frame script must parse`);
  }
});

test("ranking data and long Unicode text are escaped without source edits", () => {
  const html = generateComponentHtml({
    component: "animated-ranking",
    title: "Systems <script>alert(1)</script>",
    items: [{ label: "São José — 超長い名前 com detalhes", value: 100 }],
  });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /São José — 超長い名前 com detalhes/);
});

test("component validation rejects unknown IDs, invalid colors, and malformed data", async () => {
  assert.throws(() => validateComponentConfig({ component: "ranking" }), /componente desconhecido/i);
  assert.throws(() => validateComponentConfig({ component: "animated-counter", value: NaN }), /value/i);
  assert.throws(() => validateComponentConfig({ component: "progress-gauge", value: 120, max: 100 }), /value/i);
  assert.throws(() => validateComponentConfig({ ...examples[0], theme: { primary: "url(javascript:alert(1))" } }), /primary/i);
  assert.throws(() => validateComponentConfig({ ...examples[6], src: "javascript:alert(1)" }), /src/i);
  assert.throws(() => validateComponentConfig({ component: "animated-counter", surprise: true }), /campos desconhecidos/i);
  await assert.rejects(renderMotionComponent({ component: "animated-counter", transparent: true }, "out.mp4"), /use saída \.webm/i);
});
