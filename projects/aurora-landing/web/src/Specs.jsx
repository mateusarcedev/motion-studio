import { useGLTF } from '@react-three/drei'

export function Specs() {
  const specs = [
    {
      icon: '🏷️',
      title: 'Case',
      description: 'Titânio Grau 5, acabamento escovado, 42mm, 11mm espessura.',
      highlight: 'Titânio Grau 5'
    },
    {
      icon: '💎',
      title: 'Cristal',
      description: 'Safira com dupla camada antirreflexo, resistente a riscos.',
      highlight: 'Safira AR'
    },
    {
      icon: '⚙️',
      title: 'Movimento',
      description: 'Automático suíço Sellita SW200-1, 38h reserva, 28.800 vph.',
      highlight: 'Sellita SW200-1'
    },
  ]

  return (
    <div className="specs-grid" role="list">
      {specs.map((spec, i) => (
        <article key={i} className="spec-card" role="listitem">
          <div className="spec-icon" aria-hidden="true">{spec.icon}</div>
          <h3>{spec.title}</h3>
          <p>{spec.description}</p>
          <span className="spec-highlight">{spec.highlight}</span>
        </article>
      ))}
    </div>
  )
}
