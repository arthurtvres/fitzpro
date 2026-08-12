import { Menu } from "lucide-react";

/** Barra do topo do conteúdo: título da página, subtítulo e ações à direita. */
export default function Header({ titulo, subtitulo, aoAbrirMenu, children }) {
  return (
    <header className="header">
      <button
        type="button"
        className="botao-menu icone"
        onClick={aoAbrirMenu}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      <div className="titulo-area">
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>

      {children && <div className="acoes-header">{children}</div>}
    </header>
  );
}
