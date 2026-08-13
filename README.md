# FitzPro

SaaS para personal trainers gerenciarem alunos, treinos, dietas, avaliacoes e acompanhamento de execucao. O aluno acessa o mesmo sistema para consultar os proprios planos, registrar treinos/refeicoes e acompanhar evolucao.

## Stack

- Backend: FastAPI, SQLModel, SQLite, Alembic, JWT
- Frontend: React, Vite, Lucide, CSS proprio
- Catalogo: 873 exercicios do [free-exercise-db](https://github.com/yuhonas/free-exercise-db)

## Principais Recursos

- Cadastro e login de personal e aluno
- Isolamento por personal: cada personal enxerga apenas seus alunos
- Prescricao de treinos com exercicios do catalogo
- Prescricao de dietas com refeicoes, macros e calorias
- Avaliacoes fisicas com medidas, IMC e fotos
- Registro de execucao de treino e dieta pelo aluno
- Painel de acompanhamento com atividade, cargas e alunos que precisam de atencao
- Area do aluno com treino do dia, dieta, evolucao e contato do personal
- Tema claro/escuro e layout responsivo

## Estrutura

```text
FitzPro/
  backend/
    app/
      core/        # config, seguranca e dependencias de tenant/auth
      db/          # engine e sessao
      models/      # modelos SQLModel
      routers/     # rotas da API
      services/    # regras de negocio e agregacoes
      data/        # catalogo de exercicios
    alembic/       # migrations
    tests/         # testes de isolamento/permissoes
  frontend/
    src/
      api/         # cliente HTTP
      components/  # componentes compartilhados
      features/    # telas por dominio
      styles/      # tokens, base, layout e componentes
```

## Como Rodar

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

O seed cria dados demo e imprime as credenciais. Por padrao:

```text
personal@fitzpro.local
fitzpro123
```

Alunos demo usam a senha:

```text
aluno123
```

### Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

Variavel opcional:

```text
VITE_API_URL=http://127.0.0.1:8000
```

## Banco e Migrations

O backend aplica `alembic upgrade head` ao iniciar. O SQLite local fica em `backend/fitzpro.db` e e criado automaticamente.

Comandos uteis:

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

## Regras Importantes

- Um personal e dono apenas dos alunos que cadastrou.
- Aluno acessa somente os proprios treinos, dietas, avaliacoes e execucoes.
- Registros de execucao guardam snapshot do que foi feito para nao depender da prescricao futura.
- Fotos sao salvas como data URL base64, reduzidas no frontend antes do envio.

## Proximos Passos

- Recuperacao de senha por email
- Convite do aluno para definir a propria senha
- Termos de uso e politica de privacidade reais
- Agenda completa
- Templates e duplicacao de treinos/dietas
- Paginacao nas listagens
