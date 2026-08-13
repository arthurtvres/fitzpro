from app.models.usuario import (
    FaixaDeAlunos,
    Papel,
    TrocaDeSenha,
    Usuario,
    UsuarioAtualizacao,
    UsuarioCriacao,
    cartao_de_contato,
    idade_de,
    normalizar_telefone,
    publico,
)
from app.models.avaliacao import Avaliacao, AvaliacaoCriacao, imc
from app.models.execucao_exercicio import (
    ExecucaoExercicio,
    ExecucaoExercicioCriacao,
    ExecucaoExercicioEntrada,
    SerieRealizada,
)
from app.models.execucao_refeicao import ExecucaoRefeicao, ExecucaoRefeicaoCriacao
from app.models.sessao_treino import SessaoTreino, SessaoTreinoCriacao
from app.models.agendamento import Agendamento, AgendamentoCriacao, TipoAgendamento
from app.models.treino import Treino, TreinoCriacao
from app.models.treino_exercicio import TreinoExercicio, TreinoExercicioCriacao
from app.models.dieta import Dieta, DietaCriacao
# Precisa estar aqui, e não só no módulo: o autogenerate do Alembic só enxerga
# tabela que foi importada — modelo fora desta lista gera migration vazia.
from app.models.token_acesso import FinalidadeDoToken, TokenDeAcesso
