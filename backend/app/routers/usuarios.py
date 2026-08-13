import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.dependencias import (
    aluno_do_tenant,
    personal_atual,
    tenant_de,
    usuario_atual,
)
from app.core.seguranca import conferir_senha, gerar_hash
from app.db.session import get_session
from sqlmodel import SQLModel

from app.core import config
from app.models import (
    FinalidadeDoToken,
    Papel,
    TrocaDeSenha,
    Usuario,
    UsuarioAtualizacao,
    UsuarioCriacao,
    cartao_de_contato,
    e_menor,
    publico,
    resumo,
)
from app.services import convite

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

# Nota privada e nao um documento: cabe um paragrafo de contexto ("joelho
# direito, evitar agachamento profundo"), nao o historico inteiro. O limite
# existe porque a coluna e TEXT e aceitaria qualquer coisa sem ele.
TAMANHO_MAXIMO_OBSERVACOES = 5_000

def gerenciavel_ou_404(usuario_id: int, logado: Usuario, session: Session) -> Usuario:
    """
    O usuário que `logado` tem direito de administrar: um aluno seu, ou ele
    mesmo.

    Antes daqui bastava ser PERSONAL para editar, desativar ou redefinir a
    senha de qualquer conta — inclusive a de outro personal. Agora o alcance de
    um personal termina nos alunos dele.
    """
    if usuario_id == logado.id:
        return logado
    return aluno_do_tenant(usuario_id, logado, session)

def garantir_email_livre(email: str, session: Session, ignorar_id: int | None = None):
    existente = session.exec(select(Usuario).where(Usuario.email == email)).first()
    if existente and existente.id != ignorar_id:
        raise HTTPException(status_code=409, detail="Já existe um usuário com esse email")

