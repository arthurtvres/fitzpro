"""
A leitura do histórico: evolução de carga e a sugestão de subir.

Só leitura — nenhuma rota aqui altera prescrição. `pronto_para_subir` é um sinal
para o personal, não um comando: quem decide se a carga sobe é ele, que sabe se
o aluno bateu o alvo com técnica ou empurrando com o corpo.
"""

import statistics
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.dependencias import aluno_do_tenant, usuario_atual
from app.db.session import get_session
from app.models import (
    Avaliacao,
    SessaoTreino,
    Dieta,
    ExecucaoExercicio,
    ExecucaoRefeicao,
    Treino,
    TreinoExercicio,
    Usuario,
    cartao_de_contato,
    imc,
)
from app.services import catalogo, desempenho, plano_alimentar, progressao
from app.services import dias as servico_dias
from app.services import series as servico_series
from app.services import sessao as servico_sessao

router = APIRouter(prefix="/alunos/{aluno_id}/progressao", tags=["progressao"])

# Duração estimada de um treino que nunca foi feito: nem toda tela pode
# esperar o aluno criar histórico. Uma série leva a execução mais o descanso, e
# o aquecimento não pertence a nenhuma delas. São chutes honestos, e a resposta
# diz quando o número veio daqui em vez de vir do relógio (`estimada`).
SEGUNDOS_POR_SERIE = 150
SEGUNDOS_DE_AQUECIMENTO = 300

# Quantas sessões passadas entram na mediana de duração. Poucas demais e uma ida
# atípica domina; muitas demais e o número para de acompanhar o aluno que mudou
# de ritmo. A mediana, e não a média, é o que impede uma sessão esquecida aberta
# de inflar tudo.
SESSOES_PARA_DURACAO = 5

# Quantos exercícios aparecem no cartão antes do "+N".
PREVIA_DE_EXERCICIOS = 3

# Quantos dias um recorde continua sendo novidade na Home. Passado isso ele vira
# só um número no histórico — troféu permanente vira ruído.
DIAS_DE_RECORDE_RECENTE = 7

def _total_exercicios(treino_id: int, session: Session) -> int:
    return session.exec(
        select(func.count(TreinoExercicio.id)).where(
            TreinoExercicio.treino_id == treino_id
        )
    ).one()

def _concluidos_por_treino(aluno_id: int, dia: date, session: Session) -> dict[int, int]:
    """Uma agregada para todos os treinos do dia, não uma por treino."""
    return dict(
        session.exec(
            select(ExecucaoExercicio.treino_id, func.count(ExecucaoExercicio.id))
            .where(
                ExecucaoExercicio.aluno_id == aluno_id,
                ExecucaoExercicio.data == dia,
            )
            .group_by(ExecucaoExercicio.treino_id)
        ).all()
    )

def _carga_destaque(aluno_id: int, session: Session) -> dict | None:
    """
    O exercício com mais histórico — o que rende o gráfico mais informativo.

    Escolhido por número de execuções, e não pela carga mais alta: o card serve
    para mostrar evolução, e evolução precisa de pontos.
    """
    linha = session.exec(
        select(ExecucaoExercicio.exercicio_id, func.count(ExecucaoExercicio.id))
        .where(
            ExecucaoExercicio.aluno_id == aluno_id,
            ExecucaoExercicio.carga_kg.is_not(None),
        )
        .group_by(ExecucaoExercicio.exercicio_id)
        .order_by(func.count(ExecucaoExercicio.id).desc())
    ).first()

    if not linha:
        return None

    exercicio_id, _ = linha
    execucoes = progressao.execucoes_do_exercicio(aluno_id, exercicio_id, session)
    if not execucoes:
        return None

    cronologicas = list(reversed(execucoes))
    primeira = cronologicas[0].carga_kg
    atual = cronologicas[-1].carga_kg

    return {
        "exercicio_id": exercicio_id,
        "exercicio": catalogo.resumo(exercicio_id),
        "atual_kg": atual,
        "delta_kg": (
            round(atual - primeira, 2) if atual is not None and primeira is not None else None
        ),
        "pontos": [
            {"data": e.data, "carga_kg": e.carga_kg}
            for e in cronologicas
            if e.carga_kg is not None
        ],
    }

