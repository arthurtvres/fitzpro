"""Isolamento entre dois personais, exercitando os routers de verdade.

Nao usa TestClient (o httpx nao esta instalado): chama as funcoes de rota
diretamente, que e onde a logica de tenant vive.
"""

import os
import sys
import tempfile

CAMINHO = os.path.join(tempfile.mkdtemp(), "iso.db").replace("\\", "/")
os.environ["FITZPRO_DB_URL"] = f"sqlite:///{CAMINHO}"
os.environ["FITZPRO_SEGREDO"] = "teste"

from fastapi import HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.db.session import create_db_and_tables, engine  # noqa: E402
from app.models import (  # noqa: E402
    AvaliacaoCriacao,
    FaixaDeAlunos,
    DietaCriacao,
    TreinoCriacao,
    TreinoExercicioCriacao,
    TrocaDeSenha,
    Usuario,
    UsuarioAtualizacao,
    UsuarioCriacao,
)
from app.routers import auth, avaliacoes, dietas, treinos, usuarios  # noqa: E402

create_db_and_tables()
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

print(f"\n{'='*72}\n  {ok} passaram, {falhas} falharam\n{'='*72}")
sys.exit(1 if falhas else 0)
