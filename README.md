# AI Disruption Monte Carlo

## Geometric Brownian Motion at the Core

This simulator is built on **Geometric Brownian Motion (GBM)** — the same stochastic process used to model stock prices in quantitative finance — applied here to model the cascading effects of AI-driven job displacement across economic, asset, and skill dimensions.

Each variable evolves according to the stochastic differential equation:

```
dX = μ·dt + σ·√dt·Z
```

Where:
- **μ (drift)** — the expected directional trend of the variable (e.g., white collar employment drifts at -2.8/yr, AI equities at +12/yr)
- **σ (volatility)** — the degree of randomness/uncertainty around that trend
- **Z** — a standard normal random variable generated via the **Box-Muller transform**
- **dt** — the time step (1 year)

Hundreds of independent stochastic paths are generated using **Monte Carlo sampling** with a seeded **Mulberry32 PRNG** for reproducibility. Paths are then aggregated into percentile bands (P10, P25, median, P75, P90) to visualize the full distribution of possible futures.

### Phase-Accelerated Drift & Volatility

The simulation isn't static GBM — drift and volatility **multiply through five disruption phases**, reflecting the compounding nature of AI capability:

| Phase | Period | Drift Multiplier | Vol Multiplier |
|-------|--------|:-:|:-:|
| AI Copilots | 2024–2026 | 1.0x | 1.0x |
| AI Agents | 2026–2028 | 1.0x | 1.0x |
| AI Workers | 2028–2031 | 1.3x | 1.2x |
| Physical Robots | 2031–2035 | 1.6x | 1.5x |
| AGI/Post-Labor | 2035–2040 | 2.0x | 1.8x |

Four scenario overlays further modify drift/vol:
- **Base Case** — gradual AI adoption, mixed policy response
- **Accelerated** — 1.5x drift, 1.3x vol
- **Regulated Slowdown** — 0.5x drift, 0.7x vol
- **Systemic Shock** — 1.8x drift, 2.0x vol

### Interactive Policy Decisions

An optional decision engine lets you inject policy actions (UBI, regulation, retraining, wealth taxes) at phase boundaries. Each policy modifies drift and volatility of affected variables with a **5-year half-life decay**, so interventions gradually fade rather than permanently altering the trajectory.

### What's Being Modeled

**8 Macro Variables** — white/blue collar employment, GDP growth, inequality, social stability, UBI probability, productivity, deflation pressure

**11 Asset Classes** — AI equities, traditional equities, commercial/residential RE, crypto, gold, govt bonds, energy infrastructure, robotics, defense tech, farmland

**8 Skill Categories** — traditional coding, AI orchestration, human judgment, physical trades, creative, capital management, political power, systems thinking

200+ stochastic paths across all variables, 2024–2040.

## Local Development

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

## Deploy to GCP

### Option A: Firebase Hosting (Recommended — fastest, free tier)

Firebase Hosting is ideal for static sites. Free tier covers 10GB hosting + 360MB/day transfer.

```bash
# 1. Install Firebase CLI (one-time)
npm install -g firebase-tools

# 2. Login to Google
firebase login

# 3. Initialize project (one-time)
firebase init hosting
# Select your GCP project
# Public directory: dist
# Single-page app: Yes
# Don't overwrite index.html

# 4. Build and deploy
npm run build
firebase deploy

# Your site will be live at:
# https://YOUR-PROJECT-ID.web.app
# https://YOUR-PROJECT-ID.firebaseapp.com
```

**Custom domain:**
```bash
firebase hosting:channel:deploy production
# Then add custom domain in Firebase Console > Hosting > Add custom domain
```

### Option B: Cloud Run (Container-based, auto-scaling)

Better if you want auto-scaling, custom domains, or plan to add a backend later.

```bash
# 1. Make sure gcloud CLI is installed and configured
gcloud auth login
gcloud config set project YOUR-PROJECT-ID

# 2. Deploy directly from source (builds in cloud)
gcloud run deploy ai-disruption-mc \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3

# Your site will be live at:
# https://ai-disruption-mc-XXXXX-uc.a.run.app
```

**Custom domain on Cloud Run:**
```bash
gcloud beta run domain-mappings create \
  --service ai-disruption-mc \
  --domain your-domain.com \
  --region us-central1
```

### Option C: Cloud Storage Static Hosting (Simplest, cheapest)

For pure static hosting with no container overhead.

```bash
# 1. Build
npm run build

# 2. Create a bucket (name must be globally unique)
gsutil mb -l us-central1 gs://ai-disruption-mc

# 3. Upload dist folder
gsutil -m cp -r dist/* gs://ai-disruption-mc

# 4. Make public
gsutil iam ch allUsers:objectViewer gs://ai-disruption-mc

# 5. Set index page
gsutil web set -m index.html -e index.html gs://ai-disruption-mc

# Access at: https://storage.googleapis.com/ai-disruption-mc/index.html
# For custom domain, set up a load balancer pointing to the bucket
```

## Recommendation

| Method | Setup Time | Cost | Custom Domain | Auto-scaling |
|--------|-----------|------|---------------|-------------|
| **Firebase Hosting** | 5 min | Free tier | Easy | CDN built-in |
| Cloud Run | 10 min | ~$0/mo idle | Moderate | Yes |
| Cloud Storage | 15 min | ~$0.02/mo | Complex | CDN add-on |

**Go with Firebase Hosting** unless you need server-side logic later.

## Project Structure

```
ai-disruption-mc/
├── src/
│   ├── App.jsx                        # Main simulator component + GBM engine
│   ├── main.jsx                       # React entry point
│   ├── components/
│   │   ├── DecisionModal.jsx          # Policy decision UI
│   │   └── LandscapePrompt.jsx        # Mobile orientation prompt
│   └── utils/
│       ├── pathsWithDecisions.js      # Decision-aware Brownian motion paths
│       ├── decisionEngine.js          # Heuristic policy recommendations
│       └── policyActions.js           # Policy action definitions & effects
├── public/                            # Static assets
├── index.html                         # HTML template
├── vite.config.js                     # Vite build config
├── package.json                       # Dependencies
├── firebase.json                      # Firebase Hosting config
├── Dockerfile                         # Cloud Run container
├── nginx.conf                         # Nginx config for container
└── README.md
```
