from sqlmodel import SQLModel, Field

class TreinoExercicioCriacao(SQLModel):
    """Prescrição de um exercício do catálogo dentro de um treino."""

    exercicio_id: str  # id do catálogo, ex. "Barbell_Squat"
    series: int = 3
    repeticoes: str = "10"  # texto de propósito: aceita "8-12", "até a falha"
    carga_kg: float | None = None
    descanso_segundos: int | None = None
    observacao: str | None = None

class TreinoExercicio(TreinoExercicioCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Ficam fora de TreinoExercicioCriacao: o treino vem da URL e a ordem é
    # controlada pelo servidor (ao adicionar e ao reordenar).
    treino_id: int = Field(foreign_key="treino.id", index=True)
    ordem: int = 0
