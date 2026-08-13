"""
O que se soma: semana, consistência, volume, frequência.

`progressao.py` continua sendo sobre **carga** — a evolução de um exercício e a
sugestão de subir. Aqui é o que se agrega ao longo do tempo, que é uma pergunta
de natureza diferente e com queries diferentes.

A regra de N+1 deste módulo: **uma consulta traz a janela inteira**, e o resto é
Python sobre o array. Agrupar por semana em SQLite exigiria aritmética de
`julianday`, ilegível e não indexável — e a janela de 12 semanas de um aluno real
tem umas 50 linhas.
"""

from datetime import date, timedelta

from sqlalchemy import case, func
from sqlmodel import Session, select

from app.models import ExecucaoExercicio, SessaoTreino, Treino
from app.services import dias as servico_dias

SEMANAS_DE_CONSISTENCIA = 4
SEMANAS_DE_JANELA = 12

def intervalo_semana(dia: date) -> tuple[date, date]:
    """Segunda a domingo da semana daquele dia."""
    inicio = dia - timedelta(days=dia.weekday())
    return inicio, inicio + timedelta(days=6)

def treinos_do_aluno(aluno_id: int, session: Session) -> list[Treino]:
    return list(
        session.exec(select(Treino).where(Treino.aluno_id == aluno_id)).all()
    )

def sessoes_no_intervalo(
    aluno_id: int, inicio: date, fim: date, session: Session
) -> list[SessaoTreino]:
    """Uma query por janela. É dela que saem semana, calendário e sequência."""
    return list(
        session.exec(
            select(SessaoTreino)
            .where(
                SessaoTreino.aluno_id == aluno_id,
                SessaoTreino.data >= inicio,
                SessaoTreino.data <= fim,
            )
            .order_by(SessaoTreino.data)
        ).all()
    )

def volume_no_intervalo(aluno_id: int, inicio: date, fim: date, session: Session) -> dict:
    """
    O volume somado do período — e **de onde ele veio**.

    A procedência viaja junto porque um total meio estimado exibido como exato é
    pior do que nenhum total. `execucoes_sem_volume` conta o que não entrou na
    soma (isometria, peso corporal), para a tela poder dizer que existe.
    """
    total, quantas, estimadas, sem_volume = session.exec(
        select(
            func.coalesce(func.sum(ExecucaoExercicio.volume_kg), 0.0),
            func.count(ExecucaoExercicio.id),
            func.sum(case((ExecucaoExercicio.volume_estimado.is_(True), 1), else_=0)),
            func.sum(case((ExecucaoExercicio.volume_kg.is_(None), 1), else_=0)),
        ).where(
            ExecucaoExercicio.aluno_id == aluno_id,
            ExecucaoExercicio.data >= inicio,
            ExecucaoExercicio.data <= fim,
        )
    ).one()

    estimadas = estimadas or 0
    return {
        "total_kg": round(total or 0, 2),
        # Basta uma parcela estimada para o total ser estimado.
        "estimado": estimadas > 0,
        "execucoes": quantas or 0,
        "execucoes_estimadas": estimadas,
        "execucoes_detalhadas": (quantas or 0) - estimadas,
        "execucoes_sem_volume": sem_volume or 0,
    }

def variacao(atual: float, anterior: float) -> int | None:
    """Variação percentual. None quando não há base — divisão por zero não é 0%."""
    if not anterior:
        return None
    return round(100 * (atual - anterior) / anterior)

def previstos_por_semana(treinos: list[Treino]) -> int:
    """
    Quantos treinos o aluno deveria fazer por semana.

    Conta **treinos**, não dias: dois treinos na segunda contam 2, que é o que
    faz "3 de 4 treinos feitos" ser literal.
    """
    return len(treinos)

def consistencia(
    aluno_id: int,
    session: Session,
    hoje: date,
    treinos: list[Treino],
    sessoes_janela: list[SessaoTreino],
) -> dict | None:
    """
    Quanto do previsto o aluno cumpriu nas últimas semanas.

    Recebe as sessões já carregadas — quem chama tem a janela de 12 semanas em
    mãos, e refazer a query aqui seria a mesma leitura duas vezes.

    Devolve None sem treino montado: "0%" para quem não tem plano seria uma
    acusação injusta, e o card some.
    """
    previstos = previstos_por_semana(treinos)
    if previstos == 0:
        return None

    inicio_atual, _ = intervalo_semana(hoje)
    primeira = inicio_atual - timedelta(weeks=SEMANAS_DE_CONSISTENCIA - 1)

    feitos = sum(1 for s in sessoes_janela if s.data >= primeira)
    total = previstos * SEMANAS_DE_CONSISTENCIA

    return {
        "percentual": min(100, round(100 * feitos / total)) if total else 0,
        "semanas": SEMANAS_DE_CONSISTENCIA,
        "feitos": feitos,
        "previstos": total,
        "sequencia_semanas": sequencia_semanas(hoje, treinos, sessoes_janela),
    }

