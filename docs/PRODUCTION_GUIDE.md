# Guia de Produção — Sites, Vídeos e Carrosséis

Este manual explica como operar o MOTION Studio para produzir os três formatos principais de entrega criativa sob uma mesma identidade de marca.

---

## 1. Identidade Compartilhada (Brand System)

Antes de produzir qualquer peça, defina os tokens em `motion/brand/tokens.json`:

```json
{
  "brand": "MinhaMarca",
  "color": {
    "background": "#080B10",
    "surface": "#111622",
    "primary": "#00D2FF",
    "accent": "#00F5A0",
    "text": "#F0F6FC",
    "muted": "#8B949E"
  },
  "typography": {
    "headline": { "family": "Geist, system-ui, sans-serif" }
  }
}
```

Todos os três entregáveis devem consumir as mesmas variáveis CSS para garantir consistência estética.

---

## 2. Produzindo uma Landing Page (Web Director)

1. **Gere o scaffold:**
   ```bash
   motion create website nova-landing
   ```
2. **Implemente a experiência:**
   - Adicione o elemento visual 3D (Canvas ou WebGL) com animação suave e fallback em `<noscript>`.
   - Utilize classes de layout flexível sem `width: 100vw` ou margens fixas que causem scroll horizontal.
   - Certifique-se de que todos os elementos interativos (`<a>`, `<button>`) tenham área mínima de 44×44px (ou 48×48px recomendados).
3. **Execute o QA Multi-Viewport:**
   ```bash
   motion qa http://localhost:3000 ./qa-report
   ```
   O relatório deve retornar `PASS` em todas as 5 resoluções (`mobile-s`, `mobile`, `tablet`, `desktop`, `wide`).

---

## 3. Produzindo um Vídeo de 15 Segundos (Motion Director)

1. **Gere o scaffold:**
   ```bash
   motion create video teaser-15s
   ```
2. **Defina o Storyboard:**
   Divida os 450 frames em 4 atos (0-90 abertura, 91-210 mensagem central, 211-330 demonstração, 331-450 CTA).
3. **Composição em `composition.html`:**
   Importe `frame.js` e vincule todo o estado visual à função `window.__onFrame__(M)`:
   ```javascript
   window.__onFrame__ = (M) => {
     const t = M.frame / 30;
     // atualize posições, rotações, opacidades estritamente como função de M.frame
   };
   ```
4. **Renderize em Lote:**
   ```bash
   motion render frames composition.html ./frames --frames=450 --fps=30
   ```
5. **Monte o MP4 CFR 30fps:**
   ```bash
   motion render video ./frames ./final.mp4 --fps=30
   ```
6. **Inspecione os Frames Chave:**
   Valide visualmente o frame 0 (abertura), frame 225 (meio) e frame 449 (encerramento).

---

## 4. Produzindo um Carrossel Editorial (Carousel Studio)

1. **Gere o scaffold:**
   ```bash
   motion create carousel post-editorial
   ```
2. **Edite os Slides HTML:**
   - Cada slide reside em `slides/01.html ... 05.html`.
   - Resolução base: `1080×1350px` (proporção 4:5 vertical).
   - Tipografia legível, contraste alto e hierarquia de leitura clara.
3. **Renderize com Validação Automática:**
   ```bash
   motion render carousel ./slides ./out
   ```
   O motor exportará tanto a versão padrão (1080×1350) quanto a versão retina (2160×2700), aplicando `validate_static.py` em cada imagem.
4. **Exporte com Manifesto e ZIP:**
   ```bash
   motion export . ./entrega-carrossel.zip --gallery
   ```

---

## 5. Motion reutilizável, alpha e QA

Descubra componentes com `motion components list`, forneça um JSON de parâmetros e renderize MP4 ou WebM transparente sem editar o gerador. Use `motion transition list` para escolher uma transição FFmpeg entre cenas, `motion qa determinism` para comparar duas sessões independentes e `motion qa safe-zones` para revisar elementos importantes ao longo do tempo. Os overlays de safe zone são evidência de QA e não entram no render final.

Leia [`REUSABLE_MOTION_COMPONENTS.md`](REUSABLE_MOTION_COMPONENTS.md) para formatos, limites, campos de geometria, presets editáveis e exemplos completos.

## 6. Piloto E2E M6 — campanha Herbário de Névoa

A campanha fictícia em [`projects/m6-herbario-de-nevoa/`](../projects/m6-herbario-de-nevoa/) documenta o ciclo briefing → direção de arte → storyboard → produção → crítica visual → reparos → QA. Ela inclui uma landing responsiva com microinterações, um vídeo 16:9 animado, um story 9:16 animado e seis slides de carrossel. O script [`produce.mjs`](../projects/m6-herbario-de-nevoa/produce.mjs) usa o cliente MCP oficial JS contra o Motion MCP local por stdio.

Os contact sheets finais estão em [`reports/assets/mission-23-m6/`](reports/assets/mission-23-m6/). O relatório [`reports/MISSION_23_M6_REPORT.md`](reports/MISSION_23_M6_REPORT.md) registra dimensões, hashes, QA e os limites dos overlays de safe zones. Renderizações completas e sequências de frames ficam em `projects/m6-herbario-de-nevoa/out/m6-final/`, ignoradas pelo Git para não inflar o pacote. O Doop MCP não expôs o canvas de laboratório, portanto nenhuma tela da campanha foi escrita em editor externo.
