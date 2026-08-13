"""
Aceite dos termos: quem já consentiu com uma versão que ainda vale.

A comparação é de string porque as versões são datas ISO — "2026-09-01" >
"2026-08-13" ordena certo sem precisar converter. É a única razão pela qual o
formato da versão não é livre.
"""

from datetime import datetime, timezone

from sqlmodel import Session

from app.core import config
from app.models import Usuario

def pendente(usuario: Usuario) -> bool:
    """
    Precisa aceitar antes de continuar usando?

    Duas situações caem aqui: nunca aceitou, ou aceitou uma versão anterior à
    mínima. A segunda inclui um caso que vale notar — o aluno cadastrado com
    senha pelo personal teve o aceite registrado em nome dele e nunca viu o
    texto. Na primeira mudança material, ele finalmente vê.
    """
    if not usuario.aceitou_termos:
        return True
    return (usuario.termos_versao or "") < config.VERSAO_MINIMA_ACEITA

def registrar(usuario: Usuario, session: Session) -> Usuario:
    """Grava o aceite da versão vigente: se, quando e de qual texto."""
    usuario.aceitou_termos = True
    usuario.termos_aceitos_em = datetime.now(timezone.utc)
    usuario.termos_versao = config.VERSAO_DOS_TERMOS
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario
