# motion-studio-skills

Catálogo completo de Agent Skills para o ecossistema **MOTION Studio**.

## Skills Principais

- **`studio-director`**: Ponto central de triagem e coordenação multiformato (vídeo, site, carrossel, story, post, shorts).
- **`web-director`**: Direção de experiências web, landing pages e componentes interativos 3D com QA multi-viewport.
- **`motion-director`**: Direção cinematográfica para filmes e animações em código determinístico (CFR 30fps).
- **`carousel-studio`**: Carrosséis editoriais de 5 a 10 slides (1080×1350 e 2160×2700).
- **`story-studio`**: Stories estáticos e animados (1080×1920) com safe-zones e presets.
- **`feed-studio`**: Peças de feed social (1:1 e 4:5).
- **`shorts-director`**: Vídeos verticais narrados com legendas por palavra/beat.
- **`3d-scene-director`**: Composição e exportação 3D (Three.js/R3F/Blender).

## Uso

```js
import { listSkills, installSkills } from "motion-studio-skills";

const skills = await listSkills();
await installSkills({ targetDir: process.cwd(), agents: ["agents", "claude", "opencode"] });
```
