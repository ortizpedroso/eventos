import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import secrets
import stripe

from app.models import Usuario, get_db
from app.schemas.usuario import (
    AtualizarPerfilRequest,
    CompraRapidaRequest,
    OAuthConfigResponse,
    OAuthLoginRequest,
    UsuarioCreate,
    UsuarioLogin,
    UsuarioResponse,
    Token,
    SolicitarRecuperacaoSenhaRequest,
    RedefinirSenhaRequest,
    VerificarEmailRequest,
)
from app.deps.rate_limit import rate_limit_login, rate_limit_oauth, rate_limit_register
from app.services.oauth_verify import (
    OAuthTokenInvalid,
    oauth_google_enabled,
    verify_google_id_token,
)
from app.services.oauth_usuario import obter_ou_criar_usuario_oauth
from app.services.oauth_vincular import vincular_google_a_conta_email
from app.services.auth import (
    create_access_token,
    decode_token,
    decode_token_payload,
    hash_password,
    verify_password,
)
from app.services.usuario_pagamentos import criar_pagamento_para_novo_usuario
from app.services.password_reset_email import enviar_email_recuperacao_senha
from app.services.email_verificacao import (
    confirmar_email_por_token,
    disparar_verificacao_compra_rapida,
    enviar_email_verificacao,
    preparar_verificacao_email,
)
from app.utils.auth_cookie import AUTH_COOKIE_NAME, clear_auth_cookie, set_auth_cookie
from app.utils.public_errors import PAGAMENTO_CLIENTE, STRIPE_CLIENTE
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False,
)

stripe.api_key = settings.STRIPE_SECRET_KEY


def _normalizar_telefone_usuario(valor: str | None) -> str | None:
    if valor is None:
        return None
    digits = "".join(c for c in str(valor) if c.isdigit())
    if not digits:
        return None
    if len(digits) < 10 or len(digits) > 13:
        raise HTTPException(
            status_code=400,
            detail="Telefone inválido. Use DDD + número (10 a 13 dígitos).",
        )
    return digits


def _aplicar_preferencias_comunicacao(
    usuario: Usuario,
    *,
    aceita_email: bool,
    aceita_whatsapp: bool,
    telefone: str | None,
) -> None:
    if aceita_whatsapp and not telefone:
        raise HTTPException(
            status_code=400,
            detail="Informe um telefone válido para receber comunicações por WhatsApp.",
        )
    mudou = (
        bool(usuario.aceita_comunicacao_email) != aceita_email
        or bool(usuario.aceita_comunicacao_whatsapp) != aceita_whatsapp
        or (usuario.telefone or None) != (telefone or None)
    )
    usuario.aceita_comunicacao_email = aceita_email
    usuario.aceita_comunicacao_whatsapp = aceita_whatsapp
    usuario.telefone = telefone
    if mudou:
        usuario.comunicacao_consentimento_em = datetime.now(timezone.utc).replace(tzinfo=None)


def _stripe_error_all_text(err: Exception) -> str:
    """Junta mensagens do SDK Stripe (string, user_message, JSON error.*)."""
    parts: list[str] = [str(err)]
    if isinstance(err, stripe.error.StripeError):
        um = getattr(err, "user_message", None)
        if um:
            parts.append(str(um))
        body = getattr(err, "json_body", None)
        if isinstance(body, dict):
            sub = body.get("error")
            if isinstance(sub, dict):
                for key in ("message", "type", "code", "param", "doc_url"):
                    v = sub.get(key)
                    if v:
                        parts.append(str(v))
    return " ".join(parts).lower()


def _stripe_connect_platform_terms_missing(err: Exception) -> bool:
    """Stripe Connect: plataforma precisa aceitar termos (loss liability) antes de criar contas Express."""
    text = _stripe_error_all_text(err)
    if "managing losses" in text or "loss liability" in text:
        return True
    if "responsibilities" in text and "losses" in text:
        return True
    if "connected account agreement" in text or "stripe connected account" in text:
        if "accept" in text or "must" in text or "aceitar" in text or "precisa" in text:
            return True
    if "responsabilidade" in text and ("perda" in text or "perdas" in text):
        return True
    if "aceitar" in text and ("conect" in text or "connect" in text) and ("termo" in text or "terms" in text or "perda" in text):
        return True
    if "platform" in text and "loss" in text and ("accept" in text or "agreement" in text):
        return True
    return False


