"""FastAPI middleware for automatic request tracing."""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.contexts.observability.journey import record_request


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # Skip static assets and health checks
        path = request.url.path
        if path in ("/healthz", "/docs", "/openapi.json", "/redoc"):
            return response

        record_request(
            method=request.method,
            path=path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response
