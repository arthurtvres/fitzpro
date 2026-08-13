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

def normalizar_cpf(valor: str | None) -> str | None:
    """
    Guarda só os 11 dígitos, e recusa CPF que não fecha a conta.

    Mesma regra do telefone — formatar é trabalho da tela, o banco guarda o
    número —, mais a checagem dos dígitos verificadores. Sem ela, um erro de
    digitação vira um CPF que parece válido e só é descoberto quando alguém
    precisa dele para valer.
    """
    if not valor or not valor.strip():
        return None

    digitos = re.sub(r"\D", "", valor)
    if len(digitos) != 11:
        raise ValueError("Informe um CPF com 11 dígitos.")

    # 111.111.111-11 e afins passam na conta dos verificadores, mas não são CPF
    # de ninguém — são o preenchimento de quem só quer sair do campo.
    if digitos == digitos[0] * 11:
        raise ValueError("Informe um CPF válido.")

    for posicao in (9, 10):
        peso_inicial = posicao + 1
        soma = sum(
            int(digitos[i]) * (peso_inicial - i) for i in range(posicao)
        )
        resto = (soma * 10) % 11
        esperado = 0 if resto == 10 else resto
        if esperado != int(digitos[posicao]):
            raise ValueError("Informe um CPF válido.")

    return digitos

def normalizar_cep(valor: str | None) -> str | None:
    """Oito dígitos, sem hífen. '01310-100' e '01310100' viram o mesmo dado."""
    if not valor or not valor.strip():
        return None

    digitos = re.sub(r"\D", "", valor)
    if len(digitos) != 8:
        raise ValueError("Informe um CEP com 8 dígitos, ex.: 01310-100.")
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
    cpf: str | None = None
    cep: str | None = None
    logradouro: str | None = None
    numero_endereco: str | None = None
    complemento: str | None = None
    bairro: str | None = None
    foto_url: str | None = Field(default=None, sa_column=Column(Text))

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: str | None) -> str | None:
        return normalizar_telefone(valor)

    @field_validator("cpf")
    @classmethod
    def validar_cpf(cls, valor: str | None) -> str | None:
        return normalizar_cpf(valor)

    @field_validator("cep")
    @classmethod
    def validar_cep(cls, valor: str | None) -> str | None:
        return normalizar_cep(valor)

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

    # Opcional: sem senha, o aluno recebe um convite e define a dele no primeiro
    # acesso. É o caminho normal desde que o convite existe — o personal digitar
    # uma senha pelo aluno significa que duas pessoas a conhecem, e que alguém
    # precisa ditá-la por WhatsApp. Continua aceito porque nem todo personal vai
    # querer depender de e-mail.
    senha: str | None = None
    telefone: str

    # Obrigatória aqui, e não em `UsuarioBase`, pela mesma razão do telefone: é
    # regra do aluno. E virou obrigatória quando passou a existir verificação de
    # idade — sem a data não dá para saber se o cadastro precisa de autorização
    # dos responsáveis, e "não informado" viraria a forma de contornar a regra.
    data_nascimento: date

    # Declaração de que um dos pais autorizou, exigida quando a data de
    # nascimento indica menor de 18. Entra como flag e sai como data: o que
    # interessa guardar é **quando** a declaração foi feita, e um booleano
    # sozinho não prova nada depois (LGPD, art. 14).
    autorizacao_responsavel: bool = False

    @field_validator("telefone")
    @classmethod
    def exigir_telefone(cls, valor: str | None) -> str:
        numero = normalizar_telefone(valor)
        if not numero:
            raise ValueError("Informe o telefone do aluno.")
        return numero

    @field_validator("data_nascimento")
    @classmethod
    def validar_nascimento(cls, valor: date) -> date:
        """Data no futuro daria idade negativa e passaria pela regra do menor."""
        if valor > date.today():
            raise ValueError("Informe uma data de nascimento válida.")
        return valor

