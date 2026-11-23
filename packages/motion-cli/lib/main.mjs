/**
 * MOTION Studio — CLI entry (shared by `motion` and `motion-studio`).
 */
import { runInit } from "./init.mjs";
import { runDoctor } from "./doctor.mjs";
import { runList } from "./list.mjs";
import { runCreate } from "./create.mjs";
import { runPreview } from "./preview.mjs";
import { runRender } from "./render.mjs";
import { runExport } from "./export.mjs";
import { runQA } from "./qa.mjs";
import { runComponents } from "./components.mjs";
import { runTransition } from "./transition.mjs";
import { runAssets, runSvg } from "./assets.mjs";
import { runEdit, runAudio, runStt } from "./edit.mjs";
import { VERSION } from "./version.mjs";

export async function main(rawArgs = process.argv.slice(2), { bin = "motion" } = {}) {

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
  Uso: ${bin} <comando> [opções]

  Comandos principais:
    init                     Inicializa o MOTION Studio no projeto atual
      --brand=<nome>         Define o nome da marca (padrão: nome da pasta)
      --profile=<nome>       Perfil de skills (padrão: all = as 13 Skills oficiais)
      --force                Substitui configuração/Skills divergentes (com backup)
      --agents=<lista>       claude,codex,gemini,opencode,copilot (padrão: detecção automática)
      --with-package-json    Cria package.json mínimo se não existir (padrão: modo standalone)
      --skip-install         Não instala dependências; usa os arquivos do pacote em execução
      --strict               Falha (exit 3) se motores obrigatórios estiverem ausentes
      --json                 Relatório em JSON

    doctor                   Verifica requisitos de sistema e dependências (Node, Python, FFmpeg, Chromium, etc.)

    list | specs             Lista especialidades do estúdio e capacidades dos motores

    create <tipo> <nome>     Cria um scaffold real de entregável
      Tipos suportados:      website, video, carousel, story, post, lesson

    preview [caminho]        Inicia servidor HTTP local de pré-visualização
      --port=<num>           Porta HTTP (padrão: 3300)

    render <modo> ...        Executa renderização real com motores determinísticos
      render static <html_in> <png_out> [--width=W] [--height=H] [--scale=N] [--qa-visual --qa-context=web|story-vertical|video-vertical]
      render frames <comp_in> <outdir> [--frames=N] [--fps=30]
        --sample-frames=0,120,240-250  Renderiza só estes quadros (índices e intervalos A-B, sem duplicatas)
      render video <frames_dir> <mp4_out> [--fps=30] [--audio=trilha]
      render carousel <slides_dir> <outdir>
      render project <pasta_do_projeto>
      render overlay <html_in> --output=<webm_out> [--duration=8] [--fps=30] [--width=1080] [--height=1920]

    export <pasta> <zip_out> Gera contrato/manifesto, empacota e valida o ZIP final
      --gallery              Registra a peça na galeria local (status: draft)

    qa <url_ou_html> <outdir> Executa auditoria multi-viewport em 5 telas com Playwright
    qa determinism <html> [--output=<dir>] Verifica hashes em duas sessões independentes
    qa media <mp4> [--width= --height= --fps= --duration= --audio --context=temporal-context.json]   Codec, FPS, duração, áudio, sincronismo, silêncio, loudness, decodificação
    qa frames <pasta> [--expected=N] [--dark-mean=25 --context=temporal-context.json]   Quadros vazios/escuros/repetidos (heurísticas) · qa precheck <projeto>: relatório para o Crítico
    qa delivery --project <pasta> --zip <entrega.zip>   Verifica contrato, manifesto, hashes e o conteúdo real do ZIP
    qa safe-zones <html> [--platform=instagram-reels] [--preset-file=<json>] [--output=<dir>]
    qa reel <reel.mp4> [--timeline=edit.json] [--compare=<2º render>] [--json]   QA do Smart Reel Editor

    qa critic-schema | critic-record <parecer.json> --reviews=<pasta> | critic-verify --reviews=<pasta>   Parecer do Crítico em JSON, gravado sem edição
    audio doctor             Filtros de voz e DeepFilterNet (hash conferido)
    edit <sub> ...           Smart Reel Editor & Voice Studio (motion edit --help)
      analyze · transcribe · import-srt · plan · validate · audio · captions · preview · render · progress · presets
    stt doctor|providers|setup   Speech-to-Text local (faster-whisper em venv isolado)
    mcp                      Servidor MCP local (stdio) com as operações de edição

    components list          Lista componentes reutilizáveis e seus schemas
    components render <id> --config=<json> --output=<mp4|webm>
    components preview <id> --config=<json> --output=<png>

    transition list          Lista transições FFmpeg disponíveis
    transition render <cena1> <cena2> [...] --output=<mp4> [--kind=wipe] [--easing=ease-out]
    transition preview <cena1> <cena2> [...] --output=<mp4> Renderiza prévia 640×360 a 15fps

    assets pick "<intenção>" [--kind=]   Escolhe qualquer recurso visual (ícone, animado, logo, personagem, ilustração, Lottie) — usado automaticamente pelas Skills
    assets providers · assets import <pasta> --prefix=...   Providers e licenças · importa pacote SVG local (ex.: LS Graphics) com licença declarada
    assets resolve "<intenção>"   Escolhe só o ícone certo por significado
    assets search "<consulta>"    Lista candidatos ranqueados · assets packs: pacotes de ícones e licenças
    svg validate|optimize|rasterize|component   Ferramentas SVG (validação segura, otimização, PNG, componentes)

  Opções globais:
    -v, --version            Exibe a versão do MOTION Studio
    -h, --help               Exibe esta ajuda
  `);
  }

  if (flags.version || flags.v || command === "version") {
    console.log(`${bin} v${VERSION}`);
    return 0;
  }

  if (!command || flags.help || flags.h) {
    printHelp();
    return 0;
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

      case "assets":
      case "icons":
        await runAssets(command.toLowerCase() === "icons" && !["resolve", "search", "packs"].includes(posArgs[1]) ? "search" : posArgs[1], posArgs.slice(command.toLowerCase() === "icons" && !["resolve", "search", "packs"].includes(posArgs[1]) ? 1 : 2), flags);
        break;

      case "edit":
        await runEdit(posArgs[1], posArgs.slice(2), flags);
        break;

      case "audio":
        await runAudio(posArgs[1], posArgs.slice(2), flags);
        break;
      case "stt":
        await runStt(posArgs[1], posArgs.slice(2), flags);
        break;

      case "mcp": {
        const { runMcpServer } = await import("./mcp.mjs");
        await runMcpServer(flags);
        break;
      }

      case "svg":
        await runSvg(posArgs[1], posArgs.slice(2), flags);
        break;

      default:
        console.error(`Comando desconhecido: '${command}'`);
        printHelp();
        return 1;
    }
  } catch (err) {
    // Renderers return a structured JSON report; show the actionable part, not a raw process dump.
    const report = err.report;
    if (report?.schemaVersion === 1 && Array.isArray(report.findings)) {
      console.error(JSON.stringify(report, null, 2));
    } else if (report?.error) {
      console.error(`\n❌ [${report.error.code}] ${report.error.message}`);
      if (report.error.hint) console.error(`   → ${report.error.hint}`);
    } else if (report?.health?.errors?.length) {
      console.error("\n❌ A renderização foi concluída com falhas e não pode ser aprovada:");
      for (const e of report.health.errors.slice(0, 8)) {
        console.error(`   • [${e.code}] ${e.message}${e.frame != null ? ` (quadro ${e.frame})` : ""}`);
        if (e.hint) console.error(`     → ${e.hint}`);
      }
    } else if (err.code && String(err.code).startsWith("MOTION_")) {
      console.error(`\n❌ [${err.code}] ${err.message}`);
      if (err.hint) console.error(`   → ${err.hint}`);
    } else {
      console.error("\n❌ Erro durante a execução:", err.message);
    }
    return err.exitCode && err.exitCode > 1 ? err.exitCode : 1;
  }

  return process.exitCode ?? 0;
}
