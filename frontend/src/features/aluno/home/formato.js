/**
 * Como os números da Home aparecem.
 *
 * Centralizado porque a mesma grandeza aparece em vários cards, e "8.420 kg"
 * num e "8420kg" noutro é o tipo de inconsistência que ninguém nota escrevendo
 * e todo mundo nota lendo.
 */

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** 8420 -> "8.420 kg". O `≈` marca volume estimado do prescrito. */
export function kg(valor, { estimado = false } = {}) {
  if (valor == null) return "—";
  return `${estimado ? "≈ " : ""}${NUMERO.format(valor)} kg`;
}

export const numero = (valor) => (valor == null ? "—" : NUMERO.format(valor));
export const decimal = (valor) => (valor == null ? "—" : DECIMAL.format(valor));

/** 2760 -> "46 min". Nulo é duração desconhecida, não zero. */
export function minutos(segundos) {
  if (segundos == null) return "—";
  const total = Math.round(segundos / 60);
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  return `${horas}h${String(total % 60).padStart(2, "0")}`;
}

/** "2026-08-12" -> "12/08" */
export const dataCurta = (iso) =>
  iso ? iso.split("-").reverse().slice(0, 2).join("/") : "—";

/** +7.5 -> "+7,5 kg"; a unidade é opcional. */
export function delta(valor, unidade = "") {
  if (valor == null) return null;
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${DECIMAL.format(valor)}${unidade}`;
}

/** Plural sem malabarismo: `contar(1, "exercício")` -> "1 exercício". */
export const contar = (n, singular, plural = `${singular}s`) =>
  `${numero(n)} ${n === 1 ? singular : plural}`;
