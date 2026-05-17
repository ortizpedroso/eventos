from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Optional

class UsuarioCreate(BaseModel):
    email: EmailStr
    nome: str
    senha: str = Field(min_length=8, max_length=128)
    tipo: str
    aceita_comunicacao_email: bool = False
    aceita_comunicacao_whatsapp: bool = False
    telefone: str | None = Field(default=None, max_length=20)

    @field_validator("tipo", mode="before")
    @classmethod
    def normalizar_tipo(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError('tipo deve ser "cliente" ou "organizador"')
        s = v.strip().lower()
        if s in ("cliente", "organizador"):
            return s
        raise ValueError('tipo deve ser "cliente" ou "organizador"')

class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str

class UsuarioResponse(BaseModel):
    id: str
    email: str
    nome: str
    tipo: str
    data_criacao: datetime
    aceita_comunicacao_email: bool = False
    aceita_comunicacao_whatsapp: bool = False
    telefone: str | None = None
    comunicacao_consentimento_em: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AtualizarPerfilRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    email: EmailStr
    senha_atual: Optional[str] = None
    nova_senha: Optional[str] = Field(default=None, min_length=8, max_length=128)
    aceita_comunicacao_email: Optional[bool] = None
    aceita_comunicacao_whatsapp: Optional[bool] = None
    telefone: Optional[str] = Field(default=None, max_length=20)

    @field_validator("nova_senha", "senha_atual", mode="before")
    @classmethod
    def opcionais_texto(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if not isinstance(v, str):
            return None
        s = v.strip()
        return s if s else None

class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioResponse
