"""execucao de exercicio e de refeicao

Registro do que o aluno de fato fez: exercicios concluidos e refeicoes
consumidas. As duas tabelas nascem vazias — nao ha migration de dado.

As FKs vao NOMEADAS: o autogenerate as escreve sem `name=`, e o SQLite nao tem
como remover uma constraint anonima num `batch_alter_table` futuro.

Revision ID: a73159822f8b
Revises: 138206c4723c
Create Date: 2026-08-12 13:23:23.551460

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Os modelos usam tipos do SQLModel (AutoString); o autogenerate os referencia
# nas migrations, entao o import precisa existir aqui.
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'a73159822f8b'
down_revision: Union[str, Sequence[str], None] = '138206c4723c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "execucaoexercicio",
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("carga_kg", sa.Float(), nullable=True),
        sa.Column("observacao", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        # Anulaveis: apagar a prescricao desvincula o registro, nao o apaga.
        sa.Column("treino_id", sa.Integer(), nullable=True),
        sa.Column("treino_exercicio_id", sa.Integer(), nullable=True),
        # Copia do alvo vigente no dia da execucao.
        sa.Column("exercicio_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("series_prescritas", sa.Integer(), nullable=False),
        sa.Column(
            "repeticoes_prescritas", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("carga_prescrita_kg", sa.Float(), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column("registrado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["aluno_id"], ["usuario.id"], name="fk_execucaoexercicio_aluno_id"
        ),
        sa.ForeignKeyConstraint(
            ["registrado_por_id"],
            ["usuario.id"],
            name="fk_execucaoexercicio_registrado_por_id",
        ),
        sa.ForeignKeyConstraint(
            ["treino_exercicio_id"],
            ["treinoexercicio.id"],
            name="fk_execucaoexercicio_treino_exercicio_id",
        ),
        sa.ForeignKeyConstraint(
            ["treino_id"], ["treino.id"], name="fk_execucaoexercicio_treino_id"
        ),
        sa.PrimaryKeyConstraint("id"),
        # Chave natural: marcar duas vezes atualiza, nao duplica.
        sa.UniqueConstraint(
            "aluno_id",
            "treino_exercicio_id",
            "data",
            name="uq_execucaoexercicio_prescricao_data",
        ),
    )
    with op.batch_alter_table("execucaoexercicio", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_execucaoexercicio_aluno_id"), ["aluno_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_execucaoexercicio_exercicio_id"),
            ["exercicio_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_execucaoexercicio_treino_exercicio_id"),
            ["treino_exercicio_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_execucaoexercicio_treino_id"), ["treino_id"], unique=False
        )

    # Fora do autogenerate: e a consulta mais quente do sistema — o
    # "ultima vez: 77,5 kg" de cada linha do treino busca por
    # (aluno, exercicio) ordenando por data.
    op.create_index(
        "ix_execucaoexercicio_aluno_exercicio_data",
        "execucaoexercicio",
        ["aluno_id", "exercicio_id", "data"],
        unique=False,
    )

    op.create_table(
        "execucaorefeicao",
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("observacao", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        sa.Column("dieta_id", sa.Integer(), nullable=True),
        sa.Column("refeicao_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        # Snapshot: o plano alimentar vive num JSON que o PUT sobrescreve
        # inteiro, entao o que foi consumido precisa ser copiado, nao consultado.
        sa.Column("refeicao_nome", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "refeicao_horario", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("calorias", sa.Integer(), nullable=False),
        sa.Column("proteinas_g", sa.Float(), nullable=True),
        sa.Column("carboidratos_g", sa.Float(), nullable=True),
        sa.Column("gorduras_g", sa.Float(), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column("registrado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["aluno_id"], ["usuario.id"], name="fk_execucaorefeicao_aluno_id"
        ),
        sa.ForeignKeyConstraint(
            ["dieta_id"], ["dieta.id"], name="fk_execucaorefeicao_dieta_id"
        ),
        sa.ForeignKeyConstraint(
            ["registrado_por_id"],
            ["usuario.id"],
            name="fk_execucaorefeicao_registrado_por_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "aluno_id",
            "dieta_id",
            "refeicao_id",
            "data",
            name="uq_execucaorefeicao_refeicao_data",
        ),
    )
    with op.batch_alter_table("execucaorefeicao", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_execucaorefeicao_aluno_id"), ["aluno_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_execucaorefeicao_dieta_id"), ["dieta_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_execucaorefeicao_refeicao_id"), ["refeicao_id"], unique=False
        )

    op.create_index(
        "ix_execucaorefeicao_aluno_data",
        "execucaorefeicao",
        ["aluno_id", "data"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_execucaorefeicao_aluno_data", table_name="execucaorefeicao")
    with op.batch_alter_table("execucaorefeicao", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_execucaorefeicao_refeicao_id"))
        batch_op.drop_index(batch_op.f("ix_execucaorefeicao_dieta_id"))
        batch_op.drop_index(batch_op.f("ix_execucaorefeicao_aluno_id"))
    op.drop_table("execucaorefeicao")

    op.drop_index(
        "ix_execucaoexercicio_aluno_exercicio_data", table_name="execucaoexercicio"
    )
    with op.batch_alter_table("execucaoexercicio", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_execucaoexercicio_treino_id"))
        batch_op.drop_index(batch_op.f("ix_execucaoexercicio_treino_exercicio_id"))
        batch_op.drop_index(batch_op.f("ix_execucaoexercicio_exercicio_id"))
        batch_op.drop_index(batch_op.f("ix_execucaoexercicio_aluno_id"))
    op.drop_table("execucaoexercicio")
