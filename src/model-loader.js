import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { createDeterministicMath, createSeededRandom } from "./random.js";

export const MODEL_DEFINITIONS = {
  greedy: { globalName: "GreedyModel", file: "greedy.js", label: "Greedy" },
  pattern: { globalName: "PatternModel", file: "pattern.js", label: "Pattern" },
  search: { globalName: "AlphaBetaModel", file: "alpha-beta.js", label: "Alpha-Beta" },
  tactical: { globalName: "TacticalModel", file: "tactical.js", label: "Tactical" },
  threat: { globalName: "ThreatSpaceModel", file: "threat-space.js", label: "Threat Search" },
  mcts: { globalName: "MCTSModel", file: "mcts.js", label: "MCTS" },
  policy: { globalName: "PolicyNetModel", file: "policy-net.js", label: "PolicyNet" }
};

const LOAD_ORDER = [
  "core.js",
  "greedy.js",
  "alpha-beta.js",
  "tactical.js",
  "pattern.js",
  "threat-space.js",
  "mcts.js",
  "policy-net.js"
];

export function resolveModelDirectory(sourcePath) {
  const absolute = path.resolve(process.cwd(), sourcePath);
  const directModels = path.join(absolute, "models");
  if (existsSync(path.join(directModels, "core.js"))) return directModels;
  if (existsSync(path.join(absolute, "core.js"))) return absolute;
  throw new Error(
    `Cannot find omok-web-ai model files. Tried ${directModels} and ${absolute}. ` +
    `Pass --source /path/to/omok-web-ai or --source /path/to/omok-web-ai/models.`
  );
}

export function loadModels({ source = "../omok-web-ai", seed = 123456789 } = {}) {
  const modelDir = resolveModelDirectory(source);
  const random = createSeededRandom(seed);
  const context = vm.createContext({
    console,
    performance,
    Math: createDeterministicMath(random),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  });

  for (const file of LOAD_ORDER) {
    const filePath = path.join(modelDir, file);
    if (!existsSync(filePath)) {
      if (file === "policy-net.js") continue;
      throw new Error(`Required model file is missing: ${filePath}`);
    }

    const sourceCode = readFileSync(filePath, "utf8");
    vm.runInContext(`${sourceCode}\n//# sourceURL=${filePath}`, context, {
      filename: filePath,
      displayErrors: true
    });
  }

  const expression = `({
    greedy: typeof GreedyModel !== "undefined" ? GreedyModel : undefined,
    pattern: typeof PatternModel !== "undefined" ? PatternModel : undefined,
    search: typeof AlphaBetaModel !== "undefined" ? AlphaBetaModel : undefined,
    tactical: typeof TacticalModel !== "undefined" ? TacticalModel : undefined,
    threat: typeof ThreatSpaceModel !== "undefined" ? ThreatSpaceModel : undefined,
    mcts: typeof MCTSModel !== "undefined" ? MCTSModel : undefined,
    policy: typeof PolicyNetModel !== "undefined" ? PolicyNetModel : undefined
  })`;
  const loaded = vm.runInContext(expression, context);

  return Object.fromEntries(
    Object.entries(loaded)
      .filter(([, model]) => model && typeof model.findBestMove === "function")
      .map(([id, model]) => [id, {
        id,
        label: MODEL_DEFINITIONS[id]?.label ?? id,
        findBestMove: model.findBestMove.bind(model)
      }])
  );
}