class UsuarioAtualizacao(UsuarioBase):
    """
    PUT /usuarios/{id} — não mexe em senha, para isso existe rota própria.

    Telefone fica opcional **no schema** porque este mesmo corpo serve a três
    casos: o personal editando um aluno, o personal editando a si mesmo e o
    aluno editando a si mesmo. Só o primeiro exige telefone, e quem sabe qual é
    o caso é a rota, que conhece o papel do alvo — o schema não conhece.
    """

    # Só de entrada, como em `UsuarioCriacao`: editar a data de nascimento para
    # uma de menor exige a mesma declaração que o cadastro exige.
    autorizacao_responsavel: bool = False

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

    # O aceite dos termos: se, quando e **de qual versão**. Os três juntos, e
    # não só o booleano — provar que alguém concordou sem saber com qual texto
    # não vale nada num pedido de titular ou numa disputa. Nulo nas contas
    # criadas antes de o versionamento existir, que é informação verdadeira:
    # não se sabe mesmo qual texto elas viram.
    aceitou_termos: bool = Field(default=False)
    termos_aceitos_em: datetime | None = None
    termos_versao: str | None = None

    # Quando o aluno entrou pela primeira vez — a marca de que ele assumiu a
    # conta. **Separado de `aceitou_termos` de propósito.** Os dois eram a mesma
    # coisa enquanto o único caminho para o aceite era o primeiro acesso; desde
    # que o personal pode cadastrar com senha e aceitar em nome do aluno, deixam
    # de ser. É este campo, e não o aceite, que decide se o personal ainda pode
    # editar o cadastro: sem essa separação ele perderia o acesso no instante em
    # que cadastrasse alguém que talvez nunca faça login.
    primeiro_acesso_em: datetime | None = None

    # Declaração do personal de que há autorização dos responsáveis, para aluno
    # menor de idade. Nula quando não se aplica.
    autorizacao_responsavel_em: datetime | None = None

    # ---------- anotações do personal sobre o aluno ----------
    # Privadas: são o caderno do profissional, não um recado. Ficam **fora** de
    # `UsuarioBase` de propósito, como `senha_hash` e `personal_id` — assim não
    # há corpo de PUT que as escreva, e o aluno, que agora é dono do próprio
    # cadastro, não as apaga sem querer ao salvar o perfil. Quem lê e escreve é
    # uma rota própria, com `personal_atual`.
    observacoes: str | None = Field(default=None, sa_column=Column(Text))

class TrocaDeSenha(SQLModel):
    senha_atual: str | None = None  # o PERSONAL pode redefinir a de um aluno
    senha_nova: str

# Idade a partir da qual a pessoa aceita os termos por conta propria. Abaixo
# disso o art. 14 da LGPD exige consentimento de um dos pais ou do responsavel.
MAIORIDADE = 18

def e_menor(data_nascimento: date | None) -> bool:
    """
    Menor de idade, pela data informada.

    Data ausente devolve False: nao da para afirmar que alguem e menor sem
    saber a idade, e tratar "nao informado" como menor travaria todo cadastro
    em que a data e opcional — que e o caso aqui.
    """
    idade = idade_de(data_nascimento)
    return idade is not None and idade < MAIORIDADE

def idade_de(data_nascimento: date | None) -> int | None:
    if not data_nascimento:
        return None
    hoje = date.today()
    faz_anos = (hoje.month, hoje.day) >= (data_nascimento.month, data_nascimento.day)
    return hoje.year - data_nascimento.year - (0 if faz_anos else 1)

def publico(usuario: Usuario) -> dict:
    """
    Usuário como ele sai da API: sem hash de senha e com a idade calculada.

    `observacoes` também fica de fora, e este é o ponto: `publico` é o que o
    **próprio aluno** recebe em `/auth/eu`. Sem esta exclusão, a anotação
    privada do personal apareceria na resposta que vai para o aluno — sem
    aparecer em tela nenhuma, e por isso sem ninguém notar.
    """
    dados = usuario.model_dump(exclude={"senha_hash", "observacoes"})
    dados["idade"] = idade_de(usuario.data_nascimento)
    return dados

def resumo(usuario: Usuario) -> dict:
    """
    O usuário como ele aparece numa **lista**: o cartão, não o cadastro.

    Existe porque `publico` devolve o modelo inteiro — 25 campos hoje — e as
    telas de lista usam nove. Sem esta separação, CPF, CEP, logradouro, número,
    complemento, bairro, nascimento, sexo e os campos de aceite de termos
    viajavam em toda listagem e em cada linha do painel, para telas que não
    mostram nada disso.

    **Lista explícita, e não `publico` com exclusões**, pela mesma razão do
    `cartao_de_contato`: com lista negra, campo novo do modelo vaza por padrão
    e alguém precisa lembrar de bloqueá-lo. Foi assim que CPF e endereço
    acabaram aqui. Com lista branca, campo novo só aparece de propósito.

    `foto_url` fica porque as listas mostram avatar. Ele é base64 e domina o
    tamanho da resposta — o ganho deste recorte é de privacidade, não de bytes.
    """
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "telefone": usuario.telefone,
        "foto_url": usuario.foto_url,
        "ativo": usuario.ativo,
        "objetivo": usuario.objetivo,
        "idade": idade_de(usuario.data_nascimento),
        # Operacionais, não pessoais: dizem se o aluno já assumiu a conta, e é
        # o que decide se a lista oferece "editar" e "reenviar convite".
        "aceitou_termos": usuario.aceitou_termos,
        "primeiro_acesso_em": usuario.primeiro_acesso_em,
    }

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
