# Checklist do Crítico (filme de produto)

O Crítico recebe só renders + `BRIEF.md` + `qa-report`. Cada item vira PASS/WARN/FAIL com evidência
(quadro, tempo, captura).

## Bloqueadores

- [ ] Logo diferente da oficial aprovada, distorcida ou cortada.
- [ ] UI, métrica, depoimento ou funcionalidade que não existe no produto.
- [ ] Texto informativo ilegível no celular (abaixo da escala mínima) ou fora da safe zone.
- [ ] Erro de JS, asset quebrado, fonte não carregada (`status: FAIL` do render).
- [ ] Quadro preto, congelado ou plano de 1–2 quadros não intencional.
- [ ] Áudio com clipping após encode ou fora do alvo de loudness.

## Importantes

- [ ] Alguma cena some sem que nada dela continue na próxima (quebra de continuidade sem motivo).
- [ ] Mesmo recurso marcante usado mais de uma vez.
- [ ] Mudança importante fora da batida (> 3 quadros de distância do tempo forte mais próximo).
- [ ] Texto surgindo pronto (sem entrada) ou permanecendo menos tempo do que leva para ler.
- [ ] Câmera tremendo, girando ou "socando" na batida.
- [ ] Nenhum respiro: o filme inteiro na mesma intensidade.
- [ ] Objeto passando por cima de texto em leitura.
- [ ] Versão 9:16 que é só recorte do 16:9.
- [ ] Quadro pausado com cara de página web (modo `cinema-3d`).

## Menores

- [ ] Cor de destaque usada sem significado.
- [ ] Efeitos de pós perceptíveis demais (bloom estourando, grão grosso).
- [ ] Último quadro não segura tempo suficiente para ler o fecho.
- [ ] Pôster escolhido não representa o filme.

## Não testável automaticamente

Pronúncia de nomes na narração, naturalidade da voz, gosto da pessoa pela ideia central —
`NOT_TESTED` até revisão humana.
