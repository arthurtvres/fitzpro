"""
O que se deduz do histórico de execução.

Nada aqui escreve prescrição. O serviço observa o que o aluno registrou e devolve
leitura — inclusive o sinal `pronto_para_subir`. Quem altera a carga é o personal,
por decisão de produto: uma carga que sobe sozinha tira dele o controle do que
prescreveu, e ele é quem sabe se o aluno subiu com técnica.
"""

from datetime import date

from sqlmodel import Session, select

from sqlalchemy import func

from app.models import ExecucaoExercicio, ExecucaoRefeicao, SessaoTreino
from app.services import catalogo

# Quantas sessões seguidas no alvo antes de sugerir que suba a carga.
# Chute defensável, não medido: uma sessão pode ser um dia bom. Vira
# configuração por personal quando alguém pedir.
SESSOES_NO_ALVO_PARA_SUBIR = 2

def execucoes_do_exercicio(
    aluno_id: int, exercicio_id: str, session: Session, limite: int = 30
) -> list[ExecucaoExercicio]:
    """
    O histórico de um exercício, da mais recente para a mais antiga.

    Busca por `exercicio_id` (o id do catálogo) e **não** por prescrição: a
    pergunta é "quanto levantei de agachamento da última vez", e a resposta não
    pode zerar porque o personal removeu e readicionou a linha no treino.
    """
    consulta = (
        select(ExecucaoExercicio)
        .where(
            ExecucaoExercicio.aluno_id == aluno_id,
            ExecucaoExercicio.exercicio_id == exercicio_id,
        )
        .order_by(ExecucaoExercicio.data.desc(), ExecucaoExercicio.id.desc())
        .limit(limite)
    )
    return list(session.exec(consulta).all())

def historico_por_exercicio(
    aluno_id: int, exercicio_ids: list[str], session: Session
) -> dict[str, list[ExecucaoExercicio]]:
    """
    O histórico de vários exercícios de uma vez, agrupado por `exercicio_id`.

    Uma consulta só, agrupada em Python: montar a tela de um treino chamando
    `execucoes_do_exercicio` por item seria N+1. Mesmo padrão da contagem
    agregada em `listar_treinos`.
    """
    if not exercicio_ids:
        return {}

    consulta = (
        select(ExecucaoExercicio)
        .where(
            ExecucaoExercicio.aluno_id == aluno_id,
            ExecucaoExercicio.exercicio_id.in_(exercicio_ids),
        )
        .order_by(ExecucaoExercicio.data.desc(), ExecucaoExercicio.id.desc())
    )

    agrupado: dict[str, list[ExecucaoExercicio]] = {}
    for execucao in session.exec(consulta).all():
        agrupado.setdefault(execucao.exercicio_id, []).append(execucao)
    return agrupado

def avaliar(carga_prescrita: float | None, execucoes: list[ExecucaoExercicio]) -> dict:
    """
    Resume o histórico de um exercício e diz se está na hora de subir a carga.

    `execucoes` vem da mais recente para a mais antiga.

    **O alvo é a carga, e só ela.** `repeticoes` é texto livre no modelo — cabe
    "8-12" e "até a falha" —, então comparar reps feitas com prescritas exigiria
    um parser que erra em silêncio. Carga é float, e é o número que o personal
    muda quando decide progredir.
    """
    ultima = execucoes[0] if execucoes else None

    # Conta a sequência a partir da MAIS RECENTE e para no primeiro tropeço:
    # uma sessão abaixo do alvo zera o contador, que é o que um treinador espera.
    sessoes_no_alvo = 0
    if carga_prescrita is not None:
        for execucao in execucoes:
            if execucao.carga_kg is None or execucao.carga_kg < carga_prescrita:
                break
            sessoes_no_alvo += 1

    cargas = [e.carga_kg for e in execucoes if e.carga_kg is not None]

    return {
        "ultima_carga_kg": ultima.carga_kg if ultima else None,
        "ultima_data": ultima.data if ultima else None,
        "melhor_carga_kg": max(cargas) if cargas else None,
        "total_execucoes": len(execucoes),
        "sessoes_no_alvo": sessoes_no_alvo,
        "pronto_para_subir": (
            carga_prescrita is not None
            and sessoes_no_alvo >= SESSOES_NO_ALVO_PARA_SUBIR
        ),
    }

def desvincular_execucoes(
    session: Session,
    *,
    treino_id: int | None = None,
    treino_exercicio_id: int | None = None,
    dieta_id: int | None = None,
):
    """
    Solta as execuções de uma prescrição que está sendo apagada.

    **Apagar a prescrição apaga o plano, nunca o passado.** Se o personal
    reorganizar um treino, o histórico de carga do aluno — justamente o dado que
    esta feature existe para produzir — não pode ir junto. As FKs são anuláveis
    por causa disto.
    """
    if treino_id is not None:
        for execucao in session.exec(
            select(ExecucaoExercicio).where(ExecucaoExercicio.treino_id == treino_id)
        ).all():
            execucao.treino_id = None
            execucao.treino_exercicio_id = None
            session.add(execucao)

        # A sessão também solta, e sobrevive: `treino_nome` foi copiado na
        # criação justamente para "Último treino: Costas + Bíceps" continuar
        # legível depois que o treino deixar de existir.
        for sessao in session.exec(
            select(SessaoTreino).where(SessaoTreino.treino_id == treino_id)
        ).all():
            sessao.treino_id = None
            session.add(sessao)

    if treino_exercicio_id is not None:
        for execucao in session.exec(
            select(ExecucaoExercicio).where(
                ExecucaoExercicio.treino_exercicio_id == treino_exercicio_id
            )
        ).all():
            execucao.treino_exercicio_id = None
            session.add(execucao)

    if dieta_id is not None:
        for execucao in session.exec(
            select(ExecucaoRefeicao).where(ExecucaoRefeicao.dieta_id == dieta_id)
        ).all():
            execucao.dieta_id = None
            session.add(execucao)

