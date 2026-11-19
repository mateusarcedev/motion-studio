const VERSION = "1.0.0-rc.4";
const DEFAULT_THEME = Object.freeze({
  primary: "#2563EB",
  accent: "#22C55E",
  background: "#101827",
  surface: "#172338",
  text: "#FFFFFF",
  muted: "#94A3B8",
});

const componentSpecs = [
  ["animated-counter", "Animated Counter", { label: "Requests", from: 0, value: 128, decimals: 0, prefix: "", suffix: "" }],
  ["animated-ranking", "Animated Ranking", { title: "Ranking", max: 100, items: [{ label: "Item A", value: 95 }, { label: "Item B", value: 80 }, { label: "Item C", value: 65 }] }],
  ["comparison-panel", "Comparison Panel", { title: "Comparison", max: 100, items: [{ label: "Before", value: 80 }, { label: "After", value: 35 }] }],
  ["timeline-sequence", "Timeline Sequence", { title: "Timeline", events: [{ time: 1, label: "Start" }, { time: 4, label: "Result" }] }],
  ["progress-gauge", "Progress & Gauge", { label: "Progress", value: 72, max: 100, suffix: "%" }],
  ["kinetic-text-reveal", "Kinetic Text Reveal", { text: "A clear idea, revealed with intent.", revealBy: "word" }],
  ["image-reveal", "Image Reveal", { src: "assets/image.png", alt: "Revealed image", focalPoint: "50% 50%" }],
  ["data-callout", "Data Callout", { value: "42 ms", label: "Median response", detail: "Measured across the sample." }],
];

const fieldSchema = (id, key, defaultValue) => {
  if (key === "component") return { const: id };
  if (key === "instanceId") return { type: "string", minLength: 1, maxLength: 64, default: id };
  if (["duration", "fps", "aspectRatio"].includes(key)) {
    return key === "duration" ? { type: "number", minimum: 0.1, maximum: 300, default: 8 } :
      key === "fps" ? { type: "integer", minimum: 1, maximum: 120, default: 30 } :
        { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?:[0-9]+(?:\\.[0-9]+)?$", default: "9:16" };
  }
  if (key === "theme") return {
    type: "object", additionalProperties: false,
    properties: Object.fromEntries(Object.entries(DEFAULT_THEME).map(([name, value]) => [name, { type: "string", default: value }])),
  };
  if (key === "items") return {
    type: "array", minItems: id === "comparison-panel" ? 2 : 1, maxItems: id === "comparison-panel" ? 6 : 12,
    items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: {
      label: { type: "string", minLength: 1, maxLength: 240 }, value: { type: "number", minimum: 0 }, detail: { type: "string", maxLength: 500 },
    } },
  };
  if (key === "events") return {
    type: "array", minItems: 1, maxItems: 12,
    items: { type: "object", additionalProperties: false, required: ["time", "label"], properties: {
      time: { type: "number", minimum: 0 }, label: { type: "string", minLength: 1, maxLength: 240 }, detail: { type: "string", maxLength: 500 },
    } },
  };
  const type = typeof defaultValue;
  if (type === "number") return { type: "number", default: defaultValue };
  if (type === "string") return { type: "string", default: defaultValue };
  return { type: "object", default: defaultValue };
};

const baseSchema = (id, title, properties) => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `motion-component:${id}@1`,
  title,
  type: "object",
  additionalProperties: false,
  required: ["component"],
  properties: {
    component: { const: id },
    instanceId: fieldSchema(id, "instanceId"),
    duration: fieldSchema(id, "duration"),
    fps: fieldSchema(id, "fps"),
    aspectRatio: fieldSchema(id, "aspectRatio"),
    transparent: { type: "boolean", default: false },
    theme: fieldSchema(id, "theme"),
    ...properties,
  },
});

