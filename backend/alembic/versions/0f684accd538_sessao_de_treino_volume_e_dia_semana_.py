"""sessao de treino, volume e dia_semana canonico

Tres coisas de uma vez, porque as tres sao pre-requisito da Home de execucao:

1. `sessaotreino` — uma ida a academia, com inicio e fim. Destrava duracao e
   permite o mesmo treino duas vezes no mesmo dia.
2. Colunas de series/volume em `execucaoexercicio`, e a troca da chave natural
   de (aluno, prescricao, DIA) para (aluno, SESSAO, prescricao).
3. `treino.dia_semana` normalizado: o dado sujou com "terca" e "terça"
   convivendo, e quem comparava com `==` perdia metade dos treinos.

Tem migration de DADO (backfill de sessoes, de volume e de dia_semana), o que a
torna irreversivel na pratica: o downgrade recupera o schema, nao o conteudo.

Revision ID: 0f684accd538
Revises: a73159822f8b
Create Date: 2026-08-12 15:02:11.887233

"""
import json
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Os modelos usam tipos do SQLModel (AutoString); o autogenerate os referencia
# nas migrations, entao o import precisa existir aqui.
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '0f684accd538'
down_revision: Union[str, Sequence[str], None] = 'a73159822f8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Copia local do normalizador de `app/services/dias.py`. Duplicar e o correto:
# migration e um retrato congelado do passado, e o servico vai continuar
# mudando. Importar o app aqui faria esta revisao quebrar no dia em que aquele
# arquivo for renomeado.
DIAS = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")
APELIDOS = {"seg": "segunda", "ter": "terca", "qua": "quarta", "qui": "quinta",
            "sex": "sexta", "sab": "sabado", "dom": "domingo"}


def _sem_acento(texto: str) -> str:
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def _dia_canonico(valor: str | None) -> str | None:
    if not valor:
        return None
    texto = _sem_acento(str(valor)).strip().lower().replace("-feira", "").strip()
    return texto if texto in DIAS else APELIDOS.get(texto)


