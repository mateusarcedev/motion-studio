export function CTA() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <span className="kicker" id="cta-title">Pronto para o seu?</span>
      <h2>O tempo não espera.<br />Seu Aurora sim.</h2>
      <a 
        href="https://wa.me/5511999999999" 
        className="btn btn-primary" 
        target="_blank" 
        rel="noopener" 
        aria-label="Reservar no WhatsApp"
      >
        Reserve no WhatsApp →
      </a>
      <p className="cta-note">Entrega em todo Brasil. Garantia de 2 anos.</p>
    </section>
  )
}
