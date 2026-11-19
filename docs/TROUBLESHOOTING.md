# Troubleshooting — MOTION Studio

Soluções para problemas comuns durante instalação, renderização e QA.

---

## 0. Códigos de erro estruturados (`MOTION_*`)

Toda falha dos renderers/CLI traz um código estável (para agentes e automações) e uma instrução. Principais:

| Código | O que significa | Como resolver |
|---|---|---|
| `MOTION_BROWSER_MISSING` | nenhum Chromium | `npx playwright install chromium` |
| `MOTION_BROWSER_VERSION_MISMATCH` | existe Chromium, mas de outra revisão que a do Playwright instalado | `npx playwright install chromium` |
| `MOTION_BROWSER_SYSTEM_DEPS` | faltam bibliotecas do sistema | `npx playwright install-deps chromium` |
| `MOTION_BROWSER_LAUNCH_FAILED` | o navegador não inicia | reinstale ou defina `CHROME_PATH` |
| `MOTION_INVALID_SAMPLE_FRAMES` | `--sample-frames` inválido (duplicata, fora de faixa, sintaxe) | use `0,120,240-250` dentro de `0..frames-1` |
| `MOTION_RENDER_MODULE_IMPORT` | `import` não resolveu | use `./arquivo.js` ou `@technomanceer/motion-core/frame` / `/svg-motion` |
| `MOTION_RENDER_PAGE_ERROR` | erro de JavaScript na composição | corrija o script; o render **não** é aprovado |
| `MOTION_RENDER_CONTROLLER_MISSING` | sem `window.__onFrame__` | use `createMotionDriver` ou defina `__onFrame__` |
| `MOTION_RENDER_ASSET_FAILED` | imagem/recurso não carregou | corrija o caminho ou marque `data-optional` |
| `MOTION_SVG_INVALID` / `MOTION_SVG_UNSAFE` | SVG malformado / conteúdo inseguro removido | `motion svg validate <arquivo>` |

---

## 1. Chromium Não Encontrado

**Sintoma:** `Chromium não encontrado (defina CHROME_PATH ou instale via npx playwright install chromium)`.  
**Causa:** Os binários do Playwright ainda não foram baixados no cache da máquina atual.  
**Solução:**
```bash
npx playwright install chromium
```
Ou aponte para um navegador existente no sistema:
```bash
export CHROME_PATH=/usr/bin/google-chrome
```

---

## 2. Horizontal Overflow no QA Multi-Viewport

**Sintoma:** O comando `motion qa` acusa `FAIL: horizontal overflow: XXpx` em `mobile-s` ou `mobile`.  
**Causa:** Algum elemento HTML possui `width` fixo maior que 360px, padding sem `box-sizing: border-box`, ou texto longo com `white-space: nowrap`.  
**Solução:**
1. Adicione a regra universal CSS:
   ```css
   * { box-sizing: border-box; margin: 0; padding: 0; }
   ```
2. Em elementos de texto longo ou badges, use:
   ```css
   word-break: break-word; max-width: 100%;
   ```
3. Garanta que contêineres principais usem `width: 100%; max-width: 1200px;` em vez de larguras fixas em pixels.

---

## 3. Alvos de Toque Menores que 44px

**Sintoma:** `FAIL: touch targets <44px: N (a WxH)`.  
**Causa:** Botões ou links de navegação (`<a>`, `<button>`) possuem área de clique inferior ao padrão de acessibilidade WCAG/Mobile (44×44px).  
**Solução:**
```css
nav a, .btn, .logo {
  min-height: 48px;
  min-width: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

---

## 4. Grade Temporal Furada no Vídeo

**Sintoma:** `grade temporal furada: faltam frames [NN] (regenere o trecho)`.  
**Causa:** O processo de captura de frames foi interrompido antes do término ou algum frame falhou durante o render.  
**Solução:**
Re-execute o comando `motion render frames` garantindo que o parâmetro `--frames=N` cubra todos os quadros (ex: 450).

---

## 5. Arquivo `motion.config.json` Já Existe

**Sintoma:** `Erro: 'motion.config.json' já existe neste projeto.`  
**Causa:** Proteção nativa contra sobrescrita não autorizada.  
**Solução:**
Se deseja intencionalmente resetar a configuração do estúdio:
```bash
npx motion init --force
```
