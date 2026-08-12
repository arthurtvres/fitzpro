/**
 * Menu do aluno.
 *
 * Mesma forma da config do personal (`config/navegacao.js`), para a `Sidebar`
 * servir aos dois sem saber quem está logado. Aqui são todos atalhos: o aluno
 * não cria nem edita nada, então nenhum grupo tem "ver" e "criar" para separar.
 */
export const NAVEGACAO_ALUNO = [
  { chave: "inicio", rotulo: "Hoje", icone: "painel", rota: "inicio/ver" },
  { chave: "treinos", rotulo: "Meus treinos", icone: "halter", rota: "treinos/ver" },
  { chave: "dietas", rotulo: "Minha dieta", icone: "salada", rota: "dietas/ver" },
  { chave: "evolucao", rotulo: "Minha evolução", icone: "grafico", rota: "evolucao/ver" },
  { chave: "exercicios", rotulo: "Exercícios", icone: "biceps", rota: "exercicios/ver" },
  { chave: "perfil", rotulo: "Minha conta", icone: "conta", rota: "perfil/ver" },
];
