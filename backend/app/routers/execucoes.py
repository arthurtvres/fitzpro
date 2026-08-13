"""
Registro do que o aluno de fato fez: exercícios concluídos e refeições consumidas.

**Estas rotas usam `usuario_atual`, não `personal_atual`, e isso é proposital.**
São as primeiras escritas de aluno no sistema. A segurança não vem de uma
dependência de papel, e sim do `buscar_ou_404` de cada recurso, que resolve o
treino/dieta e passa o `aluno_id` dele por `aluno_do_tenant` — o mesmo caminho
que já protege as leituras. Um aluno tentando registrar em treino alheio, ou até
no do colega de mesmo personal, recebe 404 antes de chegar aqui embaixo.

Ficam fora de `treinos.py` e `dietas.py` porque a natureza é outra: lá é CRUD de
prescrição (intenção mutável), aqui é registro de fato (imutável).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.dependencias import quem_registra, usuario_atual
from app.db.session import get_session
from app.models import (
    ExecucaoExercicio,
    ExecucaoExercicioEntrada,
    ExecucaoRefeicao,
    ExecucaoRefeicaoCriacao,
    SessaoTreinoCriacao,
    Treino,
    TreinoExercicio,
    Usuario,
)
from app.routers import dietas as rotas_dietas
from app.routers import treinos as rotas_treinos
from app.services import catalogo, plano_alimentar, progressao
from app.services import series as servico_series
from app.services import sessao as servico_sessao

router_treino = APIRouter(prefix="/treinos", tags=["execucoes"])
router_dieta = APIRouter(prefix="/dietas", tags=["execucoes"])

def dia_valido(data: date | None) -> date:
    """
    O dia do registro. Sem `data`, hoje no fuso do servidor.

    Futuro é recusado: registrar amanhã é sempre erro de digitação ou relógio
    errado, e um registro no futuro envenenaria o "última vez" para sempre.
    """
    dia = data or date.today()
    if dia > date.today():
        raise HTTPException(status_code=400, detail="Não dá para registrar uma data futura")
    return dia

# ---------- treino ----------

def _prescricoes(treino_id: int, session: Session) -> list[TreinoExercicio]:
    return list(
        session.exec(
            select(TreinoExercicio)
            .where(TreinoExercicio.treino_id == treino_id)
            .order_by(TreinoExercicio.ordem)
        ).all()
    )

def _resumo_do_treino(
    treino: Treino, dia: date, session: Session, sessao_id: int | None = None
) -> dict:
    prescricoes = _prescricoes(treino.id, session)
    feitas = progressao.execucoes_do_treino(
        treino.aluno_id, treino.id, dia, session, sessao_id
    )
    volumes = [e.volume_kg for e in feitas.values() if e.volume_kg is not None]
    return {
        "data": dia,
        "treino_id": treino.id,
        "total": len(prescricoes),
        "concluidos": len(feitas),
        "percentual": progressao.percentual(len(feitas), len(prescricoes)),
        "series": sum(e.series_feitas for e in feitas.values()),
        "volume_kg": round(sum(volumes), 2) if volumes else None,
        # Basta uma execução estimada para o total ser estimado — dizer "exato"
        # com uma parte chutada seria pior do que não dizer nada.
        "volume_estimado": any(e.volume_estimado for e in feitas.values()),
    }

# Literais antes de paramétricas: sem isto, "sessoes" seria lido como um id.
@router_treino.post("/{treino_id}/sessoes", status_code=201)
def iniciar_sessao(
    treino_id: int,
    dados: SessaoTreinoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Abre uma sessão de treino — o "Iniciar treino" da tela do aluno.

    Fecha a que estiver aberta antes: ninguém está em duas academias ao mesmo
    tempo, e duas sessões simultâneas bagunçariam a resolução automática de
    quem só marca sem iniciar.
    """
    treino = rotas_treinos.buscar_ou_404(treino_id, logado, session)
    aluno = session.get(Usuario, treino.aluno_id)
    quem_registra(aluno, logado)
    dia = dia_valido(dados.data)

    sessao = servico_sessao.iniciar(treino, dia, logado, session, implicita=False)
    if dados.observacao:
        sessao.observacao = dados.observacao
        session.add(sessao)
        session.commit()
        session.refresh(sessao)

    return _progresso_com_itens(treino, dia, sessao, session)

