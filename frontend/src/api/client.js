/**
 * Onde a API mora.
 *
 * Em produção o padrão é **string vazia** — ou seja, a mesma origem de onde a
 * página foi servida. É o arranjo que o backend passou a suportar: ele serve o
 * build do front e responde à API no mesmo endereço, o que resolve o fallback
 * de SPA e faz o CORS deixar de existir.
 *
 * Em desenvolvimento o Vite serve em 5173 e o uvicorn em 8000, então o padrão
 * aponta para o segundo. `VITE_API_URL` continua vencendo os dois, para quem
 * hospedar API e front separados.
 *
 * A checagem é `=== undefined`, e não `||`: com `||`, definir
 * `VITE_API_URL=` (vazio, pedindo mesma origem) cairia no default e voltaria a
 * chamar o 127.0.0.1 — que é justamente o erro difícil de enxergar em produção.
 */
const BASE_URL =
  import.meta.env.VITE_API_URL === undefined
    ? import.meta.env.DEV
      ? "http://127.0.0.1:8000"
      : ""
    : import.meta.env.VITE_API_URL;
const CHAVE_TOKEN = "fitzpro:token";

export const guardarToken = (token) => localStorage.setItem(CHAVE_TOKEN, token);
export const lerToken = () => localStorage.getItem(CHAVE_TOKEN);
export const limparToken = () => localStorage.removeItem(CHAVE_TOKEN);

/**
 * Avisa o app quando a API rejeita o token — sessão expirada ou conta desativada.
 * O App assina isso para voltar à tela de login sem cada componente ter que saber.
 */
let aoExpirar = () => {};
export const quandoSessaoExpirar = (callback) => {
  aoExpirar = callback;
};

/**
 * Wrapper único em cima do fetch. Concentra aqui o token e o tratamento do
 * formato de erro do FastAPI, para nenhum componente precisar conhecer nenhum dos dois.
 */
export async function requisitar(caminho, opcoes = {}) {
  const token = lerToken();

  let resposta;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
      },
      ...opcoes,
    });
  } catch {
    throw new Error("Não foi possível falar com a API. O backend está rodando?");
  }

  // 401 é sempre sessão inválida: derruba para o login em vez de mostrar erro solto.
  if (resposta.status === 401 && !caminho.startsWith("/auth/login")) {
    limparToken();
    aoExpirar();
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  if (!resposta.ok) {
    throw new Error(await extrairMensagemDeErro(resposta));
  }

  if (resposta.status === 204) return null;
  return resposta.json();
}

async function extrairMensagemDeErro(resposta) {
  let corpo;
  try {
    corpo = await resposta.json();
  } catch {
    return `Erro ${resposta.status}`;
  }

  const detalhe = corpo?.detail;
  if (typeof detalhe === "string") return detalhe;

  // 422: `detail` é uma lista de erros por campo.
  if (Array.isArray(detalhe)) {
    return detalhe
      .map((erro) => {
        const campo = erro.loc?.filter((p) => p !== "body").join(".");
        return campo ? `${campo}: ${erro.msg}` : erro.msg;
      })
      .join(" | ");
  }

  return `Erro ${resposta.status}`;
}

export const comCorpo = (metodo, dados) => ({
  method: metodo,
  body: JSON.stringify(dados),
});

/** Monta ?a=1&b=2 ignorando o que estiver vazio, null ou undefined. */
export function montarQuery(parametros) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== "" && valor !== null && valor !== undefined) {
      busca.set(chave, valor);
    }
  }
  const query = busca.toString();
  return query ? `?${query}` : "";
}
