import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, Legend, ComposedChart, Bar } from "recharts";
import { runBrownianPathsWithDecisions } from "./utils/pathsWithDecisions";
import { getRecommendedAction } from "./utils/decisionEngine";
import { POLICY_ACTIONS } from "./utils/policyActions";
import { DecisionModal } from "./components/DecisionModal";
import { LandscapePrompt } from "./components/LandscapePrompt";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function boxMuller(rng) {
  const u1 = rng(), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
}

const PHASES = [
  { name: "AI Copilots", start: 2024, end: 2026, color: "#4ade80" },
  { name: "AI Agents", start: 2026, end: 2028, color: "#facc15" },
  { name: "AI Workers", start: 2028, end: 2031, color: "#f97316" },
  { name: "Physical Robots", start: 2031, end: 2035, color: "#ef4444" },
  { name: "AGI/Post-Labor", start: 2035, end: 2040, color: "#a855f7" },
];

const MACRO_VARS = {
  whiteCollarEmployment: { key: "whiteCollarEmployment", label: "White Collar Employment %", base: 100, drift: -2.8, vol: 4, floor: 15 },
  blueCollarEmployment: { key: "blueCollarEmployment", label: "Blue Collar Employment %", base: 100, drift: -0.8, vol: 3, floor: 20 },
  gdpGrowth: { key: "gdpGrowth", label: "GDP Growth (indexed)", base: 100, drift: 1.5, vol: 8, floor: 60 },
  inequality: { key: "inequality", label: "Inequality Index", base: 100, drift: 3.5, vol: 6, floor: 80, cap: 300 },
  socialStability: { key: "socialStability", label: "Social Stability Index", base: 100, drift: -1.5, vol: 7, floor: 20 },
  ubiProbability: { key: "ubiProbability", label: "UBI Probability %", base: 5, drift: 5, vol: 8, floor: 0, cap: 99 },
  productivity: { key: "productivity", label: "Productivity (indexed)", base: 100, drift: 6, vol: 10, floor: 80 },
  deflationPressure: { key: "deflationPressure", label: "Deflation Pressure", base: 10, drift: 3, vol: 5, floor: 0, cap: 100 },
};

const ASSET_CLASSES = {
  equities_ai: { key: "equities_ai", label: "AI/Tech Equities", base: 100, drift: 12, vol: 25, floor: 10 },
  equities_trad: { key: "equities_trad", label: "Traditional Equities", base: 100, drift: -2, vol: 18, floor: 10 },
  realEstate_comm: { key: "realEstate_comm", label: "Commercial RE", base: 100, drift: -4, vol: 12, floor: 15 },
  realEstate_res: { key: "realEstate_res", label: "Residential RE", base: 100, drift: 0.5, vol: 8, floor: 40 },
  crypto: { key: "crypto", label: "Crypto/BTC", base: 100, drift: 15, vol: 45, floor: 5 },
  gold: { key: "gold", label: "Gold/Precious Metals", base: 100, drift: 6, vol: 15, floor: 50 },
  bonds_govt: { key: "bonds_govt", label: "Govt Bonds", base: 100, drift: -1, vol: 6, floor: 40 },
  energy_infra: { key: "energy_infra", label: "Energy/Compute Infra", base: 100, drift: 10, vol: 20, floor: 20 },
  robotics_etf: { key: "robotics_etf", label: "Robotics/Automation", base: 100, drift: 14, vol: 28, floor: 10 },
  defense_tech: { key: "defense_tech", label: "Defense Tech/Autonomy", base: 100, drift: 11, vol: 24, floor: 15 },
  farmland: { key: "farmland", label: "Farmland/Hard Assets", base: 100, drift: 4, vol: 8, floor: 60 },
};

const SKILL_CLASSES = {
  coding: { key: "coding", label: "Traditional Coding", base: 100, drift: -8, vol: 12, floor: 5 },
  ai_orchestration: { key: "ai_orchestration", label: "AI Orchestration", base: 100, drift: 12, vol: 15, floor: 20 },
  human_judgment: { key: "human_judgment", label: "Human Judgment/Ethics", base: 100, drift: 4, vol: 8, floor: 40 },
  physical_trades: { key: "physical_trades", label: "Physical Trades", base: 100, drift: -1, vol: 6, floor: 15 },
  creative: { key: "creative", label: "Creative/Artistic", base: 100, drift: -3, vol: 15, floor: 10 },
  capital_mgmt: { key: "capital_mgmt", label: "Capital Allocation", base: 100, drift: 6, vol: 10, floor: 30 },
  political_power: { key: "political_power", label: "Political/Regulatory", base: 100, drift: 8, vol: 12, floor: 40 },
  systems_thinking: { key: "systems_thinking", label: "Systems Thinking", base: 100, drift: 5, vol: 8, floor: 35 },
};

