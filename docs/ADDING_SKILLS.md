# Guia para Adicionar Novas Skills — MOTION Studio

O MOTION Studio utiliza o padrão aberto **Agent Skills** para ensinar capacidades de produção a agentes autônomos.

---

## 1. Estrutura de uma Skill

Cada habilidade reside em um diretório próprio dentro de `.agents/skills/<nome-da-skill>/`:

```
.agents/skills/minha-skill/
├── SKILL.md                 # Arquivo obrigatório de instrução
├── scripts/                 # (Opcional) Scripts auxiliares executáveis
├── references/              # (Opcional) Guias de apoio, exemplos e dados
└── examples/                # (Opcional) Implementações de referência
```

---

## 2. Formato do `SKILL.md`

O arquivo `SKILL.md` deve conter frontmatter YAML no topo:

```markdown
---
name: minha-skill
description: Resumo conciso de 1 a 2 frases explicando o que a skill produz e quando ela deve ser acionada.
---

# Nome da Skill

## 1 · Papel e Responsabilidades
Definição clara do que o agente deve produzir.

## 2 · Contrato de Entrada (BRIEF)
Tabela com campos obrigatórios e opcionais.

## 3 · Contrato de Saída
Arquivos esperados (ex: HTML editável, PNG validado, manifesto).

## 4 · Portão de Aprovação
Momento em que o agente deve pausar e solicitar revisão humana antes de prosseguir.
```

---

## 3. Passo a Passo para Registrar a Skill

1. **Crie a pasta da skill:**
   ```bash
   mkdir -p .agents/skills/minha-skill
   ```
2. **Escreva o arquivo `SKILL.md`** seguindo o formato acima.
3. **Crie symlinks nos adaptadores:**
   ```bash
   ln -s ../../.agents/skills/minha-skill .claude/skills/minha-skill
   ln -s ../../.agents/skills/minha-skill .opencode/skills/minha-skill
   ```
4. **Adicione ao pacote `motion-studio-skills`:**
   Copie a nova pasta para `packages/motion-skills/skills/minha-skill/` e repacte a biblioteca:
   ```bash
   node scripts/pack-all.mjs
   ```
5. **Teste com a suite de QA:**
   Execute `npm test` para certificar que a nova skill foi detectada na listagem de habilidades.
