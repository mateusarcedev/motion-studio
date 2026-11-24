# Determinismo de vídeo

## Garantia

**Idêntico na mesma máquina; visualmente igual entre máquinas.** Com os mesmos arquivos de entrada, configurações e versões das ferramentas, os renders feitos na mesma máquina devem produzir os mesmos quadros e áudio. CPUs, sistemas e builds de FFmpeg, Chromium, fontes ou codecs diferentes podem mudar a codificação e os valores exatos dos pixels; nesses casos, a expectativa é equivalência visual.

O gate de determinismo do CI renderiza duas vezes no mesmo job e compara os resultados nesse ambiente. Ele não compara renders feitos em máquinas diferentes nem serve como benchmark de CPU.

## Arquivos de render

Cada invocação usa um diretório de trabalho e caminhos temporários próprios. Etapas aguardam a conclusão da gravação antes de consumir os arquivos; arquivos finais e progresso são publicados por rename atômico depois de completos.

## Limite

Não há modo `--strict-determinism` nem promessa de identidade binária entre máquinas. Para validação entre hosts, compare visualmente os quadros e o áudio.
