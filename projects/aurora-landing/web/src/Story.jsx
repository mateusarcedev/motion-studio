import { useEffect, useRef } from 'react'

export function Story() {
  const bgRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      const rate = scrolled * 0.3
      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${rate}px, 0)`
      }
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${scrolled * 0.1}px, 0)`
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className="story" aria-labelledby="story-title">
      <div className="story-bg" ref={bgRef} aria-hidden="true" />
      <div className="story-content" ref={contentRef}>
        <span className="kicker" id="story-title">A história</span>
        <h2>Feito para<br />ser <em>vivido</em>.</h2>
        <p>
          Não apenas um relógio. Um companheiro para as conquistas silenciosas,<br />
          os marcos invisíveis, o tempo que não volta — mas que fica gravado.
        </p>
        <a href="#cta" className="btn btn-ghost">Conheça a jornada</a>
      </div>
    </section>
  )
}
