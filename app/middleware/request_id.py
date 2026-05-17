"""Atribui X-Request-ID a cada pedido (rastreio em logs e suporte)."""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response
