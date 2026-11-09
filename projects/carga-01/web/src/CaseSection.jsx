import React from 'react';

export default function CaseSection() {
  return (
    <section className="case-section" id="case-study" aria-labelledby="case-heading">
      <div className="case-container">
        <header className="case-header">
          <div className="case-tag">FICHA TÉCNICA · CASE STUDY AUTORAL</div>
          <h2 id="case-heading" className="case-title">CARGA / 01 — Engenharia Criativa e Narrativa 3D</h2>
          <p className="case-lead">
            Uma investigação sobre a estética da logística global, transpondo a monumentalidade dos terminais portuários para a web cinematográfica através do MOTION Studio.
          </p>
        </header>

        <div className="case-grid">
          <article className="case-card">
            <h3 className="case-card-title"><span>◈</span> 01 · Desafio Criativo</h3>
            <p>
              Rejeitar os clichês visuais de landing pages contemporâneas (dashboards genéricos, gradientes decorativos sem propósito e cards repetitivos). O objetivo foi construir uma direção de arte cinematográfica industrial com paleta bicromática (Blue Hour e Âmbar de vapor de sódio) e escala arquitetônica autêntica.
            </p>
          </article>

          <article className="case-card">
            <h3 className="case-card-title"><span>◈</span> 02 · Modelagem & Pipeline 3D</h3>
            <p>
              Na ausência do Blender no ambiente de produção, implementou-se modelagem procedural avançada com Three.js r165 e exportação determinística para formato binário GLB otimizado. Cada asset (contêiner corrugado, caminhão articulado, guindastes STS e navio cargueiro) foi construído respeitando dimensões reais em metros e proporções ISO 6346.
            </p>
          </article>

          <article className="case-card">
            <h3 className="case-card-title"><span>◈</span> 03 · Storytelling em 5 Atos</h3>
            <p>
              A jornada se estrutura em 5 cenas contínuas: O Porto (estabelecimento), O Contêiner (protagonista), A Movimentação (içamento vertical STS), A Estrada (trânsito noturno veloz) e O Destino (conclusão). O enquadramento de câmera reflete as leis da cinemática física, com amortecimento cúbico e reflow de FOV adaptativo para mobile e desktop.
            </p>
          </article>

          <article className="case-card">
            <h3 className="case-card-title"><span>◈</span> 04 · Produção Multiformato</h3>
            <p>
              Além da experiência web interativa, o pipeline gerou simultaneamente dois filmes MP4 completos de 20 segundos a 30 FPS CFR (600 frames masterizados em 1920×1080 horizontal e 1080×1920 vertical) e um carrossel editorial em 5 lâminas 4:5 renderizado em 1080×1350 e retina 2160×2700.
            </p>
          </article>
        </div>

        <footer className="case-footer-specs">
          <div>MOTOR 3D: <strong>Three.js r165 / React Three Fiber</strong></div>
          <div>FRAMEWORK: <strong>MOTION Studio 1.0.0-rc.2</strong></div>
          <div>QA: <strong>Playwright Multi-Viewport (5 Resoluções)</strong></div>
          <div>DETERMINISMO: <strong>CFR 30 FPS / Zero Drift</strong></div>
        </footer>
      </div>
    </section>
  );
}
