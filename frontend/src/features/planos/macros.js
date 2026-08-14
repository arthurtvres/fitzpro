/**
 * Macros de uma porção, a partir dos valores por 100 g da TACO.
 *
 * Uma função só, usada pela linha do alimento e pelo total da refeição — duas
 * regras de três em lugares diferentes acabariam divergindo no arredondamento,
 * e o total deixaria de bater com a soma das linhas na tela.
 */

const CAMPOS = ["kcal", "proteina_g", "carboidrato_g", "gordura_g", "fibra_g"];

/** "1,5" e "1.5" são a mesma coisa; texto sem número vira null. */
export function decimalBR(valor) {
  if (valor == null || String(valor).trim() === "") return null;
  const numero = Number(String(valor).replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Só calcula em gramas ou mililitros.
 *
 * "2 unidades" ou "1 fatia" não têm conversão possível sem saber o peso da
 * unidade — a TACO não traz isso. Devolver null aqui é o que faz a tela dizer
 * "informe em g para calcular" em vez de exibir um número inventado.
 */
export function macrosDaPorcao(porCem, quantidade, unidade) {
  if (!porCem) return null;
  if (unidade !== "g" && unidade !== "ml") return null;

  const gramas = decimalBR(quantidade);
  if (gramas == null || gramas <= 0) return null;

  const fator = gramas / 100;
  const resultado = {};
  for (const campo of CAMPOS) {
    const base = porCem[campo];
    resultado[campo] = base == null ? null : Math.round(base * fator * 10) / 10;
  }
  return resultado;
}

/**
 * Soma os macros das linhas que têm cálculo.
 *
 * `parciais` diz que alguma linha ficou de fora — porque foi digitada à mão,
 * porque a unidade não converte, ou porque a TACO não analisou aquele valor.
 * Sem esse aviso, um total menor que a realidade passaria por total exato.
 */
export function somarMacros(linhas) {
  const total = { kcal: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0, fibra_g: 0 };
  let contadas = 0;

  for (const macros of linhas) {
    if (!macros) continue;
    contadas += 1;
    for (const campo of CAMPOS) {
      if (macros[campo] != null) total[campo] += macros[campo];
    }
  }

  for (const campo of CAMPOS) total[campo] = Math.round(total[campo] * 10) / 10;
  return { ...total, contadas, parciais: contadas < linhas.length };
}
