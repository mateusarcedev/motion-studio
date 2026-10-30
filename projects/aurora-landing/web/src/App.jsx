import { AuroraHero } from "./AuroraHero"
import { Specs } from "./Specs"
import { Story } from "./Story"
import { CTA } from "./CTA"
import { useEffect, useState } from "react"
import React from "react"
import "./styles.css"

export default function App() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduceMotion(mediaQuery.matches)
    const handler = (e) => setReduceMotion(e.matches)
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  return (
    <main className="page">
      <header className="nav">
        <a href="#" className="logo" aria-label="Aurora Home">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill="#d5a94e"/>
            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="#0a0a0c">A</text>
          </svg>
          <span className="logo-text">Aurora</span>
        </a>
        <nav aria-label="Navegacao principal">
          <a href="#specs">Especificacoes</a>
          <a href="#story">Historia</a>
          <a href="#cta" className="btn btn-primary">Reservar</a>
        </nav>
      </header>

      <main className="page">
        {/* ===== HERO ===== */}
        <section id="hero" className="hero" aria-labelledby="hero-title">
          <div className="hero-3d" aria-hidden="true">
            <AuroraHero 
              glbPath="/models/aurora-watch.glb" 
              autoRotate={true}
              autoRotateSpeed={0.3}
              enableHotspots={true}
              reducedMotion={reduceMotion}
            />
          </div>
          <div className="hero-copy" id="hero-title">
            <span className="kicker">Precisao encontra elegancia</span>
            <h1>Aurora.<br/>O relogio que<br/>voce <em>sente</em>.</h1>
            <p className="subhead">Precisao suica, design brasileiro, feito para durar geracoes.</p>
            <a href="#cta" className="btn btn-primary">Reservar seu Aurora</a>
          </div>
        </section>

        {/* ===== SPECS ===== */}
        <section id="specs" className="specs" aria-labelledby="specs-title">
          <header className="section-header">
            <span className="kicker">Especificacoes</span>
            <h2 id="specs-title">Cada detalhe<br/>pensado para durar.</h2>
          </header>
          <Specs />
        </section>

        {/* ===== STORY ===== */}
        <section id="story" className="story" aria-labelledby="story-title">
          <div className="story-bg" aria-hidden="true" />
          <div className="story-content">
            <span className="kicker" id="story-title">A historia</span>
            <h2>Feito para<br/>ser <em>vivido</em>.</h2>
            <p>
              Nao apenas um relogio. Um companheiro para as conquistas silenciosas,<br/>
              os marcos invisiveis, o tempo que nao volta - mas que fica gravado.
            </p>
            <a href="#cta" className="btn btn-ghost">Conheca a jornada</a>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section id="cta" className="cta" aria-labelledby="cta-title">
          <span className="kicker" id="cta-title">Pronto para o seu?</span>
          <h2>O tempo nao espera.<br/>Seu Aurora sim.</h2>
          <a 
            href="https://wa.me/5511999999999" 
            className="btn btn-primary" 
            target="_blank" 
            rel="noopener" 
            aria-label="Reservar no WhatsApp"
          >
            Reservar no WhatsApp
          </a>
          <p className="cta-note">Entrega em todo Brasil. Garantia de 2 anos.</p>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="#" className="logo" aria-label="Aurora Home">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="16" fill="#d5a94e"/>
                <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="#0a0a0c">A</text>
              </svg>
              <span className="logo-text">Aurora</span>
            </a>
            <p>Precisao suica, design brasileiro. Feito para durar geracoes.</p>
          </div>
          <nav className="footer-col" aria-label="Produto">
            <h4>Produto</h4>
            <ul>
              <li><a href="#specs">Especificacoes</a></li>
              <li><a href="#story">Historia</a></li>
              <li><a href="#cta">Reservar</a></li>
            </ul>
          </nav>
          <nav className="footer-col" aria-label="Empresa">
            <h4>Empresa</h4>
            <ul>
              <li><a href="#">Sobre nos</a></li>
              <li><a href="#">Sustentabilidade</a></li>
              <li><a href="#">Imprensa</a></li>
            </ul>
          </nav>
          <nav className="footer-col" aria-label="Suporte">
            <h4>Suporte</h4>
            <ul>
              <li><a href="#">FAQ</a></li>
              <li><a href="#">Garantia</a></li>
              <li><a href="#">Contato</a></li>
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>(c) 2026 Aurora. Precisao suica, design brasileiro.</p>
          <p className="small">Feito com MOTION Studio - Codigo aberto, editavel, reproduzivel.</p>
        </div>
      </footer>
    </main>
  )
}
