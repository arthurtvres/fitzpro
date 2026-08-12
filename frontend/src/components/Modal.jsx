import { useEffect } from "react";
import { X } from "lucide-react";

/** Sobreposicao simples: fecha no Esc e no clique fora. */
export default function Modal({ titulo, largo, aoFechar, children }) {
  useEffect(() => {
    const aoTeclar = (e) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return (
    <div className="fundo-modal" onClick={aoFechar}>
      <div
        className={`modal${largo ? " largo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-topo">
          <button type="button" className="modal-fechar" onClick={aoFechar} aria-label="Fechar">
            <X size={18} />
          </button>
          <h2>{titulo}</h2>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}
