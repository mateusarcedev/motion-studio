#!/usr/bin/env node
/**
 * QA multi-viewport (web-director gate). Agent-agnostic CLI.
 *
 *   node creative-core/renderers/qa_viewports.mjs <url> <outdir> [--wait=ms] [--canvas=selector] [--ignore=substr,...]
 *
 * Per viewport: full-page + fold screenshots, console/page errors, failed requests,
 * horizontal overflow, small touch targets (mobile), font readiness, WebGL canvas non-empty.
 * Writes <outdir>/report.json and report.md. Exit code 1 if any check fails.
 */
import { chromium } from "playwright-core"
import { mkdir, writeFile, stat } from "node:fs/promises"
import path from "node:path"

export const VIEWPORTS = [
  { name: "mobile-s", width: 360, height: 740, touch: true },
  { name: "mobile", width: 390, height: 844, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "desktop", width: 1280, height: 800, touch: false },
  { name: "wide", width: 1920, height: 1080, touch: false },
]

const args = process.argv.slice(2)
const pos = args.filter((a) => !a.startsWith("--"))
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")))
const [url, outdir] = pos
if (!url || !outdir) {
  console.error("usage: qa_viewports.mjs <url> <outdir> [--wait=ms] [--canvas=selector]")
  process.exit(2)
}
const targetUrl = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")
  ? url
  : `file://${path.resolve(url)}`

const waitMs = Number(opt.wait ?? 4000)
const canvasSel = opt.canvas ?? "canvas"
// --ignore=substr1,substr2 : URLs of host-only resources (e.g. _vercel/insights) not counted as failures
const ignore = (opt.ignore ?? "").split(",").filter(Boolean)
const ignored = (u) => ignore.some((i) => u.includes(i))

async function resolveChrome() {
  if (process.env.CHROME_PATH) {
    try { await stat(process.env.CHROME_PATH); return process.env.CHROME_PATH; } catch {}
  }
  try {
    const pw = await import("playwright-core");
    const ep = pw.chromium.executablePath();
    if (ep) {
      try { await stat(ep); return ep; } catch {}
    }
  } catch {}
  const cacheBase = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(cacheBase);
    for (const ent of entries) {
      if (ent.startsWith("chromium-")) {
        const candidate = path.join(cacheBase, ent, "chrome-linux64", "chrome");
        try { await stat(candidate); return candidate; } catch {}
      }
    }
  } catch {}
  for (const sys of ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
    try { await stat(sys); return sys; } catch {}
  }
  return undefined;
}

async function checkPage(page) {
  return page.evaluate(async (canvasSel) => {
    const de = document.documentElement
    const overflowX = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth
    await document.fonts.ready
    const fonts = [...document.fonts].filter((f) => f.status !== "loaded").map((f) => f.family)
    const small = []
    for (const el of document.querySelectorAll("a,button,input,select,textarea,[role=button]")) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.pointerEvents === "none") continue
      if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    const canvases = []
    for (const c of document.querySelectorAll(canvasSel)) {
      let blank = null
      try {
        const t = document.createElement("canvas")
        t.width = Math.min(c.width, 256); t.height = Math.min(c.height, 256)
        const ctx = t.getContext("2d")
        ctx.drawImage(c, 0, 0, t.width, t.height)
        const d = ctx.getImageData(0, 0, t.width, t.height).data
        const first = [d[0], d[1], d[2], d[3]]
        blank = true
        for (let i = 4; i < d.length; i += 4) {
          if (d[i] !== first[0] || d[i + 1] !== first[1] || d[i + 2] !== first[2] || d[i + 3] !== first[3]) { blank = false; break }
        }
      } catch (e) { blank = null }
      canvases.push({ w: c.width, h: c.height, blank })
    }
    return { overflowX, fonts, small, canvases }
  }, canvasSel)
}

const executablePath = await resolveChrome()
const browser = await chromium.launch({
  executablePath,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
})
await mkdir(outdir, { recursive: true })
const results = []

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  const errors = [], failed = []
  page.on("console", (m) => { if (m.type() === "error" && !/status of (4|5)\d\d/.test(m.text())) errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("response", (r) => { if (r.status() >= 400 && !ignored(r.url())) failed.push(`${r.status()} ${r.url()}`) })
  page.on("requestfailed", (r) => { if (!ignored(r.url())) failed.push(`FAILED ${r.url()}`) })
  await page.goto(targetUrl, { waitUntil: "load" })
  await page.waitForTimeout(waitMs)
  // scroll through so scroll-triggered reveals fire before full-page capture
  await page.evaluate(async () => {
    const step = Math.max(200, innerHeight * 0.6)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 300)) }
    scrollTo(0, 0); await new Promise((r) => setTimeout(r, 900))
  })
  const m = await checkPage(page)
  await page.screenshot({ path: path.join(outdir, `${vp.name}-fold.png`) })
  await page.screenshot({ path: path.join(outdir, `${vp.name}-full.png`), fullPage: true })

  const issues = []
  if (errors.length) issues.push(`console/page errors: ${errors.length} (${errors[0].slice(0, 120)})`)
  if (failed.length) issues.push(`failed requests: ${failed.length} (${failed[0].slice(0, 120)})`)
  if (m.overflowX > 0) issues.push(`horizontal overflow: ${m.overflowX}px`)
  if (m.fonts.length) issues.push(`fonts not loaded: ${m.fonts.join(", ")}`)
  if (vp.touch && m.small.length) issues.push(`touch targets <44px: ${m.small.length} (${m.small.slice(0, 3).join("; ")})`)
  for (const [i, c] of m.canvases.entries()) {
    if (c.blank === true) issues.push(`canvas[${i}] blank`)
    if (c.blank === null) issues.push(`canvas[${i}] unreadable (set preserveDrawingBuffer or screenshot-check)`)
  }
  results.push({ viewport: vp.name, size: `${vp.width}x${vp.height}`, ok: issues.length === 0, issues, metrics: m })
  await ctx.close()
}
await browser.close()

await writeFile(path.join(outdir, "report.json"), JSON.stringify({ url, results }, null, 2))
const md = ["# QA multi-viewport", "", `URL: ${url}`, "", "| viewport | size | result | issues |", "|---|---|---|---|",
  ...results.map((r) => `| ${r.viewport} | ${r.size} | ${r.ok ? "PASS" : "FAIL"} | ${r.issues.join("<br>") || "—"} |`), ""].join("\n")
await writeFile(path.join(outdir, "report.md"), md)
console.log(md)
process.exit(results.every((r) => r.ok) ? 0 : 1)
