# Estudar a referência antes de criar

Quem pede "igual a esse vídeo" quer a **sensação**, não a cópia. A sensação vem de números: quanto dura
cada plano, quanto tempo a tela respira, quão grande é o texto, como uma cena passa para a outra.

## 1. Medir

```bash
python3 scripts/ref_analyze.py ref/ref.mp4 --out ref/analysis --fps 4
```

Gera `ref/analysis/contact.jpg` (folha de contato com o segundo em cada miniatura),
`ref/analysis/frames/` e `ref/analysis/ref-analysis.json` com cortes detectados e duração de cada
plano. Corte exige score acima do piso (0,08), 8× a mediana local e mudança em ≥ 70% do quadro. Pico que
muda só parte do quadro (card, caixa de texto) vai para `reviewCandidates`, **não** para `cuts`: confira cada
um na folha. Limitação: corte com fundo idêntico também vira candidato; card quase em tela cheia pode virar
corte; transição por movimento pode não aparecer.

Se houver fala na referência, transcreva (`motion stt` / `motion edit transcribe`) para saber onde o
texto cai em relação à voz.

## 2. Ler e anotar

Escreva em `ref/LEITURA.md`, sempre com números:

| Item | O que anotar |
|---|---|
| Ritmo | duração média, mínima e máxima dos planos; desvio. Planos todos iguais = cara de apresentação de slides |
| Respiro | trechos com pouca mudança e quanto duram |
| Estrutura | blocos com início/fim em segundos e a função de cada um (problema, produto, prova, fecho) |
| Luz/cor | fundo de cada bloco (claro, escuro, cor da marca) e quando troca |
| Tipografia | altura da letra principal em % da altura do quadro; peso; quantas palavras por vez |
| Transições | como cada bloco termina: corte na batida, objeto atravessando, zoom para dentro, inundação de cor |
| Música | onde caem quebra, volta da bateria, final |
| Câmera | parada, deslizando, orbitando; velocidade aparente |

## 3. Traduzir, não copiar

Para cada achado, escreva como ele vira linguagem **deste** produto:

> Referência: bloco escuro com mensagens chegando em camadas → Nosso: lista de agendamentos entrando em
> camadas com a UI real do app, fundo grafite da marca.

Proibido trazer da referência: logo, cores de marca, composição característica, personagens, textos,
trilha. Se a pessoa insistir em réplica, explique o risco e ofereça a versão inspirada.
