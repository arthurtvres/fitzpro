import { comCorpo, requisitar } from "./client.js";

/**
 * O usuário logado sobre si mesmo. Reaproveita as rotas de /usuarios, mas
 * sempre no próprio id — nenhuma chamada daqui toca em outra conta.
 */
export const perfil = {
  /**
   * O PUT substitui o registro inteiro. Mandar só os campos do formulário
   * apagaria o resto do perfil e — pior — devolveria o `papel` ao default
   * ALUNO, trancando o personal para fora do próprio painel. Por isso a base
   * é o usuário atual e o formulário só sobrescreve o que ele edita.
   */
  atualizar: (usuario, dados) =>
    requisitar(
      `/usuarios/${usuario.id}`,
      comCorpo("PUT", {
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        data_nascimento: usuario.data_nascimento ?? null,
        sexo: usuario.sexo ?? null,
        altura_cm: usuario.altura_cm ?? null,
        objetivo: usuario.objetivo ?? "",
        telefone: usuario.telefone ?? null,
        cpf: usuario.cpf ?? null,
        cep: usuario.cep ?? null,
        logradouro: usuario.logradouro ?? null,
        numero_endereco: usuario.numero_endereco ?? null,
        complemento: usuario.complemento ?? null,
        bairro: usuario.bairro ?? null,
        ...dados,
      })
    ),

  /**
   * O personal do aluno logado — nome, e-mail, telefone e foto.
   *
   * Devolve `null` quando não há o que mostrar (quem chamou é um personal, ou
   * a conta do personal está desativada), então quem usa trata ausência, não erro.
   */
  meuPersonal: () => requisitar("/usuarios/meu-personal"),

  trocarSenha: (usuario, senhaAtual, senhaNova) =>
    requisitar(
      `/usuarios/${usuario.id}/senha`,
      comCorpo("PUT", { senha_atual: senhaAtual, senha_nova: senhaNova })
    ),
};