@router_treino.post("/{treino_id}/sessoes/{sessao_id}/finalizar")
def finalizar_sessao(
    treino_id: int,
    sessao_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """Fecha a sessão, calcula a duração e devolve os recordes que ela produziu."""
    treino = rotas_treinos.buscar_ou_404(treino_id, logado, session)
    quem_registra(session.get(Usuario, treino.aluno_id), logado)

    sessao = servico_sessao.buscar_ou_404(sessao_id, treino, session)
    servico_sessao.finalizar(sessao, session)

    return {
        "sessao": servico_sessao.publico(sessao),
        "resumo": _resumo_do_treino(treino, sessao.data, session, sessao.id),
        # É o momento em que a conquista aconteceu — o único lugar onde o
        # recorde aparece sem ser pedido.
        "recordes": progressao.recordes_da_sessao(treino.aluno_id, sessao.id, session),
    }

@router_treino.delete("/{treino_id}/sessoes/{sessao_id}")
def cancelar_sessao(
    treino_id: int,
    sessao_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Descarta uma sessão que não chegou a acontecer.

    Com execução registrada, recusa: apagar registro de fato por acidente é
    exatamente o que o resto do modelo existe para impedir.
    """
    treino = rotas_treinos.buscar_ou_404(treino_id, logado, session)
    quem_registra(session.get(Usuario, treino.aluno_id), logado)
    sessao = servico_sessao.buscar_ou_404(sessao_id, treino, session)

    tem_execucao = session.exec(
        select(ExecucaoExercicio).where(ExecucaoExercicio.sessao_id == sessao.id)
    ).first()
    if tem_execucao:
        raise HTTPException(
            status_code=400,
            detail="Esta sessão já tem exercícios registrados e não pode ser cancelada",
        )

    session.delete(sessao)
    session.commit()
    return {"mensagem": "Sessão cancelada"}

@router_treino.get("/{treino_id}/progresso")
def progresso_do_treino(
    treino_id: int,
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
    # No fim de propósito: a ordem dos parâmetros é irrelevante para o FastAPI,
    # mas não para quem chama estas funções posicionalmente — os testes fazem
    # isso, e inserir no meio quebraria todas as chamadas existentes.
    sessao_id: int | None = None,
):
    """O treino de um dia: o que foi feito, o que falta, e a carga da última vez."""
    treino = rotas_treinos.buscar_ou_404(treino_id, logado, session)
    dia = dia_valido(data)

    if sessao_id:
        sessao = servico_sessao.buscar_ou_404(sessao_id, treino, session)
    else:
        # A sessão aberta do aluno pode ser de OUTRO treino — ele começou o A e
        # está espiando o B. Nesse caso o escopo volta a ser o dia, senão a tela
        # do B mostraria o progresso do A.
        aberta = servico_sessao.aberta_de(treino.aluno_id, session)
        sessao = aberta if aberta and aberta.treino_id == treino.id else None

    return _progresso_com_itens(treino, dia, sessao, session)

def _progresso_com_itens(treino, dia: date, sessao, session: Session) -> dict:
    """O corpo compartilhado por `GET /progresso` e `POST /sessoes`."""

    # Com sessão, o escopo é ela; sem, o dia. Dois treinos iguais no mesmo dia
    # são duas sessões, e somá-las daria "8 de 5 exercícios".
    escopo = sessao.id if sessao else None

    prescricoes = _prescricoes(treino.id, session)
    feitas = progressao.execucoes_do_treino(
        treino.aluno_id, treino.id, dia, session, escopo
    )
    # Uma consulta para o histórico de todos os exercícios da tela, não uma por
    # linha: a página inteira do treino sai em 3 queries.
    historicos = progressao.historico_por_exercicio(
        treino.aluno_id, [p.exercicio_id for p in prescricoes], session
    )

    itens = []
    for prescricao in prescricoes:
        execucao = feitas.get(prescricao.id)
        itens.append(
            {
                **prescricao.model_dump(),
                "exercicio": catalogo.resumo(prescricao.exercicio_id),
                "concluido": execucao is not None,
                "execucao": execucao.model_dump() if execucao else None,
                # As séries já parseadas, para a tela não precisar ler o JSON.
                "series": servico_series.ler(execucao.series_realizadas) if execucao else [],
                "historico": progressao.avaliar(
                    prescricao.carga_kg, historicos.get(prescricao.exercicio_id, [])
                ),
            }
        )

    return {
        **_resumo_do_treino(treino, dia, session, escopo),
        "sessao": servico_sessao.publico(sessao),
        "itens": itens,
    }

@router_treino.put("/{treino_id}/exercicios/{item_id}/execucao")
def marcar_exercicio(
    treino_id: int,
    item_id: int,
    dados: ExecucaoExercicioEntrada,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Marca um exercício como feito.

    É PUT na chave natural (prescrição, **sessão**), não POST: o botão na tela é
    uma caixa de marcar, e marcar duas vezes tem que atualizar, não criar uma
    segunda linha. Sem `series` no corpo, o servidor preenche a partir do
    prescrito e marca o volume como estimado — é o que mantém marcar em um toque.
    """
    treino = rotas_treinos.buscar_ou_404(treino_id, logado, session)
    aluno = session.get(Usuario, treino.aluno_id)
    registrado_por = quem_registra(aluno, logado)
    dia = dia_valido(dados.data)

    prescricao = session.get(TreinoExercicio, item_id)
    if not prescricao or prescricao.treino_id != treino_id:
        raise HTTPException(status_code=404, detail="Exercício não encontrado no treino")

    # Nunca gravamos com sessão nula: é isto, e não o índice, que garante que
    # marcar de novo atualize em vez de duplicar — no SQLite, nulo não colide.
    sessao = servico_sessao.resolver(
        treino, dia, logado, session, sessao_id=dados.sessao_id
    )

    # A carga informada manda; na falta dela, a prescrita. É a base do
    # preenchimento de um toque.
    carga_base = dados.carga_kg if dados.carga_kg is not None else prescricao.carga_kg
    try:
        consolidado = servico_series.consolidar(
            dados.series,
            series_prescritas=prescricao.series,
            repeticoes=prescricao.repeticoes,
            carga_prescrita=carga_base,
        )
    except ValueError as erro:
        raise HTTPException(status_code=400, detail=str(erro))

    existente = session.exec(
        select(ExecucaoExercicio).where(
            ExecucaoExercicio.aluno_id == treino.aluno_id,
            ExecucaoExercicio.treino_exercicio_id == item_id,
            ExecucaoExercicio.sessao_id == sessao.id,
        )
    ).first()

    if existente:
        execucao = existente
        execucao.observacao = dados.observacao
        # A autoria acompanha o valor: se o personal corrigiu a carga que o
        # aluno tinha lançado, quem responde por ela agora é o personal.
        execucao.registrado_por_id = registrado_por.id
    else:
        execucao = ExecucaoExercicio(
            data=dia,
            observacao=dados.observacao,
            # Nada abaixo desta linha vem do cliente: o dono sai do treino, e a
            # cópia da prescrição sai do banco. Aceitar qualquer um deles do
            # corpo deixaria o aluno registrar por outro, ou declarar qual era o
            # alvo que ele mesmo bateu.
            aluno_id=treino.aluno_id,
            sessao_id=sessao.id,
            treino_id=treino_id,
            treino_exercicio_id=prescricao.id,
            exercicio_id=prescricao.exercicio_id,
            series_prescritas=prescricao.series,
            repeticoes_prescritas=prescricao.repeticoes,
            carga_prescrita_kg=prescricao.carga_kg,
            registrado_por_id=registrado_por.id,
        )

    # `carga_kg` sai daqui (o máximo das séries), e não do corpo: é o que mantém
    # `avaliar()`, `pronto_para_subir` e o gráfico funcionando sem reescrita.
    for campo, valor in consolidado.items():
        setattr(execucao, campo, valor)

    session.add(execucao)
    session.commit()
    session.refresh(execucao)

    return {
        "execucao": execucao.model_dump(),
        "sessao": servico_sessao.publico(sessao),
        "progresso": _resumo_do_treino(treino, dia, session, sessao.id),
    }

@router_treino.delete("/{treino_id}/exercicios/{item_id}/execucao")
def desmarcar_exercicio(
    treino_id: int,
    item_id: int,
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
    sessao_id: int | None = None,
):
    """Desfaz a marcação da sessão. Desmarcar o que não estava marcado não é erro."""
    treino = rotas_treinos.buscar_ou_404(treino_id, logado, session)
    quem_registra(session.get(Usuario, treino.aluno_id), logado)
    dia = dia_valido(data)

    sessao = servico_sessao.resolver(treino, dia, logado, session, sessao_id=sessao_id)
    execucao = session.exec(
        select(ExecucaoExercicio).where(
            ExecucaoExercicio.aluno_id == treino.aluno_id,
            ExecucaoExercicio.treino_exercicio_id == item_id,
            ExecucaoExercicio.sessao_id == sessao.id,
        )
    ).first()

    if execucao:
        session.delete(execucao)
        session.commit()

    return {
        "mensagem": "Exercício desmarcado",
        "progresso": _resumo_do_treino(treino, dia, session),
    }

# ---------- dieta ----------

def _resumo_da_dieta(dieta, dia: date, session: Session) -> dict:
    refeicoes = plano_alimentar.refeicoes(dieta.descricao)
    feitas = progressao.execucoes_da_dieta(dieta.aluno_id, dieta.id, dia, session)
    return {
        "data": dia,
        "dieta_id": dieta.id,
        "total_refeicoes": len(refeicoes),
        "concluidas": len(feitas),
        "percentual": progressao.percentual(len(feitas), len(refeicoes)),
        "calorias_meta": dieta.calorias,
        # Somadas do que foi marcado, não recalculadas do plano: é o snapshot
        # que garante que o total de ontem não mude quando o plano for editado.
        "calorias_consumidas": sum(e.calorias for e in feitas.values()),
    }

@router_dieta.get("/{dieta_id}/progresso")
def progresso_da_dieta(
    dieta_id: int,
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """As refeições do dia: quais foram feitas e quantas calorias já entraram."""
    dieta = rotas_dietas.buscar_ou_404(dieta_id, logado, session)
    dia = dia_valido(data)

    feitas = progressao.execucoes_da_dieta(dieta.aluno_id, dieta_id, dia, session)
    itens = [
        {
            **refeicao,
            "concluida": refeicao["id"] in feitas,
            "execucao": (
                feitas[refeicao["id"]].model_dump() if refeicao["id"] in feitas else None
            ),
        }
        for refeicao in plano_alimentar.refeicoes(dieta.descricao)
    ]

    return {**_resumo_da_dieta(dieta, dia, session), "itens": itens}

@router_dieta.put("/{dieta_id}/refeicoes/{refeicao_id}/execucao")
def marcar_refeicao(
    dieta_id: int,
    refeicao_id: str,
    dados: ExecucaoRefeicaoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """Marca uma refeição como consumida, guardando o que ela era naquele dia."""
    dieta = rotas_dietas.buscar_ou_404(dieta_id, logado, session)
    aluno = session.get(Usuario, dieta.aluno_id)
    registrado_por = quem_registra(aluno, logado)
    dia = dia_valido(dados.data)

    refeicoes = plano_alimentar.refeicoes(dieta.descricao)
    if not refeicoes:
        raise HTTPException(
            status_code=400, detail="Esta dieta não tem refeições para marcar"
        )

    refeicao = next((r for r in refeicoes if r["id"] == refeicao_id), None)
    if not refeicao:
        raise HTTPException(status_code=404, detail="Refeição não encontrada")

    existente = session.exec(
        select(ExecucaoRefeicao).where(
            ExecucaoRefeicao.aluno_id == dieta.aluno_id,
            ExecucaoRefeicao.dieta_id == dieta_id,
            ExecucaoRefeicao.refeicao_id == refeicao_id,
            ExecucaoRefeicao.data == dia,
        )
    ).first()

    # O snapshot é relido do plano vigente mesmo quando a linha já existe: se o
    # personal ajustou a refeição hoje de manhã, o que valeu é o do momento da
    # marcação.
    snapshot = {
        "refeicao_nome": refeicao["nome"],
        "refeicao_horario": refeicao["horario"],
        "calorias": int(refeicao["calorias"] or 0),
        "proteinas_g": refeicao["proteinas"],
        "carboidratos_g": refeicao["carboidratos"],
        "gorduras_g": refeicao["gorduras"],
    }

    if existente:
        execucao = existente
        execucao.observacao = dados.observacao
        execucao.registrado_por_id = registrado_por.id
        for campo, valor in snapshot.items():
            setattr(execucao, campo, valor)
    else:
        execucao = ExecucaoRefeicao(
            data=dia,
            observacao=dados.observacao,
            aluno_id=dieta.aluno_id,
            dieta_id=dieta_id,
            refeicao_id=refeicao_id,
            registrado_por_id=registrado_por.id,
            **snapshot,
        )

    session.add(execucao)
    session.commit()
    session.refresh(execucao)

    return {
        "execucao": execucao.model_dump(),
        "progresso": _resumo_da_dieta(dieta, dia, session),
    }

@router_dieta.delete("/{dieta_id}/refeicoes/{refeicao_id}/execucao")
def desmarcar_refeicao(
    dieta_id: int,
    refeicao_id: str,
    data: date | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    dieta = rotas_dietas.buscar_ou_404(dieta_id, logado, session)
    quem_registra(session.get(Usuario, dieta.aluno_id), logado)
    dia = dia_valido(data)

    execucao = session.exec(
        select(ExecucaoRefeicao).where(
            ExecucaoRefeicao.aluno_id == dieta.aluno_id,
            ExecucaoRefeicao.dieta_id == dieta_id,
            ExecucaoRefeicao.refeicao_id == refeicao_id,
            ExecucaoRefeicao.data == dia,
        )
    ).first()

    if execucao:
        session.delete(execucao)
        session.commit()

    return {
        "mensagem": "Refeição desmarcada",
        "progresso": _resumo_da_dieta(dieta, dia, session),
    }
