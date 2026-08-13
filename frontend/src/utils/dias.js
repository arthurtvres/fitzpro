/**
 * Dia da semana, em uma forma só.
 *
 * Existia um `semAcento` local na Home do personal e uma comparação `===`
 * estrita na Home do aluno. O resultado era um bug de verdade: um treino salvo
 * como "terça" aparecia para o personal e **sumia** para o aluno. Agora o
 * backend grava sempre a forma canônica (sem acento) e este módulo é o único
 * lugar que sabe traduzir entre grafias.
 */

/** Índice 0 = segunda, para casar com o backend e com o calendário da semana. */
export const DIAS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

export const ROTULOS = {
  segunda: "segunda",
  terca: "terça",
  quarta: "quarta",
  quinta: "quinta",
  sexta: "sexta",
  sabado: "sábado",
  domingo: "domingo",
};

export const SIGLAS = {
  segunda: "SEG",
  terca: "TER",
  quarta: "QUA",
  quinta: "QUI",
  sexta: "SEX",
  sabado: "SÁB",
  domingo: "DOM",
};

/** "Terça-feira" -> "terca". Tolerante, porque dado antigo pode estar sujo. */
export function normalizar(valor) {
  if (!valor) return null;
  const texto = String(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace("-feira", "")
    .trim();
  return DIAS.includes(texto) ? texto : null;
}

/** O rótulo com acento, para exibir. Cai no próprio valor se for desconhecido. */
export const rotulo = (valor) => ROTULOS[normalizar(valor)] ?? valor ?? "";

/** getDay(): 0 = domingo. DIAS começa na segunda, daí o deslocamento. */
export const diaDeHoje = () => DIAS[(new Date().getDay() + 6) % 7];

/** Compara duas grafias quaisquer do mesmo dia. */
export const mesmoDia = (a, b) => normalizar(a) === normalizar(b);