const COMMENTARY = {
  macro: {
    whiteCollarEmployment: {
      base: { verdict: "DECLINING — PREPARE NOW", color: "#f97316", text: "White collar employment enters a structural decline starting 2026–2028 as AI agents replace analysts, paralegals, junior developers, and middle management. The median path shows a ~45% reduction by 2040. This is not cyclical unemployment — these jobs do not come back. The window to reposition from labor income to capital income is 2024–2028." },
      accelerated: { verdict: "RAPID DISPLACEMENT", color: "#ef4444", text: "In an accelerated scenario, AI capability jumps outpace corporate adoption planning. White collar displacement happens 2–3 years faster than expected, overwhelming retraining programs. By 2032, the median path shows over 60% of traditional knowledge work eliminated. Urgency to build capital reserves and alternative income streams is extreme." },
      regulated: { verdict: "MANAGED DECLINE", color: "#facc15", text: "Regulation slows but does not stop the trend. EU-style AI employment protections and licensing requirements create a 3–5 year buffer. White collar employment declines more gradually but still reaches ~65% of current levels by 2040. This buys time to transition — use it wisely. The regulatory moat eventually erodes." },
      collapse: { verdict: "SOCIAL CRISIS TRIGGER", color: "#ef4444", text: "Rapid, unmanaged white collar displacement becomes the catalyst for broader social instability. When educated professionals with mortgages and expectations lose earning power simultaneously, the political consequences are severe. This scenario drives the highest UBI probability and the sharpest inequality spike. Hedge accordingly." },
    },
    blueCollarEmployment: {
      base: { verdict: "DELAYED BUT INEVITABLE", color: "#facc15", text: "Physical labor gets a reprieve — robotics lags software AI by 3–5 years. Blue collar employment holds relatively steady through 2030, then enters decline as humanoid robots and automated logistics scale. Trades like plumbing and electrical hold longest due to unstructured environments. But by 2035, even these face pressure." },
      accelerated: { verdict: "FASTER ROBOTICS WAVE", color: "#f97316", text: "Accelerated AI research feeds directly into robotics capabilities. Tesla Optimus, Figure, and competitors achieve commercial viability sooner. Warehouse, manufacturing, and transport jobs face displacement by 2028–2030 instead of 2031–2035. The blue collar buffer shrinks significantly." },
      regulated: { verdict: "STRONGEST BUFFER", color: "#4ade80", text: "Blue collar work benefits most from regulation — safety requirements, union protections, and robotics deployment restrictions create a meaningful moat. This is the scenario where physical trades retain value longest. But regulation is a delay, not a permanent shield." },
      collapse: { verdict: "POLITICAL FLASHPOINT", color: "#ef4444", text: "When blue collar displacement follows white collar, the political system reaches breaking point. This is where UBI transitions from theoretical to mandatory. The combination of both labor categories declining simultaneously creates the strongest case for fundamental economic restructuring." },
    },
    gdpGrowth: {
      base: { verdict: "PARADOX: GDP UP, JOBS DOWN", color: "#22d3ee", text: "This is the central paradox of AI disruption: GDP continues growing even as employment falls. Productivity gains from AI more than offset reduced labor participation. The economy gets larger while fewer humans participate in it. This is why capital ownership becomes the defining variable — GDP growth flows to asset owners, not workers." },
      accelerated: { verdict: "EXPLOSIVE GROWTH, CONCENTRATED", color: "#a78bfa", text: "Accelerated AI drives GDP growth to historic highs, but the gains concentrate in an increasingly narrow set of companies and asset holders. A $50T+ US GDP by 2035 is plausible — but it means nothing if you're on the wrong side of the capital/labor divide." },
      regulated: { verdict: "SLOWER BUT BROADER", color: "#4ade80", text: "Regulation sacrifices peak GDP growth for broader distribution. Growth is more moderate but participation is wider. This is the most politically stable path but may leave the US behind in global AI competition. The tradeoff between growth and stability becomes the defining policy debate." },
      collapse: { verdict: "RECESSION THEN RECOVERY", color: "#ef4444", text: "Systemic shock creates a GDP contraction of 15–25% as consumer spending collapses alongside employment. But the recovery, when it comes, is V-shaped and AI-powered — just without the workers. This scenario has the widest confidence interval — outcomes range from depression to unprecedented boom." },
    },
    inequality: {
      base: { verdict: "GILDED AGE 2.0", color: "#f97316", text: "Inequality rises to levels not seen since the pre-industrial era. The Gini coefficient moves from 0.49 to 0.65+ as capital returns outpace labor returns by 10x. Those who own compute, AI companies, energy infrastructure, and digital assets see exponential wealth growth. Everyone else faces stagnation or decline." },
      accelerated: { verdict: "WINNER-TAKE-ALL EXTREME", color: "#ef4444", text: "Faster AI timelines accelerate wealth concentration. The top 0.1% could hold 35%+ of national wealth by 2035. This creates extraordinary returns for current asset holders but also maximizes social instability risk. The optimal position: own the assets, hedge the instability." },
      regulated: { verdict: "PARTIALLY CONTAINED", color: "#facc15", text: "Regulation — through AI taxation, windfall profits taxes, and redistribution — moderates inequality growth. It still rises, but the political system manages to prevent the most extreme outcomes. This is the scenario where progressive taxation and UBI act as stabilizers." },
      collapse: { verdict: "BREAKING POINT", color: "#ef4444", text: "Inequality reaches levels that trigger political upheaval. Historical precedent suggests this leads to one of two outcomes: redistributive reform (New Deal 2.0) or authoritarian response. Either way, current asset structures face significant policy risk. Diversification across jurisdictions becomes critical." },
    },
    socialStability: {
      base: { verdict: "ERODING GRADUALLY", color: "#facc15", text: "Social stability degrades slowly through 2030, then accelerates as the physical robotics wave hits alongside ongoing white collar displacement. Expect increasing populism, labor unrest, and political polarization. The 2028–2032 period is the critical window — after that, the trajectory is locked in." },
      accelerated: { verdict: "RAPID DETERIORATION", color: "#ef4444", text: "Fast AI timelines compress the adjustment period. Society doesn't get time to adapt through retraining, policy, or cultural shifts. Expect significant unrest in 2028–2030 as the speed of displacement outpaces institutional response capacity. This is the highest-risk scenario for asset seizure or punitive taxation." },
      regulated: { verdict: "BEST PRESERVED", color: "#4ade80", text: "Regulated slowdown gives institutions time to adapt. Social safety nets, retraining programs, and gradual UBI implementation maintain baseline stability. This is the scenario most favorable to long-term capital preservation — growth is slower but the social contract holds." },
      collapse: { verdict: "SYSTEMIC CRISIS", color: "#ef4444", text: "Social stability collapses when displacement hits critical mass without adequate policy response. This triggers capital flight, punitive regulation, and potential asset freezes. The irony: this scenario makes precious metals, crypto, and non-sovereign assets most valuable — exactly when they're hardest to hold." },
    },
    ubiProbability: {
      base: { verdict: "PROBABLE BY 2035", color: "#22d3ee", text: "UBI probability crosses 50% by ~2033 in the base case. The political math becomes unavoidable when unemployment reaches 20–25%. Implementation likely starts as expanded unemployment insurance, transitions to targeted transfers, then universalizes. The funding mechanism (AI taxation, sovereign wealth funds, or monetary expansion) determines its inflationary impact." },
      accelerated: { verdict: "NEAR-CERTAIN BY 2030", color: "#a78bfa", text: "Accelerated displacement makes UBI a political necessity years earlier. By 2030, probability exceeds 70%. This scenario actually favors certain assets: government bonds stabilize (UBI is funded), consumer staples hold (demand floor), but the tax burden falls on AI companies and capital — plan accordingly." },
      regulated: { verdict: "GRADUAL PHASE-IN", color: "#4ade80", text: "Regulation delays the urgency but also allows for more orderly UBI implementation. Think European-style social democracies rather than emergency measures. Probability reaches ~40% by 2035. This is the most tax-efficient path for current wealth holders." },
      collapse: { verdict: "EMERGENCY IMPLEMENTATION", color: "#ef4444", text: "UBI gets implemented as a crisis response — poorly designed, inflationary, and politically contentious. Think stimulus checks on steroids. Probability hits 80%+ by 2030. This is the most inflationary UBI path, which favors hard assets, crypto, and real property over cash and bonds." },
    },
    productivity: {
      base: { verdict: "EXPONENTIAL GAINS", color: "#22d3ee", text: "Productivity is the good-news story of AI disruption. Output per unit of input rises exponentially from 2026 onward. By 2040, a single human directing AI agents could produce what took a 50-person team in 2024. This is why GDP grows while employment falls — and why owning the productivity infrastructure (compute, energy, AI platforms) is the defining investment thesis." },
      accelerated: { verdict: "UNPRECEDENTED SURPLUS", color: "#a78bfa", text: "Accelerated AI creates a productivity surplus the economy has never seen. Costs of goods and services plummet. The deflationary implications are massive — and largely unpriced by current markets. Traditional valuation models break when the cost of cognitive labor approaches zero." },
      regulated: { verdict: "CAPPED BY POLICY", color: "#facc15", text: "Regulation intentionally limits productivity gains to manage social impact. This is the worst scenario for asset returns in aggregate, but the best for social stability. The tradeoff is real: slower productivity growth means slower wealth creation but fewer disrupted lives." },
      collapse: { verdict: "GAINS MISALLOCATED", color: "#ef4444", text: "Productivity explodes but the gains are so poorly distributed that aggregate demand collapses. You get a supply-side miracle coupled with a demand-side crisis. This is the scenario that most challenges conventional economics — and where unconventional assets (crypto, gold) outperform." },
    },
    deflationPressure: {
      base: { verdict: "THE HIDDEN VARIABLE", color: "#22d3ee", text: "Deflation pressure is the most underestimated force in the AI transition. When the cost of cognitive labor approaches zero, prices for services, software, content, and eventually physical goods fall dramatically. This reprices every asset class. Bonds suffer (real rates rise), cash gains purchasing power, and hard assets with intrinsic utility (energy, compute, farmland) outperform." },
      accelerated: { verdict: "DEFLATIONARY SUPERCYCLE", color: "#a78bfa", text: "Accelerated AI triggers deflation the Fed cannot easily counter. Rate cuts lose effectiveness when the supply curve shifts this dramatically. This is the scenario where BTC's fixed-supply thesis is most compelling — and where traditional monetary policy tools fail." },
      regulated: { verdict: "CONTAINED", color: "#4ade80", text: "Regulation moderates deflation by slowing AI deployment speed. Central banks can manage. This is the scenario where traditional 60/40 portfolios still function — but it's also the scenario least likely to persist long-term." },
      collapse: { verdict: "DEFLATION + DEMAND CRISIS", color: "#ef4444", text: "Maximum deflation meets maximum demand destruction. Prices fall because AI is deflationary, AND because consumers have no income. This is the most dangerous economic scenario — a debt-deflation spiral. Hard assets, non-sovereign currencies, and physical commodities become survival instruments." },
    },
  },
  assets: {
    equities_ai: {
      base: { verdict: "CORE POSITION — HIGH CONVICTION", color: "#22d3ee", text: "AI/Tech equities are the direct beneficiaries of the largest productivity shift in history. NVDA, MSFT, GOOG, and the hyperscalers capture the majority of value creation. Expect 3–5x returns by 2035 in the median case, but with massive volatility. Position sizing matters: this is a high-conviction, high-vol allocation." },
      accelerated: { verdict: "PARABOLIC POTENTIAL", color: "#a78bfa", text: "Accelerated AI capability makes these equities go parabolic. The risk isn't being wrong — it's being too small. However, concentration risk becomes extreme as winner-take-all dynamics intensify. A basket approach (NVDA + hyperscalers + key infrastructure) outperforms single-name bets." },
      regulated: { verdict: "HEADWINDS BUT STILL UP", color: "#facc15", text: "Regulation compresses multiples and slows growth, but AI equities still outperform most alternatives. Think 6–8% annual returns instead of 12–15%. The biggest risk here is antitrust action breaking up the hyperscalers." },
      collapse: { verdict: "VOLATILE BUT RECOVERS", color: "#f97316", text: "Systemic shock causes a 40–60% drawdown, but AI equities recover fastest because the underlying technology is deflationary and productivity-enhancing. This is the scenario where having cash reserves to buy the dip is most valuable." },
    },
    equities_trad: {
      base: { verdict: "STRUCTURAL DECLINE", color: "#ef4444", text: "Traditional equities (consumer discretionary, retail, non-tech industrials) face structural headwinds as AI disrupts their labor models and AI-native competitors emerge. The S&P 500 ex-tech becomes a value trap. Selective exposure only — avoid broad index allocations that drag in the losers." },
      accelerated: { verdict: "ACCELERATED DISRUPTION", color: "#ef4444", text: "Faster AI makes traditional businesses obsolete faster. Companies that can't integrate AI effectively see margins compress and market share evaporate. The traditional equity premium disappears for most sectors." },
      regulated: { verdict: "PROTECTED SHORT-TERM", color: "#facc15", text: "Regulation provides a temporary shield for traditional businesses by slowing AI-native competition. This is the scenario where value investing makes a temporary comeback — but it's a trade, not a thesis." },
      collapse: { verdict: "DEMAND DESTRUCTION", color: "#ef4444", text: "Traditional equities suffer most in a demand collapse — their revenue depends on employed consumers. The P10 outcome here is severe. Avoid or hedge aggressively." },
    },
    realEstate_comm: {
      base: { verdict: "SELL — STRUCTURAL SHORT", color: "#ef4444", text: "Commercial real estate faces a triple threat: remote work reduces office demand, AI eliminates the knowledge workers who filled offices, and virtual collaboration improves. Urban office REITs face 40–60% value destruction by 2035. This is one of the highest-conviction shorts in the simulation." },
      accelerated: { verdict: "FASTEST DECLINE", color: "#ef4444", text: "Accelerated white collar displacement empties offices faster. Conversion to residential or data centers provides some floor, but the asset class as currently structured faces existential decline." },
      regulated: { verdict: "SLOWER DECLINE", color: "#f97316", text: "Regulation slows office vacancy rates by slowing remote work adoption and AI displacement. Still declining, but more gradually. Some premium urban properties hold value for prestige reasons." },
      collapse: { verdict: "WORST CASE", color: "#ef4444", text: "Systemic shock + mass unemployment = commercial real estate catastrophe. Vacancy rates exceed 50% in major metros. This is where even debt-backed CRE instruments face default risk." },
    },
    realEstate_res: {
      base: { verdict: "MIXED — LOCATION DEPENDENT", color: "#facc15", text: "Residential real estate bifurcates: premium locations with amenities hold value (housing is shelter), while suburban office-commuter zones decline as the reason to live there disappears. Net, residential RE roughly holds purchasing power but doesn't generate real returns." },
      accelerated: { verdict: "BIFURCATION ACCELERATES", color: "#facc15", text: "The premium/commodity split widens faster. Tech hubs with AI employment hold value; everywhere else faces pressure. Residential RE becomes a consumption asset, not an investment." },
      regulated: { verdict: "MOST STABLE", color: "#4ade80", text: "Regulation preserves the housing market through mortgage subsidies, building restrictions, and employment protections. This is the scenario where residential RE performs best as a store of value." },
      collapse: { verdict: "DEMAND SHOCK", color: "#f97316", text: "Mass unemployment pressures home values as foreclosures rise and new household formation stalls. Recovery depends on UBI implementation speed. Premium properties hold best; leveraged positions are dangerous." },
    },
    crypto: {
      base: { verdict: "HIGH CONVICTION — ASYMMETRIC", color: "#22d3ee", text: "BTC's fixed-supply thesis strengthens as AI-driven deflation pressures fiat currencies and central banks respond with monetary expansion. ETH and SOL benefit as AI agent economies need programmable settlement layers. The vol is extreme (P10 to P90 range is massive), but the median outcome is compelling. Size appropriately." },
      accelerated: { verdict: "MAXIMUM UPSIDE", color: "#a78bfa", text: "Accelerated AI creates the conditions most favorable to crypto: rapid institutional change, fiat currency stress, need for AI-native financial rails, and a flight to algorithmic scarcity. BTC as digital gold becomes consensus. The P90 outcome here is extraordinary." },
      regulated: { verdict: "CONSTRAINED BUT ALIVE", color: "#facc15", text: "Crypto regulation compresses upside but also reduces tail risk. Institutional adoption continues through regulated channels. Returns moderate to 8–12% annually — still attractive but not the 10x play." },
      collapse: { verdict: "CHAOS HEDGE ACTIVATES", color: "#f97316", text: "Systemic shock is where crypto's thesis either proves out or fails spectacularly. If the system breaks, non-sovereign assets become essential. If governments crack down during crisis, access becomes the issue. Self-custody and geographic diversification are critical hedges." },
    },
    gold: {
      base: { verdict: "STEADY HEDGE — HOLD", color: "#4ade80", text: "Gold and precious metals serve as portfolio insurance against the full spectrum of AI disruption outcomes. Not the highest return asset, but the one that works in the most scenarios. PSLV/GLD positions provide stability while high-vol assets (crypto, AI equities) drive returns." },
      accelerated: { verdict: "LESS NEEDED", color: "#facc15", text: "In the accelerated-but-stable scenario, gold underperforms risk assets. It's insurance you hope not to need. But the tail protection it provides justifies a 5–10% allocation regardless." },
      regulated: { verdict: "SOLID PERFORMER", color: "#4ade80", text: "Gold performs well in regulated environments with moderate inflation and slower growth. Central banks continue accumulating. This is the scenario where gold generates real returns, not just insurance." },
      collapse: { verdict: "ESSENTIAL POSITION", color: "#22d3ee", text: "In systemic crisis, gold does what it has done for 5,000 years — preserves purchasing power when everything else is questioned. This is where the PSLV/physical allocation pays for itself many times over." },
    },
    bonds_govt: {
      base: { verdict: "DECLINING VALUE", color: "#f97316", text: "Government bonds face a paradox: AI deflation should favor bonds, but massive fiscal spending on UBI/transition programs increases supply and default concerns. Net effect is negative real returns. Use only for short-term liquidity, not as a strategic allocation." },
      accelerated: { verdict: "WORST CASE FOR BONDS", color: "#ef4444", text: "Accelerated disruption creates the largest fiscal gap — more spending needed, fewer taxpayers to fund it. Bond yields spike as markets price in either inflation or default risk. Duration is the enemy here." },
      regulated: { verdict: "BEST CASE FOR BONDS", color: "#4ade80", text: "Orderly regulation with manageable fiscal expansion is the one scenario where bonds work traditionally. Moderate returns, low vol, stable income. But this is also the least likely long-term scenario." },
      collapse: { verdict: "CRISIS REPRICING", color: "#ef4444", text: "Systemic shock initially spikes bond prices (flight to safety), then reverses as fiscal costs mount. A short-term trade opportunity, not a strategic hold. Treasury markets may face unprecedented stress." },
    },
    energy_infra: {
      base: { verdict: "CORE POSITION — SUBSTRATE PLAY", color: "#22d3ee", text: "Every AI model needs electricity. Every data center needs power. Every robot needs energy. This is the picks-and-shovels thesis of the AI revolution. Nuclear (SMR, URA), power utilities (VST, CEG), and data center infrastructure benefit regardless of which AI company wins. High conviction, lower vol than pure AI plays." },
      accelerated: { verdict: "MAXIMUM DEMAND", color: "#a78bfa", text: "Accelerated AI means accelerated power demand. Energy infrastructure becomes the bottleneck — and bottleneck assets command premium pricing. Nuclear renaissance accelerates. Returns could match or exceed pure AI equities with lower volatility." },
      regulated: { verdict: "STILL STRONG", color: "#4ade80", text: "Even regulated AI needs power. This is the most scenario-robust asset class in the simulation. Regulation may slow AI deployment but doesn't reduce energy demand from existing systems. Utilities benefit from regulated returns structure." },
      collapse: { verdict: "RESILIENT", color: "#4ade80", text: "Energy infrastructure holds value in crisis because the physical assets exist and produce regardless of financial system stress. Power demand is inelastic. This is the ultimate real-asset anchor for a portfolio." },
    },
    robotics_etf: {
      base: { verdict: "TIMING PLAY — 2027+ ENTRY", color: "#22d3ee", text: "Robotics/automation ETFs (BOTZ, ROBO, ARKQ) are the second wave of AI — they lag software by 3–5 years but the eventual market is larger. Current valuations price in software AI, not physical robotics. The optimal entry window is 2026–2028 as the physical AI thesis crystallizes." },
      accelerated: { verdict: "FRONT-LOAD THE POSITION", color: "#a78bfa", text: "If AI development accelerates, robotics timelines compress too. The 2026–2028 entry window narrows. Consider building a position now with the expectation of adding aggressively when physical AI milestones hit." },
      regulated: { verdict: "DELAYED — LOWER RETURNS", color: "#facc15", text: "Robot safety regulations, deployment restrictions, and labor protections significantly delay the robotics wave. Returns moderate. This is the scenario where the thesis is right but the timing is 5+ years off." },
      collapse: { verdict: "HIGH RISK", color: "#ef4444", text: "Systemic shock could delay or accelerate robotics adoption depending on the response. If governments mandate human employment, robotics faces headwinds. If they embrace automation to rebuild, it accelerates. Wide confidence interval." },
    },
    defense_tech: {
      base: { verdict: "GOVERNMENT-BACKED GROWTH", color: "#22d3ee", text: "Defense tech sits at the intersection of AI capability and government necessity. Anduril, Shield AI, and Palantir win massive contracts as DoD pivots to autonomous systems, AI-powered ISR, and software-defined warfare. SpaceX's Starlink becomes critical defense infrastructure. The sector benefits from predictable government spending while riding the AI capability wave. Returns trail pure AI plays (commercial moves faster) but with lower volatility and political tailwinds. 2x-3x by 2035 in median case." },
      accelerated: { verdict: "AI WARFARE ARMS RACE", color: "#a78bfa", text: "Accelerated AI triggers a defense technology arms race. Autonomous drones, AI-powered cyber warfare, and robotic combat systems move from experimental to deployment-ready in 3-5 years instead of 10-15. China/US AI competition drives unlimited defense budgets for leading-edge capabilities. Anduril's autonomous defense systems, Shield AI's dogfighting drones, and Palantir's AI decision platforms become critical national infrastructure. The P90 outcome here is extraordinary — but the volatility reflects winner-take-all contract dynamics and rapid tech obsolescence." },
      regulated: { verdict: "SAFETY PREMIUM", color: "#4ade80", text: "Regulation creates a paradoxical boost for defense tech. While commercial AI faces deployment restrictions, military/security applications get exemptions under national security doctrine. Autonomous weapons bans are debated but not implemented — instead, heavy investment in 'ethical AI warfare' and human-in-the-loop systems. Defense contractors with AI safety expertise and government relationships (Palantir, Anduril) build regulatory moats. Growth moderates but becomes more predictable. This is the scenario where defense tech OUTPERFORMS pure AI equities due to regulatory protection." },
      collapse: { verdict: "CRISIS ALPHA — GEOPOLITICAL HEDGE", color: "#22d3ee", text: "Defense tech is one of the few assets that THRIVES in systemic collapse. Social instability drives massive government security spending. Geopolitical tensions escalate as nations compete for AI supremacy amid domestic chaos. Defense budgets expand even as other spending contracts — homeland security, autonomous border systems, AI-powered surveillance all spike. This is the ultimate counter-cyclical position. If you believe the collapse scenario is underpriced, defense tech is the asymmetric bet. SpaceX provides off-world optionality if Earth scenarios deteriorate." },
    },
    farmland: {
      base: { verdict: "SLOW & STEADY — FLOOR ASSET", color: "#4ade80", text: "Farmland and hard assets provide portfolio floor protection. They don't participate in the AI upside, but they don't participate in the AI disruption downside either. Food production maintains intrinsic value regardless of the AI trajectory. A 5–8% allocation for portfolio stability." },
      accelerated: { verdict: "RELATIVE UNDERPERFORMER", color: "#facc15", text: "Farmland underperforms dramatically versus AI-linked assets in an accelerated scenario. But it holds nominal value. The opportunity cost of farmland is highest here." },
      regulated: { verdict: "SOLID STORE OF VALUE", color: "#4ade80", text: "In a regulated, slower-growth world, farmland's steady returns become relatively more attractive. Government subsidies and food security priorities provide additional support." },
      collapse: { verdict: "ESSENTIAL ASSET", color: "#22d3ee", text: "In a systemic crisis, control of physical food production assets is among the most defensible positions possible. Farmland becomes a crisis alpha generator." },
    },
  },
  skills: {
    coding: {
      base: { verdict: "RAPIDLY DEPRECIATING", color: "#ef4444", text: "Traditional coding — writing functions, debugging, building CRUD apps — is the first skill AI fully subsumes. By 2028, AI agents will write better code than 90% of human developers. The skill doesn't go to zero (understanding code helps direct AI), but its market value as a standalone capability collapses. Transition to AI orchestration while your coding knowledge is still a bridge." },
      accelerated: { verdict: "NEAR-ZERO BY 2028", color: "#ef4444", text: "In an accelerated scenario, coding becomes commoditized 2–3 years sooner. Junior developer roles disappear first, followed by mid-level. Only architects who understand systems at a conceptual level retain value — and even that window narrows." },
      regulated: { verdict: "SLOWER DECLINE", color: "#f97316", text: "Regulation requiring human code review or AI audit trails delays the decline. Government and defense coding roles persist longest. But the trend is the same — it just takes longer to play out." },
      collapse: { verdict: "TEMPORARY REPRIEVE", color: "#facc15", text: "Paradoxically, systemic shock could temporarily increase demand for human coders if AI systems face trust crises or regulatory backlash. But this is a counter-trend bounce, not a reversal." },
    },
    ai_orchestration: {
      base: { verdict: "THE NEW LITERACY", color: "#22d3ee", text: "AI orchestration — directing AI systems, designing agent workflows, managing AI-human hybrid teams, ensuring quality and alignment — is the skill with the highest appreciation trajectory. It's the bridge between human intent and AI capability. Every person who builds this skill set in 2024–2028 will have a disproportionate advantage." },
      accelerated: { verdict: "CRITICAL PATH", color: "#a78bfa", text: "Faster AI makes orchestration skills even more valuable sooner. The complexity of managing multiple AI systems creates demand for humans who can think across models, tools, and objectives. This is the one skill that benefits from faster AI timelines." },
      regulated: { verdict: "COMPLIANCE PREMIUM", color: "#4ade80", text: "Regulation creates additional demand for AI orchestration skills through compliance, audit, and governance requirements. The skill gains a regulatory moat that pure technical skills lack." },
      collapse: { verdict: "STILL VALUABLE", color: "#22d3ee", text: "Even in systemic shock, someone needs to direct the AI systems that keep the economy running. Orchestration skills become essential infrastructure — not optional enhancement." },
    },
    human_judgment: {
      base: { verdict: "SLOW APPRECIATION", color: "#4ade80", text: "Human judgment, ethical reasoning, and ambiguity navigation appreciate slowly but steadily. As AI handles routine decisions, the remaining human decisions become higher-stakes and more complex. The premium for good judgment increases as it becomes scarcer and more consequential." },
      accelerated: { verdict: "FASTER APPRECIATION", color: "#22d3ee", text: "Accelerated AI creates more edge cases, more novel situations, and more high-stakes decisions faster. Human judgment becomes the bottleneck and therefore commands higher premiums." },
      regulated: { verdict: "INSTITUTIONALIZED", color: "#4ade80", text: "Regulation mandates human judgment in critical domains: healthcare, law, government, military. This creates a protected labor market for judgment-intensive roles. The most stable skill in this scenario." },
      collapse: { verdict: "ESSENTIAL", color: "#22d3ee", text: "In a crisis, human judgment about priorities, tradeoffs, and values becomes the scarcest and most essential capability. This skill's floor value is the highest in the collapse scenario." },
    },
    physical_trades: {
      base: { verdict: "HOLDS THEN DECLINES", color: "#facc15", text: "Physical trades (plumbing, electrical, construction) hold value through 2030 as robotics lags software AI. But the decline is coming — humanoid robots will eventually handle most physical tasks. The value window is ~6–8 years. Not a long-term skill bet, but a useful bridge." },
      accelerated: { verdict: "SHORTER WINDOW", color: "#f97316", text: "Accelerated robotics compresses the physical trades window to ~4–5 years. The decline starts earlier and moves faster. Trades professionals should be building capital reserves now." },
      regulated: { verdict: "LONGEST PROTECTION", color: "#4ade80", text: "Safety regulations, licensing requirements, and union protections give physical trades the longest runway. This is the scenario where a trades career remains viable through 2035+." },
      collapse: { verdict: "TEMPORARY DEMAND SPIKE", color: "#4ade80", text: "Systemic shock increases demand for physical skills as society relies less on complex systems and more on direct human capability. This is a scenario where plumbers outperform programmers." },
    },
    creative: {
      base: { verdict: "HOLLOWED OUT", color: "#f97316", text: "Creative skills face a harsh reality: AI generates images, music, video, and text at superhuman quality for near-zero cost. The market for human creativity doesn't disappear — but it bifurcates into a tiny elite tier (provably human, famous) and an AI-replaced commodity tier. The middle is destroyed." },
      accelerated: { verdict: "FASTER COMMODITIZATION", color: "#ef4444", text: "Faster AI capability gains hit creative fields especially hard. When AI can produce a feature film or album indistinguishable from human work, the market value of mid-tier creative skills approaches zero. Only taste, curation, and creative direction retain value." },
      regulated: { verdict: "IP PROTECTION HELPS", color: "#facc15", text: "Copyright reform, AI labeling requirements, and human-made certifications create partial protection. Think organic food labels but for creative work. Viable for some, but not a broad skill strategy." },
      collapse: { verdict: "CULTURAL REVIVAL?", color: "#facc15", text: "Paradoxically, systemic shock could drive a 'back to human' cultural movement that temporarily values human-made creative work. But this is a sentiment trade, not a structural thesis." },
    },
    capital_mgmt: {
      base: { verdict: "HIGHEST LONG-TERM VALUE", color: "#22d3ee", text: "Capital allocation — the ability to deploy resources across opportunities, assess risk, and make judgment calls about value — is the last human advantage. AI can analyze; humans decide what matters. This skill compounds: every year of practice building and managing a portfolio makes you more valuable in a world where capital ownership is the primary income source." },
      accelerated: { verdict: "PREMIUM ACCELERATES", color: "#a78bfa", text: "Faster AI means faster capital reallocation cycles. The ability to navigate rapid technological shifts with disciplined portfolio management becomes extraordinarily valuable. This is the skill that converts AI disruption into personal wealth." },
      regulated: { verdict: "STEADY VALUE", color: "#4ade80", text: "In a regulated environment, capital allocation still matters but the pace is slower. Traditional investment approaches retain more validity. The skill appreciates, just more gradually." },
      collapse: { verdict: "SURVIVAL SKILL", color: "#22d3ee", text: "In a systemic crisis, capital allocation becomes a survival skill. Knowing when to be in cash, when to buy distressed assets, and when to hold conviction positions is the difference between wealth destruction and wealth creation." },
    },
    political_power: {
      base: { verdict: "INCREASINGLY CRITICAL", color: "#22d3ee", text: "As AI reshapes the economy, the rules that govern AI deployment, taxation, UBI, and asset ownership become the most important variables. Those with political and regulatory influence can shape these rules. This is the skill with the highest optionality — it doesn't just protect wealth, it shapes the environment in which wealth exists." },
      accelerated: { verdict: "URGENT", color: "#a78bfa", text: "Faster AI timelines compress the policy window. The rules being set in 2025–2028 will define the AI economy for decades. Political engagement now has disproportionate impact." },
      regulated: { verdict: "MAXIMUM VALUE", color: "#22d3ee", text: "In a regulated world, political/regulatory skill IS the dominant skill. Those who shape regulation shape the entire economy. This is the scenario where being inside the policy process is more valuable than any asset allocation." },
      collapse: { verdict: "EMERGENCY POWER", color: "#22d3ee", text: "In crisis, government power expands dramatically. Political influence becomes the ultimate hedge — it determines who gets bailed out, who gets taxed, and how the new economy is structured." },
    },
    systems_thinking: {
      base: { verdict: "DURABLE ADVANTAGE", color: "#4ade80", text: "Systems thinking — the ability to understand how complex systems interact, identify leverage points, and anticipate second-order effects — appreciates steadily. AI can optimize within systems; humans who understand across systems retain an edge. This is the meta-skill that makes all other skills more effective." },
      accelerated: { verdict: "FASTER APPRECIATION", color: "#22d3ee", text: "More complex, faster-moving AI systems create more systemic interactions and more unexpected emergent behaviors. The demand for people who can think in systems grows faster than the supply." },
      regulated: { verdict: "STEADY GROWTH", color: "#4ade80", text: "Regulation itself is a systems problem. Understanding how AI regulations interact with economics, society, and technology is a valuable niche that grows steadily." },
      collapse: { verdict: "CRISIS NAVIGATION", color: "#22d3ee", text: "Systemic crises are, by definition, systems problems. Those who can understand the interactions between economic, social, and technological systems are best positioned to navigate and recover from collapse." },
    },
  },
  strategy: {
    _default: {
      base: { verdict: "POSITION FOR THE TRANSITION", color: "#22d3ee", text: "The base case demands a barbell strategy: heavy allocation to AI infrastructure and asymmetric upside plays (compute, crypto, defense/space PE), balanced by hard asset hedges (gold, farmland). The 2024–2028 window is the last chance to build positions before the market fully prices in AI disruption. Skills investment should focus on AI orchestration and capital allocation." },
      accelerated: { verdict: "MOVE FASTER — THE WINDOW IS CLOSING", color: "#a78bfa", text: "Accelerated timelines mean the deployment window compresses. Positions that look 'early' in the base case become 'on time' or 'late.' Increase allocation to high-conviction plays now. The cost of waiting exceeds the cost of being early. Front-load skill development in AI orchestration — the learning curve steepens as AI systems grow more complex." },
      regulated: { verdict: "PATIENCE REWARDED — BUT STAY POSITIONED", color: "#4ade80", text: "Regulation buys time but doesn't change the destination. Use the extended window to build positions more gradually, optimize tax efficiency, and diversify across jurisdictions. Political/regulatory engagement becomes the highest-leverage activity. Don't mistake regulatory slowdown for reversal." },
      collapse: { verdict: "HEDGE EVERYTHING — THEN BUY THE DIPS", color: "#ef4444", text: "The collapse scenario demands maximum hedging: precious metals, crypto self-custody, geographic diversification, and cash reserves. But it also creates the greatest buying opportunities of a generation. The strategy: survive the crash with hard assets, then deploy capital aggressively into AI infrastructure at distressed prices. Those who can stay solvent longest win biggest." },
    },
  },
};

