import { comCorpo, requisitar } from "./client.js";

export const dietas = {
  listar: (alunoId) =>
    requisitar(alunoId == null ? "/dietas" : `/dietas?aluno_id=${alunoId}`),
  criar: (dados) => requisitar("/dietas", comCorpo("POST", dados)),
  atualizar: (id, dados) => requisitar(`/dietas/${id}`, comCorpo("PUT", dados)),
  deletar: (id) => requisitar(`/dietas/${id}`, { method: "DELETE" }),
};
