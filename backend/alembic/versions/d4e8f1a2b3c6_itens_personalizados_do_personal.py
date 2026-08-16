"""itens personalizados do personal

Biblioteca própria de exercícios e alimentos, fora do free-exercise-db e da
TACO. As duas tabelas nascem vazias — nao ha migration de dado.

As FKs vao NOMEADAS: o autogenerate as escreve sem `name=`, e o SQLite nao tem
como remover uma constraint anonima num `batch_alter_table` futuro.

Revision ID: d4e8f1a2b3c6
Revises: 477fd8978d56
Create Date: 2026-08-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Os modelos usam tipos do SQLModel (AutoString); o autogenerate os referencia
# nas migrations, entao o import precisa existir aqui.
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'd4e8f1a2b3c6'
down_revision: Union[str, Sequence[str], None] = '477fd8978d56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "exerciciopersonalizado",
        sa.Column("nome", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("categoria", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("equipamento", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("nivel", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("musculos_primarios", sa.JSON(), nullable=True),
        sa.Column("instrucoes", sa.Text(), nullable=True),
        sa.Column("imagem_url", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("personal_id", sa.Integer(), nullable=False),
        sa.Column("arquivado_em", sa.DateTime(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["personal_id"], ["usuario.id"], name="fk_exerciciopersonalizado_personal_id"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("exerciciopersonalizado", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_exerciciopersonalizado_personal_id"),
            ["personal_id"],
            unique=False,
        )

    op.create_table(
        "alimentopersonalizado",
        sa.Column("nome", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("kcal", sa.Float(), nullable=True),
        sa.Column("proteina_g", sa.Float(), nullable=True),
        sa.Column("carboidrato_g", sa.Float(), nullable=True),
        sa.Column("gordura_g", sa.Float(), nullable=True),
        sa.Column("fibra_g", sa.Float(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("personal_id", sa.Integer(), nullable=False),
        sa.Column("arquivado_em", sa.DateTime(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["personal_id"], ["usuario.id"], name="fk_alimentopersonalizado_personal_id"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("alimentopersonalizado", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_alimentopersonalizado_personal_id"),
            ["personal_id"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("alimentopersonalizado", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_alimentopersonalizado_personal_id"))
    op.drop_table("alimentopersonalizado")

    with op.batch_alter_table("exerciciopersonalizado", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_exerciciopersonalizado_personal_id"))
    op.drop_table("exerciciopersonalizado")
