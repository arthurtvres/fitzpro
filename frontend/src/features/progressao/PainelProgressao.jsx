import { useEffect, useState } from "react";
import { ArrowUpRight, LineChart, TrendingUp } from "lucide-react";

import { api } from "../../api/index.js";
import Badge from "../../components/Badge.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import HistoricoCarga from "./HistoricoCarga.jsx";

const formatarData = (iso) => iso.split("-").reverse().slice(0, 2).join("/");
const kg = (valor) => (valor == null ? "—" : `${valor} kg`);

/**
 * O que o aluno vem levantando, e onde já dá para subir a carga.
 *
 * "Pronto para subir" é sinal, não comando: o sistema não altera prescrição
 * nenhuma. Quem decide é o personal, que sabe se o aluno bateu o alvo com
 * técnica ou empurrando com o corpo — e o caminho para alterar é o formulário
 * de prescrição que já existe, dentro do treino.
 */
export default function PainelProgressao({ aluno, aoErrar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [detalhando, setDetalhando] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    api.progressao
      .treinos(aluno.id)
      .then((resposta) => !cancelado && setDados(resposta))
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [aluno.id, aoErrar]);

  if (carregando) return <Skeleton quantidade={3} />;

  const itens = dados?.itens ?? [];
  if (itens.length === 0) {
    return (
      <Vazio icone={LineChart}>
        {aluno.nome} ainda não tem exercícios prescritos para acompanhar.
      </Vazio>
    );
  }

  // Quem está pronto para subir vem primeiro: é a razão de abrir esta aba.
  const ordenados = [...itens].sort(
    (a, b) => Number(b.pronto_para_subir) - Number(a.pronto_para_subir)
  );
  const comRegistro = itens.filter((i) => i.total_execucoes > 0).length;

  return (
    <div className="painel-progressao">
      <p className="apoio-secao">
        {comRegistro === 0
          ? "Nenhum exercício registrado ainda. Os números aparecem conforme o aluno for marcando o que fez."
          : `${comRegistro} de ${itens.length} exercícios já têm registro.`}
        {dados.prontos_para_subir > 0 &&
          ` ${dados.prontos_para_subir} pronto${
            dados.prontos_para_subir > 1 ? "s" : ""
          } para subir a carga.`}
      </p>

      <div className="rolagem-tabela">
        <table className="tabela">
          <thead>
            <tr>
              <th>Exercício</th>
              <th>Treino</th>
              <th>Prescrito</th>
              <th>Última</th>
              <th>Melhor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((item) => (
              <tr
                key={item.treino_exercicio_id}
                className={item.pronto_para_subir ? "destacada" : undefined}
              >
                <td>
                  <strong>{item.exercicio?.nome ?? item.exercicio_id}</strong>
                  <span className="sub">
                    {item.series} × {item.repeticoes}
                  </span>
                </td>
                <td>
                  {item.treino_nome}
                  <span className="sub">{item.dia_semana}</span>
                </td>
                <td>{kg(item.carga_prescrita_kg)}</td>
                <td>
                  {kg(item.ultima_carga_kg)}
                  {item.ultima_data && (
                    <span className="sub">{formatarData(item.ultima_data)}</span>
                  )}
                </td>
                <td>{kg(item.melhor_carga_kg)}</td>
                <td className="acoes-celula">
                  {item.pronto_para_subir && (
                    <Badge tom="alerta">
                      <TrendingUp size={12} /> pronto para subir
                    </Badge>
                  )}
                  {item.total_execucoes > 0 && (
                    <button
                      className="link destaque"
                      onClick={() => setDetalhando(item.exercicio_id)}
                      title="Ver evolução"
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.prontos_para_subir > 0 && (
        <p className="nota-progressao">
          "Pronto para subir" quer dizer que o aluno bateu a carga prescrita nas
          duas últimas sessões. Para ajustar, abra o treino e edite a prescrição —
          o sistema não altera carga sozinho.
        </p>
      )}

      {detalhando && (
        <HistoricoCarga
          alunoId={aluno.id}
          exercicioId={detalhando}
          aoFechar={() => setDetalhando(null)}
          aoErrar={aoErrar}
        />
      )}
    </div>
  );
}
