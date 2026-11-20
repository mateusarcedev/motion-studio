/**
 * MOTION Core — lib/dom-checks.mjs
 * In-page visual-risk heuristics (run with `--qa-visual`): clipped text, insufficient contrast,
 * tiny text, text overload. They flag RISK for the Critic — they are not proof of (poor) design.
 */
export async function collectDomChecks(page, { minTextRatio = 0.016, maxWords, context = "graphic", safeZone = null } = {}) {
  const resolvedMaxWords = maxWords ?? (context === "web" ? 180 : 45);
  return page.evaluate(({ minTextRatio, maxWords, context, safeZone }) => {
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
    const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
    const visible = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false; } return true; };
    const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : ""}`;

    const clipped = [], lowContrast = [], tiny = [], secondaryTiny = [], overlap = [], outsideSafeZone = [];
    let unknownBackground = 0, words = 0, checked = 0;
    const minPx = context === "web" ? 14 : Math.max(12, Math.min(vw, vh) * minTextRatio);
    const safe = safeZone ? {
      top: Number(safeZone.top ?? 0), right: Number(safeZone.right ?? 0),
      bottom: Number(safeZone.bottom ?? 0), left: Number(safeZone.left ?? 0),
    } : null;
    for (const el of document.querySelectorAll("body *")) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
      if (!own || !visible(el)) continue;
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      checked++; words += own.split(/\s+/).length;
      const cut = (style.overflow !== "visible" || style.overflowX !== "visible") && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      const outside = rect.left < -1 || rect.top < -1 || rect.right > vw + 1 || rect.bottom > vh + 1;
      if ((cut || outside) && !el.closest("[data-bleed]")) clipped.push({ el: label(el), text: own.slice(0, 40), reason: cut ? "conteúdo excede a caixa" : "fora do quadro" });
      const size = parseFloat(style.fontSize);
      if (size < minPx) tiny.push({ el: label(el), text: own.slice(0, 40), fontSize: size, minimum: Math.round(minPx) });
      const isSecondary = el.hasAttribute("data-motion-secondary") || el.getAttribute("data-motion-role") === "secondary" || el.matches("small,figcaption,.caption,.eyebrow,.kicker,.muted");
      const secondaryMin = context === "web" ? (el.matches("small,figcaption,.caption") ? 12 : 14) : Math.max(16, Math.min(vw, vh) * 0.018);
      if (isSecondary && size < secondaryMin) secondaryTiny.push({ el: label(el), text: own.slice(0, 40), fontSize: size, minimum: Math.round(secondaryMin) });
      if (safe && (rect.left < safe.left || rect.right > vw - safe.right || rect.top < safe.top || rect.bottom > vh - safe.bottom)) {
        outsideSafeZone.push({ el: label(el), text: own.slice(0, 40), bounds: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) } });
      }
      // background: first ancestor with an opaque-ish color; gradients/images make it unknowable
      let fg = parse(style.color), bg = null, unknown = false;
      const stack = [];
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.backgroundImage && s.backgroundImage !== "none") { unknown = true; break; }
        const c = parse(s.backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; }
      }
      if (unknown) { unknownBackground++; continue; }
      bg = stack.reverse().reduce((acc, c) => over(c, acc), { r: 255, g: 255, b: 255, a: 1 });
      if (!fg) continue;
      const opacity = Number(style.opacity); fg = { ...fg, a: fg.a * (Number.isFinite(opacity) ? opacity : 1) };
      const eff = over(fg, bg), cr = ratio(eff, bg);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (cr < (large ? 3 : 4.5)) lowContrast.push({ el: label(el), text: own.slice(0, 40), ratio: Math.round(cr * 100) / 100, required: large ? 3 : 4.5 });
    }
    const textBoxes = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      return own && visible(el) && !el.closest('[data-motion-overlap="intentional"]');
    });
    for (let i = 0; i < textBoxes.length; i++) for (let j = i + 1; j < textBoxes.length; j++) {
      const a = textBoxes[i], b = textBoxes[j];
      if (a.parentElement !== b.parentElement) continue;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const w = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
      const h = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
      const area = w * h, smaller = Math.min(ar.width * ar.height, br.width * br.height);
      if (smaller > 0 && area / smaller > 0.2) overlap.push({ elements: [label(a), label(b)], texts: [a.textContent.trim().slice(0, 30), b.textContent.trim().slice(0, 30)], ratio: Math.round(area / smaller * 100) / 100 });
    }
    return { textElements: checked, words, maxWords, unknownBackground, clipped: clipped.slice(0, 20), lowContrast: lowContrast.slice(0, 20), tiny: tiny.slice(0, 20), secondaryTiny: secondaryTiny.slice(0, 20), overlap: overlap.slice(0, 20), outsideSafeZone: outsideSafeZone.slice(0, 20), textOverload: words > maxWords };
  }, { minTextRatio, maxWords: resolvedMaxWords, context, safeZone });
}
