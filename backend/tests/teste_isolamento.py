"""Isolamento entre dois personais, exercitando os routers de verdade.

Nao usa TestClient (o httpx nao esta instalado): chama as funcoes de rota
diretamente, que e onde a logica de tenant vive.
"""

import inspect
import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone

CAMINHO = os.path.join(tempfile.mkdtemp(), "iso.db").replace("\\", "/")
os.environ["FITZPRO_DB_URL"] = f"sqlite:///{CAMINHO}"
os.environ["FITZPRO_SEGREDO"] = "teste"

from fastapi import HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

from app.core import config as config_app  # noqa: E402
from app.core.dependencias import personal_atual  # noqa: E402
from app.db.session import create_db_and_tables, engine  # noqa: E402
from app.models import (  # noqa: E402
    AvaliacaoCriacao,
    ExecucaoExercicio,
    ExecucaoExercicioEntrada,
    ExecucaoRefeicao,
    ExecucaoRefeicaoCriacao,
    FaixaDeAlunos,
    DietaCriacao,
    SerieRealizada,
    SessaoTreinoCriacao,
    TreinoCriacao,
    TreinoExercicioCriacao,
    FinalidadeDoToken,
    TokenDeAcesso,
    TrocaDeSenha,
    Usuario,
    UsuarioAtualizacao,
    UsuarioCriacao,
    publico,
)
from app.routers import auth, avaliacoes, dietas, execucoes, painel, treinos, usuarios  # noqa: E402
from app.routers import progressao as progressao_rotas  # noqa: E402
from app.seed import plano_alimentar as plano_alimentar_json  # noqa: E402
from app.seed import refeicoes_base  # noqa: E402
from app.services import catalogo, dias, plano_alimentar, progressao, token_acesso  # noqa: E402
from app.services import desempenho as desempenho_svc  # noqa: E402

create_db_and_tables()
# O catalogo e carregado no lifespan do app; aqui as rotas sao chamadas direto,
# entao ele precisa ser carregado a mao — senao `catalogo.existe` diz que nao.
catalogo.carregar()
s = Session(engine)

ok = falhas = 0

# Data de nascimento virou obrigatoria para aluno (ha verificacao de idade).
# Nos testes em que a idade nao e o assunto, usa-se este adulto fixo — data
# relativa a hoje, para nao virar menor com a passagem do tempo.
ADULTO = date.today().replace(year=date.today().year - 30)


def checar(descricao, esperado, funcao):
    """esperado: 'ok' ou o status HTTP que a chamada deve levantar."""
    global ok, falhas
    try:
        funcao()
        obtido = "ok"
    except HTTPException as e:
        obtido = e.status_code
    except ValidationError:
        # Corpo invalido: e o 422 que o FastAPI devolveria.
        obtido = 422

    passou = obtido == esperado
    ok, falhas = ok + passou, falhas + (not passou)
    marca = "PASS" if passou else "FALHA"
    print(f"  [{marca}] {descricao:52} esperado={esperado!s:4} obtido={obtido}")


def registrar(nome, email):
    resposta = auth.registrar(
        auth.Cadastro(
            nome=nome,
            email=email,
            senha="senha12345",
            quantidade_alunos=FaixaDeAlunos.ATE_5,
            aceitou_termos=True,
        ),
        s,
    )
    return s.get(Usuario, resposta["usuario"]["id"])


print("\n== montando dois personais, um aluno cada ==")
ana = registrar("Ana", "ana@x.com")
bruno = registrar("Bruno", "bruno@x.com")

aluno_ana = usuarios.criar_usuario(
    UsuarioCriacao(nome="Aluno da Ana", email="a1@x.com", senha="123456", telefone="11961234560", data_nascimento=ADULTO), s, ana
)
aluno_bruno = usuarios.criar_usuario(
    UsuarioCriacao(nome="Aluno do Bruno", email="b1@x.com", senha="123456", telefone="11961234561", data_nascimento=ADULTO), s, bruno
)
id_ana, id_bruno = aluno_ana["id"], aluno_bruno["id"]
print(f"  Ana={ana.id} (aluno {id_ana})   Bruno={bruno.id} (aluno {id_bruno})")

print("\n== o papel nao vem do corpo ==")
print(f"  aluno criado com papel={aluno_ana['papel']}  personal_id={aluno_ana['personal_id']}")
assert aluno_ana["papel"] == "ALUNO" and aluno_ana["personal_id"] == ana.id

print("\n== listagem so mostra os proprios alunos ==")
vistos_ana = [u["nome"] for u in usuarios.listar_usuarios(None, False, s, ana)]
vistos_bruno = [u["nome"] for u in usuarios.listar_usuarios(None, False, s, bruno)]
print(f"  Ana ve:   {vistos_ana}")
print(f"  Bruno ve: {vistos_bruno}")
assert vistos_ana == ["Aluno da Ana"] and vistos_bruno == ["Aluno do Bruno"]

print("\n== Ana tentando alcancar o aluno do Bruno (tudo deve dar 404) ==")
checar("GET  aluno alheio", 404, lambda: usuarios.buscar_usuario(id_bruno, s, ana))
checar("PUT  aluno alheio", 404, lambda: usuarios.atualizar_usuario(
    id_bruno, UsuarioAtualizacao(nome="Roubado", email="b1@x.com", telefone="11999999999"), s, ana))
checar("DELETE aluno alheio", 404, lambda: usuarios.desativar_usuario(id_bruno, s, ana))
checar("POST reativar aluno alheio", 404, lambda: usuarios.reativar_usuario(id_bruno, s, ana))
checar("PUT  senha do aluno alheio", 404, lambda: usuarios.trocar_senha(
    id_bruno, TrocaDeSenha(senha_nova="roubada123"), s, ana))
checar("PUT  senha do OUTRO PERSONAL", 404, lambda: usuarios.trocar_senha(
    bruno.id, TrocaDeSenha(senha_nova="roubada123"), s, ana))
checar("DELETE outro personal", 404, lambda: usuarios.desativar_usuario(bruno.id, s, ana))

print("\n== e nos proprios dados (deve passar) ==")
checar("GET  proprio aluno", "ok", lambda: usuarios.buscar_usuario(id_ana, s, ana))
checar("GET  a si mesma", "ok", lambda: usuarios.buscar_usuario(ana.id, s, ana))

print("\n== treinos, dietas e avaliacoes ==")
treino_ana = treinos.criar_treino(
    TreinoCriacao(nome="T", dia_semana="segunda", aluno_id=id_ana), s, ana)
treino_bruno = treinos.criar_treino(
    TreinoCriacao(nome="T", dia_semana="terca", aluno_id=id_bruno), s, bruno)
dieta_bruno = dietas.criar_dieta(
    DietaCriacao(nome="D", descricao="d", calorias=2000, aluno_id=id_bruno), s, bruno)

checar("POST treino para aluno alheio", 404, lambda: treinos.criar_treino(
    TreinoCriacao(nome="X", dia_semana="quarta", aluno_id=id_bruno), s, ana))
checar("GET  treino alheio", 404, lambda: treinos.buscar_treino(treino_bruno.id, s, ana))
checar("DELETE treino alheio", 404, lambda: treinos.deletar_treino(treino_bruno.id, s, ana))
checar("GET  exercicios de treino alheio", 404,
       lambda: treinos.listar_exercicios_do_treino(treino_bruno.id, s, ana))
checar("POST exercicio em treino alheio", 404, lambda: treinos.adicionar_exercicio(
    treino_bruno.id, TreinoExercicioCriacao(exercicio_id="Barbell_Squat"), s, ana))
checar("GET  dieta alheia", 404, lambda: dietas.buscar_dieta(dieta_bruno.id, s, ana))
checar("DELETE dieta alheia", 404, lambda: dietas.deletar_dieta(dieta_bruno.id, s, ana))
checar("GET  avaliacoes de aluno alheio", 404,
       lambda: avaliacoes.listar_avaliacoes(id_bruno, s, ana))
checar("POST avaliacao em aluno alheio", 404, lambda: avaliacoes.criar_avaliacao(
    id_bruno, AvaliacaoCriacao(peso_kg=80), s, ana))

