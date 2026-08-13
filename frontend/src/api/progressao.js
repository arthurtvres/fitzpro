import { montarQuery, requisitar } from "./client.js";

/**
 * A leitura do histórico. Só leitura — nenhuma rota daqui altera prescrição.
 *
 * `pronto_para_subir` é sinal para o personal, não comando: quem decide se a
 * carga sobe é ele, pelo formulário de prescrição que já existe.
 */
export const progressao = {
  /**
   * Tudo o que a Home do aluno mostra, numa requisição só.
   *
   * A Home é uma tela carregada de uma vez, num celular na academia: vários
   * endpoints seriam vários round-trips, e todos os cards derivam do mesmo
   * array de sessões no servidor.
   */
  resumo: (alunoId, data) =>
    requisitar(`/alunos/${alunoId}/progressao/resumo${montarQuery({ data })}`),

  /** Uma linha por prescrição do aluno, com a sugestão de subir a carga. */
  treinos: (alunoId) => requisitar(`/alunos/${alunoId}/progressao/treinos`),

  /** A série de um exercício, da mais antiga para a mais recente. */
  exercicio: (alunoId, exercicioId) =>
    requisitar(`/alunos/${alunoId}/progressao/exercicios/${exercicioId}`),
};
