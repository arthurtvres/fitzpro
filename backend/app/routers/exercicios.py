from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.dependencias import personal_atual, tenant_de, usuario_atual
from app.db.session import get_session
from app.models import ExercicioPersonalizadoCriacao, Usuario
from app.services import catalogo
from app.services import exercicios_personalizados as personalizados

# O catálogo é público dentro do sistema: qualquer usuário logado consulta.
router = APIRouter(
    prefix="/exercicios",
    tags=["exercicios"],
    dependencies=[Depends(usuario_atual)],
)

# Teto interno para trazer "todo" o catálogo filtrado antes de misturar com os
# itens personalizados e paginar o combinado — bem acima dos 873 do dataset.
_SEM_LIMITE_INTERNO = 10_000


@router.get("")
def listar_exercicios(
    busca: str | None = None,
    musculo: str | None = None,
    equipamento: str | None = None,
    categoria: str | None = None,
    nivel: str | None = None,
    # "catalogo" ou "personal" busca só um lado — é o que a tela usa para
    # separar as abas "free-exercise-db" e "Meus exercícios". Ausente, mistura
    # os dois: é o caso do autocompletar, que sugere dos dois catálogos juntos.
    fonte: str | None = None,
    limite: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    """
    Catálogo paginado, opcionalmente misturado com a biblioteca do tenant.

    Um aluno vê os itens do próprio personal — precisa, para ler a instrução
    de um exercício que foi prescrito pra ele. A paginação é sobre o
    combinado: por isso o catálogo é buscado inteiro aqui dentro antes de
    cortar a página, e não com o `limite`/`offset` que a tela pediu.
    """
    itens_catalogo = []
    if fonte != "personal":
        _, brutos = catalogo.listar(
            busca=busca,
            musculo=musculo,
            equipamento=equipamento,
            categoria=categoria,
            nivel=nivel,
            limite=_SEM_LIMITE_INTERNO,
            offset=0,
        )
        itens_catalogo = [{**e, "fonte": "catalogo"} for e in brutos]

    itens_personal = []
    if fonte != "catalogo":
        itens_personal = personalizados.buscar_publicos(
            tenant_de(logado),
            session,
            busca=busca,
            musculo=musculo,
            equipamento=equipamento,
            categoria=categoria,
            nivel=nivel,
        )

    combinados = sorted(itens_catalogo + itens_personal, key=lambda e: e["nome"])
    return {"total": len(combinados), "itens": combinados[offset : offset + limite]}


# Precisa vir antes de /{exercicio_id}, senão os nomes fixos abaixo são lidos
# como um id.
@router.get("/filtros")
def listar_filtros():
    """Valores disponíveis para os selects, com rótulo em português."""
    return catalogo.filtros()


@router.post("/personalizados", status_code=201)
def criar_exercicio_personalizado(
    dados: ExercicioPersonalizadoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.criar(dados, logado.id, session)
    return personalizados.publico(item, completo=True)


# Precisa vir antes de /personalizados/{item_id}, senão "mine" é lido como um id.
@router.get("/personalizados/mine")
def listar_meus_exercicios(
    incluir_arquivados: bool = False,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    itens = personalizados.listar_do_personal(logado.id, session, incluir_arquivados)
    return [personalizados.publico(i, completo=True) for i in itens]


@router.put("/personalizados/{item_id}")
def atualizar_exercicio_personalizado(
    item_id: int,
    dados: ExercicioPersonalizadoCriacao,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.atualizar(item_id, dados, logado.id, session)
    return personalizados.publico(item, completo=True)


@router.post("/personalizados/{item_id}/arquivar")
def arquivar_exercicio_personalizado(
    item_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.arquivar(item_id, logado.id, session)
    return personalizados.publico(item, completo=True)


@router.post("/personalizados/{item_id}/desarquivar")
def desarquivar_exercicio_personalizado(
    item_id: int,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(personal_atual),
):
    item = personalizados.desarquivar(item_id, logado.id, session)
    return personalizados.publico(item, completo=True)


@router.get("/{exercicio_id}")
def buscar_exercicio(
    exercicio_id: str,
    session: Session = Depends(get_session),
    logado: Usuario = Depends(usuario_atual),
):
    if personalizados.eh_personalizado(exercicio_id):
        exercicio = personalizados.obter_publico(exercicio_id, tenant_de(logado), session)
    else:
        exercicio = catalogo.obter(exercicio_id)

    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado")
    return exercicio
