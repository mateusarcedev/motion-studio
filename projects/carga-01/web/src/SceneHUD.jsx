import React from 'react';

export const SCENES_DATA = [
  {
    step: '01 / 05',
    phase: 'O ESTABELECIMENTO',
    title: 'Cena 01 — O Porto',
    description: 'A vastidão monumental do terminal marítimo de Santos na blue hour. O navio porta-contêineres atracado ao cais e os guindastes pórtico STS cortam o horizonte, iniciando a jornada intermodal.',
    telemetry: [
      { label: 'TERMINAL', value: 'SANTOS [BR-SSZ]' },
      { label: 'COORD', value: '23°59\'S 046°18\'W' },
      { label: 'STATUS', value: 'OPERAÇÃO ATIVA' }
    ]
  },
  {
    step: '02 / 05',
    phase: 'O PROTAGONISTA',
    title: 'Cena 02 — O Contêiner',
    description: 'Em primeiro plano, o contêiner de aço corten âmbar: chapas corrugadas de alta resistência, cantoneiras ISO twistlock fundidas e marcações estêncil oficiais TRAVESSIA TRV-01-A.',
    telemetry: [
      { label: 'UNIDADE', value: 'TRV-01-A' },
      { label: 'ISO', value: '45G1 HIGH CUBE' },
      { label: 'P. BRUTO', value: '32.500 KG' },
      { label: 'TARA', value: '3.820 KG' }
    ]
  },
  {
    step: '03 / 05',
    phase: 'OPERAÇÃO INTERMODAL',
    title: 'Cena 03 — A Movimentação',
    description: 'O spreader do guindaste portuário acopla os twistlocks nos quatro cantos e realiza o içamento vertical contínuo, transferindo a unidade do cais para o chassi do caminhão.',
    telemetry: [
      { label: 'EQUIPAMENTO', value: 'STS GANTRY #04' },
      { label: 'IÇAMENTO', value: '+14.2M VERTICAL' },
      { label: 'ACOPLAMENTO', value: 'CHASSI 3 EIXOS' }
    ]
  },
  {
    step: '04 / 05',
    phase: 'TRÂNSITO TERRESTRE',
    title: 'Cena 04 — A Estrada',
    description: 'O cavalo mecânico corta a rodovia litorânea durante a noite. Os postes de vapor de sódio projetam feixes ritmados e o asfalto molhado reflete os faróis xenônio em alta velocidade.',
    telemetry: [
      { label: 'ROTA', value: 'CORREDOR BR-101' },
      { label: 'VELOCIDADE', value: '80 KM/H CFR' },
      { label: 'PISTA', value: 'ASFALTO MOLHADO' }
    ]
  },
  {
    step: '05 / 05',
    phase: 'CONCLUSÃO POÉTICA',
    title: 'Cena 05 — O Destino',
    epilogue: 'Cada jornada tem uma história.',
    description: 'Chegada ao centro de distribuição metropolitano ao amanhecer. As luzes traseiras encerram a travessia e sintetizam a poética da infraestrutura pesada.',
    telemetry: [
      { label: 'DESTINO', value: 'HUB METROPOLITANO' },
      { label: 'STATUS', value: 'TRAVESSIA CONCLUÍDA' },
      { label: 'SÍNTESE', value: 'DO CAIS AO DESTINO' }
    ]
  }
];

export default function SceneHUD({
  currentScene,
  onSelectScene,
  inspectMode,
  onToggleInspect,
  lightingMode,
  onToggleLighting,
  showTelemetryModal,
  onToggleTelemetryModal
}) {
  const scene = SCENES_DATA[currentScene] || SCENES_DATA[0];

  return (
    <header className="hud-overlay">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="brand-badge">
          <div className="brand-title">
            TRAVESSIA <span className="tag">EXPERIÊNCIA 3D</span>
          </div>
          <div className="brand-subtitle">
            Do cais ao destino · MOTION Studio
          </div>
        </div>

        <nav className="top-controls" aria-label="Controles da Experiência">
          <button
            type="button"
            className={`btn-control ${inspectMode ? 'active' : ''}`}
            onClick={onToggleInspect}
            title="Alternar modo de inspeção 3D com órbita livre"
            aria-label="Alternar inspeção 3D"
          >
            <span>⟲</span> <span>{inspectMode ? 'ÓRBITA' : 'INSPECIONAR'}</span>
          </button>

          <button
            type="button"
            className="btn-control"
            onClick={onToggleLighting}
            title="Alternar atmosfera de iluminação (Crepúsculo / Blue Hour)"
            aria-label="Alternar modo de iluminação"
          >
            <span>◐</span> <span>{lightingMode === 'night' ? 'NOITE' : 'CREPÚSCULO'}</span>
          </button>

          <button
            type="button"
            className={`btn-control ${showTelemetryModal ? 'active' : ''}`}
            onClick={onToggleTelemetryModal}
            title="Exibir especificações técnicas ISO"
            aria-label="Exibir telemetria técnica"
          >
            <span>ℹ</span> <span>TELEMETRIA</span>
          </button>
        </nav>
      </div>

      {/* Floating Editorial Narrative Card */}
      <aside className="narrative-card" aria-live="polite">
        <div className="scene-step-tag">
          <span>●</span> {scene.step} · {scene.phase}
        </div>
        <h1 className="scene-headline">{scene.title}</h1>
        {scene.epilogue && (
          <div className="scene-epilogue-quote">
            "{scene.epilogue}"
          </div>
        )}
        <p className="scene-description">{scene.description}</p>
        <div className="telemetry-row">
          {scene.telemetry.map((t, idx) => (
            <div key={idx} className="telemetry-item">
              {t.label}: <span>{t.value}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Bottom Scene Scrubber & Navigation */}
      <footer className="bottom-nav">
        <div className="scene-indicators" role="tablist" aria-label="Seletor de Cenas Narrativas">
          {SCENES_DATA.map((s, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={currentScene === idx}
              className={`btn-scene-dot ${currentScene === idx ? 'active' : ''}`}
              onClick={() => onSelectScene(idx)}
              aria-label={`Ir para ${s.title}`}
            >
              <span className="dot-num">{`0${idx + 1}`}</span>
              <span className="dot-label">{s.title.split('—')[1]?.trim() || s.phase}</span>
            </button>
          ))}
        </div>

        <div className="nav-actions">
          <button
            type="button"
            className="btn-nav-step"
            onClick={() => onSelectScene(Math.max(0, currentScene - 1))}
            disabled={currentScene === 0}
            aria-label="Cena Anterior"
          >
            ←
          </button>
          <button
            type="button"
            className="btn-nav-step"
            onClick={() => onSelectScene(Math.min(SCENES_DATA.length - 1, currentScene + 1))}
            disabled={currentScene === SCENES_DATA.length - 1}
            aria-label="Próxima Cena"
          >
            →
          </button>
        </div>
      </footer>
    </header>
  );
}
