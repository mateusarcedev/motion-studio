# Modo ui-launch

A interface do produto é a protagonista. O filme conta a jornada do usuário do primeiro toque ao
resultado, e cada tela nasce da anterior.

## Reconstruir a UI

- Recrie em HTML/CSS a partir dos prints ou do código: mesmos textos, ícones, espaçamentos, cores.
  Print estático colado parece amador e não permite animar partes.
- Dados de exemplo plausíveis e fictícios (nada de cliente real). Marque no manifesto que são fictícios.
- Componentes reutilizáveis (botão, card, lista) — a mesma peça vai mudar de papel ao longo do filme.
- Ícones: os do próprio produto. Se precisar de extra, um único estilo via Visual Asset Intelligence.

## Continuidade: o elemento que sobrevive

Cada transição responde "o que da cena A continua na cena B?". Padrões úteis:

| Padrão | Exemplo |
|---|---|
| Crescer e virar ambiente | o botão "Agendar" escala até ocupar a tela e vira o fundo da confirmação |
| Encolher e virar peça | a foto em tela cheia diminui e vira a miniatura do post |
| Mudar de função | a linha da lista se destaca e vira o primeiro lugar do ranking |
| Atravessar | a câmera entra numa letra/ícone e sai na próxima cena |
| Contagem | um número que cresce ao longo do filme e amarra as cenas |

Escolha **uma ideia central** (a que atravessa o filme) e no máximo 3–4 transições marcantes. Cada uma
aparece uma vez.

## Tipografia

Escala pela **menor dimensão** do quadro (1080 px tanto em 1920×1080 quanto em 1080×1920):

| Papel | Altura de corpo aproximada |
|---|---|
| Palavra de impacto | 15–18% da menor dimensão |
| Frase de destaque | 9–11% |
| Texto de apoio / UI ampliada | 3–4% |
| Abaixo de ~2,5% | some no celular — não use para informação |

Peso médio (500–700). Fonte da marca; sem ela, uma sans do sistema. No máximo uma família + mono para
detalhes técnicos.

**Entrada de texto**: por palavra (frases) ou por letra (nome do produto), cada unidade subindo 8–16 px,
de opacidade 0 a 1 e de desfoque ~8 px a nítido, em 8–14 quadros com escalonamento de 2–3 quadros.
Saída mais rápida que a entrada.

## Movimento

- Curvas: `outCubic`/`outExpo` para entradas, `inOutCubic` para câmera. Nada linear em elemento visível.
- Câmera 2D: pan/zoom lentos sobre o canvas da UI, seguindo o foco da ação. Sem tremor, sem rotação,
  sem "soco" na batida.
- Cursor/dedo: só se ajudar a entender a ação; movimento em arco, com clique visível (escala 0,92 → 1).
- Parado > 0,5 s só se for respiro intencional.

## Cor

Neutros (fundo + texto) + cor real das telas. A cor da marca em destaque **só** onde há significado
(ação principal, resultado). Troca de ambiente de cor (claro → escuro → cor) é um evento — use no
máximo duas ou três vezes.

## Formatos

9:16 e 16:9 são duas composições. No vertical, a UI ganha escala e o texto sobe para o terço superior;
respeite as safe zones do preset da plataforma (`motion qa safe-zones`).
