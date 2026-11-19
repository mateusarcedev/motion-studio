#!/usr/bin/env node
/**
 * MOTION Studio — Unified CLI
 */
import { runInit } from "../lib/init.mjs";
import { runDoctor } from "../lib/doctor.mjs";
import { runList } from "../lib/list.mjs";
import { runCreate } from "../lib/create.mjs";
import { runPreview } from "../lib/preview.mjs";
import { runRender } from "../lib/render.mjs";
import { runExport } from "../lib/export.mjs";
import { runQA } from "../lib/qa.mjs";
import { runComponents } from "../lib/components.mjs";
import { runTransition } from "../lib/transition.mjs";

const VERSION = "1.0.0-rc.4";

const rawArgs = process.argv.slice(2);
const flags = {};
const posArgs = [];

for (let index = 0; index < rawArgs.length; index++) {
  const a = rawArgs[index];
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) flags[k] = v;
    else if (rawArgs[index + 1] && !rawArgs[index + 1].startsWith("-")) flags[k] = rawArgs[++index];
    else flags[k] = true;
  } else if (a.startsWith("-") && a.length === 2) {
    flags[a.slice(1)] = true;
  } else {
    posArgs.push(a);
  }
}

const command = posArgs[0];

function printHelp() {
  console.log(`
MOTION Studio CLI — v${VERSION}
Uso: motion <comando> [opções]

Comandos principais:
  init                     Inicializa o MOTION Studio no projeto atual
    --brand=<nome>         Define o nome da marca (padrão: nome da pasta)
    --profile=<nome>       Perfil de skills: core, web, motion, social, 3d, blender, interactive, all (padrão: core)
    --force                Sobrescreve configuração existente

  doctor                   Verifica requisitos de sistema e dependências (Node, Python, FFmpeg, Chromium, etc.)

  list | specs             Lista especialidades do estúdio e capacidades dos motores

  create <tipo> <nome>     Cria um scaffold real de entregável
    Tipos suportados:      website, video, carousel, story, post, lesson

  preview [caminho]        Inicia servidor HTTP local de pré-visualização
    --port=<num>           Porta HTTP (padrão: 3300)

  render <modo> ...        Executa renderização real com motores determinísticos
    render static <html_in> <png_out> [--width=W] [--height=H] [--scale=N]
    render frames <comp_in> <outdir> [--frames=N] [--fps=30]
    render video <frames_dir> <mp4_out> [--fps=30] [--audio=trilha]
    render carousel <slides_dir> <outdir>
    render project <pasta_do_projeto>
    render overlay <html_in> --output=<webm_out> [--duration=8] [--fps=30] [--width=1080] [--height=1920]

  export <pasta> <zip_out> Gera manifesto SHA-256 e empacota entrega final em ZIP
    --gallery              Registra a peça na galeria local (status: draft)

  qa <url_ou_html> <outdir> Executa auditoria multi-viewport em 5 telas com Playwright
  qa determinism <html> [--output=<dir>] Verifica hashes em duas sessões independentes
  qa safe-zones <html> [--platform=instagram-reels] [--preset-file=<json>] [--output=<dir>]

  components list          Lista componentes reutilizáveis e seus schemas
  components render <id> --config=<json> --output=<mp4|webm>
  components preview <id> --config=<json> --output=<png>

  transition list          Lista transições FFmpeg disponíveis
  transition render <cena1> <cena2> [...] --output=<mp4> [--kind=wipe] [--easing=ease-out]
  transition preview <cena1> <cena2> [...] --output=<mp4> Renderiza prévia 640×360 a 15fps

Opções globais:
  -v, --version            Exibe a versão do MOTION Studio
  -h, --help               Exibe esta ajuda
`);
}

if (flags.version || flags.v || command === "version") {
  console.log(`motion v${VERSION}`);
  process.exit(0);
}

if (!command || flags.help || flags.h) {
  printHelp();
  process.exit(0);
}

try {
  switch (command.toLowerCase()) {
    case "init":
      await runInit(flags);
      break;

    case "doctor":
      await runDoctor(flags);
      break;

    case "list":
    case "specs":
      await runList(flags);
      break;

    case "create":
      await runCreate(posArgs[1], posArgs[2], flags);
      break;

    case "preview":
      await runPreview(posArgs[1] || ".", flags);
      break;

    case "render":
      await runRender(posArgs[1], posArgs[2], posArgs[3], flags, posArgs.slice(2));
      break;

    case "export":
      await runExport(posArgs[1], posArgs[2], flags);
      break;

    case "qa":
      await runQA(posArgs[1], posArgs[2], flags);
      break;

    case "components":
      await runComponents(posArgs[1], posArgs[2], flags);
      break;

    case "transition":
      await runTransition(posArgs[1], posArgs.slice(2), flags);
      break;

    default:
      console.error(`Comando desconhecido: '${command}'`);
      printHelp();
      process.exit(1);
  }
} catch (err) {
  console.error("\n❌ Erro durante a execução:", err.message);
  process.exit(1);
}
