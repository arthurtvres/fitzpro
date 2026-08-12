"""Ambiente do Alembic.

A URL do banco vem de `app.core.config`, nao do alembic.ini: o caminho e
derivado da localizacao do codigo, entao migration e servidor apontam sempre
para o mesmo arquivo, rodando de onde rodarem.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

from app.core.config import URL_BANCO

# Importar os modelos registra as tabelas no metadata; sem isto o autogenerate
# acha que o banco inteiro sobra e escreve um drop_table para cada uma.
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", URL_BANCO)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=URL_BANCO,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    conexao_configurada = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with conexao_configurada.connect() as conexao:
        context.configure(
            connection=conexao,
            target_metadata=target_metadata,
            # SQLite nao tem ALTER TABLE de verdade: o batch mode recria a
            # tabela e copia os dados. Sem isto, adicionar FK falha.
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