def _evolucao_corporal(aluno_id: int, session: Session) -> dict | None:
    """As duas avaliações mais recentes, viradas em valor + variação."""
    avaliacoes = session.exec(
        select(Avaliacao)
        .where(Avaliacao.aluno_id == aluno_id)
        .order_by(Avaliacao.data.desc(), Avaliacao.id.desc())
        .limit(2)
    ).all()

    if not avaliacoes:
        return None

    atual = avaliacoes[0]
    anterior = avaliacoes[1] if len(avaliacoes) > 1 else None
    aluno = session.get(Usuario, aluno_id)

    def campo(nome):
        valor = getattr(atual, nome)
        base = getattr(anterior, nome) if anterior else None
        return {
            "valor": valor,
            "delta": (
                round(valor - base, 2) if valor is not None and base is not None else None
            ),
        }

    return {
        "data": atual.data,
        "data_anterior": anterior.data if anterior else None,
        "peso_kg": campo("peso_kg"),
        "percentual_gordura": campo("percentual_gordura"),
        "massa_muscular_kg": campo("massa_muscular_kg"),
        "imc": imc(atual.peso_kg, atual.altura_cm or (aluno.altura_cm if aluno else None)),
    }

def _dieta_de_hoje(aluno_id: int, dia: date, session: Session) -> dict | None:
    dieta = session.exec(select(Dieta).where(Dieta.aluno_id == aluno_id)).first()
    if not dieta:
        return None

    refeicoes = plano_alimentar.refeicoes(dieta.descricao)
    feitas = session.exec(
        select(
            func.count(ExecucaoRefeicao.id),
            func.coalesce(func.sum(ExecucaoRefeicao.calorias), 0),
        ).where(
            ExecucaoRefeicao.aluno_id == aluno_id,
            ExecucaoRefeicao.dieta_id == dieta.id,
            ExecucaoRefeicao.data == dia,
        )
    ).one()

    return {
        "dieta_id": dieta.id,
        "nome": dieta.nome,
        "calorias_meta": dieta.calorias,
        "calorias_consumidas": feitas[1] or 0,
        "refeicoes_concluidas": feitas[0] or 0,
        "total_refeicoes": len(refeicoes),
    }

def _recorde_recente(aluno_id: int, hoje: date, sessoes, session: Session) -> dict | None:
    """
    **No máximo um** recorde, e só se for dos últimos dias.

    Moderação é requisito, não detalhe: troféu em toda tela é como esse tipo de
    feature perde o sentido. Um card, dos últimos 7 dias, e só.
    """
    limite = hoje - timedelta(days=DIAS_DE_RECORDE_RECENTE)
    recentes = [s for s in sessoes if s.data >= limite]

    for sessao in sorted(recentes, key=lambda s: s.data, reverse=True):
        achados = progressao.recordes_da_sessao(aluno_id, sessao.id, session)
        if achados:
            return {**achados[0], "data": sessao.data}
    return None