nomes = [t["nome"] for t in treinos.listar_treinos(None, s, ana)]
print(f"\n  treinos que a Ana lista: {len(nomes)} (o dela: {treino_ana.id})")
assert len(nomes) == 1
assert len(dietas.listar_dietas(None, s, ana)) == 0

print("\n== o aluno logado nao ve os colegas do mesmo personal ==")
aluno2 = usuarios.criar_usuario(
    UsuarioCriacao(nome="Colega", email="a2@x.com", senha="123456", telefone="11961234562", data_nascimento=ADULTO), s, ana)
obj_aluno = s.get(Usuario, id_ana)
checar("aluno GET colega de tenant", 404,
       lambda: usuarios.buscar_usuario(aluno2["id"], s, obj_aluno))
checar("aluno GET a si mesmo", "ok", lambda: usuarios.buscar_usuario(id_ana, s, obj_aluno))
checar("aluno PUT em si mesmo", "ok", lambda: usuarios.atualizar_usuario(
    id_ana, UsuarioAtualizacao(nome="Eu mesmo", email="a1@x.com",
                               telefone="11912345678",
                               data_nascimento=ADULTO), s, obj_aluno))
checar("aluno PUT no colega", 404, lambda: usuarios.atualizar_usuario(
    aluno2["id"], UsuarioAtualizacao(nome="Invadido", email="a2@x.com",
                                     telefone="11912345678"), s, obj_aluno))
checar("aluno GET o cadastro do personal", 404,
       lambda: usuarios.buscar_usuario(ana.id, s, obj_aluno))

print("\n== mas o aluno ve QUEM e o personal dele ==")
cartao = usuarios.buscar_meu_personal(s, obj_aluno)
print(f"  cartao: {cartao}")
PROIBIDOS = {
    "data_nascimento", "sexo", "altura_cm", "objetivo", "quantidade_alunos",
    "aceitou_termos", "termos_aceitos_em", "senha_hash", "ativo", "papel",
    "personal_id", "idade",
}
vazou = PROIBIDOS & set(cartao)
print(f"  [{'PASS' if not vazou else 'FALHA'}] cartao nao vaza o perfil do personal"
      f"{'' if not vazou else f' -> {vazou}'}")
ok, falhas = ok + (not vazou), falhas + bool(vazou)

for descricao, condicao in [
    ("cartao tem o nome", cartao["nome"] == "Ana"),
    ("cartao e do personal certo", cartao["id"] == ana.id),
    ("personal chamando recebe None", usuarios.buscar_meu_personal(s, ana) is None),
    ("aluno do Bruno ve o Bruno",
     usuarios.buscar_meu_personal(s, s.get(Usuario, id_bruno))["id"] == bruno.id),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

print("\n== cadastro publico ==")
checar("email repetido", 409, lambda: auth.registrar(
    auth.Cadastro(nome="Outra", email="ana@x.com", senha="senha12345",
                  quantidade_alunos=FaixaDeAlunos.ATE_5, aceitou_termos=True), s))
checar("senha curta", 400, lambda: auth.registrar(
    auth.Cadastro(nome="C", email="c@x.com", senha="123",
                  quantidade_alunos=FaixaDeAlunos.ATE_5, aceitou_termos=True), s))
checar("nome vazio", 400, lambda: auth.registrar(
    auth.Cadastro(nome="  ", email="d@x.com", senha="senha12345",
                  quantidade_alunos=FaixaDeAlunos.ATE_5, aceitou_termos=True), s))
checar("sem aceitar os termos", 400, lambda: auth.registrar(
    auth.Cadastro(nome="E", email="e@x.com", senha="senha12345",
                  quantidade_alunos=FaixaDeAlunos.ATE_5, aceitou_termos=False), s))
checar("sem informar o porte", 422, lambda: auth.registrar(
    auth.Cadastro(nome="F", email="f@x.com", senha="senha12345",
                  aceitou_termos=True), s))

print("\n== telefone no cadastro de aluno ==")
checar("aluno sem telefone", 422, lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Sem fone", email="sf@x.com", senha="123456", data_nascimento=ADULTO), s, ana))
checar("aluno com telefone invalido", 422, lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Fone ruim", email="fr@x.com", senha="123456",
                   telefone="abc", data_nascimento=ADULTO), s, ana))

print("\n== telefone na edicao: regra e por papel, nao por schema ==")
checar("personal salva o proprio perfil sem telefone", "ok",
       lambda: usuarios.atualizar_usuario(
           ana.id, UsuarioAtualizacao(nome="Ana", email="ana@x.com",
                                      papel="PERSONAL"), s, ana))
checar("personal tira o telefone de um aluno", 400,
       lambda: usuarios.atualizar_usuario(
           id_ana, UsuarioAtualizacao(nome="Aluno", email="a1@x.com"), s, ana))

# ===================== execucao e progressao =====================
#
# Estas rotas sao as PRIMEIRAS escritas de aluno no sistema. Ate elas, "toda
# rota de escrita exige personal_atual" era regra que se lia no diff; agora ha
# excecoes que se apoiam em `aluno_do_tenant`. Uma regressao la deixa de ser bug
# de leitura e vira escrita cross-tenant — por isso o bloco 2 nao e opcional.

print("\n== cenario de execucao ==")
prescricao_ana = treinos.adicionar_exercicio(
    treino_ana.id, TreinoExercicioCriacao(exercicio_id="Barbell_Squat", series=4,
                                          repeticoes="8-12", carga_kg=80), s, ana)
prescricao_bruno = treinos.adicionar_exercicio(
    treino_bruno.id, TreinoExercicioCriacao(exercicio_id="Barbell_Squat", carga_kg=60),
    s, bruno)
treino_colega = treinos.criar_treino(
    TreinoCriacao(nome="Do colega", dia_semana="sexta", aluno_id=aluno2["id"]), s, ana)
prescricao_colega = treinos.adicionar_exercicio(
    treino_colega.id, TreinoExercicioCriacao(exercicio_id="Barbell_Squat"), s, ana)
dieta_texto = dietas.criar_dieta(
    DietaCriacao(nome="Livre", calorias=1800, aluno_id=id_ana,
                 descricao="Coma bem e beba agua"), s, ana)
dieta_ana = dietas.criar_dieta(
    DietaCriacao(nome="Plano", calorias=2000, aluno_id=id_ana,
                 descricao=plano_alimentar_json(130, 220, 55, refeicoes_base("t"))), s, ana)
refeicoes_ana = plano_alimentar.refeicoes(dieta_ana.descricao)
ref1, ref2 = refeicoes_ana[0]["id"], refeicoes_ana[1]["id"]
print(f"  prescricao da Ana={prescricao_ana['id']}  dieta={dieta_ana.id}"
      f"  {len(refeicoes_ana)} refeicoes")

print("\n== o aluno registra o que e dele ==")
checar("aluno GET progresso do proprio treino", "ok",
       lambda: execucoes.progresso_do_treino(treino_ana.id, None, s, obj_aluno))
checar("aluno PUT execucao no proprio exercicio", "ok",
       lambda: execucoes.marcar_exercicio(
           treino_ana.id, prescricao_ana["id"],
           ExecucaoExercicioEntrada(carga_kg=80), s, obj_aluno))
checar("aluno PUT execucao de refeicao propria", "ok",
       lambda: execucoes.marcar_refeicao(
           dieta_ana.id, ref1, ExecucaoRefeicaoCriacao(), s, obj_aluno))
checar("aluno GET progressao/treinos de si mesmo", "ok",
       lambda: progressao_rotas.progressao_dos_treinos(id_ana, s, obj_aluno))

print("\n== o aluno NAO registra o que nao e dele ==")
checar("aluno PUT execucao em treino de OUTRO TENANT", 404,
       lambda: execucoes.marcar_exercicio(
           treino_bruno.id, prescricao_bruno["id"],
           ExecucaoExercicioEntrada(carga_kg=200), s, obj_aluno))
checar("aluno PUT execucao no treino do COLEGA de tenant", 404,
       lambda: execucoes.marcar_exercicio(
           treino_colega.id, prescricao_colega["id"],
           ExecucaoExercicioEntrada(carga_kg=200), s, obj_aluno))
checar("aluno GET progresso de treino alheio", 404,
       lambda: execucoes.progresso_do_treino(treino_bruno.id, None, s, obj_aluno))
