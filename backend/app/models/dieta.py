from sqlmodel import SQLModel, Field

class DietaCriacao(SQLModel):
    nome: str
    descricao: str
    calorias: int
    aluno_id: int

class Dieta(DietaCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="usuario.id")