const specs = Object.fromEntries(componentSpecs.map(([id, title, defaults]) => [id, {
  id, title, version: 1, defaults: { ...defaults, duration: 8, fps: 30, aspectRatio: "9:16", theme: { ...DEFAULT_THEME } },
  schema: baseSchema(id, title, Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, fieldSchema(id, key, value)]))),
  provenance: { kind: "motion-core-native", package: "motion-core", version: VERSION, schema: "motion-component@1" },
}]));

export function listMotionComponents() {
  return Object.values(specs).map((descriptor) => structuredClone(descriptor));
}

export function getMotionComponent(componentId) {
  const descriptor = specs[componentId];
  return descriptor ? structuredClone(descriptor) : null;
}

function fail(field, message) {
  throw new TypeError(`${field}: ${message}`);
}

function textValue(value, field, fallback = "", maxLength = 2000) {
  const result = value ?? fallback;
  if (typeof result !== "string" || !result.trim() || result.length > maxLength) fail(field, `deve ser um texto não vazio com até ${maxLength} caracteres`);
  return result;
}

function numberValue(value, field, { min = -1e9, max = 1e9, fallback } = {}) {
  const result = value ?? fallback;
  if (typeof result !== "number" || !Number.isFinite(result) || result < min || result > max) fail(field, `deve ser um número entre ${min} e ${max}`);
  return result;
}

