from pydantic import field_validator
from sqlmodel import SQLModel, Field

from app.services.dias import normalizar as normalizar_dia

class TreinoCriacao(SQLModel):
    nome: str
    dia_semana: str
    aluno_id: int
    # Com os exercícios estruturados, a descrição virou observação geral e deixou
    # de ser obrigatória. A coluna é NOT NULL no banco, mas "" satisfaz — por isso
    # o default é string vazia e não None.
    descricao: str = ""

    @field_validator("dia_semana")
    @classmethod
    def validar_dia(cls, valor: str) -> str:
        """
        Grava sempre a forma canônica, sem acento.

        O campo era string livre e o dado sujou: "terça" e "terca" conviviam, e
        quem comparava com `==` perdia metade dos treinos. Normalizar aqui é o
        que garante que existe uma única grafia no banco daqui para frente —
        quem exibe usa `dias.ROTULOS`.
        """
        dia = normalizar_dia(valor)
        if not dia:
            raise ValueError(
                "Dia da semana inválido. Use segunda, terça, quarta, quinta, "
                "sexta, sábado ou domingo."
            )
        return dia

class Treino(TreinoCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="usuario.id")
