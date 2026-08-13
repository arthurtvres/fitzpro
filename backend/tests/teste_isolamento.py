"""Isolamento entre dois personais, exercitando os routers de verdade.

Nao usa TestClient (o httpx nao esta instalado): chama as funcoes de rota
diretamente, que e onde a logica de tenant vive.
"""

import os
import sys
import tempfile
from datetime import date, timedelta

CAMINHO = os.path.join(tempfile.mkdtemp(), "iso.db").replace("\\", "/")
os.environ["FITZPRO_DB_URL"] = f"sqlite:///{CAMINHO}"
os.environ["FITZPRO_SEGREDO"] = "teste"

from fastapi import HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

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
    TrocaDeSenha,
    Usuario,
    UsuarioAtualizacao,
    UsuarioCriacao,
)
from app.routers import auth, avaliacoes, dietas, execucoes, treinos, usuarios  # noqa: E402
from app.routers import progressao as progressao_rotas  # noqa: E402
from app.seed import plano_alimentar as plano_alimentar_json  # noqa: E402
from app.seed import refeicoes_base  # noqa: E402
from app.services import catalogo, dias, plano_alimentar, progressao  # noqa: E402

create_db_and_tables()
# O catalogo e carregado no lifespan do app; aqui as rotas sao chamadas direto,
# entao ele precisa ser carregado a mao — senao `catalogo.existe` diz que nao.
catalogo.carregar()
s = Session(engine)

ok = falhas = 0


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
    UsuarioCriacao(nome="Aluno da Ana", email="a1@x.com", senha="123456", telefone="11961234560"), s, ana
)
aluno_bruno = usuarios.criar_usuario(
    UsuarioCriacao(nome="Aluno do Bruno", email="b1@x.com", senha="123456", telefone="11961234561"), s, bruno
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
    UsuarioCriacao(nome="Colega", email="a2@x.com", senha="123456", telefone="11961234562"), s, ana)
obj_aluno = s.get(Usuario, id_ana)
checar("aluno GET colega de tenant", 404,
       lambda: usuarios.buscar_usuario(aluno2["id"], s, obj_aluno))
checar("aluno GET a si mesmo", "ok", lambda: usuarios.buscar_usuario(id_ana, s, obj_aluno))
checar("aluno PUT em si mesmo", "ok", lambda: usuarios.atualizar_usuario(
    id_ana, UsuarioAtualizacao(nome="Eu mesmo", email="a1@x.com",
                               telefone="11912345678"), s, obj_aluno))
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
    UsuarioCriacao(nome="Sem fone", email="sf@x.com", senha="123456"), s, ana))
checar("aluno com telefone invalido", 422, lambda: usuarios.criar_usuario(
    UsuarioCriacao(nome="Fone ruim", email="fr@x.com", senha="123456",
                   telefone="abc"), s, ana))

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

print(f"\n{'='*72}\n  {ok} passaram, {falhas} falharam\n{'='*72}")
sys.exit(1 if falhas else 0)
