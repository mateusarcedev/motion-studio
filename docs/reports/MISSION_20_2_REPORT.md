# Relatório da Missão 20.2 — MOTION Studio 1.1.1

**Estado:** candidata 1.1.1 preparada; publicação manual pendente de autorização do proprietário.

**Data da validação:** 2026-11-20.

**Versão publicada preservada:** 1.1.0 continua como `latest`.

## Causa-raiz do ZIP incompleto

O ZIP original em `~/testes/motion-showcase/motion/projects/motion-launch/out/motion-launch-entrega.zip`
contém 22 entradas: o manifesto antigo e 21 imagens PNG. O manifesto em `out/final/assets.manifest.json`
declarava 23 arquivos, incluindo os dois MP4s que faltavam no ZIP. O exportador antigo aplicava uma
lista de extensões que não incluía MP4 e empacotava apenas a subpasta informada; arquivos do projeto
fora dessa raiz, como créditos, QA e a landing page, não participavam do pacote. O manifesto não era
comparado ao inventário real do ZIP, então a exportação terminava sem falhar.

O renderizador não era a causa. Faltava um contrato de entrega por projeto e uma validação do arquivo
ZIP que havia sido escrito.

## Correções e arquitetura

- `delivery.contract.json` v1 descreve artefatos obrigatórios/opcionais, raízes de produção, papel,
  mídia, especificações de vídeo e fontes licenciadas. Projetos podem solicitar somente imagens ou
  qualquer combinação adequada ao brief.
- `assets.manifest.json` v1 registra caminho relativo, tipo, bytes, SHA-256 integral, papel,
  obrigatoriedade, dimensões/metadados e validação por arquivo. Os documentos de integridade não
  exigem os próprios hashes.
- `motion export` usa o pipeline único do Core para validar o contrato, escrever o manifesto,
  empacotar ZIP64 e conferir inventário, duplicatas, paths, symlinks, CRC, bytes e hashes no ZIP real.
  `motion qa delivery --project <pasta> --zip <arquivo>` repete a verificação de modo independente.
- Contrato/manifesto malformados e metadados simbólicos retornam `FAIL` estruturado. Escritas de
  metadados são atômicas e não seguem symlinks.
- Uma auditoria de segurança reproduziu uma escrita fora do projeto via symlink em `assets.manifest.json`.
  A correção e o teste de regressão foram aplicados depois daquela fotografia do diff; o sentinel
  temporário permaneceu intacto no teste. A auditoria de dependências de runtime encontrou zero
  vulnerabilidades (`npm audit --omit=dev`).

## Qualidade criativa, QA e fontes

- Art direction agora orienta histórias a mostrar uma transformação concreta quando isso serve ao
  brief, além de alternar hierarquia, escala, alinhamento, densidade e dispositivo visual com controle.
- QA visual avalia texto secundário, sobreposição, corte, contraste e zonas seguras conforme o formato.
- QA temporal aceita contexto opcional do storyboard para fundo escuro intencional e pausas de leitura;
  sem anotação, os detectores continuam ativos.
- Fontes não foram adicionadas aos tarballs npm. O guia pede fontes livres, arquivo local no projeto,
  origem/licença/redistribuição no contrato e licença incluída na entrega.

## Homologação MOTION Launch

A campanha original em `~/testes/motion-showcase/motion/projects/motion-launch/` foi preservada. A
homologação usou uma cópia isolada em `/tmp/motion-launch-1.1.1-homologation/`.

- QA detalhado da campanha: **73 PASS, 2 WARN, 0 FAIL, 0 BLOCKED, 0 NOT_TESTED**.
- Os dois WARN restantes são heurísticos de repetição: 73% de quadros próximos no vídeo principal
  (22/25 pares adjacentes idênticos) e 81% no reel (33/56 pares). Permanecem sinais para revisão
  visual, não reprovações automáticas.
- A pausa de leitura do reel em 5,30–7,13 s passa quando anotada como `reading-pause`; fundos escuros
  intencionais também passam com contexto. O documento de homologação corrige a distinção entre esses
  checks PASS e os dois WARN de similaridade.
- O ZIP contém 68 artefatos declarados mais contrato e manifesto (70 entradas): dois vídeos de saída,
  o MP4 usado pela landing, imagens, landing page, créditos, proveniência, QA, Ubuntu Sans e a licença
  Ubuntu Font Licence 1.0.
- Exportação e Delivery Integrity: **PASS**, 68 arquivos, sem findings. `unzip -t` não encontrou erro.
  A verificação passou também após extrair o ZIP e comparar os arquivos extraídos ao manifesto.
