#!/usr/bin/env python3
"""
Substitui eventos de teste na vitrine por exemplos profissionais.

Uso no VPS (com a stack já rodando via ./scripts/atualizar-vps-agora.sh):
  cd /opt/eventosbr
  python3 scripts/seed-vitrine-profissional.py

Por padrão os eventos demo são GRATUITOS (cortesia), pois eventos pagos exigem
organizador com repasse Asaas aprovado (KYC). Para publicar como pagos, use um
organizador já aprovado via SEED_ORG_EMAIL/SEED_ORG_SENHA e SEED_DEMO_PAGO=1.

Variáveis opcionais:
  SEED_API_URL=https://eventosbr.app.br   (padrão: DOMAIN do .env)
  PLATFORM_ADMIN_API_KEY=...              (lê do .env se omitido)
  SEED_ORG_EMAIL / SEED_ORG_SENHA         organizador existente; senão cria conta demo
  SEED_DEMO_PAGO=1                        tenta publicar como eventos pagos (requer repasse aprovado)
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8000"

PADROES_TESTE = (
    re.compile(r"\bcortesia\s*gr[aá]tis\b", re.I),
    re.compile(r"\bevento\s*cortesia\b", re.I),
    re.compile(r"\bru[aá]\s*teste\b", re.I),
    re.compile(r"\be2e\b", re.I),
    re.compile(r"^teste\b", re.I),
    re.compile(r"\bevento\s+qa\b", re.I),
    re.compile(r"\bevento\s+teste\b", re.I),
)


def _lotes_demo(preco: float, nome_lote: str) -> list[dict]:
    if preco <= 0:
        return [{"nome": "Cortesia", "tipo": "cortesia", "preco": 0, "ordem": 1, "ativo": True}]
    return [{"nome": nome_lote, "tipo": "padrao", "preco": preco, "ordem": 1, "ativo": True}]


EVENTOS_DEMO_BASE = [
    {
        "nome": "Festival Sertanejo ao Vivo — Edição Verão",
        "descricao": "Uma noite especial com os maiores hits do sertanejo universitário. Espaço amplo, food trucks e área VIP.",
        "data_inicio": "2026-08-15T20:00:00",
        "data_fim": "2026-08-16T02:00:00",
        "local": "Arena Parque Barigui, Curitiba — PR",
        "categoria": "Shows",
        "preco_pago": 89.9,
        "lote_pago_nome": "Pista",
    },
    {
        "nome": "Feijoada Beneficente da Comunidade",
        "descricao": "Encontro gastronômico com música ao vivo. Parte da renda revertida para projetos sociais locais.",
        "data_inicio": "2026-07-20T12:00:00",
        "data_fim": "2026-07-20T17:00:00",
        "local": "Clube Recreativo Paulistano, São Paulo — SP",
        "categoria": "Gastronomia",
        "preco_pago": 45.0,
        "lote_pago_nome": "Prato completo",
    },
    {
        "nome": "Workshop: Marketing Digital para Eventos",
        "descricao": "Palestra prática sobre divulgação, vendas online e experiência do público. Certificado incluso.",
        "data_inicio": "2026-09-10T19:00:00",
        "data_fim": "2026-09-10T22:00:00",
        "local": "Centro de Convenções Frei Caneca, São Paulo — SP",
        "categoria": "Palestras",
        "preco_pago": 120.0,
        "lote_pago_nome": "Ingresso único",
    },
]


def _resolve_api_url(env: dict[str, str]) -> str:
    explicit = os.environ.get("SEED_API_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    domain = env.get("DOMAIN", "").strip()
    if domain:
        return f"https://{domain}".rstrip("/")
    front = env.get("FRONTEND_PUBLIC_URL", "").strip().rstrip("/")
    if front:
        return front
    return "http://127.0.0.1:8000"


def _wait_ready(api: str, max_sec: int = 120) -> None:
    deadline = time.time() + max_sec
    while time.time() < deadline:
        try:
            with urlopen(f"{api}/ready", timeout=15) as resp:
                if resp.status == 200:
                    return
        except (HTTPError, URLError, OSError):
            pass
        time.sleep(3)
    raise RuntimeError(f"API não ficou pronta em {api}/ready após {max_sec}s")


def _load_dotenv() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'").replace("$$", "$")
        env[k.strip()] = v
    return env


def _http(
    method: str,
    path: str,
    body: dict | None = None,
    *,
    token: str | None = None,
    admin_key: str | None = None,
) -> dict | list:
    url = f"{API}{path}"
    headers = {"accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if admin_key:
        headers["X-Platform-Admin-Key"] = admin_key
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> {e.code}: {err}") from e
    except URLError as e:
        raise RuntimeError(f"API inacessível em {API}: {e}") from e


def _parece_teste(nome: str, slug: str) -> bool:
    texto = f"{nome} {slug}"
    return any(p.search(texto) for p in PADROES_TESTE)


def _obter_org_token(env: dict[str, str]) -> tuple[str, bool]:
    """Retorna (token, veio_de_conta_existente)."""
    email = os.environ.get("SEED_ORG_EMAIL", "").strip() or env.get("SEED_ORG_EMAIL", "").strip()
    senha = os.environ.get("SEED_ORG_SENHA", "").strip() or env.get("SEED_ORG_SENHA", "").strip()
    if email and senha:
        login = _http("POST", "/api/auth/login", {"email": email, "senha": senha})
        return login["access_token"], True

    suf = uuid.uuid4().hex[:8]
    email = f"demo_{suf}@eventosbr.app.br"
    senha = f"Demo@{suf}!"
    _http(
        "POST",
        "/api/auth/registrar",
        {"email": email, "nome": "EventosBR Demo", "senha": senha, "tipo": "organizador"},
    )
    login = _http("POST", "/api/auth/login", {"email": email, "senha": senha})
    print(f"==> Conta demo criada: {email}")
    return login["access_token"], False


def main() -> int:
    env = _load_dotenv()
    global API  # noqa: PLW0603 — usado por _http
    API = _resolve_api_url(env)

    print(f"==> API: {API}")
    try:
        _wait_ready(API)
    except RuntimeError as e:
        print(f"ERRO: {e}")
        print("Suba a stack antes: ./scripts/atualizar-vps-agora.sh")
        return 1

    admin_key = (
        os.environ.get("PLATFORM_ADMIN_API_KEY", "").strip()
        or env.get("PLATFORM_ADMIN_API_KEY", "").strip()
    )
    if not admin_key:
        print("ERRO: defina PLATFORM_ADMIN_API_KEY no .env")
        return 1

    lista = _http("GET", "/api/admin/eventos?limit=200", admin_key=admin_key)
    eventos = lista.get("eventos", []) if isinstance(lista, dict) else []
    ocultados = 0
    for ev in eventos:
        if not ev.get("publicado"):
            continue
        if _parece_teste(ev.get("nome", ""), ev.get("slug", "")):
            _http(
                "PATCH",
                f"/api/admin/eventos/{ev['id']}/publicado",
                {"publicado": False},
                admin_key=admin_key,
            )
            print(f"  Ocultado: {ev.get('nome')} ({ev.get('slug')})")
            ocultados += 1

    org_token, conta_existente = _obter_org_token(env)
    tentar_pago = os.environ.get("SEED_DEMO_PAGO", "").strip() == "1" and conta_existente
    if os.environ.get("SEED_DEMO_PAGO", "").strip() == "1" and not conta_existente:
        print(
            "AVISO: SEED_DEMO_PAGO=1 ignorado — informe SEED_ORG_EMAIL/SEED_ORG_SENHA de um "
            "organizador com repasse Asaas já aprovado para publicar eventos pagos."
        )

    criados = 0
    for base in EVENTOS_DEMO_BASE:
        preco = base["preco_pago"] if tentar_pago else 0.0
        payload = {
            "nome": base["nome"],
            "descricao": base["descricao"],
            "data_inicio": base["data_inicio"],
            "data_fim": base["data_fim"],
            "local": base["local"],
            "categoria": base["categoria"],
            "preco_ingresso": preco,
            "publicado": True,
            "ingresso_lotes": _lotes_demo(preco, base["lote_pago_nome"]),
        }
        try:
            ev = _http("POST", "/api/eventos/criar", payload, token=org_token)
        except RuntimeError as e:
            if tentar_pago and "400" in str(e):
                print(f"  AVISO: falhou como pago ({base['nome']}), tentando como gratuito...")
                payload["preco_ingresso"] = 0.0
                payload["ingresso_lotes"] = _lotes_demo(0.0, base["lote_pago_nome"])
                ev = _http("POST", "/api/eventos/criar", payload, token=org_token)
            else:
                raise
        print(f"  Publicado: {ev.get('nome')} → /eventos/{ev.get('slug')}")
        criados += 1

    print(f"\n==> Concluído: {ocultados} evento(s) de teste oculto(s), {criados} demo(s) criado(s).")
    if not tentar_pago:
        print(
            "    (Eventos demo criados como gratuitos — publique como pagos com SEED_ORG_EMAIL/"
            "SEED_ORG_SENHA de um organizador com repasse aprovado + SEED_DEMO_PAGO=1.)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
