import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { api } from "../../api/index.js";

// Espelha TAMANHO_MINIMO_SENHA do backend.
const TAMANHO_MINIMO = 8;

/**
 * O primeiro acesso do aluno: criar a própria senha e aceitar os termos.
 *
 * A tela abre já sabendo quem é a pessoa — `GET /auth/convite/{token}` devolve
 * nome, e-mail e o nome do personal, **sem gastar o link**. Isso importa mais do
 * que parece: se a leitura consumisse o token, um recarregar acidental, ou o
 * pré-carregamento que alguns clientes de e-mail fazem, deixaria o aluno de fora
 * com um convite que ele nunca chegou a usar.
 *
 * O aceite dos termos acontece aqui, e não no cadastro que o personal fez —
 * ninguém pode concordar com termos de uso no lugar de outra pessoa.
 */
export default function AceitarConvite({ tema, token, aoEntrar, aoVoltar }) {
  const [convite, setConvite] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(token));
  const [invalido, setInvalido] = useState(!token);

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [aceitou, setAceitou] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelado = false;

    api.auth
      .lerConvite(token)
      .then((dados) => !cancelado && setConvite(dados))
      .catch(() => !cancelado && setInvalido(true))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [token]);

  const curta = senha.length > 0 && senha.length < TAMANHO_MINIMO;
  const diferentes = confirmacao.length > 0 && senha !== confirmacao;

  async function enviar(evento) {
    evento.preventDefault();
    if (curta || diferentes || !aceitou) return;

    setSalvando(true);
    setErro(null);
    try {
      aoEntrar(await api.auth.aceitarConvite(token, senha, aceitou));
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

        {carregando ? (
          <p className="apoio-login">Carregando seu convite...</p>
        ) : invalido ? (
          <>
            <h1>Convite indisponível</h1>
            <div className="erro">
              Este convite expirou ou já foi usado. Peça um novo convite ao seu personal.
            </div>
            <button type="button" className="link alternar-auth" onClick={aoVoltar}>
              <ArrowLeft size={14} /> Ir para o login
            </button>
          </>
        ) : (
          <>
            <h1>Olá, {convite.nome.split(" ")[0]}</h1>
            <p className="apoio-login">
              {convite.personal_nome
                ? `${convite.personal_nome} criou seu acesso ao FitzPRO.`
                : "Seu acesso ao FitzPRO foi criado."}{" "}
              Escolha uma senha para entrar.
            </p>

            {erro && <div className="erro">{erro}</div>}

            <form className="formulario" onSubmit={enviar}>
              {/* Só de leitura: o e-mail é a identidade do convite, e deixar
                  editável sugeriria que dá para usá-lo em outra conta. */}
              <div className="campo">
                <label htmlFor="convite-email">Seu e-mail</label>
                <input id="convite-email" type="email" value={convite.email} readOnly />
              </div>

              <div className="campo">
                <label htmlFor="convite-senha">Criar senha</label>
                <input
                  id="convite-senha"
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
                <label htmlFor="convite-confirmar">Repetir a senha</label>
                <input
                  id="convite-confirmar"
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

              <label className="aceite-termos">
                <input
                  type="checkbox"
                  checked={aceitou}
                  onChange={(e) => setAceitou(e.target.checked)}
                />
                <span>
                  Li e aceito os <a href="/termos">termos de uso</a> e a{" "}
                  <a href="/privacidade">política de privacidade</a>.
                </span>
              </label>

              <button
                type="submit"
                className="primario"
                disabled={salvando || curta || diferentes || !aceitou || !senha}
              >
                {salvando ? "Criando acesso..." : "Criar acesso e entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
