// Helper functions for random number generation
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function boxMuller(rng) {
  const u1 = rng(), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
}

// Decision-aware Brownian motion path generation
export function runBrownianPathsWithDecisions(
  config,
  numPaths,
  numYears,
  seed,
  scenario,
  decisionHistory = []
) {
  const paths = [];
  const dt = 1;

  for (let p = 0; p < numPaths; p++) {
    const rng = mulberry32(seed + p * 7919);
    const path = [{ year: 2024, value: config.base }];
    let val = config.base;

    for (let y = 1; y <= numYears; y++) {
      const year = 2024 + y;
      let driftMod = config.drift;
      let volMod = config.vol;

      // Original phase multipliers
      if (year >= 2028 && year < 2031) { driftMod *= 1.3; volMod *= 1.2; }
      if (year >= 2031 && year < 2035) { driftMod *= 1.6; volMod *= 1.5; }
      if (year >= 2035) { driftMod *= 2.0; volMod *= 1.8; }

      // Original scenario multipliers
      if (scenario === "accelerated") { driftMod *= 1.5; volMod *= 1.3; }
      if (scenario === "regulated") { driftMod *= 0.5; volMod *= 0.7; }
      if (scenario === "collapse") { driftMod *= 1.8; volMod *= 2.0; }

      // NEW: Apply decision effects
      const activeDecisions = decisionHistory.filter(d => d.year <= year);
      activeDecisions.forEach(decision => {
        const effect = decision.action.effects[config.key];
        if (effect) {
          // Effects decay over 5 years (half-life)
          const yearsActive = year - decision.year;
          const decay = Math.pow(0.5, yearsActive / 5);

          driftMod += effect.drift * decay;
          volMod = Math.max(1, volMod + effect.vol * decay); // Vol can't go below 1
        }
      });

      const shock = boxMuller(rng);
      val = val + driftMod * dt + volMod * Math.sqrt(dt) * shock;
      if (config.floor !== undefined) val = Math.max(val, config.floor);
      if (config.cap !== undefined) val = Math.min(val, config.cap);
      path.push({ year, value: Math.round(val * 100) / 100 });
    }
    paths.push(path);
  }
  return paths;
}
