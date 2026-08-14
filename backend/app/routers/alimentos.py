"""
Consulta à tabela de alimentos (TACO). Somente leitura, como o catálogo.

Exige sessão, mas não distingue papel: a tabela é pública em origem e igual
para todo mundo. Não há dado de aluno nem de personal aqui.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencias import usuario_atual
from app.models import Usuario
from app.services import alimentos as tabela

router = APIRouter(prefix="/alimentos", tags=["alimentos"])

@router.get("")
def listar_alimentos(
    busca: str | None = None,
    limite: int = tabela.LIMITE_PADRAO,
    fonte: str | None = None,
    ordenar: str = "nome",
    _: Usuario = Depends(usuario_atual),
):
    """
    Busca por trecho, sem acento, com filtro e ordenação **antes do limite**.

    Filtrar no cliente seria filtrar a página já cortada: "mais proteína" sobre
    os 60 primeiros em ordem alfabética não devolve os alimentos com mais
    proteína da tabela, devolve os mais proteicos entre os que começam com A.
    """
    return tabela.listar(busca, min(limite, 100), fonte, ordenar)

@router.get("/filtros")
def filtros_disponiveis(_: Usuario = Depends(usuario_atual)):
    """O que a tela pode oferecer — a lista vive no servidor, não duplicada lá."""
    return {
        "fontes": list(tabela.LIMIARES),
        "ordenacoes": list(tabela.ORDENACOES),
    }

@router.get("/{alimento_id}")
def buscar_alimento(alimento_id: int, _: Usuario = Depends(usuario_atual)):
    alimento = tabela.obter(alimento_id)
    if not alimento:
        raise HTTPException(status_code=404, detail="Alimento não encontrado")
    return alimento
