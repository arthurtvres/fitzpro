from alembic import command
from alembic.config import Config
from sqlmodel import Session, create_engine

from app.core.config import DIRETORIO_BACKEND, URL_BANCO

engine = create_engine(URL_BANCO, connect_args={"check_same_thread": False})

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    """
    Poe o banco na versao mais nova, rodando as migrations do Alembic.

    Antes daqui saia um `SQLModel.metadata.create_all` mais um punhado de
    ALTER TABLE escritos a mao. Isso criava a tabela na primeira vez, mas nao
    tinha como versionar mudanca nenhuma: coluna nova exigia gambiarra, e FK
    ou NOT NULL nao tinha jeito. Agora existe uma fonte unica da verdade — os
    arquivos em alembic/versions — e o startup so aplica o que falta.
    """
    configuracao = Config(str(DIRETORIO_BACKEND / "alembic.ini"))
    configuracao.set_main_option("script_location", str(DIRETORIO_BACKEND / "alembic"))
    configuracao.set_main_option("sqlalchemy.url", URL_BANCO)

    command.upgrade(configuracao, "head")
