# FitzPro

SaaS de gestão para personal trainers: cada personal tem sua conta, seus alunos, e
monta treinos a partir de um catálogo de 873 exercícios, dietas e avaliações físicas.
O aluno entra no mesmo sistema e acompanha o que é dele.

- **Backend**: API REST em FastAPI + SQLModel + SQLite (`backend/`)
- **Frontend**: SPA em React + Vite (`frontend/`)
- **Catálogo**: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense),
  empacotado em `backend/app/data/exercises.json`

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework web | FastAPI 0.141 |
| ORM / validação | SQLModel 0.0.39 (SQLAlchemy 2.0 + Pydantic 2) |
| Banco | SQLite (`backend/fitzpro.db`, criado automaticamente) |
| Migrations | Alembic |
| Servidor | Uvicorn |
| Autenticação | JWT (PyJWT) + bcrypt |
| Front | React 19 + Vite, sem framework de UI |

## Multi-tenant: a ideia central

**Cada personal é um tenant.** Um aluno pertence ao personal que o cadastrou, e nada
atravessa essa fronteira: listar, ler, editar ou apagar qualquer coisa de outro
personal responde **404** — nunca 403, porque um 403 confirmaria que aquele id existe
e deixaria varrer a base contando os alunos dos concorrentes. Para quem está de fora,
o que não é seu simplesmente não existe.

O dono é a coluna `usuario.personal_id`. Um PERSONAL tem `personal_id` nulo (é o topo
do próprio tenant); um ALUNO aponta para o personal dele.

Toda a regra vive em [core/dependencias.py](backend/app/core/dependencias.py), em duas
funções — e todo router passa por elas:

| Função | O que garante |
| --- | --- |
| `tenant_de(usuario)` | O tenant a que alguém pertence: para o personal, ele mesmo; para o aluno, o dono |
| `aluno_do_tenant(id, logado, session)` | O único caminho até um aluno. Junta as três perguntas — existe, é ALUNO, é seu |

Treino, dieta, avaliação, agendamento e execução não têm dono próprio: o dono é o do
aluno. Por isso cada router tem um `buscar_ou_404` que resolve o registro e depois passa
o `aluno_id` dele por `aluno_do_tenant`.

**A única exceção à regra "escrita só pelo personal"** são as rotas de execução, e ela é
segura pelo mesmo caminho: o aluno escreve, mas só depois de o `buscar_ou_404` do treino
ou da dieta ter confirmado que aquilo é dele. Nenhuma lógica de isolamento nova — ver
"Progressão".

## Estrutura

```
FitzPro/
├── backend/
│   ├── alembic/
│   │   ├── env.py           # aponta para o metadata do SQLModel e a URL do config
│   │   └── versions/        # 6 migrations (ver "Banco e migrations")
│   ├── alembic.ini
│   ├── app/
│   │   ├── main.py          # cria o app, CORS, registra os routers, lifespan
│   │   ├── core/
│   │   │   ├── config.py    # caminhos, URL do banco, CORS, segredo do JWT
│   │   │   ├── seguranca.py # hash de senha (bcrypt) e emissão/leitura do token
│   │   │   └── dependencias.py  # quem está logado, de que tenant, e o que pode
│   │   ├── db/
│   │   │   └── session.py   # engine, get_session, `alembic upgrade head` no startup
│   │   ├── models/          # Usuario, Avaliacao, Treino, TreinoExercicio, Dieta,
│   │   │                    # Agendamento, SessaoTreino, ExecucaoExercicio,
│   │   │                    # ExecucaoRefeicao
│   │   ├── routers/         # auth, usuarios, avaliacoes, treinos, dietas, exercicios,
│   │   │                    # agendamentos, execucoes, progressao
│   │   ├── seed.py          # personal + 4 alunos demo com treinos, dieta e avaliações
│   │   ├── services/
│   │   │   ├── catalogo.py  # catálogo em memória (busca, filtros, PT)
│   │   │   ├── dias.py      # dia da semana canônico (ver "dia_semana")
│   │   │   ├── plano_alimentar.py  # lê as refeições de dentro do JSON da dieta
│   │   │   ├── series.py    # séries realizadas e o volume que sai delas
│   │   │   ├── sessao.py    # abrir, resolver e fechar sessão de treino
│   │   │   ├── desempenho.py       # semana, consistência, volume, calendário
│   │   │   └── progressao.py       # histórico de carga, "pronto para subir", recorde
│   │   └── data/
│   │       └── exercises.json  # 873 exercícios do free-exercise-db (1 MB)
│   ├── tests/
│   │   └── teste_isolamento.py # 108 asserções: isolamento, permissões, execução e sessão
│   ├── requirements.txt
│   └── fitzpro.db           # gerado no primeiro start (fora do git)
├── frontend/                # SPA React + Vite (ver seção "Frontend")
└── venv/                    # ambiente Python (fica na raiz, serve o backend)
```

Cada entidade tem dois modelos: `XCriacao` (o que o cliente envia no corpo) e `X`
(a tabela, que herda de `XCriacao` e acrescenta os campos controlados pelo servidor,
como `id`, `ativo`, `ordem` e `personal_id`). Isso mantém o schema do POST/PUT limpo
no `/docs` — e, mais importante, **impede o cliente de definir campos que são do
servidor**: se `personal_id` entrasse pelo corpo, bastaria mandar outro id para
cadastrar aluno na conta alheia.

Os caminhos vêm de [config.py](backend/app/core/config.py), derivados da localização do
arquivo e não do diretório de onde o servidor subiu — `uvicorn` funciona de qualquer lugar.

## Como rodar

```bash
python -m venv venv
venv\Scripts\activate                 # Windows
pip install -r backend/requirements.txt

cd backend
python -m app.seed                    # cria o primeiro personal + dados demo
uvicorn app.main:app --reload
```

