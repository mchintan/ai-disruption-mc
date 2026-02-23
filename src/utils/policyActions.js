export const POLICY_ACTIONS = [
  {
    id: 'aggressive_ubi',
    label: 'Aggressive UBI Implementation',
    description: 'Universal basic income for displaced workers',
    effects: {
      ubiProbability: { drift: +8, vol: -2 },
      socialStability: { drift: +3, vol: -2 },
      gdpGrowth: { drift: -1, vol: +1 },
      inequality: { drift: -3, vol: 0 },
    },
    applicablePhases: [2, 3, 4], // AI Workers onward
  },
  {
    id: 'regulation_slowdown',
    label: 'Heavy AI Regulation',
    description: 'Slow AI deployment to preserve employment',
    effects: {
      whiteCollarEmployment: { drift: +3, vol: -1 },
      productivity: { drift: -3, vol: -1 },
      socialStability: { drift: +2, vol: -1 },
      equities_ai: { drift: -4, vol: +2 },
    },
    applicablePhases: [0, 1, 2, 3],
  },
  {
    id: 'retraining_initiative',
    label: 'Massive Retraining Programs',
    description: 'Invest in workforce transition and upskilling',
    effects: {
      ai_orchestration: { drift: +4, vol: -1 },
      whiteCollarEmployment: { drift: +1, vol: 0 },
      socialStability: { drift: +1, vol: 0 },
      gdpGrowth: { drift: +0.5, vol: 0 },
    },
    applicablePhases: [0, 1, 2],
  },
  {
    id: 'accelerate_adoption',
    label: 'AI Acceleration Incentives',
    description: 'Tax breaks and subsidies for AI adoption',
    effects: {
      productivity: { drift: +3, vol: +2 },
      gdpGrowth: { drift: +2, vol: +2 },
      whiteCollarEmployment: { drift: -2, vol: +1 },
      socialStability: { drift: -2, vol: +1 },
      equities_ai: { drift: +3, vol: +1 },
    },
    applicablePhases: [0, 1, 2, 3],
  },
  {
    id: 'wealth_tax',
    label: 'Progressive Wealth Taxation',
    description: 'Tax AI winners to fund social programs',
    effects: {
      inequality: { drift: -4, vol: -1 },
      socialStability: { drift: +2, vol: -1 },
      equities_ai: { drift: -1, vol: +1 },
      crypto: { drift: +2, vol: 0 },
    },
    applicablePhases: [1, 2, 3, 4],
  },
  {
    id: 'do_nothing',
    label: 'Status Quo',
    description: 'No government intervention',
    effects: {},
    applicablePhases: [0, 1, 2, 3, 4],
  },
];
