# Clipes gerados por IA (opcional)

Clipes de vídeo gerados (ambientes, texturas, objetos em movimento) podem complementar o filme quando
não existe material próprio. Nunca substituem a UI real nem a logo.

## Condições

- Só se a pessoa tiver um serviço conectado (MCP) e tiver autorizado no BRIEF (`paidServices.videoGen`).
- **Antes de cada lote**: listar quantos clipes, duração, modelo e custo estimado; esperar aprovação.
- Teto de gasto do BRIEF é limite duro.

## Quando usar

| Bom uso | Mau uso |
|---|---|
| fundo atmosférico (luz, tecido, líquido, partículas) | pessoa real ou rosto identificável |
| plano de detalhe de objeto genérico | tela de app (inventaria UI) |
| transição orgânica entre blocos | logo ou produto da marca |

## Direção do prompt

Descreva como direção de fotografia: assunto, ação, câmera (movimento e lente), luz, paleta do STYLE,
duração, proporção. Gere 2–3 variações curtas (3–5 s) por plano e escolha nos stills.

## Integração

- Clipe gerado entra como mídia no manifesto com provedor, modelo, prompt, data, termos de uso e custo.
- Normalize para o fps e o espaço de cor do master antes de compor.
- Se o serviço não estiver disponível, siga sem o clipe e registre `NOT_TESTED`.