def _reps(texto: str | None) -> int | None:
    """Copia local do parser de `app/services/series.py`, pelo mesmo motivo."""
    if not texto:
        return None
    limpo = str(texto).strip().lower()
    if re.search(r"\d\s*(s|seg|segundos?|min|minutos?)\b", limpo):
        return None
    numeros = [int(n) for n in re.findall(r"\d+", limpo)]
    if not numeros:
        return None
    valor = min(numeros)
    return valor if 0 < valor <= 500 else None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "sessaotreino",
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("observacao", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        sa.Column("treino_id", sa.Integer(), nullable=True),
        sa.Column("treino_nome", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("iniciada_em", sa.DateTime(), nullable=False),
        sa.Column("finalizada_em", sa.DateTime(), nullable=True),
        sa.Column("duracao_segundos", sa.Integer(), nullable=True),
        sa.Column("implicita", sa.Boolean(), nullable=False),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["aluno_id"], ["usuario.id"], name="fk_sessaotreino_aluno_id"),
        sa.ForeignKeyConstraint(
            ["registrado_por_id"], ["usuario.id"], name="fk_sessaotreino_registrado_por_id"
        ),
        sa.ForeignKeyConstraint(["treino_id"], ["treino.id"], name="fk_sessaotreino_treino_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("sessaotreino", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_sessaotreino_aluno_id"), ["aluno_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_sessaotreino_treino_id"), ["treino_id"], unique=False)

    # A consulta da semana e do calendario: (aluno, intervalo de datas).
    op.create_index(
        "ix_sessaotreino_aluno_data", "sessaotreino", ["aluno_id", "data"], unique=False
    )

    with op.batch_alter_table("execucaoexercicio", schema=None) as batch_op:
        batch_op.add_column(sa.Column("sessao_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("series_realizadas", sa.Text(), nullable=True))
        # NOT NULL em tabela com linhas: sem server_default o ALTER falha.
        batch_op.add_column(
            sa.Column("series_feitas", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(sa.Column("repeticoes_totais", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("volume_kg", sa.Float(), nullable=True))
        batch_op.add_column(
            sa.Column("volume_estimado", sa.Boolean(), server_default="1", nullable=False)
        )
        batch_op.create_index(
            batch_op.f("ix_execucaoexercicio_sessao_id"), ["sessao_id"], unique=False
        )
        batch_op.create_foreign_key(
            "fk_execucaoexercicio_sessao_id", "sessaotreino", ["sessao_id"], ["id"]
        )

    _backfill_sessoes()
    _backfill_volume()
    _backfill_dia_semana()

    # A troca da chave natural fica DEPOIS do backfill: enquanto sessao_id for
    # nulo em todas as linhas, a unique nova nao teria efeito nenhum.
    with op.batch_alter_table("execucaoexercicio", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("uq_execucaoexercicio_prescricao_data"), type_="unique"
        )
        batch_op.create_unique_constraint(
            "uq_execucaoexercicio_sessao_prescricao",
            ["aluno_id", "sessao_id", "treino_exercicio_id"],
        )

    # O batch do SQLite recria a tabela por copia. Os indices declarados no
    # modelo voltam sozinhos, mas garantir explicitamente e barato — e este e o
    # indice da consulta mais quente do sistema, cuja perda seria silenciosa.
    _garantir_indice(
        "ix_execucaoexercicio_aluno_exercicio_data",
        "execucaoexercicio",
        ["aluno_id", "exercicio_id", "data"],
    )


def _garantir_indice(nome: str, tabela: str, colunas: list[str]) -> None:
    conexao = op.get_bind()
    existe = conexao.execute(
        sa.text("SELECT 1 FROM sqlite_master WHERE type='index' AND name=:n"), {"n": nome}
    ).scalar()
    if not existe:
        op.create_index(nome, tabela, colunas, unique=False)


def _backfill_sessoes() -> None:
    """
    Uma sessao retroativa por (aluno, treino, dia) que ja tenha execucao.

    `duracao_segundos` fica NULL de proposito: o intervalo entre o primeiro e o
    ultimo clique nao e a duracao do treino, e um numero errado envenena a media
    para sempre. Melhor "desconhecida".
    """
    conexao = op.get_bind()
    conexao.execute(
        sa.text(
            """
            INSERT INTO sessaotreino
                (aluno_id, treino_id, treino_nome, data, iniciada_em,
                 finalizada_em, duracao_segundos, implicita, registrado_por_id, observacao)
            SELECT e.aluno_id,
                   e.treino_id,
                   COALESCE((SELECT t.nome FROM treino t WHERE t.id = e.treino_id), 'Treino'),
                   e.data,
                   MIN(e.registrado_em),
                   MAX(e.registrado_em),
                   NULL,
                   1,
                   MIN(e.registrado_por_id),
                   NULL
              FROM execucaoexercicio e
             WHERE e.treino_id IS NOT NULL
             GROUP BY e.aluno_id, e.treino_id, e.data
            """
        )
    )
    # Execucoes ja desvinculadas (treino_id nulo) ficam sem sessao: historico sem
    # treino vivo nao tem a que sessao pertencer, e a unique tolera o nulo.
    conexao.execute(
        sa.text(
            """
            UPDATE execucaoexercicio
               SET sessao_id = (
                   SELECT s.id FROM sessaotreino s
                    WHERE s.aluno_id = execucaoexercicio.aluno_id
                      AND s.treino_id = execucaoexercicio.treino_id
                      AND s.data = execucaoexercicio.data
                   LIMIT 1)
             WHERE treino_id IS NOT NULL
            """
        )
    )


def _backfill_volume() -> None:
    """
    Volume estimado a partir do prescrito para o que ja estava registrado.

    A alternativa — deixar NULL — seria mais pura, mas a Home nova nasceria
    vazia por semanas. Tudo entra marcado como `volume_estimado = 1`, que e
    exatamente o que essas linhas sao.
    """
    conexao = op.get_bind()
    linhas = conexao.execute(
        sa.text(
            "SELECT id, series_prescritas, repeticoes_prescritas, carga_kg "
            "FROM execucaoexercicio"
        )
    ).fetchall()

    for id_, series, repeticoes, carga in linhas:
        reps = _reps(repeticoes)
        quantidade = max(1, min(series or 1, 20))
        detalhe = [{"reps": reps, "carga_kg": carga} for _ in range(quantidade)]
        volume = (
            round(quantidade * reps * carga, 2)
            if reps is not None and carga is not None
            else None
        )
        conexao.execute(
            sa.text(
                "UPDATE execucaoexercicio SET series_realizadas=:s, series_feitas=:n, "
                "repeticoes_totais=:r, volume_kg=:v, volume_estimado=1 WHERE id=:id"
            ),
            {
                "s": json.dumps(detalhe, ensure_ascii=False),
                "n": quantidade,
                "r": (quantidade * reps) if reps is not None else None,
                "v": volume,
                "id": id_,
            },
        )


def _backfill_dia_semana() -> None:
    """Normaliza o que ja estava gravado: 'terça' e 'Terça-feira' viram 'terca'."""
    conexao = op.get_bind()
    for (valor,) in conexao.execute(
        sa.text("SELECT DISTINCT dia_semana FROM treino")
    ).fetchall():
        canonico = _dia_canonico(valor)
        if canonico and canonico != valor:
            conexao.execute(
                sa.text("UPDATE treino SET dia_semana=:novo WHERE dia_semana=:antigo"),
                {"novo": canonico, "antigo": valor},
            )


def downgrade() -> None:
    """Schema volta; as sessoes e o volume registrado, nao."""
    with op.batch_alter_table("execucaoexercicio", schema=None) as batch_op:
        batch_op.drop_constraint("uq_execucaoexercicio_sessao_prescricao", type_="unique")
        batch_op.create_unique_constraint(
            "uq_execucaoexercicio_prescricao_data",
            ["aluno_id", "treino_exercicio_id", "data"],
        )
        batch_op.drop_constraint("fk_execucaoexercicio_sessao_id", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_execucaoexercicio_sessao_id"))
        batch_op.drop_column("volume_estimado")
        batch_op.drop_column("volume_kg")
        batch_op.drop_column("repeticoes_totais")
        batch_op.drop_column("series_feitas")
        batch_op.drop_column("series_realizadas")
        batch_op.drop_column("sessao_id")

    _garantir_indice(
        "ix_execucaoexercicio_aluno_exercicio_data",
        "execucaoexercicio",
        ["aluno_id", "exercicio_id", "data"],
    )

    op.drop_index("ix_sessaotreino_aluno_data", table_name="sessaotreino")
    with op.batch_alter_table("sessaotreino", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_sessaotreino_treino_id"))
        batch_op.drop_index(batch_op.f("ix_sessaotreino_aluno_id"))
    op.drop_table("sessaotreino")
