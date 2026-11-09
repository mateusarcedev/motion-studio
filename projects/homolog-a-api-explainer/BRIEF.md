# BRIEF — Teste A: Como Funcionam as APIs?
## Homologação Multidomínio MOTION Studio (Educação em Tecnologia)

**Data:** 02 de Novembro de 2026  
**Especialidade:** `explainer-motion` + `diagram-design`  
**Pipeline:** Determinístico HTML/Canvas/SVG a 30 FPS CFR  

---

### 1. Classificação de Intenção (5 Dimensões)
- **Assunto (Subject):** Tecnologia & Arquitetura de Software (APIs HTTP/REST).
- **Intenção (Intent):** Explicar e Ensinar (pedagógico visual, sem CTA de vendas).
- **Público (Audience):** Desenvolvedores iniciantes, estudantes de computação e profissionais técnicos.
- **Canal (Channel):** YouTube Shorts / Instagram Reels (9:16 vertical, 1080×1920).
- **Linguagem Visual:** Diagram Motion com pacotes de dados animados, visualizador de payload e telemetria de latência.

---

### 2. Duração Adaptativa
- **Duração Proposta:** 35 segundos (1.050 frames a 30 FPS CFR).
- **Racional de Pacing:**
  - 0s a 8s (240 frames): O Contrato e a Requisição `GET /api/v1/orders/402`.
  - 8s a 18s (300 frames): O Gateway de Trânsito e Validação de Headers (`Authorization: Bearer`).
  - 18s a 27s (270 frames): O Banco de Dados e Busca Causal (consulta determinística).
  - 27s a 35s (240 frames): Resposta `200 OK`, deserialização JSON e síntese da conexão cliente-servidor.
  - Pausas cognitivas de 1.8s entre as fases para assimilação visual.

---

### 3. Factual Grounding
- Padrão arquitetural: Cliente-Servidor REST sobre HTTP/1.1 e HTTP/2.
- Estrutura de dados: JSON RFC 8259, cabeçalhos RFC 7235.
- Zero jargão artificial: termos exatos de protocolo e status code padronizado pela IANA.

---

### 4. Regras Visuais
- Âncora superior tipográfica: Geist Mono / Geist Sans.
- Motor visual central: Nós de Cliente, Gateway, Servidor de Aplicação e Banco de Dados com pacotes em trânsito vetorial.
- Telemetria inferior: Status HTTP, latência em milissegundos (`RTT = 38ms`), tamanho do payload (`1.4 KB`).
