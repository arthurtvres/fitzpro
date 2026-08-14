import { montarQuery, requisitar } from "./client.js";

/**
 * Tabela TACO, somente leitura. Serve o autocompletar da prescrição de dieta.
 *
 * Os valores são sempre por 100 g — é como a TACO publica. A conta da porção
 * fica no cliente (`macrosDaPorcao`), porque ela muda a cada tecla digitada na
 * quantidade e uma ida ao servidor por tecla seria absurda.
 */
export const alimentos = {
  buscar: (busca, limite = 8, { fonte, ordenar } = {}) =>
    requisitar(`/alimentos${montarQuery({ busca, limite, fonte, ordenar })}`),

  obter: (id) => requisitar(`/alimentos/${id}`),
};
