# syntax=docker/dockerfile:1
#
# Build multi-estágio: compila o front e serve ele pelo próprio backend — o
# mesmo arranjo que `app/main.py` já espera (DIRETORIO_FRONTEND olha para
# `../frontend/dist` a partir de `backend/`). Por isso a imagem final mantém
# `/app/backend` e `/app/frontend/dist` como irmãos: é o layout que o código
# já sabe encontrar, sem precisar de FITZPRO_DIR_FRONTEND em produção.
#
# Build a partir da raiz do repo:
#   docker build -t fitzpro .
# Estágio de desenvolvimento (sem o build do front, com --reload):
#   docker build --target backend-dev -t fitzpro:dev .

# ---------- frontend: build do React/Vite ----------
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend

# Copia só o necessário pra instalar antes do resto do código — o cache do
# Docker reaproveita o `npm ci` enquanto package*.json não mudar.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

# ---------- backend: dependências ----------
FROM python:3.13-slim AS backend-base
WORKDIR /app/backend

# Mesmo raciocínio de cache: requirements.txt muda bem menos que o código.
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/app ./app

# ---------- dev: hot-reload, sem o build do front ----------
# É o alvo que o docker-compose usa em desenvolvimento: monta backend/app como
# volume e roda com --reload. O front, em dev, continua servido pelo Vite na
# porta 5173 — não pelo backend — então este estágio não builda nem copia o
# front, o que também evita reconstruir a imagem a cada `npm install`.
FROM backend-base AS backend-dev
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------- produção: backend servindo o build do front ----------
FROM backend-base AS backend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 8000

# Sem curl na imagem slim — um GET em Python puro basta pro HEALTHCHECK do
# Docker/compose, e é o mesmo endpoint que um load balancer de produção usaria.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
