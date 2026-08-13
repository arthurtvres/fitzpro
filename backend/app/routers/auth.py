from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import field_validator
from sqlmodel import Session, SQLModel, select

from app.core import config
from app.core.dependencias import usuario_atual
from app.core.seguranca import conferir_senha, criar_token, gerar_hash
from app.db.session import get_session
from app.models import (
    FaixaDeAlunos,
    FinalidadeDoToken,
    Papel,
    Usuario,
    normalizar_telefone,
    publico,
)
from app.services import email as servico_email
from app.services import token_acesso

router = APIRouter(prefix="/auth", tags=["auth"])

# Curto de propósito: é o mínimo que impede "123". Uma política mais séria
# (maiúscula, número, lista de senhas vazadas) cabe quando houver por que —
# esquecer a senha deixou de significar perder a conta.
TAMANHO_MINIMO_SENHA = 8

class Credenciais(SQLModel):
    email: str
    senha: str

class Cadastro(SQLModel):
    """Criação de conta de personal. Não pede papel: aqui só nasce PERSONAL."""

    nome: str
    email: str
    senha: str

    # Obrigatório: é o que diz o porte de quem está entrando.
    quantidade_alunos: FaixaDeAlunos

    # Sem asterisco no formulário — não travar o cadastro por causa dele.
    telefone: str | None = None

    # Não tem default: omitir o aceite tem que falhar, não passar como False.
    aceitou_termos: bool

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: str | None) -> str | None:
        return normalizar_telefone(valor)

@router.post("/login")
def login(dados: Credenciais, session: Session = Depends(get_session)):
    usuario = session.exec(
        select(Usuario).where(Usuario.email == dados.email.strip().lower())
    ).first()

    # Mesma resposta para email inexistente e senha errada: dizer qual dos dois
    # falhou entregaria de graça quais emails existem no sistema.
    if not usuario or not conferir_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos",
        )

    if not usuario.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta inativa")

    return {
        "access_token": criar_token(usuario.id, usuario.papel.value),
        "token_type": "bearer",
        "usuario": publico(usuario),
    }

@router.post("/registrar", status_code=201)
def registrar(dados: Cadastro, session: Session = Depends(get_session)):
    """
    Cria uma conta de personal. **Rota pública** — é a única sem token.

    O papel é fixado aqui, não vem do corpo: se viesse, qualquer um se
    cadastraria como o que quisesse. E `personal_id` fica nulo de propósito —
    um personal é o topo do próprio tenant, não pertence a ninguém.
    """
    nome = dados.nome.strip()
    email = dados.email.strip().lower()

    if not nome:
        raise HTTPException(status_code=400, detail="Informe o seu nome")
    if len(dados.senha) < TAMANHO_MINIMO_SENHA:
        raise HTTPException(
            status_code=400,
            detail=f"A senha precisa ter pelo menos {TAMANHO_MINIMO_SENHA} caracteres",
        )
    if not dados.aceitou_termos:
        raise HTTPException(
            status_code=400,
            detail="É preciso aceitar os termos de uso e a política de privacidade",
        )

    if session.exec(select(Usuario).where(Usuario.email == email)).first():
        raise HTTPException(status_code=409, detail="Já existe uma conta com esse email")

    novo = Usuario(
        nome=nome,
        email=email,
        papel=Papel.PERSONAL,
        senha_hash=gerar_hash(dados.senha),
        telefone=dados.telefone,
        quantidade_alunos=dados.quantidade_alunos,
        aceitou_termos=True,
        # UTC: o servidor pode rodar em outro fuso que o navegador, e a hora do
        # aceite é registro, não exibição.
        termos_aceitos_em=datetime.now(timezone.utc),
    )

    session.add(novo)
    session.commit()
    session.refresh(novo)

    # Já devolve token: obrigar a passar pelo login logo após criar a conta é
    # um passo sem propósito.
    return {
        "access_token": criar_token(novo.id, novo.papel.value),
        "token_type": "bearer",
        "usuario": publico(novo),
    }

class PedidoDeRecuperacao(SQLModel):
    email: str

class RedefinicaoDeSenha(SQLModel):
    token: str
    senha_nova: str

@router.post("/recuperar", status_code=202)
def recuperar_senha(
    dados: PedidoDeRecuperacao, session: Session = Depends(get_session)
):
    """
    Manda o link de redefinição. **Rota pública.**

    Responde igual para e-mail cadastrado e não cadastrado, e é o ponto
    principal desta rota: qualquer diferença — status, texto, até demorar mais —
    a transformaria num verificador de quem tem conta no FitzPRO. Por isso o
    envio também não pode estourar exceção (ver `services/email.py`).

    Conta inativa não recebe link: redefinir a senha não pode ser um caminho de
    volta para quem o personal desativou.
    """
    email = dados.email.strip().lower()
    usuario = session.exec(select(Usuario).where(Usuario.email == email)).first()

    if usuario and usuario.ativo:
        token = token_acesso.emitir(usuario, FinalidadeDoToken.RECUPERACAO, session)
        link = f"{config.URL_DO_APP}/redefinir?token={token}"
        servico_email.enviar(
            usuario.email,
            "Redefinir sua senha do FitzPRO",
            f"""Olá, {usuario.nome.split(' ')[0]}.

Recebemos um pedido para redefinir a senha da sua conta no FitzPRO.
Use o link abaixo — ele vale por 1 hora e só funciona uma vez:

{link}

Se não foi você quem pediu, ignore esta mensagem: sua senha atual continua
valendo.""",
        )

    return {"detail": "Se houver uma conta com esse email, o link foi enviado."}

