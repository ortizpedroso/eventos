from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CupomWrite(BaseModel):
    codigo: str = Field(min_length=3, max_length=40)
    tipo: str = Field(pattern="^(percentual|fixo)$")
    valor: float = Field(gt=0)
    max_usos: int | None = Field(default=None, ge=1)
    ativo: bool = True
    valido_ate: datetime | None = None

    @field_validator("codigo", mode="before")
    @classmethod
    def _codigo_upper(cls, v: object) -> str:
        return str(v).strip().upper()

    @model_validator(mode="after")
    def _valor_por_tipo(self):
        if self.tipo == "percentual" and self.valor > 1:
            raise ValueError("percentual deve ser entre 0 e 1 (ex.: 0.1 = 10%)")
        if self.tipo == "fixo" and self.valor > 50_000:
            raise ValueError("desconto fixo muito alto")
        return self


class CupomResponse(BaseModel):
    id: str
    codigo: str
    tipo: str
    valor: float
    max_usos: int | None
    usos: int
    ativo: bool
    valido_ate: datetime | None

    model_config = ConfigDict(from_attributes=True)
