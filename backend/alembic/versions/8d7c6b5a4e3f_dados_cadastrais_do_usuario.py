"""dados cadastrais do usuario

Revision ID: 8d7c6b5a4e3f
Revises: 7c6e5f4d3a2b
Create Date: 2026-08-13 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8d7c6b5a4e3f"
down_revision: Union[str, None] = "7c6e5f4d3a2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("usuario", sa.Column("cpf", sa.String(), nullable=True))
    op.add_column("usuario", sa.Column("cep", sa.String(), nullable=True))
    op.add_column("usuario", sa.Column("logradouro", sa.String(), nullable=True))
    op.add_column("usuario", sa.Column("numero_endereco", sa.String(), nullable=True))
    op.add_column("usuario", sa.Column("complemento", sa.String(), nullable=True))
    op.add_column("usuario", sa.Column("bairro", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuario", "bairro")
    op.drop_column("usuario", "complemento")
    op.drop_column("usuario", "numero_endereco")
    op.drop_column("usuario", "logradouro")
    op.drop_column("usuario", "cep")
    op.drop_column("usuario", "cpf")
