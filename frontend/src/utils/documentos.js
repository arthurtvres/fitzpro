/**
 * CPF e CEP: formata para ler, guarda só dígitos.
 *
 * Mesmo arranjo de `telefone.js` e pelo mesmo motivo — o backend normaliza de
 * qualquer jeito (`normalizar_cpf`, `normalizar_cep`), e a máscara existe para
 * quem está digitando enxergar o número. A validação daqui só antecipa o erro:
 * quem decide é o servidor.
 */

export const apenasDigitos = (valor) => (valor ?? "").replace(/\D/g, "");

/** "52998224725" -> "529.982.247-25" */
export function formatarCpf(valor) {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "01310100" -> "01310-100" */
export function formatarCep(valor) {
  const d = apenasDigitos(valor).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Dígitos verificadores do CPF. Espelha `normalizar_cpf` do backend.
 *
 * Repetidos numéricos (111.111.111-11) passam na conta mas não são CPF de
 * ninguém — são o que se digita para sair do campo.
 */
export function cpfValido(valor) {
  const d = apenasDigitos(valor);
  if (d.length !== 11 || d === d[0].repeat(11)) return false;

  for (const posicao of [9, 10]) {
    const pesoInicial = posicao + 1;
    let soma = 0;
    for (let i = 0; i < posicao; i += 1) soma += Number(d[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(d[posicao])) return false;
  }
  return true;
}

export const cepValido = (valor) => apenasDigitos(valor).length === 8;