@router.post("/registrar", response_model=Token)
async def registrar(
    usuario_data: UsuarioCreate,
    response: Response,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_register),
):
    """Registra novo usuário"""

    logger.info("Registrando novo usuário (tipo=%s)", usuario_data.tipo)

    email = str(usuario_data.email).strip().lower()

    # Verifica se email já existe
    usuario_existente = db.query(Usuario).filter(
        func.lower(Usuario.email) == email
    ).first()

    if usuario_existente:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    stripe_customer_id: str | None = None
    stripe_account_id: str | None = None
    asaas_customer_id: str | None = None
    asaas_wallet_id: str | None = None
    asaas_account_id: str | None = None

    if not settings.payments_disabled:
        try:
            prov = criar_pagamento_para_novo_usuario(
                email=usuario_data.email,
                nome=usuario_data.nome,
                tipo=usuario_data.tipo,
                telefone=_normalizar_telefone_usuario(usuario_data.telefone),
            )
            stripe_customer_id = prov.get("stripe_customer_id")
            stripe_account_id = prov.get("stripe_account_id")
            asaas_customer_id = prov.get("asaas_customer_id")
            asaas_wallet_id = prov.get("asaas_wallet_id")
            asaas_account_id = prov.get("asaas_account_id")
        except Exception as e:
            if settings.use_asaas:
                from app.services.asaas_client import AsaasAPIError

                if isinstance(e, AsaasAPIError):
                    logger.exception("Erro Asaas no registo")
                    raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e
            logger.exception("Erro no provedor de pagamento no registo")
            raise HTTPException(status_code=400, detail=STRIPE_CLIENTE) from e
    else:
        logger.warning(
            "Pagamentos desativados: registro de %s (%s) sem customer/conta",
            usuario_data.email,
            usuario_data.tipo,
        )

    tel = _normalizar_telefone_usuario(usuario_data.telefone)
    aceita_email = bool(usuario_data.aceita_comunicacao_email)
    aceita_whatsapp = bool(usuario_data.aceita_comunicacao_whatsapp)
    if aceita_whatsapp and not tel:
        raise HTTPException(
            status_code=400,
            detail="Para WhatsApp, informe um telefone com DDD no cadastro ou ative depois no perfil.",
        )

    novo_usuario = Usuario(
        email=email,
        nome=usuario_data.nome,
        senha_hash=hash_password(usuario_data.senha),
        tipo=usuario_data.tipo,
        email_verificado=True,
        stripe_customer_id=stripe_customer_id,
        stripe_account_id=stripe_account_id,
        asaas_customer_id=asaas_customer_id,
        asaas_wallet_id=asaas_wallet_id,
        asaas_account_id=asaas_account_id,
        aceita_comunicacao_email=aceita_email,
        aceita_comunicacao_whatsapp=aceita_whatsapp,
        telefone=tel,
    )
    if aceita_email or aceita_whatsapp:
        novo_usuario.comunicacao_consentimento_em = datetime.now(timezone.utc).replace(tzinfo=None)

    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    logger.info("Usuário criado: %s", novo_usuario.id)

    access_token = _issue_token(novo_usuario)
    set_auth_cookie(response, access_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": UsuarioResponse.model_validate(novo_usuario),
    }


