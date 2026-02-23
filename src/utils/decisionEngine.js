// Simple heuristic-based recommendations optimizing for social stability
export function getRecommendedAction(state, phaseIndex, scenario) {
  const stability = state.socialStability?.median || 100;
  const unemployment = ((state.whiteCollarEmployment?.median || 100) +
                        (state.blueCollarEmployment?.median || 100)) / 2;
  const inequality = state.inequality?.median || 100;

  // Priority 1: Stability crisis - immediate intervention needed
  if (stability < 40) {
    if (inequality > 150) return 'wealth_tax';
    if (unemployment < 50) return 'aggressive_ubi';
    return 'regulation_slowdown';
  }

  // Priority 2: Prevent collapse - proactive stability measures
  if (stability < 60) {
    if (unemployment < 60 && phaseIndex >= 2) return 'aggressive_ubi';
    if (inequality > 140) return 'wealth_tax';
    return 'regulation_slowdown';
  }

  // Priority 3: Employment crisis - retraining while still possible
  if (unemployment < 50 && phaseIndex <= 2) {
    return 'retraining_initiative';
  }

  // Priority 4: Inequality extreme - address before it destabilizes
  if (inequality > 160) {
    return 'wealth_tax';
  }

  // Scenario-specific defaults when stable
  if (scenario === 'collapse') {
    return phaseIndex >= 2 ? 'aggressive_ubi' : 'regulation_slowdown';
  }

  if (scenario === 'accelerated' && stability > 70) {
    return 'do_nothing'; // Don't interfere if handling acceleration well
  }

  // Default: maintain stability
  return 'do_nothing';
}
