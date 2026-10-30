# Exemplos de Uso — MOTION Studio

Exemplos reais e scripts para automação de campanhas criativas com o MOTION Studio.

---

## Exemplo 1: Automação Completa de Teaser de 15 Segundos

Crie um script `render-teaser.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="motion/projects/kronos-video-15s"

echo "1. Renderizando 450 frames determinísticos..."
motion render frames "$PROJECT_DIR/composition.html" "$PROJECT_DIR/frames" --frames=450 --fps=30

echo "2. Montando MP4 constante..."
motion render video "$PROJECT_DIR/frames" "$PROJECT_DIR/final.mp4" --fps=30

echo "3. Exportando pacote final com manifesto..."
motion export "$PROJECT_DIR" "$PROJECT_DIR/entrega-v1.zip" --gallery

echo "✅ Teaser finalizado em: $PROJECT_DIR/final.mp4"
```

---

## Exemplo 2: Renderização de Carrossel com Validação Dupla

```javascript
import { renderStatic, validateStatic } from "motion-core";

const slides = ["01.html", "02.html", "03.html", "04.html", "05.html"];

for (const s of slides) {
  const input = `./slides/${s}`;
  const out1x = `./out/${s.replace('.html', '-1080x1350.png')}`;
  const out2x = `./out/${s.replace('.html', '-2160x2700.png')}`;

  // Escala 1x
  await renderStatic(input, out1x, { width: 1080, height: 1350, scale: 1 });
  await validateStatic(out1x, "1080x1350", 1);

  // Escala 2x Retina
  await renderStatic(input, out2x, { width: 1080, height: 1350, scale: 2 });
  await validateStatic(out2x, "2160x2700", 2);

  console.log(`✓ Slide ${s} renderizado e verificado.`);
}
```

---

## Exemplo 3: Auditoria Programática de Landing Page

```javascript
import { qaViewports } from "motion-core";

const report = await qaViewports("http://localhost:3000", "./qa-evidence");
console.log(report.stdout);
```
