"""
A visão do personal sobre todos os alunos dele de uma vez.

`progressao.py` responde sobre **um** aluno — é a tela do aluno e a aba de
progressão dentro do detalhe. Aqui a pergunta é outra, e é a que sustenta a
renovação do personal: *meus alunos estão treinando?*

A regra de ouro deste módulo é não ter query por aluno. Tudo passa por funções
de `desempenho.py` que recebem a lista de ids e devolvem dicionários indexados —
com 30 alunos, a tela sai em ~7 consultas, e não em 30.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.dependencias import personal_atual, tenant_de
from app.db.session import get_session
from app.models import ExecucaoExercicio, Papel, Treino, TreinoExercicio, Usuario, resumo
from app.services import catalogo, desempenho, progressao

router = APIRouter(prefix="/painel", tags=["painel"])

# Quantas sugestões de carga cabem na tela antes de virar lista sem fim.
MAXIMO_SUGESTOES = 8

# A janela de "Atividade dos alunos". Móvel, não segunda-a-domingo — ver
# `desempenho.intervalo_ultimos_dias`.
DIAS_DE_ATIVIDADE = 7

@router.get("/resumo")
def resumo_do_personal(
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    """
    A semana do personal: quem treinou, quem sumiu e onde dá para subir carga.

    Todo número aqui é de execução registrada — nada de contagem de cadastro.
    "18 treinos esta semana" é 18 sessões que aconteceram, não 18 treinos
    montados.
    """
    hoje = data or date.today()
    tenant = tenant_de(logado)

    alunos = session.exec(
        select(Usuario).where(
            Usuario.personal_id == tenant,
            Usuario.papel == Papel.ALUNO,
            Usuario.ativo,
        )
    ).all()
    ids = [a.id for a in alunos]

    inicio, fim = desempenho.intervalo_ultimos_dias(hoje, DIAS_DE_ATIVIDADE)
    inicio_anterior = inicio - timedelta(days=DIAS_DE_ATIVIDADE)
    fim_anterior = inicio - timedelta(days=1)

    # Sete consultas para a tela inteira, independentemente de quantos alunos.
    sessoes = desempenho.sessoes_por_aluno(ids, inicio, fim, session)
    sessoes_anteriores = desempenho.sessoes_por_aluno(
        ids, inicio_anterior, fim_anterior, session
    )
    treinos = desempenho.treinos_por_aluno(ids, session)
    volumes = desempenho.volume_por_aluno(ids, inicio, fim, session)
    volumes_anteriores = desempenho.volume_por_aluno(
        ids, inicio_anterior, fim_anterior, session
    )
    ultimas = desempenho.ultima_sessao_por_aluno(ids, session)
    sugestoes = _sugestoes_do_tenant(ids, session)

    feitos = sum(len(s) for s in sessoes.values())
    feitos_antes = sum(len(s) for s in sessoes_anteriores.values())
    volume_semana = round(sum(v["total_kg"] for v in volumes.values()), 2)
    volume_antes = round(sum(v["total_kg"] for v in volumes_anteriores.values()), 2)

    linhas = []
    for aluno in alunos:
        do_aluno = sessoes.get(aluno.id, [])
        previstos = len(treinos.get(aluno.id, []))
        ultima = ultimas.get(aluno.id)

        linhas.append(
            {
                "aluno": resumo(aluno),
                "previstos": previstos,
                "feitos": len(do_aluno),
                "percentual": desempenho.percentual_ou_zero(len(do_aluno), previstos),
                "ultima_sessao": ultima.data if ultima else None,
                "ultima_sessao_em": _com_fuso(ultima.iniciada_em) if ultima else None,
                "dias_sem_treinar": (hoje - ultima.data).days if ultima else None,
                "prontos_para_subir": len(
                    [s for s in sugestoes if s["aluno_id"] == aluno.id]
                ),
                "situacao": desempenho.situacao(hoje, previstos, len(do_aluno), ultima),
            }
        )

    # Quem precisa de atenção primeiro. Dentro de cada grupo, quem está há mais
    # tempo sem aparecer — é a ordem em que o personal agiria.
    ordem = {"sumido": 0, "sem_registro": 1, "atencao": 2, "em_dia": 3}
    linhas.sort(
        key=lambda l: (ordem[l["situacao"]], -(l["dias_sem_treinar"] or 0))
    )

    treinaram = len([s for s in sessoes.values() if s])
    return {
        "data": hoje,
        "periodo": {
            "dias": DIAS_DE_ATIVIDADE,
            "inicio": inicio,
            "fim": fim,
            "sessoes": feitos,
            "sessoes_anterior": feitos_antes,
            "variacao_percentual": desempenho.variacao(feitos, feitos_antes),
            "alunos_que_treinaram": treinaram,
            "alunos_ativos": len(alunos),
            "percentual_ativos": desempenho.percentual_ou_zero(treinaram, len(alunos)),
        },
        "volume": {
            "total_kg": volume_semana,
            "anterior_kg": volume_antes,
            "variacao_percentual": desempenho.variacao(volume_semana, volume_antes),
            "estimado": any(v["estimado"] for v in volumes.values()),
        },
        "alunos": linhas,
        "sugestoes": sugestoes[:MAXIMO_SUGESTOES],
        "total_sugestoes": len(sugestoes),
    }

def _com_fuso(momento: datetime) -> datetime:
    """
    Carimba UTC no que volta do banco, para o navegador poder converter.

    `iniciada_em` é gravado com `datetime.now(timezone.utc)`, mas o SQLite não
    guarda offset: o que volta é ingênuo. Serializado assim, o navegador leria
    como hora local e mostraria "Hoje, 05:42" para um treino das 08:42. O
    `+00:00` explícito é o que faz a hora na tela ser a hora do aluno.
    """
    return momento if momento.tzinfo else momento.replace(tzinfo=timezone.utc)

def _sugestoes_do_tenant(aluno_ids: list[int], session: Session) -> list[dict]:
    """
    Todas as prescrições prontas para subir carga, de todos os alunos.

    Duas consultas para o tenant inteiro: uma traz as prescrições, outra o
    histórico. O agrupamento é em Python — pedir por aluno seria N+1 justamente
    na tela que existe para olhar muitos alunos ao mesmo tempo.
    """
    if not aluno_ids:
        return []

    prescricoes = session.exec(
        select(TreinoExercicio, Treino)
        .join(Treino, Treino.id == TreinoExercicio.treino_id)
        .where(Treino.aluno_id.in_(aluno_ids))
    ).all()
    if not prescricoes:
        return []

    execucoes = session.exec(
        select(ExecucaoExercicio)
        .where(
            ExecucaoExercicio.aluno_id.in_(aluno_ids),
            ExecucaoExercicio.exercicio_id.in_(
                [p.exercicio_id for p, _ in prescricoes]
            ),
        )
        .order_by(ExecucaoExercicio.data.desc(), ExecucaoExercicio.id.desc())
    ).all()

    historico: dict[tuple[int, str], list] = {}
    for execucao in execucoes:
        historico.setdefault((execucao.aluno_id, execucao.exercicio_id), []).append(
            execucao
        )

    nomes = {a.id: a.nome for a in session.exec(
        select(Usuario).where(Usuario.id.in_(aluno_ids))
    ).all()}

    achados = []
    for prescricao, treino in prescricoes:
        avaliacao = progressao.avaliar(
            prescricao.carga_kg,
            historico.get((treino.aluno_id, prescricao.exercicio_id), []),
        )
        if not avaliacao["pronto_para_subir"]:
            continue

        achados.append(
            {
                "aluno_id": treino.aluno_id,
                "aluno_nome": nomes.get(treino.aluno_id, ""),
                "treino_id": treino.id,
                "treino_nome": treino.nome,
                "treino_exercicio_id": prescricao.id,
                "exercicio_id": prescricao.exercicio_id,
                "exercicio": catalogo.resumo(prescricao.exercicio_id),
                "carga_prescrita_kg": prescricao.carga_kg,
                "ultima_carga_kg": avaliacao["ultima_carga_kg"],
                "sessoes_no_alvo": avaliacao["sessoes_no_alvo"],
            }
        )

    # Quem tem mais sessões seguidas no alvo está esperando há mais tempo.
    achados.sort(key=lambda s: -s["sessoes_no_alvo"])
    return achados
