from datetime import date, datetime, timezone

from sqlalchemy import Column, Index, Text
from sqlmodel import Field, SQLModel, UniqueConstraint

class SerieRealizada(SQLModel):
    """Uma série de fato executada. Só isto vem do cliente por série."""

    reps: int | None = None
    carga_kg: float | None = None

class ExecucaoExercicioCriacao(SQLModel):
    """
    Os campos simples do que o aluno relata — e a base da tabela.

    Repare no que **não** está aqui: `aluno_id`, os campos de prescrição e o
    `exercicio_id`. Se viessem no corpo, o aluno registraria execução em nome de
    outro, ou declararia qual era o alvo que ele mesmo bateu.
    """

    data: date = Field(default_factory=date.today)
    carga_kg: float | None = None
    observacao: str | None = None

class ExecucaoExercicioEntrada(ExecucaoExercicioCriacao):
    """
    O corpo que as rotas aceitam.

    Separado da base da tabela porque `series` é uma lista, e SQLModel não tem
    coluna para isso — no banco ela vira o JSON `series_realizadas`. Os dois
    campos são opcionais de propósito: marcar continua sendo um toque só. Sem
    `series`, o servidor preenche a partir da prescrição e marca o volume como
    estimado; sem `sessao_id`, ele resolve ou cria a sessão do dia.
    """

    # Id de escopo, como `item_id` — validado contra o treino, com 404. Não é
    # campo de autoria, então pode vir do corpo sem abrir nada.
    sessao_id: int | None = None
    series: list[SerieRealizada] | None = None

class ExecucaoExercicio(ExecucaoExercicioCriacao, table=True):
    """
    Um exercício dado como feito, num dia.

    O registro é fato imutável do passado; a prescrição é intenção mutável do
    presente. Por isso esta linha faz as duas coisas: **aponta** para a
    prescrição (para agrupar o progresso do dia) e **copia** dela (para o
    histórico sobreviver quando o personal reorganizar o treino).
    """

    # A chave natural é (prescrição, SESSÃO), não mais (prescrição, dia): com
    # sessões, o mesmo treino pode ser feito duas vezes no mesmo dia, e cada uma
    # é um fato próprio. A idempotência do PUT sobrevive porque o servidor nunca
    # escreve com `sessao_id` nulo — `services/sessao.resolver` resolve ou cria
    # a sessão antes. No SQLite linhas com nulo não colidem, o que é o desejado
    # para as execuções antigas, cuja sessão não existe.
    __table_args__ = (
        UniqueConstraint(
            "aluno_id",
            "sessao_id",
            "treino_exercicio_id",
            name="uq_execucaoexercicio_sessao_prescricao",
        ),
        # Declarado aqui, e não só na migration: é a consulta mais quente do
        # sistema (o "última vez: 77,5 kg" de cada linha do treino), e um índice
        # que existe só no banco some no primeiro `--autogenerate`, que o
        # interpreta como sobra e escreve um drop.
        Index("ix_execucaoexercicio_aluno_exercicio_data", "aluno_id", "exercicio_id", "data"),
    )

    id: int | None = Field(default=None, primary_key=True)

    # Dono do fato. Sai de treino.aluno_id, nunca do corpo.
    aluno_id: int = Field(foreign_key="usuario.id", index=True)
    sessao_id: int | None = Field(default=None, foreign_key="sessaotreino.id", index=True)

    # Ponteiros — servem ao "hoje". Anuláveis de propósito: apagar a prescrição
    # apaga o plano, nunca o passado (ver services/progressao.desvincular).
    treino_id: int | None = Field(default=None, foreign_key="treino.id", index=True)
    treino_exercicio_id: int | None = Field(
        default=None, foreign_key="treinoexercicio.id", index=True
    )

    # Cópia — serve ao "sempre". `exercicio_id` é o id do catálogo, e é ele que
    # responde "quanto levantei de agachamento da última vez" mesmo depois de a
    # prescrição ter sido removida e recriada com outro id.
    exercicio_id: str = Field(index=True)

    # O alvo vigente no dia. Sem este retrato, "bateu o alvo" mudaria de
    # resposta retroativamente a cada edição da carga pelo personal — e o aviso
    # "pronto para subir" acenderia por causa de uma edição, não de um esforço.
    series_prescritas: int = 3
    repeticoes_prescritas: str = "10"
    carga_prescrita_kg: float | None = None

    # ---------- o que foi feito ----------
    # As séries em JSON servem ao detalhe ("10 · 9 · 8"); `volume_kg` é
    # denormalizado porque a pergunta cara é "volume da semana", e somar JSON
    # exigiria `json.loads` linha a linha. Existe **um único ponto de escrita**
    # destes campos — `services/series.consolidar` — que é o que mantém os dois
    # em acordo.
    series_realizadas: str | None = Field(default=None, sa_column=Column(Text))
    series_feitas: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    repeticoes_totais: int | None = None
    volume_kg: float | None = None

    # True quando as séries vieram do preenchimento automático. Viaja em toda
    # resposta: um número estimado exibido como exato é pior que nenhum número.
    volume_estimado: bool = Field(
        default=True, sa_column_kwargs={"server_default": "1"}
    )

    # Quem apertou o botão: o próprio aluno, ou o personal ao lado dele.
    registrado_por_id: int = Field(foreign_key="usuario.id")
    registrado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
