"""altura na avaliacao

Revision ID: 7c6e5f4d3a2b
Revises: cfef22d95bfd
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c6e5f4d3a2b"
down_revision: Union[str, None] = "cfef22d95bfd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("avaliacao", sa.Column("altura_cm", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("avaliacao", "altura_cm")