checar("aluno PUT execucao de refeicao em dieta alheia", 404,
       lambda: execucoes.marcar_refeicao(
           dieta_bruno.id, "ref-1", ExecucaoRefeicaoCriacao(), s, obj_aluno))
checar("aluno GET progressao do COLEGA", 404,
       lambda: progressao_rotas.progressao_dos_treinos(aluno2["id"], s, obj_aluno))
checar("aluno GET progressao do PERSONAL dele", 404,
       lambda: progressao_rotas.progressao_dos_treinos(ana.id, s, obj_aluno))

print("\n== fronteiras do personal e validacoes ==")
checar("personal registra por aluno DELE", "ok",
       lambda: execucoes.marcar_exercicio(
           treino_ana.id, prescricao_ana["id"],
           ExecucaoExercicioEntrada(carga_kg=80), s, ana))
checar("personal registra por aluno de OUTRO", 404,
       lambda: execucoes.marcar_exercicio(
           treino_bruno.id, prescricao_bruno["id"],
           ExecucaoExercicioEntrada(carga_kg=60), s, ana))
checar("item de OUTRO treino (id valido, treino trocado)", 404,
       lambda: execucoes.marcar_exercicio(
           treino_ana.id, prescricao_bruno["id"],
           ExecucaoExercicioEntrada(), s, ana))
checar("refeicao inexistente", 404,
       lambda: execucoes.marcar_refeicao(
           dieta_ana.id, "ref-nao-existe", ExecucaoRefeicaoCriacao(), s, ana))
checar("dieta de texto livre (sem plano JSON)", 400,
       lambda: execucoes.marcar_refeicao(
           dieta_texto.id, "qualquer", ExecucaoRefeicaoCriacao(), s, ana))
checar("data no futuro", 400,
       lambda: execucoes.marcar_exercicio(
           treino_ana.id, prescricao_ana["id"],
           ExecucaoExercicioEntrada(data=date.today() + timedelta(days=1)), s, ana))

print("\n== integridade do registro ==")
resposta = execucoes.marcar_exercicio(
    treino_ana.id, prescricao_ana["id"],
    ExecucaoExercicioEntrada(carga_kg=82.5, observacao="subiu facil"), s, ana)
