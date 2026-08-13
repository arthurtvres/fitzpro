from datetime import date, datetime, timezone

from sqlalchemy import Index
from sqlmodel import Field, SQLModel

class SessaoTreinoCriacao(SQLModel):
    """O que o cliente manda ao iniciar uma sessão. Quase nada."""

    data: date = Field(default_factory=date.today)
    observacao: str | None = None

class SessaoTreino(SessaoTreinoCriacao, table=True):
    """
    Uma ida à academia: um treino, num dia, com hora de início e fim.

    Existe porque duração passou a ser requisito. Quando decidi **não** criar
    esta tabela, a condição que registrei foi exatamente esta — "se um dia
    aparecer duração, PSE ou 'como você se sentiu', a tabela nasce então". Ela
    nasceu, e de quebra resolve a limitação de o mesmo treino só poder ser feito
    uma vez por dia.
    """

    # Declarado aqui, e nao so criado na migration: indice que o modelo nao
    # conhece o autogenerate le como sobra e escreve um drop na revisao
    # seguinte — foi o que aconteceu, em silencio, na primeira vez.
    __table_args__ = (Index("ix_sessaotreino_aluno_data", "aluno_id", "data"),)

    id: int | None = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="usuario.id", index=True)

    # Anulável, com o nome copiado ao lado: apagar o treino apaga o plano, nunca
    # o passado. "Último treino: Costas + Bíceps" tem que sobreviver.
    treino_id: int | None = Field(default=None, foreign_key="treino.id", index=True)
    treino_nome: str = ""

    # `data` é coluna própria, e não derivada de `iniciada_em`: toda agregação do
    # sistema é por dia e entra em índice, e derivar de um datetime UTC faria
    # quem treina às 22h cair no dia seguinte.
    iniciada_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finalizada_em: datetime | None = None

    # Denormalizada, e não `finalizada_em - iniciada_em`: são coisas diferentes.
    # Sessão abandonada, retroativa da migration ou longa demais fecha com None —
    # "duração desconhecida" — em vez de envenenar a média com número inventado.
    duracao_segundos: int | None = None

    # Distingue "apertou Iniciar treino" de "só foi marcando os exercícios".
    # Sem isso a média de duração misturaria duas populações diferentes.
    implicita: bool = Field(default=True)

    registrado_por_id: int = Field(foreign_key="usuario.id")
