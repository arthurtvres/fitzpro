import { montarQuery, requisitar } from "./client.js";

export const exercicios = {
  listar: (filtros = {}) => requisitar(`/exercicios${montarQuery(filtros)}`),
  filtros: () => requisitar("/exercicios/filtros"),
  buscar: (id) => requisitar(`/exercicios/${id}`),
};
