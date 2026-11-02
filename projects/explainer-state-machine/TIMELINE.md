# TIMELINE — Mapeamento Temporal de Interpolação (1800 Frames)

**Projeto:** `explainer-state-machine`  
**FPS:** 30.00 CFR | **Duração:** 60.00s | **Total:** 1800 quadros (`0` a `1799`)  

---

## 1. Tabela Geral de Atos e Intervalos

| Cena | Início (s) | Fim (s) | Frame Início | Frame Fim | Duração (f) | Fase Entrada | Fase Ação | Pausa Leitura | Transição |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **01** | `00.0s` | `08.0s` | `0` | `239` | 240 | F000–F030 | F030–F180 | F180–F220 | F220–F239 |
| **02** | `08.0s` | `16.0s` | `240` | `479` | 240 | F240–F270 | F270–F400 | F400–F455 | F455–F479 |
| **03** | `16.0s` | `25.0s` | `480` | `749` | 270 | F480–F510 | F510–F660 | F660–F725 | F725–F749 |
| **04** | `25.0s` | `34.0s` | `750` | `1019` | 270 | F750–F780 | F780–F930 | F930–F995 | F995–F1019 |
| **05** | `34.0s` | `43.0s` | `1020` | `1289` | 270 | F1020–F1050| F1050–F1200| F1200–F1265| F1265–F1289|
| **06** | `43.0s` | `52.0s` | `1290` | `1559` | 270 | F1290–F1320| F1320–F1480| F1480–F1535| F1535–F1559|
| **07** | `52.0s` | `60.0s` | `1560` | `1799` | 240 | F1560–F1600| F1600–F1700| F1700–F1785| F1785–F1799|

---

## 2. Funções Analíticas de Movimento (Zero State Accumulation)

Para assegurar determinismo estrito (onde `window.__onFrame__(N)` calcula o mesmo estado visual independentemente da ordem), todas as interpolações derivam unicamente do número absoluto `frame`:

```javascript
// Tempo contínuo em segundos
const t = frame / fps;

// Normalizador de intervalo [a, b] -> [0, 1] clamped
function progress(t, a, b) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}

// Easing cúbico de desaceleração (Apple / Emil standard)
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

// Easing cúbico de aceleração e desaceleração
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Rebound elástico analítico (Spring)
function easeOutBack(x, c1 = 1.70158) {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Oscilação amortecida analítica para impacto de erro
function dampedShake(tLocal, amplitude = 12, decay = 8, freq = 35) {
  if (tLocal <= 0) return 0;
  return amplitude * Math.exp(-decay * tLocal) * Math.sin(freq * tLocal);
}

// Janela de transição suave [inStart, inEnd, outStart, outEnd]
function windowAlpha(t, inStart, inEnd, outStart, outEnd) {
  if (t < inStart) return 0;
  if (t < inEnd) return easeOutCubic((t - inStart) / (inEnd - inStart));
  if (t <= outStart) return 1;
  if (t < outEnd) return 1 - easeOutCubic((t - outStart) / (outEnd - outStart));
  return 0;
}
```

---

## 3. Telemetria Sincronizada por Cena

| Cena | Rótulo Principal | Contador 1 | Contador 2 | Badge de Estado |
| :---: | :--- | :--- | :--- | :---: |
| **01** | `ARQUITETURA` | `FLAGS: 4` | `COMBINAÇÕES: 16 (2⁴)` | `COLISÃO DETECTADA` |
| **02** | `DOMÍNIO FINITO` | `NÓS: 3` | `ESTADOS IMPOSSÍVEIS: 0` | `ATIVO: [IDLE]` |
| **03** | `TRANSIÇÃO` | `EVENTO: FETCH` | `PASSOS: 1` | `IDLE ➔ FETCHING` |
| **04** | `VALIDAÇÃO` | `TESTES: 2` | `GUARDA: hasValidData()` | `AUTORIZADO (MENTA)` |
| **05** | `INTEGRIDADE` | `TENTATIVAS: 1` | `EVENTO ILEGAL: FETCH` | `REJEITADO (100% OK)` |
| **06** | `FLUXO TOTAL` | `TRANSIÇÕES: 4/4` | `REDE: TIMEOUT ➔ RETRY` | `CICLO RESOLVIDO` |
| **07** | `SÍNTESE` | `PRECEITOS: 3` | `DETERMINISMO: 100%` | `ESTADO ESTÁVEL` |
