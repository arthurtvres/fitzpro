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
python tests/teste_isolamento.py
```

## Estrutura

```text
backend/app/      API, models, services e migrations
frontend/src/     React, telas, componentes, estilos e cliente HTTP
```
