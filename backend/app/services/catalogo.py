"""Catálogo de exercícios (free-exercise-db), carregado em memória no startup.

São 873 exercícios num JSON de 1 MB versionado em app/data/. Como o dado é somente
leitura e pequeno, fica tudo em memória: busca e filtro rodam sem tocar o banco.

Fonte: https://github.com/yuhonas/free-exercise-db (Unlicense / domínio público)
"""

import json
import unicodedata

from app.core.config import ARQUIVO_EXERCICIOS, BASE_IMAGENS_EXERCICIOS

# Os nomes dos exercícios ficam em inglês, mas os valores de filtro são poucos e
# fechados — traduzi-los deixa a interface coerente com o resto do sistema.
MUSCULOS_PT = {
    "abdominals": "abdômen",
    "abductors": "abdutores",
    "adductors": "adutores",
    "biceps": "bíceps",
    "calves": "panturrilhas",
    "chest": "peito",
    "forearms": "antebraços",
    "glutes": "glúteos",
    "hamstrings": "posterior de coxa",
    "lats": "dorsais",
    "lower back": "lombar",
    "middle back": "meio das costas",
    "neck": "pescoço",
    "quadriceps": "quadríceps",
    "shoulders": "ombros",
    "traps": "trapézio",
    "triceps": "tríceps",
}

EQUIPAMENTOS_PT = {
    "bands": "elásticos",
    "barbell": "barra",
    "body only": "peso do corpo",
    "cable": "cabo",
    "dumbbell": "halteres",
    "e-z curl bar": "barra W",
    "exercise ball": "bola suíça",
    "foam roll": "rolo de espuma",
    "kettlebells": "kettlebell",
    "machine": "máquina",
    "medicine ball": "medicine ball",
    "other": "outro",
}

CATEGORIAS_PT = {
    "cardio": "cardio",
    "olympic weightlifting": "levantamento olímpico",
    "plyometrics": "pliometria",
    "powerlifting": "powerlifting",
    "strength": "força",
    "stretching": "alongamento",
    "strongman": "strongman",
}

NIVEIS_PT = {
    "beginner": "iniciante",
    "intermediate": "intermediário",
    "expert": "avançado",
}

FORCAS_PT = {"pull": "puxar", "push": "empurrar", "static": "estático"}

MECANICAS_PT = {"compound": "composto", "isolation": "isolado"}

# Vários registros vêm com equipment/force/mechanic nulos — nunca assuma string.
NAO_INFORMADO = "não informado"

_por_id: dict[str, dict] = {}
_ordenados: list[dict] = []


def _sem_acento(texto: str) -> str:
    normalizado = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in normalizado if unicodedata.category(c) != "Mn")


def _traduzir(mapa: dict[str, str], valor: str | None) -> str:
    if valor is None:
        return NAO_INFORMADO
    return mapa.get(valor, valor)


def _normalizar(bruto: dict) -> dict:
    """Deixa o exercício pronto para uso: URLs completas e campo de busca."""
    return {
        "id": bruto["id"],
        "nome": bruto["name"],
        "categoria": bruto.get("category"),
        "categoria_pt": _traduzir(CATEGORIAS_PT, bruto.get("category")),
        "equipamento": bruto.get("equipment"),
        "equipamento_pt": _traduzir(EQUIPAMENTOS_PT, bruto.get("equipment")),
        "nivel": bruto.get("level"),
        "nivel_pt": _traduzir(NIVEIS_PT, bruto.get("level")),
        "forca_pt": _traduzir(FORCAS_PT, bruto.get("force")),
        "mecanica_pt": _traduzir(MECANICAS_PT, bruto.get("mechanic")),
        "musculos_primarios": bruto.get("primaryMuscles", []),
        "musculos_primarios_pt": [
            _traduzir(MUSCULOS_PT, m) for m in bruto.get("primaryMuscles", [])
        ],
        "musculos_secundarios_pt": [
            _traduzir(MUSCULOS_PT, m) for m in bruto.get("secondaryMuscles", [])
        ],
        "instrucoes": bruto.get("instructions", []),
        "imagens": [f"{BASE_IMAGENS_EXERCICIOS}/{caminho}" for caminho in bruto.get("images", [])],
        # Pré-calculado para a busca não normalizar 873 nomes a cada requisição.
        "_busca": _sem_acento(bruto["name"]),
    }