def sequencia_semanas(
    hoje: date, treinos: list[Treino], sessoes_janela: list[SessaoTreino]
) -> int:
    """
    Semanas seguidas em que o aluno treinou pelo menos uma vez.

    A semana corrente **não quebra a sequência** se ainda estiver vazia — é
    quarta-feira, ainda dá tempo. Contar o zero de hoje como falha puniria quem
    abriu o app na segunda de manhã.
    """
    if not treinos:
        return 0

    por_semana = set()
    for sessao in sessoes_janela:
        inicio, _ = intervalo_semana(sessao.data)
        por_semana.add(inicio)

    inicio_atual, _ = intervalo_semana(hoje)
    sequencia = 0
    cursor = inicio_atual

    if cursor not in por_semana:
        cursor -= timedelta(weeks=1)  # semana corrente ainda em aberto

    while cursor in por_semana:
        sequencia += 1
        cursor -= timedelta(weeks=1)

    return sequencia

def calendario_semana(
    hoje: date, treinos: list[Treino], sessoes_janela: list[SessaoTreino]
) -> dict:
    """
    Os 7 dias da semana, com o estado de cada um.

    Montado **no servidor** de propósito: "previsto" depende do `dia_semana`
    normalizado, e o cliente já errou essa comparação uma vez — era o bug que
    fazia um treino gravado como "terca" sumir da tela do aluno.

    Estados: `feito` (tem sessão), `hoje`, `previsto` (futuro com treino),
    `perdido` (passado com treino e sem sessão) e `vazio`.
    """
    inicio, fim = intervalo_semana(hoje)

    por_dia: dict[str, list[Treino]] = {}
    for treino in treinos:
        por_dia.setdefault(treino.dia_semana, []).append(treino)

    sessoes_da_semana = [s for s in sessoes_janela if inicio <= s.data <= fim]
    contagem: dict[date, int] = {}
    for sessao in sessoes_da_semana:
        contagem[sessao.data] = contagem.get(sessao.data, 0) + 1

    lista = []
    for indice in range(7):
        dia = inicio + timedelta(days=indice)
        canonico = servico_dias.DIAS[indice]
        do_dia = por_dia.get(canonico, [])
        feitas = contagem.get(dia, 0)

        if feitas:
            estado = "feito"
        elif dia == hoje:
            estado = "hoje"
        elif not do_dia:
            estado = "vazio"
        elif dia < hoje:
            estado = "perdido"
        else:
            estado = "previsto"

        lista.append(
            {
                "indice": indice,
                "dia_semana": canonico,
                "sigla": servico_dias.SIGLAS[canonico],
                "data": dia,
                "estado": estado,
                "sessoes": feitas,
                "treinos": [{"id": t.id, "nome": t.nome} for t in do_dia],
            }
        )

    return {
        "inicio": inicio,
        "fim": fim,
        "feitos": len(sessoes_da_semana),
        "previstos": previstos_por_semana(treinos),
        "dias": lista,
    }

def resumo_de_sessoes(sessao_ids: list[int], session: Session) -> dict[int, dict]:
    """
    Exercícios, séries e volume de várias sessões — **numa query só**.

    Serve tanto ao card "Último treino" quanto ao "Última vez" de cada treino de
    hoje. Uma busca por sessão seria N+1 na tela inicial.
    """
    if not sessao_ids:
        return {}

    linhas = session.exec(
        select(
            ExecucaoExercicio.sessao_id,
            func.count(ExecucaoExercicio.id),
            func.coalesce(func.sum(ExecucaoExercicio.series_feitas), 0),
            func.coalesce(func.sum(ExecucaoExercicio.volume_kg), 0.0),
            func.sum(case((ExecucaoExercicio.volume_estimado.is_(True), 1), else_=0)),
        )
        .where(ExecucaoExercicio.sessao_id.in_(sessao_ids))
        .group_by(ExecucaoExercicio.sessao_id)
    ).all()

    return {
        sessao_id: {
            "exercicios": exercicios,
            "series": series,
            "volume_kg": round(volume or 0, 2) or None,
            "volume_estimado": bool(estimadas),
        }
        for sessao_id, exercicios, series, volume, estimadas in linhas
    }

def ultima_sessao_por_treino(
    aluno_id: int, treino_ids: list[int], antes_de: date, session: Session
) -> dict[int, SessaoTreino]:
    """A sessão mais recente de cada treino, anterior ao dia informado."""
    if not treino_ids:
        return {}

    sessoes = session.exec(
        select(SessaoTreino)
        .where(
            SessaoTreino.aluno_id == aluno_id,
            SessaoTreino.treino_id.in_(treino_ids),
            SessaoTreino.data < antes_de,
        )
        .order_by(SessaoTreino.data.desc())
    ).all()

    mais_recentes: dict[int, SessaoTreino] = {}
    for sessao in sessoes:
        mais_recentes.setdefault(sessao.treino_id, sessao)
    return mais_recentes

def ultima_sessao(aluno_id: int, session: Session) -> SessaoTreino | None:
    """A última ida à academia, de qualquer treino."""
    return session.exec(
        select(SessaoTreino)
        .where(SessaoTreino.aluno_id == aluno_id)
        .order_by(SessaoTreino.data.desc(), SessaoTreino.iniciada_em.desc())
    ).first()
