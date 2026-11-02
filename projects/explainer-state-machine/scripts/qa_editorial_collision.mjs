import { chromium } from "playwright-core";
import { stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function resolveChrome() {
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
  return "/usr/bin/chromium";
}

const AUDIT_TIMESTAMPS = [
  1.0, 4.0, 6.0,
  10.0, 14.0,
  18.0, 22.0,
  25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 32.0, 34.0,
  38.0, 42.0,
  46.0, 50.0,
  55.0, 59.5
];

async function main() {
  console.log("🛡️  MOTION — Auditoria Reutilizável de Colisão Editorial (Screen vs World Space)");
  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const compPath = path.resolve("projects/explainer-state-machine/composition.html");
  await page.goto(`file://${compPath}`, { waitUntil: "load" });
  await page.waitForTimeout(200);

  const results = [];
  let totalViolations = 0;

  for (const t of AUDIT_TIMESTAMPS) {
    const frame = Math.round(t * 30);
    await page.evaluate((f) => window.__onFrame__(f, 1800, 30), frame);

    const audit = await page.evaluate((currT) => {
      // Evaluate camera and node positions
      const cam = getCamera(currT);
      const cvs = document.getElementById("canvas");
      const ctx = cvs.getContext("2d");

      // Measure editorial text height in Screen Space
      // Base title Y starts at 270, subtitle starts below title
      let titleLines = 1;
      let subLines = 1;

      if (currT < 8.0) {
        // Scene 1
      } else if (currT >= 34.0 && currT < 43.0) {
        subLines = 2; // Subtitle wraps in Scene 5
      } else if (currT >= 52.0) {
        titleLines = 2; // "Máquinas de Estados" wraps
        subLines = 2; // Closing sentence wraps
      }

      const titleBottom = 270 + (titleLines - 1) * 110 + 10;
      const subBottom = titleBottom + 52 + (subLines - 1) * 44 + 10;
      const editorialSafeBottom = subBottom + 30; // 30px protected margin

      // Transformed Node coordinates in Screen Space
      const checkNodes = [NODES.IDLE, NODES.FETCHING, NODES.ERROR, NODES.RESOLVED];
      let nearestTopY = 9999;
      let nearestNode = null;

      for (const n of checkNodes) {
        const screenX = 540 + cam.zoom * (n.x - 540 + cam.x);
        const screenY = 960 + cam.zoom * (n.y - 960 + cam.y);
        const nodeRadius = cam.zoom * (82 + 16); // radius + outer ring
        const topY = screenY - nodeRadius;

        // Check if horizontally within text margins [86, 994]
        if (screenX + nodeRadius >= 86 && screenX - nodeRadius <= 994) {
          if (topY < nearestTopY) {
            nearestTopY = topY;
            nearestNode = n.label;
          }
        }
      }

      const clearance = nearestTopY - editorialSafeBottom;
      const collision = clearance < 0;

      return {
        time: currT.toFixed(1) + "s",
        frame: Math.round(currT * 30),
        camZoom: cam.zoom.toFixed(2),
        camY: cam.y.toFixed(1),
        editorialSafeBottom: Math.round(editorialSafeBottom),
        nearestNode,
        nearestTopY: Math.round(nearestTopY),
        clearance: Math.round(clearance),
        collision
      };
    }, t);

    results.push(audit);
    const statusIcon = audit.collision ? "❌ VIOLAÇÃO" : "✓ PASS";
    if (audit.collision) totalViolations++;

    console.log(
      `  [${statusIcon}] t=${audit.time} (F${audit.frame}) | Cam(z=${audit.camZoom}, y=${audit.camY}px) | ` +
      `SafeBottom=${audit.editorialSafeBottom}px | Node(${audit.nearestNode}) Top=${audit.nearestTopY}px | ` +
      `Clearance=+${audit.clearance}px`
    );
  }

  await browser.close();

  console.log("\n=======================================================");
  if (totalViolations === 0) {
    console.log(`🎉 AUDITORIA EDITORIAL CONCLUÍDA: 0 COLISÕES EM TODOS OS ${results.length} PONTOS!`);
  } else {
    console.error(`❌ AUDITORIA FALHOU: ${totalViolations} colisões detectadas!`);
    process.exit(1);
  }
}

main().catch(console.error);
