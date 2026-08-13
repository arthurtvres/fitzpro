from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.db.session import get_session
from app.core.dependencias import aluno_do_tenant, personal_atual, tenant_de, usuario_atual
from app.models import Dieta, DietaCriacao, ExecucaoRefeicao, Papel, Usuario
from app.services import plano_alimentar, progressao

router = APIRouter(prefix="/dietas", tags=["dietas"])

DIETA_INEXISTENTE = HTTPException(status_code=404, detail="Dieta não encontrada")

def validar_aluno(aluno_id: int, logado: Usuario, session: Session):
    """O aluno precisa existir, ser deste personal e estar ativo."""
    aluno = aluno_do_tenant(aluno_id, logado, session)
    if not aluno.ativo:
        raise HTTPException(status_code=400, detail="Aluno está inativo")

def buscar_ou_404(dieta_id: int, logado: Usuario, session: Session) -> Dieta:
    """
    A dieta, desde que seja de um aluno de quem pediu.

    Dieta não tem dono próprio — o dono é o do aluno. Fora deste caminho não há
    como chegar numa dieta pelo id.
    """
    dieta = session.get(Dieta, dieta_id)
    if not dieta:
        raise DIETA_INEXISTENTE

    try:
        aluno_do_tenant(dieta.aluno_id, logado, session)
    except HTTPException:
        # Para quem está fora do tenant, o que não existe é a dieta.
        raise DIETA_INEXISTENTE

    return dieta

@router.get("")
def listar_dietas(
    aluno_id: int | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    # O aluno logado só enxerga as dietas dele, peça o que pedir.
    if logado.papel == Papel.ALUNO:
        aluno_id = logado.id

    # O join com usuario é o que restringe ao tenant.
    consulta = (
        select(Dieta)
        .join(Usuario, Usuario.id == Dieta.aluno_id)
        .where(Usuario.personal_id == tenant_de(logado))
    )
    if aluno_id is not None:
        consulta = consulta.where(Dieta.aluno_id == aluno_id)
    dietas = session.exec(consulta).all()

    # Uma agregada para o que já foi consumido hoje, pelo mesmo motivo da
    # contagem em `listar_treinos`: a tela "Hoje" não pode pedir dieta a dieta.
    hoje = date.today()
    feitas_hoje = dict(
        session.exec(
            select(ExecucaoRefeicao.dieta_id, func.count(ExecucaoRefeicao.id))
            .where(ExecucaoRefeicao.data == hoje)
            .group_by(ExecucaoRefeicao.dieta_id)
        ).all()
    )
    calorias_hoje = dict(
        session.exec(
            select(ExecucaoRefeicao.dieta_id, func.sum(ExecucaoRefeicao.calorias))
            .where(ExecucaoRefeicao.data == hoje)
            .group_by(ExecucaoRefeicao.dieta_id)
        ).all()
    )

    # Passa a devolver dicts, e não os objetos crus: nenhum campo some, e é o
    # mesmo formato de `listar_treinos`.
    return [
        {
            **dieta.model_dump(),
            "total_refeicoes": len(plano_alimentar.refeicoes(dieta.descricao)),
            "refeicoes_concluidas_hoje": feitas_hoje.get(dieta.id, 0),
            "calorias_consumidas_hoje": calorias_hoje.get(dieta.id, 0) or 0,
        }
        for dieta in dietas
    ]

@router.post("")
def criar_dieta(
    dieta: DietaCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    validar_aluno(dieta.aluno_id, logado, session)

    nova_dieta = Dieta.model_validate(dieta)
    session.add(nova_dieta)
    session.commit()
    session.refresh(nova_dieta)
    return nova_dieta

@router.get("/{dieta_id}")
def buscar_dieta(
    dieta_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    return buscar_ou_404(dieta_id, logado, session)

@router.put("/{dieta_id}")
def atualizar_dieta(
    dieta_id: int,
    dados: DietaCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    dieta = buscar_ou_404(dieta_id, logado, session)

    validar_aluno(dados.aluno_id, logado, session)
    dieta.sqlmodel_update(dados.model_dump())

    session.add(dieta)
    session.commit()
    session.refresh(dieta)
    return dieta

@router.delete("/{dieta_id}")
def deletar_dieta(
    dieta_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    dieta = buscar_ou_404(dieta_id, logado, session)

    # As refeições já consumidas continuam valendo no histórico do aluno.
    progressao.desvincular_execucoes(session, dieta_id=dieta_id)

    session.delete(dieta)
    session.commit()
    return {"mensagem": "Dieta removida com sucesso"}
