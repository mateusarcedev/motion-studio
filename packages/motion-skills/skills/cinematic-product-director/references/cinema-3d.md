# Modo cinema-3d

Objetivo: quadros que pareçam renderizados num software 3D, não uma página web. Se pausar em qualquer
quadro e alguém reconhecer "isso é HTML", o plano precisa ser refeito.

Use só quando o briefing justificar o custo (render pesado, mais iterações). A cena 3D é feita pelo
`3d-scene-director`; esta Skill define o que a cena precisa comunicar.

## Elementos

| Elemento | Direção |
|---|---|
| Logo/ícone | geometria fiel à logo oficial (extrusão do SVG aprovado), material com reflexo controlado, varredura de brilho uma vez |
| Objetos de apoio | poucas formas simples ligadas ao produto (módulos, ícones em volume); materiais coerentes entre si |
| UI | prints reais como textura em placas finas, telas de dispositivo ou lâminas com borda iluminada; nunca UI inventada |
| Ambiente | fundo limpo com gradiente sutil; profundidade dada por luz e desfoque, não por excesso de objetos |

## Luz e materiais

- Três pontos como base (chave, preenchimento, recorte); mapa de ambiente para reflexos.
- Materiais físicos (metalness/roughness plausíveis). Brilho total e cromado em tudo = barato.
- Sombras de contato suaves ancoram os objetos.

## Câmera

- Lente e profundidade de campo declaradas por plano no storyboard.
- Movimentos com função: aproximar para revelar, orbitar para mostrar volume, atravessar para trocar de
  cena. Um movimento principal por plano.
- Primeiro plano desfocado passando dá escala — com moderação.

## Pós-processamento

Na ordem e sempre sutil: tonemapping → bloom leve só nas altas luzes → vinheta → grão fino.
Aberração cromática, se usada, mínima e só nas bordas. Cada efeito precisa ser defensável no Crítico.

## Texto em cena 3D

- Texto informativo fica em camada 2D por cima (legível, nítido, controlado pela tipografia do STYLE).
- Texto em volume só para palavras de impacto curtas.
- Nunca objeto atravessando texto que está sendo lido.

## Determinismo e performance

- Câmera, objetos e partículas como função do frame e da seed. Física em tempo real proibida; se
  precisar de simulação, pré-calcule e grave.
- Render headless usa SwiftShader quando não há GPU (já configurado no core). Meça o tempo por quadro
  nos stills antes de comprometer o render completo.
- Fonte editável faz parte da entrega (cena, materiais, câmera).
