"""Cria dados locais de demonstracao.

Uso:
    cd backend
    python -m app.seed [email] [senha] [nome]

Idempotente: nao duplica o personal nem os alunos demo se rodar novamente.
"""

import json
import sys
from datetime import date, datetime, time, timedelta, timezone

from sqlmodel import Session, select

from app.core.seguranca import gerar_hash
from app.services import dias, series
from app.db.session import create_db_and_tables, engine
from app.models import (
    Agendamento,
    ExecucaoExercicio,
    FaixaDeAlunos,
    SessaoTreino,
    Avaliacao,
    Dieta,
    Papel,
    TipoAgendamento,
    Treino,
    TreinoExercicio,
    Usuario,
)

PADRAO_EMAIL = "personal@fitzpro.local"
PADRAO_SENHA = "fitzpro123"
PADRAO_NOME = "Personal"
SENHA_ALUNO = "aluno123"


def foto_fake(nome: str, cor: str) -> str:
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='800' "
        f"viewBox='0 0 640 800'><rect width='640' height='800' fill='{cor}'/>"
        "<circle cx='320' cy='210' r='78' fill='white' fill-opacity='.9'/>"
        "<path d='M210 705c15-175 64-300 110-300s95 125 110 300' "
        "fill='white' fill-opacity='.9'/>"
        f"<text x='320' y='105' text-anchor='middle' font-family='Arial' "
        f"font-size='34' font-weight='700' fill='white'>{nome}</text></svg>"
    )
    return "data:image/svg+xml;utf8," + svg


def plano_alimentar(proteinas, carboidratos, gorduras, refeicoes):
    return json.dumps(
        {
            "tipo": "plano-alimentar",
            "versao": 1,
            "proteinas": str(proteinas),
            "carboidratos": str(carboidratos),
            "gorduras": str(gorduras),
            "refeicoes": refeicoes,
        },
        ensure_ascii=False,
    )


DEMO_ALUNOS = [
    {
        "nome": "Marina Costa",
        "email": "marina@fitzpro.local",
        "telefone": "11961234567",
        "data_nascimento": date(1994, 5, 12),
        "sexo": "F",
        "altura_cm": 166,
        "objetivo": "Hipertrofia com ganho de forca",
    },
    {
        "nome": "Rafael Almeida",
        "email": "rafael@fitzpro.local",
        "telefone": "11962345678",
        "data_nascimento": date(1988, 9, 3),
        "sexo": "M",
        "altura_cm": 178,
        "objetivo": "Reducao de gordura e condicionamento",
    },
    {
        "nome": "Bianca Rocha",
        "email": "bianca@fitzpro.local",
        "telefone": "11963456789",
        "data_nascimento": date(2001, 2, 20),
        "sexo": "F",
        "altura_cm": 162,
        "objetivo": "Recomposicao corporal",
    },
    {
        "nome": "Lucas Martins",
        "email": "lucas@fitzpro.local",
        "telefone": "11964567890",
        "data_nascimento": date(1997, 11, 8),
        "sexo": "M",
        "altura_cm": 183,
        "objetivo": "Forca e performance",
    },
]

DEMO_TREINOS = [
    (
        "Treino A - Inferiores",
        dias.DIAS[0],  # segunda
        "Foco em quadriceps e gluteos.",
        [
            ("Barbell_Squat", 4, "6-8", 80, 120, "Subir carga se fechar tudo."),
            ("Leg_Press", 4, "10-12", 140, 90, None),
            ("Dumbbell_Lunges", 3, "12 cada perna", 18, 75, None),
            ("Plank", 3, "45s", None, 60, "Manter quadril alinhado."),
        ],
    ),
    (
        "Treino B - Superiores",
        dias.DIAS[2],  # quarta
        "Empurrar e puxar em intensidade moderada.",
        [
            ("Barbell_Bench_Press_-_Medium_Grip", 4, "8-10", 55, 120, None),
            ("Bent_Over_Barbell_Row", 4, "8-10", 50, 120, None),
            ("Wide-Grip_Lat_Pulldown", 3, "10-12", 45, 90, None),
            ("Incline_Push-Up", 3, "ate a falha tecnica", None, 75, None),
        ],
    ),
]


