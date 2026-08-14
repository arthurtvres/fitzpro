import { comCorpo, montarQuery, requisitar } from "./client.js";

export const dietas = {
  /**
   * Arquivado fica de fora por padrão. `incluirArquivados` traz os dois — é a
   * tela de arquivados que separa —, e o servidor ignora o pedido quando quem
   * chama é o aluno: plano fora do ar não volta por parâmetro de URL.
   */
  listar: (alunoId, incluirArquivados = false) =>
    requisitar(
      `/dietas${montarQuery({
        aluno_id: alunoId ?? undefined,
        incluir_arquivados: incluirArquivados || undefined,
      })}`
    ),
  criar: (dados) => requisitar("/dietas", comCorpo("POST", dados)),
  atualizar: (id, dados) => requisitar(`/dietas/${id}`, comCorpo("PUT", dados)),
  /**
   * Tira do ar sem apagar. Excluir levava junto o vínculo do histórico; isto
   * some das listas e da tela do aluno, e o registro segue inteiro.
   */
  arquivar: (id) => requisitar(`/dietas/${id}/arquivar`, { method: "POST" }),
  desarquivar: (id) => requisitar(`/dietas/${id}/desarquivar`, { method: "POST" }),

  deletar: (id) => requisitar(`/dietas/${id}`, { method: "DELETE" }),
};
