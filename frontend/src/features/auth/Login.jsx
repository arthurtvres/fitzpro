import { useState } from "react";

import { api } from "../../api/index.js";

export default function Login({ aoEntrar, aoCriarConta }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      aoEntrar(await api.auth.entrar(email.trim().toLowerCase(), senha));
    } catch (e) {
      setErro(e.message);
      setEntrando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="cartao-login">
        <div className="marca-login">
          <img src="/fitzprologin.png" alt="FitzPro" />
        </div>

        <h1>Entrar</h1>

        {erro && <div className="erro">{erro}</div>}

        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="campo">
            <label htmlFor="login-senha">Senha</label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="primario" disabled={entrando}>
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <button type="button" className="link alternar-auth" onClick={aoCriarConta}>
          Ainda não tem conta? <strong>Criar conta</strong>
        </button>
      </div>
    </div>
  );
}