O seed imprime as credenciais (`personal@fitzpro.local` / `fitzpro123`) e é idempotente.
Para escolher as suas: `python -m app.seed email@dominio senha "Seu Nome"`.
Os alunos demo entram com a senha `aluno123`.

- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

Também dá para criar conta pela tela de cadastro do front, sem passar pelo seed.

### Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `FITZPRO_SEGREDO` | Segredo do JWT. O default existe **só** para desenvolvimento |
| `FITZPRO_DB_URL` | Aponta app e Alembic para outro banco (testes, migration em banco limpo) |

## Banco e migrations

O startup roda `alembic upgrade head` ([db/session.py](backend/app/db/session.py)), então
o banco se cria e se atualiza sozinho. Não existe mais `create_all` nem `ALTER TABLE`
escrito à mão.

```bash
cd backend
alembic upgrade head                        # aplica o que falta
alembic revision --autogenerate -m "..."    # nova migration a partir do modelo
alembic downgrade -1                        # volta uma
```

| Revisão | O que faz |
| --- | --- |
| `90d28405102b` | Esquema inicial: as 6 tabelas |
| `c9320d108c2f` | `personal_id` — o tenant. Adota os alunos que já existiam, dando-os ao personal mais antigo |
| `38ae877c9498` | Cadastro: telefone, porte da carteira, aceite de termos |
| `138206c4723c` | Remove `apps_atuais` |
| `a73159822f8b` | `execucaoexercicio` e `execucaorefeicao` — o registro do que foi feito |
| `0f684accd538` | `sessaotreino`, colunas de volume, e `dia_semana` normalizado. Tem 3 backfills |

Duas coisas que o autogenerate **não** faz sozinho e precisam de revisão manual:

- **Migration de dado.** Adicionar `personal_id` sem dar dono aos alunos existentes os
  deixaria invisíveis para todo mundo, já que tudo passou a filtrar por dono.
- **FK precisa de nome explícito.** O autogenerate escreve `create_foreign_key(None, ...)`,
  e o SQLite não tem como remover uma constraint sem nome no downgrade.
- **Coluna NOT NULL em tabela com linhas** precisa de `server_default`.

## Modelos

### Usuario
Personal e aluno são o mesmo modelo, separados por `papel`.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | gerado pelo banco |
| `nome` | str | |
| `email` | str | único; usado para entrar |
| `senha` | str | **só entra** (no POST); o que se guarda é o hash bcrypt |
| `papel` | enum | `PERSONAL` ou `ALUNO`. **Nunca vem do corpo** (ver abaixo) |
| `personal_id` | int? | o tenant. Nulo no personal; no aluno, o dono. Definido pelo servidor |
| `telefone` | str? | guardado só em dígitos; obrigatório para aluno |
| `data_nascimento` | date? | a `idade` sai daqui, calculada — não é campo do banco |
| `sexo` | str? | `F`, `M` ou `OUTRO` |
| `altura_cm` | float? | usada para o IMC das avaliações |
| `objetivo` | str | texto livre (ex.: "hipertrofia") |
| `foto_url` | str? | avatar como data URL base64, validado e limitado a 400 KB |
| `ativo` | bool | default `true`; **não** aceito no corpo do POST/PUT |
| `quantidade_alunos` | enum? | resposta do cadastro (`FaixaDeAlunos`); só personal |
| `aceitou_termos` / `termos_aceitos_em` | bool / datetime? | registro do aceite, em UTC |

**O papel não vem do cliente.** `POST /usuarios` sempre cria ALUNO; personal nasce
só em `POST /auth/registrar`. E o `PUT` ignora o campo — o corpo não promove ninguém
a personal nem rebaixa ninguém a aluno.

A senha **nunca** aparece em resposta nenhuma: o que sai é `senha_hash` removido e
`idade` acrescentada (ver `publico()` em [models/usuario.py](backend/app/models/usuario.py)).
Existe também `cartao_de_contato()`, o recorte mínimo que o aluno vê do personal dele —
lista explícita, e não `publico()` com exclusões, para um campo novo no modelo não
passar a vazar sozinho.

### Avaliacao
Uma medição datada. O que muda com o tempo (peso, medidas) fica aqui; o que muda pouco
(nascimento, altura) fica no usuário.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | |
| `aluno_id` | int | FK → usuario.id; vem da URL, não do corpo |
| `data` | date | default hoje |
| `peso_kg` `percentual_gordura` `massa_muscular_kg` | float? | |
| `cintura_cm` `quadril_cm` `braco_cm` `coxa_cm` `torax_cm` | float? | |
| `observacao` | str? | |
| `fotos` | str? | JSON de data URLs; o front reduz cada foto a 1024px antes de enviar |
| `imc` | — | **derivado**: peso da avaliação ÷ altura do perfil; não é coluna |

### Treino
| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | |
| `nome` | str | |
| `dia_semana` | str | |
| `aluno_id` | int | FK → usuario.id (papel ALUNO) |
| `descricao` | str | opcional (default `""`) — observação geral; a série vem dos exercícios |

### TreinoExercicio
A prescrição de um exercício do catálogo dentro de um treino.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | |
| `treino_id` | int | FK → treino.id; vem da URL, não do corpo |
| `exercicio_id` | str | id no catálogo, ex. `Barbell_Full_Squat` |
| `series` | int | default 3 |
| `repeticoes` | str | texto de propósito: aceita `"8-12"`, `"até a falha"` |
| `carga_kg` | float? | opcional |
| `descanso_segundos` | int? | opcional |
| `observacao` | str? | opcional |
| `ordem` | int | controlada pelo servidor (0, 1, 2...) |

