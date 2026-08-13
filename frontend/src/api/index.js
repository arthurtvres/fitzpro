import { alunos } from "./alunos.js";
import { agendamentos } from "./agendamentos.js";
import { auth } from "./auth.js";
import { dietas } from "./dietas.js";
import { execucoes } from "./execucoes.js";
import { painel } from "./painel.js";
import { exercicios } from "./exercicios.js";
import { perfil } from "./perfil.js";
import { progressao } from "./progressao.js";
import { treinos } from "./treinos.js";

/** Ponto único de acesso à API — os componentes importam só daqui. */
export const api = {
  auth,
  alunos,
  treinos,
  dietas,
  exercicios,
  agendamentos,
  perfil,
  execucoes,
  progressao,
  painel,
};
