import { comCorpo, montarQuery, requisitar } from "./client.js";

/**
 * Registro do que foi feito: exercícios concluídos e refeições consumidas.
 *
 * Marcar é `PUT` na chave (item, dia), não `POST`: o controle na tela é uma
 * caixa de marcar, e marcar duas vezes tem que atualizar a carga em vez de
 * criar uma segunda linha. Por isso nenhuma função daqui precisa de um id de
 * execução — o par (item, data) já identifica o registro.
 */
export const execucoes = {
  treino: {
    progresso: (treinoId, { data, sessao_id } = {}) =>
      requisitar(`/treinos/${treinoId}/progresso${montarQuery({ data, sessao_id })}`),

    /**
     * Marca o exercício. Sem `series` no corpo, o servidor preenche a partir do
     * prescrito e devolve o volume marcado como estimado — é o que mantém a
     * marcação em um toque.
     */
    marcar: (treinoId, itemId, dados = {}) =>
      requisitar(
        `/treinos/${treinoId}/exercicios/${itemId}/execucao`,
        comCorpo("PUT", dados)
      ),

    desmarcar: (treinoId, itemId, { data, sessao_id } = {}) =>
      requisitar(
        `/treinos/${treinoId}/exercicios/${itemId}/execucao${montarQuery({
          data,
          sessao_id,
        })}`,
        { method: "DELETE" }
      ),

    sessoes: {
      iniciar: (treinoId, dados = {}) =>
        requisitar(`/treinos/${treinoId}/sessoes`, comCorpo("POST", dados)),

      /** Devolve a duração e os recordes que a sessão produziu. */
      finalizar: (treinoId, sessaoId) =>
        requisitar(
          `/treinos/${treinoId}/sessoes/${sessaoId}/finalizar`,
          comCorpo("POST", {})
        ),

      cancelar: (treinoId, sessaoId) =>
        requisitar(`/treinos/${treinoId}/sessoes/${sessaoId}`, { method: "DELETE" }),
    },
  },

  dieta: {
    progresso: (dietaId, data) =>
      requisitar(`/dietas/${dietaId}/progresso${montarQuery({ data })}`),

    marcar: (dietaId, refeicaoId, dados = {}) =>
      requisitar(
        `/dietas/${dietaId}/refeicoes/${refeicaoId}/execucao`,
        comCorpo("PUT", dados)
      ),

    desmarcar: (dietaId, refeicaoId, data) =>
      requisitar(
        `/dietas/${dietaId}/refeicoes/${refeicaoId}/execucao${montarQuery({ data })}`,
        { method: "DELETE" }
      ),
  },
};
