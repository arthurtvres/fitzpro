from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ORIGENS_PERMITIDAS, TITULO
from app.db.session import create_db_and_tables
from app.routers import agendamentos, auth, avaliacoes, dietas, exercicios, treinos, usuarios
from app.services import catalogo

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    catalogo.carregar()
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

@app.get("/")
def read_root():
    return {"mensagem": "FitzPro está no ar!"}
