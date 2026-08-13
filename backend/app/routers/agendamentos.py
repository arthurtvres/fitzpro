from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.dependencias import aluno_do_tenant, personal_atual, tenant_de, usuario_atual
from app.db.session import get_session
from app.models import (
    Agendamento,
    AgendamentoCriacao,
    Papel,
    TipoAgendamento,
    Treino,
    Usuario,
    resumo,
)

router = APIRouter(prefix="/agendamentos", tags=["agendamentos"])


AGENDAMENTO_INEXISTENTE = HTTPException(
    status_code=404, detail="Agendamento não encontrado"
)


def validar_aluno(aluno_id: int, logado: Usuario, session: Session) -> Usuario:
    """O aluno precisa existir, ser deste personal e estar ativo."""
    aluno = aluno_do_tenant(aluno_id, logado, session)
    if not aluno.ativo:
        raise HTTPException(status_code=400, detail="Aluno está inativo")
    return aluno


def buscar_ou_404(agendamento_id: int, logado: Usuario, session: Session) -> Agendamento:
    """O agendamento, desde que seja de um aluno de quem pediu."""
    agendamento = session.get(Agendamento, agendamento_id)
    if not agendamento:
        raise AGENDAMENTO_INEXISTENTE

    try:
        aluno_do_tenant(agendamento.aluno_id, logado, session)
    except HTTPException:
        raise AGENDAMENTO_INEXISTENTE

    return agendamento


def validar_treino(dados: AgendamentoCriacao, session: Session):
    if dados.tipo != TipoAgendamento.TREINO:
        return
    if dados.treino_id is None:
        raise HTTPException(status_code=400, detail="Selecione um treino")

    treino = session.get(Treino, dados.treino_id)
    if not treino or treino.aluno_id != dados.aluno_id:
        raise HTTPException(status_code=400, detail="Treino não pertence ao aluno")


def serializar(agendamento: Agendamento, session: Session) -> dict:
    aluno = session.get(Usuario, agendamento.aluno_id)
    treino = session.get(Treino, agendamento.treino_id) if agendamento.treino_id else None
    return {
        **agendamento.model_dump(),
        "aluno": resumo(aluno) if aluno else None,
        "treino": treino.model_dump() if treino else None,
    }


@router.get("")
def listar_agendamentos(
    data: date | None = None,
    aluno_id: int | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    if logado.papel == Papel.ALUNO:
        aluno_id = logado.id
    elif aluno_id is not None:
        aluno_do_tenant(aluno_id, logado, session)

    consulta = (
        select(Agendamento)
        .join(Usuario, Usuario.id == Agendamento.aluno_id)
        .where(Usuario.personal_id == tenant_de(logado))
    )
    if data is not None:
        consulta = consulta.where(Agendamento.data == data)
    if aluno_id is not None:
        consulta = consulta.where(Agendamento.aluno_id == aluno_id)

    consulta = consulta.order_by(Agendamento.data, Agendamento.horario, Agendamento.id)
    return [serializar(item, session) for item in session.exec(consulta).all()]


@router.post("", status_code=201)
def criar_agendamento(
    dados: AgendamentoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    validar_aluno(dados.aluno_id, logado, session)
    validar_treino(dados, session)

    agendamento = Agendamento.model_validate(dados)
    session.add(agendamento)
    session.commit()
    session.refresh(agendamento)
    return serializar(agendamento, session)


@router.put("/{agendamento_id}")
def atualizar_agendamento(
    agendamento_id: int,
    dados: AgendamentoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    agendamento = buscar_ou_404(agendamento_id, logado, session)

    validar_aluno(dados.aluno_id, logado, session)
    validar_treino(dados, session)
    agendamento.sqlmodel_update(dados.model_dump())

    session.add(agendamento)
    session.commit()
    session.refresh(agendamento)
    return serializar(agendamento, session)


@router.delete("/{agendamento_id}")
def remover_agendamento(
    agendamento_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    agendamento = buscar_ou_404(agendamento_id, logado, session)
    session.delete(agendamento)
    session.commit()
    return {"mensagem": "Agendamento removido"}
