export const criarPlanoAlimentarVazio = () => ({
  proteinas: "",
  carboidratos: "",
  gorduras: "",
  refeicoes: [
    {
      id: `ref-${Date.now()}`,
      horario: "07:30",
      nome: "Cafe da manha",
      calorias: "",
      proteinas: "",
      carboidratos: "",
      gorduras: "",
      observacao: "",
      alimentos: [
        { id: `alim-${Date.now()}`, nome: "", quantidade: "", unidade: "unidade" },
      ],
    },
  ],
});

export function serializarPlanoAlimentar(plano) {
  return JSON.stringify({ tipo: "plano-alimentar", versao: 1, ...plano });
}

export function lerPlanoAlimentar(descricao) {
  if (!descricao) return null;

  try {
    const plano = JSON.parse(descricao);
    if (plano?.tipo !== "plano-alimentar") return null;
    return {
      proteinas: plano.proteinas ?? "",
      carboidratos: plano.carboidratos ?? "",
      gorduras: plano.gorduras ?? "",
      refeicoes: Array.isArray(plano.refeicoes)
        ? plano.refeicoes.map((refeicao) => ({
            observacao: "",
            ...refeicao,
            alimentos: Array.isArray(refeicao.alimentos)
              ? refeicao.alimentos.map((alimento) => ({
                  unidade: "",
                  ...alimento,
                }))
              : [],
          }))
        : [],
    };
  } catch {
    return null;
  }
}

export function resumoPlanoAlimentar(item) {
  const plano = lerPlanoAlimentar(item.descricao);
  if (!plano) return item.descricao;

  const totalRefeicoes = plano.refeicoes.length;
  const macros = [
    plano.proteinas ? `P ${plano.proteinas}g` : null,
    plano.carboidratos ? `C ${plano.carboidratos}g` : null,
    plano.gorduras ? `G ${plano.gorduras}g` : null,
  ].filter(Boolean);

  return [
    `${totalRefeicoes} refeicao${totalRefeicoes === 1 ? "" : "s"}`,
    macros.join(" | "),
  ]
    .filter(Boolean)
    .join(" - ");
}
