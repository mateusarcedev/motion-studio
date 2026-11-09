# SCENE_SPEC — CARGA / 01

Documento Técnico de Especificação Tridimensional e Cinematográfica.

## 1. Objetivo & Narrativa
- **Objetivo:** Orquestrar um pipeline de 5 cenas contínuas no espaço 3D, retratando a transição de um contêiner do mar para a terra com rigor técnico, materiais PBR e iluminação dramática.
- **Formato:** Web Interativa (WebGL/Three.js responsivo) + Vídeo Determinístico (1920×1080 16:9 e 1080×1920 9:16 @30fps CFR).
- **Mensagem:** "Cada jornada tem uma história."

## 2. Sistema de Coordenadas & Escala
- **Orientação:** Y-up, Z-forward (padrão glTF / Three.js).
- **Unidade Base:** Metros reais (1.0 unidade = 1.0 metro).
- **Dimensões Chave:**
  - Contêiner 40ft High Cube: Comprimento 12.192m, Largura 2.438m, Altura 2.896m.
  - Cavalo mecânico (caminhão): Comprimento 7.2m, Largura 2.5m, Altura 3.6m. Carreta: 12.5m.
  - Guindaste STS: Altura da torre 52m, lança 40m, vão do pórtico 18m.
  - Navio de contêineres: Comprimento visível 120m, boca 24m, borda livre 12m.

## 3. Scene Graph (Hierarquia de Objetos)
```text
RootScene
├── Environment
│   ├── SkyDome (Degradê crepuscular shader / Blue Hour)
│   ├── OceanSurface (Plano marinho com normalMap de ondulação sutil)
│   ├── HarborDock (Cais de concreto com rugosidade baixa e poças refletivas)
│   └── HighwayTrack (Pista asfáltica com sinalização de solo, guardrails e postes)
├── Lighting
│   ├── AmbientLight (Cor: #0F172A, Intensidade: 0.55)
│   ├── DirectionalSun (Cor: #FFB380, Posição: [-30, 25, -40], Intensidade: 1.2)
│   ├── HarborFloodlightCyan (Cor: #00F0FF, Posição: [15, 30, 10], Intensidade: 2.5)
│   ├── SodiumLamps (Grupo de luzes pontuais âmbar #F59E0B ao longo da rodovia)
│   └── VehicleLights (Spotlights nos faróis do caminhão e ponto vermelho traseiro)
├── HeavyMachinery
│   ├── ContainerShip (Casco escuro, ponte de comando, mastros com sinalizadores)
│   ├── GantryCraneSTS (Pórticos em treliça, cabine e cabo do spreader)
│   └── SpreaderRig (Braço telescópico com twistlocks)
├── Vehicles
│   └── SemiTruck (Cabine aerodinâmica, grade dianteira, tanque de combustível, 6 rodas duplas, chassi porta-contêiner)
└── Protagonist
    └── Container_CRG01A (Chapas corrugadas, cantoneiras ISO, ferragens e estêncil)
```

## 4. Materiais PBR
- **Contêiner Protagonista (`matContainer`):**
  - Cor base: `#E85D04` / `#FF8A00` (âmbar industrial saturado).
  - Roughness: `0.45` (metal pintado com leve pátina industrial).
  - Metalness: `0.30`.
- **Chapas Estruturais Navais / Vigas (`matSteelNavy`):**
  - Cor base: `#1E293B`.
  - Roughness: `0.65`, Metalness: `0.70`.
- **Asfalto Molhado (`matWetAsphalt`):**
  - Cor base: `#090D14`.
  - Roughness: `0.18` (altamente especular, refletindo faróis e holofotes).
  - Metalness: `0.10`.
- **Lanternas & Holofotes Emissivos (`matEmissiveCyan`, `matEmissiveAmber`, `matEmissiveRed`):**
  - EmissiveIntensity: `2.0` a `3.5`.

## 5. Câmeras & Trajetórias por Cena
| Cena | Alvo Principal | Posição Câmera (Desktop) | Posição Câmera (Mobile) | FOV | Duração |
|---|---|---|---|---|---|
| 01. Porto | Navio / Cais Geral | `[0, 18, 55]` → `[5, 12, 38]` | `[0, 22, 70]` → `[5, 16, 50]` | 50° | 0s–4s (F0-120) |
| 02. Contêiner | Contêiner CRG-01-A | `[-8, 4, 14]` → `[-4, 2.5, 9]` | `[-9, 5, 18]` → `[-5, 3, 12]` | 40° | 4s–8s (F120-240) |
| 03. Movimentação | Spreader / Içamento | `[-12, 16, 20]` → `[-2, 6, 16]` | `[-15, 20, 26]` → `[-3, 8, 22]` | 45° | 8s–12s (F240-360) |
| 04. Estrada | Caminhão em Trânsito | `[10, 3.5, 12]` → `[8, 2.8, 9]` | `[12, 4.5, 16]` → `[9, 3.5, 12]` | 42° | 12s–16s (F360-480) |
| 05. Destino | Pátio de Entrega | `[0, 3, 14]` → `[0, 5, 22]` | `[0, 4, 18]` → `[0, 6, 28]` | 48° | 16s–20s (F480-600) |
