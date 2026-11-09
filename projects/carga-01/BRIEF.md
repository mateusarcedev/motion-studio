# BRIEFING CRIATIVO — CARGA / 01

## 1. Visão Geral do Projeto
- **Título:** CARGA / 01 — Uma jornada em movimento
- **Tipo:** Creative Portfolio Showcase / Peça Conceitual Autoral
- **Papel:** Creative Director, Senior Creative Developer, Motion Designer, 3D Technical Artist
- **Framework de Produção:** MOTION Studio `1.0.0-rc.2`
- **Público-Alvo:** Líderes de Design, Diretores Criativos, Engenheiros de Software Frontend, Comunidade WebGL/Three.js e visitantes de portfólio de alto nível.
- **Premissa Ética:** Projeto conceitual sem vínculo, marcas, logotipos ou métricas comerciais inventadas.

## 2. Objetivo Narrativo
Acompanhar visualmente a jornada cinematográfica de um contêiner intermodal protagonista (**ID: CRG-01-A**), desde a sua chegada ao porto ao entardecer, passando pelo içamento de precisão pelo guindaste gantry STS, carregamento sobre carreta rodoviária, viagem na rodovia durante a madrugada e entrega no destino final com reflexão poética sobre a logística global:
> *"Cada jornada tem uma história."*

## 3. Entregáveis da Missão
1. **Experiência Web Interativa (Next.js / React Three Fiber / Three.js):**
   - Experiência fluida com 5 cenas narrativas navegáveis por scroll e controle de cena.
   - Responsividade completa testada em 5 viewports (360x740 a 1920x1080).
   - Microinterações industriais, leitura de telemetria e fallback acessível para `prefers-reduced-motion` e dispositivos sem aceleração WebGL.
2. **Assets 3D Procedurais & GLB:**
   - Contêiner protagonista com chapas corrugadas, cantoneiras ISO, fechadura de alavanca e marcações estêncil de carga realistas.
   - Navio porta-contêineres cargueiro com conveses e castelo de proa/popa.
   - Guindaste de pórtico STS com treliça estrutural e spreader telescópico.
   - Caminhão cavalo mecânico com chassi porta-contêiner e faróis volumétricos.
   - Ambientes portuário e rodoviário com asfalto molhado e iluminação crepuscular.
3. **Vídeos Promocionais Cinematográficos (16:9 e 9:16):**
   - 20 segundos cada a 30 FPS CFR (600 frames por formato).
   - Renderização determinística bit a bit via Playwright + montagem FFmpeg yuv420p.
   - Master 1920×1080 horizontal e Master 1080×1920 vertical.
4. **Carrossel Editorial para Redes (5 Slides 4:5):**
   - Roteiro "Do conceito à experiência: como construí CARGA / 01".
   - Slides em HTML editável + render PNG em 1080×1350 e retina 2160×2700.
   - Legenda para publicação e manifesto.
5. **QA Visual & Auditoria com Crítico Independente:**
   - Evidências em 5 viewports, verificação de contrastes e ausência de clipping.
6. **Showcase Gallery Local & Case Study:**
   - Vitrine interativa local para navegação e revisão de todos os artefatos.
   - Case study técnico completo documentando desafios, decisões e aprendizados.