def carregar() -> int:
    """Lê o JSON para a memória. Chamado uma vez, no lifespan do app."""
    global _por_id, _ordenados

    with open(ARQUIVO_EXERCICIOS, encoding="utf-8") as arquivo:
        brutos = json.load(arquivo)

    _ordenados = sorted((_normalizar(b) for b in brutos), key=lambda e: e["nome"])
    _por_id = {e["id"]: e for e in _ordenados}
    return len(_ordenados)


def _publico(exercicio: dict, completo: bool = False) -> dict:
    """Copia sem os campos internos; a listagem não devolve instruções."""
    dados = {c: v for c, v in exercicio.items() if not c.startswith("_")}
    if not completo:
        dados.pop("instrucoes", None)
        dados.pop("musculos_secundarios_pt", None)
        # Na listagem uma imagem basta; a outra só interessa no detalhe.
        dados["imagens"] = dados["imagens"][:1]
    return dados


def listar(
    busca: str | None = None,
    musculo: str | None = None,
    equipamento: str | None = None,
    categoria: str | None = None,
    nivel: str | None = None,
    limite: int = 30,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    """Retorna (total de resultados, página pedida)."""
    resultado = _ordenados

    if busca:
        termo = _sem_acento(busca)
        resultado = [e for e in resultado if termo in e["_busca"]]
    if musculo:
        resultado = [e for e in resultado if musculo in e["musculos_primarios"]]
    if equipamento:
        resultado = [e for e in resultado if e["equipamento"] == equipamento]
    if categoria:
        resultado = [e for e in resultado if e["categoria"] == categoria]
    if nivel:
        resultado = [e for e in resultado if e["nivel"] == nivel]

    pagina = resultado[offset : offset + limite]
    return len(resultado), [_publico(e) for e in pagina]


def obter(exercicio_id: str) -> dict | None:
    exercicio = _por_id.get(exercicio_id)
    return _publico(exercicio, completo=True) if exercicio else None


def existe(exercicio_id: str) -> bool:
    return exercicio_id in _por_id


def resumo(exercicio_id: str) -> dict | None:
    """Resumo para embutir na prescrição de um treino."""
    exercicio = _por_id.get(exercicio_id)
    if not exercicio:
        return None
    return {
        "id": exercicio["id"],
        "nome": exercicio["nome"],
        "equipamento_pt": exercicio["equipamento_pt"],
        "musculos_primarios_pt": exercicio["musculos_primarios_pt"],
        "imagem": exercicio["imagens"][0] if exercicio["imagens"] else None,
    }


def filtros() -> dict:
    """Valores disponíveis para os selects, já com rótulo em português.

    Só entram valores que existem no dataset — daí serem derivados dele em vez de
    devolver as tabelas de tradução inteiras.
    """

    def opcoes(campo: str, mapa: dict[str, str]) -> list[dict]:
        valores = {e[campo] for e in _ordenados if e[campo]}
        return sorted(
            ({"valor": v, "rotulo": _traduzir(mapa, v)} for v in valores),
            key=lambda o: o["rotulo"],
        )

    musculos = {m for e in _ordenados for m in e["musculos_primarios"]}

    return {
        "musculos": sorted(
            ({"valor": m, "rotulo": _traduzir(MUSCULOS_PT, m)} for m in musculos),
            key=lambda o: o["rotulo"],
        ),
        "equipamentos": opcoes("equipamento", EQUIPAMENTOS_PT),
        "categorias": opcoes("categoria", CATEGORIAS_PT),
        "niveis": opcoes("nivel", NIVEIS_PT),
    }
