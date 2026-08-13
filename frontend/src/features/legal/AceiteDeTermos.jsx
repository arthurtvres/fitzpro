import { useState } from "react";

import Modal from "../../components/Modal.jsx";
import { DOCUMENTOS } from "./documentos.js";
import ConteudoLegal from "./ConteudoLegal.jsx";

/**
 * A frase de aceite, com os dois documentos abrindo em modal.
 *
 * Modal e não navegação, porque os dois lugares onde isto aparece têm um
 * formulário preenchido por baixo — o cadastro do personal e o convite do
 * aluno, este último já com a senha digitada. Sair da tela para ler os termos
 * descartaria tudo, e é o tipo de coisa que faz a pessoa marcar a caixa sem
 * ler para não perder o que digitou.
 *
 * Componente único porque as duas telas precisam exatamente da mesma coisa, e
 * o que se pode errar aqui — a caixa não travar o envio, o link não abrir — é
 * o que decide se o aceite vale.
 */
export default function AceiteDeTermos({ marcado, aoMarcar, erro }) {
  const [aberto, setAberto] = useState(null);

  return (
    <>
      <label className="opcao-caixa aceite-termos">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => aoMarcar(e.target.checked)}
          aria-invalid={Boolean(erro)}
        />
        <span>
          Li e aceito os{" "}
          <button type="button" className="link-inline" onClick={() => setAberto("termos")}>
            termos de uso
          </button>{" "}
          e a{" "}
          <button
            type="button"
            className="link-inline"
            onClick={() => setAberto("privacidade")}
          >
            política de privacidade
          </button>
          .
        </span>
      </label>
      {erro && <span className="erro-campo">{erro}</span>}

      {aberto && (
        <Modal
          titulo={DOCUMENTOS[aberto].titulo}
          largo
          aoFechar={() => setAberto(null)}
        >
          <ConteudoLegal documento={aberto} aoTrocar={setAberto} />
        </Modal>
      )}
    </>
  );
}
