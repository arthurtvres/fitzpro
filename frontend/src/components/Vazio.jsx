import { Inbox } from "lucide-react";

/** Estado vazio: ícone discreto, frase e uma ação opcional. */
export default function Vazio({ icone: Icone = Inbox, children, acao }) {
  return (
    <div className="vazio">
      <span className="icone-vazio" aria-hidden="true">
        <Icone size={22} />
      </span>
      <div className="vazio-conteudo">{children}</div>
      {acao}
    </div>
  );
}
