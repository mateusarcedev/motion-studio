# SCENE_SPEC — Aurora Watch Product Scene

## 1. Objetivo & Narrativa
- **Objetivo:** Apresentar o relógio Aurora como peça de precisão e elegância
- **Público:** Tech/design enthusiasts, 25-40 anos
- **Mensagem:** "Precisão encontra elegância"

## 2. Estilo & Direção Visual
- Estilo: `product` + `cinematic`
- Paleta: `--bg:#0a0a0c`, `--metal:#b8b8c0`, `--gold:#d5a94e`, `--glass:#ffffff10`, `--accent:#d5a94e`
- Referências: Apple Watch product pages, premium watch photography

## 3. Especificação Técnica
- Aspect ratios: 16:9 (video), 9:16 (story), 1:1 (feed), responsivo (web)
- Dimensões base: 1920×1080 @30fps (video)
- Sistema: Y-up, metros (1 unidade = 1m → relógio ~0.04m)
- Performance: < 50k tri, < 5MB GLB, < 2s load 3G

## 4. Hierarquia de Objetos
```
Root
├── Environment
│   ├── HDRI (studio_01.hdr, intensity 1.0, rotation 0.3)
│   ├── GroundPlane (invisible, receives shadow)
│   └── Props (minimal geometric forms)
├── Watch (key object)
│   ├── Case (metal, brushed)
│   ├── Bezel (metal, polished)
│   ├── Crystal (glass, transmission 0.98)
│   ├── Dial (matte, indices applied)
│   ├── Hands (hour, minute, second)
│   ├── Crown (metal, knurled)
│   └── Strap (leather, stitching geometry)
├── Cameras
│   ├── hero_cam (perspective, fov 45, start [0, 0.05, 0.4], end [0, 0.02, 0.25])
│   ├── macro_cam (perspective, fov 25, closeup dial)
│   ├── orbit_cam (orbit, auto-rotate web)
│   └── vertical_cam (9:16 composition)
├── Lights
│   ├── key (area, [1, 1, 1], intensity 5, temp 5500K)
│   ├── fill (area, [-1, 0.5, 0.5], intensity 1.5)
│   ├── rim (spot, [0, 0.5, -1], intensity 3)
│   └── HDRI (environment)
└── UI Layer
    ├── Hotspots (case, crown, crystal, strap)
    └── Labels (HTML overlay)
```

## 5. Materiais & Iluminação
| Objeto | BaseColor | Roughness | Metalness | Transmission | Normal | Emissive |
|--------|-----------|-----------|-----------|--------------|--------|----------|
| Case | #b8b8c0 | 0.35 | 1.0 | 0 | brushed_normal | none |
| Bezel | #c8c8d0 | 0.15 | 1.0 | 0 | none | none |
| Crystal | #ffffff | 0.02 | 0.0 | 0.98 | none | none |
| Dial | #0a0a0c | 0.85 | 0.0 | 0 | subtle_brushed | none |
| Hands | #d5a94e | 0.2 | 1.0 | 0 | none | #d5a94e (subtle) |
| Crown | #b0b0b8 | 0.3 | 1.0 | 0 | knurled | none |
| Strap | #1a1a1a | 0.9 | 0.0 | 0 | leather_normal | none |

**HDRI:** `studio_01.hdr` (polyhaven, CC0), intensity 1.0, rotation Y=0.3

## 6. Câmeras & Trajetórias
| Camera | Tipo | Posição Inicial | Posição Final | FOV | Trajetória | Frames |
|--------|------|-----------------|---------------|-----|------------|--------|
| hero_cam | perspective | [0, 0.05, 0.4] | [0, 0.02, 0.25] | 45° | spline ease | 0-180 |
| macro_cam | perspective | [0, 0.02, 0.12] | [0, 0.02, 0.08] | 25° | linear | 120-240 |
| orbit_cam | orbit (web) | auto-rotate Y | auto-rotate Y | 45° | continuous | 0-∞ |
| vertical_cam | perspective | [0, 0.06, 0.35] | [0, 0.01, 0.2] | 50° | spline | 0-180 |

## 7. Animações
| Action | Objeto(s) | Frames | Tipo | Loop | Trigger |
|--------|-----------|--------|------|------|---------|
| hero_orbit | watch group | 0-180 | rotation Y (-15°→+15°) | ping-pong | auto (video) |
| auto_rotate | watch group | 0-∞ | rotation Y (0.5°/frame) | true | web (auto) |
| macro_dolly | macro_cam | 120-240 | z: 0.12→0.08 | once | video |
| hand_sweep | second_hand | 0-450 | rotation Z (360°) | true | video (30fps=1s/rev) |
| crown_turn | crown | 60-90 | rotation X (30°) | once | video |
| hotspot_pulse | hotspot rings | 0-∞ | scale 1.0→1.2 | loop | web (hover) |

## 8. Estados de Entrada/Saída
| Formato | Entrada | Saída |
|---------|---------|-------|
| Video 16:9 | hero_cam @ [0,0.05,0.4], watch rot Y=0 | hero_cam @ close, watch rot Y=0 |
| Video 9:16 | vertical_cam @ [0,0.06,0.35] | vertical_cam close |
| Video 1:1 | hero_cam centered | hero_cam centered |
| Web | orbit_cam @ [0,0.05,0.4], auto-rotate | orbit_cam (user controlled) |

## 9. Assets Necessários
| Asset | Tipo | Fonte | Licença | Status |
|-------|------|-------|---------|--------|
| watch_procedural.glb | model | Three.js procedural | própria | ready |
| studio_01.hdr | HDRI | polyhaven | CC0 | ready |
| ambient.wav | audio | sintetizado | própria | ready |
| click.wav | audio | sintetizado | própria | ready |
| sting.wav | audio | sintetizado | própria | ready |

## 10. Eventos de Áudio
| Timestamp | Evento | Som | Sync |
|-----------|--------|-----|------|
| 0.0s | ambient_start | ambient.wav (loop) | frame 0 |
| 1.5s | case_reveal | whoosh.wav | frame 45 |
| 3.0s | macro_transition | subtle_woosh.wav | frame 90 |
| 4.5s | crown_interaction | click.wav | frame 135 |
| 14.5s | final_reveal | sting.wav | frame 435 |

## 11. Restrições de Performance
- Triângulos: < 30k (procedural otimizado)
- Texturas: 0 (procedural materials) / HDRI 2k HDR
- Draw calls: < 20
- GLB size: < 2MB (sem texturas baked)
- Load: < 1.5s 3G

## 12. Regras de Aprovação
- Gate 1: SCENE_SPEC aprovado → implementação procedural
- Gate 2: GLB < 2MB, validação gltf-transform → integração web/video
- Gate 3: Contact sheet (8 beats) + QA Crítico → entrega
