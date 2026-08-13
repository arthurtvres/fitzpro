import { montarQuery, requisitar } from "./client.js";

/**
 * A visão do personal sobre a carteira inteira.
 *
 * Complementa `progressao`, que responde sobre um aluno só: aqui a pergunta é
 * "meus alunos estão treinando?", e ela precisa de todos de uma vez.
 */
export const painel = {
  resumo: (data) => requisitar(`/painel/resumo${montarQuery({ data })}`),
};