### Dieta
| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | |
| `nome` | str | |
| `descricao` | str | pode ser texto livre **ou** um plano alimentar em JSON (refeições e alimentos) |
| `calorias` | int | |
| `aluno_id` | int | FK → usuario.id |

### Agendamento
| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | |
| `data` | date | |
| `horario` | time | |
| `tipo` | enum | `TREINO` ou `AVALIACAO` |
| `aluno_id` | int | FK → usuario.id |
| `treino_id` | int? | obrigatório quando o tipo é TREINO; validado contra o aluno |
| `titulo` `observacao` | str | opcionais |

### SessaoTreino
Uma ida à academia: um treino, num dia, com hora de início e fim.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `aluno_id` | int | |
| `treino_id` | int? | **anulável** + `treino_nome` copiado ao lado: "Último treino: Costas + Bíceps" sobrevive ao personal apagar o treino |
| `data` | date | coluna própria, **não** derivada de `iniciada_em` — toda agregação é por dia e entra em índice, e derivar de UTC faria quem treina às 22h cair no dia seguinte |
| `iniciada_em` / `finalizada_em` | datetime | UTC |
| `duracao_segundos` | int? | denormalizado. **Nulo = desconhecida** (sessão abandonada ou retroativa da migration), não zero |
| `implicita` | bool | `false` = apertou "Iniciar treino"; `true` = só foi marcando |

Existe porque duração virou requisito — e resolve de quebra a limitação de o mesmo
treino só poder ser feito uma vez por dia. Sessão aberta há mais de 4h é fechada
preguiçosamente, sem job, por quem passar por `resolver`.

### ExecucaoExercicio
Um exercício dado como feito, num dia. **O registro é fato imutável do passado; a
prescrição é intenção mutável do presente** — por isso a linha aponta para a prescrição
*e* copia dela.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | int | |
| `aluno_id` | int | sai de `treino.aluno_id`, **nunca** do corpo |
| `data` | date | default hoje; futuro é recusado com 400 |
| `carga_kg` | float? | o que o aluno de fato levantou |
| `observacao` | str? | |
| `treino_id` `treino_exercicio_id` | int? | **anuláveis**: apagar a prescrição desvincula, não apaga |
| `exercicio_id` | str | id do catálogo, copiado — é ele que responde "quanto levantei da última vez" |
| `series_prescritas` `repeticoes_prescritas` `carga_prescrita_kg` | — | o alvo vigente **naquele dia** |
| `sessao_id` | int? | a que sessão pertence. É a chave natural nova |
| `series_realizadas` | str? | JSON `[{"reps":10,"carga_kg":77.5}]` — o "10 · 9 · 8" da tela |
| `series_feitas` `repeticoes_totais` | int | |
| `volume_kg` | float? | **denormalizado**: somar a semana é a pergunta cara, e somar JSON exigiria `json.loads` linha a linha |
| `volume_estimado` | bool | `true` quando as séries vieram do preenchimento automático |
| `registrado_por_id` | int | o aluno, ou o personal ao lado dele |
| `registrado_em` | datetime | UTC |

Chave natural **`(aluno, sessão, prescrição)`**, com unique: marcar duas vezes atualiza,
não duplica; dois treinos iguais no mesmo dia são duas sessões e duas linhas.

A idempotência **não** vem do índice — no SQLite nulo não colide. Vem de o servidor
nunca gravar com `sessao_id` nulo: `services/sessao.resolver` resolve a sessão explícita,
a aberta do dia, a última do dia, ou cria uma implícita, nessa ordem.

Só existe **um ponto de escrita** dos campos de volume, `services/series.consolidar` — é
o que mantém o JSON e a coluna denormalizada em acordo. `carga_kg` passou a ser o
**máximo das séries**, que é o que deixou `avaliar()`, `pronto_para_subir` e o gráfico
funcionando sem reescrita.

**Por que copiar o alvo:** sem esse retrato, "bateu o alvo" mudaria de resposta
retroativamente a cada edição da carga, e o aviso "pronto para subir" acenderia por causa
de uma edição do personal, não de um esforço do aluno.

### ExecucaoRefeicao
Uma refeição dada como consumida, num dia. Mesma forma, com `dieta_id` (anulável),
`refeicao_id` (o id de dentro do JSON) e o snapshot `refeicao_nome`, `refeicao_horario`,
`calorias`, `proteinas_g`, `carboidratos_g`, `gorduras_g`.

**Aqui o snapshot não é luxo.** Diferente do exercício, que aponta para um catálogo
estático e sempre resolvível, a refeição é identificada por um id gerado no navegador,
dentro de uma coluna de texto que `PUT /dietas/{id}` sobrescreve inteira. Sem a cópia,
"você consumiu 1.480 kcal na terça" viraria zero assim que o personal editasse o plano.

*Consequência aceita:* o numerador (kcal consumidas) é sempre verdadeiro, mas o
denominador de um dia antigo — quantas refeições o plano tinha — não é recuperável. Por
isso o percentual só vale para o plano vigente.

---

## Endpoints

52 rotas. Só `POST /auth/login`, `POST /auth/registrar` e `GET /` dispensam token.

### Raiz
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | health check — `{"mensagem": "FitzPro está no ar!"}` |

