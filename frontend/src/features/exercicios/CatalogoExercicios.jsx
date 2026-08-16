import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";

import { api } from "../../api/index.js";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import MeusExercicios from "./MeusExercicios.jsx";

const POR_PAGINA = 24;
const FILTROS_VAZIOS = {
  busca: "",
  musculo: "",
  equipamento: "",
  categoria: "",
  nivel: "",
};

/**
 * As duas fontes de exercício, em abas: a biblioteca própria do personal, e o
 * catálogo público do free-exercise-db. Serve dois contextos:
 * - tela "Exercícios > Catálogo": clicar no cartão abre os detalhes;
 * - seletor dentro de um treino (`aoSelecionar`): o cartão vira botão de adicionar.
 *
 * `podeGerenciar` decide se a aba "Meus exercícios" mostra as ações de criar,
 * editar e arquivar — o aluno também navega esta tela (para ler a instrução
 * de algo prescrito por ele), mas só o personal gerencia a biblioteca.
 */
export default function CatalogoExercicios({ aoSelecionar, aoDetalhar, aoErrar, podeGerenciar = false }) {
  const [aba, setAba] = useState("catalogo");

  return (
    <>
      <div className="abas">
        <button className={aba === "catalogo" ? "ativa" : ""} onClick={() => setAba("catalogo")}>
          free-exercise-db
        </button>
        <button className={aba === "meus" ? "ativa" : ""} onClick={() => setAba("meus")}>
          Meus exercícios
        </button>
      </div>

      {aba === "meus" ? (
        <MeusExercicios
          aoSelecionar={aoSelecionar}
          aoDetalhar={aoDetalhar}
          aoErrar={aoErrar}
          podeGerenciar={podeGerenciar}
        />
      ) : (
        <CatalogoPublico aoSelecionar={aoSelecionar} aoDetalhar={aoDetalhar} aoErrar={aoErrar} />
      )}
    </>
  );
}

function CatalogoPublico({ aoSelecionar, aoDetalhar, aoErrar }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [opcoes, setOpcoes] = useState(null);
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.exercicios.filtros().then(setOpcoes).catch((e) => aoErrar(e.message));
  }, [aoErrar]);

  // Debounce: a busca dispara a cada tecla, e são 873 exercícios do outro lado.
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    const timer = setTimeout(() => {
      api.exercicios
        .listar({ ...filtros, fonte: "catalogo", limite: POR_PAGINA, offset: 0 })
        .then((resposta) => {
          if (cancelado) return;
          setItens(resposta.itens);
          setTotal(resposta.total);
        })
        .catch((e) => !cancelado && aoErrar(e.message))
        .finally(() => !cancelado && setCarregando(false));
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [filtros, aoErrar]);

  async function carregarMais() {
    try {
      const resposta = await api.exercicios.listar({
        ...filtros,
        fonte: "catalogo",
        limite: POR_PAGINA,
        offset: itens.length,
      });
      setItens((atual) => [...atual, ...resposta.itens]);
      setTotal(resposta.total);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  const alterar = (campo) => (evento) =>
    setFiltros((atual) => ({ ...atual, [campo]: evento.target.value }));

  const temFiltro = Object.values(filtros).some(Boolean);

  const selects = [
    ["musculo", "Músculo", opcoes?.musculos],
    ["equipamento", "Equipamento", opcoes?.equipamentos],
    ["categoria", "Categoria", opcoes?.categorias],
    ["nivel", "Nível", opcoes?.niveis],
  ];

  return (
    <>
      <div className="filtros-catalogo">
        <div className="campo-busca">
          <span className="lupa" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            type="search"
            placeholder="Buscar exercício (ex.: squat, bench, curl)"
            value={filtros.busca}
            onChange={alterar("busca")}
            aria-label="Buscar exercício"
          />
        </div>

        <div className="linha-selects">
          {selects.map(([campo, rotulo, lista]) => (
            <select
              key={campo}
              value={filtros[campo]}
              onChange={alterar(campo)}
              aria-label={rotulo}
            >
              <option value="">{rotulo}: todos</option>
              {(lista ?? []).map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          ))}

          <button
            type="button"
            onClick={() => setFiltros(FILTROS_VAZIOS)}
            disabled={!temFiltro}
          >
            Limpar
          </button>
        </div>

        <span className="contagem">
          {carregando ? "Buscando..." : `${total} exercício(s)`}
        </span>
      </div>

      {carregando && itens.length === 0 ? (
        <Skeleton forma="cartao" quantidade={8} />
      ) : itens.length === 0 ? (
        <Vazio icone={Search}>Nenhum exercício com esses filtros.</Vazio>
      ) : (
        <ul className="grade-exercicios">
          {itens.map((exercicio) => (
            <li key={exercicio.id} className="cartao-exercicio">
              <button
                type="button"
                className="miniatura"
                onClick={() => aoDetalhar?.(exercicio.id)}
                title="Ver instruções"
              >
                {exercicio.imagens[0] ? (
                  <img src={exercicio.imagens[0]} alt="" loading="lazy" />
                ) : (
                  <span className="sem-imagem">sem foto</span>
                )}
              </button>

              <div className="dados">
                <strong>{exercicio.nome}</strong>
                <span className="meta">
                  {exercicio.musculos_primarios_pt.join(", ") || "—"} ·{" "}
                  {exercicio.equipamento_pt}
                </span>
                <span className="meta fraco">{exercicio.nivel_pt}</span>
              </div>

              {aoSelecionar && (
                <button
                  type="button"
                  className="primario"
                  onClick={() => aoSelecionar(exercicio)}
                >
                  <Plus size={15} /> Adicionar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {itens.length < total && (
        <div className="acoes-form" style={{ justifyContent: "center" }}>
          <button type="button" onClick={carregarMais}>
            Carregar mais ({itens.length} de {total})
          </button>
        </div>
      )}
    </>
  );
}
