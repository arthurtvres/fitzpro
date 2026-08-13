"""
Emissão e resgate dos links de uso único (recuperação de senha e convite).

Uma máquina só para as duas finalidades: ambas provam que quem clicou controla
a caixa de e-mail e ganham o direito de definir uma senha. O que muda é o prazo
e o texto da mensagem.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.models import FinalidadeDoToken, TokenDeAcesso, Usuario

# 32 bytes de urandom viram 43 caracteres em base64url. É entropia suficiente
# para o link não ser adivinhável, e curto o bastante para caber numa URL que
# alguém possa copiar de um e-mail em texto puro.
BYTES_DO_TOKEN = 32

# Recuperação é curta porque quem pediu está do outro lado agora, e um link de
# senha vivendo por dias no histórico do navegador é superfície à toa. Convite é
# longo porque o aluno pode ver o e-mail só no fim de semana — expirar antes
# disso jogaria o trabalho de volta no personal.
VALIDADE = {
    FinalidadeDoToken.RECUPERACAO: timedelta(hours=1),
    FinalidadeDoToken.CONVITE: timedelta(days=7),
}

def _hash(token: str) -> str:
    """sha256, e não bcrypt — ver a docstring de `TokenDeAcesso`."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _com_fuso(momento: datetime) -> datetime:
    """O SQLite devolve datetime sem offset; comparar ingênuo com ciente explode."""
    return momento if momento.tzinfo else momento.replace(tzinfo=timezone.utc)

def emitir(usuario: Usuario, finalidade: FinalidadeDoToken, session: Session) -> str:
    """
    Cria o link e **invalida os anteriores** da mesma finalidade.

    Sem isso, pedir "esqueci a senha" três vezes deixaria três links válidos
    circulando — e o mais antigo, que pode ter ido parar num e-mail encaminhado,
    continuaria abrindo a conta. O último pedido é o único que vale.
    """
    agora = datetime.now(timezone.utc)

    anteriores = session.exec(
        select(TokenDeAcesso).where(
            TokenDeAcesso.usuario_id == usuario.id,
            TokenDeAcesso.finalidade == finalidade,
            TokenDeAcesso.usado_em.is_(None),
        )
    ).all()
    for antigo in anteriores:
        antigo.usado_em = agora
        session.add(antigo)

    token = secrets.token_urlsafe(BYTES_DO_TOKEN)
    session.add(
        TokenDeAcesso(
            usuario_id=usuario.id,
            finalidade=finalidade,
            token_hash=_hash(token),
            criado_em=agora,
            expira_em=agora + VALIDADE[finalidade],
        )
    )
    session.commit()
    return token

def _valido(
    token: str, finalidade: FinalidadeDoToken, session: Session
) -> TokenDeAcesso | None:
    """
    Acha o registro, se ele servir. Não consome.

    Um None só, para inválido, expirado e já usado: quem está do outro lado não
    ganha nada sabendo qual dos três foi, e a distinção só ajudaria quem
    estivesse sondando tokens.
    """
    if not token:
        return None

    registro = session.exec(
        select(TokenDeAcesso).where(TokenDeAcesso.token_hash == _hash(token))
    ).first()

    if not registro or registro.usado_em or registro.finalidade != finalidade:
        return None
    if _com_fuso(registro.expira_em) < datetime.now(timezone.utc):
        return None
    return registro

def ler(token: str, finalidade: FinalidadeDoToken, session: Session) -> Usuario | None:
    """
    Espia o dono do link **sem gastá-lo**.

    Existe por causa da tela de convite: ela abre mostrando "Olá, Marina" antes
    de a pessoa digitar qualquer coisa. Se essa leitura consumisse o token,
    abrir a página já queimaria o convite — e um recarregar acidental, ou o
    pré-carregamento de link que alguns clientes de e-mail fazem, deixaria o
    aluno de fora com um link que nunca chegou a ser usado por ele.
    """
    registro = _valido(token, finalidade, session)
    return session.get(Usuario, registro.usuario_id) if registro else None

def resgatar(
    token: str, finalidade: FinalidadeDoToken, session: Session
) -> Usuario | None:
    """Consome o link e devolve o dono, ou None se não servir."""
    registro = _valido(token, finalidade, session)
    if not registro:
        return None

    usuario = session.get(Usuario, registro.usuario_id)
    if not usuario:
        return None

    # Carimbado antes de a senha trocar: se algo falhar depois, o link já não
    # vale — repetir o pedido é barato, um link que sobrevive ao uso não é.
    registro.usado_em = datetime.now(timezone.utc)
    session.add(registro)
    session.commit()
    return usuario
