import { useEffect, useRef, useState } from "react";

import { api } from "../../api/index.js";

// Tempo parado antes de consultar. Curto demais dispara uma busca por tecla;
// longo demais faz a lista parecer travada enquanto se digita.
const ESPERA = 250;

// Abaixo disso a lista traria quase a tabela inteira, sem ajudar a escolher.
const MINIMO_PARA_BUSCAR = 2;

/**
 * Campo de alimento com autocompletar da TACO.
 *
 * **Continua aceitando texto livre.** A TACO tem 597 alimentos e não cobre
 * marca, preparo caseiro nem suplemento; travar o campo na tabela obrigaria o
 * personal a escolher "o mais parecido", o que é pior do que deixá-lo escrever.
 * Escolher da lista é o que traz os macros junto — digitar à mão é permitido e
 * simplesmente não calcula nada.
 */
export default function BuscaDeAlimento({ valor, aoDigitar, aoEscolher, vinculado }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const cronometro = useRef(null);
  const container = useRef(null);

  // Fecha ao clicar fora — a lista flutua sobre o formulário.
  useEffect(() => {
    const aoClicar = (evento) => {
      if (container.current && !container.current.contains(evento.target)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, []);

  useEffect(() => () => clearTimeout(cronometro.current), []);

  function digitar(texto) {
    // O vínculo com a tabela se desfaz assim que o nome é editado à mão: os
    // macros guardados eram daquele alimento, e manter o vínculo faria a linha
    // dizer "Arroz integral" com os números de outra coisa.
    aoDigitar(texto);

    clearTimeout(cronometro.current);
    if (texto.trim().length < MINIMO_PARA_BUSCAR) {
      setSugestoes([]);
      setAberto(false);
      return;
    }

    cronometro.current = setTimeout(async () => {
      try {
        const achados = await api.alimentos.buscar(texto.trim());
        setSugestoes(achados);
        setAberto(achados.length > 0);
      } catch {
        // Busca é acessória: falhando, o campo continua sendo texto livre.
        setSugestoes([]);
        setAberto(false);
      }
    }, ESPERA);
  }

  return (
    <div className="busca-alimento" ref={container}>
      <input
        value={valor}
        onChange={(e) => digitar(e.target.value)}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        placeholder="Arroz, frango, ovo..."
        autoComplete="off"
      />
      {vinculado && (
        <span className="selo-tabela" title="Valores da tabela TACO">
          TACO
        </span>
      )}

      {aberto && (
        <ul className="sugestoes-alimento">
          {sugestoes.map((alimento) => (
            <li key={alimento.id}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(alimento);
                  setAberto(false);
                }}
              >
                <span className="nome">{alimento.nome}</span>
                <span className="macros">
                  {alimento.kcal == null
                    ? "sem dados"
                    : `${alimento.kcal} kcal · P ${alimento.proteina_g ?? "—"} · ` +
                      `C ${alimento.carboidrato_g ?? "—"} · G ${alimento.gordura_g ?? "—"}`}
                  <small> /100g</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
