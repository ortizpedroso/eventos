"""Envio de ingresso por e-mail (SMTP) com fila em thread para não bloquear webhooks."""

from __future__ import annotations

import logging
import threading
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from queue import Empty, Queue

from sqlalchemy.orm import Session, joinedload

from app.models import Evento, Ingresso
from app.utils.html_escape import esc
from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.ingresso_qr import ingresso_qr_payload, montar_carteirinha_ingresso_bytes
from app.services.redis_conn import get_redis_optional
from app.services.senha_definir import gerar_link_definir_senha
from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_REDIS_QUEUE_KEY = "eventosbr:q:ticket_email"
_REDIS_PROCESSING_KEY = "eventosbr:q:ticket_email:processing"
_REDIS_ATTEMPTS_PREFIX = "eventosbr:email:att:"

_memory_queue: Queue[str] = Queue()
_worker_lock = threading.Lock()
_worker_started = False
_worker_thread: threading.Thread | None = None
_stop_worker = threading.Event()


from app.services.smtp_client import format_from_header_branded, send_prebuilt_message, smtp_configured


def _build_html(ingresso: Ingresso, qr_cid: str, db: Session) -> str:
    evento = ingresso.evento
    branding = get_email_branding(db)
    valor_fmt = f"{ingresso.valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    org = getattr(evento, "organizador", None)
    org_name = (org.brand_name or org.nome) if org else None

    dono = getattr(ingresso, "usuario", None)
    if dono is not None and not dono.senha_hash:
        # Conta sem senha (ex.: criada na hora pra uma venda de PDV) — o link não
        # pode levar direto pra tela do ingresso, já que a pessoa ainda não tem
        # como entrar na conta.
        link = gerar_link_definir_senha(db, dono)
        link_texto = "Criar senha e ver ingresso"
        aviso_senha = (
            '<p style="font-size:13px;color:#3f3f46">Sua conta foi criada automaticamente para '
            "este ingresso. Antes de acessá-la, defina uma senha clicando no botão abaixo.</p>"
        )
    else:
        link = f"{base}/conta/ingressos/{ingresso.id}"
        link_texto = "Ver ingresso na conta"
        aviso_senha = ""

    body = (
        f"<p>Olá, <strong>{esc(ingresso.participante_nome)}</strong>!</p>"
        f"<p>Seu ingresso está confirmado. Apresente a carteirinha abaixo (com o QR Code) na entrada — "
        f"ela já tem seu nome, o evento, data e local, então funciona mesmo se você só salvar essa imagem.</p>"
        f'<p style="text-align:center"><img src="cid:{qr_cid}" alt="Ingresso — {esc(evento.nome)}" '
        f'width="240" style="border-radius:8px;border:1px solid #e4e4e7"/></p>'
        f'<p style="font-size:12px;color:#71717a">Código para digitar na portaria (se o scanner falhar):<br/>'
        f'<span style="font-family:monospace;word-break:break-all">{esc(ingresso_qr_payload(ingresso.id))}</span></p>'
        f'<p><strong>Valor:</strong> R$ {valor_fmt}</p>'
        f"{aviso_senha}"
        f'<p><a href="{link}" style="{link_style(branding)}">{link_texto}</a></p>'
        f'<p style="font-size:11px;color:#a1a1aa">Reembolso: até 10 dias em Minha conta → Pagamentos.</p>'
    )
    return build_email_html(
        title=evento.nome,
        body_html=body,
        branding=branding,
        organizer_name=org_name,
    )


def _send_sync(ingresso_id: str) -> bool:
    db: Session = SessionLocal()
    try:
        ingresso = (
            db.query(Ingresso)
            .options(
                joinedload(Ingresso.evento).joinedload(Evento.organizador),
                joinedload(Ingresso.usuario),
            )
            .filter(Ingresso.id == ingresso_id, Ingresso.status == "pago")
            .first()
        )
        if not ingresso:
            logger.warning("E-mail ingresso: %s não encontrado ou não pago", ingresso_id)
            return False

        destino = (ingresso.participante_email or "").strip()
        if not destino:
            logger.warning("E-mail ingresso %s: sem destino", ingresso_id)
            return False

        qr_bytes = montar_carteirinha_ingresso_bytes(ingresso)
        qr_cid = "ingresso_qr"
        html = _build_html(ingresso, qr_cid, db)
        branding = get_email_branding(db)

        msg = MIMEMultipart("related")
        msg["Subject"] = format_email_subject(f"Seu ingresso — {ingresso.evento.nome}", branding)
        msg["From"] = format_from_header_branded(db)
        msg["To"] = destino

        alt = MIMEMultipart("alternative")
        alt.attach(
            MIMEText(
                f"Ingresso: {ingresso.evento.nome}\n"
                f"Participante: {ingresso.participante_nome}\n"
                f"QR: {ingresso_qr_payload(ingresso.id)}",
                "plain",
                "utf-8",
            )
        )
        alt.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(alt)

        img = MIMEImage(qr_bytes, _subtype="png")
        img.add_header("Content-ID", f"<{qr_cid}>")
        img.add_header("Content-Disposition", "inline", filename="ingresso-qr.png")
        msg.attach(img)

        if not smtp_configured():
            # False (não True): evita o worker marcar como "ok" e descartar sem
            # entrega — sintoma "disse que enviou e nunca chegou".
            logger.error(
                "E-mail ingresso %s → %s NÃO enviado (SMTP não configurado)",
                ingresso_id,
                destino,
            )
            return False

        if not send_prebuilt_message(msg, destino=destino):
            return False

        logger.info("E-mail ingresso enviado: %s → %s", ingresso_id, destino)
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail do ingresso %s", ingresso_id)
        return False
    finally:
        db.close()


