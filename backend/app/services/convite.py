"""
O convite do aluno: o e-mail que ele recebe para criar a própria senha.

Módulo separado de `routers/usuarios.py` porque duas rotas o usam — cadastrar
aluno e reenviar convite — e porque o texto da mensagem é conteúdo, não regra de
rota. Emissão e validade do link ficam em `token_acesso`; aqui só se decide o
que vai escrito.
"""

from sqlmodel import Session

from app.core import config
from app.models import FinalidadeDoToken, Usuario
from app.services import email as servico_email
from app.services import token_acesso

def enviar(aluno: Usuario, personal: Usuario, session: Session) -> None:
    """
    Emite o link e manda a mensagem.

    Não devolve o token e não o registra em lugar nenhum além do e-mail: quem
    convida não precisa vê-lo, e um convite que o personal consegue ler seria um
    convite que o personal consegue usar — a conta do aluno deixaria de ser só
    do aluno.
    """
    token = token_acesso.emitir(aluno, FinalidadeDoToken.CONVITE, session)
    link = f"{config.URL_DO_APP}/convite?token={token}"

    servico_email.enviar(
        aluno.email,
        f"{personal.nome.split(' ')[0]} convidou você para o FitzPRO",
        f"""Olá, {aluno.nome.split(' ')[0]}.

{personal.nome} criou seu acesso ao FitzPRO, onde ficam seus treinos, sua dieta
e seu acompanhamento.

Use o link abaixo para criar sua senha e entrar. Ele vale por 7 dias:

{link}

Depois disso é só entrar com {aluno.email} e a senha que você escolher.""",
    )
