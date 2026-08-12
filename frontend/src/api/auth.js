import { comCorpo, guardarToken, limparToken, requisitar } from "./client.js";

export const auth = {
  async entrar(email, senha) {
    const resposta = await requisitar(
      "/auth/login",
      comCorpo("POST", { email, senha })
    );
    guardarToken(resposta.access_token);
    return resposta.usuario;
  },

  /** Cria uma conta de personal. Já devolve sessão pronta, como o login. */
  async registrar(dados) {
    const resposta = await requisitar("/auth/registrar", comCorpo("POST", dados));
    guardarToken(resposta.access_token);
    return resposta.usuario;
  },

  /** Restaura a sessão a partir do token guardado; erro = token inválido. */
  eu: () => requisitar("/auth/eu"),

  sair: () => limparToken(),
};