def refeicoes_base(prefixo: str):
    return [
        {
            "id": f"{prefixo}-ref-1",
            "horario": "07:30",
            "nome": "Cafe da manha",
            "calorias": "480",
            "proteinas": "28",
            "carboidratos": "51",
            "gorduras": "18",
            "alimentos": [
                {"id": f"{prefixo}-a-1", "nome": "Ovos", "quantidade": "3 un."},
                {"id": f"{prefixo}-a-2", "nome": "Pao integral", "quantidade": "2 fatias"},
                {"id": f"{prefixo}-a-3", "nome": "Banana", "quantidade": "1 un."},
                {"id": f"{prefixo}-a-4", "nome": "Cafe", "quantidade": "200 ml"},
            ],
        },
        {
            "id": f"{prefixo}-ref-2",
            "horario": "12:30",
            "nome": "Almoco",
            "calorias": "650",
            "proteinas": "48",
            "carboidratos": "72",
            "gorduras": "16",
            "alimentos": [
                {"id": f"{prefixo}-a-5", "nome": "Arroz", "quantidade": "150 g"},
                {"id": f"{prefixo}-a-6", "nome": "Feijao", "quantidade": "100 g"},
                {"id": f"{prefixo}-a-7", "nome": "Frango grelhado", "quantidade": "180 g"},
                {"id": f"{prefixo}-a-8", "nome": "Salada", "quantidade": "a vontade"},
            ],
        },
        {
            "id": f"{prefixo}-ref-3",
            "horario": "19:30",
            "nome": "Jantar",
            "calorias": "560",
            "proteinas": "42",
            "carboidratos": "58",
            "gorduras": "18",
            "alimentos": [
                {"id": f"{prefixo}-a-9", "nome": "Batata doce", "quantidade": "180 g"},
                {"id": f"{prefixo}-a-10", "nome": "Patinho moido", "quantidade": "160 g"},
                {"id": f"{prefixo}-a-11", "nome": "Legumes", "quantidade": "120 g"},
            ],
        },
    ]


def semear(email: str, senha: str, nome: str) -> str:
    create_db_and_tables()

    with Session(engine) as session:
        personal = session.exec(select(Usuario).where(Usuario.email == email)).first()
        if not personal:
            personal = Usuario(
                nome=nome,
                email=email,
                papel=Papel.PERSONAL,
                senha_hash=gerar_hash(senha),
                telefone="11987654321",
                quantidade_alunos=FaixaDeAlunos.DE_6_A_15,
                aceitou_termos=True,
                termos_aceitos_em=datetime.now(timezone.utc),
            )
            session.add(personal)
            session.commit()
            session.refresh(personal)

        # Os alunos demo sao deste personal: sem dono eles nao apareceriam em
        # listagem nenhuma, ja que tudo filtra por tenant.
        criados = semear_demo(session, personal)
        session.commit()

    return (
        f"Seed pronto. Login: {email} / {senha}. "
        f"Demo: {criados} aluno(s) novos. Senha dos alunos: {SENHA_ALUNO}."
    )


