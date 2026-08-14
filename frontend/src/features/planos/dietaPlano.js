/**
 * Plano novo nasce **sem refeição nenhuma**.
 *
 * Antes vinha um "Cafe da manha" às 07:30 já montado. Quem prescreve para
 * alguém que treina à noite tinha que apagar aquilo antes de começar, e o dado
 * de exemplo corria o risco de ser salvo por engano — plano com refeição que
 * ninguém escreveu é pior que plano vazio.
 */
export const criarPlanoAlimentarVazio = () => ({
  proteinas: "",
  carboidratos: "",
  gorduras: "",
  refeicoes: [],
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
