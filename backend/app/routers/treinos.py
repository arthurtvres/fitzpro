from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.services import catalogo, progressao
from app.db.session import get_session
from app.core.dependencias import aluno_do_tenant, personal_atual, tenant_de, usuario_atual
from app.models import (
    ExecucaoExercicio,
    Papel,
    Treino,
    TreinoCriacao,
    TreinoExercicio,
    TreinoExercicioCriacao,
    Usuario,
)

router = APIRouter(prefix="/treinos", tags=["treinos"])

TREINO_INEXISTENTE = HTTPException(status_code=404, detail="Treino não encontrado")

def validar_aluno(aluno_id: int, logado: Usuario, session: Session):
    """O aluno precisa existir, ser deste personal e estar ativo."""
    aluno = aluno_do_tenant(aluno_id, logado, session)
    if not aluno.ativo:
        raise HTTPException(status_code=400, detail="Aluno está inativo")

def buscar_ou_404(treino_id: int, logado: Usuario, session: Session) -> Treino:
    """
    O treino, desde que seja de um aluno de quem pediu.

    Treino não tem dono próprio — o dono é o do aluno. Passar por aqui é o que
    impede alguém de chegar num treino alheio pelo id, inclusive pelas rotas de
    exercício, que antes só conferiam se o treino existia.
    """
    treino = session.get(Treino, treino_id)
    if not treino:
        raise TREINO_INEXISTENTE

    try:
        aluno_do_tenant(treino.aluno_id, logado, session)
    except HTTPException:
        # "Aluno não encontrado" confundiria quem pediu um treino: para quem
        # está de fora do tenant, o que não existe é o treino.
        raise TREINO_INEXISTENTE

    return treino

def exercicios_do_treino(treino_id: int, session: Session) -> list[TreinoExercicio]:
    consulta = (
        select(TreinoExercicio)
        .where(TreinoExercicio.treino_id == treino_id)
        .order_by(TreinoExercicio.ordem)
    )
    return list(session.exec(consulta).all())