def semear_demo(session: Session, personal: Usuario) -> int:
    criados = 0
    hoje = date.today()

    for indice, dados in enumerate(DEMO_ALUNOS, start=1):
        aluno = session.exec(select(Usuario).where(Usuario.email == dados["email"])).first()
        if aluno:
            continue

        aluno = Usuario(
            **dados,
            papel=Papel.ALUNO,
            senha_hash=gerar_hash(SENHA_ALUNO),
            ativo=True,
            personal_id=personal.id,
        )
        session.add(aluno)
        session.commit()
        session.refresh(aluno)
        criados += 1

        for nome, dia, descricao, exercicios in DEMO_TREINOS:
            treino = Treino(
                nome=nome,
                dia_semana=dia,
                descricao=descricao,
                aluno_id=aluno.id,
            )
            session.add(treino)
            session.commit()
            session.refresh(treino)

            for ordem, (exercicio_id, series, repeticoes, carga, descanso, obs) in enumerate(
                exercicios, start=1
            ):
                session.add(
                    TreinoExercicio(
                        treino_id=treino.id,
                        exercicio_id=exercicio_id,
                        series=series,
                        repeticoes=repeticoes,
                        carga_kg=carga,
                        descanso_segundos=descanso,
                        observacao=obs,
                        ordem=ordem,
                    )
                )

        calorias = 2100 + indice * 120
        session.add(
            Dieta(
                nome="Plano alimentar principal",
                calorias=calorias,
                descricao=plano_alimentar(
                    130 + indice * 10,
                    220 + indice * 15,
                    55 + indice * 5,
                    refeicoes_base(f"aluno-{indice}"),
                ),
                aluno_id=aluno.id,
            )
        )

        pesos = [78.5 - indice, 77.2 - indice, 76.4 - indice]
        for av_indice, peso in enumerate(pesos):
            data_av = hoje - timedelta(days=(2 - av_indice) * 30)
            fotos = [
                {
                    "id": f"foto-{aluno.id}-{av_indice}-frente",
                    "nome": "frente",
                    "url": foto_fake(
                        f"{aluno.nome} frente",
                        ["#2563eb", "#16a34a", "#dc2626"][av_indice],
                    ),
                },
                {
                    "id": f"foto-{aluno.id}-{av_indice}-lado",
                    "nome": "lado",
                    "url": foto_fake(
                        f"{aluno.nome} lado",
                        ["#7c3aed", "#0891b2", "#ea580c"][av_indice],
                    ),
                },
            ]
            session.add(
                Avaliacao(
                    aluno_id=aluno.id,
                    data=data_av,
                    peso_kg=round(peso, 1),
                    percentual_gordura=round(24 - indice - av_indice * 0.8, 1),
                    massa_muscular_kg=round(39 + indice + av_indice * 0.5, 1),
                    cintura_cm=round(86 - indice - av_indice * 1.2, 1),
                    quadril_cm=round(101 - indice * 0.4, 1),
                    braco_cm=round(31 + indice * 0.3 + av_indice * 0.2, 1),
                    coxa_cm=round(56 + indice * 0.4, 1),
                    torax_cm=round(94 + indice * 0.8, 1),
                    observacao="Evolucao consistente, manter aderencia.",
                    fotos=json.dumps(fotos, ensure_ascii=False),
                )
            )

    semear_agenda(session, personal, hoje)
    semear_execucoes(session, personal, hoje)
    return criados


def semear_agenda(session: Session, personal: Usuario, hoje: date):
    if session.exec(select(Agendamento).where(Agendamento.data == hoje)).first():
        return

    alunos = session.exec(
        select(Usuario).where(
            Usuario.papel == Papel.ALUNO,
            Usuario.ativo == True,
            Usuario.personal_id == personal.id,
        )
    ).all()
    horarios = ["09:00", "11:30", "15:00", "18:30"]

    for indice, aluno in enumerate(alunos[:4]):
        treino = session.exec(select(Treino).where(Treino.aluno_id == aluno.id)).first()
        tipo = TipoAgendamento.AVALIACAO if indice == 1 else TipoAgendamento.TREINO
        session.add(
            Agendamento(
                data=hoje,
                horario=time.fromisoformat(horarios[indice]),
                tipo=tipo,
                aluno_id=aluno.id,
                treino_id=treino.id if tipo == TipoAgendamento.TREINO and treino else None,
                titulo="Avaliação física" if tipo == TipoAgendamento.AVALIACAO else "",
                observacao="",
            )
        )


SEMANAS_DE_HISTORICO = 6


