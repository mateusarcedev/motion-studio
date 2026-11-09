# Engenharia de Processo: Liofilização Industrial de Alimentos

## Fundamentos Físico-Químicos e Termodinâmica

A **liofilização** (*freeze-drying* ou dessecação por congelamento) é o método padrão-ouro de conservação de alimentos, farmacêuticos e biológicos que preserva estrutura celular, cor, aroma e mais de 97% dos nutrientes.

### 1. O Ponto Triplo da Água
- **Coordenadas termodinâmicas:** Pressão = 6,11 mbar (611 Pa); Temperatura = 0,01 °C (273,16 K).
- **Mecanismo da sublimação:** Quando a pressão parcial de vapor de água cai abaixo de 6,11 mbar e calor latente de sublimação (~2.834 kJ/kg de gelo) é fornecido de forma controlada, a água congelada transita diretamente da fase sólida para a fase vapor, sem jamais passar pela fase líquida.
- **Vantagem mecânica:** Sem meniscos capilares de líquido, não ocorre colapso estrutural nem retração tecidual (*shrinkage*). A matriz porosa do alimento permanece intacta.

---

## As Quatro Fases Industriais

### Fase 1: Ultracongelamento Rápido (*Blast Freezing*)
- **Temperatura:** -40 °C a -50 °C em túnel criogênico contínuo.
- **Velocidade de resfriamento:** Rápida, para induzir nucleação homogênea de gelo com microcristais finos.
- **Prevenção:** Cristais grandes de gelo perfuram membranas celulares vegetais e animais, causando perda de turgor e perda de suco no descongelamento.

### Fase 2: Sublimação Primária (*Primary Drying*)
- **Pressão:** Vácuo profundo entre 0,05 mbar e 0,20 mbar (5 a 20 Pa) na câmara selada.
- **Temperatura da prateleira:** Aquecimento radiante suave (-20 °C a 0 °C) para transferir energia de sublimação sem exceder a temperatura eutética / colapso vítreo ($T_g'$) do alimento.
- **Condensador de gelo:** Serpentinas a -60 °C a -85 °C atraem e recongelam o vapor sublimado, impedindo que vapor de água chegue à bomba de vácuo mecânica.
- **Remoção:** Extrai ~95% da água livre total.

### Fase 3: Dessorção Secundária (*Secondary Drying*)
- **Mecanismo:** Remoção da água ligada quimicamente (adsorvida às macromoléculas e proteínas).
- **Condições:** Vácuo máximo (< 0,02 mbar) e aquecimento suave a +25 °C a +35 °C.
- **Umidade residual final:** Redução de ~85% original para 1% a 2% em peso.

### Fase 4: Quebra de Vácuo com Gás Inerte & Envasamento Hermético
- **Gás inerte:** Nitrogênio ultrapuro grau alimentício ($N_2$) injetado para equalizar pressão atmosférica sem oxigênio.
- **Embalagem:** Pouch multicamada aluminizado com barreira total a oxigênio e luz UV.
- **Estabilidade:** Validade de 15 a 25 anos à temperatura ambiente sem nenhum aditivo ou conservante químico.

---

## Parâmetros de Referência da Produção

| Etapa | Duração na Animação | Temperatura | Pressão | Umidade Residual |
| :--- | :--- | :--- | :--- | :--- |
| **1. Ultracongelamento** | 0s – 11s (frames 0–330) | -45 °C | 1013 mbar | 85% |
| **2. Sublimação Primária** | 11s – 23s (frames 331–690) | -15 °C | 0.08 mbar | 12% |
| **3. Dessorção Secundária** | 23s – 35s (frames 691–1050) | +30 °C | 0.02 mbar | 1.8% |
| **4. Envasamento $N_2$** | 35s – 45s (frames 1051–1350) | +22 °C | 1013 mbar ($N_2$) | 1.5% |
