import { comCorpo, montarQuery, requisitar } from "./client.js";

/**
 * Tabela TACO, somente leitura, misturada com a biblioteca de alimentos
 * personalizados do personal logado. Serve o autocompletar da prescrição de
 * dieta.
 *
 * Os valores são sempre por 100 g — é como a TACO publica. A conta da porção
 * fica no cliente (`macrosDaPorcao`), porque ela muda a cada tecla digitada na
 * quantidade e uma ida ao servidor por tecla seria absurda.
 */
export const alimentos = {
  // `origem` separa "taco" de "personal" — é o que as abas do catálogo usam
  // para não misturar os dois. Sem passar, a busca traz os dois juntos (o
  // caso do autocompletar da dieta).
  buscar: (busca, limite = 8, { fonte, ordenar, origem } = {}) =>
    requisitar(`/alimentos${montarQuery({ busca, limite, fonte, ordenar, origem })}`),

  obter: (id) => requisitar(`/alimentos/${id}`),

  // A biblioteca própria do personal — alimentos fora da TACO.
  personalizados: {
    listar: (incluirArquivados = false) =>
      requisitar(`/alimentos/personalizados/mine${montarQuery({ incluir_arquivados: incluirArquivados })}`),
    obter: (id) => requisitar(`/alimentos/personalizados/${id}`),
    criar: (dados) => requisitar("/alimentos/personalizados", comCorpo("POST", dados)),
    atualizar: (id, dados) => requisitar(`/alimentos/personalizados/${id}`, comCorpo("PUT", dados)),
    arquivar: (id) => requisitar(`/alimentos/personalizados/${id}/arquivar`, { method: "POST" }),
    desarquivar: (id) => requisitar(`/alimentos/personalizados/${id}/desarquivar`, { method: "POST" }),
  },
};
