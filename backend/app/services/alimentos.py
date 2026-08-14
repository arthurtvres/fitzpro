"""
Tabela de alimentos (TACO) em memória — mesmo arranjo do catálogo de exercícios.

São 597 alimentos num JSON de ~110 KB, somente leitura. Carregar tudo no
startup deixa busca e filtro sem tocar o banco, e evita uma tabela que nunca
muda ocupar migration, índice e backup.

O JSON é gerado por `scripts/gerar_alimentos.py` a partir do CSV da TACO. Ali
está a decisão que mais importa para o dado: **"Tr" (traço) vira 0, "NA" e "*"
viram nulo** — traço é quantidade desprezível, "não analisado" é ausência de
informação, e confundir os dois inventaria macro na soma da refeição.
"""

import json
import unicodedata

from app.core.config import DIRETORIO_APP

ARQUIVO = DIRETORIO_APP / "data" / "alimentos.json"

# Teto de resultados por busca. A tela é um campo de autocompletar durante a
# prescrição: passando disso, ninguém lê — refina a busca.
LIMITE_PADRAO = 30

# Quanto um alimento precisa ter, por 100 g, para ser oferecido como "fonte
# de" algo. São cortes editoriais, escolhidos para a lista ser útil na hora de
# montar refeição — não são as definições da ANVISA para alegação em rótulo, e
# não devem ser usados como tal.
LIMIARES = {
    "proteina": ("proteina_g", 10.0),
    "carboidrato": ("carboidrato_g", 20.0),
    "gordura": ("gordura_g", 10.0),
    "fibra": ("fibra_g", 3.0),
}

# Chave de ordenação e se é decrescente.
ORDENACOES = {
    "nome": ("busca", False),
    "mais_proteina": ("proteina_g", True),
    "mais_fibra": ("fibra_g", True),
    "menos_carboidrato": ("carboidrato_g", False),
    "menos_calorias": ("kcal", False),
    "mais_calorias": ("kcal", True),
}

_por_id: dict[int, dict] = {}
_ordenados: list[dict] = []

def _sem_acento(texto: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )

def carregar() -> int:
    """Lê o JSON para a memória. Chamado uma vez, no lifespan do app."""
    global _por_id, _ordenados

    with open(ARQUIVO, encoding="utf-8") as arquivo:
        _ordenados = json.load(arquivo)
    _por_id = {a["id"]: a for a in _ordenados}
    return len(_ordenados)

def _ordenar(itens: list[dict], ordenar: str) -> list[dict]:
    """
    Ordena por um macro, com os alimentos sem dado **sempre no fim**.

    A TACO tem valores não analisados, e em Python `None` não compara com
    número — ordenar direto levantaria TypeError. Tratá-los como zero seria
    pior que o erro: em "menos calorias" eles subiriam ao topo da lista como se
    fossem os mais leves, que é exatamente a leitura errada.
    """
    campo, decrescente = ORDENACOES.get(ordenar, ORDENACOES["nome"])
    if campo == "busca":
        return sorted(itens, key=lambda a: a["busca"])

    return sorted(
        itens,
        key=lambda a: (a[campo] is None, -a[campo] if decrescente and a[campo] is not None else a[campo]),
    )

def listar(
    busca: str | None = None,
    limite: int = LIMITE_PADRAO,
    fonte: str | None = None,
    ordenar: str = "nome",
) -> list[dict]:
    """
    Alimentos que casam com o texto, já ordenados por relevância.

    Quem começa com o termo vem antes de quem só o contém: digitando "arroz",
    "Arroz integral cozido" é mais provável que "Bolo de arroz". Sem essa
    ordenação a lista fica alfabética e o alimento óbvio some no meio.

    A comparação usa o campo `busca`, sem acento e pré-calculado no JSON —
    normalizar 597 nomes a cada tecla seria trabalho repetido à toa.
    """
    candidatos = _ordenados
    if fonte in LIMIARES:
        campo, minimo = LIMIARES[fonte]
        # `is not None` explícito: sem ele, alimento não analisado entraria em
        # qualquer filtro por comparar nulo — ou explodiria.
        candidatos = [
            a for a in candidatos if a[campo] is not None and a[campo] >= minimo
        ]

    if not busca or not busca.strip():
        return _ordenar(candidatos, ordenar)[:limite]

    frase = _sem_acento(busca.strip())
    # Cada palavra tem que aparecer, em qualquer posição — e não a frase
    # inteira, colada. Os nomes da TACO trazem qualificadores no meio ("Frango,
    # peito, sem pele, grelhado"), então buscar "frango grelhado" como frase
    # não acha nada, que é como o autocompletar pareceria quebrado.
    termos = frase.split()

    def casa(alimento):
        return all(termo in alimento["busca"] for termo in termos)

    candidatos = [a for a in candidatos if casa(a)]

    if ordenar != "nome":
        return _ordenar(candidatos, ordenar)[:limite]

    # Sem ordenação pedida, quem começa com o que foi digitado vem antes: com
    # "arroz", "Arroz integral cozido" é mais provável que "Bolo de arroz".
    candidatos.sort(key=lambda a: (not a["busca"].startswith(termos[0]), a["busca"]))
    return candidatos[:limite]

def obter(alimento_id: int) -> dict | None:
    return _por_id.get(alimento_id)

def existe(alimento_id: int) -> bool:
    return alimento_id in _por_id

def por_porcao(alimento_id: int, gramas: float) -> dict | None:
    """
    Os macros de uma porção. A TACO é sempre por 100 g.

    Existe aqui, e não na tela, porque é a conta que decide o total da dieta —
    e uma regra de três repetida em cada lugar que precisa dela é uma regra de
    três que vai divergir. Campo nulo continua nulo: multiplicar "não
    analisado" por 1,5 não produz informação.
    """
    alimento = _por_id.get(alimento_id)
    if not alimento:
        return None

    fator = gramas / 100
    escalar = lambda valor: None if valor is None else round(valor * fator, 1)  # noqa: E731

    return {
        "id": alimento["id"],
        "nome": alimento["nome"],
        "gramas": gramas,
        "kcal": escalar(alimento["kcal"]),
        "proteina_g": escalar(alimento["proteina_g"]),
        "carboidrato_g": escalar(alimento["carboidrato_g"]),
        "gordura_g": escalar(alimento["gordura_g"]),
        "fibra_g": escalar(alimento["fibra_g"]),
    }
