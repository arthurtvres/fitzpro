/**
 * Quando o personal ainda pode mexer no cadastro de um aluno.
 *
 * A marca é `primeiro_acesso_em`, e **não** `aceitou_termos`. Os dois eram a
 * mesma coisa enquanto o único caminho para o aceite era o primeiro acesso;
 * desde que o personal pode cadastrar com senha e aceitar em nome do aluno,
 * deixam de ser — e usar o aceite aqui faria o personal perder o cadastro no
 * instante em que criasse alguém que talvez nunca faça login.
 *
 * A janela antes do primeiro acesso fica aberta de propósito: se o e-mail foi
 * digitado errado, o convite não chega e o aluno não entra. Sem essa janela
 * ninguém conseguiria consertar, porque só o aluno editaria e ele não teria
 * como fazer login.
 *
 * Espelha a regra do backend (`atualizar_usuario` e `trocar_senha`). A tela
 * apenas esconde o que a API já recusa — a decisão vive lá.
 */
export const personalPodeEditar = (aluno) => !aluno?.primeiro_acesso_em;

/** Idade a partir da qual a pessoa aceita os termos sozinha. */
export const MAIORIDADE = 18;

/**
 * Idade em anos a partir de "1994-03-12". Devolve null sem data.
 *
 * Sem `new Date(iso)`: ele interpreta como UTC e desloca o dia em fusos
 * negativos, o que muda a idade de quem faz aniversário hoje.
 */
export function idadeDe(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const jaFezAniversario =
    hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia);
  if (!jaFezAniversario) idade -= 1;
  return idade;
}

/** Data ausente não é "menor": ela é opcional, e travaria todo cadastro. */
export const eMenor = (iso) => {
  const idade = idadeDe(iso);
  return idade !== null && idade < MAIORIDADE;
};