### Autenticação — `/auth`
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/auth/login` | `{email, senha}` → `{access_token, token_type, usuario}` |
| POST | `/auth/registrar` | **público**: cria conta de PERSONAL e já devolve token |
| GET | `/auth/eu` | quem é o dono do token — o front usa para restaurar a sessão |

O token é um JWT de 12 horas, em `Authorization: Bearer <token>`.

`POST /auth/registrar` exige `nome`, `email`, `senha` (mín. 8), `quantidade_alunos` e
`aceitou_termos`. `telefone` é opcional. O papel é fixado no servidor.

### Usuários — `/usuarios`
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/usuarios?papel=ALUNO&incluir_inativos=false` | **só os alunos do personal logado** |
| POST | `/usuarios` | cria aluno (papel e dono definidos pelo servidor); 409 se o email existir |
| GET | `/usuarios/meu-personal` | quem treina o aluno logado: nome, email, telefone e foto |
| GET | `/usuarios/{id}` | um aluno seu, ou você mesmo |
| PUT | `/usuarios/{id}` | atualiza; **não** mexe em senha nem em papel |
| PUT | `/usuarios/{id}/senha` | troca a senha (ver regras abaixo) |
| DELETE | `/usuarios/{id}` | **soft delete**: marca `ativo = false` |
| POST | `/usuarios/{id}/reativar` | volta `ativo = true` |

`/usuarios/meu-personal` é declarada **antes** de `/usuarios/{id}`, senão `meu-personal`
seria lido como um id.

### Avaliações — `/alunos/{aluno_id}/avaliacoes`
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/alunos/{id}/avaliacoes` | da mais recente para a mais antiga, com `imc` calculado |
| POST | `/alunos/{id}/avaliacoes` | registra uma medição |
| PUT | `/alunos/{id}/avaliacoes/{avaliacao_id}` | edita |
| DELETE | `/alunos/{id}/avaliacoes/{avaliacao_id}` | remove |

### Treinos — `/treinos`
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/treinos?aluno_id=1` | dos seus alunos; cada item traz `total_exercicios` |
| POST | `/treinos` | cria treino |
| GET | `/treinos/{id}` | busca por id |
| PUT | `/treinos/{id}` | atualiza |
| DELETE | `/treinos/{id}` | remove o treino **e as prescrições dele** |

### Exercícios do treino — `/treinos/{id}/exercicios`
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/treinos/{id}/exercicios` | ordenado por `ordem`; traz a prescrição **e** o catálogo em `exercicio` |
| POST | `/treinos/{id}/exercicios` | adiciona no fim da lista |
| PUT | `/treinos/{id}/exercicios/ordem` | corpo: lista de ids na nova ordem |
| PUT | `/treinos/{id}/exercicios/{item_id}` | edita a prescrição |
| DELETE | `/treinos/{id}/exercicios/{item_id}` | remove e renumera a ordem |

`/exercicios/ordem` vem antes de `/exercicios/{item_id}` pelo mesmo motivo de
`meu-personal`.

### Dietas — `/dietas`
Mesmas rotas e comportamento dos treinos, trocando `dia_semana` por `calorias`.

### Agendamentos — `/agendamentos`
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/agendamentos?data=2026-08-12&aluno_id=1` | com o aluno e o treino embutidos |
| POST | `/agendamentos` | valida que o treino é do aluno |
| PUT | `/agendamentos/{id}` | atualiza |
| DELETE | `/agendamentos/{id}` | remove |

### Catálogo — `/exercicios` (somente leitura)
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/exercicios` | `busca`, `musculo`, `equipamento`, `categoria`, `nivel`, `limite` (1–100), `offset` → `{total, itens}` |
| GET | `/exercicios/filtros` | valores disponíveis para os selects, com rótulo em português |
| GET | `/exercicios/{id}` | detalhe: instruções passo a passo e as duas fotos |

### Execução — registrar o que foi feito
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/treinos/{id}/sessoes` | "Iniciar treino". Fecha a que estiver aberta — ninguém está em duas academias |
| POST | `/treinos/{id}/sessoes/{sid}/finalizar` | fecha, calcula a duração e devolve os recordes da sessão |
| DELETE | `/treinos/{id}/sessoes/{sid}` | cancela; **400** se já tiver exercício registrado |
| GET | `/treinos/{id}/progresso?data=&sessao_id=` | o treino do dia: feito, faltando, séries, volume e a carga da última vez |
| PUT | `/treinos/{id}/exercicios/{item_id}/execucao` | marca o exercício como feito |
| DELETE | `/treinos/{id}/exercicios/{item_id}/execucao?data=` | desmarca |
| GET | `/dietas/{id}/progresso?data=` | refeições do dia + `calorias_consumidas` vs `calorias_meta` |
| PUT | `/dietas/{id}/refeicoes/{refeicao_id}/execucao` | marca a refeição como consumida |
| DELETE | `/dietas/{id}/refeicoes/{refeicao_id}/execucao?data=` | desmarca |

É `PUT` na chave natural `(item, dia)` e não `POST` + `DELETE /{id}`: o controle na tela é
uma caixa de marcar, e checkbox é idempotente — o front não precisa guardar id de execução
para desmarcar.

