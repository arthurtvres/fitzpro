"""
A sessão de treino: uma ida à academia.

O que este módulo garante, e que o banco sozinho não garante: **nenhuma execução
é gravada com `sessao_id` nulo**. A chave natural nova é
`(aluno, sessão, prescrição)`, e no SQLite linhas com nulo não colidem — então a
idempotência do "marcar de novo não duplica" mora aqui, em `resolver`, e não no
schema. É por isso que o teste de sessão não é opcional.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import ExecucaoExercicio, SessaoTreino, Treino, Usuario

# Depois disso, a sessão foi abandonada — ninguém treina 4 horas seguidas e
# esquece o app aberto de propósito. Chute defensável, como o
# SESSOES_NO_ALVO_PARA_SUBIR: constante nomeada para virar configuração quando
# alguém pedir.
LIMITE_SESSAO_ABERTA = timedelta(hours=4)

SESSAO_INEXISTENTE = HTTPException(status_code=404, detail="Sessão não encontrada")

def agora() -> datetime:
    return datetime.now(timezone.utc)

def _sem_fuso(momento: datetime) -> datetime:
    """
    O SQLite devolve datetime ingênuo; comparar com um consciente estoura.

    Normalizamos para ingênuo-em-UTC, que é o que já está gravado.
    """
    return momento.replace(tzinfo=None) if momento.tzinfo else momento

def encerrar_abandonadas(aluno_id: int, session: Session) -> None:
    """
    Fecha sessões que ficaram abertas — sem job, no caminho de quem passa.

    `duracao_segundos` fica **nulo**: não sabemos quanto durou, e um número
    inventado envenenaria a média de duração para sempre. Fechar sem duração é
    a resposta honesta.
    """
    limite = _sem_fuso(agora() - LIMITE_SESSAO_ABERTA)
    hoje = date.today()

    abertas = session.exec(
        select(SessaoTreino).where(
            SessaoTreino.aluno_id == aluno_id,
            SessaoTreino.finalizada_em.is_(None),
        )
    ).all()

    for sessao in abertas:
        if _sem_fuso(sessao.iniciada_em) > limite and sessao.data >= hoje:
            continue

        ultima = session.exec(
            select(ExecucaoExercicio.registrado_em)
            .where(ExecucaoExercicio.sessao_id == sessao.id)
            .order_by(ExecucaoExercicio.registrado_em.desc())
        ).first()

        sessao.finalizada_em = ultima or sessao.iniciada_em
        sessao.duracao_segundos = None
        session.add(sessao)

def aberta_de(aluno_id: int, session: Session) -> SessaoTreino | None:
    """A sessão em andamento do aluno. No máximo uma — ninguém está em duas academias."""
    return session.exec(
        select(SessaoTreino)
        .where(
            SessaoTreino.aluno_id == aluno_id,
            SessaoTreino.finalizada_em.is_(None),
        )
        .order_by(SessaoTreino.iniciada_em.desc())
    ).first()

def iniciar(
    treino: Treino, dia: date, logado: Usuario, session: Session, *, implicita: bool = False
) -> SessaoTreino:
    """
    Abre uma sessão, fechando a que estiver aberta.

    Fechar a anterior é o que impede duas sessões simultâneas — que não existem
    na vida real e bagunçariam a resolução automática.
    """
    encerrar_abandonadas(treino.aluno_id, session)

    anterior = aberta_de(treino.aluno_id, session)
    if anterior:
        finalizar(anterior, session)

    nova = SessaoTreino(
        aluno_id=treino.aluno_id,
        treino_id=treino.id,
        # Copiado, não referenciado: "Último treino: Costas + Bíceps" tem que
        # sobreviver ao personal apagar o treino.
        treino_nome=treino.nome,
        data=dia,
        iniciada_em=agora(),
        implicita=implicita,
        registrado_por_id=logado.id,
    )
    session.add(nova)
    session.commit()
    session.refresh(nova)
    return nova

def finalizar(sessao: SessaoTreino, session: Session) -> SessaoTreino:
    """
    Fecha e calcula a duração.

    Acima do limite, a duração vira **nula** em vez de um teto: um teto distorce
    a média tanto quanto o valor real, e "desconhecida" é verdade.
    """
    if sessao.finalizada_em is None:
        sessao.finalizada_em = agora()

    segundos = int(
        (_sem_fuso(sessao.finalizada_em) - _sem_fuso(sessao.iniciada_em)).total_seconds()
    )
    # Zero é uma duração **conhecida** (iniciou e fechou na hora), então entra
    # como 0. O nulo fica reservado para o que de fato não se sabe: sessão
    # abandonada e sessão retroativa da migration.
    sessao.duracao_segundos = (
        segundos if 0 <= segundos <= LIMITE_SESSAO_ABERTA.total_seconds() else None
    )

    session.add(sessao)
    session.commit()
    session.refresh(sessao)
    return sessao

def buscar_ou_404(
    sessao_id: int, treino: Treino, session: Session
) -> SessaoTreino:
    """A sessão, desde que seja daquele treino e daquele aluno."""
    sessao = session.get(SessaoTreino, sessao_id)
    if not sessao or sessao.aluno_id != treino.aluno_id or sessao.treino_id != treino.id:
        raise SESSAO_INEXISTENTE
    return sessao

def resolver(
    treino: Treino,
    dia: date,
    logado: Usuario,
    session: Session,
    *,
    sessao_id: int | None = None,
) -> SessaoTreino:
    """
    A sessão à qual uma marcação pertence. **Nunca devolve None.**

    A ordem importa e é o que preserva a idempotência:

    1. `sessao_id` explícito — o front em modo execução sempre manda;
    2. a sessão aberta daquele treino no dia;
    3. a última sessão daquele treino no dia, mesmo já fechada;
    4. cria uma implícita.

    Marcar duas vezes sem informar sessão cai no passo 2 ou 3 e faz UPDATE, que
    é o comportamento que os testes travam desde a versão anterior.
    """
    if sessao_id is not None:
        return buscar_ou_404(sessao_id, treino, session)

    encerrar_abandonadas(treino.aluno_id, session)

    do_dia = session.exec(
        select(SessaoTreino)
        .where(
            SessaoTreino.aluno_id == treino.aluno_id,
            SessaoTreino.treino_id == treino.id,
            SessaoTreino.data == dia,
        )
        .order_by(SessaoTreino.iniciada_em.desc())
    ).all()

    for sessao in do_dia:
        if sessao.finalizada_em is None:
            return sessao
    if do_dia:
        return do_dia[0]

    return iniciar(treino, dia, logado, session, implicita=True)

def publico(sessao: SessaoTreino | None) -> dict | None:
    if not sessao:
        return None
    return {
        **sessao.model_dump(),
        "em_andamento": sessao.finalizada_em is None,
    }
