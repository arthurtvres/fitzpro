from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import field_validator
from sqlmodel import Session, SQLModel, select

from app.core.dependencias import usuario_atual
from app.core.seguranca import conferir_senha, criar_token, gerar_hash
from app.db.session import get_session
from app.models import FaixaDeAlunos, Papel, Usuario, normalizar_telefone, publico

router = APIRouter(prefix="/auth", tags=["auth"])

# Curto de propósito: é o mínimo que impede "123". Uma política mais séria
# (maiúscula, número, lista de senhas vazadas) entra quando houver recuperação
# de senha por e-mail — hoje esquecer a senha significa perder a conta.
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

@router.get("/eu")
def eu(usuario: Usuario = Depends(usuario_atual)):
    """Quem é o dono do token — o front usa para restaurar a sessão."""
    return publico(usuario)