def semear_execucoes(session: Session, personal: Usuario, hoje: date):
    """
    Seis semanas de treinos feitos, para a Home do aluno ter o que mostrar.

    Sem isto a tela nasce zerada — "0 kg esta semana", gráfico vazio, nenhuma
    sequência — e nao ha como avaliar o desenho. O historico e desenhado para
    exercitar os casos que a tela precisa cobrir:

    - carga subindo ao longo das semanas, para o grafico e o "+7,5 kg";
    - uma semana com falta, para a consistencia nao dar 100%;
    - metade das sessoes detalhada e metade estimada, para o `≈` aparecer;
    - a ultima sessao com carga acima de tudo, para produzir um recorde.
    """
    if session.exec(select(SessaoTreino)).first():
        return  # idempotente, como o resto do seed

    alunos = session.exec(
        select(Usuario).where(
            Usuario.papel == Papel.ALUNO,
            Usuario.ativo == True,  # noqa: E712
            Usuario.personal_id == personal.id,
        )
    ).all()

    for indice_aluno, aluno in enumerate(alunos):
        treinos = session.exec(select(Treino).where(Treino.aluno_id == aluno.id)).all()
        if not treinos:
            continue

        # Até 0 = a semana corrente. Os dias que ainda não chegaram são pulados
        # logo abaixo, mas os que já passaram entram — senão "esta semana" da
        # Home nasceria zerada, que é justamente o card que se quer avaliar.
        for semana in range(SEMANAS_DE_HISTORICO, -1, -1):
            # Uma falta plantada: sem ela a consistencia daria 100% e o
            # calendario nunca mostraria o estado "perdido".
            if semana == 3 and indice_aluno == 0:
                continue

            for treino in treinos:
                dia = _dia_da_semana_passada(hoje, treino.dia_semana, semana)
                if dia >= hoje:
                    continue

                prescricoes = session.exec(
                    select(TreinoExercicio)
                    .where(TreinoExercicio.treino_id == treino.id)
                    .order_by(TreinoExercicio.ordem)
                ).all()
                if not prescricoes:
                    continue

                inicio = datetime.combine(dia, time(19, 0), tzinfo=timezone.utc)
                duracao = 45 + (semana % 3) * 6
                sessao = SessaoTreino(
                    aluno_id=aluno.id,
                    treino_id=treino.id,
                    treino_nome=treino.nome,
                    data=dia,
                    iniciada_em=inicio,
                    finalizada_em=inicio + timedelta(minutes=duracao),
                    duracao_segundos=duracao * 60,
                    implicita=False,
                    registrado_por_id=aluno.id,
                )
                session.add(sessao)
                session.commit()
                session.refresh(sessao)

                # Semanas pares vao detalhadas, impares estimadas: e o que faz a
                # tela exercitar os dois caminhos do volume.
                detalhar = semana % 2 == 0

                for prescricao in prescricoes:
                    carga = _carga_da_semana(prescricao.carga_kg, semana)
                    detalhe = None
                    if detalhar and carga:
                        alvo = series.reps_prescritas(prescricao.repeticoes) or 10
                        detalhe = [
                            {"reps": max(1, alvo - n), "carga_kg": carga}
                            for n in range(prescricao.series)
                        ]

                    consolidado = series.consolidar(
                        detalhe,
                        series_prescritas=prescricao.series,
                        repeticoes=prescricao.repeticoes,
                        carga_prescrita=carga,
                    )
                    session.add(
                        ExecucaoExercicio(
                            data=dia,
                            aluno_id=aluno.id,
                            sessao_id=sessao.id,
                            treino_id=treino.id,
                            treino_exercicio_id=prescricao.id,
                            exercicio_id=prescricao.exercicio_id,
                            series_prescritas=prescricao.series,
                            repeticoes_prescritas=prescricao.repeticoes,
                            carga_prescrita_kg=prescricao.carga_kg,
                            registrado_por_id=aluno.id,
                            registrado_em=inicio,
                            **consolidado,
                        )
                    )
                session.commit()


def _dia_da_semana_passada(hoje: date, dia_semana: str, semanas_atras: int) -> date:
    """A data em que aquele dia da semana caiu, N semanas atrás."""
    indice = dias.indice(dia_semana) or 0
    inicio_atual = hoje - timedelta(days=hoje.weekday())
    return inicio_atual - timedelta(weeks=semanas_atras) + timedelta(days=indice)


def _carga_da_semana(carga_prescrita: float | None, semanas_atras: int) -> float | None:
    """
    Carga subindo com o tempo: quanto mais recente, mais peso.

    A semana 0 fica **acima** da prescrita, o que produz um recorde pessoal —
    e o card de PR da Home tem o que mostrar.
    """
    if carga_prescrita is None:
        return None
    return round(max(2.5, carga_prescrita - semanas_atras * 2.5), 1)


if __name__ == "__main__":
    email = (sys.argv[1] if len(sys.argv) > 1 else PADRAO_EMAIL).strip().lower()
    senha = sys.argv[2] if len(sys.argv) > 2 else PADRAO_SENHA
    nome = sys.argv[3] if len(sys.argv) > 3 else PADRAO_NOME
    print(semear(email, senha, nome))
