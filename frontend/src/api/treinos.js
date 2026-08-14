import { comCorpo, montarQuery, requisitar } from "./client.js";

export const treinos = {
  /**
   * Arquivado fica de fora por padrão. `incluirArquivados` traz os dois — é a
   * tela de arquivados que separa —, e o servidor ignora o pedido quando quem
   * chama é o aluno: plano fora do ar não volta por parâmetro de URL.
   */
  listar: (alunoId, incluirArquivados = false) =>
    requisitar(
      `/treinos${montarQuery({
        aluno_id: alunoId ?? undefined,
        incluir_arquivados: incluirArquivados || undefined,
      })}`
    ),
  buscar: (id) => requisitar(`/treinos/${id}`),
  criar: (dados) => requisitar("/treinos", comCorpo("POST", dados)),
  atualizar: (id, dados) => requisitar(`/treinos/${id}`, comCorpo("PUT", dados)),
  /**
   * Tira do ar sem apagar. Excluir levava junto o vínculo do histórico; isto
   * some das listas e da tela do aluno, e o registro segue inteiro.
   */
  arquivar: (id) => requisitar(`/treinos/${id}/arquivar`, { method: "POST" }),
  desarquivar: (id) => requisitar(`/treinos/${id}/desarquivar`, { method: "POST" }),

  deletar: (id) => requisitar(`/treinos/${id}`, { method: "DELETE" }),

  // Prescrições: os exercícios do catálogo que compõem o treino.
  exercicios: {
    listar: (treinoId) => requisitar(`/treinos/${treinoId}/exercicios`),
    adicionar: (treinoId, dados) =>
      requisitar(`/treinos/${treinoId}/exercicios`, comCorpo("POST", dados)),
    atualizar: (treinoId, itemId, dados) =>
      requisitar(`/treinos/${treinoId}/exercicios/${itemId}`, comCorpo("PUT", dados)),
    remover: (treinoId, itemId) =>
      requisitar(`/treinos/${treinoId}/exercicios/${itemId}`, { method: "DELETE" }),
    reordenar: (treinoId, ids) =>
      requisitar(`/treinos/${treinoId}/exercicios/ordem`, comCorpo("PUT", ids)),
  },
};