def _use_redis_queue() -> bool:
    return bool(settings.TICKET_EMAIL_USE_REDIS and get_redis_optional())


def _enqueue_redis(ingresso_id: str) -> bool:
    r = get_redis_optional()
    if not r:
        return False
    try:
        r.lpush(_REDIS_QUEUE_KEY, ingresso_id)
        return True
    except Exception:
        logger.exception("Falha ao enfileirar e-mail no Redis (%s)", ingresso_id)
        return False


def _dequeue_next() -> str | None:
    r = get_redis_optional()
    if _use_redis_queue() and r:
        try:
            # blmove (não brpop): move atomicamente pra lista "processing" em vez de
            # descartar — se o processo morrer no meio do envio (ex: deploy reiniciando
            # o container), o item some da fila principal mas continua recuperável na
            # lista de processamento (ver _recuperar_orfaos_processing, chamada no
            # início do worker). Sem isso, um e-mail podia ser retirado da fila e
            # perdido pra sempre se o container reiniciasse durante o envio SMTP.
            item = r.blmove(_REDIS_QUEUE_KEY, _REDIS_PROCESSING_KEY, timeout=2, src="RIGHT", dest="LEFT")
            if item:
                return item
        except Exception:
            logger.exception("Falha ao ler fila Redis de e-mail")
    try:
        return _memory_queue.get(timeout=0.5)
    except Empty:
        return None


def _marcar_processado(ingresso_id: str) -> None:
    """Remove da lista 'processing' após o envio terminar (sucesso ou falha já reenfileirada)."""
    r = get_redis_optional()
    if _use_redis_queue() and r:
        try:
            r.lrem(_REDIS_PROCESSING_KEY, 1, ingresso_id)
        except Exception:
            logger.exception("Falha ao remover %s da lista de processamento", ingresso_id)


def _recuperar_orfaos_processing() -> None:
    """Ao iniciar o worker, devolve pra fila principal qualquer item deixado em
    'processing' por um processo anterior que morreu no meio do envio (deploy,
    crash, etc.) — sem isso esses e-mails ficariam perdidos silenciosamente."""
    r = get_redis_optional()
    if not (_use_redis_queue() and r):
        return
    try:
        recuperados = 0
        while True:
            item = r.rpoplpush(_REDIS_PROCESSING_KEY, _REDIS_QUEUE_KEY)
            if item is None:
                break
            recuperados += 1
        if recuperados:
            logger.warning(
                "Worker de e-mail: %s ingresso(s) órfão(s) recuperado(s) de um processo anterior",
                recuperados,
            )
    except Exception:
        logger.exception("Falha ao recuperar itens órfãos da fila de e-mail")


def _schedule_retry(ingresso_id: str) -> None:
    r = get_redis_optional()
    max_attempts = max(1, int(settings.TICKET_EMAIL_MAX_ATTEMPTS))
    if r and _use_redis_queue():
        key = f"{_REDIS_ATTEMPTS_PREFIX}{ingresso_id}"
        try:
            attempts = int(r.incr(key))
            r.expire(key, 86_400)
            if attempts < max_attempts:
                import time

                time.sleep(min(attempts * 2, 15))
                r.lpush(_REDIS_QUEUE_KEY, ingresso_id)
                logger.warning(
                    "E-mail ingresso %s reenfileirado (tentativa %s/%s)",
                    ingresso_id,
                    attempts,
                    max_attempts,
                )
            else:
                logger.error(
                    "E-mail ingresso %s abandonado após %s tentativas",
                    ingresso_id,
                    attempts,
                )
            return
        except Exception:
            logger.exception("Falha ao reenfileirar e-mail %s", ingresso_id)
    logger.error("E-mail ingresso %s não enviado (sem retry em memória)", ingresso_id)


def _worker_loop() -> None:
    while not _stop_worker.is_set():
        ingresso_id = _dequeue_next()
        if not ingresso_id:
            continue
        try:
            ok = _send_sync(ingresso_id)
            if not ok:
                _schedule_retry(ingresso_id)
        finally:
            _marcar_processado(ingresso_id)


