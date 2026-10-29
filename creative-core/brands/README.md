# Sistema de Marcas do MOTION

Cada pasta é uma marca: identidade visual + tom de voz + memória de decisões aprovadas.
Um projeto declara `"brand": "<slug>"` no BRIEF e só herda contexte dessa pasta.

```
brands/<slug>/
├── PROFILE.md       # identidade: logo, paleta, tipografia, tom, restrições
├── tokens.json      # tokens de design da marca (cores, espaçamento, tipografia)
├── assets/          # assets próprios aprovados (logo, fonts, imagens reais)
├── references/      # referências visuais
└── approved/        # MEMÓRIA VISUAL: registro das peças aprovadas + STYLE.md por produção
```

## Regras (memória visual)

- Antes de produzir para uma marca, o estúdio **consulta `approved/`**: reutilize as decisões
  visuais aprovadas; inovar é permitido, **ignorar identidade aprovada não é**.
- Ao final de produção aprovada, o STYLE.md da peça e um resumo das decisões são copiados
  para `brands/<slug>/approved/<data>-<peca>/`.
- Marcas são isoladas: um projeto nunca contamina tokens/assets de outra.
- `brand/voice.md` (raiz) continua existindo: é a **voz do estúdio** (default). Marcas podem
  herdar a voz default e sobrepor seções no próprio PROFILE.md.
- `default/` é o perfil que aponta para `../../brand/voice.md`.
