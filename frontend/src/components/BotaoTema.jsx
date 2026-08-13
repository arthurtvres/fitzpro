import { Moon, Sun } from "lucide-react";

export default function BotaoTema({ tema, aoAlternar }) {
  const escuro = tema === "dark";

  return (
    <button
      type="button"
      className="botao-tema icone"
      onClick={aoAlternar}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
    >
      {escuro ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
