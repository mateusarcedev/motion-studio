import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "node:http";

const OUT_DIR = path.resolve("projects/carga-01/models");
await mkdir(OUT_DIR, { recursive: true });

async function resolveChrome() {
  const cacheBase = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const { readdir, stat } = await import("node:fs/promises");
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

const executablePath = await resolveChrome();
console.log("Resolving Chrome:", executablePath);

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});

const page = await browser.newPage();

// Minimal HTML with Three.js and GLTFExporter
const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
<canvas id="c"></canvas>
<script type="module">
  import * as THREE from 'three';
  import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

  window.THREE = THREE;
  window.GLTFExporter = GLTFExporter;
  window.exportModel = function(model) {
    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        model,
        (result) => {
          // result is ArrayBuffer
          const bytes = new Uint8Array(result);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i += 8192) {
            const chunk = bytes.subarray(i, Math.min(i + 8192, len));
            binary += String.fromCharCode.apply(null, chunk);
          }
          resolve(btoa(binary));
        },
        (error) => reject(error),
        { binary: true }
      );
    });
  };

  // Helper to create stencil texture for container
  window.createContainerTexture = function() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base industrial amber
    ctx.fillStyle = '#E86500';
    ctx.fillRect(0, 0, 2048, 1024);

    // Weathering & subtle corrugated rib shading
    for (let x = 0; x < 2048; x += 32) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(x, 0, 8, 1024);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x + 16, 0, 8, 1024);
    }

    // Dirt & salt marks near top and bottom
    ctx.fillStyle = 'rgba(20, 20, 20, 0.15)';
    ctx.fillRect(0, 0, 2048, 60);
    ctx.fillRect(0, 960, 2048, 64);

    // Hazard stripes band (black & amber)
    const stripeW = 30;
    ctx.save();
    ctx.rect(120, 100, 480, 40);
    ctx.clip();
    for (let sx = 0; sx < 800; sx += stripeW * 2) {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(sx, 100);
      ctx.lineTo(sx + stripeW, 100);
      ctx.lineTo(sx + stripeW - 20, 140);
      ctx.lineTo(sx - 20, 140);
      ctx.fill();
    }
    ctx.restore();

    // Main Stencil Text - Industrial White
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 110px sans-serif';
    ctx.fillText('TRAVESSIA', 140, 240);

    ctx.font = 'bold 52px monospace';
    ctx.fillText('TRV-01-A  ·  45G1 HIGH CUBE', 140, 330);

    // Technical Data Box
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(140, 390, 850, 440);

    ctx.font = '34px monospace';
    ctx.fillText('MAX GROSS :  32,500 KG   71,650 LBS', 170, 460);
    ctx.fillText('TARE      :   3,820 KG    8,420 LBS', 170, 530);
    ctx.fillText('NET       :  28,680 KG   63,230 LBS', 170, 600);
    ctx.fillText('CU. CAP.  :    76.2 CU.M 2,690 CU.FT', 170, 670);
    ctx.fillText('OPERATOR  :  MOTION STUDIO · TRAVESSIA', 170, 740);
    ctx.fillText('STATUS    :  DO CAIS AO DESTINO', 170, 800);

    // Seal & QR / Barcode aesthetic
    ctx.fillStyle = '#111';
    ctx.fillRect(1150, 390, 640, 340);
    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('VERIFIED GROSS MASS [VGM]', 1180, 450);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('PORT TERMINAL SANTOS (BR)', 1180, 510);
    ctx.fillText('EXPEDITION: #TRV-2026-EXP', 1180, 570);

    // Faux Barcode
    for (let bx = 1180; bx < 1700; bx += Math.floor(Math.random() * 12 + 6)) {
      ctx.fillRect(bx, 640, Math.floor(Math.random() * 6 + 3), 70);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  window.isReady = true;
</script>
</body>
</html>
`;

await page.setContent(html);
await page.waitForFunction(() => window.isReady === true, { timeout: 30000 });
console.log("Playwright Three.js environment ready.");

// ==========================================
// 1. GENERATE CARGA CONTAINER GLB
// ==========================================
console.log("Generating carga-container.glb...");
const containerBase64 = await page.evaluate(async () => {
  const THREE = window.THREE;
  const root = new THREE.Group();
  root.name = "CargaContainer";

  // Dimensions: 40ft container ~ 12.2m L x 2.44m W x 2.9m H
  const L = 12.0, W = 2.44, H = 2.9;

  // Materials
  const tex = window.createContainerTexture();
  const matAmber = new THREE.MeshStandardMaterial({
    color: 0xE86500,
    map: tex,
    roughness: 0.45,
    metalness: 0.25
  });

  const matSteelNavy = new THREE.MeshStandardMaterial({
    color: 0x1E293B,
    roughness: 0.5,
    metalness: 0.7
  });

  const matDarkMetal = new THREE.MeshStandardMaterial({
    color: 0x0F172A,
    roughness: 0.6,
    metalness: 0.8
  });

  const matCorner = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.8
  });

  // Main container body box
  const bodyGeo = new THREE.BoxGeometry(L, H, W);
  const bodyMesh = new THREE.Mesh(bodyGeo, matAmber);
  bodyMesh.position.y = H / 2;
  root.add(bodyMesh);

  // Structural edge frames (steel perimeter rails)
  const railThick = 0.12;
  // Top/bottom rails
  const topRailGeo = new THREE.BoxGeometry(L + 0.04, railThick, W + 0.04);
  const topRail = new THREE.Mesh(topRailGeo, matSteelNavy);
  topRail.position.y = H;
  root.add(topRail);

  const botRail = new THREE.Mesh(topRailGeo, matSteelNavy);
  botRail.position.y = railThick / 2;
  root.add(botRail);

  // Corrugation ribs along both long sides (X axis)
  const ribCount = 36;
  const ribW = 0.12, ribH = H - 0.2, ribD = 0.05;
  const ribGeo = new THREE.BoxGeometry(ribW, ribH, ribD);
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0xD05500,
    roughness: 0.5,
    metalness: 0.3
  });

  for (let i = 0; i < ribCount; i++) {
    const x = -L / 2 + 0.4 + (i * (L - 0.8) / (ribCount - 1));
    // Front side
    const r1 = new THREE.Mesh(ribGeo, ribMat);
    r1.position.set(x, H / 2, W / 2 + 0.02);
    root.add(r1);

    // Back side
    const r2 = new THREE.Mesh(ribGeo, ribMat);
    r2.position.set(x, H / 2, -W / 2 - 0.02);
    root.add(r2);
  }

  // 8 Corner Castings (ISO Twistlock blocks)
  const cornerSize = 0.28;
  const cornerGeo = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
  const holeGeo = new THREE.CylinderGeometry(0.06, 0.06, cornerSize + 0.02, 12);
  holeGeo.rotateZ(Math.PI / 2);

  const xs = [-L / 2, L / 2];
  const ys = [cornerSize / 2, H - cornerSize / 2];
  const zs = [-W / 2, W / 2];

  xs.forEach(x => {
    ys.forEach(y => {
      zs.forEach(z => {
        const c = new THREE.Mesh(cornerGeo, matCorner);
        c.position.set(x, y, z);
        root.add(c);
      });
    });
  });

  // End door locking bars & levers on X = L/2 end
  const barGeo = new THREE.CylinderGeometry(0.03, 0.03, H - 0.3, 12);
  const doorEnd = L / 2 + 0.02;
  const barMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.2 });

  [-0.6, -0.2, 0.2, 0.6].forEach(bz => {
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(doorEnd, H / 2, bz);
    root.add(bar);

    // Handle
    const handleGeo = new THREE.BoxGeometry(0.08, 0.04, 0.25);
    const handle = new THREE.Mesh(handleGeo, barMat);
    handle.position.set(doorEnd + 0.05, H / 2 - 0.2, bz + 0.1);
    root.add(handle);
  });

  return await window.exportModel(root);
});

await writeFile(path.join(OUT_DIR, "carga-container.glb"), Buffer.from(containerBase64, "base64"));
console.log("✓ carga-container.glb exported successfully.");

// ==========================================
// 2. GENERATE CARGA TRUCK GLB
// ==========================================
console.log("Generating carga-truck.glb...");
const truckBase64 = await page.evaluate(async () => {
  const THREE = window.THREE;
  const root = new THREE.Group();
  root.name = "CargaTruck";

  // Materials
  const matCab = new THREE.MeshStandardMaterial({
    color: 0x243E63, // Industrial sapphire navy
    metalness: 0.6,
    roughness: 0.25
  });
  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xCBD5E1,
    metalness: 0.95,
    roughness: 0.1
  });
  const matRubber = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.9,
    metalness: 0.05
  });
  const matChassis = new THREE.MeshStandardMaterial({
    color: 0x1E293B,
    roughness: 0.7,
    metalness: 0.6
  });
  const matWindshield = new THREE.MeshPhysicalMaterial({
    color: 0x1E3A8A,
    transmission: 0.85,
    roughness: 0.05,
    metalness: 0.1,
    thickness: 0.1
  });
  const matHeadlightCyan = new THREE.MeshStandardMaterial({
    color: 0x00F0FF,
    emissive: 0x00F0FF,
    emissiveIntensity: 3.5
  });
  const matTaillightRed = new THREE.MeshStandardMaterial({
    color: 0xEF4444,
    emissive: 0xEF4444,
    emissiveIntensity: 2.8
  });
  const matAmberBeacon = new THREE.MeshStandardMaterial({
    color: 0xF59E0B,
    emissive: 0xF59E0B,
    emissiveIntensity: 2.5
  });

  // Long flatbed chassis (trailer + tractor)
  const chassisL = 16.5;
  const chassisW = 2.4;
  const chassisH = 0.35;
  const chassisY = 1.1;

  const chassisGeo = new THREE.BoxGeometry(chassisL, chassisH, chassisW);
  const chassisMesh = new THREE.Mesh(chassisGeo, matChassis);
  chassisMesh.position.set(0, chassisY, 0);
  root.add(chassisMesh);

  // Cab (front of truck at positive X)
  const cabL = 3.6, cabW = 2.4, cabH = 2.9;
  const cabX = chassisL / 2 - cabL / 2;
  const cabY = chassisY + chassisH / 2 + cabH / 2;

  const cabGeo = new THREE.BoxGeometry(cabL, cabH, cabW);
  const cabMesh = new THREE.Mesh(cabGeo, matCab);
  cabMesh.position.set(cabX, cabY, 0);
  root.add(cabMesh);

  // Aerodynamic roof fairing
  const fairingGeo = new THREE.CylinderGeometry(0.2, cabW / 2, 0.8, 4);
  fairingGeo.rotateY(Math.PI / 4);
  const fairing = new THREE.Mesh(fairingGeo, matCab);
  fairing.position.set(cabX - 0.4, cabY + cabH / 2 + 0.4, 0);
  fairing.scale.set(cabL / 2, 1, 1);
  root.add(fairing);

  // Windshield
  const wsGeo = new THREE.BoxGeometry(0.1, 1.1, cabW - 0.4);
  const ws = new THREE.Mesh(wsGeo, matWindshield);
  ws.position.set(cabX + cabL / 2 + 0.02, cabY + 0.4, 0);
  root.add(ws);

  // Front Grille & Bumper
  const grilleGeo = new THREE.BoxGeometry(0.15, 0.9, cabW - 0.5);
  const grille = new THREE.Mesh(grilleGeo, matChrome);
  grille.position.set(cabX + cabL / 2 + 0.05, cabY - 0.6, 0);
  root.add(grille);

  const bumperGeo = new THREE.BoxGeometry(0.4, 0.5, cabW + 0.2);
  const bumper = new THREE.Mesh(bumperGeo, matChassis);
  bumper.position.set(cabX + cabL / 2 + 0.1, chassisY, 0);
  root.add(bumper);

  // Headlights (Cyan LED)
  const hlGeo = new THREE.BoxGeometry(0.12, 0.25, 0.4);
  const hlRight = new THREE.Mesh(hlGeo, matHeadlightCyan);
  hlRight.position.set(cabX + cabL / 2 + 0.15, cabY - 0.6, cabW / 2 - 0.35);
  root.add(hlRight);

  const hlLeft = new THREE.Mesh(hlGeo, matHeadlightCyan);
  hlLeft.position.set(cabX + cabL / 2 + 0.15, cabY - 0.6, -cabW / 2 + 0.35);
  root.add(hlLeft);

  // Roof Warning Beacons (Amber)
  const beaconGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 12);
  const b1 = new THREE.Mesh(beaconGeo, matAmberBeacon);
  b1.position.set(cabX + 0.5, cabY + cabH / 2 + 0.1, cabW / 2 - 0.3);
  root.add(b1);
  const b2 = new THREE.Mesh(beaconGeo, matAmberBeacon);
  b2.position.set(cabX + 0.5, cabY + cabH / 2 + 0.1, -cabW / 2 + 0.3);
  root.add(b2);

  // Exhaust stacks
  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 12);
  const ex1 = new THREE.Mesh(exhaustGeo, matChrome);
  ex1.position.set(cabX - cabL / 2 - 0.15, cabY + 0.4, cabW / 2 - 0.2);
  root.add(ex1);
  const ex2 = new THREE.Mesh(exhaustGeo, matChrome);
  ex2.position.set(cabX - cabL / 2 - 0.15, cabY + 0.4, -cabW / 2 + 0.2);
  root.add(ex2);

  // Fuel tanks
  const tankGeo = new THREE.CylinderGeometry(0.4, 0.4, 2.2, 16);
  tankGeo.rotateZ(Math.PI / 2);
  const tank1 = new THREE.Mesh(tankGeo, matChrome);
  tank1.position.set(cabX - cabL / 2 - 1.5, chassisY - 0.2, cabW / 2 + 0.1);
  root.add(tank1);
  const tank2 = new THREE.Mesh(tankGeo, matChrome);
  tank2.position.set(cabX - cabL / 2 - 1.5, chassisY - 0.2, -cabW / 2 - 0.1);
  root.add(tank2);

  // Wheels function
  const wheelR = 0.55;
  const wheelW = 0.35;
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20);
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelW + 0.02, 16);
  rimGeo.rotateX(Math.PI / 2);

  function createWheel(x, z) {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, matRubber);
    const rim = new THREE.Mesh(rimGeo, matChrome);
    wGroup.add(tire);
    wGroup.add(rim);
    wGroup.position.set(x, wheelR, z);
    return wGroup;
  }

  // Steer axle (front)
  root.add(createWheel(cabX + 1.2, cabW / 2 + 0.15));
  root.add(createWheel(cabX + 1.2, -cabW / 2 - 0.15));

  // Drive axles (tractor rear)
  [-0.6, -2.0].forEach(offset => {
    const x = cabX - cabL / 2 + offset;
    root.add(createWheel(x, cabW / 2 + 0.15));
    root.add(createWheel(x, -cabW / 2 - 0.15));
  });

  // Trailer triple axles (rear of chassis)
  [-chassisL / 2 + 1.2, -chassisL / 2 + 2.6, -chassisL / 2 + 4.0].forEach(x => {
    root.add(createWheel(x, cabW / 2 + 0.15));
    root.add(createWheel(x, -cabW / 2 - 0.15));
  });

  // Rear trailer bumper and taillights
  const rearBumperGeo = new THREE.BoxGeometry(0.3, 0.4, chassisW);
  const rearBumper = new THREE.Mesh(rearBumperGeo, matChassis);
  rearBumper.position.set(-chassisL / 2, chassisY - 0.1, 0);
  root.add(rearBumper);

  const tlGeo = new THREE.BoxGeometry(0.1, 0.2, 0.5);
  const tlRight = new THREE.Mesh(tlGeo, matTaillightRed);
  tlRight.position.set(-chassisL / 2 - 0.15, chassisY - 0.1, chassisW / 2 - 0.4);
  root.add(tlRight);
  const tlLeft = new THREE.Mesh(tlGeo, matTaillightRed);
  tlLeft.position.set(-chassisL / 2 - 0.15, chassisY - 0.1, -chassisW / 2 + 0.4);
  root.add(tlLeft);

  return await window.exportModel(root);
});

await writeFile(path.join(OUT_DIR, "carga-truck.glb"), Buffer.from(truckBase64, "base64"));
console.log("✓ carga-truck.glb exported successfully.");

// ==========================================
// 3. GENERATE CARGA CRANE & SHIP GLBS
// ==========================================
console.log("Generating carga-crane.glb...");
const craneBase64 = await page.evaluate(async () => {
  const THREE = window.THREE;
  const root = new THREE.Group();
  root.name = "CargaCraneSTS";

  const matSteel = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 });
  const matLattice = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.5, metalness: 0.8 });
  const matSpreader = new THREE.MeshStandardMaterial({ color: 0xFF7A00, roughness: 0.35, metalness: 0.5 });
  const matBeacon = new THREE.MeshStandardMaterial({ color: 0xF59E0B, emissive: 0xF59E0B, emissiveIntensity: 3.0 });
  const matCyan = new THREE.MeshStandardMaterial({ color: 0x00F0FF, emissive: 0x00F0FF, emissiveIntensity: 3.0 });

  // Main vertical portal legs
  const legH = 34;
  const legW = 1.6;
  const legGeo = new THREE.BoxGeometry(legW, legH, legW);

  const legPositions = [
    [-8, legH / 2, -10],
    [-8, legH / 2, 10],
    [8, legH / 2, -10],
    [8, legH / 2, 10],
  ];

  legPositions.forEach(p => {
    const leg = new THREE.Mesh(legGeo, matSteel);
    leg.position.set(...p);
    root.add(leg);
  });

  // Cross beams (portal frame)
  const beamXGeo = new THREE.BoxGeometry(18, 2, 2);
  const b1 = new THREE.Mesh(beamXGeo, matSteel);
  b1.position.set(0, legH - 2, -10);
  root.add(b1);
  const b2 = new THREE.Mesh(beamXGeo, matSteel);
  b2.position.set(0, legH - 2, 10);
  root.add(b2);

  // Horizontal Boom (extends over water)
  const boomL = 60;
  const boomGeo = new THREE.BoxGeometry(boomL, 3.2, 4);
  const boom = new THREE.Mesh(boomGeo, matSteel);
  boom.position.set(-10, legH + 2, 0);
  root.add(boom);

  // Operator cab
  const cabGeo = new THREE.BoxGeometry(3, 2.5, 3);
  const cab = new THREE.Mesh(cabGeo, matLattice);
  cab.position.set(-6, legH - 1, 0);
  root.add(cab);

  // Floodlights on boom
  [-25, -15, -5, 5].forEach(bx => {
    const flGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const fl = new THREE.Mesh(flGeo, matCyan);
    fl.position.set(bx, legH + 0.2, 2.2);
    root.add(fl);
  });

  // Spreader rig suspended
  const spreaderGeo = new THREE.BoxGeometry(12.2, 0.8, 2.6);
  const spreader = new THREE.Mesh(spreaderGeo, matSpreader);
  spreader.position.set(0, 16, 0);
  root.add(spreader);

  // Cables
  const cableMat = new THREE.LineBasicMaterial({ color: 0x94A3B8 });
  const cableGeo = new THREE.CylinderGeometry(0.04, 0.04, 18, 6);
  [-5, 5].forEach(cx => {
    [-1, 1].forEach(cz => {
      const c = new THREE.Mesh(cableGeo, matSteel);
      c.position.set(cx, 25, cz);
      root.add(c);
    });
  });

  return await window.exportModel(root);
});

await writeFile(path.join(OUT_DIR, "carga-crane.glb"), Buffer.from(craneBase64, "base64"));
console.log("✓ carga-crane.glb exported successfully.");

console.log("Generating carga-ship.glb...");
const shipBase64 = await page.evaluate(async () => {
  const THREE = window.THREE;
  const root = new THREE.Group();
  root.name = "CargaShip";

  const matHull = new THREE.MeshStandardMaterial({ color: 0x1E2B3E, roughness: 0.5, metalness: 0.4 });
  const matWaterline = new THREE.MeshStandardMaterial({ color: 0x991B1B, roughness: 0.5, metalness: 0.2 });
  const matBridge = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.3, metalness: 0.1 });
  const matMast = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
  const matNavLight = new THREE.MeshStandardMaterial({ color: 0x00F0FF, emissive: 0x00F0FF, emissiveIntensity: 3 });

  // Main Hull
  const hullL = 100, hullW = 20, hullH = 12;
  const hullGeo = new THREE.BoxGeometry(hullL, hullH, hullW);
  const hull = new THREE.Mesh(hullGeo, matHull);
  hull.position.set(0, hullH / 2, 0);
  root.add(hull);

  // Red waterline base
  const wlGeo = new THREE.BoxGeometry(hullL + 0.2, 2.5, hullW + 0.2);
  const wl = new THREE.Mesh(wlGeo, matWaterline);
  wl.position.set(0, 1.25, 0);
  root.add(wl);

  // Bow wedge (tapered front)
  const bowGeo = new THREE.CylinderGeometry(0.1, hullW / 2, 20, 3);
  bowGeo.rotateZ(Math.PI / 2);
  const bow = new THREE.Mesh(bowGeo, matHull);
  bow.position.set(hullL / 2 + 10, hullH / 2, 0);
  root.add(bow);

  // Stern bridge superstructure
  const bridgeGeo = new THREE.BoxGeometry(16, 14, 16);
  const bridge = new THREE.Mesh(bridgeGeo, matBridge);
  bridge.position.set(-hullL / 2 + 14, hullH + 7, 0);
  root.add(bridge);

  // Radar mast & Nav light
  const mastGeo = new THREE.CylinderGeometry(0.2, 0.4, 12, 8);
  const mast = new THREE.Mesh(mastGeo, matMast);
  mast.position.set(-hullL / 2 + 14, hullH + 18, 0);
  root.add(mast);

  const nlGeo = new THREE.SphereGeometry(0.4, 8, 8);
  const nl = new THREE.Mesh(nlGeo, matNavLight);
  nl.position.set(-hullL / 2 + 14, hullH + 24, 0);
  root.add(nl);

  // Container stacks on deck
  const colors = [0x1E3A8A, 0x047857, 0xB45309, 0x475569, 0x1D4ED8];
  for (let bx = -25; bx < 35; bx += 14) {
    for (let bz = -6; bz <= 6; bz += 3.2) {
      for (let by = 0; by < 3; by++) {
        const cMat = new THREE.MeshStandardMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          roughness: 0.5,
          metalness: 0.3
        });
        const cGeo = new THREE.BoxGeometry(12, 2.6, 2.6);
        const cMesh = new THREE.Mesh(cGeo, cMat);
        cMesh.position.set(bx, hullH + 1.3 + by * 2.6, bz);
        root.add(cMesh);
      }
    }
  }

  return await window.exportModel(root);
});

await writeFile(path.join(OUT_DIR, "carga-ship.glb"), Buffer.from(shipBase64, "base64"));
console.log("✓ carga-ship.glb exported successfully.");

await browser.close();
console.log("All 3D models generated and verified in", OUT_DIR);
