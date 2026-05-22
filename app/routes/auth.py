import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import stripe

from app.models import Usuario, get_db
from app.schemas.usuario import (
    AtualizarPerfilRequest,
    OAuthLoginRequest,
    UsuarioCreate,
    UsuarioLogin,
    UsuarioResponse,
    Token,
)
from app.deps.rate_limit import rate_limit_login, rate_limit_oauth, rate_limit_register
from app.services.oauth_verify import (
    OAuthTokenInvalid,
    oauth_apple_enabled,
    oauth_google_enabled,
    verify_apple_id_token,
    verify_google_id_token,
)
from app.services.oauth_usuario import obter_ou_criar_usuario_oauth
from app.services.auth import create_access_token, decode_token, hash_password, verify_password
from app.utils.public_errors import STRIPE_CLIENTE
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
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
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_register),
):
    """Registra novo usuário"""

    logger.info(f"Registrando usuário: {usuario_data.email}")

    email = str(usuario_data.email).strip().lower()

    # Verifica se email já existe
    usuario_existente = db.query(Usuario).filter(
        func.lower(Usuario.email) == email
    ).first()

    if usuario_existente:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    stripe_customer_id: str | None = None
    stripe_account_id: str | None = None

    if not settings.STRIPE_DISABLED:
        try:
            customer = stripe.Customer.create(
                email=usuario_data.email,
                name=usuario_data.nome,
            )
            stripe_customer_id = customer.id
            logger.info("Cliente Stripe criado: %s", stripe_customer_id)

            if usuario_data.tipo == "organizador":
                if settings.STRIPE_SKIP_CONNECT_ON_REGISTER:
                    logger.info(
                        "STRIPE_SKIP_CONNECT_ON_REGISTER: organizador %s cadastrado sem Account.create",
                        usuario_data.email,
                    )
                    stripe_account_id = None
                else:
                    try:
                        account = stripe.Account.create(
                            type="express",
                            country="BR",
                            email=usuario_data.email,
                        )
                        stripe_account_id = account.id
                        logger.info("Conta conectada Stripe criada: %s", stripe_account_id)
                    except stripe.error.StripeError as conn_err:
                        if _stripe_connect_platform_terms_missing(conn_err):
                            logger.warning(
                                "Conta Connect não criada no cadastro (termos Connect no Stripe pendentes ou erro equivalente). "
                                "Organizador %s segue sem stripe_account_id. Stripe: %s",
                                usuario_data.email,
                                conn_err,
                            )
                            stripe_account_id = None
                        else:
                            logger.error(
                                "Erro Stripe ao criar conta Connect (texto completo para diagnóstico): %s",
                                _stripe_error_all_text(conn_err),
                            )
                            logger.exception("Erro Stripe ao criar conta Connect")
                            raise HTTPException(status_code=400, detail=STRIPE_CLIENTE) from conn_err
        except stripe.error.StripeError as e:
            logger.exception("Erro Stripe no registo: %s", e)
            raise HTTPException(status_code=400, detail=STRIPE_CLIENTE) from e
    else:
        logger.warning(
            "STRIPE_DISABLED: registro de %s (%s) sem Customer/Connect Stripe",
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
        stripe_customer_id=stripe_customer_id,
        stripe_account_id=stripe_account_id,
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

    access_token = create_access_token(
        data={"sub": novo_usuario.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": UsuarioResponse.model_validate(novo_usuario),
    }

@router.post("/login", response_model=Token)
async def login(
    credenciais: UsuarioLogin,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_login),
):
    """Login de usuário"""

    email = str(credenciais.email).strip().lower()
    logger.info("Tentativa de login: %s", email)

    usuario = db.query(Usuario).filter(
        func.lower(Usuario.email) == email
    ).first()

    if not usuario:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not usuario.senha_hash:
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

    access_token = create_access_token(
        data={"sub": usuario.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": UsuarioResponse.model_validate(usuario)
    }


def _token_response(usuario: Usuario) -> dict:
    access_token = create_access_token(
        data={"sub": usuario.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": UsuarioResponse.model_validate(usuario),
    }


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
    return _token_response(usuario)


@router.post("/apple", response_model=Token)
async def login_apple(
    body: OAuthLoginRequest,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_oauth),
):
    if not oauth_apple_enabled():
        raise HTTPException(status_code=503, detail="Login com Apple não está configurado.")
    try:
        claims = verify_apple_id_token(body.id_token)
    except OAuthTokenInvalid as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    sub = str(claims.get("sub", "")).strip()
    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Apple não enviou email. Remova o app da lista em Ajustes → Apple ID → Senha e Segurança → Apps e tente de novo.",
        )
    nome = _nome_from_oauth_claims(claims, email)
    tel = _normalizar_telefone_usuario(body.telefone) if body.telefone else None

    usuario = obter_ou_criar_usuario_oauth(
        db,
        provider="apple",
        provider_id=sub,
        email=email,
        nome=nome,
        tipo=body.tipo,
        aceita_comunicacao_email=body.aceita_comunicacao_email,
        aceita_comunicacao_whatsapp=body.aceita_comunicacao_whatsapp,
        telefone=tel,
    )
    return _token_response(usuario)


async def get_usuario_atual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Obtém usuário autenticado"""
    usuario_id = decode_token(token)
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Conta desativada")

    return usuario


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
            detail="Conta social: defina uma senha em «Nova senha» antes de alterar o email, ou continue usando Google/Apple.",
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
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
):
    """Igual a get_usuario_atual, mas devolve None se não houver token (para rotas públicas)."""
    if not token:
        return None
    usuario_id = decode_token(token)
    if not usuario_id:
        return None
    return db.get(Usuario, usuario_id)
