"""
Dia da semana em forma canônica.

O `Treino.dia_semana` sempre foi string livre, e o dado sujou: o seed grava
"terça" com cedilha, os testes gravam "terca" sem. O front do personal comparava
com um normalizador e o do aluno com `==` estrito — então **um treino salvo com o
acento "errado" aparecia para o personal e sumia para o aluno**.

A saída é normalizar **na escrita**: o banco guarda sempre a forma sem acento, e
quem exibe usa `ROTULOS`. Normalizar só na leitura deixaria o dado sujo para
sempre, e cada consumidor novo teria que lembrar de fazer isso.

Não é enum SQL: o SQLite não tem, viraria um CHECK que trava migração futura, e o
conjunto de dias não vai mudar de qualquer forma.
"""

import unicodedata

# Índice 0 = segunda, para casar com `date.weekday()` do Python.
DIAS = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")

ROTULOS = {
    "segunda": "segunda",
    "terca": "terça",
    "quarta": "quarta",
    "quinta": "quinta",
    "sexta": "sexta",
    "sabado": "sábado",
    "domingo": "domingo",
}

SIGLAS = {
    "segunda": "SEG",
    "terca": "TER",
    "quarta": "QUA",
    "quinta": "QUI",
    "sexta": "SEX",
    "sabado": "SÁB",
    "domingo": "DOM",
}

# Formas que já apareceram ou são plausíveis vindas de importação e digitação.
APELIDOS = {
    "seg": "segunda",
    "ter": "terca",
    "qua": "quarta",
    "qui": "quinta",
    "sex": "sexta",
    "sab": "sabado",
    "dom": "domingo",
}

def sem_acento(texto: str) -> str:
    """"Terça" -> "terca". NFD separa o diacrítico, e o filtro descarta."""
    decomposto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in decomposto if unicodedata.category(c) != "Mn")

def normalizar(valor: str | None) -> str | None:
    """
    Qualquer grafia -> a forma canônica, ou None se não for um dia.

    Aceita "Terça-feira", "SÁBADO", " seg " e "domingo". O sufixo "-feira" é
    removido porque é o que um select de outro sistema costuma mandar.
    """
    if not valor:
        return None

    texto = sem_acento(str(valor)).strip().lower()
    texto = texto.replace("-feira", "").replace(" feira", "").strip()

    if texto in DIAS:
        return texto
    return APELIDOS.get(texto)

def indice(valor: str | None) -> int | None:
    """0 = segunda ... 6 = domingo. Mesma base do `date.weekday()`."""
    dia = normalizar(valor)
    return DIAS.index(dia) if dia else None

def do_dia(data) -> str:
    """O dia canônico de uma data."""
    return DIAS[data.weekday()]
