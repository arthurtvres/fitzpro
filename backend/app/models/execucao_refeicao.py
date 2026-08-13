from datetime import date, datetime, timezone

from sqlalchemy import Index
from sqlmodel import Field, SQLModel, UniqueConstraint

class ExecucaoRefeicaoCriacao(SQLModel):
    """O que o aluno relata ao concluir uma refeição."""

    data: date = Field(default_factory=date.today)
    observacao: str | None = None

class ExecucaoRefeicao(ExecucaoRefeicaoCriacao, table=True):
    """
    Uma refeição dada como feita, num dia.

    **O snapshot aqui não é luxo, é o que torna o número um fato.** Diferente do
    exercício, que aponta para um catálogo estático e sempre resolvível, a
    refeição é identificada por um id gerado no navegador (`ref-<ts>-<rand>`)
    guardado dentro de uma coluna de texto que `PUT /dietas/{id}` sobrescreve
    inteira. Sem a cópia, "você consumiu 1.480 kcal na terça" viraria zero assim
    que o personal editasse o plano.

    Consequência aceita: o numerador (kcal consumidas) é sempre verdadeiro, mas
    o denominador de um dia antigo — quantas refeições o plano tinha naquele dia
    — não é recuperável. Por isso o percentual só é oferecido para o plano
    vigente; histórico antigo mostra números absolutos, sem inventar denominador.
    """

    __table_args__ = (
        UniqueConstraint(
            "aluno_id",
            "dieta_id",
            "refeicao_id",
            "data",
            name="uq_execucaorefeicao_refeicao_data",
        ),
        Index("ix_execucaorefeicao_aluno_data", "aluno_id", "data"),
    )

    id: int | None = Field(default=None, primary_key=True)

    aluno_id: int = Field(foreign_key="usuario.id", index=True)
    dieta_id: int | None = Field(default=None, foreign_key="dieta.id", index=True)

    # O id de dentro do JSON do plano alimentar. Vem da URL e é conferido contra
    # o plano vigente antes de gravar.
    refeicao_id: str = Field(index=True)

    # Cópia do que a refeição era no momento em que foi marcada.
    refeicao_nome: str = ""
    refeicao_horario: str = ""
    calorias: int = 0
    proteinas_g: float | None = None
    carboidratos_g: float | None = None
    gorduras_g: float | None = None

    registrado_por_id: int = Field(foreign_key="usuario.id")
    registrado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
