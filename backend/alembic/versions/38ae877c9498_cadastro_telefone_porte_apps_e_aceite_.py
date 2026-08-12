"""cadastro: telefone, porte, apps e aceite de termos

Revision ID: 38ae877c9498
Revises: c9320d108c2f
Create Date: 2026-08-11 23:58:26.875865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Os modelos usam tipos do SQLModel (AutoString); o autogenerate os referencia
# nas migrations, entao o import precisa existir aqui.
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '38ae877c9498'
down_revision: Union[str, Sequence[str], None] = 'c9320d108c2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("usuario", schema=None) as batch_op:
        # Nulas nas contas que ja existiam: ninguem respondeu essas perguntas.
        batch_op.add_column(
            sa.Column("telefone", sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "quantidade_alunos",
                sa.Enum(
                    "SEM_ALUNOS",
                    "ATE_5",
                    "DE_6_A_15",
                    "DE_16_A_30",
                    "DE_31_A_50",
                    "MAIS_DE_50",
                    name="faixadealunos",
                ),
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("apps_atuais", sa.Text(), nullable=True))
        # NOT NULL numa tabela que ja tem linhas exige default no servidor:
        # sem ele as linhas existentes ficariam NULL e o ALTER falharia.
        # False e a resposta honesta — essas contas nasceram antes dos termos
        # existirem, entao ninguem os aceitou.
        batch_op.add_column(
            sa.Column(
                "aceitou_termos",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch_op.add_column(sa.Column("termos_aceitos_em", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("usuario", schema=None) as batch_op:
        batch_op.drop_column("termos_aceitos_em")
        batch_op.drop_column("aceitou_termos")
        batch_op.drop_column("apps_atuais")
        batch_op.drop_column("quantidade_alunos")
        batch_op.drop_column("telefone")
