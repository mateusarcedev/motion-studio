import React, { useState, useEffect } from 'react';
import CargaExperience from './CargaExperience.jsx';
import SceneHUD, { SCENES_DATA } from './SceneHUD.jsx';

export default function App() {
  const [currentScene, setCurrentScene] = useState(0);
  const [inspectMode, setInspectMode] = useState(false);
  const [lightingMode, setLightingMode] = useState('twilight');
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Check prefers-reduced-motion & WebGL support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);
      const listener = (e) => setIsReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);

      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) setWebglSupported(false);
      } catch (e) {
        setWebglSupported(false);
      }

      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Jump directly to scene
  const handleSelectScene = (index) => {
    if (index >= 0 && index < SCENES_DATA.length) {
      setCurrentScene(index);
    }
  };

  // Discrete, responsive wheel gesture (transitions scenes without empty DOM space)
  useEffect(() => {
    let isThrottled = false;
    const handleWheel = (e) => {
      if (showTelemetryModal) return;
      if (Math.abs(e.deltaY) < 25) return;
      if (isThrottled) return;

      if (e.deltaY > 0 && currentScene < SCENES_DATA.length - 1) {
        setCurrentScene((prev) => Math.min(SCENES_DATA.length - 1, prev + 1));
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, 850);
      } else if (e.deltaY < 0 && currentScene > 0) {
        setCurrentScene((prev) => Math.max(0, prev - 1));
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, 850);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentScene, showTelemetryModal]);

  // Touch swipe gesture for mobile / tablet
  useEffect(() => {
    let touchStartY = 0;
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e) => {
      if (showTelemetryModal) return;
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY - touchEndY;
      if (Math.abs(diff) > 40) {
        if (diff > 0 && currentScene < SCENES_DATA.length - 1) {
          setCurrentScene((prev) => prev + 1);
        } else if (diff < 0 && currentScene > 0) {
          setCurrentScene((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentScene, showTelemetryModal]);

  // Keyboard navigation (Arrow keys and 1-5 number keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (currentScene < SCENES_DATA.length - 1) {
          handleSelectScene(currentScene + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (currentScene > 0) {
          handleSelectScene(currentScene - 1);
        }
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < SCENES_DATA.length) {
          handleSelectScene(idx);
        }
      } else if (e.key === 'Escape' && showTelemetryModal) {
        setShowTelemetryModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScene, showTelemetryModal]);

  return (
    <main className="app-root">
      {/* 3D Real-time Scene Experience */}
      {webglSupported ? (
        <CargaExperience
          currentScene={currentScene}
          inspectMode={inspectMode}
          lightingMode={lightingMode}
          onContainerClick={() => setShowTelemetryModal(true)}
        />
      ) : (
        <div className="webgl-fallback" role="alert">
          <div className="fallback-box">
            <h2 style={{ color: '#FF8A00', marginBottom: 12 }}>TRAVESSIA — Modo Acessível</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Aceleração gráfica WebGL indisponível neste navegador.
            </p>
          </div>
        </div>
      )}

      {/* Floating UI & Navigation HUD */}
      <SceneHUD
        currentScene={currentScene}
        onSelectScene={handleSelectScene}
        inspectMode={inspectMode}
        onToggleInspect={() => setInspectMode(!inspectMode)}
        lightingMode={lightingMode}
        onToggleLighting={() => setLightingMode(lightingMode === 'twilight' ? 'night' : 'twilight')}
        showTelemetryModal={showTelemetryModal}
        onToggleTelemetryModal={() => setShowTelemetryModal(!showTelemetryModal)}
      />

      {/* Telemetry & Inspection Modal */}
      {showTelemetryModal && (
        <div
          className="telemetry-modal-backdrop"
          onClick={() => setShowTelemetryModal(false)}
        >
          <div
            className="telemetry-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="modal-category">
                  ESPECIFICAÇÕES TÉCNICAS ISO 6346
                </span>
                <h3 id="modal-title" className="modal-title">
                  Contêiner Protagonista TRV-01-A
                </h3>
              </div>
              <button
                type="button"
                className="btn-control"
                onClick={() => setShowTelemetryModal(false)}
                aria-label="Fechar modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-grid">
              <div className="modal-cell">
                <div className="modal-cell-k">CÓDIGO ISO</div>
                <div className="modal-cell-v">45G1 / HIGH CUBE</div>
              </div>
              <div className="modal-cell">
                <div className="modal-cell-k">COMPRIMENTO</div>
                <div className="modal-cell-v">12.192 M (40 FT)</div>
              </div>
              <div className="modal-cell">
                <div className="modal-cell-k">PESO BRUTO MÁXIMO</div>
                <div className="modal-cell-v accent">32,500 KG</div>
              </div>
              <div className="modal-cell">
                <div className="modal-cell-k">TARA ESTRUTURAL</div>
                <div className="modal-cell-v">3,820 KG</div>
              </div>
              <div className="modal-cell">
                <div className="modal-cell-k">MATERIAL</div>
                <div className="modal-cell-v">AÇO CORTEN PBR</div>
              </div>
              <div className="modal-cell">
                <div className="modal-cell-k">TRAVAS (TWISTLOCK)</div>
                <div className="modal-cell-v cyan">4× ISO CASTING</div>
              </div>
            </div>

            <p className="modal-note">
              TRAVESSIA — Uma jornada cinematográfica entre o cais e o destino. Construído com modelagem procedural Three.js e pipeline determinístico MOTION Studio.
            </p>

            <button
              type="button"
              className="btn-control active modal-close-btn"
              onClick={() => setShowTelemetryModal(false)}
            >
              RETORNAR À NAVEGAÇÃO
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
