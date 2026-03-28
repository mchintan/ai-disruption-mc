from fastapi import APIRouter
from app.contexts.insights.narrator import explain_optimization

router = APIRouter(prefix="/api/insights", tags=["insights"])

# Future endpoints: /explain-simulation, /explain-backtest
# For now, explain_optimization is called from simulation router's optimize-weights handler
