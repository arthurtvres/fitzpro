import { Inbox } from "lucide-react";

/** Estado vazio: ícone discreto, frase e uma ação opcional. */
export default function Vazio({ icone: Icone = Inbox, children, acao }) {
  return (
    <div className="vazio">
      <span className="icone-vazio" aria-hidden="true">
        <Icone size={22} />
      </span>
      <p>{children}</p>
      {acao}
    </div>
  );
}
