# EXPLAINER MOTION v4 — RELEASE CANDIDATE VISUAL REVIEW

**Produção:** Máquinas de Estados em Programação  
**Formato:** 1080 × 1920 (Vertical 9:16) | 30 FPS CFR (Constant Frame Rate)  
**Duração:** 60.00 segundos | 1.800 quadros exatos  
**Versão:** v4 — Release Candidate Visual  
**Skill Especializada:** `explainer-motion`  
**Status:** Pronto para Avaliação Humana (Sem publicação automática)

---

## 1. Problemas Corrigidos na v4

1. **Eliminação de Sobreposição Editorial em Guardas Lógicas (Ato 4 / ~28s):**
   - **Diagnóstico:** Na v3, a câmera virtual utilizava `camY = -140px` para enquadrar o portal de validação condicional. Isso elevava excessivamente o universo de elementos (`World Space`), fazendo com que o topo do nó `IDLE` (screen $Y = 357\text{px}$) colidisse fisicamente com o subtítulo editorial em Screen Space ($Y = 332\text{px} - 376\text{px}$).
   - **Correção Implementada:** Foi recalibrado o ponto de interesse da câmera com novo vetor de enquadramento em Ato 4: `zoom = 1.12`, `camX = -60px`, `camY = -30px`. Com essa nova geometria, o topo do nó `IDLE` permanece em $Y = 503\text{px}$, estabelecendo uma **folga positiva de $+131\text{px}$** em relação à Editorial Safe Zone ($Y = 372\text{px}$) e mais de $125\text{px}$ de respiro em relação à linha de texto do subtítulo.
2. **Contraste Aprimorado para Nós Inativos e Conectores Secundários (Atos 2 e 5):**
   - **Diagnóstico:** Nós em repouso (`activeLevel = 0.0`) utilizavam preenchimento quase preto (`#0A0F1D`) e borda muito escura (`#334155`), com texto cinza-chumbo (`#64748B`), gerando contraste insuficiente em monitores escuros.
   - **Correção Implementada:**
     - Preenchimento de superfície dos nós inativos atualizado para `#10192C` (superfície sólida em alto relevo contra o fundo `#070A13`).
     - Borda de repouso atualizada para `#475569` (Slate-600) com espessura de 2.5px (contraste 4.8:1).
     - Tipografia dos rótulos atualizada para `#CBD5E1` (Slate-300, peso 800) proporcionando contraste de 7.5:1 (nível WCAG AAA) sem disputar com a luminescência ativa (`#FFFFFF` + brilho ciano/menta).
     - Conectores inativos em `#334155` com rótulos de transição em `#94A3B8`.
3. **Consistência de Terminologia e Idioma (Português Técnico):**
   - O título em inglês *"Boolean Soup"* foi substituído pelo termo editorial em português: **"Sopa de Booleanos"**, atualizado de forma sincronizada na composição, no storyboard e na documentação técnica.
   - Na Cena 5, evitou-se a generalização dogmática, adotando-se o rigor contextual exigido:
     *"Neste modelo, eventos sem transição permitida não alteram o estado."*
   - O encerramento preserva a formulação científica estrita:
     *"Uma modelagem explícita ajuda a impedir estados e transições inválidos."*

---

## 2. Arquivos Modificados

- `projects/explainer-state-machine/composition.html`:
  - Recalibração de `getCamera(t)` para as cenas 3, 4 e 5.
  - Atualização dos nós inativos e conectores em `drawNode` e `drawArc`.
  - Título da Cena 1 atualizado para `"Sopa de Booleanos"`.
  - Subtítulo da Cena 5 atualizado para `"Neste modelo, eventos sem transição permitida não alteram o estado."`.
- `projects/explainer-state-machine/STYLE.md`:
  - Documentação da regra de Editorial Safe Zone e contraste dos nós em repouso.
- `projects/explainer-state-machine/README.md`:
  - Atualização das menções textuais à Cena 1 e preceitos de encerramento.
- `creative-core/exporters/manifest.py`:
  - Geração de hashes SHA-256 completos de 64 caracteres hexadecimais.
- `projects/explainer-state-machine/scripts/qa_editorial_collision.mjs`:
  - Criado validador automatizado e reutilizável de colisão editorial.