### Progressão — ler o histórico
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/alunos/{id}/progressao/treinos` | uma linha por prescrição: prescrita × última × melhor + `pronto_para_subir` |
| GET | `/alunos/{id}/progressao/exercicios/{exercicio_id}` | a série do exercício, por mês, com as últimas execuções e as reps por série |
| GET | `/alunos/{id}/progressao/resumo?data=` | **tudo o que a Home do aluno mostra**, numa requisição |

Só leitura. Nenhuma rota daqui altera prescrição.

`/resumo` é um endpoint e não vários porque a Home é uma tela só, carregada de uma vez,
num celular na academia: N endpoints seriam N round-trips, N `aluno_do_tenant` e a mesma
janela semanal recalculada N vezes — todos os cards derivam do **mesmo** array de sessões.
Seção sem dado vira `null`, não uma requisição que falha. Custa ~10 queries, todas
limitadas, nenhuma crescendo com o número de exercícios da tela.

Blocos da resposta: `hoje.treinos[]` (com `ultima_vez`), `semana.dias[7]`
(`estado ∈ feito|hoje|previsto|perdido|vazio`), `consistencia`, `volume`
(`semana`, `anterior`, `variacao_percentual`), `carga_destaque`, `ultimo_treino`,
`corpo`, `dieta`, `recorde` e `personal`.

**Todo bloco de volume carrega a procedência**, nunca um número solto:
`{total_kg, estimado, execucoes_detalhadas, execucoes_estimadas, execucoes_sem_volume}`.
Um total meio estimado exibido como exato é pior do que nenhum total — daí o `≈` na tela.

### Permissões

| Ação | PERSONAL | ALUNO |
| --- | --- | --- |
| Listar/criar/editar alunos | só os seus | **403** |
| Criar/editar/apagar treino, dieta, avaliação, agendamento | só dos seus alunos | **403** |
| Ver treinos, dietas, avaliações e agenda | dos seus alunos | só os seus |
| Editar o próprio cadastro e trocar a própria senha | sim | sim |
| Ver o cadastro de outro usuário | só dos seus alunos | **404**, nem colegas nem o personal |
| Ver quem é o seu personal | — | sim, via `/usuarios/meu-personal` |
| Registrar/desmarcar execução de exercício ou refeição | dos alunos dele | **só as próprias** |
| Ver progresso do dia e histórico de carga | dos alunos dele | só o dele |
| Alterar a prescrição a partir da sugestão | sim | **403** |
| Consultar o catálogo de exercícios | sim | sim |

`GET /treinos`, `/dietas` e `/agendamentos` ignoram o `?aluno_id=` quando quem pede é um
aluno: a listagem é forçada para o id dele.

### Regras de negócio
- Sem token, ou com token inválido/expirado → **401** `"Não autenticado"`.
- Login com email inexistente e com senha errada devolvem **a mesma** mensagem: dizer qual
  dos dois falhou entregaria quais emails existem no sistema.
- Conta inativa não entra → **403**; o personal não pode desativar a si mesmo → **400**.
- Troca de senha: o personal redefine a de um aluno seu sem saber a atual; **trocar a
  própria exige a senha atual, inclusive para o personal** — sem isso, um token vazado
  troca a senha e toma a conta de vez.
- Criar ou atualizar treino/dieta/agendamento valida o `aluno_id`:
  - id inexistente, de quem não é ALUNO, ou de outro tenant → **404** `"Aluno não encontrado"`
  - aluno inativo → **400** `"Aluno está inativo"`
- Telefone é obrigatório para aluno e opcional para personal. A checagem é **por papel, na
  rota** — o mesmo corpo de PUT serve ao personal editando um aluno, ao personal editando
  a si mesmo e ao aluno editando a si mesmo, e só o primeiro exige.
- Usuário usa soft delete; treino, dieta, avaliação e agendamento usam delete real.
- Adicionar exercício valida o id no catálogo → **404** `"Exercício não encontrado"`.
- Apagar um treino apaga as prescrições dele: o SQLite não cascateia por padrão.

### Progressão: como a carga sobe

O aluno registra o **exercício inteiro** como feito (não série a série), com carga usada e
observação opcionais. Disso saem duas coisas:

1. **Progresso do dia** — "3 de 8 exercícios", "2 de 4 refeições · 1.130 de 2.000 kcal".
2. **Evolução de carga** — o aluno vê "última vez: 77,5 kg"; o personal vê a série e um
   aviso **"pronto para subir"**.

`pronto_para_subir` é derivado em [services/progressao.py](backend/app/services/progressao.py),
sem coluna e sem job: o aluno bateu a carga prescrita nas **2 últimas** sessões. A sequência
conta a partir da mais recente e **quebra no primeiro tropeço** — uma sessão abaixo do alvo
zera o contador, que é o que um treinador espera.

**O alvo é a carga, e só ela.** `repeticoes` é texto livre no modelo (cabe `"8-12"` e
`"até a falha"`), então comparar reps feitas com prescritas exigiria um parser que erra em
silêncio. Carga é float, e é o número que o personal muda quando decide progredir.

**Volume = Σ(carga × reps), com a procedência junto.** Marcar continua sendo **um toque**:
sem `series` no corpo, o servidor preenche a partir do prescrito e marca
`volume_estimado`. Quem detalha série a série ganha volume exato. Faixa de repetições
conta pelo **piso** (`"8-12"` → 8) — estimativa nunca infla. `"até a falha"` e `"45s"` não
viram número nenhum: a execução fica sem volume e é contada à parte, porque inventar seria
pior que não ter.

**Recorde pessoal** é derivado, sem coluna, como o `pronto_para_subir`: carga ≥ anterior
**+ 0,5 kg** (granularidade de anilha, mata ruído de float) **e** ≥ **3 execuções
anteriores**. O piso é o que impede a primeira semana do app disparar troféu em toda
linha, que é como esse tipo de feature morre. Aparece em três lugares e só: ao finalizar
a sessão, num card da Home se for dos últimos 7 dias, e como marcador no gráfico.

**Nada muda sozinho.** O sistema sinaliza; quem altera a prescrição é o personal, pelo
formulário que já existe. Uma carga que sobe automaticamente tira dele o controle do que
prescreveu — e ele é quem sabe se o aluno bateu o alvo com técnica ou empurrando com o corpo.

**Apagar a prescrição apaga o plano, nunca o passado.** `deletar_treino`,
`remover_exercicio` e `deletar_dieta` desvinculam as execuções (`SET NULL`) em vez de
apagá-las: se o personal reorganizar um treino, o histórico de carga do aluno — justamente
o dado que a feature existe para produzir — não pode ir junto.

### `dia_semana`: canônico na escrita

`Treino.dia_semana` sempre foi string livre, e o dado sujou — `"terça"` do seed convivia
com `"terca"` dos testes. A Home do personal comparava com um normalizador e a do aluno
com `==` estrito, então **um treino salvo com o acento "errado" aparecia para o personal e
sumia para o aluno** (o filtro por dia em `ViewPlanos` tinha o mesmo problema).

Agora o banco guarda sempre a forma sem acento: um `field_validator` em `TreinoCriacao`
normaliza na escrita e recusa dia desconhecido com 422, e a migration `0f684accd538`
converteu o que já existia. Quem exibe usa `dias.ROTULOS`; no front, o mesmo normalizador
vive em [utils/dias.js](frontend/src/utils/dias.js) e serve às três telas.

Não virou enum SQL: o SQLite não tem, e seria um CHECK travando migração futura.

**O backend passou a ler o JSON do plano alimentar.** É o acoplamento mais caro desta
feature: [services/plano_alimentar.py](backend/app/services/plano_alimentar.py) espelha
[dietaPlano.js](frontend/src/features/planos/dietaPlano.js), e mudar um lado exige mudar o
outro. O campo `versao`, gravado desde sempre e nunca lido, finalmente ganhou uso: formato
mais novo do que o backend entende é ignorado, em vez de lido pela metade.

### Segurança
- Senha guardada como hash **bcrypt** ([core/seguranca.py](backend/app/core/seguranca.py));
  o texto puro nunca é salvo nem devolvido.
- O segredo do JWT vem de `FITZPRO_SEGREDO`. O default existe só para desenvolvimento — em
  produção é obrigatório definir a variável, senão qualquer um forja um token válido.
- O token guarda id e papel, mas o papel é **reconferido no banco** a cada requisição: se a
  conta for desativada, o token já emitido para de valer na hora.
- Campos que aceitam data URL (`foto_url`, `avaliacao.fotos`) são validados e limitados —
  sem isso a coluna TEXT aceitaria texto qualquer, de qualquer tamanho.

### Testes

```bash
cd backend
PYTHONPATH=. python tests/teste_isolamento.py     # sai com código 1 se algo falhar
```

108 asserções cobrindo o isolamento entre dois personais, as permissões do aluno, as
regras do cadastro, o registro de execução, o ciclo de vida da sessão, o cálculo de
volume e a detecção de recorde. Não usa pytest nem httpx (nenhum dos dois está instalado): chama as
funções de rota diretamente, que é onde a lógica de tenant vive.

### O catálogo de exercícios
São 873 exercícios num JSON de 1 MB versionado em `backend/app/data/`. Como o dado é
somente leitura e pequeno, [catalogo.py](backend/app/services/catalogo.py) carrega tudo em
memória no startup — busca e filtro rodam sem tocar o banco.

As **imagens não estão no projeto** (seriam ~96 MB): a API devolve URLs apontando para o
GitHub Pages do dataset, então o navegador precisa de internet para exibi-las.

Os nomes e as instruções ficam em inglês, como vêm da fonte. Já os valores de filtro —
17 músculos, 12 equipamentos, 7 categorias, 3 níveis — têm rótulo em português por tabela
fixa no próprio `services/catalogo.py`. Vários registros vêm com `equipment`, `force` ou
`mechanic` nulos; esses viram "não informado".

---

## Frontend

SPA em **React 19 + Vite**, na pasta [frontend/](frontend/). Consome a API pelos mesmos
endpoints documentados acima — nada de mock.

**São dois apps no mesmo código**, escolhidos pelo `papel` de quem entrou: o painel do
personal e a área do aluno. Não é o mesmo painel com botões escondidos — as tarefas são
outras. O personal gerencia muitos alunos; o aluno consulta o que é dele.

Organizado por **feature**: o que é de um domínio fica junto; em `components/` só entra
o que é genérico e reusável.

```
frontend/
├── index.html
├── public/                     # fitzpro.png (sidebar), fitzprologin.png (cards), favicon
├── vite.config.js
├── .env.example                # VITE_API_URL
└── src/
    ├── main.jsx                # monta o React e carrega Inter + estilos
    ├── App.jsx                 # sessão, escolha do app por papel, e o painel do personal
    ├── api/
    │   ├── client.js           # fetch, token, erro do FastAPI, montarQuery
    │   ├── auth.js  alunos.js  treinos.js  dietas.js
    │   ├── exercicios.js  agendamentos.js  perfil.js
    │   ├── execucoes.js  progressao.js
    │   └── index.js            # exporta o objeto `api` — os componentes importam daqui
    ├── config/navegacao.js     # menu do personal
    ├── components/             # genéricos
    │   ├── Sidebar.jsx  Header.jsx  Modal.jsx
    │   ├── Avatar.jsx  CampoFoto.jsx  BarraProgresso.jsx
    │   └── Badge.jsx  Skeleton.jsx  Vazio.jsx
    ├── features/
    │   ├── auth/               # Login, CriarConta
    │   ├── aluno/              # AreaDoAluno, HojeDoAluno, MeusPlanos,
    │   │                       # MinhaEvolucao, navegacao.js
    │   ├── inicio/             # Home — o resumo do dia do personal
    │   ├── alunos/             # ListaAlunos, FormularioAluno, DetalheAluno,
    │   │                       # ViewAlunos, PainelAvaliacoes, ViewAvaliacoes, CriarAvaliacao
    │   ├── planos/             # ViewPlanos, PainelPlano, ListaPlanos, DetalhePlano,
    │   │                       # FormularioPlano, FormularioDieta, config.js, dietaPlano.js
    │   ├── treinos/            # DetalheTreino, ItemPrescricao, FormularioPrescricao
    │   ├── perfil/             # MeuPerfil — serve personal e aluno
    │   ├── progressao/         # HistoricoCarga (sparkline SVG), PainelProgressao
    │   └── exercicios/         # CatalogoExercicios, DetalheExercicio
    ├── utils/
    │   ├── imagem.js           # redimensiona foto de perfil (256px) e de evolução (1024px)
    │   └── telefone.js         # máscara, dígitos e as faixas do cadastro
    └── styles/
        ├── index.css           # só os @import — a ordem importa para a cascata
        ├── tokens.css          # design system: cor, espaço, forma
        ├── base.css            # reset, tipografia, botões e campos
        ├── layout.css          # shell, sidebar, header, responsivo
        └── componentes.css     # cards, listas, badges, modal, skeletons
