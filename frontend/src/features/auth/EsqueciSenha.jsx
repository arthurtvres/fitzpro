import { useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";

import { api } from "../../api/index.js";

/**
 * Pedir o link de redefinição.
 *
 * A confirmação é deliberadamente vaga — "se houver uma conta com esse e-mail".
 * A tentação aqui é ser prestativo e dizer "não encontramos esse e-mail", e
 * isso devolveria na interface exatamente o que a rota se cuida para não
 * entregar: uma forma de descobrir quem tem conta no FitzPRO. O servidor
 * responde igual nos dois casos, e a tela mantém o combinado.
 */
export default function EsqueciSenha({ tema, aoVoltar }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.auth.recuperar(email.trim().toLowerCase());
      setEnviado(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="cartao-login">
        <div className="marca-login">
          <img src={tema === "dark" ? "/fitzpro.png" : "/fitzprologin.png"} alt="FitzPro" />
        </div>

        {enviado ? (
          <>
            <div className="aviso-enviado">
              <MailCheck size={32} aria-hidden="true" />
              <h1>Verifique seu e-mail</h1>
              <p>
                Se houver uma conta com esse e-mail, enviaremos um link para redefinir sua senha. Válido por 1 hora.
              </p>
              <p className="sub">
                Não recebeu? Confira o spam ou tente novamente.
              </p>
            </div>

            <button type="button" className="link alternar-auth" onClick={aoVoltar}>
              <ArrowLeft size={14} /> Voltar para o login
            </button>
          </>
        ) : (
          <>
            <h1>Esqueci minha senha</h1>
            <p className="apoio-login">
              Informe o e-mail da sua conta e enviaremos um link para você criar
              uma senha nova.
            </p>

            {erro && <div className="erro">{erro}</div>}

            <form className="formulario" onSubmit={enviar}>
              <div className="campo">
                <label htmlFor="recuperar-email">Email</label>
                <input
                  id="recuperar-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="primario" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar link"}
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
