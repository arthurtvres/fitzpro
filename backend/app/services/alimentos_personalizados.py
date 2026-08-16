"""
Alimentos personalizados: a biblioteca própria do personal, fora da TACO.

Mesma ideia de `exercicios_personalizados.py` — CRUD via banco e tradução
para o formato que `alimentos.py` expõe, para a busca combinada (TACO +
personalizados) devolver itens indistinguíveis em forma. `alimentos.py`
continua puro e sem `Session`.

Os ids da TACO continuam inteiros, sem mudança — evita quebrar blob de dieta
já salvo. Um item personalizado é exposto como `"personal:<id>"` na busca
combinada; todo consumidor atual (chave React, blob JSON da dieta) já trata
o id como token opaco.
"""

import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import AlimentoPersonalizado, AlimentoPersonalizadoCriacao
from app.services.alimentos import LIMIARES

PREFIXO = "personal:"

INEXISTENTE = HTTPException(status_code=404, detail="Alimento não encontrado")


def _sem_acento(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn"
    )


def eh_personalizado(alimento_id) -> bool:
    return isinstance(alimento_id, str) and alimento_id.startswith(PREFIXO)


def publico(item: AlimentoPersonalizado) -> dict:
    """Mesmo formato de item da TACO, com a procedência explícita."""
    return {
        "id": f"{PREFIXO}{item.id}",
        "nome": item.nome,
        "kcal": item.kcal,
        "proteina_g": item.proteina_g,
        "carboidrato_g": item.carboidrato_g,
        "gordura_g": item.gordura_g,
        "fibra_g": item.fibra_g,
        "fonte": "personal",
        # Mesma chave usada pela TACO para ordenação alfabética sem acento.
        "busca": _sem_acento(item.nome),
        # Sem isto o front nunca sabe que um item está arquivado — a linha
        # sempre mostraria "Arquivar", nunca "Desarquivar".
        "arquivado_em": item.arquivado_em,
    }


def criar(
    dados: AlimentoPersonalizadoCriacao, personal_id: int, session: Session
) -> AlimentoPersonalizado:
    novo = AlimentoPersonalizado.model_validate(dados, update={"personal_id": personal_id})
    session.add(novo)
    session.commit()
    session.refresh(novo)
    return novo


def obter_ou_404(item_id: int, personal_id: int, session: Session) -> AlimentoPersonalizado:
    """O item, desde que seja deste personal — senão, 404 (nunca 403)."""
    item = session.get(AlimentoPersonalizado, item_id)
    if not item or item.personal_id != personal_id:
        raise INEXISTENTE
    return item


def atualizar(
    item_id: int,
    dados: AlimentoPersonalizadoCriacao,
    personal_id: int,
    session: Session,
) -> AlimentoPersonalizado:
    item = obter_ou_404(item_id, personal_id, session)
    item.sqlmodel_update(dados.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def arquivar(item_id: int, personal_id: int, session: Session) -> AlimentoPersonalizado:
    item = obter_ou_404(item_id, personal_id, session)
    item.arquivado_em = datetime.now(timezone.utc)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def desarquivar(item_id: int, personal_id: int, session: Session) -> AlimentoPersonalizado:
    item = obter_ou_404(item_id, personal_id, session)
    item.arquivado_em = None
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def listar_do_personal(
    personal_id: int, session: Session, incluir_arquivados: bool = False
) -> list[AlimentoPersonalizado]:
    consulta = select(AlimentoPersonalizado).where(
        AlimentoPersonalizado.personal_id == personal_id
    )
    if not incluir_arquivados:
        consulta = consulta.where(AlimentoPersonalizado.arquivado_em.is_(None))
    return list(session.exec(consulta.order_by(AlimentoPersonalizado.nome)).all())


def buscar_publicos(
    personal_id: int,
    session: Session,
    busca: str | None = None,
    fonte: str | None = None,
) -> list[dict]:
    """Os itens ativos do personal, no formato da TACO, já filtrados."""
    itens = listar_do_personal(personal_id, session)

    if fonte in LIMIARES:
        campo, minimo = LIMIARES[fonte]
        itens = [i for i in itens if getattr(i, campo) is not None and getattr(i, campo) >= minimo]

    if busca and busca.strip():
        termo = _sem_acento(busca)
        itens = [i for i in itens if termo in _sem_acento(i.nome)]

    return [publico(i) for i in itens]
