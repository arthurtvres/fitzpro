from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.dependencias import aluno_do_tenant, personal_atual, usuario_atual
from app.db.session import get_session
from app.models import Avaliacao, AvaliacaoCriacao, Papel, Usuario, imc

router = APIRouter(prefix="/alunos/{aluno_id}/avaliacoes", tags=["avaliacoes"])

def validar_aluno(aluno_id: int, logado: Usuario, session: Session) -> Usuario:
    """O aluno da URL, desde que pertença a quem pediu."""
    return aluno_do_tenant(aluno_id, logado, session)

def com_imc(avaliacao: Avaliacao, aluno: Usuario) -> dict:
    """O IMC não é guardado: sai das medidas da avaliação."""
    altura = avaliacao.altura_cm or aluno.altura_cm
    return {**avaliacao.model_dump(), "imc": imc(avaliacao.peso_kg, altura)}

@router.get("")
def listar_avaliacoes(
    aluno_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """Da mais recente para a mais antiga."""
    aluno = validar_aluno(aluno_id, logado, session)

    consulta = (
        select(Avaliacao)
        .where(Avaliacao.aluno_id == aluno_id)
        .order_by(Avaliacao.data.desc(), Avaliacao.id.desc())
    )
    return [com_imc(a, aluno) for a in session.exec(consulta).all()]

@router.post("", status_code=201)
def criar_avaliacao(
    aluno_id: int,
    dados: AvaliacaoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    aluno = validar_aluno(aluno_id, logado, session)

    nova = Avaliacao.model_validate(dados, update={"aluno_id": aluno_id})

    session.add(nova)
    session.commit()
    session.refresh(nova)
    return com_imc(nova, aluno)

@router.put("/{avaliacao_id}")
def atualizar_avaliacao(
    aluno_id: int,
    avaliacao_id: int,
    dados: AvaliacaoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    aluno = validar_aluno(aluno_id, logado, session)

    avaliacao = session.get(Avaliacao, avaliacao_id)
    if not avaliacao or avaliacao.aluno_id != aluno_id:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    avaliacao.sqlmodel_update(dados.model_dump())

    session.add(avaliacao)
    session.commit()
    session.refresh(avaliacao)
    return com_imc(avaliacao, aluno)

@router.delete("/{avaliacao_id}")
def deletar_avaliacao(
    aluno_id: int,
    avaliacao_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    # Sem isto o id do aluno na URL não é conferido contra o tenant, e bastaria
    # acertar o par (aluno, avaliação) de outra conta para apagar o registro.
    validar_aluno(aluno_id, logado, session)

    avaliacao = session.get(Avaliacao, avaliacao_id)
    if not avaliacao or avaliacao.aluno_id != aluno_id:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    session.delete(avaliacao)
    session.commit()
    return {"mensagem": "Avaliação removida"}
