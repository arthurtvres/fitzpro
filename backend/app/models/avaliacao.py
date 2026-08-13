from datetime import date

from pydantic import field_validator
from sqlalchemy import Column, Text
from sqlmodel import SQLModel, Field

# As fotos vao para a coluna como JSON de data URLs. O front reduz cada uma a
# 1024px (~150 KB), entao 12 MB e folga larga para um conjunto de fotos — o
# limite existe para impedir que alguem despeje centenas de MB numa linha, nao
# para apertar o uso legitimo. Generoso de proposito: avaliacoes salvas antes
# da reducao guardam o original de camera e precisam continuar editaveis.
TAMANHO_MAXIMO_FOTOS = 12_000_000

class AvaliacaoCriacao(SQLModel):
    """Uma medição do aluno numa data. O histórico é a série dessas medições."""

    data: date = Field(default_factory=date.today)
    peso_kg: float | None = None
    altura_cm: float | None = None
    percentual_gordura: float | None = None
    massa_muscular_kg: float | None = None
    cintura_cm: float | None = None
    quadril_cm: float | None = None
    braco_cm: float | None = None
    coxa_cm: float | None = None
    torax_cm: float | None = None
    observacao: str | None = None
    fotos: str | None = Field(default=None, sa_column=Column(Text))

    @field_validator("fotos")
    @classmethod
    def validar_fotos(cls, valor: str | None) -> str | None:
        if valor and len(valor) > TAMANHO_MAXIMO_FOTOS:
            raise ValueError("As fotos somam mais do que o limite. Envie menos fotos.")
        return valor

class Avaliacao(AvaliacaoCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Vem da URL, não do corpo.
    aluno_id: int = Field(foreign_key="usuario.id", index=True)

def imc(peso_kg: float | None, altura_cm: float | None) -> float | None:
    """IMC é derivado do peso e da altura medidos na avaliação."""
    if not peso_kg or not altura_cm:
        return None
    altura_m = altura_cm / 100
    return round(peso_kg / (altura_m**2), 1)