def start_ticket_email_worker() -> None:
    global _worker_started, _worker_thread
    with _worker_lock:
        if _worker_started and _worker_thread is not None and _worker_thread.is_alive():
            return
        _recuperar_orfaos_processing()
        _stop_worker.clear()
        t = threading.Thread(target=_worker_loop, name="ticket-email-worker", daemon=True)
        t.start()
        _worker_thread = t
        _worker_started = True
        backend = "redis" if _use_redis_queue() else "memória"
        logger.info("Worker de e-mail de ingressos iniciado (%s)", backend)


def stop_ticket_email_worker(*, aguardar_segundos: float = 25.0) -> None:
    """Sinaliza parada e ESPERA o envio em andamento terminar (até aguardar_segundos)
    antes de deixar o processo encerrar — evita perder um e-mail cujo SMTP já estava
    em andamento no exato momento do shutdown (ex: durante um deploy)."""
    _stop_worker.set()
    if _worker_thread is not None and _worker_thread.is_alive():
        _worker_thread.join(timeout=aguardar_segundos)
        if _worker_thread.is_alive():
            logger.warning(
                "Worker de e-mail não encerrou em %.0fs — pode haver um envio em andamento "
                "não confirmado (fica recuperável na lista de processamento do Redis).",
                aguardar_segundos,
            )


def enqueue_ticket_email(ingresso_id: str) -> None:
    """Enfileira envio assíncrono (não bloqueia request/webhook)."""
    start_ticket_email_worker()
    if not _enqueue_redis(ingresso_id):
        _memory_queue.put(ingresso_id)


def _send_comunicado_sync(evento_id: str, assunto: str, mensagem: str) -> int:
    db: Session = SessionLocal()
    enviados = 0
    try:
        ingressos = (
            db.query(Ingresso)
            .options(joinedload(Ingresso.evento).joinedload(Evento.organizador))
            .filter(
                Ingresso.evento_id == evento_id,
                Ingresso.status.in_(("pago", "usado")),
            )
            .all()
        )
        branding = get_email_branding(db)
        vistos: set[str] = set()
        base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")

        for ing in ingressos:
            destino = (ing.participante_email or "").strip()
            key = destino.lower()
            if not destino or key in vistos:
                continue
            vistos.add(key)

            corpo = esc(mensagem).replace("\n", "<br/>")
            ev_nome = esc(ing.evento.nome)
            part_nome = esc(ing.participante_nome or "participante")
            org = getattr(ing.evento, "organizador", None)
            org_name = (org.brand_name or org.nome) if org else None
            body = (
                f"<p>Olá, <strong>{part_nome}</strong>!</p>"
                f'<div style="margin:16px 0;line-height:1.5">{corpo}</div>'
                f'<p style="font-size:12px;color:#71717a">Seus ingressos continuam disponíveis em '
                f'<a href="{base}/conta/ingressos" style="{link_style(branding)}">Minha conta → Ingressos</a>.</p>'
            )
            html = build_email_html(
                title=ev_nome,
                body_html=body,
                branding=branding,
                organizer_name=org_name,
                footer_note="Mensagem enviada pelo organizador do evento.",
            )

            msg = MIMEMultipart("alternative")
            msg["Subject"] = assunto[:200]
            msg["From"] = format_from_header_branded(db)
            msg["To"] = destino
            msg.attach(MIMEText(mensagem, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))

            if not smtp_configured():
                enviados += 1
                continue
            try:
                if send_prebuilt_message(msg, destino=destino):
                    enviados += 1
            except Exception:
                logger.exception("Falha comunicado → %s", destino)
        return enviados
    finally:
        db.close()


_comunicado_queue: Queue[tuple[str, str, str]] = Queue()


def _comunicado_worker() -> None:
    while True:
        try:
            item = _comunicado_queue.get(timeout=2.0)
        except Empty:
            continue
        try:
            _send_comunicado_sync(*item)
        finally:
            _comunicado_queue.task_done()


_comunicado_worker_started = False


def enqueue_comunicado_evento(evento_id: str, assunto: str, mensagem: str) -> int:
    global _comunicado_worker_started
    with _worker_lock:
        if not _comunicado_worker_started:
            threading.Thread(
                target=_comunicado_worker,
                name="comunicado-email-worker",
                daemon=True,
            ).start()
            _comunicado_worker_started = True
    _comunicado_queue.put((evento_id, assunto, mensagem))
    db: Session = SessionLocal()
    try:
        n = (
            db.query(Ingresso)
            .filter(
                Ingresso.evento_id == evento_id,
                Ingresso.status.in_(("pago", "usado")),
                Ingresso.participante_email.isnot(None),
            )
            .count()
        )
        return n
    finally:
        db.close()