function normalizeItems(value, field, { min = 1, max = 12 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(field, `deve conter de ${min} a ${max} itens`);
  return value.map((item, index) => ({
    label: textValue(item?.label, `${field}[${index}].label`, "", 240),
    value: numberValue(item?.value, `${field}[${index}].value`, { min: 0 }),
    ...(item?.detail === undefined ? {} : { detail: textValue(item.detail, `${field}[${index}].detail`, "", 500) }),
  }));
}

export function validateComponentConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("config", "deve ser um objeto JSON");
  const id = input.component;
  const descriptor = specs[id];
  if (!descriptor) fail("component", `componente desconhecido '${id ?? ""}'`);
  const allowedFields = new Set(["component", "instanceId", "duration", "fps", "aspectRatio", "transparent", "theme", ...Object.keys(descriptor.defaults)]);
  const unexpectedFields = Object.keys(input).filter((key) => !allowedFields.has(key));
  if (unexpectedFields.length) fail("config", `campos desconhecidos: ${unexpectedFields.join(", ")}`);
  const config = { ...descriptor.defaults, ...input };
  config.instanceId = input.instanceId ?? id;
  config.transparent = input.transparent ?? false;
  if (typeof config.transparent !== "boolean") fail("transparent", "deve ser booleano");
  config.duration = numberValue(config.duration, "duration", { min: 0.1, max: 300 });
  config.fps = numberValue(config.fps, "fps", { min: 1, max: 120 });
  if (!Number.isInteger(config.fps)) fail("fps", "deve ser um inteiro");
  const ratio = typeof config.aspectRatio === "string" ? config.aspectRatio.match(/^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/) : null;
  if (!ratio || Number(ratio[1]) <= 0 || Number(ratio[2]) <= 0) fail("aspectRatio", "use a proporção positiva L:A, por exemplo 9:16");
  if (typeof config.instanceId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(config.instanceId)) fail("instanceId", "use até 64 caracteres alfanuméricos, '_' ou '-'");

  const themeInput = input.theme ?? {};
  if (!themeInput || typeof themeInput !== "object" || Array.isArray(themeInput)) fail("theme", "deve ser um objeto");
  config.theme = { ...DEFAULT_THEME, ...themeInput };
  for (const [key, color] of Object.entries(config.theme)) {
    if (!(key in DEFAULT_THEME)) fail(`theme.${key}`, "campo desconhecido");
    if (typeof color !== "string" || !(key === "background" && color === "transparent") && !/^#[\da-fA-F]{3}(?:[\da-fA-F]{3}|[\da-fA-F]{5})?$/.test(color)) fail(`theme.${key}`, "use uma cor hexadecimal válida" );
  }

  switch (id) {
    case "animated-counter":
      config.label = textValue(config.label, "label", "Counter", 240);
      config.from = numberValue(config.from, "from", { min: -1e9 });
      config.value = numberValue(config.value, "value");
      config.decimals = numberValue(config.decimals, "decimals", { min: 0, max: 6, fallback: 0 });
      if (!Number.isInteger(config.decimals)) fail("decimals", "deve ser um inteiro de 0 a 6");
      config.prefix = config.prefix ?? ""; config.suffix = config.suffix ?? "";
      if ([config.prefix, config.suffix].some((v) => typeof v !== "string" || v.length > 32)) fail("prefix/suffix", "devem ser textos de até 32 caracteres");
      break;
    case "animated-ranking":
      config.title = textValue(config.title, "title", "Ranking", 240);
      config.max = numberValue(config.max, "max", { min: 0.000001, fallback: 100 });
      config.items = normalizeItems(config.items, "items", { min: 1, max: 12 });
      if (config.items.some(({ value }) => value > config.max)) fail("items.value", "não pode ultrapassar max");
      break;
    case "comparison-panel":
      config.title = textValue(config.title, "title", "Comparison", 240);
      config.max = numberValue(config.max, "max", { min: 0.000001, fallback: 100 });
      config.items = normalizeItems(config.items, "items", { min: 2, max: 6 });
      if (config.items.some(({ value }) => value > config.max)) fail("items.value", "não pode ultrapassar max");
      break;
    case "timeline-sequence":
      config.title = textValue(config.title, "title", "Timeline", 240);
      if (!Array.isArray(config.events) || !config.events.length || config.events.length > 12) fail("events", "deve conter de 1 a 12 eventos");
      config.events = config.events.map((event, index) => ({
        time: numberValue(event?.time, `events[${index}].time`, { min: 0, max: config.duration }),
        label: textValue(event?.label, `events[${index}].label`, "", 240),
        ...(event?.detail === undefined ? {} : { detail: textValue(event.detail, `events[${index}].detail`, "", 500) }),
      })).sort((a, b) => a.time - b.time);
      break;
    case "progress-gauge":
      config.label = textValue(config.label, "label", "Progress", 240);
      config.max = numberValue(config.max, "max", { min: 0.000001, fallback: 100 });
      config.value = numberValue(config.value, "value", { min: 0, max: config.max });
      config.suffix = config.suffix ?? "%";
      if (typeof config.suffix !== "string" || config.suffix.length > 16) fail("suffix", "deve ser um texto de até 16 caracteres");
      break;
    case "kinetic-text-reveal":
      config.text = textValue(config.text, "text", "", 2000);
      config.revealBy = config.revealBy ?? "word";
      if (!["word", "line", "block"].includes(config.revealBy)) fail("revealBy", "use word, line ou block");
      break;
    case "image-reveal":
      config.src = textValue(config.src, "src", "", 2048);
      if (/^(?:javascript|file|vbscript):/i.test(config.src) || config.src.startsWith("//")) fail("src", "use um caminho relativo ou URL https");
      if (/^https?:/i.test(config.src) && !/^https:/i.test(config.src)) fail("src", "URLs externas devem usar https");
      config.alt = textValue(config.alt, "alt", "Imagem", 500);
      config.focalPoint = config.focalPoint ?? "50% 50%";
      if (!/^\d{1,3}%\s+\d{1,3}%$/.test(config.focalPoint)) fail("focalPoint", "use dois percentuais, por exemplo 50% 50%");
      break;
    case "data-callout":
      if (!(typeof config.value === "string" || typeof config.value === "number" && Number.isFinite(config.value))) fail("value", "deve ser texto ou número finito");
      config.value = String(config.value);
      config.label = textValue(config.label, "label", "Key figure", 240);
      config.detail = config.detail ?? "";
      if (typeof config.detail !== "string" || config.detail.length > 500) fail("detail", "deve ser texto com até 500 caracteres");
      break;
  }
  return config;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
function dimensions(aspectRatio) {
  const [a, b] = aspectRatio.split(":").map(Number);
  if (a === b) return { width: 1080, height: 1080 };
  if (a < b) return { width: 1080, height: Math.round(1080 * b / a) };
  return { width: Math.round(1080 * a / b), height: 1080 };
}
function contentFrame(config, width) {
  const [aspectW, aspectH] = config.aspectRatio.split(":").map(Number);
  const left = width * (aspectW / aspectH < 1 ? 0.06 : 0.08);
  const right = width * (aspectW / aspectH < 1 ? 0.18 : 0.08);
  return { x: left, width: width - left - right, right: width - right, center: (width - right + left) / 2 };
}
function important(name, x, y, width, height, body, extra = "") {
  return `<g data-motion-important="${escapeXml(name)}" data-motion-box="${x},${y},${width},${height}" ${extra}>${body}</g>`;
}
function textNode(text, x, y, size, fill, weight = 500, anchor = "start") {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}
function foreignText(text, x, y, width, height, size, fill, weight = 500, align = "left") {
  return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:${align === "center" ? "center" : "flex-start"};overflow:hidden;overflow-wrap:anywhere;word-break:normal;color:${fill};font: ${weight} ${size}px/1.12 system-ui,sans-serif">${escapeXml(text)}</div></foreignObject>`;
}
function background(config, width, height) {
  return config.transparent || config.theme.background === "transparent" ? "" : `<rect width="${width}" height="${height}" fill="${config.theme.background}"/>`;
}
function labelMarkup(config, width, height, label, y, size) {
  const content = contentFrame(config, width);
  const fontSize = Math.max(size * 0.55, Math.min(size, content.width / Math.max(1, label.length * 0.55)));
  const lines = Math.max(1, Math.ceil(label.length * fontSize * 0.55 / content.width));
  const textHeight = Math.max(size * 1.35, lines * fontSize * 1.22);
  const top = y - textHeight / 2;
  return important(label, content.x, top, content.width, textHeight,
    foreignText(label, content.x, top, content.width, textHeight, fontSize, config.theme.muted, 600));
}
function enterAttrs(delay, x = 0, y = 18) { return `data-motion-enter="${delay}" data-motion-enter-x="${x}" data-motion-enter-y="${y}" opacity="0"`; }

function markupFor(config, width, height) {
  const c = config, p = c.theme.primary, a = c.theme.accent, ink = c.theme.text, muted = c.theme.muted, surface = c.theme.surface;
  const content = contentFrame(c, width), pad = content.x, contentWidth = content.width;
  switch (c.component) {
    case "animated-counter": {
      const y = height * 0.52;
      const counter = important("counter", pad, height * 0.3, contentWidth, height * 0.28,
        `<text id="motion-counter-value" x="${content.center}" y="${y}" fill="${ink}" font-size="${Math.min(width, height) * 0.19}" font-weight="700" text-anchor="middle">${escapeXml(c.prefix + c.from.toFixed(c.decimals) + c.suffix)}</text>`, `text-anchor="middle" ${enterAttrs(0.1)}`);
      return `${labelMarkup(c, width, height, c.label, height * 0.69, Math.min(width, height) * 0.04)}${counter}<circle cx="${width / 2}" cy="${height * 0.28}" r="${Math.min(width, height) * 0.025}" fill="${p}"/>`;
    }
    case "animated-ranking": {
      const top = height * 0.3, rowH = Math.min(height * 0.105, (height * 0.62) / c.items.length);
      const title = labelMarkup(c, width, height, c.title, height * 0.2, Math.min(width, height) * 0.055);
      const rows = c.items.map((item, i) => {
        const y = top + i * rowH, barW = width * 0.48 * (item.value / c.max);
        const row = `<rect x="${pad}" y="${y}" width="${contentWidth}" height="${rowH * 0.76}" rx="${rowH * 0.14}" fill="${surface}"/>`+
          `<rect id="motion-rank-bar-${i}" x="${pad}" y="${y + rowH * 0.59}" width="0" height="${rowH * 0.08}" rx="4" fill="${p}"/>`+
          textNode(String(i + 1).padStart(2, "0"), pad + rowH * 0.22, y + rowH * 0.42, rowH * 0.25, a, 700)+
          foreignText(item.label, pad + rowH * 0.66, y + rowH * 0.08, width * 0.57, rowH * 0.4, Math.min(width, height) * 0.032, ink, 600)+
          `<text x="${content.right - rowH * 0.16}" y="${y + rowH * 0.42}" fill="${muted}" font-size="${rowH * 0.18}" text-anchor="end">${item.value}</text>`;
        return important(`ranking-${i + 1}`, pad, y, contentWidth, rowH * 0.76, row, enterAttrs(0.25 + i * 0.16));
      }).join("");
      return `${title}${rows}`;
    }
    case "comparison-panel": {
      const top = height * 0.34, rowH = height * 0.25 / c.items.length;
      const title = labelMarkup(c, width, height, c.title, height * 0.2, Math.min(width, height) * 0.055);
      const titleBacking = `<rect x="${pad}" y="${height * 0.14}" width="${contentWidth}" height="${height * 0.12}" rx="${Math.min(width, height) * 0.02}" fill="${surface}"/>`;
      const rows = c.items.map((item, i) => {
        const y = top + i * rowH, barY = y + rowH * 0.58, barMax = contentWidth * 0.77;
        const body = `<rect x="${pad}" y="${y}" width="${contentWidth}" height="${rowH * 0.9}" rx="${rowH * 0.14}" fill="${surface}"/>`+
          foreignText(item.label, pad, y, contentWidth, rowH * 0.38, Math.min(width, height) * 0.035, ink, 600)+
          `<rect x="${pad}" y="${barY}" width="${barMax}" height="${rowH * 0.24}" rx="${rowH * 0.12}" fill="${surface}"/>`+
          `<rect id="motion-comparison-bar-${i}" x="${pad}" y="${barY}" width="0" height="${rowH * 0.24}" rx="${rowH * 0.12}" fill="${i ? a : p}"/>`+
          `<text x="${content.right}" y="${barY + rowH * 0.2}" fill="${muted}" font-size="${rowH * 0.19}" text-anchor="end">${item.value}</text>`;
        return important(`comparison-${i + 1}`, pad, y, contentWidth, rowH * 0.9, body, enterAttrs(0.25 + i * 0.18));
      }).join("");
      return `${titleBacking}${title}${rows}`;
    }
    case "timeline-sequence": {
      const left = content.x + width * 0.13, right = content.right - width * 0.13, lineY = height * 0.52, range = Math.max(c.duration, 0.001);
      const title = labelMarkup(c, width, height, c.title, height * 0.2, Math.min(width, height) * 0.055);
      const line = `<line x1="${left}" y1="${lineY}" x2="${right}" y2="${lineY}" stroke="${surface}" stroke-width="${Math.min(width, height) * 0.012}" stroke-linecap="round"/><line id="motion-timeline-progress" x1="${left}" y1="${lineY}" x2="${left}" y2="${lineY}" stroke="${p}" stroke-width="${Math.min(width, height) * 0.012}" stroke-linecap="round"/>`;
      const eventPositions = c.events.map((event) => left + (right - left) * (event.time / range));
      const events = c.events.map((event, i) => {
        const x = eventPositions[i], above = i % 2 === 0;
        const neighborGap = c.events.length === 1 ? contentWidth * 0.72 : Math.min(
          i > 0 ? x - eventPositions[i - 1] : Infinity,
          i < eventPositions.length - 1 ? eventPositions[i + 1] - x : Infinity,
        );
        const boxWidth = Math.min(width * 0.3, neighborGap * 0.82);
        const boxX = Math.max(content.x, Math.min(content.right - boxWidth, x - boxWidth / 2));
        const labelY = lineY + (above ? -height * 0.19 : height * 0.08), boxH = height * 0.14;
        const label = foreignText(event.label, boxX, labelY, boxWidth, height * 0.07, Math.min(width, height) * 0.028, ink, 600, "center");
        const detail = event.detail ? foreignText(event.detail, boxX, labelY + height * 0.065, boxWidth, height * 0.065, Math.min(width, height) * 0.017, muted, 500, "center") : "";
        const dot = `<circle id="motion-timeline-dot-${i}" cx="${x}" cy="${lineY}" r="${Math.min(width, height) * 0.022}" fill="${a}" opacity="0.2"/>`;
        return `${dot}${important(`event-${i + 1}`, boxX, labelY, boxWidth, boxH, label + detail)}`;
      }).join("");
      return `${title}${line}${events}`;
    }
    case "progress-gauge": {
      const radius = Math.min(width, height) * 0.2, circumference = Math.PI * 2 * radius, cx = content.center, cy = height * 0.47;
      const gauge = important("gauge", cx - radius - 20, cy - radius - 20, (radius + 20) * 2, (radius + 20) * 2,
        `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${surface}" stroke-width="${Math.min(width, height) * 0.035}"/>`+
        `<circle id="motion-gauge-arc" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${p}" stroke-width="${Math.min(width, height) * 0.035}" stroke-linecap="round" stroke-dasharray="0 ${circumference}" transform="rotate(-90 ${cx} ${cy})"/>`+
        `<text id="motion-gauge-value" x="${cx}" y="${cy + Math.min(width, height) * 0.035}" fill="${ink}" font-size="${Math.min(width, height) * 0.085}" font-weight="700" text-anchor="middle">0${escapeXml(c.suffix)}</text>`, `text-anchor="middle"`);
      return `${gauge}${labelMarkup(c, width, height, c.label, cy + radius * 1.52, Math.min(width, height) * 0.04)}`;
    }
    case "kinetic-text-reveal": {
      const boxX = pad, boxY = height * 0.25, boxW = contentWidth, boxH = height * 0.5;
      const words = c.text.trim().split(/\s+/), maxChars = Math.max(12, Math.floor(boxW / (Math.min(width, height) * 0.027 * 0.56)));
      const lines = []; let line = "";
      for (const word of words) {
        if (line && line.length + 1 + word.length > maxChars) { lines.push(line); line = ""; }
        line += `${line ? " " : ""}${word}`;
      }
      if (line) lines.push(line);
      const fontSize = Math.max(18, Math.min(Math.min(width, height) * 0.07, boxH * 0.72 / Math.max(1, lines.length)));
      let revealCount = 0;
      const lineMarkup = lines.map((value, i) => {
        if (c.revealBy === "line") return `<div class="motion-reveal-unit" data-motion-reveal="${revealCount++}" style="width:100%;text-align:center">${escapeXml(value)}</div>`;
        const chunks = value.split(/\s+/).map((word) => `<span class="motion-reveal-unit" data-motion-reveal="${revealCount++}">${escapeXml(word)}</span>`).join(" ");
        return `<div class="motion-reveal-line" style="width:100%;display:flex;flex-wrap:wrap;justify-content:center;column-gap:.28em">${chunks}</div>`;
      }).join("");
      const content = c.revealBy === "block" ? `<div id="motion-reveal-block" style="opacity:0;width:100%;text-align:center">${lines.map(escapeXml).join(" ")}</div>` : lineMarkup;
      const body = `<foreignObject x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}"><div xmlns="http://www.w3.org/1999/xhtml" id="motion-reveal-root" style="width:100%;height:100%;display:flex;align-content:center;align-items:center;justify-content:center;flex-wrap:wrap;overflow:hidden;overflow-wrap:anywhere;color:${ink};font:700 ${fontSize}px/1.18 system-ui,sans-serif">${content}</div></foreignObject>`;
      return important("kinetic-text", boxX, boxY, boxW, boxH, body, `data-motion-reveal-count="${revealCount}"`);
    }
    case "image-reveal": {
      const x = pad, y = height * 0.2, w = contentWidth, h = height * 0.6, clip = `motion-image-clip-${escapeXml(c.instanceId)}`;
      const body = `<defs><clipPath id="${clip}"><rect id="motion-image-mask" x="${x}" y="${y}" width="0" height="${h}"/></clipPath></defs>`+
        `<image id="motion-image" href="${escapeXml(c.src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})" aria-label="${escapeXml(c.alt)}"/>`;
      return important("image", x, y, w, h, body, `data-motion-alt="${escapeXml(c.alt)}"`);
    }
    case "data-callout": {
      const innerPad = contentWidth * 0.06;
      const box = `<rect x="${pad}" y="${height * 0.25}" width="${contentWidth}" height="${height * 0.5}" rx="${Math.min(width, height) * 0.04}" fill="${surface}"/>`;
      const label = foreignText(c.label, pad + innerPad, height * 0.33, contentWidth - innerPad * 2, height * 0.08, Math.min(width, height) * 0.035, muted, 600, "center");
      const value = foreignText(c.value, pad + innerPad, height * 0.41, contentWidth - innerPad * 2, height * 0.2, Math.min(width, height) * 0.11, ink, 700, "center");
      const detail = c.detail ? foreignText(c.detail, pad + innerPad, height * 0.62, contentWidth - innerPad * 2, height * 0.08, Math.min(width, height) * 0.026, muted, 500, "center") : "";
      return important("callout", pad, height * 0.25, contentWidth, height * 0.5, `${box}${label}${value}${detail}`, enterAttrs(0.15));
    }
    default: throw new Error(`Componente sem renderizador: ${c.component}`);
  }
}

export function componentSize(aspectRatio = "9:16") {
  const ratio = String(aspectRatio).match(/^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/);
  if (!ratio) fail("aspectRatio", "use a proporção L:A");
  return dimensions(aspectRatio);
}

export function generateComponentHtml(input) {
  const config = validateComponentConfig(input);
  const { width, height } = dimensions(config.aspectRatio);
  const body = markupFor(config, width, height);
  const metadata = {
    componentId: config.component,
    instanceId: config.instanceId,
    version: 1,
    duration: config.duration,
    fps: config.fps,
    aspectRatio: config.aspectRatio,
    transparent: config.transparent,
    width,
    height,
    parameters: config,
    provenance: specs[config.component].provenance,
  };
  const allImportant = body.includes("data-motion-important=");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(config.component)}</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100vw;height:100vh;font-family:system-ui,sans-serif}.motion-reveal-unit{opacity:0}.motion-reveal-line{width:100%}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(config.component)}" data-component-id="${escapeXml(config.component)}" data-instance-id="${escapeXml(config.instanceId)}" data-motion-important-count="${allImportant ? 1 : 0}">${background(config, width, height)}${body}</svg><script>window.__MOTION_COMPONENT__=${jsonForScript(metadata)};window.__MOTION_READY__=(async()=>{await document.fonts.ready;const image=document.querySelector('#motion-image');if(image){const preload=new Image();preload.src=image.getAttribute('href');try{await preload.decode()}catch{throw new Error('Asset de imagem não carregou: '+preload.src)}}return true})();window.__onFrame__=async(M)=>{await window.__MOTION_READY__;const d=${config.duration};const t=Math.min(d,Math.max(0,Number(M.time??(M.frame||0)/(M.fps||${config.fps}))));const p=Math.min(1,t/d);const outCubic=1-Math.pow(1-p,3);for(const el of document.querySelectorAll('[data-motion-enter]')){const q=Math.min(1,Math.max(0,(t-Number(el.dataset.motionEnter))/0.65));const eased=1-Math.pow(1-q,3);el.setAttribute('opacity',String(eased));el.setAttribute('transform','translate('+((1-eased)*Number(el.dataset.motionEnterX||0))+','+((1-eased)*Number(el.dataset.motionEnterY||0))+')')} ${frameLogic(config)}window.__MOTION_STATE__={frame:M.frame,time:t,progress:p,instanceId:${jsonForScript(config.instanceId)}}};window.__onFrame__({frame:0,time:0,fps:${config.fps},seed:1});</script></body></html>`;
}

