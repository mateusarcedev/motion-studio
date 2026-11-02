# STYLE v3 — Design System, Hierarquia Espacial & Movimento C1 Contínuo (Missões 15.1 & 15.2)

**Projeto:** `explainer-state-machine` (Revisão Pós-Crítica Humana)  
**Formato de Saída:** 1080 × 1920 (Vertical 9:16) | 30 FPS CFR  
**Diretriz Central:** Separação estrita de Screen Space (editorial) e World Space (câmera virtual), interpolação C1 contínua, safe zones e rigor conceitual.

---

## 1. Separação de Espaços (Screen Space vs World Space)

Para eliminar cortes editoriais e manter o dinamismo dos mecanismos animados:
* **Screen Space (1:1 Fixo):**
  * Títulos, subtítulos, kickers e indicadores de interface.
  * Isolados via `ctx.save()` / `ctx.restore()` de qualquer rotação, zoom ou deslocamento da câmera.
  * Medição real de texto (`ctx.measureText`), quebra automática de linha (`wrapText`) e limites seguros ($X \in [86, 994]\text{px}$).
* **World Space (Transformado pela Câmera Virtual 2D):**
  * Diagramas vivos, nós discretos, vetores de transição, cápsulas de payload e partículas de impacto.
  * Câmera virtual com interpolação $C^1$ contínua via `easeInOutCubic` através de todas as fronteiras de atos (16s, 25s, 34s, 43s, 52s), eliminando saltos bruscos ou teleportações de quadros.

---

## 2. Paleta Cromática Semântica

| Papel | Hex | Função Semântica |
| :--- | :---: | :--- |
| **Deep Space** | `#070A13` | Fundo infinito escuro com gradientes radiais acoplados à posição da câmera. |
| **Âmbar Corten** | `#FF8A00` | Energia de transição, eventos de disparo e destaque conceitual. |
| **Ciano Luminescente** | `#00F0FF` | Estado ativo atual, fluxo de dados e rota principal. |
| **Menta Fluorescente** | `#15F5BA` | Guarda lógica aprovada, sucesso assíncrono (`RESOLVED`), integridade. |
| **Coral Tecnológico** | `#FF4757` | Colisão de estado, transição ilegal rejeitada, estado `ERROR`. |
| **Slate & Zinco** | `#1E293B` / `#334155` | Nós em repouso, arcos inativos e trilhas de guia estruturais. |
| **Texto de Leitura** | `#F8FAFC` / `#94A3B8` | Tipografia em alto contraste com pesos 800 (títulos) e 500 (explicações). |

---

## 3. Correções Técnicas e Semânticas

1. **Substituição de "Imunidade a Bugs":**  
   Termo banido. Substituído pela formulação exata da ciência da computação:  
   **"Torne Estados Impossíveis Irrepresentáveis"** e **"Transições Determinísticas"**.
2. **Ciclo Assíncrono Completo:**  
   O ciclo de requisição segue formalmente a cadeia:  
   `IDLE` $\xrightarrow{\text{FETCH}}$ `FETCHING` $\xrightarrow{\text{FALHA}}$ `ERROR` $\xrightarrow{\text{RETRY}}$ `FETCHING` $\xrightarrow{\text{SUCESSO}}$ `RESOLVED`.
   Com todas as transições visíveis e animadas sequencialmente.

---

## 4. Física do Movimento (Motion Principles)

* **Continuidade Espacial:** Elementos não somem por fade; eles colapsam, se fundem, são repelidos ou dão origem ao próximo elemento.
* **Mola Amortecida (Spring Physics):** Impactos mecânicos com recuo realista ($A \cdot e^{-\lambda t} \cdot \sin(\omega t)$).
* **Deformação por Velocidade (Squash & Stretch):** Partículas de dados se esticam na direção do vetor de movimento e desaceleram comprimindo levemente ao colidir ou ser absorvidas.
