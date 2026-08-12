import { comCorpo, requisitar } from "./client.js";

export const treinos = {
  listar: (alunoId) =>
    requisitar(alunoId == null ? "/treinos" : `/treinos?aluno_id=${alunoId}`),
  buscar: (id) => requisitar(`/treinos/${id}`),
  criar: (dados) => requisitar("/treinos", comCorpo("POST", dados)),
  atualizar: (id, dados) => requisitar(`/treinos/${id}`, comCorpo("PUT", dados)),
  deletar: (id) => requisitar(`/treinos/${id}`, { method: "DELETE" }),

  // Prescrições: os exercícios do catálogo que compõem o treino.
  exercicios: {
    listar: (treinoId) => requisitar(`/treinos/${treinoId}/exercicios`),
    adicionar: (treinoId, dados) =>
      requisitar(`/treinos/${treinoId}/exercicios`, comCorpo("POST", dados)),
    atualizar: (treinoId, itemId, dados) =>
      requisitar(`/treinos/${treinoId}/exercicios/${itemId}`, comCorpo("PUT", dados)),
    remover: (treinoId, itemId) =>
      requisitar(`/treinos/${treinoId}/exercicios/${itemId}`, { method: "DELETE" }),
    reordenar: (treinoId, ids) =>
      requisitar(`/treinos/${treinoId}/exercicios/ordem`, comCorpo("PUT", ids)),
  },
};