function frameLogic(c) {
  if (c.component === "animated-counter") return `const v=${c.from}+(${c.value}-${c.from})*outCubic;const counter=document.querySelector('#motion-counter-value');if(counter)counter.textContent=${jsonForScript(c.prefix)}+v.toFixed(${c.decimals})+${jsonForScript(c.suffix)};`;
  if (c.component === "animated-ranking") { const { width } = dimensions(c.aspectRatio); return c.items.map((item, i) => `const r${i}=document.querySelector('#motion-rank-bar-${i}');if(r${i})r${i}.setAttribute('width',String(${Math.max(0, Math.min(1, item.value / c.max))}*${Math.round(width * 0.48)}*Math.min(1,Math.max(0,(t-${0.25 + i * 0.16})/0.65))));`).join(""); }
  if (c.component === "comparison-panel") return c.items.map((item, i) => `const b${i}=document.querySelector('#motion-comparison-bar-${i}');if(b${i})b${i}.setAttribute('width',String(${Math.max(0, Math.min(1, item.value / c.max))}*${Math.round(dimensions(c.aspectRatio).width * 0.77)}*outCubic));`).join("");
  if (c.component === "timeline-sequence") {
    const { width } = dimensions(c.aspectRatio), content = contentFrame(c, width), left = content.x + width * 0.13, right = content.right - width * 0.13;
    return `const l=document.querySelector('#motion-timeline-progress');if(l)l.setAttribute('x2',String(${left}+(${right - left})*p));`+c.events.map((event,i)=>`const dot${i}=document.querySelector('#motion-timeline-dot-${i}');if(dot${i})dot${i}.setAttribute('opacity',t>=${event.time}?'1':'0.2');`).join("");
  }
  if (c.component === "progress-gauge") {
    const { width, height } = dimensions(c.aspectRatio), radius = Math.min(width,height)*0.2, circumference = Math.PI*2*radius;
    return `const gv=${c.value}*outCubic;const ga=document.querySelector('#motion-gauge-arc');if(ga)ga.setAttribute('stroke-dasharray',String(${circumference}*gv/${c.max})+' '+String(${circumference}));const gt=document.querySelector('#motion-gauge-value');if(gt)gt.textContent=String(Math.round(gv))+${jsonForScript(c.suffix)};`;
  }
  if (c.component === "kinetic-text-reveal") {
    if (c.revealBy === "block") return `const rb=document.querySelector('#motion-reveal-block');if(rb)rb.style.opacity=String(outCubic);`;
    const count = c.text.trim().split(/\s+/).length;
    return `const reveal=document.querySelectorAll('.motion-reveal-unit');const n=${count};reveal.forEach((el,i)=>{const q=Math.min(1,Math.max(0,(p*n-i*0.7)*2));el.style.opacity=String(q)});`;
  }
  if (c.component === "image-reveal") {
    const { width } = dimensions(c.aspectRatio), w = contentFrame(c, width).width;
    return `const m=document.querySelector('#motion-image-mask');if(m)m.setAttribute('width',String(${w}*outCubic));const im=document.querySelector('#motion-image');if(im)im.setAttribute('transform','scale('+String(1.08-0.08*outCubic)+')');`;
  }
  if (c.component === "data-callout") return `const callout=document.querySelector('[data-motion-important="callout"]');if(callout)callout.setAttribute('opacity',String(outCubic));`;
  return "";
}
