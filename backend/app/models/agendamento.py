from datetime import date, time
from enum import Enum

from sqlmodel import Field, SQLModel


class TipoAgendamento(str, Enum):
    TREINO = "treino"
    AVALIACAO = "avaliacao"
    RETORNO = "retorno"


class AgendamentoCriacao(SQLModel):
    data: date
    horario: time
    tipo: TipoAgendamento
    aluno_id: int
    treino_id: int | None = None
    titulo: str = ""
    observacao: str = ""


class Agendamento(AgendamentoCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="usuario.id", index=True)
    treino_id: int | None = Field(default=None, foreign_key="treino.id")
