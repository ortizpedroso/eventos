"""Listagem de utilizadores com opt-in de marketing (LGPD)."""

from __future__ import annotations

from typing import Literal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Usuario

CanalMarketing = Literal["email", "whatsapp", "qualquer"]


def listar_contatos_marketing(
    db: Session,
    *,
    canal: CanalMarketing = "qualquer",
) -> list[Usuario]:
    rows, _ = buscar_contatos_marketing(db, canal=canal, limit=5000, offset=0)
    return rows


def _aplicar_filtro_canal(q, canal: CanalMarketing):
    if canal == "email":
        return q.filter(Usuario.aceita_comunicacao_email.is_(True))
    if canal == "whatsapp":
        return q.filter(
            Usuario.aceita_comunicacao_whatsapp.is_(True),
            Usuario.telefone.isnot(None),
            Usuario.telefone != "",
        )
    return q.filter(
        (Usuario.aceita_comunicacao_email.is_(True))
        | (Usuario.aceita_comunicacao_whatsapp.is_(True))
    )


def buscar_contatos_marketing(
    db: Session,
    *,
    canal: CanalMarketing = "qualquer",
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Usuario], int]:
    """Busca paginada por nome, e-mail ou telefone (só com opt-in)."""
    base = db.query(Usuario).filter(Usuario.ativo.is_(True))
    base = _aplicar_filtro_canal(base, canal)

    termo = (q or "").strip()
    if termo:
        like = f"%{termo}%"
        base = base.filter(
            or_(
                Usuario.nome.ilike(like),
                func.lower(Usuario.email).like(like.lower()),
                Usuario.telefone.ilike(like),
            )
        )

    total = base.count()
    rows = (
        base.order_by(Usuario.nome.asc())
        .offset(max(0, offset))
        .limit(min(max(1, limit), 500))
        .all()
    )
    return rows, total


def usuario_para_export_row(u: Usuario) -> dict:
    return {
        "id": u.id,
        "nome": u.nome,
        "email": u.email,
        "telefone": u.telefone if u.aceita_comunicacao_whatsapp else None,
        "tipo": u.tipo,
        "aceita_comunicacao_email": bool(u.aceita_comunicacao_email),
        "aceita_comunicacao_whatsapp": bool(u.aceita_comunicacao_whatsapp),
        "comunicacao_consentimento_em": (
            u.comunicacao_consentimento_em.isoformat() if u.comunicacao_consentimento_em else None
        ),
        "data_criacao": u.data_criacao.isoformat() if u.data_criacao else None,
    }
