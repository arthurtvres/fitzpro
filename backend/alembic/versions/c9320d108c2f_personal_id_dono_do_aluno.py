"""personal_id: dono do aluno

Introduz o tenant. Ate aqui qualquer PERSONAL enxergava os alunos de todos os
outros; a partir daqui cada aluno tem dono.

Revision ID: c9320d108c2f
Revises: 90d28405102b
Create Date: 2026-08-11 23:39:42.195806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Os modelos usam tipos do SQLModel (AutoString); o autogenerate os referencia
# nas migrations, entao o import precisa existir aqui.
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'c9320d108c2f'
down_revision: Union[str, Sequence[str], None] = '90d28405102b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# A FK precisa de nome explicito: sem ele o SQLite nao tem como remove-la no
# downgrade, e o batch_alter_table falha na hora de recriar a tabela.
NOME_FK = "fk_usuario_personal_id"


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("usuario", schema=None) as batch_op:
        batch_op.add_column(sa.Column("personal_id", sa.Integer(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_usuario_personal_id"), ["personal_id"], unique=False
        )
        batch_op.create_foreign_key(NOME_FK, "usuario", ["personal_id"], ["id"])

    adotar_alunos_orfaos()


def adotar_alunos_orfaos() -> None:
    """
    Da dono aos alunos que ja existiam antes de existir a coluna.

    Sem este passo eles ficariam com personal_id nulo — nao pertenceriam a
    ninguem e sumiriam de todas as listagens, que a partir de agora filtram
    pelo dono. Como ate aqui o sistema era de fato de um personal so, o mais
    antigo (menor id) e o dono correto de todos eles.
    """
    conexao = op.get_bind()

    primeiro_personal = conexao.execute(
        sa.text("SELECT id FROM usuario WHERE papel = 'PERSONAL' ORDER BY id LIMIT 1")
    ).scalar()

    if primeiro_personal is None:
        return  # banco novo, sem nada para adotar

    conexao.execute(
        sa.text(
            "UPDATE usuario SET personal_id = :dono "
            "WHERE papel = 'ALUNO' AND personal_id IS NULL"
        ),
        {"dono": primeiro_personal},
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("usuario", schema=None) as batch_op:
        batch_op.drop_constraint(NOME_FK, type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_usuario_personal_id"))
        batch_op.drop_column("personal_id")
