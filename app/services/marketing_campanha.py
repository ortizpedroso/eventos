"""Criação e disparo de campanhas de marketing (painel admin)."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from queue import Empty, Queue

import httpx
from sqlalchemy.orm import Session

from app.models import CampanhaEnvio, CampanhaMarketing, Usuario
from app.services.marketing_contatos import CanalMarketing, buscar_contatos_marketing
from app.services.marketing_email import enviar_email_marketing_sync
from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_campanha_queue: Queue[str] = Queue()
_worker_started = False
_worker_lock = threading.Lock()


def _resolver_destinatarios(
    db: Session,
    *,
    canal: str,
    usuario_ids: list[str],
    busca: str | None,
    filtro_canal: CanalMarketing,
) -> list[Usuario]:
    if usuario_ids:
        rows = (
            db.query(Usuario)
            .filter(Usuario.id.in_(usuario_ids), Usuario.ativo.is_(True))
            .all()
        )
        out: list[Usuario] = []
        for u in rows:
            if canal == "email" and not u.aceita_comunicacao_email:
                continue
            if canal == "whatsapp" and not (u.aceita_comunicacao_whatsapp and u.telefone):
                continue
            if canal == "ambos" and not (
                u.aceita_comunicacao_email or (u.aceita_comunicacao_whatsapp and u.telefone)
            ):
                continue
            out.append(u)
        return out

    filtro = filtro_canal
    if filtro == "qualquer":
        filtro = "email" if canal == "email" else "whatsapp" if canal == "whatsapp" else "qualquer"
    rows, _ = buscar_contatos_marketing(db, canal=filtro, q=busca, limit=5000, offset=0)
    return rows


def _montar_envios(db: Session, campanha: CampanhaMarketing, usuarios: list[Usuario]) -> list[CampanhaEnvio]:
    envios: list[CampanhaEnvio] = []
    vistos_email: set[str] = set()
    vistos_tel: set[str] = set()

    for u in usuarios:
        if campanha.canal in ("email", "ambos") and u.aceita_comunicacao_email:
            key = (u.email or "").strip().lower()
            if key and key not in vistos_email:
                vistos_email.add(key)
                envios.append(
                    CampanhaEnvio(
                        campanha_id=campanha.id,
                        usuario_id=u.id,
                        nome=u.nome,
                        email=u.email,
                        telefone=u.telefone,
                        canal_envio="email",
                    )
                )
        if campanha.canal in ("whatsapp", "ambos") and u.aceita_comunicacao_whatsapp and u.telefone:
            tel = (u.telefone or "").strip()
            if tel and tel not in vistos_tel:
                vistos_tel.add(tel)
                envios.append(
                    CampanhaEnvio(
                        campanha_id=campanha.id,
                        usuario_id=u.id,
                        nome=u.nome,
                        email=u.email,
                        telefone=tel,
                        canal_envio="whatsapp",
                    )
                )
    db.add_all(envios)
    campanha.total_destinatarios = len(envios)
    db.commit()
    return envios


def criar_campanha(
    db: Session,
    *,
    nome: str,
    assunto: str,
    mensagem: str,
    canal: str,
    usuario_ids: list[str],
    busca: str | None,
    filtro_canal: CanalMarketing,
) -> CampanhaMarketing:
    campanha = CampanhaMarketing(
        nome=nome.strip(),
        assunto=assunto.strip(),
        mensagem=mensagem.strip(),
        canal=canal,
        status="rascunho",
    )
    db.add(campanha)
    db.commit()
    db.refresh(campanha)

    usuarios = _resolver_destinatarios(
        db,
        canal=canal,
        usuario_ids=usuario_ids,
        busca=busca,
        filtro_canal=filtro_canal,
    )
    _montar_envios(db, campanha, usuarios)
    db.refresh(campanha)
    return campanha


def _enviar_whatsapp_webhook(destino_tel: str, nome: str, mensagem: str) -> tuple[bool, str | None]:
    url = (settings.MARKETING_WHATSAPP_WEBHOOK_URL or "").strip()
    if not url:
        return False, "Webhook WhatsApp não configurado (MARKETING_WHATSAPP_WEBHOOK_URL)."
    headers: dict[str, str] = {}
    token = (settings.MARKETING_WHATSAPP_WEBHOOK_TOKEN or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                url,
                json={"telefone": destino_tel, "nome": nome, "mensagem": mensagem},
                headers=headers,
            )
        if r.status_code >= 400:
            return False, f"Webhook HTTP {r.status_code}"
        return True, None
    except Exception as e:
        return False, str(e)[:480]


def _processar_campanha_sync(campanha_id: str) -> None:
    db = SessionLocal()
    try:
        campanha = db.get(CampanhaMarketing, campanha_id)
        if not campanha:
            return
        campanha.status = "enviando"
        db.commit()

        envios = (
            db.query(CampanhaEnvio)
            .filter(CampanhaEnvio.campanha_id == campanha_id, CampanhaEnvio.status == "pendente")
            .all()
        )
        ok = 0
        err = 0
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")

        for env in envios:
            try:
                if env.canal_envio == "email":
                    dest = (env.email or "").strip()
                    if not dest:
                        env.status = "erro"
                        env.erro_msg = "Sem e-mail"
                        err += 1
                        continue
                    sucesso = enviar_email_marketing_sync(
                        destino=dest,
                        nome=env.nome,
                        assunto=campanha.assunto,
                        mensagem=campanha.mensagem,
                        link_preferencias=f"{base}/conta/perfil",
                    )
                    if sucesso:
                        env.status = "enviado"
                        env.enviado_em = agora
                        ok += 1
                    else:
                        env.status = "erro"
                        env.erro_msg = "Falha SMTP"
                        err += 1
                else:
                    tel = (env.telefone or "").strip()
                    if not tel:
                        env.status = "erro"
                        env.erro_msg = "Sem telefone"
                        err += 1
                        continue
                    wpp_ok, wpp_err = _enviar_whatsapp_webhook(tel, env.nome, campanha.mensagem)
                    if wpp_ok:
                        env.status = "enviado"
                        env.enviado_em = agora
                        ok += 1
                    else:
                        env.status = "erro"
                        env.erro_msg = wpp_err
                        err += 1
            except Exception as e:
                env.status = "erro"
                env.erro_msg = str(e)[:480]
                err += 1

        campanha.enviados_ok = ok
        campanha.enviados_erro = err
        campanha.status = "concluida"
        campanha.disparado_em = agora
        db.commit()
        logger.info("Campanha %s: ok=%s erro=%s", campanha_id, ok, err)
    except Exception:
        logger.exception("Falha campanha %s", campanha_id)
        if campanha := db.get(CampanhaMarketing, campanha_id):
            campanha.status = "erro"
            db.commit()
    finally:
        db.close()


def _worker_loop() -> None:
    while True:
        try:
            cid = _campanha_queue.get(timeout=2.0)
        except Empty:
            continue
        try:
            _processar_campanha_sync(cid)
        finally:
            _campanha_queue.task_done()


def _ensure_worker() -> None:
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        threading.Thread(target=_worker_loop, name="campanha-marketing-worker", daemon=True).start()
        _worker_started = True


def disparar_campanha(db: Session, campanha_id: str) -> CampanhaMarketing:
    campanha = db.get(CampanhaMarketing, campanha_id)
    if not campanha:
        raise ValueError("Campanha não encontrada.")
    if campanha.status not in ("rascunho", "concluida", "erro"):
        raise ValueError("Campanha já está em envio.")
    if campanha.total_destinatarios <= 0:
        raise ValueError("Nenhum destinatário elegível (verifique opt-in e filtros).")

    total_envios = (
        db.query(CampanhaEnvio).filter(CampanhaEnvio.campanha_id == campanha_id).count()
    )
    if total_envios == 0:
        raise ValueError("Sem envios na campanha.")
    db.query(CampanhaEnvio).filter(CampanhaEnvio.campanha_id == campanha_id).update(
        {
            CampanhaEnvio.status: "pendente",
            CampanhaEnvio.erro_msg: None,
            CampanhaEnvio.enviado_em: None,
        },
        synchronize_session=False,
    )

    campanha.enviados_ok = 0
    campanha.enviados_erro = 0
    campanha.status = "enviando"
    db.commit()

    _ensure_worker()
    _campanha_queue.put(campanha_id)
    db.refresh(campanha)
    return campanha