@router.post("/compra-rapida", response_model=Token)
async def compra_rapida(
    body: CompraRapidaRequest,
    response: Response,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_register),
):
    """Checkout convidado: cria conta cliente mínima (sem senha) e autentica via cookie."""

    email = str(body.email).strip().lower()
    nome = body.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")

    existente = db.query(Usuario).filter(func.lower(Usuario.email) == email).first()
    if existente:
        if not existente.ativo:
            raise HTTPException(
                status_code=403,
                detail="Conta desativada. Entre em contato com o suporte da plataforma.",
            )
        if existente.senha_hash:
            raise HTTPException(
                status_code=409,
                detail="Este e-mail já tem conta. Use Entrar ou Continuar com Google.",
            )
        if existente.auth_provider and existente.auth_provider != "email":
            prov = (
                "Google"
                if existente.auth_provider == "google"
                else existente.auth_provider.capitalize()
            )
            raise HTTPException(
                status_code=409,
                detail=f"Este e-mail já tem conta com {prov}. Use o botão correspondente.",
            )
        if existente.nome != nome:
            existente.nome = nome
            db.commit()
            db.refresh(existente)
        if not existente.email_verificado and not existente.senha_hash:
            disparar_verificacao_compra_rapida(db, existente)
        logger.info("Compra rápida: sessão reutilizada para %s", email)
        return _token_response(existente, response)

    stripe_customer_id: str | None = None
    asaas_customer_id: str | None = None
    if not settings.payments_disabled:
        try:
            prov = criar_pagamento_para_novo_usuario(email=email, nome=nome, tipo="cliente")
            stripe_customer_id = prov.get("stripe_customer_id")
            asaas_customer_id = prov.get("asaas_customer_id")
        except Exception as e:
            logger.exception("Erro provedor pagamento na compra rápida: %s", e)
            raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e
    else:
        logger.warning("Pagamentos desativados: compra rápida %s sem customer", email)

    novo_usuario = Usuario(
        email=email,
        nome=nome,
        senha_hash=None,
        tipo="cliente",
        auth_provider="email",
        email_verificado=False,
        stripe_customer_id=stripe_customer_id,
        asaas_customer_id=asaas_customer_id,
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    disparar_verificacao_compra_rapida(db, novo_usuario)
    logger.info("Compra rápida: usuário criado %s", novo_usuario.id)
    return _token_response(novo_usuario, response)


@router.post("/login", response_model=Token)
async def login(
    credenciais: UsuarioLogin,
    response: Response,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_login),
):
    """Login de usuário"""

    email = str(credenciais.email).strip().lower()
    logger.info("Tentativa de login")

    usuario = db.query(Usuario).filter(
        func.lower(Usuario.email) == email
    ).first()

    if not usuario:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not usuario.senha_hash:
        if (usuario.auth_provider or "email") == "email":
            raise HTTPException(
                status_code=401,
                detail=(
                    "Esta conta ainda não tem senha. Acesse Minha conta → Perfil para criar uma, "
                    "ou use «Continuar com Google» no checkout."
                ),
            )
        prov = (usuario.auth_provider or "social").capitalize()
        if usuario.auth_provider == "google":
            prov = "Google"
        elif usuario.auth_provider == "apple":
            prov = "Apple"
        raise HTTPException(
            status_code=401,
            detail=f"Esta conta usa login com {prov}. Use o botão correspondente abaixo.",
        )
    if not verify_password(credenciais.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    if not usuario.ativo:
        raise HTTPException(
            status_code=403,
            detail="Conta desativada. Entre em contato com o suporte da plataforma.",
        )

    access_token = _issue_token(usuario)
    set_auth_cookie(response, access_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": UsuarioResponse.model_validate(usuario)
    }


@router.post("/solicitar-recuperacao-senha")
async def solicitar_recuperacao_senha(
    body: SolicitarRecuperacaoSenhaRequest,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_login),
):
    """Envia link de recuperação por e-mail (resposta genérica por segurança)."""
    email = str(body.email).strip().lower()
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email).first()
    msg = "Se o e-mail estiver cadastrado e tiver senha, você receberá instruções em instantes."

    if usuario and usuario.ativo and usuario.senha_hash:
        token = secrets.token_urlsafe(32)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        usuario.senha_reset_token = token
        usuario.senha_reset_expires = agora + timedelta(hours=1)
        db.commit()
        base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
        link = f"{base}/auth?reset={token}"
        enviar_email_recuperacao_senha(destino=usuario.email, nome=usuario.nome, link=link)

    return {"message": msg}


@router.post("/redefinir-senha")
async def redefinir_senha(
    body: RedefinirSenhaRequest,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_login),
):
    """Define nova senha a partir do token recebido por e-mail."""
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    usuario = (
        db.query(Usuario)
        .filter(Usuario.senha_reset_token == body.token.strip())
        .first()
    )
    if (
        not usuario
        or not usuario.senha_reset_expires
        or usuario.senha_reset_expires < agora
        or not usuario.ativo
    ):
        raise HTTPException(
            status_code=400,
            detail="Link inválido ou expirado. Solicite uma nova recuperação de senha.",
        )

    usuario.senha_hash = hash_password(body.nova_senha)
    usuario.senha_reset_token = None
    usuario.senha_reset_expires = None
    usuario.token_version = int(usuario.token_version or 0) + 1
    db.commit()

    return {"message": "Senha atualizada com sucesso. Faça login com a nova senha."}


@router.post("/verificar-email")
async def verificar_email(
    body: VerificarEmailRequest,
    db: Session = Depends(get_db),
):
    """Confirma propriedade do e-mail via link enviado na compra rápida."""
    usuario = confirmar_email_por_token(db, body.token)
    if not usuario:
        raise HTTPException(
            status_code=400,
            detail="Link inválido ou expirado. Solicite um novo e-mail de confirmação.",
        )
    return {
        "message": "E-mail confirmado com sucesso!",
        "email_verificado": True,
    }