```

### Navegação do personal

```
Início        (atalho)          → home: métricas, treinos de hoje e quem precisa de atenção
Alunos        ├── Ver alunos    → lista em largura total; clicar abre o aluno em modal
              └── Cadastrar aluno
Treinos       ├── Ver treinos   → todos, filtráveis por aluno
              └── Criar treino
Dietas        ├── Ver dietas    └── Criar dieta
Avaliações    ├── Ver avaliações└── Criar avaliação
Exercícios    └── Catálogo      → os 873, com busca e filtros
Minha conta   (atalho)          → dados, foto e troca de senha
```

A montagem do treino não fica no menu: chega-se nela pela ação **montar** no cartão do
treino. Clicar na logo da sidebar volta para o início.

O menu vive em [config/navegacao.js](frontend/src/config/navegacao.js) e tem dois tipos de
entrada: **atalho** (tem `rota`) e **grupo** (tem `itens`, expande). Para acrescentar uma
seção, adicione a entrada lá e trate a chave em `App.jsx`. O campo `icone` guarda só o
nome; quem resolve para o componente Lucide é a `Sidebar`, então a config segue dado puro.

A rota é estado do React, não URL. Quando o app crescer, trocar por `react-router` mexe só
no `App.jsx` e no `aoNavegar` da sidebar.

### Navegação do aluno

```
Hoje            → treino de hoje, semana, consistência, carga, evolução e dieta
Meus treinos    → lista; abre com séries × reps, carga e as instruções do catálogo
Minha dieta     → o plano alimentar, refeição por refeição
Minha evolução  → métricas da última medição vs. a primeira, e o histórico com fotos
Exercícios      → o catálogo, para consultar execução
Minha conta     → dados e troca de senha
```

### A Home do aluno é sobre execução

Ela girava em torno de contadores — "treinos na semana: 3", "dias com treino: 2" — que não
usavam o dado mais valioso do sistema: o que o aluno **fez**. A hierarquia agora responde
às perguntas na ordem em que elas aparecem:

1. **Treino de hoje** — nome, progresso, e "última vez: 4 exercícios · 14 séries · 51 min
   · 4.475 kg". A última vez fica logo abaixo porque é ela que ancora a decisão de carga.
2. **Esta semana · Consistência · Carga total**, com a variação contra a semana anterior.
3. **Sua semana** — os 7 dias com estado, montado **no servidor**: "previsto" depende de
   comparar `dia_semana` normalizado, e foi essa comparação, feita no cliente, que
   produziu o bug de um treino sumir da tela.
4. **Evolução de carga** e **último treino**.
5. **Evolução corporal** e **plano alimentar**.

Tudo vem de `/progressao/resumo` — uma requisição. `HojeDoAluno` não busca nada, é
composição pura dos cards em `features/aluno/home/`.

O gráfico é o `Sparkline` de `components/`, extraído do `HistoricoCarga` onde nascera como
função local. Ele ganhou `escalaTemporal`: a versão original distribuía os pontos por
**índice**, então três meses de intervalo ocupavam a mesma largura que dois dias. O default
é `false` para a extração ter sido um refactor idêntico; só as telas novas ligam.

A `Sidebar` é a mesma dos dois apps: recebe a lista de navegação por prop
([features/aluno/navegacao.js](frontend/src/features/aluno/navegacao.js)), em vez de ter um
`if` por papel.

**O aluno lê o plano e registra o que fez.** As telas de treino e dieta reusam
`DetalhePlano` — o mesmo componente que o personal vê no modal do aluno, que para treino
delega ao `DetalheTreino` em `somenteLeitura`. A prop `modoExecucao` é **ortogonal** a
`somenteLeitura`: liga as caixas de marcar e o histórico sem reabrir a edição. O aluno usa
as duas juntas; o personal pode usar só `modoExecucao` para registrar ao lado dele na
academia.

Marcar é otimista com rollback, igual ao reordenar que já existia: quem está na academia
com o celular na mão não deve esperar a rede para ver o toque valer. A evolução é tela própria: o `PainelAvaliacoes` do personal existe para
*registrar* medições, e o aluno quer *acompanhar* a dele.

Na evolução, as setas de variação **não** são coloridas por padrão. Perder peso é bom para
quem quer emagrecer e ruim para quem quer ganhar massa; um verde errado seria pior que não
colorir nada. Só "massa muscular subindo" ganha verde, onde o sentido é inequívoco.

### Fotos

Avatar de usuário e fotos de avaliação são **data URLs base64 em coluna do banco** — não há
upload de arquivo. Isso só se sustenta porque [utils/imagem.js](frontend/src/utils/imagem.js)
reduz a imagem **antes** de enviar:

| | perfil | evolução |
| --- | --- | --- |
| Tamanho | 256px | 1024px |
| Forma | recorte quadrado no centro | proporção preservada, nunca amplia |
| Por quê | é avatar redondo, e volta em toda listagem | serve para comparar duas datas |

Uma foto de celular tem 3–8 MB; reduzida a 256px em JPEG dá ~15 KB.

### Design system

Tema claro, no estilo SaaS: fundo cinza, cards brancos, sidebar grafite e azul reservado
para ação. Tudo sai de [styles/tokens.css](frontend/src/styles/tokens.css) — trocar um valor
lá repinta a interface inteira, porque os nomes são semânticos (`--fundo`, `--superficie`,
`--borda`, `--acento`) e as regras nunca usam cor literal.

| | |
| --- | --- |
| Fundo / card / borda | `#F8F9FA` / `#FFFFFF` / `#E7E9EC` |
| Texto / secundário | `#171A1F` / `#636872` |
| Sidebar | `#111318`, 248px, fixa |
| Sucesso / alerta / erro | `#22C55E` / `#F59E0B` / `#EF4444` |
| Raio | card 12px, controle 8px |
| Espaço | grid de 4/8px (`--e-1` … `--e-6`) |
| Tipografia | Inter 400/500/600/700, self-hosted via `@fontsource` |
| Ícones | Lucide |

