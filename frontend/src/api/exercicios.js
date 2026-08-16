import { comCorpo, montarQuery, requisitar } from "./client.js";

export const exercicios = {
  listar: (filtros = {}) => requisitar(`/exercicios${montarQuery(filtros)}`),
  filtros: () => requisitar("/exercicios/filtros"),
  buscar: (id) => requisitar(`/exercicios/${id}`),

  // A biblioteca própria do personal — os itens fora do free-exercise-db.
  personalizados: {
    listar: (incluirArquivados = false) =>
      requisitar(`/exercicios/personalizados/mine${montarQuery({ incluir_arquivados: incluirArquivados })}`),
    criar: (dados) => requisitar("/exercicios/personalizados", comCorpo("POST", dados)),
    atualizar: (id, dados) => requisitar(`/exercicios/personalizados/${id}`, comCorpo("PUT", dados)),
    arquivar: (id) => requisitar(`/exercicios/personalizados/${id}/arquivar`, { method: "POST" }),
    desarquivar: (id) => requisitar(`/exercicios/personalizados/${id}/desarquivar`, { method: "POST" }),
  },
};