def _issue_token(usuario: Usuario) -> str:
    return create_access_token(
        data={"sub": usuario.id, "tv": int(usuario.token_version or 0)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def _token_from_request(request: Request, bearer: str | None) -> str | None:
    if bearer:
        return bearer
    cookie = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie and cookie.strip():
        return cookie.strip()
    return None


def _token_response(usuario: Usuario, response: Response) -> dict:
    access_token = _issue_token(usuario)
    set_auth_cookie(response, access_token)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": UsuarioResponse.model_validate(usuario),
    }


@router.post("/logout")
async def logout(response: Response):
    """Encerra sessão (remove cookie HttpOnly)."""
    clear_auth_cookie(response)
    return {"ok": True}


class VincularGoogleRequest(BaseModel):
    id_token: str = Field(min_length=20, max_length=8192)
    senha_atual: str = Field(min_length=1, max_length=128)


@router.get("/oauth-config", response_model=OAuthConfigResponse)
async def oauth_config():
    """Client ID Google — o frontend usa para exibir login social."""
    google_id = (settings.GOOGLE_OAUTH_CLIENT_ID or "").strip()
    return OAuthConfigResponse(
        google_enabled=oauth_google_enabled(),
        google_client_id=google_id,
    )


def _nome_from_oauth_claims(payload: dict, fallback_email: str) -> str:
    name = (payload.get("name") or "").strip()
    if name:
        return name
    given = (payload.get("given_name") or "").strip()
    family = (payload.get("family_name") or "").strip()
    if given or family:
        return f"{given} {family}".strip()
    return fallback_email.split("@")[0] or "Usuário"


@router.post("/google", response_model=Token)
async def login_google(
    body: OAuthLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_oauth),
):
    if not oauth_google_enabled():
        raise HTTPException(status_code=503, detail="Login com Google não está configurado.")
    try:
        claims = verify_google_id_token(body.id_token)
    except OAuthTokenInvalid as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    email = str(claims.get("email", "")).strip().lower()
    sub = str(claims.get("sub", "")).strip()
    nome = _nome_from_oauth_claims(claims, email)
    tel = _normalizar_telefone_usuario(body.telefone) if body.telefone else None

    usuario = obter_ou_criar_usuario_oauth(
        db,
        provider="google",
        provider_id=sub,
        email=email,
        nome=nome,
        tipo=body.tipo,
        aceita_comunicacao_email=body.aceita_comunicacao_email,
        aceita_comunicacao_whatsapp=body.aceita_comunicacao_whatsapp,
        telefone=tel,
    )
    return _token_response(usuario, response)


