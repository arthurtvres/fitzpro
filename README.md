# FitzPro

SaaS para personal trainers prescreverem treinos, dietas e avaliações, com área do aluno para acompanhar planos, execução e evolução.

## Stack

- Backend: FastAPI, SQLModel, SQLite, Alembic, JWT
- Frontend: React, Vite, Lucide, CSS próprio
- Catálogo: 873 exercícios do [free-exercise-db](https://github.com/yuhonas/free-exercise-db)

## Recursos

- Cadastro e login de personal e aluno
- Gestão de alunos por personal
- Prescrever treino e montar exercícios, séries, reps, carga e descanso
- Prescrever dieta com refeições, macros e calorias
- Nova avaliação com medidas, IMC e fotos
- Acompanhamento de treinos, cargas e alunos que precisam de atenção
- Área do aluno com treino do dia, dieta, evolução e contato do personal
- Tema claro/escuro e layout responsivo

## Rodando o Projeto

### Backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt

cd backend
python -m app.seed
uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000  
Swagger: http://127.0.0.1:8000/docs

Credenciais demo:

```text
personal@fitzpro.local
fitzpro123
```

Senha dos alunos demo:

```text
aluno123
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

Variável opcional:

```text
VITE_API_URL=http://127.0.0.1:8000
```

## Rodando com Docker

Alternativa ao setup manual acima — sobe banco, API e front com um comando só,
igual em qualquer máquina.

```bash
docker compose up --build
```

API em http://localhost:8000, front em http://localhost:5173. O backend roda
com `--reload` e o front com o Vite normal — ambos com o código montado como
volume, então editar local reflete nos containers sem rebuild.

> **Limitação conhecida:** o compose já sobe um Postgres (serviço `db`) e
> aponta o backend pra ele via `FITZPRO_DB_URL`, mas o histórico de migrations
> foi gerado todo contra SQLite — pelo menos uma (`38ae877c9498`) usa um tipo
> `Enum` que falha em Postgres por faltar o `CREATE TYPE`. Corrigir isso é
> parte da troca de banco (próxima etapa). Até lá, `docker compose up` sobe
> banco e front normalmente, mas o backend derruba nessa migration. Sem usar o
> compose — `docker build` + `docker run` direto, como o CI faz — funciona
> hoje porque cai no default SQLite.

Build de produção (mesma imagem que o CI valida a cada push/PR):

```bash
docker build -t fitzpro .
docker run -p 8000:8000 fitzpro
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) roda em todo push/PR pra main:
suíte de isolamento do backend, build do front e build da imagem Docker. Não
publica nada ainda — falta decidir onde hospedar em produção.

## Banco

O backend roda as migrations ao iniciar. O SQLite local fica em `backend/fitzpro.db`.

```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "descricao"
alembic downgrade -1
```

## Testes

```bash
cd backend
PYTHONPATH=. python tests/teste_isolamento.py
```

(No Windows/cmd: `set PYTHONPATH=.` antes, ou `$env:PYTHONPATH="."` no PowerShell. Sem isso o import de `app.*` falha — o script não é instalado como pacote.)

## Estrutura

```text
backend/app/      API, models, services e migrations
frontend/src/     React, telas, componentes, estilos e cliente HTTP
```
