from datetime import datetime, timezone

from pydantic import field_validator
from sqlalchemy import JSON, Column, Text
from sqlmodel import Field, SQLModel

from app.services.catalogo import CATEGORIAS_PT, EQUIPAMENTOS_PT, MUSCULOS_PT, NIVEIS_PT

# Foto ou gif de demonstração do movimento, como data URL — mesma solução da
# foto de perfil e das fotos de avaliação. Gif não passa pelo redimensionamento
# do front (achataria a animação num quadro só), então o limite aqui é maior:
# folga para um gif curto sem comprimir, não só para uma foto.
TIPOS_IMAGEM_ACEITOS = ("data:image/jpeg", "data:image/png", "data:image/webp", "data:image/gif")
TAMANHO_MAXIMO_IMAGEM = 6_000_000


def _validar_vocabulario(valor: str | None, vocabulario: dict[str, str], rotulo: str) -> str | None:
    if valor is not None and valor not in vocabulario:
        raise ValueError(f"{rotulo} inválido: {valor}")
    return valor


class ExercicioPersonalizadoCriacao(SQLModel):
    """Exercício próprio do personal, fora do free-exercise-db.

    Usa os mesmos vocabulários fechados do catálogo público (`catalogo.py`)
    para categoria, equipamento, nível e músculo — assim os filtros da tela de
    catálogo continuam valendo sobre uma listagem que mistura os dois.
    """

    nome: str
    categoria: str | None = None
    equipamento: str | None = None
    nivel: str | None = None
    # sa_column aqui, e não só na tabela: SQLModel aplica a coluna também na
    # subclasse table=True, mesmo padrão de `Usuario.foto_url` em UsuarioBase.
    musculos_primarios: list[str] = Field(default=[], sa_column=Column(JSON))
    instrucoes: str = Field(default="", sa_column=Column(Text))
    imagem_url: str | None = Field(default=None, sa_column=Column(Text))

    @field_validator("categoria")
    @classmethod
    def validar_categoria(cls, valor: str | None) -> str | None:
        return _validar_vocabulario(valor, CATEGORIAS_PT, "Categoria")

    @field_validator("equipamento")
    @classmethod
    def validar_equipamento(cls, valor: str | None) -> str | None:
        return _validar_vocabulario(valor, EQUIPAMENTOS_PT, "Equipamento")

    @field_validator("nivel")
    @classmethod
    def validar_nivel(cls, valor: str | None) -> str | None:
        return _validar_vocabulario(valor, NIVEIS_PT, "Nível")

    @field_validator("musculos_primarios")
    @classmethod
    def validar_musculos(cls, valores: list[str]) -> list[str]:
        invalidos = [v for v in valores if v not in MUSCULOS_PT]
        if invalidos:
            raise ValueError(f"Músculo inválido: {', '.join(invalidos)}")
        return valores

    @field_validator("imagem_url")
    @classmethod
    def validar_imagem(cls, valor: str | None) -> str | None:
        """Sem isto o campo aceitaria texto qualquer, de qualquer tamanho."""
        if not valor:
            return None
        if not valor.startswith(TIPOS_IMAGEM_ACEITOS):
            raise ValueError("A imagem precisa ser JPG, PNG, WEBP ou GIF.")
        if len(valor) > TAMANHO_MAXIMO_IMAGEM:
            raise ValueError("O arquivo é grande demais. Envie um menor.")
        return valor


class ExercicioPersonalizado(ExercicioPersonalizadoCriacao, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Dono da biblioteca — nunca vem do corpo, mesmo padrão de `Usuario.personal_id`.
    personal_id: int = Field(foreign_key="usuario.id", index=True)

    # Nulo = ativo, mesmo padrão de `Treino.arquivado_em`/`Dieta.arquivado_em`.
    arquivado_em: datetime | None = None
    criado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
