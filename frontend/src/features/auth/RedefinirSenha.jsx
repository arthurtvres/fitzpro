import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { api } from "../../api/index.js";

// Espelha TAMANHO_MINIMO_SENHA do backend. Validar aqui não substitui a
// validação de lá — serve para a pessoa descobrir antes de enviar.
const TAMANHO_MINIMO = 8;

/**
 * Definir a senha nova a partir do link do e-mail.
 *
 * Sem campo de senha atual: é justamente o que quem chega aqui não tem. O token
 * da URL é a prova, e o servidor o consome no primeiro uso.
 *
 * Confirmação de senha existe porque o campo é mascarado e um erro de digitação
 * aqui custa outro ciclo inteiro de e-mail — diferente do login, onde errar só
 * custa tentar de novo.
 */
export default function RedefinirSenha({ tema, token, aoEntrar, aoVoltar }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const curta = senha.length > 0 && senha.length < TAMANHO_MINIMO;
  const diferentes = confirmacao.length > 0 && senha !== confirmacao;

  async function enviar(evento) {
    evento.preventDefault();
    if (curta || diferentes) return;

    setSalvando(true);
    setErro(null);
    try {
      aoEntrar(await api.auth.redefinir(token, senha));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="cartao-login">
        <div className="marca-login">
          <img src={tema === "dark" ? "/fitzpro.png" : "/fitzprologin.png"} alt="FitzPro" />
        </div>

        <h1>Criar nova senha</h1>

        {!token ? (
          <>
            {/* Link sem token: quase sempre é e-mail que quebrou a URL em duas
                linhas. Dizer isso poupa a pessoa de tentar o mesmo link de novo. */}
            <div className="erro">
              Link incompleto. Abra o endereço inteiro do e-mail, ou peça um novo
              link de redefinição.
            </div>
            <button type="button" className="link alternar-auth" onClick={aoVoltar}>
              <ArrowLeft size={14} /> Voltar para o login
            </button>
          </>
        ) : (
          <>
            <p className="apoio-login">
              Escolha uma senha com pelo menos {TAMANHO_MINIMO} caracteres. Você
              entra direto depois de salvar.
            </p>

            {erro && <div className="erro">{erro}</div>}

            <form className="formulario" onSubmit={enviar}>
              <div className="campo">
                <label htmlFor="nova-senha">Nova senha</label>
                <input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoFocus
                />
                {curta && (
                  <span className="erro-campo">
                    Pelo menos {TAMANHO_MINIMO} caracteres.
                  </span>
                )}
              </div>

              <div className="campo">
                <label htmlFor="confirmar-senha">Repetir a senha</label>
                <input
                  id="confirmar-senha"
                  type="password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  required
                />
                {diferentes && (
                  <span className="erro-campo">As duas senhas não são iguais.</span>
                )}
              </div>

              <button
                type="submit"
                className="primario"
                disabled={salvando || curta || diferentes || !senha}
              >
                {salvando ? "Salvando..." : "Salvar e entrar"}
              </button>
            </form>

            <button type="button" className="link alternar-auth" onClick={aoVoltar}>
              <ArrowLeft size={14} /> Voltar para o login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