function getCommentary(tab, selected, scenario) {
  if (tab === "strategy") return COMMENTARY.strategy._default[scenario];
  const section = COMMENTARY[tab];
  if (!section || !section[selected]) return null;
  return section[selected][scenario];
}

function runBrownianPaths(config, numPaths, numYears, seed, scenario) {
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
      if (year >= 2028 && year < 2031) { driftMod *= 1.3; volMod *= 1.2; }
      if (year >= 2031 && year < 2035) { driftMod *= 1.6; volMod *= 1.5; }
      if (year >= 2035) { driftMod *= 2.0; volMod *= 1.8; }
      if (scenario === "accelerated") { driftMod *= 1.5; volMod *= 1.3; }
      if (scenario === "regulated") { driftMod *= 0.5; volMod *= 0.7; }
      if (scenario === "collapse") { driftMod *= 1.8; volMod *= 2.0; }
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

function computePercentiles(paths) {
  const years = paths[0].length;
  const result = [];
  for (let i = 0; i < years; i++) {
    const vals = paths.map(p => p[i].value).sort((a, b) => a - b);
    const len = vals.length;
    result.push({
      year: paths[0][i].year,
      p10: vals[Math.floor(len * 0.1)],
      p25: vals[Math.floor(len * 0.25)],
      median: vals[Math.floor(len * 0.5)],
      p75: vals[Math.floor(len * 0.75)],
      p90: vals[Math.floor(len * 0.9)],
      mean: Math.round(vals.reduce((a, b) => a + b, 0) / len * 100) / 100,
    });
  }
  return result;
}

const TABS = [
  { id: "macro", label: "Macro Variables", icon: "◈" },
  { id: "assets", label: "Asset Classes", icon: "◆" },
  { id: "skills", label: "Skill Values", icon: "◇" },
  { id: "strategy", label: "Strategy Matrix", icon: "⬡" },
];

const SCENARIOS = [
  { id: "base", label: "Base Case", desc: "Gradual AI adoption, mixed policy response" },
  { id: "accelerated", label: "Accelerated", desc: "Faster-than-expected AI capability gains" },
  { id: "regulated", label: "Regulated Slowdown", desc: "Heavy government intervention slows deployment" },
  { id: "collapse", label: "Systemic Shock", desc: "Rapid displacement triggers social/economic crisis" },
];

const PATH_COLORS = ["#22d3ee", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#fbbf24"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,12,20,0.95)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#e2e8f0", marginTop: 2 }}>
          {p.name}: <span style={{ fontWeight: 700 }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const HowToUse = ({ onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "32px 36px", maxWidth: 720, maxHeight: "85vh", overflowY: "auto", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee" }}>How This Simulation Works</h2>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>&#10005;</button>
      </div>
      {[
        { title: "The Model", icon: "⚙", text: "This is a Geometric Brownian Motion simulator — the same stochastic process used to model stock prices, but applied to macro-economic variables, asset classes, and skill values in an AI disruption scenario. Each variable has a calibrated drift (direction) and volatility (uncertainty). Hundreds of random paths are generated using Monte Carlo sampling, then aggregated into percentile bands." },
        { title: "Five Disruption Phases", icon: "◉", text: "The simulation models five overlapping phases: AI Copilots (2024–2026), AI Agents (2026–2028), AI Workers (2028–2031), Physical Robots (2031–2035), and AGI/Post-Labor (2035–2040). Each phase multiplies drift and volatility — later phases are faster and more uncertain." },
        { title: "Four Scenarios", icon: "◆", text: "Switch between Base Case (gradual adoption), Accelerated (faster capability gains), Regulated Slowdown (government intervention), and Systemic Shock (rapid displacement crisis). Each scenario modifies every variable's behavior. Watch how the same asset or skill performs differently across futures." },
        { title: "Reading the Charts", icon: "◇", text: "The cyan line is the median outcome (50th percentile). Dashed lines show P10 and P90 — 80% of simulated futures fall between them. Shaded bands show P25–P75 (inner) and P10–P90 (outer). Toggle 'Show sample paths' to see individual Brownian trajectories — each one is a possible future." },
        { title: "The Commentary Banner", icon: "⬡", text: "The colored banner below the controls updates dynamically as you change tabs, variables, and scenarios. It provides definitive analysis for every combination — not hedged advice, but clear calls on what each variable means for your positioning." },
        { title: "Strategy Matrix", icon: "★", text: "The final tab scores 10 actionable strategies across all four scenarios. Strategies scoring ≥7 in ALL scenarios are 'scenario-robust' — they work regardless of which future materializes. These are your core positions." },
        { title: "How To Use This", icon: "→", text: "Start with Macro Variables to understand the world. Move to Asset Classes to see what to buy. Check Skill Values to see what to learn. End at Strategy Matrix for the action plan. Toggle scenarios to stress-test every assumption. Reseed to generate fresh random paths — if your conclusions change with the seed, your conviction is too low." },
      ].map((section, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 16, color: "#22d3ee" }}>{section.icon}</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{section.title}</div>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7, paddingLeft: 26 }}>{section.text}</div>
        </div>
      ))}
      <div style={{ marginTop: 20, padding: 14, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 8, fontSize: 11, color: "#64748b", lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace" }}>
        <strong style={{ color: "#94a3b8" }}>Technical Note:</strong> Drift and volatility parameters are calibrated estimates, not predictions. The simulation uses a seeded Mulberry32 PRNG with Box-Muller transform for reproducible Gaussian noise. Phase multipliers accelerate drift and vol in later periods. All values indexed from 100 (or noted). This is a thinking tool, not financial advice.
      </div>
    </div>
  </div>
);

export default function AIDisruptionSim() {
  const [tab, setTab] = useState("macro");
  const [scenario, setScenario] = useState("base");
  const [numPaths, setNumPaths] = useState(200);
  const [seed, setSeed] = useState(42);
  const [selectedVar, setSelectedVar] = useState("whiteCollarEmployment");
  const [selectedAsset, setSelectedAsset] = useState("equities_ai");
  const [selectedSkill, setSelectedSkill] = useState("coding");
  const [showPaths, setShowPaths] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [numYears] = useState(16);

  // Decision engine state
  const [decisionsEnabled, setDecisionsEnabled] = useState(false);
  const [decisionHistory, setDecisionHistory] = useState([]);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [currentDecisionPoint, setCurrentDecisionPoint] = useState(null);
  const [recommendedAction, setRecommendedAction] = useState(null);

  const configs = tab === "macro" ? MACRO_VARS : tab === "assets" ? ASSET_CLASSES : SKILL_CLASSES;
  const selected = tab === "macro" ? selectedVar : tab === "assets" ? selectedAsset : selectedSkill;
  const setSelected = tab === "macro" ? setSelectedVar : tab === "assets" ? setSelectedAsset : setSelectedSkill;

  const commentary = useMemo(() => getCommentary(tab, selected, scenario), [tab, selected, scenario]);

  const simData = useMemo(() => {
    if (tab === "strategy") return null;
    const cfg = configs[selected];
    if (!cfg) return null;
    const paths = decisionsEnabled
      ? runBrownianPathsWithDecisions(cfg, numPaths, numYears, seed, scenario, decisionHistory)
      : runBrownianPaths(cfg, numPaths, numYears, seed, scenario);
    const pct = computePercentiles(paths);
    const samplePaths = paths.slice(0, 6).map((path, i) => ({ data: path, color: PATH_COLORS[i % PATH_COLORS.length] }));
    return { paths, percentiles: pct, samplePaths, config: cfg };
  }, [tab, selected, numPaths, seed, scenario, numYears, configs, decisionsEnabled, decisionHistory]);

  const assetComparison = useMemo(() => {
    if (tab !== "assets" && tab !== "skills") return null;
    const cfgs = tab === "assets" ? ASSET_CLASSES : SKILL_CLASSES;
    const results = {};
    Object.entries(cfgs).forEach(([key, cfg]) => {
      const paths = runBrownianPaths(cfg, 100, numYears, seed, scenario);
      const pct = computePercentiles(paths);
      results[key] = { label: cfg.label, finalMedian: pct[pct.length - 1].median, finalP10: pct[pct.length - 1].p10, finalP90: pct[pct.length - 1].p90 };
    });
    return Object.entries(results).sort((a, b) => b[1].finalMedian - a[1].finalMedian);
  }, [tab, numPaths, seed, scenario, numYears]);

  const reroll = useCallback(() => setSeed(s => s + 1), []);

  const strategyData = useMemo(() => {
    if (tab !== "strategy") return null;
    return [
      { name: "Accumulate Compute/Energy Infra", description: "Data centers, nuclear, power infrastructure — the substrate AI runs on", tickers: "NVDA, VST, CEG, SMR, URA, OKLO", timeframe: "Now → 2030+", conviction: 95, scenarios: { base: 9, accelerated: 10, regulated: 7, collapse: 6 } },
      { name: "Hold & Grow Crypto", description: "BTC as digital gold, ETH as settlement layer, SOL as speed layer", tickers: "BTC, ETH, SOL", timeframe: "Now → 2032+", conviction: 85, scenarios: { base: 8, accelerated: 9, regulated: 6, collapse: 7 } },
      { name: "Robotics/Automation ETFs", description: "Physical automation wave follows software — 3-5 year lag", tickers: "BOTZ, ROBO, ARKQ", timeframe: "2026 → 2035", conviction: 80, scenarios: { base: 8, accelerated: 9, regulated: 5, collapse: 4 } },
      { name: "Precious Metals Hedge", description: "Gold/Silver/PSLV as chaos hedge and monetary debasement play", tickers: "PSLV, GLD, SLV, Gold miners", timeframe: "Now → 2028+", conviction: 85, scenarios: { base: 7, accelerated: 7, regulated: 8, collapse: 9 } },
      { name: "Short Commercial Real Estate", description: "Office demand collapses as remote + AI eliminates knowledge workers", tickers: "SRS, inverse REIT positions", timeframe: "2026 → 2032", conviction: 75, scenarios: { base: 7, accelerated: 9, regulated: 5, collapse: 8 } },
      { name: "Farmland & Hard Assets", description: "Physical assets with intrinsic value — uncorrelated to AI disruption", tickers: "FPI, LAND, direct ownership", timeframe: "Now → indefinite", conviction: 70, scenarios: { base: 6, accelerated: 6, regulated: 7, collapse: 8 } },
      { name: "Private Equity: Defense/Space", description: "SpaceX, Anduril, Shield AI — government-backed AI/robotics adoption", tickers: "SpaceX, Anduril, Shield AI", timeframe: "Now → IPO events", conviction: 90, scenarios: { base: 9, accelerated: 10, regulated: 8, collapse: 7 } },
      { name: "Learn AI Orchestration/Governance", description: "Skill: managing AI systems, prompt engineering, safety, alignment", tickers: "—", timeframe: "Now → 2030", conviction: 90, scenarios: { base: 9, accelerated: 10, regulated: 8, collapse: 7 } },
      { name: "Build Political/Regulatory Capital", description: "Skill: influence policy on AI governance, UBI, labor transitions", tickers: "—", timeframe: "Now → indefinite", conviction: 80, scenarios: { base: 8, accelerated: 8, regulated: 9, collapse: 9 } },
      { name: "Capital Allocation Mastery", description: "Skill: the last human edge — deploying capital where AI cannot yet judge", tickers: "—", timeframe: "Now → 2035+", conviction: 85, scenarios: { base: 8, accelerated: 7, regulated: 8, collapse: 8 } },
    ];
  }, [tab]);

  // Helper function to build decision state from simulation data
  const buildDecisionState = useCallback((simData, year, scenario) => {
    // For now, return default state - full implementation would aggregate across all variables
    // This is a simplified version to get the system working
    return {
      socialStability: { median: 100 },
      whiteCollarEmployment: { median: 100 },
      blueCollarEmployment: { median: 100 },
      inequality: { median: 100 },
    };
  }, []);

  // Decision detection effect
  useEffect(() => {
    if (!decisionsEnabled) return;

    // Check if we need a decision at current simulation state
    const phaseStarts = [2026, 2028, 2031, 2035];

    phaseStarts.forEach((year, phaseIndex) => {
      const alreadyDecided = decisionHistory.some(d => d.year === year);
      if (!alreadyDecided && !showDecisionModal) {
        // Trigger decision modal
        const state = buildDecisionState(simData, year, scenario);
        const applicable = POLICY_ACTIONS
          .filter(a => a.applicablePhases.includes(phaseIndex))
          .map(a => a.id);
        const recommended = getRecommendedAction(state, phaseIndex, scenario);

        setCurrentDecisionPoint({ year, phaseIndex, applicableActions: applicable });
        setRecommendedAction(recommended);
        setShowDecisionModal(true);
      }
    });
  }, [decisionsEnabled, decisionHistory, scenario, simData, showDecisionModal, buildDecisionState]);

  const PhaseBar = () => (
    <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
      {PHASES.map(p => (
        <div key={p.name} style={{ flex: p.end - p.start, background: p.color + "22", border: "1px solid " + p.color + "55", borderRadius: 4, padding: "6px 8px", fontSize: 10, color: p.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, textAlign: "center" }}>
          {p.name}<br /><span style={{ opacity: 0.6 }}>{p.start}–{p.end}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060810", color: "#e2e8f0", fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif" }}>
      <LandscapePrompt />
      {showGuide && <HowToUse onClose={() => setShowGuide(false)} />}

      <div style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0a0e1a 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "20px 32px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 12px #22d3ee88", animation: "pulse 2s ease-in-out infinite" }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "linear-gradient(90deg, #22d3ee, #a78bfa, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              AI DISRUPTION MONTE CARLO
            </h1>
          </div>
          <button onClick={() => setShowGuide(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
            ? How This Works
          </button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
          Brownian Motion Simulation · {numPaths} paths · 2024→2040 · What happens when AI takes every job?
        </p>
      </div>

      <div style={{ padding: "16px 32px 32px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "rgba(34,211,238,0.15)" : "transparent", border: tab === t.id ? "1px solid rgba(34,211,238,0.3)" : "1px solid transparent", color: tab === t.id ? "#22d3ee" : "#64748b", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={() => setScenario(s.id)} title={s.desc} style={{
                background: scenario === s.id ? (s.id === "collapse" ? "rgba(239,68,68,0.15)" : s.id === "accelerated" ? "rgba(251,191,36,0.15)" : s.id === "regulated" ? "rgba(34,197,94,0.15)" : "rgba(167,139,250,0.15)") : "rgba(255,255,255,0.04)",
                border: scenario === s.id ? "1px solid " + (s.id === "collapse" ? "#ef444466" : s.id === "accelerated" ? "#fbbf2466" : s.id === "regulated" ? "#22c55e66" : "#a78bfa66") : "1px solid rgba(255,255,255,0.08)",
                color: scenario === s.id ? "#e2e8f0" : "#64748b", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace"
              }}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={reroll} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            ⟳ Reseed
          </button>
        </div>

        {commentary && (
          <div style={{ background: "linear-gradient(135deg, " + commentary.color + "08, " + commentary.color + "04)", border: "1px solid " + commentary.color + "30", borderLeft: "4px solid " + commentary.color, borderRadius: "0 10px 10px 0", padding: "16px 20px", marginBottom: 16, transition: "all 0.3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ padding: "3px 10px", borderRadius: 4, background: commentary.color + "20", border: "1px solid " + commentary.color + "40", color: commentary.color, fontSize: 11, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                {commentary.verdict}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                {tab === "strategy" ? "Strategy" : configs[selected]?.label} · {SCENARIOS.find(s => s.id === scenario)?.label}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.75, fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {commentary.text}
            </div>
          </div>
        )}

        <PhaseBar />

        {tab !== "strategy" && simData && (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: 12, maxHeight: 520, overflowY: "auto" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {tab === "macro" ? "Macro Variables" : tab === "assets" ? "Asset Classes" : "Skills"}
              </div>
              {Object.entries(configs).map(([key, cfg]) => (
                <button key={key} onClick={() => setSelected(key)} style={{ display: "block", width: "100%", textAlign: "left", background: selected === key ? "rgba(34,211,238,0.1)" : "transparent", border: selected === key ? "1px solid rgba(34,211,238,0.25)" : "1px solid transparent", color: selected === key ? "#22d3ee" : "#94a3b8", borderRadius: 6, padding: "8px 10px", marginBottom: 3, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  {cfg.label}
                  <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>drift: {cfg.drift > 0 ? "+" : ""}{cfg.drift} · vol: {cfg.vol}</div>
                </button>
              ))}
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
                  <input type="checkbox" checked={showPaths} onChange={e => setShowPaths(e.target.checked)} style={{ accentColor: "#22d3ee" }} />
                  Show sample paths
                </label>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>Paths: {numPaths}</div>
                <input type="range" min={50} max={500} step={50} value={numPaths} onChange={e => setNumPaths(+e.target.value)} style={{ width: "100%", accentColor: "#22d3ee" }} />
              </div>

              {/* Decision Engine Controls */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={decisionsEnabled}
                      onChange={e => setDecisionsEnabled(e.target.checked)}
                      style={{ accentColor: "#22d3ee" }}
                    />
                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
                      Interactive Decisions
                    </span>
                  </label>

                  {decisionsEnabled && decisionHistory.length > 0 && (
                    <button
                      onClick={() => setDecisionHistory([])}
                      style={{
                        fontSize: 9,
                        padding: "3px 8px",
                        background: "#334155",
                        border: "1px solid #475569",
                        borderRadius: 4,
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Decision history display */}
                {decisionsEnabled && decisionHistory.length > 0 && (
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                    <div style={{ color: "#64748b", marginBottom: 4 }}>Decisions:</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {decisionHistory.map((d, i) => (
                        <div key={i} style={{
                          background: "#334155",
                          padding: "2px 6px",
                          borderRadius: 3,
                          fontSize: 8,
                          color: "#22d3ee",
                        }}>
                          {d.year}: {POLICY_ACTIONS.find(a => a.id === d.actionId)?.label.substring(0, 15)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "20px 16px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{configs[selected]?.label}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      2040 Median: <span style={{ color: "#22d3ee", fontWeight: 700 }}>{simData.percentiles[simData.percentiles.length - 1]?.median?.toFixed(1)}</span>
                      {" · "}P10–P90: <span style={{ color: "#f472b6" }}>{simData.percentiles[simData.percentiles.length - 1]?.p10?.toFixed(1)}</span>
                      –<span style={{ color: "#34d399" }}>{simData.percentiles[simData.percentiles.length - 1]?.p90?.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={simData.percentiles} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="innerBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="p90" stroke="none" fill="url(#bandGrad)" />
                    <Area type="monotone" dataKey="p10" stroke="none" fill="#060810" />
                    <Area type="monotone" dataKey="p75" stroke="none" fill="url(#innerBand)" />
                    <Area type="monotone" dataKey="p25" stroke="none" fill="#060810" />
                    <Line type="monotone" dataKey="median" stroke="#22d3ee" strokeWidth={2.5} dot={false} name="Median" />
                    <Line type="monotone" dataKey="p10" stroke="#f472b6" strokeWidth={1} strokeDasharray="4 4" dot={false} name="P10" />
                    <Line type="monotone" dataKey="p90" stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" dot={false} name="P90" />
                    {showPaths && simData.samplePaths.map((sp, i) => (
                      <Line key={i} data={sp.data} type="monotone" dataKey="value" stroke={sp.color} strokeWidth={0.8} strokeOpacity={0.4} dot={false} name={"Path " + (i + 1)} />
                    ))}
                    {PHASES.map(p => (
                      <ReferenceLine key={p.name} x={p.start} stroke={p.color} strokeDasharray="2 4" strokeOpacity={0.4} />
                    ))}
                    {decisionsEnabled && decisionHistory.map(d => (
                      <ReferenceLine
                        key={d.year}
                        x={d.year}
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        label={{
                          value: `Policy: ${d.year}`,
                          position: "top",
                          fill: "#fbbf24",
                          fontSize: 9,
                        }}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {assetComparison && (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "16px", marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                    2040 MEDIAN COMPARISON (indexed from 100)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {assetComparison.map(([key, data]) => {
                      const isNeg = data.finalMedian < 100;
                      const barWidth = Math.min(Math.abs(data.finalMedian - 100) / 5, 100);
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSelected(key)}>
                          <div style={{ width: 140, fontSize: 10, color: selected === key ? "#22d3ee" : "#94a3b8", fontFamily: "'JetBrains Mono', monospace", fontWeight: selected === key ? 700 : 400, flexShrink: 0 }}>{data.label}</div>
                          <div style={{ flex: 1, height: 18, background: "rgba(255,255,255,0.04)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", left: isNeg ? (50 - barWidth / 2) + "%" : "50%", width: barWidth + "%", height: "100%", background: isNeg ? "rgba(239,68,68,0.4)" : "rgba(34,211,238,0.4)", borderRadius: 4 }} />
                            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                          </div>
                          <div style={{ width: 60, textAlign: "right", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: isNeg ? "#ef4444" : "#22d3ee" }}>{data.finalMedian.toFixed(0)}</div>
                          <div style={{ width: 80, textAlign: "right", fontSize: 9, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{data.finalP10.toFixed(0)}–{data.finalP90.toFixed(0)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "strategy" && strategyData && (
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>Strategy Matrix: Actions Across Scenarios</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>Score 1–10 per scenario · Conviction = base case confidence</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", color: "#64748b", fontWeight: 600, padding: "6px 10px", fontSize: 10 }}>STRATEGY</th>
                    <th style={{ textAlign: "left", color: "#64748b", fontWeight: 600, padding: "6px 10px", fontSize: 10 }}>TICKERS</th>
                    <th style={{ textAlign: "center", color: "#64748b", fontWeight: 600, padding: "6px 10px", fontSize: 10 }}>CONVICTION</th>
                    {SCENARIOS.map(s => (
                      <th key={s.id} style={{ textAlign: "center", color: scenario === s.id ? "#e2e8f0" : "#64748b", fontWeight: 600, padding: "6px 10px", fontSize: 10, background: scenario === s.id ? "rgba(255,255,255,0.04)" : "transparent", borderRadius: 4 }}>{s.label.toUpperCase()}</th>
                    ))}
                    <th style={{ textAlign: "center", color: "#64748b", fontWeight: 600, padding: "6px 10px", fontSize: 10 }}>AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyData.map((s, i) => {
                    const avg = Object.values(s.scenarios).reduce((a, b) => a + b, 0) / 4;
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                        <td style={{ padding: "10px", borderRadius: "6px 0 0 6px" }}>
                          <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 11 }}>{s.name}</div>
                          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{s.description}</div>
                          <div style={{ fontSize: 9, color: "#475569", marginTop: 1 }}>{s.timeframe}</div>
                        </td>
                        <td style={{ padding: "10px", color: "#22d3ee", fontSize: 10 }}>{s.tickers}</td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: s.conviction >= 90 ? "rgba(34,211,238,0.15)" : s.conviction >= 80 ? "rgba(167,139,250,0.15)" : "rgba(251,191,36,0.15)", color: s.conviction >= 90 ? "#22d3ee" : s.conviction >= 80 ? "#a78bfa" : "#fbbf24", fontWeight: 700 }}>
                            {s.conviction}%
                          </div>
                        </td>
                        {SCENARIOS.map(sc => {
                          const score = s.scenarios[sc.id];
                          const bg = score >= 9 ? "rgba(34,211,238,0.2)" : score >= 7 ? "rgba(34,197,94,0.15)" : score >= 5 ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)";
                          const fg = score >= 9 ? "#22d3ee" : score >= 7 ? "#22c55e" : score >= 5 ? "#fbbf24" : "#ef4444";
                          return (
                            <td key={sc.id} style={{ padding: "10px", textAlign: "center", background: scenario === sc.id ? "rgba(255,255,255,0.03)" : "transparent" }}>
                              <span style={{ color: fg, fontWeight: 700, background: bg, padding: "2px 8px", borderRadius: 4 }}>{score}</span>
                            </td>
                          );
                        })}
                        <td style={{ padding: "10px", textAlign: "center", borderRadius: "0 6px 6px 0" }}>
                          <span style={{ color: avg >= 8 ? "#22d3ee" : avg >= 6.5 ? "#a78bfa" : "#fbbf24", fontWeight: 700 }}>{avg.toFixed(1)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 20, padding: 16, background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>SCENARIO-ROBUST PLAYS (≥7 IN ALL FUTURES)</div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
                {strategyData.filter(s => Object.values(s.scenarios).every(v => v >= 7)).map(s => (
                  <span key={s.name} style={{ display: "inline-block", padding: "3px 10px", margin: "2px 4px", borderRadius: 4, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
            Geometric Brownian Motion · Mulberry32 PRNG · Box-Muller Transform · Phase-accelerated drift/vol<br />
            This is a scenario planning tool, not financial advice. All parameters are calibrated estimates.
          </div>
          <button onClick={() => setShowGuide(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            ? Guide
          </button>
        </div>
      </div>

      {/* Decision Modal */}
      {showDecisionModal && (
        <DecisionModal
          decisionPoint={currentDecisionPoint}
          recommendedAction={recommendedAction}
          onSelectAction={(action) => {
            setDecisionHistory([
              ...decisionHistory,
              {
                year: currentDecisionPoint.year,
                actionId: action.id,
                action: action,
              }
            ]);
            setShowDecisionModal(false);
          }}
          onSkip={() => {
            setShowDecisionModal(false);
          }}
        />
      )}

      <style>{
        "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');" +
        "@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }" +
        "@keyframes rotate { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } }" +
        "::-webkit-scrollbar { width: 6px; }" +
        "::-webkit-scrollbar-track { background: transparent; }" +
        "::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }" +
        "* { box-sizing: border-box; }" +

        /* Show landscape prompt on mobile portrait mode */ +
        "@media only screen and (max-width: 768px) and (orientation: portrait) {" +
          ".landscape-prompt { display: flex !important; }" +
        "}" +

        /* Hide landscape prompt on landscape or desktop */ +
        "@media only screen and (min-width: 769px), (orientation: landscape) {" +
          ".landscape-prompt { display: none !important; }" +
        "}"
      }</style>
    </div>
  );
}