# Um recorde precisa de história para significar alguma coisa: a primeira vez
# que alguém faz um exercício não é recorde de nada.
MINIMO_EXECUCOES_ANTERIORES = 3
# Granularidade de anilha, e mata o ruído de float (80.00000001 > 80).
MELHORA_MINIMA_KG = 0.5

def recordes_da_sessao(aluno_id: int, sessao_id: int, session: Session) -> list[dict]:
    """
    Os exercícios em que esta sessão superou tudo o que veio antes.

    Derivado, sem coluna — mesma escolha do `pronto_para_subir`: uma flag
    gravada teria que ser recomputada toda vez que o aluno desmarcasse ou o
    personal editasse, e uma flag errada é pior que nenhuma.

    Duas queries: o melhor da sessão e o melhor do histórico anterior. O
    `sessao_id IS NULL` no segundo filtro é o que inclui as execuções antigas,
    de antes de existirem sessões — sem ele, todo mundo bateria recorde na
    primeira semana pós-migration.
    """
    da_sessao = session.exec(
        select(ExecucaoExercicio.exercicio_id, func.max(ExecucaoExercicio.carga_kg))
        .where(
            ExecucaoExercicio.sessao_id == sessao_id,
            ExecucaoExercicio.carga_kg.is_not(None),
        )
        .group_by(ExecucaoExercicio.exercicio_id)
    ).all()

    if not da_sessao:
        return []

    ids = [exercicio_id for exercicio_id, _ in da_sessao]
    anteriores = {
        exercicio_id: (melhor, quantas)
        for exercicio_id, melhor, quantas in session.exec(
            select(
                ExecucaoExercicio.exercicio_id,
                func.max(ExecucaoExercicio.carga_kg),
                func.count(ExecucaoExercicio.id),
            )
            .where(
                ExecucaoExercicio.aluno_id == aluno_id,
                ExecucaoExercicio.exercicio_id.in_(ids),
                ExecucaoExercicio.carga_kg.is_not(None),
                (ExecucaoExercicio.sessao_id.is_(None))
                | (ExecucaoExercicio.sessao_id != sessao_id),
            )
            .group_by(ExecucaoExercicio.exercicio_id)
        ).all()
    }

    recordes = []
    for exercicio_id, carga in da_sessao:
        melhor_anterior, quantas = anteriores.get(exercicio_id, (None, 0))
        if quantas < MINIMO_EXECUCOES_ANTERIORES or melhor_anterior is None:
            continue
        if carga < melhor_anterior + MELHORA_MINIMA_KG:
            continue
        recordes.append(
            {
                "exercicio_id": exercicio_id,
                "exercicio": catalogo.resumo(exercicio_id),
                "carga_kg": carga,
                "anterior_kg": melhor_anterior,
            }
        )
    return recordes

def percentual(concluidos: int, total: int) -> int:
    """0 quando não há o que concluir — e não divisão por zero."""
    return round(100 * concluidos / total) if total else 0

def execucoes_do_treino(
    aluno_id: int,
    treino_id: int,
    dia: date,
    session: Session,
    sessao_id: int | None = None,
) -> dict[int, ExecucaoExercicio]:
    """
    O que foi concluído naquele treino, indexado por prescrição.

    Com `sessao_id`, escopo é a sessão; sem ele, o dia inteiro. A distinção
    importa desde que o mesmo treino pode ser feito duas vezes no mesmo dia:
    somar as duas sessões daria "8 de 5 exercícios".
    """
    consulta = select(ExecucaoExercicio).where(
        ExecucaoExercicio.aluno_id == aluno_id,
        ExecucaoExercicio.treino_id == treino_id,
    )
    if sessao_id is not None:
        consulta = consulta.where(ExecucaoExercicio.sessao_id == sessao_id)
    else:
        consulta = consulta.where(ExecucaoExercicio.data == dia)
    return {
        e.treino_exercicio_id: e
        for e in session.exec(consulta).all()
        if e.treino_exercicio_id is not None
    }

def execucoes_da_dieta(
    aluno_id: int, dieta_id: int, dia: date, session: Session
) -> dict[str, ExecucaoRefeicao]:
    """As refeições concluídas naquela dieta naquele dia, indexadas por id."""
    consulta = select(ExecucaoRefeicao).where(
        ExecucaoRefeicao.aluno_id == aluno_id,
        ExecucaoRefeicao.dieta_id == dieta_id,
        ExecucaoRefeicao.data == dia,
    )
    return {e.refeicao_id: e for e in session.exec(consulta).all()}