@router.post("/redefinir")
def redefinir_senha(
    dados: RedefinicaoDeSenha, session: Session = Depends(get_session)
):
    """
    Troca a senha com o link, e já devolve a sessão. **Rota pública.**

    Sem pedir a senha atual, que é justamente o que a pessoa não tem — o link é
    a prova. Entrar direto evita mandar quem acabou de definir uma senha para a
    tela de login para digitá-la de novo.
    """
    if len(dados.senha_nova) < TAMANHO_MINIMO_SENHA:
        raise HTTPException(
            status_code=400,
            detail=f"A senha precisa ter pelo menos {TAMANHO_MINIMO_SENHA} caracteres",
        )

    usuario = token_acesso.resgatar(
        dados.token, FinalidadeDoToken.RECUPERACAO, session
    )
    if not usuario:
        raise HTTPException(
            status_code=400,
            detail="Link inválido ou expirado. Peça um novo para redefinir a senha.",
        )
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Conta inativa")

    usuario.senha_hash = gerar_hash(dados.senha_nova)
    session.add(usuario)
    session.commit()
    session.refresh(usuario)

    return {
        "access_token": criar_token(usuario.id, usuario.papel.value),
        "token_type": "bearer",
        "usuario": publico(usuario),
    }

class AceiteDoConvite(SQLModel):
    token: str
    senha: str
    # Sem default: omitir o aceite tem que falhar, nao passar como False. Mesma
    # regra do cadastro do personal.
    aceitou_termos: bool

@router.get("/convite/{token}")
def ler_convite(token: str, session: Session = Depends(get_session)):
    """
    Quem e o dono deste convite. **Rota publica** e que **nao gasta o link**.

    A tela abre dizendo "Ola, Marina" antes de a pessoa digitar qualquer coisa.
    Se esta leitura consumisse o token, abrir a pagina ja queimaria o convite —
    e um recarregar acidental, ou o pre-carregamento de link que alguns clientes
    de e-mail fazem, deixaria o aluno de fora sem nunca ter usado nada.

    Devolve o minimo para a tela se apresentar. Nada de `publico()`: este e um
    endpoint sem autenticacao, e `publico` devolve tudo o que existir no modelo
    — um campo novo passaria a vazar sozinho para qualquer um com um link.
    """
    aluno = token_acesso.ler(token, FinalidadeDoToken.CONVITE, session)
    if not aluno or not aluno.ativo:
        raise HTTPException(
            status_code=404,
            detail="Convite invalido ou expirado. Peca um novo ao seu personal.",
        )

    personal = session.get(Usuario, aluno.personal_id) if aluno.personal_id else None
    return {
        "nome": aluno.nome,
        "email": aluno.email,
        "personal_nome": personal.nome if personal else None,
    }

@router.post("/convite")
def aceitar_convite(dados: AceiteDoConvite, session: Session = Depends(get_session)):
    """
    O primeiro acesso do aluno: senha propria e aceite dos termos. **Publica.**

    E aqui que o aceite do aluno acontece, e nao no cadastro: quem cria a conta
    dele e o personal, e ninguem pode concordar com termos de uso no lugar de
    outra pessoa. Ate este momento o aluno tem uma senha aleatoria que ninguem
    conhece, entao nao ha como entrar sem passar por aqui.
    """
    if len(dados.senha) < TAMANHO_MINIMO_SENHA:
        raise HTTPException(
            status_code=400,
            detail=f"A senha precisa ter pelo menos {TAMANHO_MINIMO_SENHA} caracteres",
        )
    if not dados.aceitou_termos:
        raise HTTPException(
            status_code=400,
            detail="E preciso aceitar os termos de uso e a politica de privacidade",
        )

    aluno = token_acesso.resgatar(dados.token, FinalidadeDoToken.CONVITE, session)
    if not aluno:
        raise HTTPException(
            status_code=400,
            detail="Convite invalido ou expirado. Peca um novo ao seu personal.",
        )
    if not aluno.ativo:
        raise HTTPException(status_code=403, detail="Conta inativa")

    aluno.senha_hash = gerar_hash(dados.senha)
    aluno.aceitou_termos = True
    aluno.termos_aceitos_em = datetime.now(timezone.utc)
    session.add(aluno)
    session.commit()
    session.refresh(aluno)

    return {
        "access_token": criar_token(aluno.id, aluno.papel.value),
        "token_type": "bearer",
        "usuario": publico(aluno),
    }

@router.get("/eu")
def eu(usuario: Usuario = Depends(usuario_atual)):
    """Quem é o dono do token — o front usa para restaurar a sessão."""
    return publico(usuario)
