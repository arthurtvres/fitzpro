from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import DIRETORIO_FRONTEND, ORIGENS_PERMITIDAS, TITULO
from app.db.session import create_db_and_tables
from app.routers import (
    agendamentos,
    alimentos,
    auth,
    avaliacoes,
    dietas,
    execucoes,
    exercicios,
    painel,
    progressao,
    treinos,
    usuarios,
)
from app.services import alimentos as tabela_alimentos
from app.services import catalogo

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    catalogo.carregar()
    tabela_alimentos.carregar()
    yield

app = FastAPI(title=TITULO, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENS_PERMITIDAS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(agendamentos.router)
app.include_router(avaliacoes.router)
app.include_router(treinos.router)
app.include_router(dietas.router)
app.include_router(exercicios.router)
app.include_router(alimentos.router)

# Depois de treinos e dietas: as rotas de execução estendem esses prefixos, e a
# ordem mantém a disciplina de literal antes de paramétrica no nível do router.
app.include_router(execucoes.router_treino)
app.include_router(execucoes.router_dieta)
app.include_router(progressao.router)
app.include_router(painel.router)

# ---------- o front, quando existe um build ----------
#
# Isto fica no fim de propósito: o FastAPI casa rotas na ordem em que foram
# registradas, e o coringa abaixo pega qualquer caminho. Declarado antes dos
# routers, ele engoliria a API inteira.

if DIRETORIO_FRONTEND.is_dir():
    RAIZ_DO_FRONT = DIRETORIO_FRONTEND.resolve()
    INDEX = RAIZ_DO_FRONT / "index.html"

    # Os arquivos com hash no nome. Servidos por aqui, e não pelo coringa,
    # porque o StaticFiles devolve 404 de verdade para asset inexistente — o
    # coringa devolveria o index.html, e o navegador tentaria executar HTML
    # como JavaScript, com uma mensagem de erro que não ajuda ninguém.
    if (RAIZ_DO_FRONT / "assets").is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=RAIZ_DO_FRONT / "assets"),
            name="assets",
        )

    @app.get("/{caminho:path}", include_in_schema=False)
    def servir_front(caminho: str):
        """
        Arquivo, se existir; senão o index.html — o fallback de SPA.

        É o que faz `/alunos/12` e `/redefinir?token=...` funcionarem ao serem
        recarregados ou colados numa aba nova. Sem isso, quem abre um link do
        e-mail recebe 404: aquelas rotas só existem dentro do React.
        """
        alvo = (RAIZ_DO_FRONT / caminho).resolve()

        # `is_relative_to` é a trava contra `../`: sem ela, `GET /../../etc/passwd`
        # sairia deste diretório e o servidor entregaria arquivo de fora do build.
        if caminho and alvo.is_file() and alvo.is_relative_to(RAIZ_DO_FRONT):
            return FileResponse(alvo)
        return FileResponse(INDEX)

else:

    @app.get("/")
    def read_root():
        return {"mensagem": "FitzPro está no ar!"}
