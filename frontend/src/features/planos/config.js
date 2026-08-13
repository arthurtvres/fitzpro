import { api } from "../../api/index.js";

export const DIAS = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
];

/**
 * Treino e dieta têm o mesmo CRUD e quase os mesmos campos — só muda o terceiro
 * (dia_semana vs calorias). Em vez de duplicar componentes, a diferença vive
 * nessas configs e formulário/lista são compartilhados.
 */
export const CONFIG_TREINO = {
  chave: "treinos",
  singular: "treino",
  artigoIndefinido: "um",
  textoVazio: "Nenhum treino prescrito",
  recurso: api.treinos,
  // A série vem dos exercícios do catálogo; a descrição virou observação geral.
  descricaoObrigatoria: false,
  rotuloDescricao: "Observações (opcional)",
  campoExtra: {
    nome: "dia_semana",
    rotulo: "Dia da semana",
    tipo: "select",
    opcoes: DIAS,
    padrao: "segunda",
    formatar: (valor) => valor,
    converter: (valor) => valor,
  },
};

export const CONFIG_DIETA = {
  chave: "dietas",
  singular: "dieta",
  artigoIndefinido: "uma",
  textoVazio: "Nenhuma dieta prescrita",
  recurso: api.dietas,
  descricaoObrigatoria: true,
  rotuloDescricao: "Descrição",
  campoExtra: {
    nome: "calorias",
    rotulo: "Calorias",
    tipo: "number",
    padrao: "",
    formatar: (valor) => `${valor} kcal`,
    converter: (valor) => Number(valor),
  },
};

export const CONFIG_POR_CHAVE = {
  treinos: CONFIG_TREINO,
  dietas: CONFIG_DIETA,
};