@router.get("/resumo")
def resumo_do_aluno(
    aluno_id: int,
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Tudo o que a Home do aluno mostra, numa requisição.

    Um endpoint e não vários: a Home é uma tela só, carregada de uma vez, num
    celular na academia. N endpoints seriam N round-trips, N `aluno_do_tenant` e
    a mesma janela semanal recalculada N vezes — todos os cards derivam do
    **mesmo** array de sessões. Seção sem dado vira `null`, não uma requisição
    que falha.
    """
    aluno = aluno_do_tenant(aluno_id, logado, session)
    hoje = data or date.today()

    # ---- a janela que alimenta quase tudo: uma query ----
    treinos = desempenho.treinos_do_aluno(aluno_id, session)
    inicio_semana, fim_semana = desempenho.intervalo_semana(hoje)
    inicio_janela = inicio_semana - timedelta(weeks=desempenho.SEMANAS_DE_JANELA - 1)
    sessoes = desempenho.sessoes_no_intervalo(aluno_id, inicio_janela, fim_semana, session)

    servico_sessao.encerrar_abandonadas(aluno_id, session)
    session.commit()

    # ---- treino de hoje, com o "última vez" ----
    dia_de_hoje = servico_dias.do_dia(hoje)
    treinos_de_hoje = [t for t in treinos if t.dia_semana == dia_de_hoje]

    ultimas = desempenho.ultima_sessao_por_treino(
        aluno_id, [t.id for t in treinos_de_hoje], hoje, session
    )
    resumos = desempenho.resumo_de_sessoes(
        [s.id for s in ultimas.values()] + ([] if not sessoes else [sessoes[-1].id]),
        session,
    )
    feitos_hoje = _concluidos_por_treino(aluno_id, hoje, session)
    aberta = servico_sessao.aberta_de(aluno_id, session)

    hoje_json = []
    for treino in treinos_de_hoje:
        anterior = ultimas.get(treino.id)
        hoje_json.append(
            {
                "treino_id": treino.id,
                "nome": treino.nome,
                "descricao": treino.descricao,
                "total_exercicios": _total_exercicios(treino.id, session),
                "concluidos": feitos_hoje.get(treino.id, 0),
                "sessao_aberta_id": (
                    aberta.id if aberta and aberta.treino_id == treino.id else None
                ),
                "ultima_vez": (
                    {
                        "data": anterior.data,
                        "duracao_segundos": anterior.duracao_segundos,
                        **resumos.get(anterior.id, {}),
                    }
                    if anterior
                    else None
                ),
            }
        )

    # ---- volume da semana e da anterior ----
    inicio_anterior = inicio_semana - timedelta(weeks=1)
    volume_semana = desempenho.volume_no_intervalo(
        aluno_id, inicio_semana, fim_semana, session
    )
    volume_anterior = desempenho.volume_no_intervalo(
        aluno_id, inicio_anterior, inicio_semana - timedelta(days=1), session
    )

    # ---- último treino ----
    ultima = desempenho.ultima_sessao(aluno_id, session)
    ultimo_treino = None
    if ultima:
        detalhe = desempenho.resumo_de_sessoes([ultima.id], session).get(ultima.id, {})
        ultimo_treino = {
            "sessao_id": ultima.id,
            "treino_id": ultima.treino_id,
            "treino_nome": ultima.treino_nome,
            "data": ultima.data,
            "duracao_segundos": ultima.duracao_segundos,
            **detalhe,
        }

    return {
        "aluno_id": aluno_id,
        "data": hoje,
        "hoje": {"dia_semana": dia_de_hoje, "treinos": hoje_json},
        "semana": desempenho.calendario_semana(hoje, treinos, sessoes),
        "consistencia": desempenho.consistencia(aluno_id, session, hoje, treinos, sessoes),
        "volume": {
            "semana": volume_semana,
            "anterior": volume_anterior,
            "variacao_percentual": desempenho.variacao(
                volume_semana["total_kg"], volume_anterior["total_kg"]
            ),
        },
        "carga_destaque": _carga_destaque(aluno_id, session),
        "ultimo_treino": ultimo_treino,
        "corpo": _evolucao_corporal(aluno_id, session),
        "dieta": _dieta_de_hoje(aluno_id, hoje, session),
        "recorde": _recorde_recente(aluno_id, hoje, sessoes, session),
        "personal": cartao_de_contato(session.get(Usuario, aluno.personal_id))
        if aluno.personal_id
        else None,
    }

# Literal antes de paramétrica: sem isto, "treinos" seria lido como um
# exercicio_id pela rota de baixo.
@router.get("/treinos")
def progressao_dos_treinos(
    aluno_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Uma linha por prescrição do aluno: prescrita × última × melhor.

    É a tela que o personal abre para decidir o que ajustar. As linhas com
    `pronto_para_subir` são a razão de existir da rota.
    """
    aluno_do_tenant(aluno_id, logado, session)

    prescricoes = list(
        session.exec(
            select(TreinoExercicio, Treino)
            .join(Treino, Treino.id == TreinoExercicio.treino_id)
            .where(Treino.aluno_id == aluno_id)
            .order_by(Treino.id, TreinoExercicio.ordem)
        ).all()
    )

    # Uma consulta para todo o histórico da tela; agrupar em Python evita o N+1
    # que uma busca por prescrição criaria.
    historicos = progressao.historico_por_exercicio(
        aluno_id, [p.exercicio_id for p, _ in prescricoes], session
    )

    itens = []
    for prescricao, treino in prescricoes:
        avaliacao = progressao.avaliar(
            prescricao.carga_kg, historicos.get(prescricao.exercicio_id, [])
        )
        itens.append(
            {
                "treino_exercicio_id": prescricao.id,
                "treino_id": treino.id,
                "treino_nome": treino.nome,
                "dia_semana": treino.dia_semana,
                "exercicio_id": prescricao.exercicio_id,
                "exercicio": catalogo.resumo(prescricao.exercicio_id),
                "series": prescricao.series,
                "repeticoes": prescricao.repeticoes,
                "carga_prescrita_kg": prescricao.carga_kg,
                **avaliacao,
            }
        )

    return {
        "aluno_id": aluno_id,
        "total": len(itens),
        "prontos_para_subir": sum(1 for i in itens if i["pronto_para_subir"]),
        "itens": itens,
    }

@router.get("/meus-treinos")
def meus_treinos(
    aluno_id: int,
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    "Meus treinos" do aluno: o plano dele com o estado de execução de cada um.

    A tela era um índice — nome, dia e contagem de exercícios, tudo o que o
    personal cadastrou e nada do que o aluno fez. Todo o resto já existia no
    banco (sessão, duração, séries, execuções); só não havia rota que juntasse.

    Uma requisição, como no `/resumo` e pelo mesmo motivo: é uma tela só, num
    celular, e todos os cartões derivam do mesmo punhado de consultas. São seis,
    independentemente de quantos treinos o aluno tiver.
    """
    aluno_do_tenant(aluno_id, logado, session)
    hoje = data or date.today()

    servico_sessao.encerrar_abandonadas(aluno_id, session)
    session.commit()

    treinos = desempenho.treinos_do_aluno(aluno_id, session)
    if not treinos:
        return {"data": hoje, "dia_semana": servico_dias.do_dia(hoje), "treinos": []}

    ids = [t.id for t in treinos]

    # Uma query para as prescrições de todos os treinos: o cartão mostra os
    # primeiros nomes e a soma de séries, e pedir por treino seria N+1 numa tela
    # que existe justamente para listar vários.
    prescricoes: dict[int, list[TreinoExercicio]] = {}
    for item in session.exec(
        select(TreinoExercicio)
        .where(TreinoExercicio.treino_id.in_(ids))
        .order_by(TreinoExercicio.ordem, TreinoExercicio.id)
    ).all():
        prescricoes.setdefault(item.treino_id, []).append(item)

    # Idem para as sessões: uma varredura serve à "última vez", à mediana de
    # duração e ao estado de hoje.
    sessoes: dict[int, list[SessaoTreino]] = {}
    for sessao in session.exec(
        select(SessaoTreino)
        .where(SessaoTreino.aluno_id == aluno_id, SessaoTreino.treino_id.in_(ids))
        .order_by(SessaoTreino.data.desc(), SessaoTreino.id.desc())
    ).all():
        sessoes.setdefault(sessao.treino_id, []).append(sessao)

    anteriores = {
        treino_id: next((s for s in lista if s.data < hoje), None)
        for treino_id, lista in sessoes.items()
    }
    resumos = desempenho.resumo_de_sessoes(
        [s.id for s in anteriores.values() if s], session
    )
    feitos_hoje = _concluidos_por_treino(aluno_id, hoje, session)
    aberta = servico_sessao.aberta_de(aluno_id, session)
    dia_de_hoje = servico_dias.do_dia(hoje)

    cartoes = []
    for treino in treinos:
        itens = prescricoes.get(treino.id, [])
        total = len(itens)
        concluidos = feitos_hoje.get(treino.id, 0)
        anterior = anteriores.get(treino.id)

        nomes = []
        for item in itens[:PREVIA_DE_EXERCICIOS]:
            resumo_ex = catalogo.resumo(item.exercicio_id)
            nomes.append(resumo_ex["nome"] if resumo_ex else item.exercicio_id)

        cartoes.append(
            {
                "id": treino.id,
                "nome": treino.nome,
                "descricao": treino.descricao,
                "dia_semana": treino.dia_semana,
                "e_de_hoje": treino.dia_semana == dia_de_hoje,
                "total_exercicios": total,
                "exercicios": nomes,
                "estado": _estado_do_treino(
                    total,
                    concluidos,
                    anterior,
                    bool(aberta and aberta.treino_id == treino.id),
                ),
                "concluidos_hoje": concluidos,
                "sessao_aberta_id": (
                    aberta.id if aberta and aberta.treino_id == treino.id else None
                ),
                "duracao": _duracao_do_treino(sessoes.get(treino.id, []), itens),
                "ultima_vez": (
                    {
                        "data": anterior.data,
                        "duracao_segundos": anterior.duracao_segundos,
                        **resumos.get(anterior.id, {}),
                    }
                    if anterior
                    else None
                ),
            }
        )

    # O de hoje primeiro; depois os da semana em ordem de dia, para a lista ler
    # como a semana do aluno e não como ordem de cadastro.
    # `indice` devolve None para dia desconhecido — o validator normaliza na
    # escrita, mas dado antigo pode escapar, e None não compara com int.
    cartoes.sort(
        key=lambda c: (
            not c["e_de_hoje"],
            servico_dias.indice(c["dia_semana"]) if servico_dias.indice(c["dia_semana"]) is not None else 7,
        )
    )
    return {"data": hoje, "dia_semana": dia_de_hoje, "treinos": cartoes}

def _estado_do_treino(
    total: int, concluidos: int, anterior, sessao_aberta: bool
) -> str:
    """
    Derivado, nunca coluna — como `pronto_para_subir` e `situacao`.

    Guardar "em andamento" num campo exigiria recalcular toda vez que o aluno
    desmarca um exercício ou o personal acrescenta um à prescrição. Contar na
    hora é uma linha e nunca fica velho.

    Sessão aberta conta como "em andamento" mesmo com zero exercícios marcados:
    quem apertou Iniciar está na academia, e a tela não pode oferecer "Iniciar
    treino" de novo — o segundo início fecharia a sessão que já está correndo.
    """
    if total and concluidos >= total:
        return "concluido_hoje"
    if concluidos > 0 or sessao_aberta:
        return "em_andamento"
    return "pendente" if anterior else "nunca"

def _duracao_do_treino(sessoes: list, prescricoes: list) -> dict:
    """
    Quanto tempo esse treino leva: o relógio do aluno, ou o palpite.

    Só entram sessões com `duracao_segundos` — as abandonadas fecham com nulo de
    propósito, e incluí-las como zero puxaria a estimativa para baixo justamente
    por causa dos dias em que o aluno esqueceu de finalizar.
    """
    medidas = [
        s.duracao_segundos
        for s in sessoes[:SESSOES_PARA_DURACAO]
        if s.duracao_segundos
    ]
    if medidas:
        return {"segundos": int(statistics.median(medidas)), "estimada": False}

    series = sum(p.series or 0 for p in prescricoes)
    if not series:
        return {"segundos": None, "estimada": True}
    return {
        "segundos": SEGUNDOS_DE_AQUECIMENTO + series * SEGUNDOS_POR_SERIE,
        "estimada": True,
    }

@router.get("/exercicios/{exercicio_id}")
def serie_do_exercicio(
    aluno_id: int,
    exercicio_id: str,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    A série histórica de um exercício, da mais antiga para a mais recente.

    Invertida em relação à consulta porque é o que um gráfico espera: o tempo
    corre da esquerda para a direita.
    """
    aluno_do_tenant(aluno_id, logado, session)

    execucoes = progressao.execucoes_do_exercicio(aluno_id, exercicio_id, session)

    volumes = [e.volume_kg for e in execucoes if e.volume_kg is not None]

    return {
        "aluno_id": aluno_id,
        "exercicio_id": exercicio_id,
        "exercicio": catalogo.resumo(exercicio_id),
        "pontos": [
            {
                "data": e.data,
                "carga_kg": e.carga_kg,
                "carga_prescrita_kg": e.carga_prescrita_kg,
                "observacao": e.observacao,
            }
            for e in reversed(execucoes)
        ],
        # Os campos acima existem desde a primeira versão e são consumidos pelo
        # `HistoricoCarga`. Os de baixo são acréscimo — a rota foi estendida, e
        # não duplicada, para aquela tela não quebrar.
        "por_mes": _por_mes(execucoes),
        "ultimas_execucoes": [
            {
                "data": e.data,
                "carga_kg": e.carga_kg,
                "series": servico_series.ler(e.series_realizadas),
                "series_feitas": e.series_feitas,
                "volume_kg": e.volume_kg,
                "volume_estimado": e.volume_estimado,
                "observacao": e.observacao,
            }
            for e in execucoes[:12]
        ],
        "melhor_volume_kg": max(volumes) if volumes else None,
        **progressao.avaliar(
            execucoes[0].carga_prescrita_kg if execucoes else None, execucoes
        ),
    }

def _por_mes(execucoes) -> list[dict]:
    """
    A série agrupada por mês — a leitura de quem quer ver tendência, não sessão.

    Em Python e não em SQL: agrupar por mês no SQLite exigiria `strftime` sobre
    uma coluna de texto, o que não usa índice e fica ilegível. A janela já veio
    limitada a 30 execuções.
    """
    meses: dict[str, dict] = {}
    for execucao in reversed(execucoes):  # do mais antigo para o mais novo
        chave = execucao.data.strftime("%Y-%m")
        mes = meses.setdefault(
            chave,
            {"mes": chave, "sessoes": 0, "melhor_carga_kg": None, "volume_kg": 0.0},
        )
        mes["sessoes"] += 1
        if execucao.carga_kg is not None:
            atual = mes["melhor_carga_kg"]
            mes["melhor_carga_kg"] = (
                execucao.carga_kg if atual is None else max(atual, execucao.carga_kg)
            )
        if execucao.volume_kg is not None:
            mes["volume_kg"] += execucao.volume_kg

    for mes in meses.values():
        mes["volume_kg"] = round(mes["volume_kg"], 2) or None
    return list(meses.values())
