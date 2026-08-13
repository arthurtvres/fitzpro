"""
Lê as refeições de dentro de `Dieta.descricao`.

Este módulo existe porque, a partir do registro de refeição consumida, o backend
precisa saber **quais refeições um plano tem** e **quantas calorias cada uma
vale** — e essa informação mora num JSON que até então era assunto exclusivo do
front. É a decisão de acoplamento mais cara desta feature: o formato aqui espelha
`frontend/src/features/planos/dietaPlano.js`, e mudar um lado exige mudar o outro.

A alternativa seria o front mandar nome e calorias no corpo ao marcar a refeição.
Foi descartada: deixaria o aluno declarar quantas calorias comeu, quebrando a
regra de que o cliente não define campo do servidor.

Toda leitura é tolerante. Descrição que não é JSON, que é JSON de outro tipo, ou
que tem número onde deveria ter texto devolve vazio em vez de estourar — a
`descricao` também aceita texto livre, e dieta antiga não pode derrubar rota.
"""

import json

TIPO = "plano-alimentar"

# O front grava `versao: 1` desde sempre e nunca leu de volta. Agora que o
# backend depende do formato, a versão passa a ter uso: formato mais novo do que
# este módulo entende é ignorado, em vez de ser lido pela metade.
VERSAO_SUPORTADA = 1

def ler(descricao: str | None) -> dict | None:
    """O plano alimentar, ou None se a descrição for texto livre."""
    if not descricao:
        return None

    try:
        plano = json.loads(descricao)
    except (ValueError, TypeError):
        return None

    if not isinstance(plano, dict) or plano.get("tipo") != TIPO:
        return None

    if plano.get("versao", 1) > VERSAO_SUPORTADA:
        return None

    return plano

def refeicoes(descricao: str | None) -> list[dict]:
    """
    As refeições do plano, normalizadas. Lista vazia se não houver plano.

    Só devolve refeição com `id` — sem id não há como marcar como consumida, e
    uma entrada dessas no meio da lista quebraria a contagem do denominador.
    """
    plano = ler(descricao)
    if not plano:
        return []

    cruas = plano.get("refeicoes")
    if not isinstance(cruas, list):
        return []

    return [
        {
            "id": str(refeicao["id"]),
            "nome": str(refeicao.get("nome") or ""),
            "horario": str(refeicao.get("horario") or ""),
            "calorias": numero(refeicao.get("calorias")),
            "proteinas": numero(refeicao.get("proteinas")),
            "carboidratos": numero(refeicao.get("carboidratos")),
            "gorduras": numero(refeicao.get("gorduras")),
            "observacao": str(refeicao.get("observacao") or ""),
            "alimentos": alimentos_de(refeicao),
        }
        for refeicao in cruas
        if isinstance(refeicao, dict) and refeicao.get("id")
    ]

def alimentos_de(refeicao: dict) -> list[dict]:
    crus = refeicao.get("alimentos")
    if not isinstance(crus, list):
        return []

    return [
        {
            "id": str(alimento.get("id") or ""),
            "nome": str(alimento.get("nome") or ""),
            "quantidade": str(alimento.get("quantidade") or ""),
            "unidade": str(alimento.get("unidade") or ""),
        }
        for alimento in crus
        if isinstance(alimento, dict)
    ]

def buscar_refeicao(descricao: str | None, refeicao_id: str) -> dict | None:
    """A refeição de um id, ou None se ela não existe mais no plano vigente."""
    for refeicao in refeicoes(descricao):
        if refeicao["id"] == refeicao_id:
            return refeicao
    return None

def numero(valor) -> float | None:
    """
    Os números do plano são **strings** ("480", "28,5") porque vêm direto de
    inputs de texto. Aqui viram float; o que não converte vira None, não zero —
    "não informado" e "zero" são coisas diferentes num plano alimentar.
    """
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)

    texto = str(valor).strip().replace(",", ".")
    if not texto:
        return None

    try:
        return float(texto)
    except ValueError:
        return None
