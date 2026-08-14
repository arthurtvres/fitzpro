import { useEffect, useState } from "react";
import { Search, Utensils } from "lucide-react";

import { api } from "../../api/index.js";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";

// A tabela tem 597 itens. Trazer tudo de uma vez é uma resposta grande para uma
// tela em que ninguém rola até o fim — quem procura um alimento, digita.
const LIMITE = 60;
const ESPERA = 250;

// Espelham LIMIARES e ORDENACOES do backend. É lá que o filtro roda — antes do
// limite —, senão "mais proteína" ordenaria só os 60 primeiros do alfabeto.
const FONTES = [
  ["", "Todos"],
  ["proteina", "Proteína"],
  ["carboidrato", "Carboidrato"],
  ["gordura", "Gordura"],
  ["fibra", "Fibra"],
];

const ORDENACOES = [
  ["nome", "Nome (A-Z)"],
  ["mais_proteina", "Mais proteína"],
  ["mais_fibra", "Mais fibra"],
  ["menos_carboidrato", "Menos carboidrato"],
  ["menos_calorias", "Menos calorias"],
  ["mais_calorias", "Mais calorias"],
];

const numero = (valor) =>
  valor == null ? "—" : new Intl.NumberFormat("pt-BR").format(valor);

/**
 * Consulta à tabela TACO, sem prescrever nada.
 *
 * Serve para o personal conferir um valor antes de montar a dieta, e para
 * responder "quanto tem de proteína?" sem abrir um plano. A prescrição em si
 * usa o mesmo endpoint pelo autocompletar de `BuscaDeAlimento`.
 *
 * Os valores são **sempre por 100 g** — é como a TACO publica, e escrever isso
 * na tela evita a leitura errada de que seriam por porção.
 */
export default function CatalogoAlimentos({ aoErrar }) {
  const [busca, setBusca] = useState("");
  const [fonte, setFonte] = useState("");
  const [ordenar, setOrdenar] = useState("nome");
  const [alimentos, setAlimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const cronometro = setTimeout(() => {
      setCarregando(true);
      api.alimentos
        .buscar(busca.trim() || undefined, LIMITE, { fonte, ordenar })
        .then((lista) => !cancelado && setAlimentos(lista))
        .catch((e) => !cancelado && aoErrar?.(e.message))
        .finally(() => !cancelado && setCarregando(false));
    }, ESPERA);

    return () => {
      cancelado = true;
      clearTimeout(cronometro);
    };
  }, [busca, fonte, ordenar, aoErrar]);

  return (
    <section className="painel">
      <div className="barra-acoes">
        <h2 style={{ margin: 0 }}>Tabela TACO</h2>
        <span className="filtro">valores por 100 g</span>
      </div>

      <div className="campo-busca">
        <span className="lupa" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar alimento..."
          autoComplete="off"
        />
      </div>

      <div className="filtros-alimentos">
        <div className="chips-fonte">
          {FONTES.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className={`chip${fonte === valor ? " ativo" : ""}`}
              onClick={() => setFonte(valor)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <label className="filtro">
          <span>Ordenar por</span>
          <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)}>
            {ORDENACOES.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* O corte de "fonte de" é editorial, para a lista ser útil ao montar
          refeição — não é a definição da ANVISA para alegação em rótulo. */}
      {fonte && (
        <p className="apoio-secao">
          Alimentos com destaque em {FONTES.find(([v]) => v === fonte)[1].toLowerCase()},
          por 100 g.
        </p>
      )}

      {carregando ? (
        <Skeleton quantidade={4} />
      ) : alimentos.length === 0 ? (
        <Vazio icone={Utensils}>Nenhum alimento encontrado para essa busca.</Vazio>
      ) : (
        <div className="rolagem-tabela">
          <table className="tabela">
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Energia</th>
                <th>Proteína</th>
                <th>Carboidrato</th>
                <th>Gordura</th>
                <th>Fibra</th>
              </tr>
            </thead>
            <tbody>
              {alimentos.map((alimento) => (
                <tr key={alimento.id}>
                  <td>
                    <strong>{alimento.nome}</strong>
                    {/* A TACO distingue "não analisado" de zero, e a tela
                        precisa distinguir também: um alimento sem análise não
                        é um alimento sem calorias. */}
                    {alimento.kcal == null && (
                      <span className="sub">sem análise na tabela</span>
                    )}
                  </td>
                  <td>{numero(alimento.kcal)} kcal</td>
                  <td>{numero(alimento.proteina_g)} g</td>
                  <td>{numero(alimento.carboidrato_g)} g</td>
                  <td>{numero(alimento.gordura_g)} g</td>
                  <td>{numero(alimento.fibra_g)} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && alimentos.length >= LIMITE && (
        <p className="apoio-secao">
          Mostrando os {LIMITE} primeiros. Refine a busca para ver outros.
        </p>
      )}
    </section>
  );
}
