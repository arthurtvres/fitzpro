import { useState } from "react";
import { FileText, LogOut } from "lucide-react";

import { api } from "../../api/index.js";
import AceiteDeTermos from "./AceiteDeTermos.jsx";
import { VERSAO, VIGENTE_DESDE } from "./documentos.js";

/**
 * Reaceite dos termos quando sai uma versão material.
 *
 * Tranca a interface — personal e aluno — até a pessoa concordar. Não há
 * "depois": se o aceite é condição para o serviço, oferecer adiar seria fingir
 * que não é. A saída honesta é a que existe de verdade, "sair da conta".
 *
 * Só aparece quando `VERSAO_MINIMA_ACEITA` sobe no backend, e ela sobe só em
 * mudança material — dado novo, finalidade nova, compartilhamento, direitos.
 * Corrigir ortografia sobe apenas `VERSAO_DOS_TERMOS`, e ninguém é
 * interrompido: aceite frequente é aceite que ninguém lê.
 *
 * A trava é de interface, não de API. Bloquear cada rota no servidor exigiria
 * uma dependência nova em todas elas, com o risco de travar a própria chamada
 * de aceitar — e a API não é pública.
 */
export default function ReaceitarTermos({ tema, usuario, aoAceitar, aoSair }) {
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function enviar(evento) {
    evento.preventDefault();
    if (!marcado) return;

    setSalvando(true);
    setErro(null);
    try {
      aoAceitar(await api.auth.aceitarTermos());
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="cartao-login">
        <div className="marca-login">
          <img src={tema === "dark" ? "/fitzprologo.png" : "/fitzprologin.png"} alt="FitzPro" />
        </div>

        <div className="icone-aviso" aria-hidden="true">
          <FileText size={28} />
        </div>

        <h1>Atualizamos nossos termos</h1>
        <p className="apoio-login">
          Olá, {usuario.nome.split(" ")[0]}. Nossos termos de uso e política de
          privacidade mudaram — a versão {VERSAO} está em vigor desde{" "}
          {VIGENTE_DESDE}. Para continuar usando o FitzPRO, é preciso concordar
          com o texto novo.
        </p>

        {erro && <div className="erro">{erro}</div>}

        <form className="formulario" onSubmit={enviar}>
          <AceiteDeTermos marcado={marcado} aoMarcar={setMarcado} />

          <button type="submit" className="primario" disabled={salvando || !marcado}>
            {salvando ? "Salvando..." : "Aceitar e continuar"}
          </button>
        </form>

        <button type="button" className="link alternar-auth" onClick={aoSair}>
          <LogOut size={14} /> Sair da conta
        </button>
      </div>
    </div>
  );
}
