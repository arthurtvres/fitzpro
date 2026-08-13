import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Sparkline from "../../components/Sparkline.jsx";
import Vazio from "../../components/Vazio.jsx";
import { dataCurta, delta, kg } from "../aluno/home/formato.js";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-08" -> "ago" */
const rotuloMes = (chave) => MESES[Number(chave.split("-")[1]) - 1] ?? chave;

/**
 * A evolução completa de um exercício: gráfico, últimas execuções e recordes.
 *
 * Substitui o `HistoricoCarga` na área do aluno. A diferença que importa é a
 * lista de execuções mostrar as **repetições por série** — "10 · 9 · 8" diz
 * muito mais sobre como o treino foi do que a carga sozinha, porque é ali que
 * se vê a fadiga chegando.
 */
export default function EvolucaoDoExercicio({ alunoId, exercicioId, aoFechar, aoErrar }) {
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

  const titulo = dados?.exercicio?.nome ?? "Evolução do exercício";
  const pontos = (dados?.pontos ?? []).filter((p) => p.carga_kg != null);
  const primeira = pontos[0]?.carga_kg;
  const atual = pontos[pontos.length - 1]?.carga_kg;
  const variacao =
    primeira && atual ? Math.round((100 * (atual - primeira)) / primeira) : null;

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      {carregando ? (
        <Skeleton quantidade={2} />
      ) : pontos.length === 0 ? (
        <Vazio icone={LineChart}>
          Nenhuma carga registrada para este exercício ainda.
        </Vazio>
      ) : (
        <div className="evolucao-exercicio">
          <div className="numero-destaque">
            <strong>{kg(atual)}</strong>
            {variacao != null && variacao !== 0 && (
              <span className={variacao > 0 ? "positiva" : ""}>
                {variacao > 0 ? "↑" : "↓"} {Math.abs(variacao)}%
              </span>
            )}
          </div>

          <Sparkline
            pontos={pontos.map((p) => ({ data: p.data, valor: p.carga_kg }))}
            escalaTemporal
            altura={110}
            rotulo={`Carga de ${primeira} a ${atual} kg`}
          />

          {dados.por_mes?.length > 1 && (
            <ol className="eixo-meses">
              {dados.por_mes.map((mes) => (
                <li key={mes.mes}>
                  <span>{rotuloMes(mes.mes)}</span>
                  <strong>{kg(mes.melhor_carga_kg)}</strong>
                </li>
              ))}
            </ol>
          )}

          <div className="numeros-carga">
            <div>
              <span>Melhor carga</span>
              <strong>{kg(dados.melhor_carga_kg)}</strong>
            </div>
            <div>
              <span>Maior volume</span>
              <strong>{kg(dados.melhor_volume_kg)}</strong>
            </div>
            <div>
              <span>Sessões</span>
              <strong>{dados.total_execucoes}</strong>
            </div>
          </div>

          <h3 className="titulo-secao">Últimas execuções</h3>
          <ul className="lista-execucoes">
            {dados.ultimas_execucoes.map((execucao, indice) => (
              <li key={`${execucao.data}-${indice}`}>
                <span className="data">{dataCurta(execucao.data)}</span>
                <strong className="carga">{kg(execucao.carga_kg)}</strong>
                <span className="reps">
                  {/* O que a carga sozinha não conta: onde a fadiga chegou. */}
                  {execucao.series
                    .map((s) => (s.reps == null ? "—" : s.reps))
                    .join(" · ")}
                </span>
                {execucao.volume_kg != null && (
                  <span className="volume">
                    {kg(execucao.volume_kg, { estimado: execucao.volume_estimado })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
