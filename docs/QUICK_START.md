# Quick Start — MOTION Studio (5 Minutos)

Aprenda a instalar o MOTION Studio e produzir seu primeiro vídeo determinístico e landing page em menos de 5 minutos.

---

## Passo 1: Inicialize seu Projeto

Dentro da pasta do seu projeto existente (ou de um novo projeto):

```bash
# 1. Instale o MOTION
npm install -D motion-cli motion-core motion-studio-skills

# 2. Inicialize a marca
npx motion init --brand="Aurora"
```

Saída esperada:
```
🚀 Inicializando MOTION Studio para a marca: "Aurora"...
✅ Configuração criada: motion.config.json
✅ Tokens de marca criados: motion/brand/tokens.json
✅ 50 skills configuradas em .agents/skills
```

---

## Passo 2: Verifique os Motores

```bash
npx motion doctor
```

Confira se todos os componentes obrigatórios exibem `✅ PASS`.

---

## Passo 3: Crie seu Primeiro Entregável

O MOTION inclui geradores de scaffold prontos para uso:

```bash
# Para um vídeo promocional determinístico de 15 segundos:
npx motion create video teaser-15s

# Para um carrossel editorial de 5 slides:
npx motion create carousel post-lancamento

# Para uma landing page com elemento 3D:
npx motion create website landing-produto
```

---

## Passo 4: Pré-Visualização no Navegador

Inicie o servidor de pré-visualização local:

```bash
npx motion preview motion/projects/teaser-15s
```

Abra `http://127.0.0.1:3300/composition.html` para testar o movimento interativamente.

---

## Passo 5: Renderize e Exporte

```bash
# 1. Renderize os 450 frames do vídeo (30 FPS CFR):
npx motion render frames \
  motion/projects/teaser-15s/composition.html \
  motion/projects/teaser-15s/frames \
  --frames=450 --fps=30

# 2. Monte o arquivo MP4 final:
npx motion render video \
  motion/projects/teaser-15s/frames \
  motion/projects/teaser-15s/final.mp4 \
  --fps=30

# 3. Empacote a entrega com manifesto SHA-256 e ZIP:
npx motion export \
  motion/projects/teaser-15s \
  motion/out/entrega-teaser.zip \
  --gallery
```

Pronto! Seu pacote de entrega final está gerado em `motion/out/entrega-teaser.zip` com fontes editáveis, manifesto de hashes e registro na galeria local.
