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

  /**
   * Pede o link de redefinição.
   *
   * A resposta é a mesma para e-mail cadastrado e não cadastrado — de
   * propósito, no servidor. A tela **não pode** tentar ser mais útil que isso
   * ("esse e-mail não existe"), senão devolve na interface exatamente o que a
   * rota se cuidou para não entregar: quem tem conta no FitzPRO.
   */
  recuperar: (email) => requisitar("/auth/recuperar", comCorpo("POST", { email })),

  /** Define a senha nova com o token do link. Já devolve sessão, como o login. */
  async redefinir(token, senhaNova) {
    const resposta = await requisitar(
      "/auth/redefinir",
      comCorpo("POST", { token, senha_nova: senhaNova })
    );
    guardarToken(resposta.access_token);
    return resposta.usuario;
  },

  /**
   * Quem é o dono do convite. **Não gasta o link** — ver a rota no backend.
   *
   * Por ser endpoint público, devolve só nome, e-mail e o nome do personal.
   */
  lerConvite: (token) => requisitar(`/auth/convite/${encodeURIComponent(token)}`),

  /** Primeiro acesso do aluno: senha própria + aceite. Já devolve sessão. */
  async aceitarConvite(token, senha, aceitouTermos) {
    const resposta = await requisitar(
      "/auth/convite",
      comCorpo("POST", { token, senha, aceitou_termos: aceitouTermos })
    );
    guardarToken(resposta.access_token);
    return resposta.usuario;
  },

  /**
   * Registra o aceite da versão vigente dos termos.
   *
   * Sem corpo: não há o que escolher. Devolve o usuário já sem a pendência.
   */
  aceitarTermos: () => requisitar("/auth/aceitar-termos", comCorpo("POST", {})),

  /** Restaura a sessão a partir do token guardado; erro = token inválido. */
  eu: () => requisitar("/auth/eu"),

  sair: () => limparToken(),
};
