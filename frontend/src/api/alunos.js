import { comCorpo, montarQuery, requisitar } from "./client.js";

/**
 * Aluno é um usuário com papel ALUNO — mesma tabela do personal, como no Corexa.
 * Este módulo já fixa o papel para as telas não precisarem repetir isso.
 */
export const alunos = {
  listar: (incluirInativos = false) =>
    requisitar(
      `/usuarios${montarQuery({ papel: "ALUNO", incluir_inativos: incluirInativos })}`
    ),
  buscar: (id) => requisitar(`/usuarios/${id}`),
  criar: (dados) => requisitar("/usuarios", comCorpo("POST", { ...dados, papel: "ALUNO" })),
  atualizar: (id, dados) =>
    requisitar(`/usuarios/${id}`, comCorpo("PUT", { ...dados, papel: "ALUNO" })),
  trocarSenha: (id, senhaNova) =>
    requisitar(`/usuarios/${id}/senha`, comCorpo("PUT", { senha_nova: senhaNova })),
  desativar: (id) => requisitar(`/usuarios/${id}`, { method: "DELETE" }),
  reativar: (id) => requisitar(`/usuarios/${id}/reativar`, { method: "POST" }),

  /**
   * Manda o convite de novo; o anterior deixa de valer.
   *
   * Existe porque o link dura 7 dias e e-mail se perde. Sem isto, a saída do
   * personal seria apagar e recriar o aluno — levando junto treinos, dietas e
   * todo o histórico de execução.
   */
  reenviarConvite: (id) => requisitar(`/usuarios/${id}/convite`, { method: "POST" }),

  /**
   * Anotações privadas do personal sobre o aluno.
   *
   * Rota própria e não um campo do cadastro: a resposta de `publico()` vai para
   * o próprio aluno em `/auth/eu`, então a nota não pode viajar nela.
   */
  observacoes: {
    ler: (id) => requisitar(`/usuarios/${id}/observacoes`),
    salvar: (id, texto) =>
      requisitar(`/usuarios/${id}/observacoes`, comCorpo("PUT", { texto })),
  },

  avaliacoes: {
    listar: (alunoId) => requisitar(`/alunos/${alunoId}/avaliacoes`),
    criar: (alunoId, dados) =>
      requisitar(`/alunos/${alunoId}/avaliacoes`, comCorpo("POST", dados)),
    atualizar: (alunoId, avaliacaoId, dados) =>
      requisitar(`/alunos/${alunoId}/avaliacoes/${avaliacaoId}`, comCorpo("PUT", dados)),
    remover: (alunoId, avaliacaoId) =>
      requisitar(`/alunos/${alunoId}/avaliacoes/${avaliacaoId}`, { method: "DELETE" }),
  },

  
};
