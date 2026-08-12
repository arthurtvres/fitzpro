/**
 * Telefone brasileiro: formata para ler, guarda só dígitos.
 *
 * O backend normaliza para dígitos de qualquer jeito (`normalizar_telefone`);
 * aqui a máscara existe só para quem está digitando enxergar o número.
 */

export const apenasDigitos = (valor) => (valor ?? "").replace(/\D/g, "");

/** "11961234567" -> "(11) 96123-4567"; "1134567890" -> "(11) 3456-7890" */
export function formatarTelefone(valor) {
  const digitos = apenasDigitos(valor).slice(0, 11);

  if (digitos.length <= 2) return digitos;
  const ddd = `(${digitos.slice(0, 2)}) `;

  // 11 dígitos é celular (9 no começo), 10 é fixo — a divisão muda de lugar.
  const corte = digitos.length > 10 ? 7 : 6;
  if (digitos.length <= corte) return ddd + digitos.slice(2);

  return `${ddd}${digitos.slice(2, corte)}-${digitos.slice(corte)}`;
}

/** Válido = 10 dígitos (fixo) ou 11 (celular), sempre com DDD. */
export const telefoneValido = (valor) => [10, 11].includes(apenasDigitos(valor).length);

/** Faixas do cadastro — os valores espelham o enum FaixaDeAlunos do backend. */
export const FAIXAS_DE_ALUNOS = [
  ["SEM_ALUNOS", "Ainda não tenho alunos"],
  ["ATE_5", "Até 5 alunos"],
  ["DE_6_A_15", "De 6 a 15 alunos"],
  ["DE_16_A_30", "De 16 a 30 alunos"],
  ["DE_31_A_50", "De 31 a 50 alunos"],
  ["MAIS_DE_50", "Mais de 50 alunos"],
];

