#!/usr/bin/env node
/**
 * Exporta a cena procedural Three.js como GLB usando three.js no Node.js
 * Com polyfill para FileReader
 */
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// Polyfill FileReader for Node.js
global.FileReader = class FileReader {
  constructor() {
    this.readyState = 0
    this.result = null
    this.onload = null
    this.onerror = null
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.readyState = 2
      this.result = buf
      if (this.onload) this.onload({ target: this })
      if (this.onloadend) this.onloadend({ target: this })
    }, (e) => { if (this.onerror) this.onerror(e) })
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.readyState = 2
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buf).toString("base64")}`
      if (this.onload) this.onload({ target: this })
      if (this.onloadend) this.onloadend({ target: this })
    }, (e) => { if (this.onerror) this.onerror(e) })
  }
  readAsText(blob) {
    blob.text().then((t) => {
      this.readyState = 2
      this.result = t
      if (this.onload) this.onload({ target: this })
    })
  }
}

const THREE = require("three")
const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js")

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const output = process.argv[2] || "projects/example-3d-product/models/aurora-watch.glb"
  await mkdir(path.dirname(output), { recursive: true })

  const THREE = require("three")
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0c)

  const metalMat = (color, roughness, metalness) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness, metalness
  })

  const materials = {
    case: new THREE.MeshStandardMaterial({ color: 0xb8b8c0, roughness: 0.35, metalness: 1.0 }),
    bezel: new THREE.MeshStandardMaterial({ color: 0xc8c8d0, roughness: 0.15, metalness: 1.0 }),
    crystal: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.02, metalness: 0.0,
      transmission: 0.98, thickness: 0.002, clearcoat: 1.0, clearcoatRoughness: 0.0
    }),
    dial: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.85, metalness: 0.0 }),
    hands: new THREE.MeshStandardMaterial({ color: 0xd5a94e, roughness: 0.2, metalness: 1.0 }),
    crown: new THREE.MeshStandardMaterial({ color: 0xb0b0b8, roughness: 0.3, metalness: 1.0 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd5a94e, roughness: 0.2, metalness: 1.0 }),
  }

  const watchGroup = new THREE.Group()
  scene.add(watchGroup)

  const mm = 0.001
  const D = {
    caseDia: 42 * mm, caseThick: 11 * mm,
    bezelDia: 40 * mm, bezelThick: 2.5 * mm,
    crystalDia: 36 * mm, crystalThick: 2 * mm,
    dialDia: 34 * mm, dialThick: 1 * mm,
    crownDia: 5 * mm, crownLen: 8 * mm,
    strapW: 22 * mm, strapThick: 3 * mm, strapLen: 120 * mm,
    handSecLen: 14 * mm, handMinLen: 11 * mm, handHourLen: 8 * mm,
    handW: 1.2 * mm,
  }

  // Case
  const caseGeo = new THREE.CylinderGeometry(D.caseDia/2, D.caseDia/2, D.caseThick, 64)
  const caseMesh = new THREE.Mesh(caseGeo, materials.case)
  caseMesh.castShadow = true; caseMesh.receiveShadow = true
  watchGroup.add(caseMesh)

  // Bevel edges
  const bevelGeo = new THREE.TorusGeometry(D.caseDia/2, 0.8*mm, 16, 64)
  const bevelMat = materials.bezel
  const topBevel = new THREE.Mesh(bevelGeo, bevelMat)
  topBevel.rotation.x = Math.PI/2
  topBevel.position.y = D.caseThick/2
  watchGroup.add(topBevel)
  const botBevel = topBevel.clone()
  botBevel.position.y = -D.caseThick/2
  watchGroup.add(botBevel)

  // Bezel
  const bezelGeo = new THREE.CylinderGeometry(D.bezelDia/2, D.bezelDia/2, D.bezelThick, 64)
  const bezelMesh = new THREE.Mesh(bezelGeo, materials.bezel)
  bezelMesh.position.y = D.caseThick/2 + D.bezelThick/2
  bezelMesh.castShadow = true
  watchGroup.add(bezelMesh)

  // Crystal
  const crystalGeo = new THREE.CylinderGeometry(D.crystalDia/2, D.crystalDia/2, D.crystalThick, 64)
  const crystalMesh = new THREE.Mesh(crystalGeo, materials.crystal)
  crystalMesh.position.y = D.caseThick/2 + D.bezelThick + D.crystalThick/2
  crystalMesh.castShadow = true; crystalMesh.receiveShadow = true
  watchGroup.add(crystalMesh)

  // Dial
  const dialGeo = new THREE.CylinderGeometry(D.dialDia/2, D.dialDia/2, D.dialThick, 64)
  const dialMesh = new THREE.Mesh(dialGeo, materials.dial)
  dialMesh.position.y = D.caseThick/2 + D.bezelThick + D.crystalThick + D.dialThick/2
  dialMesh.receiveShadow = true
  watchGroup.add(dialMesh)

  // Indices
  const indexMat = new THREE.MeshStandardMaterial({ color: 0xd5a94e, roughness: 0.2, metalness: 1.0 })
  const indexGeo = new THREE.CylinderGeometry(0.8*mm, 0.8*mm, 0.5*mm, 16)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const r = D.dialDia/2 * 0.78
    const index = new THREE.Mesh(indexGeo, indexMat)
    index.position.set(Math.sin(angle)*r, D.caseThick/2 + D.bezelThick + D.crystalThick + D.dialThick, Math.cos(angle)*r)
    index.rotation.x = -Math.PI/2
    watchGroup.add(index)
  }

  // Hands: flat on the dial (XZ plane), pointing +Z at angle 0, rotated about Y
  const handGeo = (len, w) => {
    const shape = new THREE.Shape()
    shape.moveTo(-w/2, 0)
    shape.lineTo(w/2, 0)
    shape.lineTo(w/2, len*0.9)
    shape.lineTo(0, len)
    shape.lineTo(-w/2, len*0.9)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3*mm, bevelEnabled: false })
    geo.rotateX(Math.PI/2) // shape y -> +Z, extrusion -> -Y
    return geo
  }
  const dialTop = D.caseThick/2 + D.bezelThick + D.crystalThick + D.dialThick
  // 10:10:30 pose; each hand sits on its own level to avoid z-fighting
  const hand = (len, w, mat, level, angle) => {
    const m = new THREE.Mesh(handGeo(len, w), mat)
    m.position.y = dialTop + (level + 1) * 0.3*mm
    m.rotation.y = Math.PI - angle // angle: clockwise from 12 o'clock (-Z)
    watchGroup.add(m)
    return m
  }
  const TAU = Math.PI * 2
  hand(D.handHourLen, D.handW*1.5, materials.hands, 0, TAU * (10 + 10/60) / 12)
  hand(D.handMinLen, D.handW*1.2, materials.hands, 1, TAU * 10 / 60)
  hand(D.handSecLen, D.handW*0.5, materials.hands, 2, TAU * 30 / 60)

  // Center pin
  const pinGeo = new THREE.CylinderGeometry(1*mm, 1.2*mm, 1.5*mm, 16)
  const pinMesh = new THREE.Mesh(pinGeo, materials.gold)
  pinMesh.position.y = dialTop + 0.8*mm
  watchGroup.add(pinMesh)

  // Crown
  const crownGeo = new THREE.CylinderGeometry(D.crownDia/2, D.crownDia/2, D.crownLen, 16)
  const crownMesh = new THREE.Mesh(crownGeo, materials.crown)
  crownMesh.position.set(D.caseDia/2 + D.crownLen/2, 0, 0)
  crownMesh.rotation.z = -Math.PI/2
  crownMesh.castShadow = true
  watchGroup.add(crownMesh)

  // Crown knurling
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(D.crownDia/2, 0.15*mm, 8, 32),
      materials.crown
    )
    ring.rotation.x = Math.PI/2
    ring.position.set(D.caseDia/2 + D.crownLen/2 - i*1.3*mm, 0, 0)
    watchGroup.add(ring)
  }

  // Strap: two flat segments in XZ plane, running away from the case along +Z / -Z
  const segLen = D.strapLen / 2
  const strapGeo = new THREE.BoxGeometry(D.strapW, D.strapThick, segLen)
  const strapY = -D.caseThick/2 + D.strapThick/2
  const topStrap = new THREE.Mesh(strapGeo, materials.strap)
  topStrap.position.set(0, strapY, -(D.caseDia/2 + segLen/2 - 2*mm))
  watchGroup.add(topStrap)
  const botStrap = new THREE.Mesh(strapGeo, materials.strap)
  botStrap.position.set(0, strapY, D.caseDia/2 + segLen/2 - 2*mm)
  watchGroup.add(botStrap)

  // Export GLB
  const exporter = new GLTFExporter()
  const gltf = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: true })
  })

  await writeFile(output, Buffer.from(gltf))
  console.log(`GLB exported: ${output} (${gltf.byteLength} bytes)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
