"""
Séries realizadas e o volume que sai delas.

Este módulo é o **único ponto de escrita** dos campos `series_realizadas`,
`series_feitas`, `repeticoes_totais`, `volume_kg`, `volume_estimado` e `carga_kg`
de uma execução. O volume é denormalizado (para somar a semana numa query só) e
o JSON é o detalhe — os dois só ficam em acordo porque ninguém mais os escreve.

O contrato de produto: **marcar é um toque**. Sem séries no corpo, preenchemos a
partir da prescrição e marcamos o volume como estimado; com séries, o volume é
exato. A resposta sempre diz qual dos dois é.
"""

import json
import re

MAXIMO_SERIES = 20
MAXIMO_REPS = 500

def reps_prescritas(texto: str | None) -> int | None:
    """
    Quantas repetições um texto de prescrição representa. None se não representa.

    `repeticoes` é texto livre por decisão antiga e boa: cabe "8-12", "até a
    falha", "12 cada perna", "45s". O parser cobre o que é contável e **desiste
    explicitamente** do resto — para "45s" a resposta certa é "não sei", não um
    número inventado.

    Faixa devolve o **piso**: "8-12" vira 8. Estimativa nunca infla; num app de
    treino, subestimar o esforço é mais seguro do que superestimá-lo.
    """
    if not texto:
        return None

    limpo = str(texto).strip().lower()

    # "45s", "30 seg", "1 min" são tempo, não repetição.
    if re.search(r"\d\s*(s|seg|segundos?|min|minutos?)\b", limpo):
        return None

    numeros = [int(n) for n in re.findall(r"\d+", limpo)]
    if not numeros:
        return None  # "até a falha", "máximo", ""

    valor = min(numeros)  # piso da faixa; num só, é ele mesmo
    return valor if 0 < valor <= MAXIMO_REPS else None

def preencher(series_prescritas: int, repeticoes: str | None, carga_kg: float | None):
    """
    As séries que um toque produz: N séries iguais, com o reps e a carga previstos.

    É o palpite certo na esmagadora maioria das vezes — quem seguiu o treino fez
    o que estava escrito. Quem não seguiu corrige série a série.
    """
    reps = reps_prescritas(repeticoes)
    quantidade = max(1, min(series_prescritas or 1, MAXIMO_SERIES))
    return [{"reps": reps, "carga_kg": carga_kg} for _ in range(quantidade)]

def normalizar(series) -> list[dict]:
    """Limpa o que veio do cliente: descarta lixo, corta exageros."""
    if not series:
        return []

    limpas = []
    for serie in series[:MAXIMO_SERIES]:
        # Aceita tanto o modelo pydantic quanto dict cru (o seed usa dict).
        reps = getattr(serie, "reps", None) if not isinstance(serie, dict) else serie.get("reps")
        carga = (
            getattr(serie, "carga_kg", None)
            if not isinstance(serie, dict)
            else serie.get("carga_kg")
        )

        if reps is not None:
            reps = int(reps)
            if reps < 0 or reps > MAXIMO_REPS:
                raise ValueError(f"Repetições fora do intervalo: {reps}")
        if carga is not None:
            carga = float(carga)
            if carga < 0:
                raise ValueError("Carga não pode ser negativa")

        limpas.append({"reps": reps, "carga_kg": carga})

    return limpas

def consolidar(series, *, series_prescritas: int, repeticoes: str, carga_prescrita) -> dict:
    """
    Das séries (informadas ou preenchidas) para as colunas da execução.

    Devolve o dicionário pronto para `setattr` na linha — inclusive `carga_kg`,
    que passa a ser o **máximo** das séries. Isso é o que mantém `avaliar()`,
    `pronto_para_subir` e o gráfico de carga funcionando sem reescrita: eles
    sempre leram `carga_kg` como "a carga daquele dia".
    """
    informadas = normalizar(series)
    estimado = not informadas

    if estimado:
        informadas = preencher(series_prescritas, repeticoes, carga_prescrita)

    cargas = [s["carga_kg"] for s in informadas if s["carga_kg"] is not None]
    repeticoes_totais = sum(s["reps"] for s in informadas if s["reps"] is not None)

    # Volume só existe quando a série tem os dois lados. Exercício de peso
    # corporal (sem carga) ou isometria (sem reps) simplesmente não entra na
    # soma — e a agregação conta essas execuções à parte, para a tela poder
    # dizer que elas existem em vez de fingir que o total é completo.
    parcelas = [
        s["reps"] * s["carga_kg"]
        for s in informadas
        if s["reps"] is not None and s["carga_kg"] is not None
    ]

    return {
        "series_realizadas": json.dumps(informadas, ensure_ascii=False),
        "series_feitas": len(informadas),
        "repeticoes_totais": repeticoes_totais or None,
        "volume_kg": round(sum(parcelas), 2) if parcelas else None,
        "volume_estimado": estimado,
        "carga_kg": max(cargas) if cargas else None,
    }

def ler(series_realizadas: str | None) -> list[dict]:
    """As séries de uma execução, para exibir o "10 · 9 · 8"."""
    if not series_realizadas:
        return []
    try:
        series = json.loads(series_realizadas)
    except (ValueError, TypeError):
        return []
    return series if isinstance(series, list) else []
