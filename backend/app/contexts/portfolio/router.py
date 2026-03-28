from fastapi import APIRouter

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

# TODO: CRUD endpoints for portfolio persistence
# POST /  - Create portfolio
# GET /:id - Read portfolio
# PUT /:id - Update portfolio
# GET /presets - List presets
