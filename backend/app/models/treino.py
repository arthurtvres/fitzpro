from sqlmodel import SQLModel, Field

class TreinoCriacao(SQLModel):
    nome: str
    dia_semana: str
    aluno_id: int
    # Com os exercícios estruturados, a descrição virou observação geral e deixou
    # de ser obrigatória. A coluna é NOT NULL no banco, mas "" satisfaz — por isso
    # o default é string vazia e não None.
    descricao: str = ""

class Treino(TreinoCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="usuario.id")
