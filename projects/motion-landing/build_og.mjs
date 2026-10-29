import { chromium } from '/home/mateusarcedev/projetos/motion/node_modules/playwright-core/index.mjs';
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const dir = path.dirname(new URL(import.meta.url).pathname);
const tpl = fs.readFileSync(dir + '/og.html', 'utf8');
const variants = { pt: ['Código que vira <em>cinema.</em>', 'frame-driven · determinístico'], en: ['Code that becomes <em>cinema.</em>', 'frame-driven · deterministic'] };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [k, [h, t]] of Object.entries(variants)) {
  fs.writeFileSync(dir + '/.og-tmp.html', tpl.replace('__H1__', h).replace('__TAG__', t));
  await p.goto(pathToFileURL(dir + '/.og-tmp.html').href); await p.waitForTimeout(400);
  await p.screenshot({ path: `${dir}/site/assets/og-${k}.png` });
}
fs.unlinkSync(dir + '/.og-tmp.html'); await b.close();
