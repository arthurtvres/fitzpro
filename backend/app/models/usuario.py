import re
from datetime import date, datetime
from enum import Enum

from pydantic import field_validator
from sqlalchemy import Column, Text
from sqlmodel import SQLModel, Field

class Papel(str, Enum):
    PERSONAL = "PERSONAL"
    ALUNO = "ALUNO"

class FaixaDeAlunos(str, Enum):
    """
    Quantos alunos o personal já atende, perguntado no cadastro.

    É faixa e não número porque a resposta é uma estimativa de quem está se
    inscrevendo, e porque o número real vira dado do sistema no dia seguinte —
    o que interessa aqui é o porte de quem chegou.
    """

    SEM_ALUNOS = "SEM_ALUNOS"
    ATE_5 = "ATE_5"
    DE_6_A_15 = "DE_6_A_15"
    DE_16_A_30 = "DE_16_A_30"
    DE_31_A_50 = "DE_31_A_50"
    MAIS_DE_50 = "MAIS_DE_50"

# A foto chega como data URL base64, mesma solução das fotos de avaliação. O
# limite é o que impede alguém de entupir a linha: o front manda um avatar de
# 256px (~15 KB), então 400 KB já é folga larga para qualquer imagem legítima.
TAMANHO_MAXIMO_FOTO = 400_000

def normalizar_telefone(valor: str | None) -> str | None:
    """
    Guarda só os dígitos: "(11) 96123-4567" e "11961234567" viram o mesmo dado.

    Formatar é trabalho da tela; o banco guarda o número. Sem normalizar, o
    mesmo telefone entraria de cinco jeitos diferentes e nenhuma busca acharia.
    """
    # Campo em branco é "não informado"; texto sem nenhum dígito é erro de
    # digitação, e engolir isso salvaria o cadastro sem telefone nenhum.
    if not valor or not valor.strip():
        return None

    digitos = re.sub(r"\D", "", valor)

    # Brasil: 10 dígitos (fixo) ou 11 (celular), sempre com DDD. Um 55 na
    # frente é o código do país, que a tela já mostra fixo — descartamos.
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        digitos = digitos[2:]

    if len(digitos) not in (10, 11):
        raise ValueError("Informe um telefone com DDD, ex.: (11) 96123-4567.")

    return digitos

class UsuarioBase(SQLModel):
    """Informações principais, compartilhadas por entrada e saída."""

    nome: str
    email: str
    papel: Papel = Papel.ALUNO

    # Perfil: muda pouco e é um por pessoa, então fica aqui mesmo.
    # Peso e medidas, que mudam sempre, vivem em Avaliacao.
    data_nascimento: date | None = None
    sexo: str | None = None
    altura_cm: float | None = None
    objetivo: str = ""
    telefone: str | None = None
    foto_url: str | None = Field(default=None, sa_column=Column(Text))

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: str | None) -> str | None:
        return normalizar_telefone(valor)

    @field_validator("foto_url")
    @classmethod
    def validar_foto(cls, valor: str | None) -> str | None:
        """Sem isto o campo aceitaria texto qualquer, de qualquer tamanho."""
        if not valor:
            return None
        if not valor.startswith("data:image/"):
            raise ValueError("A foto precisa ser uma imagem.")
        if len(valor) > TAMANHO_MAXIMO_FOTO:
            raise ValueError("A foto é grande demais. Envie uma imagem menor.")
        return valor

class UsuarioCriacao(UsuarioBase):
    """
    POST /usuarios — cadastro de aluno, feito pelo personal.

    Telefone é obrigatório aqui, e não em `UsuarioBase`, porque a regra é do
    aluno: o personal não precisa informar o dele para criar a conta.
    """

    senha: str
    telefone: str

    @field_validator("telefone")
    @classmethod
    def exigir_telefone(cls, valor: str | None) -> str:
        numero = normalizar_telefone(valor)
        if not numero:
            raise ValueError("Informe o telefone do aluno.")
        return numero

class UsuarioAtualizacao(UsuarioBase):
    """
    PUT /usuarios/{id} — não mexe em senha, para isso existe rota própria.

    Telefone fica opcional **no schema** porque este mesmo corpo serve a três
    casos: o personal editando um aluno, o personal editando a si mesmo e o
    aluno editando a si mesmo. Só o primeiro exige telefone, e quem sabe qual é
    o caso é a rota, que conhece o papel do alvo — o schema não conhece.
    """

class Usuario(UsuarioBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Fora das classes de entrada: o cliente nunca define nem lê estes campos
    # pelo corpo. `ativo` muda por DELETE/reativar; a senha, por rota própria.
    email: str = Field(unique=True, index=True)
    senha_hash: str
    ativo: bool = Field(default=True)

    # Dono do registro — o tenant. Um ALUNO pertence ao PERSONAL que o
    # cadastrou; um PERSONAL não pertence a ninguém, então fica nulo. Fora das
    # classes de entrada de propósito: quem define é o servidor, a partir de
    # quem está logado. Se viesse no corpo, bastaria mandar outro id para
    # roubar um aluno de outra conta.
    personal_id: int | None = Field(default=None, foreign_key="usuario.id", index=True)

    # ---------- respostas do cadastro (só do PERSONAL) ----------
    # Vêm de /auth/registrar e não das classes de entrada de aluno: são
    # perguntas de quem está assinando o serviço, não do perfil de treino.
    # Nulas nas contas criadas antes destes campos existirem.
    quantidade_alunos: FaixaDeAlunos | None = None

    # O aceite dos termos e a hora em que ele aconteceu. A data importa tanto
    # quanto o "sim": provar aceite sem saber de qual versão dos termos, e
    # quando, não vale muita coisa.
    aceitou_termos: bool = Field(default=False)
    termos_aceitos_em: datetime | None = None

class TrocaDeSenha(SQLModel):
    senha_atual: str | None = None  # o PERSONAL pode redefinir a de um aluno
    senha_nova: str

def idade_de(data_nascimento: date | None) -> int | None:
    if not data_nascimento:
        return None
    hoje = date.today()
    faz_anos = (hoje.month, hoje.day) >= (data_nascimento.month, data_nascimento.day)
    return hoje.year - data_nascimento.year - (0 if faz_anos else 1)

def publico(usuario: Usuario) -> dict:
    """Usuário como ele sai da API: sem hash de senha e com a idade calculada."""
    dados = usuario.model_dump(exclude={"senha_hash"})
    dados["idade"] = idade_de(usuario.data_nascimento)
    return dados

def cartao_de_contato(usuario: Usuario) -> dict:
    """
    O mínimo para o aluno saber quem é seu personal e como falar com ele.

    Lista curta e explícita, não um `publico()` com exclusões: `publico` devolve
    tudo o que existir no modelo, então um campo novo passaria a vazar sozinho
    para todos os alunos do sistema. Aqui, campo novo só aparece se for
    acrescentado de propósito.

    Fica de fora tudo que é do perfil ou do negócio do personal — nascimento,
    sexo, objetivo, altura, porte da carteira, aceite de termos.
    """
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "telefone": usuario.telefone,
        "foto_url": usuario.foto_url,
    }
