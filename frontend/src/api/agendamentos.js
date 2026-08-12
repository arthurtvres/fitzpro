import { comCorpo, montarQuery, requisitar } from "./client.js";

export const agendamentos = {
  listar: (filtros = {}) => requisitar(`/agendamentos${montarQuery(filtros)}`),
  criar: (dados) => requisitar("/agendamentos", comCorpo("POST", dados)),
  atualizar: (id, dados) => requisitar(`/agendamentos/${id}`, comCorpo("PUT", dados)),
  remover: (id) => requisitar(`/agendamentos/${id}`, { method: "DELETE" }),
};