@router.get("")
def listar_treinos(
    aluno_id: int | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    # O aluno logado só enxerga os treinos dele, peça o que pedir.
    if logado.papel == Papel.ALUNO:
        aluno_id = logado.id

    # O join com usuario é o que restringe ao tenant: sem ele a listagem
    # devolveria os treinos dos alunos de todos os personais.
    consulta = (
        select(Treino)
        .join(Usuario, Usuario.id == Treino.aluno_id)
        .where(Usuario.personal_id == tenant_de(logado))
    )
    if aluno_id is not None:
        consulta = consulta.where(Treino.aluno_id == aluno_id)
    treinos = session.exec(consulta).all()

    # Uma consulta agregada para todos: a lista mostra quantos exercícios cada
    # treino tem, e uma contagem por treino seria N+1.
    contagens = dict(
        session.exec(
            select(TreinoExercicio.treino_id, func.count(TreinoExercicio.id)).group_by(
                TreinoExercicio.treino_id
            )
        ).all()
    )

    # Mesma ideia para o que já foi feito hoje: sem esta agregada, a tela "Hoje"
    # do aluno pediria o progresso de cada treino separadamente.
    hoje = date.today()
    feitos_hoje = dict(
        session.exec(
            select(ExecucaoExercicio.treino_id, func.count(ExecucaoExercicio.id))
            .where(ExecucaoExercicio.data == hoje)
            .group_by(ExecucaoExercicio.treino_id)
        ).all()
    )

    return [
        {
            **treino.model_dump(),
            "total_exercicios": contagens.get(treino.id, 0),
            "concluidos_hoje": feitos_hoje.get(treino.id, 0),
        }
        for treino in treinos
    ]

@router.post("")
def criar_treino(
    treino: TreinoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    validar_aluno(treino.aluno_id, logado, session)

    novo_treino = Treino.model_validate(treino)
    session.add(novo_treino)
    session.commit()
    session.refresh(novo_treino)
    return novo_treino

@router.get("/{treino_id}")
def buscar_treino(
    treino_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    treino = buscar_ou_404(treino_id, logado, session)
    return {
        **treino.model_dump(),
        "total_exercicios": len(exercicios_do_treino(treino_id, session)),
    }

@router.put("/{treino_id}")
def atualizar_treino(
    treino_id: int,
    dados: TreinoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    treino = buscar_ou_404(treino_id, logado, session)

    validar_aluno(dados.aluno_id, logado, session)
    treino.sqlmodel_update(dados.model_dump())

    session.add(treino)
    session.commit()
    session.refresh(treino)
    return treino

@router.delete("/{treino_id}")
def deletar_treino(
    treino_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    treino = buscar_ou_404(treino_id, logado, session)

    # Apagar a prescrição apaga o plano, nunca o passado: as execuções perdem o
    # vínculo com o treino, mas continuam contando na evolução de carga do aluno.
    progressao.desvincular_execucoes(session, treino_id=treino_id)

    # O SQLite não cascateia por padrão: sem isso as prescrições ficariam órfãs.
    for item in exercicios_do_treino(treino_id, session):
        session.delete(item)

    session.delete(treino)
    session.commit()
    return {"mensagem": "Treino removido com sucesso"}

# ---------- exercícios do treino ----------

def _com_catalogo(item: TreinoExercicio) -> dict:
    """Junta a prescrição salva com os dados do exercício no catálogo."""
    return {**item.model_dump(), "exercicio": catalogo.resumo(item.exercicio_id)}

def _renumerar(treino_id: int, session: Session):
    """Reescreve ordem como 0,1,2... para não deixar buracos depois de remover."""
    for posicao, item in enumerate(exercicios_do_treino(treino_id, session)):
        item.ordem = posicao
        session.add(item)

@router.get("/{treino_id}/exercicios")
def listar_exercicios_do_treino(
    treino_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    buscar_ou_404(treino_id, logado, session)
    return [_com_catalogo(item) for item in exercicios_do_treino(treino_id, session)]

@router.post("/{treino_id}/exercicios")
def adicionar_exercicio(
    treino_id: int,
    dados: TreinoExercicioCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    buscar_ou_404(treino_id, logado, session)
    if not catalogo.existe(dados.exercicio_id):
        raise HTTPException(status_code=404, detail="Exercício não encontrado")

    existentes = exercicios_do_treino(treino_id, session)
    novo = TreinoExercicio.model_validate(
        dados, update={"treino_id": treino_id, "ordem": len(existentes)}
    )

    session.add(novo)
    session.commit()
    session.refresh(novo)
    return _com_catalogo(novo)

# Precisa vir antes de /{item_id}, senão "ordem" é lido como um id.
@router.put("/{treino_id}/exercicios/ordem")
def reordenar_exercicios(
    treino_id: int,
    ids: list[int],
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    """Recebe os ids das prescrições na nova ordem, de cima para baixo."""
    buscar_ou_404(treino_id, logado, session)

    itens = {item.id: item for item in exercicios_do_treino(treino_id, session)}
    if set(ids) != set(itens):
        raise HTTPException(
            status_code=400,
            detail="A lista de ids precisa conter exatamente os exercícios do treino",
        )

    for posicao, item_id in enumerate(ids):
        itens[item_id].ordem = posicao
        session.add(itens[item_id])

    session.commit()
    return [_com_catalogo(item) for item in exercicios_do_treino(treino_id, session)]

@router.put("/{treino_id}/exercicios/{item_id}")
def atualizar_exercicio(
    treino_id: int,
    item_id: int,
    dados: TreinoExercicioCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    buscar_ou_404(treino_id, logado, session)

    item = session.get(TreinoExercicio, item_id)
    if not item or item.treino_id != treino_id:
        raise HTTPException(status_code=404, detail="Exercício não encontrado no treino")
    if not catalogo.existe(dados.exercicio_id):
        raise HTTPException(status_code=404, detail="Exercício não encontrado")

    item.sqlmodel_update(dados.model_dump())

    session.add(item)
    session.commit()
    session.refresh(item)
    return _com_catalogo(item)

@router.delete("/{treino_id}/exercicios/{item_id}")
def remover_exercicio(
    treino_id: int,
    item_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    buscar_ou_404(treino_id, logado, session)

    item = session.get(TreinoExercicio, item_id)
    if not item or item.treino_id != treino_id:
        raise HTTPException(status_code=404, detail="Exercício não encontrado no treino")

    # O histórico de carga deste exercício sobrevive à remoção da prescrição.
    progressao.desvincular_execucoes(session, treino_exercicio_id=item_id)

    session.delete(item)
    session.commit()

    _renumerar(treino_id, session)
    session.commit()
    return {"mensagem": "Exercício removido do treino"}