execucao = resposta["execucao"]
for descricao, condicao in [
    ("dono sai do treino, nao do corpo", execucao["aluno_id"] == id_ana),
    ("registrado_por guarda quem apertou", execucao["registrado_por_id"] == ana.id),
    ("snapshot da carga veio do banco",
     execucao["carga_prescrita_kg"] == prescricao_ana["carga_kg"]),
    ("snapshot das series veio do banco",
     execucao["series_prescritas"] == prescricao_ana["series"]),
    ("exercicio_id copiado", execucao["exercicio_id"] == "Barbell_Squat"),
    ("marcar de novo NAO duplica", resposta["progresso"]["concluidos"] == 1),
    ("percentual derivado", resposta["progresso"]["percentual"] == 100),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

progresso_dieta = execucoes.marcar_refeicao(
    dieta_ana.id, ref2, ExecucaoRefeicaoCriacao(), s, obj_aluno)["progresso"]
kcal_esperado = int(refeicoes_ana[0]["calorias"] + refeicoes_ana[1]["calorias"])
for descricao, condicao in [
    ("2 de 3 refeicoes", progresso_dieta["concluidas"] == 2),
    ("percentual do dia", progresso_dieta["percentual"] == 67),
    ("calorias somadas do snapshot",
     progresso_dieta["calorias_consumidas"] == kcal_esperado),
    ("meta vem da coluna", progresso_dieta["calorias_meta"] == 2000),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

# ===================== sessao, volume e resumo =====================
#
# ATENCAO ao ponto de insercao: o bloco abaixo apaga o treino e a dieta da Ana,
# e afirma len(pontos)==1 para Barbell_Squat. Por isso tudo aqui usa um SEGUNDO
# treino, com Leg_Press — exercicio e treino diferentes, que nao contaminam
# aquelas assercoes.

print("\n== cenario de sessao ==")
treino2 = treinos.criar_treino(
    TreinoCriacao(nome="Treino 2", dia_semana="Quarta-feira", aluno_id=id_ana), s, ana)
presc2 = treinos.adicionar_exercicio(
    treino2.id, TreinoExercicioCriacao(exercicio_id="Leg_Press", series=4,
                                       repeticoes="10-12", carga_kg=100), s, ana)
presc2b = treinos.adicionar_exercicio(
    treino2.id, TreinoExercicioCriacao(exercicio_id="Plank", series=3,
                                       repeticoes="45s"), s, ana)
print(f"  treino2={treino2.id} (dia_semana gravado: {treino2.dia_semana})")

print("\n== dia_semana normalizado na escrita ==")
for descricao, condicao in [
    ("'Quarta-feira' virou 'quarta'", treino2.dia_semana == "quarta"),
    ("'SABADO' vira 'sabado'",
     treinos.criar_treino(TreinoCriacao(nome="X", dia_semana="SÁBADO",
                                        aluno_id=id_ana), s, ana).dia_semana == "sabado"),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)
checar("dia invalido recusado", 422, lambda: treinos.criar_treino(
    TreinoCriacao(nome="X", dia_semana="xpto", aluno_id=id_ana), s, ana))

print("\n== sessao: isolamento e ciclo de vida ==")
checar("aluno inicia sessao em treino de OUTRO TENANT", 404,
       lambda: execucoes.iniciar_sessao(treino_bruno.id, SessaoTreinoCriacao(), s, obj_aluno))
checar("aluno inicia sessao no treino do COLEGA", 404,
       lambda: execucoes.iniciar_sessao(treino_colega.id, SessaoTreinoCriacao(), s, obj_aluno))
checar("aluno inicia sessao no proprio treino", "ok",
       lambda: execucoes.iniciar_sessao(treino2.id, SessaoTreinoCriacao(), s, obj_aluno))

sessao1 = execucoes.progresso_do_treino(treino2.id, None, s, obj_aluno)["sessao"]
marcado = execucoes.marcar_exercicio(
    treino2.id, presc2["id"], ExecucaoExercicioEntrada(), s, obj_aluno)
de_novo = execucoes.marcar_exercicio(
    treino2.id, presc2["id"], ExecucaoExercicioEntrada(), s, obj_aluno)

for descricao, condicao in [
    ("sessao nasce em andamento", sessao1["em_andamento"] is True),
    ("sessao explicita nao e implicita", sessao1["implicita"] is False),
    ("marcar sem sessao_id cai na sessao aberta",
     marcado["execucao"]["sessao_id"] == sessao1["id"]),
    # A invariante que a troca da chave natural poderia ter perdido em silencio.
    ("marcar de novo na MESMA sessao nao duplica",
     de_novo["progresso"]["concluidos"] == 1),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

fim = execucoes.finalizar_sessao(treino2.id, sessao1["id"], s, obj_aluno)
checar("finalizar sessao alheia", 404,
       lambda: execucoes.finalizar_sessao(treino_bruno.id, sessao1["id"], s, bruno))
checar("cancelar sessao COM execucao", 400,
       lambda: execucoes.cancelar_sessao(treino2.id, sessao1["id"], s, ana))

# A razao de existir do modelo: o mesmo treino, duas vezes no mesmo dia.
sessao2 = execucoes.iniciar_sessao(treino2.id, SessaoTreinoCriacao(), s, obj_aluno)["sessao"]
execucoes.marcar_exercicio(treino2.id, presc2["id"], ExecucaoExercicioEntrada(), s, obj_aluno)
linhas_hoje = s.exec(select(ExecucaoExercicio).where(
    ExecucaoExercicio.treino_exercicio_id == presc2["id"],
    ExecucaoExercicio.data == date.today())).all()

for descricao, condicao in [
    ("finalizar preenche a duracao", fim["sessao"]["duracao_segundos"] is not None),
    ("finalizar fecha a sessao", fim["sessao"]["em_andamento"] is False),
    ("segunda sessao no mesmo dia cria linha nova", len(linhas_hoje) == 2),
    ("abrir a segunda fechou a primeira", sessao2["id"] != sessao1["id"]),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

print("\n== volume: exato vs estimado ==")
um_toque = execucoes.marcar_exercicio(
    treino2.id, presc2["id"], ExecucaoExercicioEntrada(), s, obj_aluno)["execucao"]
detalhado = execucoes.marcar_exercicio(
    treino2.id, presc2["id"],
    ExecucaoExercicioEntrada(series=[
        SerieRealizada(reps=12, carga_kg=100),
        SerieRealizada(reps=10, carga_kg=100),
        SerieRealizada(reps=8, carga_kg=105),
    ]), s, obj_aluno)["execucao"]
isometria = execucoes.marcar_exercicio(
    treino2.id, presc2b["id"], ExecucaoExercicioEntrada(), s, obj_aluno)["execucao"]

for descricao, condicao in [
    ("um toque estima do prescrito", um_toque["volume_estimado"] is True),
    ("um toque: 4 series x 10 reps x 100kg", um_toque["volume_kg"] == 4000),
    ("detalhado e exato", detalhado["volume_estimado"] is False),
    ("detalhado: 12*100 + 10*100 + 8*105", detalhado["volume_kg"] == 3040),
    ("carga_kg vira o maximo das series", detalhado["carga_kg"] == 105),
    ("series_feitas conta as series", detalhado["series_feitas"] == 3),
    # Plank 3x45s nao tem volume, e inventar um seria pior que nao ter.
    ("isometria fica sem volume", isometria["volume_kg"] is None),
    ("isometria ainda conta series", isometria["series_feitas"] == 3),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

checar("serie com reps negativo", 400, lambda: execucoes.marcar_exercicio(
    treino2.id, presc2["id"],
    ExecucaoExercicioEntrada(series=[SerieRealizada(reps=-5, carga_kg=10)]), s, obj_aluno))

print("\n== resumo da home ==")
checar("aluno GET resumo de si mesmo", "ok",
       lambda: progressao_rotas.resumo_do_aluno(id_ana, None, s, obj_aluno))
checar("aluno GET resumo do COLEGA", 404,
       lambda: progressao_rotas.resumo_do_aluno(aluno2["id"], None, s, obj_aluno))
checar("aluno GET resumo do PERSONAL", 404,
       lambda: progressao_rotas.resumo_do_aluno(ana.id, None, s, obj_aluno))
checar("personal GET resumo de aluno de OUTRO", 404,
       lambda: progressao_rotas.resumo_do_aluno(id_bruno, None, s, ana))

print("\n== meus treinos ==")
checar("aluno GET meus-treinos de si mesmo", "ok",
       lambda: progressao_rotas.meus_treinos(id_ana, None, s, obj_aluno))
checar("aluno GET meus-treinos do COLEGA", 404,
       lambda: progressao_rotas.meus_treinos(aluno2["id"], None, s, obj_aluno))
checar("aluno GET meus-treinos do PERSONAL", 404,
       lambda: progressao_rotas.meus_treinos(ana.id, None, s, obj_aluno))
checar("personal GET meus-treinos de aluno de OUTRO", 404,
       lambda: progressao_rotas.meus_treinos(id_bruno, None, s, ana))

meus = progressao_rotas.meus_treinos(id_ana, None, s, ana)
cartoes = {c["nome"]: c for c in meus["treinos"]}
ESTADOS = {"nunca", "pendente", "em_andamento", "concluido_hoje"}
for descricao, condicao in [
    # A rota varre os treinos do aluno; um vazamento aqui entregaria a
    # prescricao inteira de outro personal.
    ("so os treinos do proprio aluno",
     all(c["id"] in {t.id for t in desempenho_svc.treinos_do_aluno(id_ana, s)}
         for c in meus["treinos"])),
    ("todo cartao tem estado valido",
     all(c["estado"] in ESTADOS for c in meus["treinos"])),
    ("a previa nao passa de 3 exercicios",
     all(len(c["exercicios"]) <= 3 for c in meus["treinos"])),
    ("a previa nunca excede o total",
     all(len(c["exercicios"]) <= c["total_exercicios"] for c in meus["treinos"])),
    # Duracao sem historico e palpite, e a resposta tem que dizer isso: um
    # numero estimado exibido como medido e pior que numero nenhum.
    ("duracao sempre declara a procedencia",
     all(isinstance(c["duracao"]["estimada"], bool) for c in meus["treinos"])),
    ("o treino de hoje vem primeiro",
     [c["e_de_hoje"] for c in meus["treinos"]]
     == sorted([c["e_de_hoje"] for c in meus["treinos"]], reverse=True)),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

resumo = progressao_rotas.resumo_do_aluno(id_ana, None, s, ana)
hoje_canonico = dias.do_dia(date.today())
dia_de_hoje = [d for d in resumo["semana"]["dias"] if d["data"] == date.today()][0]
soma_manual = sum(
    e.volume_kg or 0
    for e in s.exec(select(ExecucaoExercicio).where(ExecucaoExercicio.aluno_id == id_ana)).all()
)

for descricao, condicao in [
    ("semana tem 7 dias", len(resumo["semana"]["dias"]) == 7),
    ("o dia de hoje esta marcado como feito ou hoje",
     dia_de_hoje["estado"] in ("hoje", "feito")),
    ("as siglas comecam na segunda", resumo["semana"]["dias"][0]["sigla"] == "SEG"),
    ("volume da semana bate com a soma manual",
     abs(resumo["volume"]["semana"]["total_kg"] - soma_manual) < 0.01),
    ("volume mistura estimado e exato -> estimado",
     resumo["volume"]["semana"]["estimado"] is True),
    ("consistencia entre 0 e 100",
     0 <= resumo["consistencia"]["percentual"] <= 100),
    ("o personal do aluno vem no resumo", resumo["personal"]["id"] == ana.id),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

print("\n== recorde pessoal ==")
# Precisa de 3 execucoes anteriores; ate la, nada de trofeu.
sem_historia = progressao_rotas.resumo_do_aluno(id_ana, None, s, ana)["recorde"]
condicao = sem_historia is None
print(f"  [{'PASS' if condicao else 'FALHA'}] sem historico suficiente, sem recorde")
ok, falhas = ok + bool(condicao), falhas + (not condicao)

for n, carga in enumerate([80, 85, 90], start=1):
    dia_passado = date.today() - timedelta(days=n * 7)
    sp = execucoes.iniciar_sessao(
        treino2.id, SessaoTreinoCriacao(data=dia_passado), s, ana)["sessao"]
    execucoes.marcar_exercicio(
        treino2.id, presc2["id"],
        ExecucaoExercicioEntrada(data=dia_passado, sessao_id=sp["id"],
                                 series=[SerieRealizada(reps=10, carga_kg=carga)]), s, ana)

sr = execucoes.iniciar_sessao(treino2.id, SessaoTreinoCriacao(), s, ana)["sessao"]
execucoes.marcar_exercicio(
    treino2.id, presc2["id"],
    ExecucaoExercicioEntrada(sessao_id=sr["id"],
                             series=[SerieRealizada(reps=8, carga_kg=120)]), s, ana)
recordes = progressao_rotas_recordes = progressao.recordes_da_sessao(id_ana, sr["id"], s)

sem_melhora = execucoes.iniciar_sessao(treino2.id, SessaoTreinoCriacao(), s, ana)["sessao"]
execucoes.marcar_exercicio(
    treino2.id, presc2["id"],
    ExecucaoExercicioEntrada(sessao_id=sem_melhora["id"],
                             series=[SerieRealizada(reps=8, carga_kg=120.2)]), s, ana)

for descricao, condicao in [
    ("carga acima de tudo vira recorde", len(recordes) == 1),
    ("recorde traz a carga anterior", recordes and recordes[0]["anterior_kg"] == 105),
    # +0,2 kg e ruido de digitacao, nao conquista.
    ("+0,2 kg nao e recorde",
     progressao.recordes_da_sessao(id_ana, sem_melhora["id"], s) == []),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

print("\n== painel do personal ==")
# O 403 do aluno mora em `personal_atual`, que e um Depends — chamar a funcao de
# rota direto o pula. Entao sao duas assercoes: a barreira funciona, e o painel
# esta atras DELA (e nao do `usuario_atual`, que deixaria o aluno entrar).
checar("aluno barrado por personal_atual", 403, lambda: personal_atual(obj_aluno))
guarda = inspect.signature(painel.resumo_do_personal).parameters["logado"].default
assert guarda.dependency is personal_atual, "o painel saiu de tras do personal_atual"
print("  [PASS] o painel depende de personal_atual")
ok += 1
checar("personal ve o proprio painel", "ok", lambda: painel.resumo_do_personal(None, s, ana))

do_ana = painel.resumo_do_personal(None, s, ana)
do_bruno = painel.resumo_do_personal(None, s, bruno)
nomes_ana = {l["aluno"]["nome"] for l in do_ana["alunos"]}
nomes_bruno = {l["aluno"]["nome"] for l in do_bruno["alunos"]}

for descricao, condicao in [
    # O painel varre a carteira inteira — se o filtro de tenant falhar aqui, o
    # personal ve os alunos do concorrente numa tabela so.
    ("painel so traz os alunos do proprio personal", nomes_ana.isdisjoint(nomes_bruno)),
    ("a Ana nao ve o aluno do Bruno", "Aluno do Bruno" not in nomes_ana),
    ("o Bruno nao ve os alunos da Ana", not (nomes_bruno & nomes_ana)),
    ("sugestoes so do proprio tenant",
     all(x["aluno_id"] in {l["aluno"]["id"] for l in do_ana["alunos"]}
         for x in do_ana["sugestoes"])),
    ("a janela e de 7 dias corridos",
     do_ana["periodo"]["dias"] == 7
     and (date.fromisoformat(str(do_ana["periodo"]["fim"]))
          - date.fromisoformat(str(do_ana["periodo"]["inicio"]))).days == 6),
    ("alunos_ativos bate com a lista",
     do_ana["periodo"]["alunos_ativos"] == len(do_ana["alunos"])),
    ("percentual_ativos e derivado, nao inventado",
     do_ana["periodo"]["percentual_ativos"]
     == desempenho_svc.percentual_ou_zero(do_ana["periodo"]["alunos_que_treinaram"],
                                          do_ana["periodo"]["alunos_ativos"])),
    ("nenhuma linha carrega volume", all("volume_kg" not in l for l in do_ana["alunos"])),
    ("todo aluno tem situacao valida",
     all(l["situacao"] in ("em_dia", "atencao", "sumido", "sem_registro")
         for l in do_ana["alunos"])),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

print("\n== o historico sobrevive a exclusao da prescricao ==")
# Este bloco trava a decisao de desenho mais facil de desfazer sem perceber:
# apagar a prescricao apaga o plano, nunca o passado.
treinos.remover_exercicio(treino_ana.id, prescricao_ana["id"], s, ana)
serie = progressao_rotas.serie_do_exercicio(id_ana, "Barbell_Squat", s, ana)
for descricao, condicao in [
    ("execucao sobrevive a remover o exercicio", len(serie["pontos"]) == 1),
    ("carga preservada", serie["pontos"][0]["carga_kg"] == 82.5),
]:
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")
    ok, falhas = ok + bool(condicao), falhas + (not condicao)

treinos.deletar_treino(treino_ana.id, s, ana)
serie = progressao_rotas.serie_do_exercicio(id_ana, "Barbell_Squat", s, ana)
condicao = len(serie["pontos"]) == 1
print(f"  [{'PASS' if condicao else 'FALHA'}] execucao sobrevive a apagar o treino inteiro")
ok, falhas = ok + bool(condicao), falhas + (not condicao)

dietas.deletar_dieta(dieta_ana.id, s, ana)
restantes = s.exec(select(ExecucaoRefeicao).where(
    ExecucaoRefeicao.aluno_id == id_ana)).all()
condicao = len(restantes) == 2 and all(e.dieta_id is None for e in restantes)
print(f"  [{'PASS' if condicao else 'FALHA'}] refeicoes sobrevivem a apagar a dieta")
ok, falhas = ok + bool(condicao), falhas + (not condicao)

# ===================== recuperacao de senha =====================
#
# E a primeira rota PUBLICA de escrita depois de /registrar: nao ha token, nao
# ha `usuario_atual`, e o unico que separa o dono da conta de qualquer um e o
# link. Por isso as invariantes do token sao teste, e nao comentario.

print("\n== recuperacao de senha ==")
carlos = registrar("Carlos", "carlos@x.com")

resposta_inexistente = auth.recuperar_senha(
    auth.PedidoDeRecuperacao(email="nao@existe.com"), s)
resposta_existente = auth.recuperar_senha(
    auth.PedidoDeRecuperacao(email="carlos@x.com"), s)

tok = token_acesso.emitir(carlos, FinalidadeDoToken.RECUPERACAO, s)
guardado = s.exec(select(TokenDeAcesso).where(
    TokenDeAcesso.usuario_id == carlos.id,
    TokenDeAcesso.usado_em.is_(None))).first()

checar("senha curta demais", 400, lambda: auth.redefinir_senha(
    auth.RedefinicaoDeSenha(token=tok, senha_nova="123"), s))
checar("token inventado", 400, lambda: auth.redefinir_senha(
    auth.RedefinicaoDeSenha(token="nao-existe", senha_nova="senhanova123"), s))
checar("redefinir com token valido", "ok", lambda: auth.redefinir_senha(
    auth.RedefinicaoDeSenha(token=tok, senha_nova="senhanova123"), s))
checar("reusar o MESMO token", 400, lambda: auth.redefinir_senha(
    auth.RedefinicaoDeSenha(token=tok, senha_nova="outra123456"), s))
checar("login com a senha nova", "ok", lambda: auth.login(
    auth.Credenciais(email="carlos@x.com", senha="senhanova123"), s))
checar("login com a senha ANTIGA", 401, lambda: auth.login(
    auth.Credenciais(email="carlos@x.com", senha="senha12345"), s))

# Resgatados JA, e nao la embaixo junto com as outras condicoes: emitir invalida
# os anteriores, entao qualquer emissao seguinte mataria estes dois antes de a
# assercao rodar. Foi exatamente o que aconteceu na primeira versao deste bloco.
antigo = token_acesso.emitir(carlos, FinalidadeDoToken.RECUPERACAO, s)
recente = token_acesso.emitir(carlos, FinalidadeDoToken.RECUPERACAO, s)
antigo_morreu = token_acesso.resgatar(antigo, FinalidadeDoToken.RECUPERACAO, s) is None
recente_vale = token_acesso.resgatar(recente, FinalidadeDoToken.RECUPERACAO, s) is not None

vencido = token_acesso.emitir(carlos, FinalidadeDoToken.RECUPERACAO, s)
registro_vencido = s.exec(select(TokenDeAcesso).where(
    TokenDeAcesso.usuario_id == carlos.id,
    TokenDeAcesso.usado_em.is_(None))).first()
registro_vencido.expira_em = datetime.now(timezone.utc) - timedelta(minutes=1)
s.add(registro_vencido)
s.commit()

convite = token_acesso.emitir(carlos, FinalidadeDoToken.CONVITE, s)

inativa = registrar("Inativa", "inativa@x.com")
inativa.ativo = False
s.add(inativa)
s.commit()
tokens_antes = len(s.exec(select(TokenDeAcesso)).all())
auth.recuperar_senha(auth.PedidoDeRecuperacao(email="inativa@x.com"), s)

for descricao, condicao in [
    # Qualquer diferenca entre as duas respostas transforma a rota num
    # verificador de quem tem conta no sistema.
    ("email inexistente e existente respondem igual",
     resposta_inexistente == resposta_existente),
    # Vazar o banco nao pode entregar links funcionando.
    ("o banco guarda o hash, nunca o token", guardado.token_hash != tok),
    ("emitir invalida o link anterior", antigo_morreu),
    ("o link mais novo funciona", recente_vale),
    ("link vencido nao resgata",
     token_acesso.resgatar(vencido, FinalidadeDoToken.RECUPERACAO, s) is None),
    # Convite vale 7 dias; aceita-lo como recuperacao daria uma janela longa
    # demais para trocar a senha de alguem.
    ("convite nao serve como recuperacao",
     token_acesso.resgatar(convite, FinalidadeDoToken.RECUPERACAO, s) is None),
    # Redefinir senha nao pode ser a porta dos fundos de quem foi desativado.
    ("conta inativa nao recebe link",
     len(s.exec(select(TokenDeAcesso)).all()) == tokens_antes),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ===================== convite do aluno =====================
#
# O convite e a unica porta pela qual um ALUNO chega a ter senha propria. Duas
# coisas nao podem falhar aqui: ninguem entra antes de aceitar, e o personal que
# convidou nao consegue usar o convite no lugar do aluno.

print("\n== convite do aluno ==")
convidada = usuarios.criar_usuario(
    UsuarioCriacao(nome="Marina", email="marina@x.com", telefone="11961234599", data_nascimento=ADULTO), s, ana)
obj_convidada = s.get(Usuario, convidada["id"])

checar("login antes de aceitar o convite", 401, lambda: auth.login(
    auth.Credenciais(email="marina@x.com", senha="123456"), s))

# Reenvio antes do aceite: e a unica janela em que ele faz sentido. Depois do
# primeiro acesso o aluno ja tem senha, e o caminho passa a ser a recuperacao —
# coberto no bloco "cadastro do aluno apos o primeiro acesso".
checar("reenviar convite do proprio aluno", "ok",
       lambda: usuarios.reenviar_convite(convidada["id"], s, ana))
checar("reenviar convite de aluno ALHEIO", 404,
       lambda: usuarios.reenviar_convite(convidada["id"], s, bruno))

conv = token_acesso.emitir(obj_convidada, FinalidadeDoToken.CONVITE, s)
leitura_1 = auth.ler_convite(conv, s)
leitura_2 = auth.ler_convite(conv, s)

checar("GET convite inventado", 404, lambda: auth.ler_convite("nao-existe", s))
checar("aceitar com senha curta", 400, lambda: auth.aceitar_convite(
    auth.AceiteDoConvite(token=conv, senha="123", aceitou_termos=True), s))
checar("aceitar SEM os termos", 400, lambda: auth.aceitar_convite(
    auth.AceiteDoConvite(token=conv, senha="senhadela1", aceitou_termos=False), s))
checar("aceitar com token inventado", 400, lambda: auth.aceitar_convite(
    auth.AceiteDoConvite(token="nao-existe", senha="senhadela1", aceitou_termos=True), s))
checar("aceite valido", "ok", lambda: auth.aceitar_convite(
    auth.AceiteDoConvite(token=conv, senha="senhadela1", aceitou_termos=True), s))
checar("login com a senha que o ALUNO escolheu", "ok", lambda: auth.login(
    auth.Credenciais(email="marina@x.com", senha="senhadela1"), s))
checar("reusar o convite", 400, lambda: auth.aceitar_convite(
    auth.AceiteDoConvite(token=conv, senha="outrasenha1", aceitou_termos=True), s))

checar("aluno tentando reenviar convite", 403,
       lambda: personal_atual(obj_convidada))

s.refresh(obj_convidada)
com_senha = usuarios.criar_usuario(
    UsuarioCriacao(nome="Rafa", email="rafa@x.com", telefone="11961234598",
                   senha="123456", data_nascimento=ADULTO), s, ana)

for descricao, condicao in [
    ("cadastro sem senha dispara convite", convidada["convite_enviado"] is True),
    ("cadastro com senha nao dispara", com_senha["convite_enviado"] is False),
    # O aceite do aluno acontece no primeiro acesso, e nao no cadastro: quem
    # cria a conta dele e o personal, e ninguem aceita termos por outra pessoa.
    ("aluno nasce sem ter aceitado os termos", convidada["aceitou_termos"] is False),
    ("aceitar o convite registra o aceite", obj_convidada.aceitou_termos is True),
    ("e registra QUANDO", obj_convidada.termos_aceitos_em is not None),
    # A tela do convite abre dizendo "Ola, Marina" antes de a pessoa digitar
    # nada. Se o GET gastasse o link, abrir a pagina queimaria o convite.
    ("ler o convite duas vezes nao o gasta", leitura_1 == leitura_2),
    ("a leitura traz o nome do personal", leitura_1["personal_nome"] == "Ana"),
    # Endpoint publico: devolve uma lista curta e explicita, nao `publico()`.
    # Com `publico`, um campo novo no modelo passaria a vazar para qualquer um
    # com um link de convite.
    ("a leitura publica nao vaza o resto do cadastro",
     set(leitura_1) == {"nome", "email", "personal_nome"}),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ===================== versao dos termos aceitos =====================
#
# Guardar so o booleano nao prova nada: "concordou" sem saber COM O QUE nao
# serve num pedido de titular nem numa disputa. As tres colunas andam juntas.

print("\n== versao dos termos ==")
recem = registrar("Recem", "recem@x.com")
# Fica sem aceitar de proposito: por convite, quem aceita e o aluno, entao este
# e o unico estado em que um usuario existe sem versao de termos gravada.
# Cadastro COM senha aceita na hora — testado no bloco de aceite automatico.
pendente_sem_aceite = s.get(Usuario, usuarios.criar_usuario(
    UsuarioCriacao(nome="So Convidado", email="soconvidado@x.com",
                   telefone="11961234590", data_nascimento=ADULTO), s, recem)["id"])
aluno_convidado = usuarios.criar_usuario(
    UsuarioCriacao(nome="Convidada", email="conv@x.com", telefone="11961234597", data_nascimento=ADULTO), s, recem)
obj_convidado = s.get(Usuario, aluno_convidado["id"])
tok_conv = token_acesso.emitir(obj_convidado, FinalidadeDoToken.CONVITE, s)
auth.aceitar_convite(
    auth.AceiteDoConvite(token=tok_conv, senha="senhadele1", aceitou_termos=True), s)
s.refresh(obj_convidado)

for descricao, condicao in [
    ("personal grava a versao no cadastro",
     recem.termos_versao == config_app.VERSAO_DOS_TERMOS),
    ("aluno grava a versao ao aceitar o convite",
     obj_convidado.termos_versao == config_app.VERSAO_DOS_TERMOS),
    ("aluno so convidado ainda nao tem versao",
     pendente_sem_aceite.termos_versao is None),
    ("as tres colunas andam juntas",
     all([obj_convidado.aceitou_termos,
          obj_convidado.termos_aceitos_em is not None,
          obj_convidado.termos_versao])),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ============ o cadastro passa a ser do aluno apos o 1o acesso ============
#
# O personal cadastra para poder convidar. Assim que o aluno entra e assume a
# conta, o cadastro e dele. A janela anterior fica aberta de proposito: se o
# e-mail foi digitado errado, o convite nao chega e o aluno nao entra — sem ela
# ninguem conseguiria consertar.

print("\n== cadastro do aluno apos o primeiro acesso ==")
pendente = usuarios.criar_usuario(
    UsuarioCriacao(nome="Pendente", email="pendente@x.com", telefone="11961234596", data_nascimento=ADULTO), s, ana)
obj_pendente = s.get(Usuario, pendente["id"])

def editar(alvo_id, quem, nome="Corrigido", email="pendente@x.com"):
    return lambda: usuarios.atualizar_usuario(
        alvo_id, UsuarioAtualizacao(nome=nome, email=email, telefone="11961234596",
                                    data_nascimento=ADULTO),
        s, quem)

checar("personal corrige aluno que NAO ativou", "ok", editar(pendente["id"], ana))
checar("personal redefine senha de quem nao ativou", "ok", lambda: usuarios.trocar_senha(
    pendente["id"], TrocaDeSenha(senha_nova="provisoria1"), s, ana))

tok_p = token_acesso.emitir(obj_pendente, FinalidadeDoToken.CONVITE, s)
auth.aceitar_convite(
    auth.AceiteDoConvite(token=tok_p, senha="minhasenha1", aceitou_termos=True), s)
s.refresh(obj_pendente)

checar("personal edita aluno que JA ativou", 403, editar(pendente["id"], ana))
# Definir a senha de alguem e poder entrar como essa pessoa: e a trava que mais
# importa das tres, e por isso ela e teste e nao comentario.
checar("personal redefine senha de quem JA ativou", 403, lambda: usuarios.trocar_senha(
    pendente["id"], TrocaDeSenha(senha_nova="tomada12345"), s, ana))
checar("personal reenvia convite para quem ja ativou", 400,
       lambda: usuarios.reenviar_convite(pendente["id"], s, ana))

checar("o proprio aluno edita o cadastro dele", "ok",
       editar(pendente["id"], obj_pendente, nome="Eu Mesmo"))
checar("o proprio aluno troca a senha dele", "ok", lambda: usuarios.trocar_senha(
    pendente["id"], TrocaDeSenha(senha_atual="minhasenha1", senha_nova="outrasenha1"),
    s, obj_pendente))

# A trava e sobre o cadastro, nao sobre a relacao: desativar continua sendo do
# personal, senao ele nao teria como encerrar o atendimento.
checar("personal ainda desativa o aluno", "ok",
       lambda: usuarios.desativar_usuario(pendente["id"], s, ana))
checar("personal ainda reativa o aluno", "ok",
       lambda: usuarios.reativar_usuario(pendente["id"], s, ana))
checar("personal continua editando a SI MESMO", "ok", lambda: usuarios.atualizar_usuario(
    ana.id, UsuarioAtualizacao(nome="Ana", email="ana@x.com"), s, ana))
checar("aluno de OUTRO personal segue 404", 404, editar(id_bruno, ana, email="b1@x.com"))

# ============ observacoes privadas do personal sobre o aluno ============
#
# E o caderno do profissional, nao um recado. A anotacao fica no registro do
# ALUNO, entao o caminho por onde ela poderia vazar e justamente a resposta que
# o proprio aluno recebe — daqui sai a assercao sobre `publico()`.

print("\n== observacoes do personal ==")
usuarios.salvar_observacoes(
    id_ana, usuarios.Observacoes(texto="  Joelho direito: evitar agachamento profundo.  "),
    s, ana)
lido = usuarios.ler_observacoes(id_ana, s, ana)

# O 403 do aluno mora em `personal_atual`, que e um Depends — chamar a funcao
# direto o pula. Entao a barreira e conferida onde ela existe: nas duas rotas
# estar atras DELA, e nao de `usuario_atual`, que deixaria o aluno entrar.
for nome_rota in ("ler_observacoes", "salvar_observacoes"):
    guarda = inspect.signature(
        getattr(usuarios, nome_rota)).parameters["logado"].default
    condicao = guarda.dependency is personal_atual
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {nome_rota} exige personal_atual")
checar("personal lendo observacoes de aluno ALHEIO", 404,
       lambda: usuarios.ler_observacoes(id_bruno, s, ana))
checar("personal escrevendo em aluno ALHEIO", 404,
       lambda: usuarios.salvar_observacoes(
           id_bruno, usuarios.Observacoes(texto="invadido"), s, ana))
checar("observacao longa demais", 400,
       lambda: usuarios.salvar_observacoes(
           id_ana,
           usuarios.Observacoes(texto="x" * (usuarios.TAMANHO_MAXIMO_OBSERVACOES + 1)),
           s, ana))

do_aluno = usuarios.buscar_usuario(id_ana, s, obj_aluno)
na_sessao = publico(s.get(Usuario, id_ana))
usuarios.salvar_observacoes(id_ana, usuarios.Observacoes(texto="   "), s, ana)
s.expire_all()
apagada = s.get(Usuario, id_ana).observacoes

for descricao, condicao in [
    ("o personal le o que escreveu", lido["texto"].startswith("Joelho direito")),
    ("o texto e guardado sem espaco nas pontas", lido["texto"] == lido["texto"].strip()),
    # A rota existe justamente para a anotacao NAO viajar em `publico()`, que e
    # o que o proprio aluno recebe em /auth/eu e ao ler o cadastro dele.
    ("`publico` nao carrega observacoes", "observacoes" not in na_sessao),
    ("o aluno nao ve a nota no proprio cadastro", "observacoes" not in do_aluno),
    # Vazio vira None: "nunca escreveu" e "apagou" no mesmo lugar, senao toda
    # leitura precisaria testar os dois.
    ("texto em branco apaga e vira nulo", apagada is None),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ====== aceite automatico, primeiro acesso e aluno menor de idade ======
#
# Duas regras que se cruzam: o personal que cadastra com senha aceita os termos
# pelo aluno, e a partir dai `aceitou_termos` deixa de significar "o aluno
# assumiu a conta". Quem passa a dizer isso e `primeiro_acesso_em` — e e ele
# que controla ate quando o personal pode editar.

print("\n== aceite automatico e primeiro acesso ==")
completo = usuarios.criar_usuario(
    UsuarioCriacao(nome="Completo", email="completo@x.com", telefone="11961234595",
                   senha="senhadoper1", data_nascimento=ADULTO), s, ana)
obj_completo = s.get(Usuario, completo["id"])
# Lido ANTES do login: e o ponto da separacao entre aceite e posse da conta.
acesso_antes_do_login = obj_completo.primeiro_acesso_em

convidado2 = usuarios.criar_usuario(
    UsuarioCriacao(nome="Convidado2", email="conv2@x.com", telefone="11961234594", data_nascimento=ADULTO), s, ana)
obj_convidado2 = s.get(Usuario, convidado2["id"])

# Cadastrado pelo personal ainda e editavel: o aceite foi registrado, mas ele
# nunca entrou. Sem esta janela o personal perderia o cadastro de alguem que
# talvez nunca faca login, e ninguem poderia corrigir um e-mail errado.
checar("personal edita quem ele cadastrou com senha", "ok",
       lambda: usuarios.atualizar_usuario(
           completo["id"],
           UsuarioAtualizacao(nome="Corrigido", email="completo@x.com",
                              telefone="11961234595",
                              data_nascimento=ADULTO), s, ana))

auth.login(auth.Credenciais(email="completo@x.com", senha="senhadoper1"), s)
s.refresh(obj_completo)

checar("depois do 1o login o personal nao edita mais", 403,
       lambda: usuarios.atualizar_usuario(
           completo["id"],
           UsuarioAtualizacao(nome="Tarde", email="completo@x.com",
                              telefone="11961234595",
                              data_nascimento=ADULTO), s, ana))

print("\n== aluno menor de idade ==")
hoje = date.today()
menor = hoje.replace(year=hoje.year - 15)
maior = hoje.replace(year=hoje.year - 30)

checar("menor SEM autorizacao", 400, lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Menor", email="menor@x.com", telefone="11961234593",
                   data_nascimento=menor, senha="senha123456"), s, ana))
checar("menor COM autorizacao", "ok", lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Menor", email="menor@x.com", telefone="11961234593",
                   data_nascimento=menor, autorizacao_responsavel=True,
                   senha="senha123456"), s, ana))
checar("maior sem autorizacao segue normal", "ok", lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Maior", email="maior@x.com", telefone="11961234592",
                   data_nascimento=maior, senha="senha123456"), s, ana))
# Sem data nao ha como saber se o cadastro precisa de autorizacao, entao
# "nao informado" viraria justamente a forma de contornar a regra do menor.
checar("cadastro SEM data de nascimento", 422, lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Sem Data", email="semdata@x.com", telefone="11961234591",
                   senha="senha123456"), s, ana))
checar("data de nascimento no futuro", 422, lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Futuro", email="futuro@x.com", telefone="11961234589",
                   data_nascimento=hoje.replace(year=hoje.year + 1),
                   senha="senha123456"), s, ana))

com_autorizacao = s.exec(select(Usuario).where(Usuario.email == "menor@x.com")).first()
maior_de_idade = s.exec(select(Usuario).where(Usuario.email == "maior@x.com")).first()

for descricao, condicao in [
    ("cadastro completo ja nasce com os termos aceitos",
     obj_completo.aceitou_termos and obj_completo.termos_versao == config_app.VERSAO_DOS_TERMOS),
    ("cadastro por convite NAO aceita pelo aluno",
     obj_convidado2.aceitou_termos is False),
    # A separacao que sustenta as duas regras: aceitar os termos e assumir a
    # conta viraram coisas diferentes quando o personal passou a aceitar por
    # outra pessoa. Aceite automatico NAO marca posse...
    ("aceite automatico nao marca primeiro acesso", acesso_antes_do_login is None),
    # ...e o login marca.
    ("o login do aluno marca o primeiro acesso",
     obj_completo.primeiro_acesso_em is not None),
    ("a autorizacao fica registrada com data",
     com_autorizacao.autorizacao_responsavel_em is not None),
    ("quem nao e menor nao ganha registro de autorizacao",
     maior_de_idade.autorizacao_responsavel_em is None),
    # A flag de entrada nao pode virar coluna: se virasse, o corpo do PUT
    # poderia reescrever a declaracao depois.
    ("autorizacao_responsavel nao vaza para a resposta",
     "autorizacao_responsavel" not in completo),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ===================== CPF e CEP =====================
#
# Mesma regra do telefone: formatar e da tela, o banco guarda o numero. Sem
# normalizar, "529.982.247-25" e "52998224725" viram registros diferentes e
# nenhuma busca acha os dois. O CPF ainda confere os digitos verificadores —
# erro de digitacao vira um numero que parece valido e so falha quando alguem
# precisa dele para valer.

print("\n== CPF e CEP ==")

def com_documento(**extras):
    return lambda: UsuarioAtualizacao(
        nome="X", email="x@x.com", telefone="11961234560",
        data_nascimento=ADULTO, **extras)

checar("CPF valido com pontuacao", "ok", com_documento(cpf="529.982.247-25"))
checar("CPF valido sem pontuacao", "ok", com_documento(cpf="52998224725"))
checar("CPF com digito verificador errado", 422, com_documento(cpf="529.982.247-24"))
# Passa na conta dos verificadores, mas nao e CPF de ninguem: e o que se digita
# para sair do campo.
checar("CPF de digitos repetidos", 422, com_documento(cpf="111.111.111-11"))
checar("CPF curto demais", 422, com_documento(cpf="123"))
checar("CPF sem digito nenhum", 422, com_documento(cpf="abcdefghijk"))
checar("CEP valido com hifen", "ok", com_documento(cep="01310-100"))
checar("CEP com 7 digitos", 422, com_documento(cep="0131010"))

guardado_cpf = UsuarioAtualizacao(
    nome="X", email="x@x.com", telefone="11961234560", data_nascimento=ADULTO,
    cpf="529.982.247-25", cep="01310-100")

for descricao, condicao in [
    ("CPF e guardado so com digitos", guardado_cpf.cpf == "52998224725"),
    ("CEP e guardado so com digitos", guardado_cpf.cep == "01310100"),
    # Os dois sao opcionais: em branco e "nao informado", nao erro.
    ("CPF em branco vira nulo",
     UsuarioAtualizacao(nome="X", email="x@x.com", telefone="11961234560",
                        data_nascimento=ADULTO, cpf="").cpf is None),
    ("CEP em branco vira nulo",
     UsuarioAtualizacao(nome="X", email="x@x.com", telefone="11961234560",
                        data_nascimento=ADULTO, cep="").cep is None),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ============ o que viaja numa LISTAGEM vs. num DETALHE ============
#
# `publico` devolve o modelo inteiro e serve ao cadastro de UM usuario. Listagem
# usa `resumo`, uma lista branca. A diferenca importa porque campo novo no
# modelo entra em `publico` sozinho — foi assim que CPF e endereco passaram a
# viajar em toda listagem, e por isso `observacoes` precisou ser excluido a mao.

print("\n== recorte dos dados nas listagens ==")

CHAVES_DO_RESUMO = {
    "id", "nome", "email", "telefone", "foto_url", "ativo",
    "objetivo", "idade", "aceitou_termos", "primeiro_acesso_em",
}
PESSOAIS = {
    "cpf", "cep", "logradouro", "numero_endereco", "complemento", "bairro",
    "data_nascimento", "sexo", "altura_cm", "observacoes",
    "termos_versao", "termos_aceitos_em", "autorizacao_responsavel_em",
}

s.get(Usuario, id_ana).cpf = "52998224725"
s.commit()

na_listagem = usuarios.listar_usuarios(None, False, s, ana)[0]
no_painel = painel.resumo_do_personal(None, s, ana)["alunos"][0]["aluno"]
no_detalhe = usuarios.buscar_usuario(id_ana, s, ana)

for descricao, condicao in [
    # Travar o conjunto exato, e nao so "nao tem cpf": assim, acrescentar campo
    # ao resumo sem pensar quebra o teste em vez de vazar em silencio.
    ("a listagem tem exatamente as chaves do resumo",
     set(na_listagem) == CHAVES_DO_RESUMO),
    ("o painel usa o mesmo recorte", set(no_painel) == CHAVES_DO_RESUMO),
    ("nenhum dado pessoal na listagem", not (set(na_listagem) & PESSOAIS)),
    ("nenhum dado pessoal no painel", not (set(no_painel) & PESSOAIS)),
    # O detalhe continua completo: recortar la quebraria a ficha e o formulario.
    ("o detalhe segue trazendo o cadastro inteiro",
     {"cpf", "data_nascimento", "sexo"} <= set(no_detalhe)),
    # A lista precisa do avatar e de saber se o aluno ja assumiu a conta.
    ("a listagem mantem o que a tela usa",
     {"foto_url", "primeiro_acesso_em", "idade"} <= set(na_listagem)),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

# ============ reaceite quando os termos mudam ============
#
# As duas constantes existem para separar "o que esta publicado" de "o que
# exige novo consentimento". Se fossem uma so, corrigir uma virgula
# interromperia todo mundo — e aceite frequente e aceite que ninguem le.

print("\n== reaceite de termos ==")
from app.services import termos as servico_termos  # noqa: E402

leitora = registrar("Leitora", "leitora@x.com")
versao_publicada = config_app.VERSAO_DOS_TERMOS
versao_minima = config_app.VERSAO_MINIMA_ACEITA

pendente_ao_dia = servico_termos.pendente(leitora)

# Correcao de ortografia: sobe so a versao publicada.
config_app.VERSAO_DOS_TERMOS = "2026-09-01"
pendente_apos_typo = servico_termos.pendente(leitora)

# Mudanca material: sobe as duas.
config_app.VERSAO_MINIMA_ACEITA = "2026-09-01"
pendente_apos_material = servico_termos.pendente(leitora)

resposta = auth.aceitar_nova_versao(s, leitora)
s.refresh(leitora)
pendente_apos_aceitar = servico_termos.pendente(leitora)
versao_gravada = leitora.termos_versao

# Aluno que o personal aceitou por ele nunca viu o texto: na primeira mudanca
# material ele finalmente ve.
aluno_auto = s.get(Usuario, usuarios.criar_usuario(
    UsuarioCriacao(nome="Auto", email="auto@x.com", telefone="11961234588",
                   data_nascimento=ADULTO, senha="senha123456"), s, leitora)["id"])
config_app.VERSAO_MINIMA_ACEITA = "2026-10-01"
pendente_para_aluno_auto = servico_termos.pendente(aluno_auto)

config_app.VERSAO_DOS_TERMOS = versao_publicada
config_app.VERSAO_MINIMA_ACEITA = versao_minima

for descricao, condicao in [
    ("quem acabou de aceitar nao tem pendencia", pendente_ao_dia is False),
    # O ponto de existirem duas constantes.
    ("correcao de ortografia NAO pede reaceite", pendente_apos_typo is False),
    ("mudanca material pede reaceite", pendente_apos_material is True),
    ("aceitar resolve a pendencia", pendente_apos_aceitar is False),
    ("o aceite grava a versao publicada", versao_gravada == "2026-09-01"),
    ("a resposta ja diz que nao ha pendencia",
     resposta["usuario"]["termos_pendentes"] is False
     if "usuario" in resposta else resposta["termos_pendentes"] is False),
    ("aluno aceito pelo personal tambem reaceita",
     pendente_para_aluno_auto is True),
    # Login e /eu carregam a bandeira; e dela que o front depende para trancar.
    ("login informa a pendencia",
     "termos_pendentes" in auth.login(
         auth.Credenciais(email="leitora@x.com", senha="senha12345"), s)["usuario"]),
    ("/eu informa a pendencia", "termos_pendentes" in auth.eu(leitora)),
]:
    ok += condicao
    falhas += not condicao
    print(f"  [{'PASS' if condicao else 'FALHA'}] {descricao}")

print(f"\n{'='*72}\n  {ok} passaram, {falhas} falharam\n{'='*72}")
sys.exit(1 if falhas else 0)
