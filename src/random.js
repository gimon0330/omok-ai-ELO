export function createSeededRandom(seedInput = 123456789) {
  let seed = normalizeSeed(seedInput);

  return function random() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSeed(seedInput) {
  const text = String(seedInput ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDeterministicMath(random) {
  const deterministicMath = Object.create(Math);
  Object.defineProperty(deterministicMath, "random", {
    value: random,
    enumerable: false,
    configurable: true,
    writable: true
  });
  return deterministicMath;
}
