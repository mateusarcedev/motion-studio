# @technomanceer/motion-studio-skills

Catálogo público curado de Agent Skills para o ecossistema **MOTION Studio**.

O pacote contém somente as Skills indicadas em [`public-skills.json`](./public-skills.json), com origem, versão de snapshot, licença, atribuição e hash SHA-256. A distribuição npm não inclui todo o catálogo local de 51 pastas.

## Skills incluídas

- `3d-scene-director`, `carousel-studio`, `explainer-motion`, `feed-studio`, `motion-director`, `shorts-director`, `story-studio`, `studio-director`, `thermo-nuclear-code-quality-review`, `web-director` e `anatomy`.

As Skills não estão todas sob a mesma licença. Consulte [`LICENSES.md`](./LICENSES.md) e o manifesto antes de redistribuir ou modificar o conteúdo.

## Uso

```js
import { listSkills, installSkills } from "@technomanceer/motion-studio-skills";

const skills = await listSkills();
await installSkills({ targetDir: process.cwd(), agents: ["agents", "claude", "opencode"] });
```

`listSkills()` e `installSkills()` operam apenas sobre o catálogo público autorizado. O checkout mantém as demais Skills locais, mas elas não são copiadas por esse instalador.
