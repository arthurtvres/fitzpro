from datetime import datetime

from sqlmodel import SQLModel, Field

class DietaCriacao(SQLModel):
    nome: str
    descricao: str
    calorias: int
    aluno_id: int

class Dieta(DietaCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="usuario.id")

    # Data do arquivamento, e nao um booleano: "quando" e informacao gratuita
    # aqui — a coluna precisa existir de qualquer jeito — e responde sozinha a
    # pergunta que aparece depois ("desde quando esse plano saiu do ar?").
    # Nulo = ativo. Fora das classes de entrada: quem arquiva e uma rota
    # propria, nao o corpo de um PUT de edicao.
    arquivado_em: datetime | None = None
