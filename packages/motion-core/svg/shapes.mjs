/**
 * MOTION Core — svg/shapes.mjs
 * Deterministic geometric glyphs used as neutral fallback when no icon fits.
 * Same label → same glyph (hash-driven); stroke style matches the icon system.
 */
export function hashString(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const MOTIFS = {
  ring: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  diamond: '<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 8l4 4-4 4-4-4z"/>',
  hex: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="2.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
  nodes: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.2 8.2l2.6 7.6M15.8 8.2l-2.6 7.6M8.5 7h7"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};

export function fallbackGlyph(label, { size = 48, strokeWidth = 2, color = "currentColor" } = {}) {
  const motifs = Object.keys(MOTIFS);
  const motif = motifs[hashString(label) % motifs.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MOTIFS[motif]}</svg>`;
  return { motif, svg };
}
