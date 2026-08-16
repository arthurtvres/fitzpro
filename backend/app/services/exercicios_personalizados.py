"""
Exercícios personalizados: a biblioteca própria do personal, fora do
free-exercise-db.

Este módulo cuida do CRUD via banco e da tradução para o **mesmo formato de
campos** que `catalogo.py` expõe — para uma busca combinada (catálogo +
personalizados) devolver itens indistinguíveis em forma. `catalogo.py`
continua puro e sem `Session`, do jeito que está hoje; quem mistura os dois é
o router, que já tem os dois em mãos.

O id de um item personalizado é sempre a string `"personal:<id>"` — disjunta
por construção dos ids do catálogo (strings tipo "Barbell_Squat", nunca com
":"), sem exigir nenhuma mudança em `TreinoExercicio.exercicio_id` (já é
`str` livre, sem FK).
"""

import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import ExercicioPersonalizado, ExercicioPersonalizadoCriacao
from app.services.catalogo import CATEGORIAS_PT, EQUIPAMENTOS_PT, MUSCULOS_PT, NAO_INFORMADO, NIVEIS_PT

PREFIXO = "personal:"

INEXISTENTE = HTTPException(status_code=404, detail="Exercício não encontrado")


def _sem_acento(texto: str) -> str:
    normalizado = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in normalizado if unicodedata.category(c) != "Mn")


def eh_personalizado(exercicio_id: str) -> bool:
    return exercicio_id.startswith(PREFIXO)


def _id_numerico(exercicio_id: str) -> int | None:
    if not eh_personalizado(exercicio_id):
        return None
    try:
        return int(exercicio_id[len(PREFIXO) :])
    except ValueError:
        return None


def _traduzir(mapa: dict[str, str], valor: str | None) -> str:
    if valor is None:
        return NAO_INFORMADO
    return mapa.get(valor, valor)


def publico(item: ExercicioPersonalizado, completo: bool = False) -> dict:
    """Mesmo formato de `catalogo._publico`, com a procedência explícita."""
    dados = {
        "id": f"{PREFIXO}{item.id}",
        "nome": item.nome,
        "categoria": item.categoria,
        "categoria_pt": _traduzir(CATEGORIAS_PT, item.categoria),
        "equipamento": item.equipamento,
        "equipamento_pt": _traduzir(EQUIPAMENTOS_PT, item.equipamento),
        "nivel": item.nivel,
        "nivel_pt": _traduzir(NIVEIS_PT, item.nivel),
        "musculos_primarios": item.musculos_primarios,
        "musculos_primarios_pt": [_traduzir(MUSCULOS_PT, m) for m in item.musculos_primarios],
        "instrucoes": [item.instrucoes] if item.instrucoes else [],
        "imagens": [item.imagem_url] if item.imagem_url else [],
        "fonte": "personal",
        # Sem isto o front nunca sabe que um item está arquivado — o cartão
        # sempre mostraria "Arquivar", nunca "Desarquivar".
        "arquivado_em": item.arquivado_em,
    }
    if not completo:
        dados.pop("instrucoes")
    return dados


def resumo(item: ExercicioPersonalizado) -> dict:
    """Mesmo formato de `catalogo.resumo`, para embutir na prescrição de um treino."""
    return {
        "id": f"{PREFIXO}{item.id}",
        "nome": item.nome,
        "equipamento_pt": _traduzir(EQUIPAMENTOS_PT, item.equipamento),
        "musculos_primarios_pt": [_traduzir(MUSCULOS_PT, m) for m in item.musculos_primarios],
        "imagem": item.imagem_url,
        "fonte": "personal",
    }


def criar(
    dados: ExercicioPersonalizadoCriacao, personal_id: int, session: Session
) -> ExercicioPersonalizado:
    novo = ExercicioPersonalizado.model_validate(dados, update={"personal_id": personal_id})
    session.add(novo)
    session.commit()
    session.refresh(novo)
    return novo


def obter_ou_404(item_id: int, personal_id: int, session: Session) -> ExercicioPersonalizado:
    """O item, desde que seja deste personal — senão, 404 (nunca 403)."""
    item = session.get(ExercicioPersonalizado, item_id)
    if not item or item.personal_id != personal_id:
        raise INEXISTENTE
    return item


def atualizar(
    item_id: int,
    dados: ExercicioPersonalizadoCriacao,
    personal_id: int,
    session: Session,
) -> ExercicioPersonalizado:
    item = obter_ou_404(item_id, personal_id, session)
    item.sqlmodel_update(dados.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def arquivar(item_id: int, personal_id: int, session: Session) -> ExercicioPersonalizado:
    item = obter_ou_404(item_id, personal_id, session)
    item.arquivado_em = datetime.now(timezone.utc)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def desarquivar(item_id: int, personal_id: int, session: Session) -> ExercicioPersonalizado:
    item = obter_ou_404(item_id, personal_id, session)
    item.arquivado_em = None
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def listar_do_personal(
    personal_id: int, session: Session, incluir_arquivados: bool = False
) -> list[ExercicioPersonalizado]:
    consulta = select(ExercicioPersonalizado).where(
        ExercicioPersonalizado.personal_id == personal_id
    )
    if not incluir_arquivados:
        consulta = consulta.where(ExercicioPersonalizado.arquivado_em.is_(None))
    return list(session.exec(consulta.order_by(ExercicioPersonalizado.nome)).all())


def buscar_publicos(
    personal_id: int,
    session: Session,
    busca: str | None = None,
    musculo: str | None = None,
    equipamento: str | None = None,
    categoria: str | None = None,
    nivel: str | None = None,
) -> list[dict]:
    """Os itens ativos do personal, no formato do catálogo, já filtrados."""
    itens = listar_do_personal(personal_id, session)

    if busca:
        termo = _sem_acento(busca)
        itens = [i for i in itens if termo in _sem_acento(i.nome)]
    if musculo:
        itens = [i for i in itens if musculo in i.musculos_primarios]
    if equipamento:
        itens = [i for i in itens if i.equipamento == equipamento]
    if categoria:
        itens = [i for i in itens if i.categoria == categoria]
    if nivel:
        itens = [i for i in itens if i.nivel == nivel]

    return [publico(i) for i in itens]


def obter_publico(exercicio_id: str, personal_id: int, session: Session) -> dict | None:
    numero = _id_numerico(exercicio_id)
    if numero is None:
        return None
    item = session.get(ExercicioPersonalizado, numero)
    if not item or item.personal_id != personal_id:
        return None
    return publico(item, completo=True)


def resumo_publico(exercicio_id: str, personal_id: int, session: Session) -> dict | None:
    numero = _id_numerico(exercicio_id)
    if numero is None:
        return None
    item = session.get(ExercicioPersonalizado, numero)
    if not item or item.personal_id != personal_id:
        return None
    return resumo(item)


def existe(exercicio_id: str, personal_id: int, session: Session) -> bool:
    numero = _id_numerico(exercicio_id)
    if numero is None:
        return False
    item = session.get(ExercicioPersonalizado, numero)
    return bool(item and item.personal_id == personal_id and item.arquivado_em is None)