- Landing page extraída: **5/5 viewports PASS** (360×740, 390×844, 768×1024, 1280×800 e 1920×1080).
- SHA-256 do ZIP homologado: `a6555074d80d8132c5cb1cb35fae841380e1dedf7318da7ae162db1d8b6e746b`.

Arquivo: `/tmp/motion-launch-1.1.1-homologation/out/motion-launch-entrega-1.1.1.zip`.

## Testes e release gate

- `npm test`: **193/193 passou**, 0 falhas, 0 skips.
- Matriz do release gate: **148/148 em Node 20.20.2, 22.23.5 e 24.16.0**.
- Release gate: R1–R15 e R17 **PASS**; R16 (**autenticação npm**) **BLOCKED**, pois não há sessão npm
  autenticada. O gate inteiro fica `BLOCKED` somente por R16. O relatório completo é
  [`RELEASE_1_1_1_REPORT.md`](RELEASE_1_1_1_REPORT.md).
- Consumidor externo limpo, bins, `motion doctor`, dependências internas exatas, conteúdo de pacotes,
  licenças das Skills, render/QA e versão ainda não publicada foram verificados pelo gate.
- Os quatro pacotes declaram `engines.node >=20`; as dependências internas são versões exatas `1.1.1`.

## Tarballs 1.1.1

Os caminhos são relativos à raiz do repositório. SHA-512 calculado sobre cada tarball:

| Pacote | Tarball | Bytes | SHA-512 |
|---|---|---:|---|
| `@technomanceer/motion-core` | `dist/packages/technomanceer-motion-core-1.1.1.tgz` | 622347 | `2657d79dff4f60fd2cb0851f405a2e840dc54dfff739184e9e916c595d92951fa21c759cb43eb233a0b522378c22c4aebea66bd6f45031b0856b8309f773a358` |
| `@technomanceer/motion-studio-skills` | `dist/packages/technomanceer-motion-studio-skills-1.1.1.tgz` | 14211013 | `2f1069f4c4f8a45dab38118f190c092f2f7f62acf5a8ec9589f1cdd7b42ad29f5d2650b0ad8aac8cca23e8e06dd10c596796deab30a8e94695a44f6d8b3eddea` |
| `@technomanceer/motion-cli` | `dist/packages/technomanceer-motion-cli-1.1.1.tgz` | 40509 | `1a4cbd1b4df2911908971e0d6d01b0ff93f564a0e1450b6a0d20f147e382394d49323856f923097b46db46603d7ae78b7ac04c6c6c05ef2ed3d52e6616b6d0eb` |
| `@technomanceer/motion-studio` | `dist/packages/technomanceer-motion-studio-1.1.1.tgz` | 5330 | `59966ce3fd92977ad8dd73dfcf8895de7cec25ff1c36d23ac36d6c84a1fa9d5916d68a0c30152e162e489891480e088db6222cc384dc4bb0e438d36ddf6749fa` |

Depois do commit final, `node scripts/pack-all.mjs` deve regenerar os quatro pacotes e
`sha512sum -c dist/packages/SHA512SUMS-1.1.1.txt` deve confirmar esses mesmos bytes antes de publicar.

## Publicação manual — não executada

Publicar na tag `next`, na ordem de dependências, conserva `latest` em 1.1.0:

```bash
cd /home/mateusarcedev/projetos/motion-studio
sha512sum -c dist/packages/SHA512SUMS-1.1.1.txt
npm publish dist/packages/technomanceer-motion-core-1.1.1.tgz --access public --tag next
npm publish dist/packages/technomanceer-motion-studio-skills-1.1.1.tgz --access public --tag next
npm publish dist/packages/technomanceer-motion-cli-1.1.1.tgz --access public --tag next
npm publish dist/packages/technomanceer-motion-studio-1.1.1.tgz --access public --tag next

npm view @technomanceer/motion-core dist-tags --json
npm view @technomanceer/motion-studio-skills dist-tags --json
npm view @technomanceer/motion-cli dist-tags --json
npm view @technomanceer/motion-studio dist-tags --json
npm view @technomanceer/motion-core@latest version
npm view @technomanceer/motion-studio-skills@latest version
npm view @technomanceer/motion-cli@latest version
npm view @technomanceer/motion-studio@latest version
```

**Nenhum `npm publish`, tag Git, push ou alteração de `latest` foi executado nesta etapa.** A promoção
de `latest` requer uma operação manual separada depois da homologação pública e autorização explícita.
