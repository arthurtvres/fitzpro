import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import Sparkline from "../../components/Sparkline.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";

const formatarData = (iso) => iso.split("-").reverse().slice(0, 2).join("/");

/**
 * A evolução de carga de um exercício.
 *
 * O gráfico é SVG escrito à mão, não biblioteca: o projeto só tem @dnd-kit,
 * lucide e a fonte, e uma dependência de charting inteira para desenhar uma
 * linha de 4 pontos não se paga. Mesmo espírito do `MinhaEvolucao`.
 */
export default function HistoricoCarga({ alunoId, exercicioId, aoFechar, aoErrar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    api.progressao
      .exercicio(alunoId, exercicioId)
      .then((resposta) => !cancelado && setDados(resposta))
      .catch((e) => !cancelado && aoErrar?.(e.message))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [alunoId, exercicioId, aoErrar]);

  const titulo = dados?.exercicio?.nome ?? "Evolução de carga";
  const pontos = (dados?.pontos ?? []).filter((p) => p.carga_kg != null);

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      {carregando ? (
        <Skeleton quantidade={2} />
      ) : pontos.length === 0 ? (
        <Vazio icone={LineChart}>
          Nenhuma carga registrada para este exercício ainda.
        </Vazio>
      ) : (
        <div className="historico-carga">
          <div className="numeros-carga">
            <div>
              <span>Última</span>
              <strong>{dados.ultima_carga_kg} kg</strong>
            </div>
            <div>
              <span>Melhor</span>
              <strong>{dados.melhor_carga_kg} kg</strong>
            </div>
            <div>
              <span>Sessões</span>
              <strong>{dados.total_execucoes}</strong>
            </div>
          </div>

          <Sparkline
            pontos={pontos.map((p) => ({ data: p.data, valor: p.carga_kg }))}
          />

          <ul className="lista-pontos-carga">
            {[...pontos].reverse().map((ponto, indice) => (
              <li key={`${ponto.data}-${indice}`}>
                <span className="data">{formatarData(ponto.data)}</span>
                <strong>{ponto.carga_kg} kg</strong>
                {ponto.carga_prescrita_kg != null &&
                  ponto.carga_kg >= ponto.carga_prescrita_kg && (
                    <span className="selo-alvo">bateu o alvo</span>
                  )}
                {ponto.observacao && <span className="obs">{ponto.observacao}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