**Sobre o azul.** A marca é `#168BFF`, mas branco sobre ele dá 3.4:1 — abaixo do mínimo de
4.5:1 do WCAG AA para texto normal. Então o token se divide: `--acento` (`#168BFF`) fica em
ícone, borda e anel de foco, onde não carrega texto; `--acento-solido` (`#0F74D9`, 4.65:1)
preenche botão e item ativo do menu; e `--acento-texto` (`#0A68C6`) é o azul de link.

Bordas finas em vez de sombras — sombra só no que realmente flutua (modal e drawer).
Carregamento usa skeleton, não texto; estado vazio tem ícone e frase.
Abaixo de 1024px a sidebar vira drawer, aberto pelo botão de menu no header.

### Treino e dieta compartilham o código

As duas entidades têm o mesmo CRUD e divergem em um campo (`dia_semana` como select de dias
vs `calorias` numérico). Essa diferença vive em `CONFIG_TREINO` / `CONFIG_DIETA`
([features/planos/config.js](frontend/src/features/planos/config.js)); formulário, lista e
telas são os mesmos componentes recebendo a config como prop.

O formulário serve dois contextos: com `alunoFixo` (dentro do detalhe do aluno) ele esconde
o seletor; com `alunos` ele mostra, listando só os ativos — porque a API recusa os inativos
com 400. Mesmo padrão de `CatalogoExercicios` com `aoSelecionar`.

