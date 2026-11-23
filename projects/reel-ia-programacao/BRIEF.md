# BRIEF — Reel "IA na programação" (homologação do Smart Reel Editor, Missão 21)

> Gate de aprovação humana: **pendente**. Este brief foi derivado do pedido da Missão 21 e dos
> arquivos fornecidos; a produção foi executada como homologação técnica do motor, não como
> entrega aprovada para publicação.

## Entrada (originais — nunca alterados)

| Arquivo | Papel | SHA-256 |
|---|---|---|
| `out/source/reels-motion.mp4` | gravação de celular a editar (66,4 s, 1080×1920, 30 fps, AAC 48 kHz estéreo) | `a62139faf67b6271142ecfcf1791324d4ecce9da5c548283a185320d73750824` |
| `out/source/reel-ia-programacao.mp4` | referência de qualidade (versão editada por terceiros, 52,8 s) — **não copiar** | `f6f40a01690426c90dc56299e31a28f874856676514d429778bfdd96bc17f3fd` |
| `out/source/legendas.srt` | legenda humana da **referência** (não é transcrição do bruto) | `146089f354b8bee4e2b716f2e7e8a4fbce4403e63bea05b4ce33b5c101d1df45` |
| `out/source/capa.jpg` | referência de estilo (card escuro, verde-menta, sans bold) | `fe75c2941373d9fb3ddb2b5ecfbe432477a71a6c7ef39284cf5cd755dcd9f233` |

## Mensagem

Dev que não usa IA está ficando para trás: IA já é realidade desde o ChatGPT (2022), as
ferramentas se multiplicaram, e usar IA desloca o foco do código para a regra de negócio e o
produto — que é o que o cliente quer (sistema funcionando, economia de dinheiro/tempo).

## Público e canal

Devs brasileiros; Instagram Reels / TikTok / Shorts, vertical 9:16, 1080×1920, 30 fps,
H.264 + AAC, −14 LUFS / true peak ≤ −1,5 dBTP.

## Duração

Ditada pela fala após os cortes (alvo: 55–62 s). Sem esticar nem acelerar a voz.

## Estrutura (história)

1. Abertura: "se você dev não está utilizando, você está ficando para trás" (ênfase visual), sem card.
2. Contexto: "já é uma realidade, não temos para onde fugir"; não é mais opcional desde 2022 (ChatGPT); vieram Antigravity, Codex, Claude Code.
3. Benefícios e mudança de foco: código → regra de negócio → produto.
4. Problema do dev (foco demais na tecnologia) × o que o cliente quer.
5. Fecho: economizar dinheiro, tempo, ou ambos.

## Restrições

- Somente a fala real; legendas nunca inventam palavras. Correções de reconhecimento só com
  evidência registrada (proveniência na timeline).
- A fonte já contém **texto queimado pelo app do celular**: "ESCUTA ISSO" (0,13–1,83 s, topo) e
  "E VOCÊ, O QUE ACHA?" (63,90–66,40 s, base). Nada do estúdio pode colidir com esses textos.
- Sem música (nenhuma trilha licenciada foi fornecida).
- Não copiar a edição de referência (gancho, cards e textos próprios, estrutura cronológica).
- Voz: preset `natural`; páginas de fala rápida aceitam até 32 cps só neste projeto (`qa.captions.cps.fail`).

## Parâmetros lidos pelo motor

A abertura foi aceita pelo dono do projeto em 2026-11-23 (Missão 21.1, B4) e fica também em
`edit.config.json`. A referência abre com a mesma frase, portanto a restrição "não copiar o gancho"
cedeu neste ponto. Para voltar à ordem da fala: `opening: "original"` e retirar `openingText` (nos dois arquivos).

```json motion-brief
{
  "opening": "custom",
  "openingText": "se você dev não está utilizando, você está ficando para trás",
  "glossary": ["Antigravity", "Claude Code", "Codex", "ChatGPT", "Anthropic"]
}
```
