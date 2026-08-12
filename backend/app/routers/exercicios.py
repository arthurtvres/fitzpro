from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencias import usuario_atual
from app.services import catalogo

# O catálogo é público dentro do sistema: qualquer usuário logado consulta.
router = APIRouter(
    prefix="/exercicios",
    tags=["exercicios"],
    dependencies=[Depends(usuario_atual)],
)


@router.get("")
def listar_exercicios(
    busca: str | None = None,
    musculo: str | None = None,
    equipamento: str | None = None,
    categoria: str | None = None,
    nivel: str | None = None,
    limite: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Catálogo paginado. Filtros são combináveis e recebem o valor em inglês."""
    total, itens = catalogo.listar(
        busca=busca,
        musculo=musculo,
        equipamento=equipamento,
        categoria=categoria,
        nivel=nivel,
        limite=limite,
        offset=offset,
    )
    return {"total": total, "itens": itens}


# Precisa vir antes de /{exercicio_id}, senão "filtros" é lido como um id.
@router.get("/filtros")
def listar_filtros():
    """Valores disponíveis para os selects, com rótulo em português."""
    return catalogo.filtros()


@router.get("/{exercicio_id}")
def buscar_exercicio(exercicio_id: str):
    exercicio = catalogo.obter(exercicio_id)
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado")
    return exercicio
