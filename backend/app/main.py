from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.contexts.intake.router import router as intake_router
from app.contexts.simulation.router import router as simulation_router
from app.contexts.insights.router import router as insights_router
from app.contexts.portfolio.router import router as portfolio_router
from app.contexts.fulfill.router import router as fulfill_router
from app.contexts.observability.router import router as obs_router
from app.contexts.observability.middleware import ObservabilityMiddleware
from app.contexts.dna.router import router as dna_router
from app.contexts.thesis.router import router as thesis_router
from app.contexts.scenarios.router import router as scenarios_router
from app.contexts.community.router import router as community_router

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Portfolio Monte Carlo Simulator", version="2.0.0")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ObservabilityMiddleware)

# Mount bounded context routers
app.include_router(intake_router)
app.include_router(simulation_router)
app.include_router(insights_router)
app.include_router(portfolio_router)
app.include_router(fulfill_router)
app.include_router(obs_router)
app.include_router(dna_router)
app.include_router(thesis_router)
app.include_router(scenarios_router)
app.include_router(community_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
