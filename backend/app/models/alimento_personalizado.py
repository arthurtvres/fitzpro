from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class AlimentoPersonalizadoCriacao(SQLModel):
    """Alimento próprio do personal: marca, receita ou suplemento fora da TACO.

    Mesmos campos e a mesma regra de nulidade da TACO (`alimentos.py`): valor
    ausente é "não analisado" e nunca vira 0 na conta da refeição.
    """

    nome: str
    kcal: float | None = None
    proteina_g: float | None = None
    carboidrato_g: float | None = None
    gordura_g: float | None = None
    fibra_g: float | None = None


class AlimentoPersonalizado(AlimentoPersonalizadoCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Dono da biblioteca — nunca vem do corpo, mesmo padrão de `Usuario.personal_id`.
    personal_id: int = Field(foreign_key="usuario.id", index=True)

    # Nulo = ativo, mesmo padrão de `Treino.arquivado_em`/`Dieta.arquivado_em`.
    arquivado_em: datetime | None = None
    criado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
