#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadModels, MODEL_DEFINITIONS } from "./model-loader.js";
import { formatTournament, toCsv } from "./format.js";
import { runTournament } from "./tournament.js";

const DEFAULT_MODELS = ["greedy", "pattern", "search", "tactical", "threat", "mcts"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const loadedModels = loadModels({ source: args.source, seed: args.seed });
  const modelIds = parseModelList(args.models, loadedModels);

  const missing = modelIds.filter(id => !loadedModels[id]);
  if (missing.length > 0) {
    throw new Error(`Requested model(s) were not loaded: ${missing.join(", ")}`);
  }

  if (modelIds.includes("policy")) {
    console.warn("[warning] PolicyNet runs through its built-in fallback unless TensorFlow.js and ./assets/policy-net/model.json are available in the model environment.");
  }

  console.log(`Running ${modelIds.length} models: ${modelIds.join(", ")}`);
  console.log(`Games per pair: ${args.games}, depth: ${args.depth}, source: ${args.source}`);

  const result = await runTournament(loadedModels, {
    modelIds,
    gamesPerPair: args.games,
    depth: args.depth,
    kFactor: args.k,
    initialElo: args.initialElo,
    maxPlies: args.maxPlies,
    moveTimeoutMs: args.moveTimeoutMs,
    onGame: args.quiet ? undefined : (game, state) => {
      const winner = game.winner ?? "draw";
      console.log(`#${game.game} ${game.black}(B) vs ${game.white}(W): ${winner} [${game.reason}]`);
    }
  });

  console.log(formatTournament(result));

  if (args.json) {
    writeOutput(args.json, JSON.stringify(result, null, 2) + "\n");
    console.log(`JSON written to ${args.json}`);
  }

  if (args.csv) {
    writeOutput(args.csv, toCsv(result));
    console.log(`CSV written to ${args.csv}`);
  }
}

function parseArgs(argv) {
  const out = {
    source: "../omok-web-ai",
    games: 2,
    depth: 2,
    k: 32,
    initialElo: 1000,
    maxPlies: 225,
    moveTimeoutMs: 0,
    seed: 20260523,
    models: DEFAULT_MODELS.join(","),
    json: "",
    csv: "",
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") out.help = true;
    else if (token === "--quiet" || token === "-q") out.quiet = true;
    else if (token.startsWith("--")) {
      const [key, inlineValue] = token.slice(2).split("=", 2);
      const value = inlineValue ?? argv[++i];
      if (value === undefined) throw new Error(`Missing value for --${key}`);
      assignArg(out, key, value);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return out;
}

function assignArg(out, key, value) {
  switch (key) {
    case "source": out.source = value; break;
    case "games": out.games = positiveInteger(value, "games"); break;
    case "depth": out.depth = positiveInteger(value, "depth"); break;
    case "k": out.k = positiveNumber(value, "k"); break;
    case "initial-elo": out.initialElo = positiveNumber(value, "initial-elo"); break;
    case "max-plies": out.maxPlies = positiveInteger(value, "max-plies"); break;
    case "move-timeout-ms": out.moveTimeoutMs = Number(value); break;
    case "seed": out.seed = value; break;
    case "models": out.models = value; break;
    case "json": out.json = value; break;
    case "csv": out.csv = value; break;
    default: throw new Error(`Unknown option: --${key}`);
  }
}

function parseModelList(value, loadedModels) {
  if (value === "all") {
    return Object.keys(MODEL_DEFINITIONS).filter(id => loadedModels[id]);
  }

  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

function positiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number.`);
  return parsed;
}

function writeOutput(filePath, content) {
  const absolute = path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function printHelp() {
  console.log(`Omok AI Elo evaluator

Usage:
  npm start -- --source ../omok-web-ai --games 10 --depth 2

Options:
  --source <path>          omok-web-ai repo path or models directory. Default: ../omok-web-ai
  --models <list|all>      Comma-separated model IDs. Default: ${DEFAULT_MODELS.join(",")}
                           Available: ${Object.keys(MODEL_DEFINITIONS).join(",")}
  --games <n>             Games per model pair. Colors are alternated. Default: 2
  --depth <n>             Search depth passed to each model. Default: 2
  --k <number>            Elo K-factor. Default: 32
  --initial-elo <number>  Initial Elo rating. Default: 1000
  --max-plies <n>         Draw after this many plies. Default: 225
  --move-timeout-ms <n>   Mark a move as loss if it exceeds this time. 0 disables. Default: 0
  --seed <value>          Seed for deterministic Math.random in loaded models. Default: 20260523
  --json <path>           Write full results as JSON.
  --csv <path>            Write ranking as CSV.
  --quiet                 Hide per-game progress.
  --help                  Show this help.
`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
