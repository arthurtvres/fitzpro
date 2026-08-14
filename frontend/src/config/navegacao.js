/**
 * Estrutura do menu lateral. Cada entrada é de um de dois tipos:
 *
 * - **atalho**: tem `rota` e leva direto para a tela, sem expandir;
 * - **grupo**: tem `itens`, expande e cada item é uma rota.
 *
 * A rota é identificada pela chave — é ela que o App usa para escolher a view.
 * `icone` guarda só o nome; quem resolve para o componente Lucide é a Sidebar.
 * Assim esta config continua sendo dado puro, sem importar React.
 *
 * Para adicionar uma seção nova (relatórios, avaliações...), basta incluir
 * uma entrada aqui e tratar a chave nova em App.jsx.
 */
export const NAVEGACAO = [
  {
    chave: "inicio",
    rotulo: "Início",
    icone: "painel",
    rota: "inicio/ver",
  },
  {
    chave: "acompanhamento",
    rotulo: "Acompanhamento",
    icone: "grafico",
    rota: "acompanhamento/ver",
  },
  {
    chave: "alunos",
    rotulo: "Alunos",
    icone: "usuarios",
    itens: [
      { chave: "alunos/ver", rotulo: "Ver alunos" },
      { chave: "alunos/criar", rotulo: "Cadastrar aluno" },
    ],
  },
  {
    chave: "treinos",
    rotulo: "Treinos",
    icone: "halter",
    itens: [
      { chave: "treinos/ver", rotulo: "Ver treinos" },
      { chave: "treinos/arquivados", rotulo: "Treinos arquivados" },
      { chave: "treinos/criar", rotulo: "Prescrever treino" },
    ],
  },
  {
    chave: "dietas",
    rotulo: "Dietas",
    icone: "salada",
    itens: [
      { chave: "dietas/ver", rotulo: "Ver dietas" },
      { chave: "dietas/arquivados", rotulo: "Dietas arquivadas" },
      { chave: "dietas/criar", rotulo: "Prescrever dieta" },
    ],
  },
  {
    chave: "avaliacoes",
    rotulo: "Avaliações",
    icone: "grafico",
    itens: [
      { chave: "avaliacoes/ver", rotulo: "Ver avaliações" },
      { chave: "avaliacoes/criar", rotulo: "Nova avaliação" },
    ],
  },
  {
    chave: "exercicios",
    rotulo: "Catálogos",
    icone: "biceps",
    itens: [
      { chave: "exercicios/ver", rotulo: "Catálogo de exercícios" },
      { chave: "exercicios/alimentos", rotulo: "Catálogo de alimentos" },
    ],
  },
  {
    chave: "perfil",
    rotulo: "Minha conta",
    icone: "conta",
    rota: "perfil/ver",
  },
];

/**
 * Grupo ao qual uma chave de rota pertence — usado para abrir o grupo certo.
 * Atalhos não têm grupo para abrir, então devolvem undefined.
 *
 * Recebe a lista porque existem dois menus: este e o do aluno
 * (`features/aluno/navegacao.js`). A Sidebar serve aos dois.
 */
export function grupoDoItem(chaveItem, navegacao = NAVEGACAO) {
  return navegacao.find((entrada) =>
    entrada.itens?.some((item) => item.chave === chaveItem)
  )?.chave;
}