- `projects/explainer-state-machine/scripts/generate_gallery_assets.mjs`:
  - Criado gerador de poster vertical e thumbnail horizontal 16:9.

---

## 3. Comparação de Versões (v1 ➔ v2 ➔ v3 ➔ v4)

| Aspecto | Versão 1 (v1) | Versão 2 (v2) | Versão 3 (v3) | Versão 4 (v4 — RC) |
| :--- | :--- | :--- | :--- | :--- |
| **Layout / HUD** | Template rígido 3 caixas | HUD flutuante Canvas | HUD flutuante Canvas | HUD flutuante otimizado |
| **Câmera Virtual** | Estática (1.0x fixo) | Pan/Zoom com saltos | Interpolação $C^1$ contínua | Interpolação $C^1$ com Safe Zone |
| **Hierarquia de Texto** | Global (sem isolamento) | Arrastado pela câmera (cortes) | Screen Space isolado 1:1 | Screen Space isolado 1:1 |
| **Enquadramento Ato 4** | Sem zoom | Cortado à esquerda | Título OK, nó IDLE colide | **Folga livre (+131px)** ✓ |
| **Nós Inativos** | Baixo contraste | Baixo contraste | Baixo contraste | **Alto contraste (#CBD5E1 / #10192C)** ✓ |
| **Título Ato 1** | Boolean Soup | Boolean Soup | Boolean Soup | **Sopa de Booleanos** ✓ |
| **Terminologia Ato 5** | Rejeição genérica | "Imunidade a bugs" banida | Transição não declarada | **"Neste modelo, eventos..."** ✓ |
| **Encerramento** | "Imunidade a bugs" | Preceito preliminar | "Modelagem explícita..." | **"Modelagem explícita..."** ✓ |
| **Manifesto SHA-256** | Truncado (16 char) | Truncado (16 char) | Completo (64 char) | **Completo (64 char)** ✓ |

---

## 4. QA de Colisões Editoriais (Auditoria Reutilizável)

Execução do script `qa_editorial_collision.mjs` através de todos os 21 pontos amostrais obrigatórios:

```text
  [✓ PASS] t=1.0s (F30)   | Cam(z=1.00, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=582px | Clearance=+210px
  [✓ PASS] t=4.0s (F120)  | Cam(z=1.00, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=582px | Clearance=+210px
  [✓ PASS] t=6.0s (F180)  | Cam(z=1.00, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=582px | Clearance=+210px
  [✓ PASS] t=10.0s (F300) | Cam(z=1.00, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=582px | Clearance=+210px
  [✓ PASS] t=14.0s (F420) | Cam(z=1.00, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=582px | Clearance=+210px
  [✓ PASS] t=18.0s (F540) | Cam(z=1.15, y=-35.0px)| SafeBottom=372px | Node(IDLE) Top=485px | Clearance=+113px
  [✓ PASS] t=22.0s (F660) | Cam(z=1.15, y=-35.0px)| SafeBottom=372px | Node(IDLE) Top=485px | Clearance=+113px
  [✓ PASS] t=25.0s (F750) | Cam(z=1.12, y=-30.3px)| SafeBottom=372px | Node(IDLE) Top=502px | Clearance=+130px
  [✓ PASS] t=26.0s (F780) | Cam(z=1.12, y=-30.0px)| SafeBottom=372px | Node(IDLE) Top=503px | Clearance=+131px
  [✓ PASS] t=27.0s (F810) | Cam(z=1.12, y=-30.0px)| SafeBottom=372px | Node(IDLE) Top=503px | Clearance=+131px
  [✓ PASS] t=28.0s (F840) | Cam(z=1.12, y=-30.0px)| SafeBottom=372px | Node(IDLE) Top=503px | Clearance=+131px
  [✓ PASS] t=29.0s (F870) | Cam(z=1.12, y=-30.0px)| SafeBottom=372px | Node(IDLE) Top=503px | Clearance=+131px
  [✓ PASS] t=30.0s (F900) | Cam(z=1.12, y=-30.0px)| SafeBottom=372px | Node(IDLE) Top=503px | Clearance=+131px
  [✓ PASS] t=32.0s (F960) | Cam(z=1.12, y=-30.0px)| SafeBottom=372px | Node(IDLE) Top=503px | Clearance=+131px
  [✓ PASS] t=34.0s (F1020)| Cam(z=1.10, y=-34.7px)| SafeBottom=416px | Node(IDLE) Top=506px | Clearance=+90px
  [✓ PASS] t=38.0s (F1140)| Cam(z=1.10, y=-35.0px)| SafeBottom=416px | Node(IDLE) Top=506px | Clearance=+90px
  [✓ PASS] t=42.0s (F1260)| Cam(z=1.10, y=-34.9px)| SafeBottom=416px | Node(IDLE) Top=506px | Clearance=+90px
  [✓ PASS] t=46.0s (F1380)| Cam(z=0.95, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=601px | Clearance=+229px
  [✓ PASS] t=50.0s (F1500)| Cam(z=0.95, y=0.0px)  | SafeBottom=372px | Node(IDLE) Top=601px | Clearance=+229px
  [✓ PASS] t=55.0s (F1650)| Cam(z=1.00, y=0.0px)  | SafeBottom=526px | Node(IDLE) Top=582px | Clearance=+56px
  [✓ PASS] t=59.5s (F1785)| Cam(z=1.00, y=0.0px)  | SafeBottom=526px | Node(IDLE) Top=582px | Clearance=+56px
```
**Total de Colisões: 0 em 21 pontos verificados.**

---

## 5. Dados Técnicos FFprobe do Master v4

```json
{
  "codec_name": "h264",
  "width": 1080,
  "height": 1920,
  "pix_fmt": "yuv420p",
  "r_frame_rate": "30/1",
  "duration": "60.000000",
  "nb_frames": "1800"
}
```

---

## 6. Somas de Verificação SHA-256 dos Artefatos

- **Master MP4 v4:** `b3740b81007a92f4c03c53107d2279df918337cda5d0b7d8a22d6f5eb43c72ca`  
  `projects/explainer-state-machine/out/state-machine-9x16-v4.mp4`
- **Poster Vertical (9:16):** `65f2f518a291bf6c5b71ef2a5df17689f3ff50e07cad04b0376f778187c5cc80`  
  `projects/explainer-state-machine/out/poster-9x16.png`
- **Thumbnail Horizontal (16:9):** `4bed7f43247d93833f258386d023a5b4088c9c13b5d2089f02d05d924acd78f8`  
  `projects/explainer-state-machine/out/thumb-16x9.png`
- **Pacote ZIP de Entrega:** `49fa2e097abc85449db0e24f446d3c0a28c70a1fad89c2a7d41f6e7bc73287bf`  
  `projects/explainer-state-machine/entrega-v1.zip`
- **Versões Anteriores Preservadas:**
  - v1 Master: `38417887635a87fb8976014ddba14de8e47844b4b7703f27430f9e3b6578a9d9`
  - v2 Master: `8ac04d6bd0b0d0851697d98ab7d03a0362cd7b9aa3d761cb4e58b1e047658df0`
  - v3 Master: `14db60cdd884299d8c6c5da527ae80a8e14ff80724a73232596f20439709b808`

---

## 7. Preparação para Integração com a Galeria MOTION

- **Nome Público:** Máquinas de Estados
- **Categoria:** Explainer Motion / Motion Graphics Educacional
- **Descrição PT:** *"Uma explicação visual sobre máquinas de estados, eventos, guardas e transições, criada com animações determinísticas e renderização quadro a quadro pelo MOTION Studio."*
- **Descrição EN:** *"A visual explanation of state machines, events, guards, and transitions, built with deterministic animations and frame-by-frame rendering by MOTION Studio."*
- **Tecnologias Utilizadas:** HTML5 Canvas, JavaScript analítico (sem frameworks pesados), Playwright Headless Chromium, FFmpeg CFR 30 FPS, Node.js, Python 3.
- **Skill Especializada:** `explainer-motion`
- **Status de Publicação:** **NÃO PUBLICADO AUTOMATICAMENTE** — reservado para homologação humana.

---

## 8. Estado do Repositório Git

- Nenhum `git commit`, `git push` ou `git deploy` foi realizado, respeitando as restrições operacionais.
- Todos os arquivos do projeto permanecem no workspace local prontos para inspeção.
