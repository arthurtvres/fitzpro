import { ArrowLeft } from "lucide-react";

import { DOCUMENTOS } from "./documentos.js";
import ConteudoLegal from "./ConteudoLegal.jsx";

/**
 * Termos e privacidade em `/termos` e `/privacidade`.
 *
 * O aceite abre os documentos em modal (ver `AceiteDeTermos`), mas as rotas
 * continuam existindo: uma política de privacidade precisa de endereço próprio
 * para ser citada em e-mail, em loja de aplicativos ou num pedido de titular.
 * O texto é o mesmo componente, então os dois não têm como divergir.
 */
export default function PaginaLegal({ documento, aoVoltar }) {
  const doc = DOCUMENTOS[documento];
  if (!doc) return null;

  return (
    <div className="pagina-legal">
      <article>
        <button type="button" className="link voltar-legal" onClick={aoVoltar}>
          <ArrowLeft size={15} /> Voltar
        </button>

        <header>
          <h1>{doc.titulo}</h1>
        </header>

        <div className="corpo-legal">
          <ConteudoLegal documento={documento} />
        </div>
      </article>
    </div>
  );
}