async def get_usuario_atual(
    request: Request,
    bearer: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Obtém usuário autenticado (cookie HttpOnly ou Bearer)."""
    token = _token_from_request(request, bearer)
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")

    payload = decode_token_payload(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")

    usuario_id = payload.get("sub")
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Conta desativada")

    tv_token = int(payload.get("tv", 0) or 0)
    if tv_token != int(usuario.token_version or 0):
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")

    return usuario


@router.post("/reenviar-verificacao-email")
async def reenviar_verificacao_email(
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Reenvia link de confirmação para a conta autenticada."""
    if usuario.email_verificado:
        return {"message": "Seu e-mail já está confirmado."}
    token = preparar_verificacao_email(usuario)
    db.commit()
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/auth/verificar-email?token={token}"
    enviado = enviar_email_verificacao(destino=usuario.email, nome=usuario.nome, link=link)
    if not enviado and settings.ENVIRONMENT == "development":
        return {
            "message": "SMTP não configurado. Em desenvolvimento, use o link no log da API.",
            "dev_link": link,
        }
    return {"message": "Enviamos um novo link de confirmação para o seu e-mail."}


@router.post("/vincular-google", response_model=UsuarioResponse)
async def vincular_google(
    body: VincularGoogleRequest,
    response: Response,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Vincula Google à conta com senha (perfil)."""
    if not oauth_google_enabled():
        raise HTTPException(status_code=503, detail="Login com Google não está configurado.")
    try:
        claims = verify_google_id_token(body.id_token)
    except OAuthTokenInvalid as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    email_claim = str(claims.get("email", "")).strip().lower()
    if email_claim and email_claim != (usuario.email or "").strip().lower():
        raise HTTPException(status_code=400, detail="O Google deve usar o mesmo email da conta.")

    sub = str(claims.get("sub", "")).strip()
    nome = _nome_from_oauth_claims(claims, usuario.email or "")
    u = vincular_google_a_conta_email(
        db,
        usuario,
        provider_id=sub,
        senha_atual=body.senha_atual,
        nome=nome,
    )
    access_token = _issue_token(u)
    set_auth_cookie(response, access_token)
    return UsuarioResponse.model_validate(u)


@router.get("/me", response_model=UsuarioResponse)
async def usuario_me(
    response: Response,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Dados do utilizador: nova leitura na tabela `usuarios` (evita cache de sessão)."""
    u = db.get(Usuario, usuario.id)
    if not u:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return UsuarioResponse.model_validate(u)


@router.patch("/me", response_model=UsuarioResponse)
async def atualizar_perfil(
    body: AtualizarPerfilRequest,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Atualiza nome, email (login) e/ou senha. Email ou senha exigem a senha atual correta."""

    new_email = str(body.email).strip().lower()
    atual_email = (usuario.email or "").strip().lower()
    email_mudou = new_email != atual_email

    if email_mudou:
        existente = (
            db.query(Usuario)
            .filter(func.lower(Usuario.email) == new_email, Usuario.id != usuario.id)
            .first()
        )
        if existente:
            raise HTTPException(status_code=400, detail="Este email já está cadastrado.")

    if email_mudou and not usuario.senha_hash and not body.nova_senha:
        raise HTTPException(
            status_code=400,
            detail="Defina uma senha em «Nova senha» antes de alterar o email de login.",
        )

    if (email_mudou or body.nova_senha) and usuario.senha_hash:
        if not body.senha_atual or not verify_password(body.senha_atual, usuario.senha_hash):
            raise HTTPException(
                status_code=400,
                detail="Senha atual incorreta ou em falta. Informe-a para alterar o email ou a senha.",
            )

    usuario.nome = body.nome.strip()
    if email_mudou:
        usuario.email = new_email

    if body.nova_senha:
        usuario.senha_hash = hash_password(body.nova_senha)
        usuario.token_version = int(usuario.token_version or 0) + 1

    if (
        body.aceita_comunicacao_email is not None
        or body.aceita_comunicacao_whatsapp is not None
        or body.telefone is not None
    ):
        aceita_email = (
            body.aceita_comunicacao_email
            if body.aceita_comunicacao_email is not None
            else bool(usuario.aceita_comunicacao_email)
        )
        aceita_whatsapp = (
            body.aceita_comunicacao_whatsapp
            if body.aceita_comunicacao_whatsapp is not None
            else bool(usuario.aceita_comunicacao_whatsapp)
        )
        tel = usuario.telefone
        if body.telefone is not None:
            tel = _normalizar_telefone_usuario(body.telefone)
        _aplicar_preferencias_comunicacao(
            usuario,
            aceita_email=aceita_email,
            aceita_whatsapp=aceita_whatsapp,
            telefone=tel,
        )

    db.commit()
    db.refresh(usuario)

    if not settings.STRIPE_DISABLED and usuario.stripe_customer_id:
        try:
            stripe.Customer.modify(
                usuario.stripe_customer_id,
                name=usuario.nome,
                email=usuario.email,
            )
        except stripe.error.StripeError as e:
            logger.warning("Não foi possível sincronizar dados no Stripe Customer: %s", e)

    if not settings.STRIPE_DISABLED and usuario.stripe_account_id and email_mudou:
        try:
            stripe.Account.modify(usuario.stripe_account_id, email=usuario.email)
        except stripe.error.StripeError as e:
            logger.warning("Não foi possível sincronizar o email na conta Stripe Connect: %s", e)

    return UsuarioResponse.model_validate(usuario)


async def get_usuario_atual_opcional(
    request: Request,
    bearer: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
):
    """Igual a get_usuario_atual, mas devolve None se não houver token (para rotas públicas)."""
    token = _token_from_request(request, bearer)
    if not token:
        return None
    payload = decode_token_payload(token)
    if not payload:
        return None
    usuario_id = payload.get("sub")
    if not usuario_id:
        return None
    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.ativo:
        return None
    tv_token = int(payload.get("tv", 0) or 0)
    if tv_token != int(usuario.token_version or 0):
        return None
    return usuario
