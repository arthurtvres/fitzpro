from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel

class FinalidadeDoToken(str, Enum):
    """
    Para que o link serve. Duas finalidades, uma máquina só.

    Recuperação e convite fazem a mesma coisa por baixo — provam que quem clicou
    controla a caixa de e-mail e ganham o direito de definir uma senha. O que
    muda é a validade e o texto da mensagem, então separar em duas tabelas só
    duplicaria a parte difícil (emitir, expirar, invalidar, usar uma vez).
    """

    RECUPERACAO = "RECUPERACAO"
    CONVITE = "CONVITE"

class TokenDeAcesso(SQLModel, table=True):
    """
    Um link de uso único, com prazo.

    **Guarda o hash, nunca o token.** Mesma regra do `senha_hash`: vazar o banco
    não pode entregar links funcionando. Mas o hash aqui é sha256, e não bcrypt,
    e a diferença é proposital — o token são 32 bytes aleatórios, entropia alta
    demais para força bruta valer a pena. bcrypt existe para segredo fraco
    escolhido por gente; aqui ele só custaria ~100 ms por verificação sem
    comprar segurança nenhuma.
    """

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuario.id", index=True)
    finalidade: FinalidadeDoToken

    # Indexado porque a consulta do resgate é exatamente "acha por este hash".
    token_hash: str = Field(index=True, unique=True)

    criado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expira_em: datetime

    # Uso único: carimbado no resgate. Coluna de data e não booleano — saber
    # *quando* um link foi usado é o que permite investigar um acesso estranho
    # depois, e custa os mesmos bytes.
    usado_em: datetime | None = None