@router.get("")
def listar_usuarios(
    papel: Papel | None = None,
    incluir_inativos: bool = False,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    # Só os alunos deste personal. O filtro não é opcional nem parametrizável:
    # é ele que separa um tenant do outro.
    consulta = select(Usuario).where(Usuario.personal_id == tenant_de(logado))
    if papel is not None:
        consulta = consulta.where(Usuario.papel == papel)
    if not incluir_inativos:
        consulta = consulta.where(Usuario.ativo)
    # `resumo` e nao `publico`: e uma lista, e o cadastro completo de cada
    # aluno (CPF, endereco, nascimento) nao tem uso em tela nenhuma daqui.
    return [resumo(u) for u in session.exec(consulta).all()]

@router.post("", status_code=201)
def criar_usuario(
    dados: UsuarioCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    email = dados.email.strip().lower()
    garantir_email_livre(email, session)

    # Menor de idade so entra com a declaracao de que ha autorizacao dos pais
    # (LGPD, art. 14). A checagem e aqui, e nao so na tela: sem ela o dialogo do
    # formulario seria enfeite, contornavel por qualquer chamada direta a API.
    agora = datetime.now(timezone.utc)
    menor = e_menor(dados.data_nascimento)
    if menor and not dados.autorizacao_responsavel:
        raise HTTPException(
            status_code=400,
            detail=(
                "Aluno menor de idade precisa de autorizacao de um dos pais "
                "ou do responsavel legal."
            ),
        )

    # O dono sai de quem está logado, nunca do corpo: aceitar personal_id do
    # cliente deixaria qualquer um cadastrar aluno na conta alheia.
    # Esta rota cadastra aluno, e só. Personal nasce em /auth/registrar, que é
    # público e não tem dono; se o papel viesse do corpo, um personal poderia
    # criar outro personal dentro do próprio tenant — um híbrido que não é nem
    # aluno nem conta independente.
    # Sem senha no corpo, o aluno nasce com uma que ninguem conhece: 32 bytes
    # aleatorios com hash. E preferivel a um hash sentinela ou a um campo nulo
    # porque `conferir_senha` e `login` continuam funcionando sem saber que este
    # caso existe — nao ha ramo novo onde um bug de autenticacao possa nascer.
    por_convite = not dados.senha
    senha_inicial = dados.senha or secrets.token_urlsafe(32)

    novo = Usuario.model_validate(
        dados,
        update={
            "email": email,
            "senha_hash": gerar_hash(senha_inicial),
            "papel": Papel.ALUNO,
            "personal_id": tenant_de(logado),
            "autorizacao_responsavel_em": agora if menor else None,
            # Cadastro completo pelo personal (com senha, sem convite): o aceite
            # e registrado aqui, porque nao havera primeiro acesso onde pedi-lo.
            # Pelo convite o aceite continua sendo do proprio aluno — e por isso
            # que `aceitou_termos` deixou de servir como marca de "assumiu a
            # conta"; quem faz esse papel agora e `primeiro_acesso_em`.
            "aceitou_termos": not por_convite,
            "termos_aceitos_em": None if por_convite else agora,
            "termos_versao": None if por_convite else config.VERSAO_DOS_TERMOS,
        },
    )

    session.add(novo)
    session.commit()
    session.refresh(novo)

    if por_convite:
        convite.enviar(novo, logado, session)

    return {**publico(novo), "convite_enviado": por_convite}

@router.post("/{usuario_id}/convite", status_code=202)
def reenviar_convite(
    usuario_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    """
    Manda o convite de novo. O anterior deixa de valer.

    Existe porque o convite dura 7 dias e e-mail se perde. Sem isto, a saida do
    personal seria apagar e recriar o aluno — levando junto treinos, dietas e
    todo o historico de execucao.
    """
    aluno = gerenciavel_ou_404(usuario_id, logado, session)
    if aluno.papel != Papel.ALUNO:
        raise HTTPException(status_code=400, detail="So faz sentido para aluno")
    if not aluno.ativo:
        raise HTTPException(status_code=400, detail="Aluno inativo")
    if aluno.primeiro_acesso_em:
        # Convite serve para o primeiro acesso. Depois dele o aluno ja tem
        # senha, e quem esquece usa a recuperacao — que e dele, nao do personal.
        raise HTTPException(
            status_code=400,
            detail="Este aluno ja ativou a conta; o convite nao se aplica mais.",
        )

    convite.enviar(aluno, logado, session)
    return {"detail": "Convite reenviado."}

class Observacoes(SQLModel):
    texto: str | None = None

@router.get("/{usuario_id}/observacoes")
def ler_observacoes(
    usuario_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    """
    As anotações do personal sobre um aluno dele. **Só o personal.**

    Rota própria, e não um campo em `publico()`, porque a resposta de `publico`
    vai para o próprio aluno em `/auth/eu`. Aqui o `personal_atual` já barra o
    aluno com 403, e `aluno_do_tenant` barra o personal do concorrente com 404.
    """
    aluno = gerenciavel_ou_404(usuario_id, logado, session)
    return {"texto": aluno.observacoes or ""}

@router.put("/{usuario_id}/observacoes")
def salvar_observacoes(
    usuario_id: int,
    dados: Observacoes,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    """Escreve a anotação. Texto em branco apaga, e isso é intencional."""
    aluno = gerenciavel_ou_404(usuario_id, logado, session)

    texto = (dados.texto or "").strip()
    if len(texto) > TAMANHO_MAXIMO_OBSERVACOES:
        raise HTTPException(
            status_code=400,
            detail=(
                "A observação passou de "
                f"{TAMANHO_MAXIMO_OBSERVACOES} caracteres."
            ),
        )

    # Vazio vira None, e não string vazia: "nunca escreveu" e "apagou o que
    # tinha" acabam no mesmo lugar, e ter dois jeitos de dizer "não há nota"
    # faria toda leitura precisar testar os dois.
    aluno.observacoes = texto or None
    session.add(aluno)
    session.commit()
    return {"texto": aluno.observacoes or ""}

# Precisa vir antes de /{usuario_id}, senão "meu-personal" é lido como um id.
@router.get("/meu-personal")
def buscar_meu_personal(
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Quem treina o aluno logado.

    Existe porque `GET /usuarios/{id}` responde 404 para o personal — e deve
    mesmo: o aluno não tem por que ler o cadastro dele. Mas saber o nome de
    quem monta seus treinos, e como falar com essa pessoa, é outra coisa. Daí
    uma rota separada com um recorte próprio, em vez de abrir exceção na outra.

    Devolve `null` quando não há o que mostrar (o próprio personal chamando, ou
    conta de personal desativada): é ausência de dado, não erro.
    """
    if logado.papel != Papel.ALUNO or not logado.personal_id:
        return None

    personal = session.get(Usuario, logado.personal_id)
    if not personal or not personal.ativo:
        return None

    return cartao_de_contato(personal)

@router.get("/{usuario_id}")
def buscar_usuario(
    usuario_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    return publico(gerenciavel_ou_404(usuario_id, logado, session))

@router.put("/{usuario_id}")
def atualizar_usuario(
    usuario_id: int,
    dados: UsuarioAtualizacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Cada um edita o próprio cadastro. O personal, só antes do primeiro acesso.

    O personal cadastra o aluno para poder convidá-lo — mas, assim que o aluno
    entra e assume a conta, o cadastro passa a ser dele. Nome, telefone, foto e
    data de nascimento são dados da pessoa, e quem corrige um dado pessoal é o
    titular. Isso também tira do personal a possibilidade de trocar o e-mail de
    login de alguém que já usa a conta.

    A janela antes do primeiro acesso continua aberta de propósito: se o
    personal errou o e-mail, o convite não chega, o aluno não entra — e sem
    essa janela ninguém poderia consertar, porque só o aluno editaria e ele não
    tem como fazer login. `aceitou_termos` é a marca de que ele assumiu a conta.
    """
    usuario = gerenciavel_ou_404(usuario_id, logado, session)

    editando_outro = logado.id != usuario.id
    if editando_outro and usuario.papel == Papel.ALUNO and usuario.primeiro_acesso_em:
        raise HTTPException(
            status_code=403,
            detail=(
                "Este aluno já ativou a conta e agora é ele quem mantém o "
                "próprio cadastro. Peça a ele para atualizar em Minha conta."
            ),
        )

    # Telefone é exigência do cadastro de aluno, não do perfil do personal —
    # por isso a checagem é aqui, onde se sabe o papel de quem está sendo
    # editado, e não no schema, que serve aos dois casos.
    if usuario.papel == Papel.ALUNO and not dados.telefone:
        raise HTTPException(status_code=400, detail="Informe o telefone do aluno")
    if usuario.papel == Papel.ALUNO and not dados.data_nascimento:
        raise HTTPException(
            status_code=400, detail="Informe a data de nascimento do aluno")

    # Editar a data para uma de menor exigiria a autorizacao que a criacao pede.
    # Vale so quando quem edita e o personal: o aluno e o proprio titular, e
    # nao teria como declarar autorizacao a respeito de si mesmo.
    if (
        editando_outro
        and usuario.papel == Papel.ALUNO
        and e_menor(dados.data_nascimento)
        and not usuario.autorizacao_responsavel_em
        and not dados.autorizacao_responsavel
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Aluno menor de idade precisa de autorizacao de um dos pais "
                "ou do responsavel legal."
            ),
        )

    email = dados.email.strip().lower()
    garantir_email_livre(email, session, ignorar_id=usuario_id)

    if dados.autorizacao_responsavel and not usuario.autorizacao_responsavel_em:
        usuario.autorizacao_responsavel_em = datetime.now(timezone.utc)

    # Papel e dono ficam de fora: o corpo do PUT não promove ninguém a personal
    # nem transfere um aluno para outra conta. `autorizacao_responsavel` também:
    # é flag de entrada e vira data acima — se entrasse aqui, o SQLModel
    # tentaria escrever uma coluna que não existe.
    campos = dados.model_dump(exclude={"papel", "autorizacao_responsavel"})
    usuario.sqlmodel_update(campos, update={"email": email})

    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return publico(usuario)

@router.put("/{usuario_id}/senha")
def trocar_senha(
    usuario_id: int,
    dados: TrocaDeSenha,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Cada um troca a sua informando a atual. O personal só mexe na de um aluno
    que ainda não ativou a conta.

    A trava é a mesma de `atualizar_usuario`, e aqui ela pesa mais: definir a
    senha de alguém é poder entrar como essa pessoa. Enquanto o aluno não
    assumiu a conta isso é suporte legítimo — foi o personal quem criou o
    acesso. Depois, deixa de ser: o caminho passa a ser "esqueci minha senha",
    que manda o link para a caixa do aluno e não para a do personal.
    """
    usuario = gerenciavel_ou_404(usuario_id, logado, session)

    if logado.id != usuario.id and usuario.papel == Papel.ALUNO and usuario.primeiro_acesso_em:
        raise HTTPException(
            status_code=403,
            detail=(
                "Este aluno já ativou a conta. Peça a ele para usar "
                "\"Esqueci minha senha\" na tela de entrada."
            ),
        )

    if logado.id == usuario_id:
        # Trocar a própria senha pede a atual mesmo sendo personal: sem isso um
        # token vazado troca a senha e toma a conta de vez, sem nada a conferir.
        if not dados.senha_atual or not conferir_senha(dados.senha_atual, usuario.senha_hash):
            raise HTTPException(status_code=400, detail="Senha atual incorreta")
    elif logado.papel != Papel.PERSONAL:
        raise HTTPException(status_code=403, detail="Você só pode trocar a sua senha")

    usuario.senha_hash = gerar_hash(dados.senha_nova)

    session.add(usuario)
    session.commit()
    return {"mensagem": "Senha atualizada"}

@router.delete("/{usuario_id}")
def desativar_usuario(
    usuario_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    """Soft delete: marca como inativo, preservando o histórico no banco."""
    usuario = gerenciavel_ou_404(usuario_id, logado, session)
    if usuario.id == logado.id:
        raise HTTPException(status_code=400, detail="Você não pode desativar a si mesmo")

    usuario.ativo = False
    session.add(usuario)
    session.commit()
    return {"mensagem": "Usuário desativado com sucesso"}

@router.post("/{usuario_id}/reativar")
def reativar_usuario(
    usuario_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    usuario = gerenciavel_ou_404(usuario_id, logado, session)

    usuario.ativo = True
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return publico(usuario)