### Rodando

Com o backend no ar (`uvicorn app.main:app --reload`, de dentro de `backend/`):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

A URL da API sai de `VITE_API_URL` (default `http://127.0.0.1:8000`). Para mudar, copie
`.env.example` para `.env`. O CORS já libera `localhost:5173` e `localhost:3000` (com e sem
`127.0.0.1`) em [core/config.py](backend/app/core/config.py).

Imagens em `public/` **não levam hash no nome**, então trocar uma exige `Ctrl+Shift+R` no
navegador. E `dist/` é saída de build: qualquer arquivo colocado lá some no build seguinte.

### Sessão e erros

O token vive no `localStorage` e é injetado em toda requisição por
[api/client.js](frontend/src/api/client.js). Qualquer **401** limpa o token e devolve o
usuário para o login — nenhum componente precisa tratar isso. Ao recarregar, o App confirma
o token em `/auth/eu` antes de desenhar.

Erros da API sobem para um banner no topo; o `client.js` traduz tanto o `detail` string
(404/400) quanto a lista de erros por campo do 422. Erro de campo (email duplicado, senha
atual incorreta) fica no campo, não no banner.

```json
{ "detail": "Aluno não encontrado" }
```

Os schemas do `/openapi.json` podem gerar tipos TypeScript automaticamente
(`openapi-typescript`) se o front migrar para TS.

---

## Próximos passos

### Bloqueantes

- [ ] **Envio de e-mail.** Destrava duas coisas que hoje não têm solução:
      - **Recuperação de senha** — com o cadastro público, esquecer a senha significa
        perder a conta *e todos os alunos junto*. Não há admin para socorrer ninguém.
      - **Convite do aluno** — hoje o personal cria a conta e precisa passar a senha por
        fora. Um "definir senha no primeiro acesso" resolve, e é mais seguro que o personal
        escolher a senha de outra pessoa.
- [ ] **Termos de uso e política de privacidade.** O cadastro registra o aceite de um
      documento que não existe (os links apontam para `#termos` e `#privacidade`). O
      sistema coleta dado sensível de saúde — peso, medidas, fotos — cujo titular é o
      **aluno**, que nunca clicou em nada. Falta também guardar a **versão** dos termos
      aceitos, senão não há como provar o que a pessoa concordou.

### Produto

- [ ] Tela de agenda — o backend de agendamentos está pronto e testado; o front só usa
      `listar` e `criar` dentro da Home, e o aluno não vê os horários dele
- [ ] Painel do personal com o mesmo salto que a Home do aluno teve: hoje ele vê
      "pronto para subir" numa aba, mas não frequência, volume nem aderência dos alunos
- [ ] Exercícios próprios do personal, além do catálogo (hoje ele é somente leitura)
- [ ] Duplicar treino/dieta, templates, copiar entre alunos

### Dívida técnica

- [ ] Paginação nas listagens
- [ ] `response_model` explícito nas rotas
- [ ] Migrar os testes para pytest em arquivos separados — 108 asserções num script só
      passou bem do limite
- [ ] Avatar em base64 volta em toda listagem (~1 MB com 50 alunos). Quando incomodar, a
      saída é upload de arquivo servindo URL, que o navegador cacheia
- [ ] Fotos de avaliação salvas antes do redimensionamento seguem em resolução cheia
- [ ] `date.today()` roda no fuso do servidor, e agora convive com `iniciada_em` em UTC.
      O front manda `data` explícita, mas um aluno marcando 23h/01h em outro fuso ainda
      pode cair no dia errado
- [ ] `/progressao/resumo` é a rota mais cara do sistema, sem cache. Tudo bem no tamanho
      atual (~50 sessões por aluno em 12 semanas); vira problema com anos de histórico
