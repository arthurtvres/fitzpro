"""
Envio de e-mail, com um backend de console para desenvolvimento.

Dois backends atrás da mesma função. O padrão é `console`, que imprime a
mensagem no terminal em vez de mandar: quem clona o repositório exercita
recuperação de senha e convite sem credencial nenhuma, e a suíte de testes
nunca manda mensagem para um endereço real. Trocar para `smtp` em produção é
variável de ambiente.

`smtplib` é biblioteca padrão — nenhuma dependência nova entrou por causa disto.
Um serviço de API (Resend, SendGrid) caberia aqui como um terceiro backend, sem
que nada fora deste arquivo mudasse.
"""

import smtplib
import ssl
import sys
from email.message import EmailMessage

from app.core import config

def enviar(destino: str, assunto: str, corpo: str) -> None:
    """
    Manda a mensagem, ou imprime — nunca derruba a requisição que chamou.

    Falha de SMTP não pode virar 500 numa rota de recuperação de senha: além de
    inútil para quem está do outro lado, um erro que aparece só quando o e-mail
    existe transformaria a rota num verificador de contas, que é exatamente o
    que a resposta uniforme tenta evitar.
    """
    # O try cobre tudo, inclusive o backend de console. A primeira versão só
    # protegia o SMTP, e o `print` derrubou a rota num terminal Windows: o
    # stdout lá é cp1252 e não aceita nem acento nem tracejado. Um "olá" numa
    # mensagem não pode virar 500 na recuperação de senha.
    try:
        # Só "smtp" tenta a rede. Qualquer outro valor cai no console — um
        # typo na variável de ambiente não pode virar tentativa silenciosa de
        # alcançar um servidor de e-mail que ninguém configurou.
        if config.EMAIL_BACKEND != "smtp":
            _escrever(_para_console(destino, assunto, corpo))
            return

        mensagem = EmailMessage()
        mensagem["From"] = config.EMAIL_REMETENTE
        mensagem["To"] = destino
        mensagem["Subject"] = assunto
        mensagem.set_content(corpo)

        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORTA, timeout=10) as servidor:
            servidor.starttls(context=ssl.create_default_context())
            if config.SMTP_USUARIO:
                servidor.login(config.SMTP_USUARIO, config.SMTP_SENHA)
            servidor.send_message(mensagem)
    except Exception as erro:  # noqa: BLE001 — ver docstring
        _escrever(f"[email] falha ao enviar para {destino}: {erro!r}")

def _escrever(texto: str) -> None:
    """
    Escreve no stdout sem depender do encoding do terminal.

    Trocar o caractere impossível por "?" é o comportamento certo aqui: isto é
    log de desenvolvimento, e perder um acento é infinitamente melhor que
    perder a requisição.
    """
    fluxo = sys.stdout
    codificacao = getattr(fluxo, "encoding", None) or "utf-8"
    fluxo.write(texto.encode(codificacao, errors="replace").decode(codificacao))
    fluxo.write("\n")
    fluxo.flush()

def _para_console(destino: str, assunto: str, corpo: str) -> str:
    linha = "-" * 68
    return f"\n{linha}\n[email] para: {destino}\nassunto: {assunto}\n{linha}\n{corpo}\n{linha}\n"
