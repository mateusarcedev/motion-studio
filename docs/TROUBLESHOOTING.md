# Troubleshooting — MOTION Studio

Soluções para problemas comuns durante instalação, renderização e QA.

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
