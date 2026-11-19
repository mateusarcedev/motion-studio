/**
 * Concept lexicon: maps everyday words (PT-BR + EN) to visual concepts and curated Lucide icons.
 * Format per line:  concept | term, term, ... | icon, icon, ...   (icons ordered best → worst)
 * The resolver never relies on this alone: it also scores icon names and tags from the pack,
 * so concepts missing here still resolve (with lower confidence).
 */
const TABLE = `
ai | inteligencia artificial, ia, ai, machine learning, aprendizado de maquina, neural, rede neural, modelo de linguagem, llm, chatbot, assistente virtual | bot, brain-circuit, sparkles, cpu, wand-sparkles
brain | cerebro, mente, raciocinio, pensamento, cognicao | brain, brain-circuit, lightbulb
idea | ideia, criatividade, insight, inovacao, inspiracao, innovation, creativity | lightbulb, sparkles, lamp, wand-sparkles
speed | velocidade, rapido, rapidez, agilidade, performance, fast, quick, eficiencia, produtividade | zap, gauge, timer, rocket, fast-forward
launch | lancamento, lancar, startup, decolar, launch, estreia | rocket, flag, party-popper
growth | crescimento, crescer, aumento, evolucao, escalar, growth, resultado, melhoria | trending-up, chart-no-axes-column-increasing, sprout, arrow-up-right, chart-line
decline | queda, reducao, perda, diminuir, decline | trending-down, arrow-down-right, chart-no-axes-column-decreasing
chart | grafico, graficos, metricas, analytics, estatistica, kpi, indicadores, relatorio de dados | chart-line, chart-column, chart-pie, chart-no-axes-combined, activity
data | dados, base de dados, banco de dados, database, armazenamento, informacao estruturada | database, server, hard-drive, table
cloud | nuvem, cloud, computacao em nuvem | cloud, cloud-upload, cloud-cog
internet | internet, web, online, site, sites, navegador, browser, pagina | globe, wifi, earth, network, app-window
network | rede, redes, conexao, conectar, conectividade, nos, interconexao | network, share-2, waypoints, cable, git-fork
wifi | wifi, sem fio, wireless, roteador | wifi, router, radio-tower
server | servidor, hospedagem, datacenter, hosting, backend | server, server-cog, hard-drive
code | codigo, programar, programacao, desenvolvimento, software, desenvolvedor, developer, api | code, terminal, braces, file-code, square-terminal
security | seguranca, protecao, proteger, privacidade, criptografia, seguro, security, privacy, protect | shield-check, lock, shield, key-round, fingerprint
password | senha, acesso, login, autenticacao, chave | key-round, lock-keyhole, log-in, fingerprint
money | dinheiro, financeiro, financas, economia, lucro, receita, pagamento, investimento, money, finance, profit | banknote, wallet, coins, circle-dollar-sign, piggy-bank, hand-coins
cart | compra, compras, loja, ecommerce, venda, vendas, carrinho, varejo, shop, store | shopping-cart, store, shopping-bag, tag, receipt
card | cartao, cartao de credito, pagamento online | credit-card, wallet-cards, receipt
time | tempo, prazo, relogio, hora, horas, duracao, time, deadline | clock, timer, hourglass, alarm-clock, history
calendar | calendario, data, agenda, evento, cronograma, schedule | calendar, calendar-days, calendar-check
people | pessoas, equipe, time de trabalho, colaboracao, comunidade, publico, audiencia, team, community, audience | users, users-round, handshake, contact
person | pessoa, usuario, perfil, cliente, user, customer, profile | user, circle-user-round, user-round
message | mensagem, mensagens, chat, conversa, comunicacao, suporte, atendimento, message, support | message-circle, messages-square, message-square-text, headset
mail | email, e-mail, correio, newsletter, mail | mail, send, inbox, mail-open
phone | telefone, celular, ligar, ligacao, call, phone | phone, smartphone, phone-call
mobile | mobile, aplicativo, app, apps, smartphone | smartphone, app-window, tablet-smartphone
laptop | computador, notebook, desktop, laptop, computer, monitor | laptop, monitor, computer
search | pesquisa, busca, buscar, procurar, descoberta, search, discover, explorar | search, scan-search, telescope, compass
target | objetivo, objetivos, meta, metas, alvo, foco, estrategia, target, goal, strategy | target, crosshair, goal, flag
check | sucesso, concluido, correto, aprovado, verificar, verificado, check, success, done | check, circle-check, badge-check, square-check
alert | alerta, atencao, risco, aviso, problema, perigo, warning, risk, danger | triangle-alert, octagon-alert, bell-ring, siren
info | informacao, ajuda, duvida, info, help | info, circle-help, lightbulb
settings | configuracao, ajuste, ajustes, engrenagem, configurar, settings, config | settings, sliders-horizontal, cog, settings-2
process | processo, processos, etapa, etapas, fluxo, passo a passo, workflow, pipeline, automatizar, process | workflow, git-branch, list-ordered, footprints, refresh-cw
automation | automatico, automacao, automatizado, robotica, automation, repetir | bot, workflow, repeat, cog
tools | ferramenta, ferramentas, manutencao, reparo, construir, conserto, tools, build | wrench, hammer, tool-case, construction
learn | aprender, aprendizado, educacao, curso, estudo, estudar, escola, ensino, conhecimento, education, learning, school, course | graduation-cap, book-open, school, library, lightbulb
book | livro, leitura, ler, ebook, book, reading | book, book-open, notebook, library
document | documento, documentos, arquivo, relatorio, contrato, document, file, report | file-text, file, clipboard-list, files
video | video, videos, filme, cinema, gravacao, trailer, movie | video, clapperboard, film, play
play | reproduzir, tocar, play, assistir | play, circle-play, tv
music | musica, audio, som, trilha, trilha sonora, podcast, music, sound | music, headphones, audio-lines, mic, speaker
camera | foto, fotos, camera, imagem, fotografia, photo, image | camera, image, aperture, images
design | design, arte, criar, ilustracao, cor, cores, paleta, identidade visual, branding | palette, pen-tool, brush, shapes, swatch-book
layers | camadas, camada, estrutura em camadas, layers | layers, layers-2
layout | layout, interface, ui, ux, tela, wireframe | layout-dashboard, panel-top, layout-template, app-window
health | saude, medico, medicina, bem-estar, cuidado, hospital, health, medical, wellness | heart-pulse, stethoscope, activity, cross, pill
heart | amor, favorito, coracao, curtir, love, favorite, like | heart, heart-handshake, thumbs-up
star | estrela, qualidade, avaliacao, destaque, premium, star, rating, featured | star, sparkles, badge-check
award | premio, conquista, vitoria, campeao, trofeu, award, win, champion, success story | trophy, award, medal, crown
home | casa, imovel, lar, home, house | house, building, door-open
business | empresa, escritorio, negocio, negocios, corporativo, business, company, corporate | building-2, briefcase, landmark, store
city | cidade, urbano, futurista, city, urban, skyline, metropole | building-2, landmark, tower-control, map
location | local, mapa, localizacao, endereco, location, map, address | map-pin, map, compass, navigation
travel | viagem, aviao, turismo, voo, travel, flight, tourism | plane, luggage, tickets-plane, globe
transport | carro, transporte, veiculo, mobilidade, carros, car, vehicle, mobility, rua, estrada | car, bus, truck, bike, route
energy | energia, eletricidade, bateria, potencia, energia limpa, sustentavel, energy, power, electricity, battery | zap, battery-charging, plug, sun, wind
sun | sol, dia, solar, manha, sun, day | sun, sunrise, sun-medium
night | noite, noturno, noturna, lua, escuro, madrugada, night, moon, dark | moon, moon-star, star
light | luz, iluminacao, lampada, lanterna, brilho, luminoso, light, lighting, lamp, glow | lightbulb, lamp, flashlight, sun
weather | clima, chuva, tempo meteorologico, weather, rain | cloud-rain, cloud-sun, snowflake, thermometer
nature | natureza, ambiente, planta, sustentabilidade, verde, ecologia, nature, environment, green, eco | leaf, trees, sprout, recycle, flower-2
world | mundo, global, planeta, internacional, world, global, planet, terra | globe, earth, orbit
food | comida, alimento, alimentacao, restaurante, cozinha, food, restaurant, kitchen | utensils, chef-hat, coffee, pizza
party | festa, celebracao, aniversario, comemoracao, party, celebration, birthday | party-popper, cake, gift, sparkles
gift | presente, brinde, gift | gift, package-open
sale | desconto, oferta, promocao, cupom, sale, discount, offer, coupon | percent, tag, ticket-percent, badge-percent
flag | bandeira, marco, milestone, marco do projeto | flag, milestone, flag-triangle-right
compare | comparar, comparacao, diferenca, equilibrio, balanca, compare, balance, versus | scale, columns-2, git-compare, arrow-left-right
legal | lei, justica, regra, juridico, regulamento, legal, law, rules, compliance | scale, gavel, file-check, shield-check
trust | confianca, parceria, acordo, parceiro, trust, partnership, deal, agreement | handshake, shield-check, badge-check
eye | ver, visao, visibilidade, observar, monitorar, view, vision, monitor | eye, scan-eye, glasses
share | compartilhar, viralizar, social, redes sociais, share, viral, social media | share-2, megaphone, thumbs-up, at-sign
marketing | marketing, anuncio, divulgacao, campanha, propaganda, publicidade, advertising, campaign | megaphone, radio, newspaper, presentation
news | noticia, noticias, jornal, imprensa, news, press | newspaper, rss, radio
download | baixar, download, baixa | download, hard-drive-download, arrow-down-to-line
upload | enviar arquivo, upload, subir | upload, cloud-upload, arrow-up-from-line
sync | atualizar, sincronizar, renovar, atualizacao, update, sync, refresh | refresh-cw, rotate-cw, repeat
integrate | solucao, integracao, peca, plugin, modulo, integrar, integration, plug, solution, extension | puzzle, plug, blocks, unplug
edit | editar, edicao, escrever a mao, edit | pencil, pen-line, square-pen
write | escrever, texto, redacao, copy, write, text | text, type, pen-line, file-text
language | idioma, traducao, linguagem, language, translate | languages, message-square-text, globe
game | jogo, jogos, game, games, videogame, gamer, gta, esports | gamepad-2, joystick, dice-5, swords
sport | esporte, esportes, fitness, treino, academia, sport, workout, gym | dumbbell, trophy, bike, volleyball
science | ciencia, laboratorio, pesquisa cientifica, quimica, science, laboratory, research | flask-conical, microscope, atom, dna, test-tube
math | matematica, calculo, calcular, math, calculate | calculator, sigma, pi, divide
voice | voz, fala, narracao, narrador, microfone, voice, narration | mic, audio-waveform, speech, volume-2
three-d | 3d, realidade virtual, modelo 3d, tridimensional, vr, virtual reality | box, cuboid, glasses, orbit
infinity | infinito, continuo, ilimitado, infinity, unlimited | infinity, repeat
package | pacote, entrega, produto, logistica, encomenda, package, delivery, product, shipping | package, truck, boxes, package-check
magic | magia, magico, transformacao, magic, transform, mudanca | wand-sparkles, sparkles, wand
power | poder, forca, ligar, desligar, power, strength | power, zap, dumbbell
lightning | raio, relampago, trovao, lightning, thunder | zap, cloud-lightning
cinema | cinematografico, cinematic, diretor, director, claquete | clapperboard, film, video, projector
orbit | orbita, espaco, galaxia, universo, space, galaxy, universe, astronomia | orbit, rocket, satellite, telescope, moon-star
satellite | satelite, sinal, transmissao, satellite, signal, broadcast | satellite, satellite-dish, radio-tower, signal
history | historia, passado, historico, memoria, history, past, memory | history, hourglass, landmark, scroll-text
question | pergunta, perguntas, faq, duvida frequente, question | circle-help, message-circle-question, search
list | lista, checklist, tarefas, todo, itens, list, tasks | list-checks, list, clipboard-check, list-todo
filter | filtro, filtrar, selecao, filter, funil, funnel | funnel, list-filter, sliders-horizontal
`.trim();

export const LEXICON = TABLE.split("\n").map((line) => {
  const [id, terms, icons] = line.split("|").map((s) => s.trim());
  return { id, terms: terms.split(",").map((t) => t.trim()).filter(Boolean), icons: icons.split(",").map((t) => t.trim()).filter(Boolean) };
});
