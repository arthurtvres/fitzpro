"""Configuração central: caminhos, banco e CORS.

Os caminhos são derivados da localização deste arquivo, não do diretório de onde
o servidor foi iniciado — assim `uvicorn` funciona de qualquer lugar.
"""

import os
from pathlib import Path

# config.py -> core -> app -> backend
DIRETORIO_APP = Path(__file__).resolve().parents[1]
DIRETORIO_BACKEND = DIRETORIO_APP.parent

TITULO = "FitzPro"

ARQUIVO_BANCO = DIRETORIO_BACKEND / "fitzpro.db"
# FITZPRO_DB_URL existe para apontar o app (e o Alembic) para outro banco sem
# tocar no código — testes e geração de migration contra um banco limpo.
URL_BANCO = os.getenv("FITZPRO_DB_URL", f"sqlite:///{ARQUIVO_BANCO}")

ARQUIVO_EXERCICIOS = DIRETORIO_APP / "data" / "exercises.json"

# As imagens do catálogo (~96 MB) não são versionadas: apontamos para o
# GitHub Pages do dataset de origem.
BASE_IMAGENS_EXERCICIOS = "https://yuhonas.github.io/free-exercise-db/exercises"

# Autenticação. O segredo tem default só para o ambiente de desenvolvimento —
# em produção é obrigatório definir FITZPRO_SEGREDO, senão qualquer um consegue
# forjar um token válido.
SEGREDO_JWT = os.getenv("FITZPRO_SEGREDO", "desenvolvimento-trocar-em-producao")
ALGORITMO_JWT = "HS256"
HORAS_DE_SESSAO = 12

# Origens do front em desenvolvimento (Vite usa 5173; 3000 fica aqui caso o
# projeto migre para outro dev server). Em produção isso vira variável de ambiente.
ORIGENS_PERMITIDAS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
