"""
Converte a TACO (CSV) no `app/data/alimentos.json` que o app lê.

Rodado à mão, e não no startup: a tabela é estável — 597 alimentos que não
mudam entre versões da TACO —, e converter a cada boot custaria tempo de
partida para produzir sempre o mesmo arquivo. Mesma escolha do catálogo de
exercícios, que também é um JSON versionado.

    cd backend && python scripts/gerar_alimentos.py

O CSV de origem fica em `dataset/` e **não** precisa ir para o repositório: só
o JSON gerado é lido pelo app.
"""

import csv
import io
import json
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ORIGEM = RAIZ / "dataset" / "taco-db-nutrientes.csv"
DESTINO = RAIZ / "app" / "data" / "alimentos.json"

# As colunas da TACO que a prescrição de dieta usa. O resto da tabela —
# umidade, cinzas, colesterol, minerais — fica de fora: é informação real, mas
# ninguém monta refeição por ela, e carregá-la só engorda o que vai para a
# memória e para a resposta da API.
COLUNAS = {
    "kcal": "Energia (kcal)",
    "proteina_g": "Proteína (g)",
    "carboidrato_g": "Carboidrato (g)",
    "gordura_g": "Lipídeos (g)",
    "fibra_g": "Fibra Alimentar (g)",
}

def numero(bruto: str) -> float | None:
    """
    O valor da célula, ou None quando não há valor.

    A distinção que importa: **"Tr" (traço) vira 0, "NA" e "*" viram None.**
    Traço significa "presente em quantidade desprezível" — zero, para efeito de
    contar macro. "NA" é *não analisado*, e "*" é valor não disponível: tratar
    esses dois como zero seria inventar dado, e o erro entraria calado na soma
    da refeição, que é justamente onde ninguém confere.
    """
    valor = (bruto or "").strip()
    if valor == "Tr":
        return 0.0
    if valor in ("", "NA", "*"):
        return None
    try:
        return float(valor.replace(",", "."))
    except ValueError:
        return None

def sem_acento(texto: str) -> str:
    """Campo de busca pré-calculado: "maçã" acha digitando "maca"."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )

# 1 kcal = 4,184 kJ. A TACO publica as duas, e a razao entre elas e uma
# invariante fisica — se ela nao bater, a linha esta desalinhada.
KJ_POR_KCAL = 4.184

def realinhar(linha: list[str], colunas: int) -> list[str]:
    """
    Conserta linhas com coluna sobrando.

    Duas linhas da TACO (Cana aguardente, Cerveja pilsen) trazem um numero
    solto logo depois do nome, o que empurra todo o resto uma casa: o valor em
    kJ acaba lido como proteina, e "aguardente com 902 g de proteina" entra na
    base sem ninguem notar. Descartar o campo extra realinha — e a checagem de
    kcal/kJ no fim confirma que realinhou certo.
    """
    while len(linha) > colunas and not (linha[-1] or "").strip():
        linha = linha[:-1]
    while len(linha) > colunas:
        linha = linha[:2] + linha[3:]
    return linha

def main() -> None:
    linhas = list(csv.reader(io.open(ORIGEM, encoding="utf-8-sig")))
    cabecalho = [c.strip() for c in linhas[0]]
    indice = {c: n for n, c in enumerate(cabecalho)}

    faltando = [c for c in COLUNAS.values() if c not in indice]
    if faltando:
        raise SystemExit(f"Colunas ausentes no CSV: {faltando}")

    def celula(linha, coluna):
        posicao = indice[coluna]
        return linha[posicao] if posicao < len(linha) else ""

    # O cabecalho termina em virgula, entao a ultima coluna e vazia e nao conta.
    colunas_reais = len([c for c in cabecalho if c])

    alimentos = []
    suspeitas = []
    for linha in linhas[1:]:
        linha = realinhar(linha, colunas_reais)
        # `" ".join(split())` e nao so `strip()`: a TACO tem nomes com espaco
        # duplo no meio ("Coco  verde cru"), que aparecem assim na tela e
        # atrapalham a busca por trecho.
        nome = " ".join(celula(linha, "Nome").split())
        if not nome:
            continue

        alimentos.append(
            {
                "id": int(celula(linha, "id").strip()),
                "nome": nome,
                "busca": sem_acento(nome),
                **{
                    chave: numero(celula(linha, coluna))
                    for chave, coluna in COLUNAS.items()
                },
            }
        )

        # A prova de que a linha esta alinhada: energia em kcal e em kJ tem
        # que guardar a razao de 4,184. Fora de uma folga generosa, o dado nao
        # e confiavel e precisa ser olhado a mao — melhor gritar do que
        # publicar um alimento com macro de outra coluna.
        kcal = numero(celula(linha, "Energia (kcal)"))
        kj = numero(celula(linha, "Energia (kJ)"))
        if kcal and kj and not (3.6 <= kj / kcal <= 4.8):
            suspeitas.append((nome, kcal, kj, round(kj / kcal, 2)))

    alimentos.sort(key=lambda a: a["busca"])
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(alimentos, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    if suspeitas:
        print("  ATENCAO — energia kcal/kJ fora da razao esperada (4,184):")
        for nome, kcal, kj, razao in suspeitas:
            print(f"    {nome}: {kcal} kcal / {kj} kJ = {razao}")

    sem_dados = [a for a in alimentos if a["kcal"] is None]
    print(f"{len(alimentos)} alimentos -> {DESTINO.relative_to(RAIZ)}")
    print(f"  {len(sem_dados)} sem valor de energia (mantidos, com campos nulos):")
    for a in sem_dados:
        print(f"    {a['nome']}")

if __name__ == "__main__":
    main()
