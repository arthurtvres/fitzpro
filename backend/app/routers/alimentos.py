"""
Consulta à tabela de alimentos (TACO), misturada com a biblioteca de alimentos
personalizados do tenant de quem pediu.

Exige sessão, mas o catálogo TACO em si não distingue papel — é público e
igual para todo mundo. O que é do tenant (itens personalizados) exige olhar
quem está logado.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.dependencias import personal_atual, tenant_de, usuario_atual
from app.db.session import get_session
from app.models import AlimentoPersonalizadoCriacao, Usuario
from app.services import alimentos as tabela
from app.services import alimentos_personalizados as personalizados

router = APIRouter(prefix="/alimentos", tags=["alimentos"])

# Teto interno para trazer "toda" a TACO filtrada antes de misturar com os
# itens personalizados e cortar o `limite` pedido — acima dos 597 do dataset.
_SEM_LIMITE_INTERNO = 10_000


@router.get("")
def listar_alimentos(
    busca: str | None = None,
    limite: int = tabela.LIMITE_PADRAO,
    fonte: str | None = None,
    ordenar: str = "nome",
    # "taco" ou "personal" busca só um lado — é o que a tela usa para separar
    # as abas "TACO" e "Meus alimentos". Ausente, mistura os dois: é o caso do
    # autocompletar da dieta, que sugere dos dois catálogos juntos.
    #
    # Nome diferente de `fonte` de propósito: `fonte` já é o filtro por macro
    # ("proteina", "fibra"...) e também é o nome do campo que cada item da
    # resposta carrega para dizer de onde veio ("taco"/"personal") — usar o
    # mesmo nome aqui criaria um terceiro sentido para a mesma palavra.
    origem: str | None = None,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """Busca por trecho, sem acento, com filtro e ordenação **antes do limite**."""
    limite = min(limite, 100)

    itens_taco = []
    if origem != "personal":
        itens_taco = [
            {**a, "fonte": "taco"}
            for a in tabela.listar(busca, _SEM_LIMITE_INTERNO, fonte, "nome")
        ]

    itens_personal = []
    if origem != "taco":
        itens_personal = personalizados.buscar_publicos(
            tenant_de(logado), session, busca=busca, fonte=fonte
        )

    combinados = tabela.ordenar_itens(itens_taco + itens_personal, ordenar)
    return combinados[:limite]


@router.get("/filtros")
def filtros_disponiveis(_: Usuario = Depends(usuario_atual)):
    """O que a tela pode oferecer — a lista vive no servidor, não duplicada lá."""
    return {"fontes": list(tabela.LIMIARES), "ordenacoes": list(tabela.ORDENACOES)}


@router.post("/personalizados", status_code=201)
def criar_alimento_personalizado(
    dados: AlimentoPersonalizadoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.criar(dados, logado.id, session)
    return personalizados.publico(item)


# Precisa vir antes de /personalizados/{item_id}, senão "mine" é lido como um id.
@router.get("/personalizados/mine")
def listar_meus_alimentos(
    incluir_arquivados: bool = False,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    itens = personalizados.listar_do_personal(logado.id, session, incluir_arquivados)
    return [personalizados.publico(i) for i in itens]


@router.get("/personalizados/{item_id}")
def buscar_alimento_personalizado(
    item_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.obter_ou_404(item_id, logado.id, session)
    return personalizados.publico(item)


@router.put("/personalizados/{item_id}")
def atualizar_alimento_personalizado(
    item_id: int,
    dados: AlimentoPersonalizadoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.atualizar(item_id, dados, logado.id, session)
    return personalizados.publico(item)


@router.post("/personalizados/{item_id}/arquivar")
def arquivar_alimento_personalizado(
    item_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.arquivar(item_id, logado.id, session)
    return personalizados.publico(item)


@router.post("/personalizados/{item_id}/desarquivar")
def desarquivar_alimento_personalizado(
    item_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.desarquivar(item_id, logado.id, session)
    return personalizados.publico(item)


@router.get("/{alimento_id}")
def buscar_alimento(alimento_id: int, _: Usuario = Depends(usuario_atual)):
    alimento = tabela.obter(alimento_id)
    if not alimento:
        raise HTTPException(status_code=404, detail="Alimento não encontrado")
    return {**alimento, "fonte": "taco"}
