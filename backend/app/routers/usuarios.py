import secrets

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
from app.models import (
    FinalidadeDoToken,
    Papel,
    TrocaDeSenha,
    Usuario,
    UsuarioAtualizacao,
    UsuarioCriacao,
    cartao_de_contato,
    publico,
)
from app.services import convite

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

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
    return [publico(u) for u in session.exec(consulta).all()]

@router.post("", status_code=201)
def criar_usuario(
    dados: UsuarioCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    email = dados.email.strip().lower()
    garantir_email_livre(email, session)

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

    convite.enviar(aluno, logado, session)
    return {"detail": "Convite reenviado."}

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
    O personal edita a si mesmo e aos alunos dele; o aluno, só a si mesmo.

    Era `personal_atual`, o que deixava o aluno sem como corrigir o próprio
    cadastro. Quem separa os casos é `gerenciavel_ou_404`: para o aluno logado,
    qualquer id que não seja o dele já cai em 404.
    """
    usuario = gerenciavel_ou_404(usuario_id, logado, session)

    # Telefone é exigência do cadastro de aluno, não do perfil do personal —
    # por isso a checagem é aqui, onde se sabe o papel de quem está sendo
    # editado, e não no schema, que serve aos dois casos.
    if usuario.papel == Papel.ALUNO and not dados.telefone:
        raise HTTPException(status_code=400, detail="Informe o telefone do aluno")

    email = dados.email.strip().lower()
    garantir_email_livre(email, session, ignorar_id=usuario_id)

    # Papel e dono ficam de fora: o corpo do PUT não promove ninguém a personal
    # nem transfere um aluno para outra conta.
    campos = dados.model_dump(exclude={"papel"})
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
    """O personal redefine a de um aluno seu; cada um troca a sua informando a atual."""
    usuario = gerenciavel_ou_404(usuario_id, logado, session)

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
