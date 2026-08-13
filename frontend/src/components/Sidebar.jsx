import { useEffect, useState } from "react";
import {
  Activity,
  ChevronRight,
  Dumbbell,
  LayoutGrid,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Salad,
  UserCog,
  Users,
} from "lucide-react";

import { NAVEGACAO, grupoDoItem } from "../config/navegacao.js";

/** Liga o nome guardado na config ao componente Lucide. */
const ICONES = {
  painel: LayoutGrid,
  usuarios: Users,
  halter: Dumbbell,
  salada: Salad,
  grafico: LineChart,
  biceps: Activity,
  conta: UserCog,
};

export default function Sidebar({
  rotaAtiva,
  aoNavegar,
  resumo,
  aberta,
  aoFechar,
  recolhida = false,
  aoAlternarRecolhida,
  navegacao = NAVEGACAO,
  // A marca leva para o início. É prop, e não uma string fixa aqui dentro,
  // porque a Sidebar serve a dois menus e não deve conhecer a rota de nenhum.
  rotaInicial = "inicio/ver",
}) {
  const grupoAtivo = grupoDoItem(rotaAtiva, navegacao);
  const [abertos, setAbertos] = useState(() => (grupoAtivo ? [grupoAtivo] : []));

  // Mantém aberto o grupo da rota atual mesmo quando quem navega é o conteúdo
  // (salvar um treino, por exemplo, joga a rota para treinos/ver).
  useEffect(() => {
    if (grupoAtivo) {
      setAbertos((atual) =>
        atual.includes(grupoAtivo) ? atual : [...atual, grupoAtivo]
      );
    }
  }, [grupoAtivo]);

  // No modo drawer, Esc fecha — mesmo contrato do Modal.
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e) => e.key === "Escape" && aoFechar?.();
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberta, aoFechar]);

  /**
   * Clicar no nome do grupo abre e já leva para a primeira tela dele — clicar em
   * "Treinos" e nada acontecer na área de conteúdo é confuso. Só colapsa quando
   * o grupo já está aberto e é o da tela atual, aí o clique é claramente "fechar".
   */
  function clicarNoGrupo(grupo) {
    const aberto = abertos.includes(grupo.chave);

    if (aberto && grupo.chave === grupoAtivo) {
      setAbertos((atual) => atual.filter((c) => c !== grupo.chave));
      return;
    }

    setAbertos((atual) =>
      atual.includes(grupo.chave) ? atual : [...atual, grupo.chave]
    );
    aoNavegar(grupo.itens[0].chave);
  }

  return (
    <aside className={`sidebar${aberta ? " aberta" : ""}${recolhida ? " recolhida" : ""}`}>
      <div className="sidebar-marca">
        <a
          href={`#${rotaInicial}`}
          className="botao-marca"
          onClick={(e) => {
            e.preventDefault();
            aoNavegar(rotaInicial);
          }}
          aria-label="FitzPro — ir para o início"
        >
          <img className="sidebar-logo sidebar-logo-cheia" src="/fitzprologo.png" alt="FitzPro" />
          {/* Recolhida usa a marca reduzida, e não a logo cheia: na faixa
              estreita a versão com texto encolheria a ponto de não se ler. */}
          <img
            className="sidebar-logo sidebar-logo-compacta"
            src="/fitzprotop2.png"
            alt="FitzPro"
          />
        </a>
        <button
          type="button"
          className="sidebar-recolher icone"
          onClick={aoAlternarRecolhida}
          aria-label={recolhida ? "Expandir sidebar" : "Recolher sidebar"}
          title={recolhida ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {recolhida ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navegacao.map((grupo) => {
          const Icone = ICONES[grupo.icone];

          // Atalho: um botão só, sem expandir.
          if (grupo.rota) {
            return (
              <button
                key={grupo.chave}
                type="button"
                className={`grupo-titulo atalho${
                  rotaAtiva === grupo.rota ? " ativo" : ""
                }`}
                onClick={() => aoNavegar(grupo.rota)}
                aria-label={recolhida ? grupo.rotulo : undefined}
                title={recolhida ? grupo.rotulo : undefined}
              >
                <span className="icone" aria-hidden="true">
                  {Icone && <Icone size={21} />}
                </span>
                <span className="rotulo">{grupo.rotulo}</span>
              </button>
            );
          }

          const aberto = abertos.includes(grupo.chave);
          const temItemAtivo = grupo.itens.some((i) => i.chave === rotaAtiva);

          return (
            <div key={grupo.chave} className="grupo">
              <button
                type="button"
                className={`grupo-titulo${temItemAtivo ? " tem-ativo" : ""}`}
                onClick={() => clicarNoGrupo(grupo)}
                aria-expanded={aberto}
                aria-label={recolhida ? grupo.rotulo : undefined}
                title={recolhida ? grupo.rotulo : undefined}
              >
                <span className="icone" aria-hidden="true">
                  {Icone && <Icone size={21} />}
                </span>
                <span className="rotulo">{grupo.rotulo}</span>
                <span className={`seta${aberto ? " aberta" : ""}`} aria-hidden="true">
                  <ChevronRight size={19} />
                </span>
              </button>

              {aberto && (
                <ul className="grupo-itens">
                  {grupo.itens.map((item) => (
                    <li key={item.chave}>
                      <button
                        type="button"
                        className={`item${rotaAtiva === item.chave ? " ativo" : ""}`}
                        onClick={() => aoNavegar(item.chave)}
                      >
                        {item.rotulo}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-rodape">{resumo}</div>
    </aside>
  );
}
