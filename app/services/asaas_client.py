"""Cliente HTTP mínimo para API Asaas v3."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)


class AsaasAPIError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, errors: list | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.errors = errors or []


class AsaasClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = (api_key or settings.ASAAS_API_KEY or "").strip()
        self.base_url = (base_url or settings.asaas_base_url).rstrip("/")

    @property
    def enabled(self) -> bool:
        if settings.asaas_e2e_mock:
            return not settings.ASAAS_DISABLED
        return bool(self.api_key) and not settings.ASAAS_DISABLED

    def _headers(self) -> dict[str, str]:
        return {
            "access_token": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "EventosBR/1.0",
        }

    def request(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        if settings.asaas_e2e_mock:
            from app.services.asaas_e2e_mock import mock_request

            return mock_request(method, path, json=json)
        if not self.api_key:
            raise AsaasAPIError("ASAAS_API_KEY não configurada")
        url = f"{self.base_url}{path}"
        headers = self._headers()
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key[:48]
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.request(method, url, headers=headers, json=json, params=params)
        except httpx.HTTPError as e:
            logger.exception("Falha de rede Asaas %s %s", method, path)
            raise AsaasAPIError("Falha de comunicação com Asaas") from e

        if resp.status_code >= 400:
            try:
                body = resp.json()
            except Exception:
                body = {}
            errors = body.get("errors") if isinstance(body, dict) else None
            desc = ""
            if errors and isinstance(errors, list):
                parts = [
                    str(e.get("description") or e.get("code") or "").strip()
                    for e in errors
                    if isinstance(e, dict)
                ]
                parts = [p for p in parts if p]
                if parts:
                    desc = "; ".join(parts)
            if not desc and isinstance(body, dict):
                msg = str(body.get("message") or "").strip()
                if msg:
                    desc = msg
            raise AsaasAPIError(
                desc or f"Asaas HTTP {resp.status_code}",
                status_code=resp.status_code,
                errors=errors if isinstance(errors, list) else None,
            )
        if resp.status_code == 204 or not resp.content:
            return {}
        return resp.json()

    def get(self, path: str, **kwargs) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> Any:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs) -> Any:
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs) -> Any:
        return self.request("DELETE", path, **kwargs)


def get_asaas_client() -> AsaasClient:
    return AsaasClient()
