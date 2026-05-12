from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Optional

class UsuarioCreate(BaseModel):
    email: EmailStr
    nome: str
    senha: str
    tipo: str

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

    model_config = ConfigDict(from_attributes=True)


class AtualizarPerfilRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    email: EmailStr
    senha_atual: Optional[str] = None
    nova_senha: Optional[str] = Field(default=None, min_length=6, max_length=128)

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
