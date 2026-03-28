from fastapi import APIRouter

router = APIRouter(prefix="/api/fulfill", tags=["fulfill"])

# TODO: Export and report endpoints
# POST /report/pdf - Generate PDF report
# POST /export/csv - Export portfolio as CSV
# POST /export/json - Export full snapshot
