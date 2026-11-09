# STORYBOARD — Teste A: Como Funcionam as APIs?
## Divisão Cena a Cena (1.050 Frames @ 30 FPS CFR)

| Cena | Frames | Duração | Nome | Ação Narrativa | Telemetria |
|---|:---:|:---:|---|---|---|
| **S01** | `000`–`239` | 8.0s | O Contrato da Requisição | O Cliente dispara `GET /api/v1/orders/402`. Um pacote luminoso azul surge no nó do cliente e inicia seu deslocamento pelo canal de rede. | `METHOD: GET` · `DNS: 104.21.4.11` |
| **S02** | `240`–`539` | 10.0s | O Gateway e Autenticação | O pacote atinge o API Gateway. O cabeçalho `Authorization: Bearer ***` é escaneado em âmbar. A chave de validação libera a passagem. | `AUTH: OK` · `RATE: 12/1000s` |
| **S03** | `540`–`809` | 9.0s | Processamento & Banco | O servidor despacha a query `SELECT * FROM orders WHERE id=402`. O banco de dados roxo processa em 12ms e devolve os campos normalizados. | `DB: 12ms` · `ROWS: 1` |
| **S04** | `810`–`1049` | 8.0s | Resposta 200 OK & Deserialização | O pacote de retorno verde `#3FB950` navega até o cliente com payload JSON formatado `{ "id": 402, "status": "paid" }`. Render instantâneo. | `STATUS: 200 OK` · `RTT: 38ms` |

---
**Continuidade Espacial:** Todos os nós mantêm posições relativas estáveis (Cliente no topo esquerdo, Gateway no centro, Servidor e Banco à direita), permitindo que o olhar siga a trajetória real dos dados sem cortes desorientadores.
