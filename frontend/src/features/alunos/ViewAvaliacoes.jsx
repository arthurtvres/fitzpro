import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Camera,
  Eye,
  Printer,
  LineChart,
  Search,
  User,
} from "lucide-react";

import { api } from "../../api/index.js";
import FolhaImpressao from "../../components/FolhaImpressao.jsx";
import Modal from "../../components/Modal.jsx";
import { AvaliacaoImpressa } from "../impressao/Documentos.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { CAMPOS_AVALIACAO, lerFotos } from "./PainelAvaliacoes.jsx";

const CAMPOS_DETALHE = [
  ["peso_kg", "Peso", "kg"],
  ["percentual_gordura", "Gordura corporal", "%"],
  ["massa_muscular_kg", "Massa muscular", "kg"],
  ["cintura_cm", "Cintura", "cm"],
  ["quadril_cm", "Quadril", "cm"],
  ["braco_cm", "Braco", "cm"],
  ["coxa_cm", "Coxa", "cm"],
  ["torax_cm", "Torax", "cm"],
  ["imc", "IMC", ""],
];

const METRICAS_GRAFICO = [
  ["peso_kg", "Peso", "kg"],
  ["percentual_gordura", "Gordura corporal", "%"],
  ["massa_muscular_kg", "Massa muscular", "kg"],
  ["cintura_cm", "Cintura", "cm"],
  ["quadril_cm", "Quadril", "cm"],
  ["braco_cm", "Braco", "cm"],
  ["coxa_cm", "Coxa", "cm"],
  ["torax_cm", "Torax", "cm"],
  ["imc", "IMC", ""],
];

const periodoEmDias = {
  "30": 30,
  "90": 90,
  "180": 180,
};

const formatarNumero = (valor) =>
  valor == null || Number.isNaN(Number(valor))
    ? "-"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(valor));

const formatarComUnidade = (valor, unidade) =>
  valor == null ? "-" : `${formatarNumero(valor)}${unidade ? ` ${unidade}` : ""}`;

const formatarDataCurta = (iso) => {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(ano, mes - 1, dia))
    .replace(".", "");
};

const formatarDataLonga = (iso) => {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(ano, mes - 1, dia));
};

const formatarDataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "-");

const ordenarRecentes = (lista) =>
  [...lista].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

const ordenarCronologico = (lista) =>
  [...lista].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);

const pluralFotos = (total) => `${total} ${total === 1 ? "foto" : "fotos"}`;

function variacao(atual, anterior, unidade) {
  if (atual == null || anterior == null) return null;
  const delta = Number((Number(atual) - Number(anterior)).toFixed(1));
  if (delta === 0) return `0${unidade ? ` ${unidade}` : ""}`;
  return `${delta > 0 ? "↑" : "↓"} ${formatarNumero(Math.abs(delta))}${
    unidade ? ` ${unidade}` : ""
  }`;
}

function Variacao({ atual, anterior, unidade }) {
  if (atual == null || anterior == null) return "-";
  const delta = Number((Number(atual) - Number(anterior)).toFixed(1));
  const classe =
    delta > 0 ? "variacao positiva" : delta < 0 ? "variacao negativa" : "variacao";

  return <span className={classe}>{variacao(atual, anterior, unidade)}</span>;
}

function pontoPorPercentual(valor, min, max) {
  if (max === min) return 50;
  return 92 - ((valor - min) / (max - min)) * 78;
}

export default function ViewAvaliacoes({
  alunos,
  aoAbrirAluno,
  aoCriar,
  aoErrar,
  // Só para o cabeçalho da folha impressa; ver `FolhaImpressao`.
  personal,
}) {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAluno, setFiltroAluno] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [visualizacao, setVisualizacao] = useState("evolucao");
  const [alunoEvolucao, setAlunoEvolucao] = useState("");
  const [metricaGrafico, setMetricaGrafico] = useState("peso_kg");
  const [visualizando, setVisualizando] = useState(null);
  const [imprimindo, setImprimindo] = useState(null);

  const alunosAtivos = useMemo(() => alunos.filter((aluno) => aluno.ativo), [alunos]);

  useEffect(() => {
    let cancelado = false;

    setCarregando(true);
    Promise.all(
      alunosAtivos.map((aluno) =>
        api.alunos.avaliacoes
          .listar(aluno.id)
          .then((lista) => lista.map((avaliacao) => ({ ...avaliacao, aluno })))
      )
    )
      .then((grupos) => {
        if (cancelado) return;
        const lista = ordenarRecentes(grupos.flat());
        setAvaliacoes(lista);
        setAlunoEvolucao((atual) => atual || String(lista[0]?.aluno.id ?? alunosAtivos[0]?.id ?? ""));
        aoErrar(null);
      })
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [alunosAtivos, aoErrar]);

  const avaliacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);

    return avaliacoes.filter((avaliacao) => {
      const bateBusca =
        termo === "" ||
        avaliacao.aluno.nome.toLowerCase().includes(termo) ||
        (avaliacao.observacao ?? "").toLowerCase().includes(termo);
      const bateAluno =
        filtroAluno === "" || String(avaliacao.aluno.id) === String(filtroAluno);
      const data = new Date(`${avaliacao.data}T00:00:00`);
      const batePeriodo =
        filtroPeriodo === "" ||
        (filtroPeriodo === "ano" && data >= inicioAno) ||
        (periodoEmDias[filtroPeriodo] &&
          (hoje - data) / (1000 * 60 * 60 * 24) <= periodoEmDias[filtroPeriodo]);

      return bateBusca && bateAluno && batePeriodo;
    });
  }, [avaliacoes, busca, filtroAluno, filtroPeriodo]);

  const avaliacoesPorAluno = useMemo(() => {
    const mapa = new Map();
    for (const avaliacao of avaliacoes) {
      if (!mapa.has(avaliacao.aluno.id)) mapa.set(avaliacao.aluno.id, []);
      mapa.get(avaliacao.aluno.id).push(avaliacao);
    }
    for (const [id, lista] of mapa) mapa.set(id, ordenarRecentes(lista));
    return mapa;
  }, [avaliacoes]);

  const avaliacoesDoAluno = avaliacoesPorAluno.get(Number(alunoEvolucao)) ?? [];
  const alunoSelecionado =
    alunosAtivos.find((aluno) => String(aluno.id) === String(alunoEvolucao)) ??
    avaliacoesDoAluno[0]?.aluno;
  const ultima = avaliacoesDoAluno[0] ?? null;
  const anterior = avaliacoesDoAluno[1] ?? null;

  return (
    <section className="avaliacoes-page">
      {visualizacao === "historico" && (
        <div className="avaliacoes-toolbar">
          <div className="campo-busca">
            <span className="lupa" aria-hidden="true">
              <Search size={16} />
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno..."
            />
          </div>

          <select value={filtroAluno} onChange={(e) => setFiltroAluno(e.target.value)}>
            <option value="">Todos os alunos</option>
            {alunosAtivos.map((aluno) => (
              <option key={aluno.id} value={String(aluno.id)}>
                {aluno.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
          >
            <option value="">Todo período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 3 meses</option>
            <option value="180">Últimos 6 meses</option>
            <option value="ano">Este ano</option>
          </select>
        </div>
      )}

      <div className="treinos-resumo">
        <span>
          {carregando
            ? "Carregando avaliações"
            : `${avaliacoesFiltradas.length} avaliações registradas`}
        </span>
        <div className="controle-segmentado">
          <button
            type="button"
            className={visualizacao === "evolucao" ? "ativo" : ""}
            onClick={() => setVisualizacao("evolucao")}
          >
            Evolução por aluno
          </button>
          <button
            type="button"
            className={visualizacao === "historico" ? "ativo" : ""}
            onClick={() => setVisualizacao("historico")}
          >
            Histórico
          </button>
        </div>
      </div>

      {carregando ? (
        <Skeleton quantidade={4} />
      ) : avaliacoes.length === 0 ? (
        <Vazio icone={LineChart}>
          <div>
            <strong>Nenhuma avaliação registrada</strong>
            <span>Registre a primeira avaliação.</span>
            <button type="button" className="primario" onClick={aoCriar}>
              + Nova avaliação
            </button>
          </div>
        </Vazio>
      ) : visualizacao === "historico" ? (
        avaliacoesFiltradas.length === 0 ? (
          <Vazio icone={Search}>Nenhuma avaliação encontrada para esses filtros.</Vazio>
        ) : (
          <HistoricoAvaliacoes
            avaliacoes={avaliacoesFiltradas}
            aoAbrirAluno={aoAbrirAluno}
            aoVisualizar={setVisualizando}
            aoImprimir={setImprimindo}
          />
        )
      ) : (
        <EvolucaoAluno
          alunos={alunosAtivos}
          alunoSelecionado={alunoSelecionado}
          alunoEvolucao={alunoEvolucao}
          setAlunoEvolucao={setAlunoEvolucao}
          avaliacoes={avaliacoesDoAluno}
          ultima={ultima}
          anterior={anterior}
          metricaGrafico={metricaGrafico}
          setMetricaGrafico={setMetricaGrafico}
          aoVisualizar={setVisualizando}
          aoImprimir={setImprimindo}
        />
      )}

      {imprimindo && (
        <FolhaImpressao
          titulo="Avaliação física"
          /* A avaliação já vem com o aluno embutido nesta tela. */
          aluno={imprimindo.aluno}
          personal={personal}
          aoFechar={() => setImprimindo(null)}
        >
          <AvaliacaoImpressa avaliacao={imprimindo} campos={CAMPOS_AVALIACAO} />
        </FolhaImpressao>
      )}

      {visualizando && (
        <DetalheAvaliacaoModal
          avaliacao={visualizando}
          anterior={
            (avaliacoesPorAluno.get(visualizando.aluno.id) ?? []).find(
              (item) =>
                item.data < visualizando.data ||
                (item.data === visualizando.data && item.id < visualizando.id)
            ) ?? null
          }
          aoFechar={() => setVisualizando(null)}
        />
      )}
    </section>
  );
}

function HistoricoAvaliacoes({ avaliacoes, aoAbrirAluno, aoVisualizar, aoImprimir }) {
  return (
    <div className="rolagem-tabela">
      <table className="tabela avaliacoes-tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Aluno</th>
            <th>Peso</th>
            <th>Gordura</th>
            <th>IMC</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {avaliacoes.map((avaliacao) => {
            const fotos = lerFotos(avaliacao.fotos);
            return (
              <tr key={avaliacao.id}>
                <td>
                  <strong>{formatarDataCurta(avaliacao.data)}</strong>
                  {avaliacao.observacao && (
                    <span className="sub">{avaliacao.observacao}</span>
                  )}
                  {fotos.length > 0 && (
                    <span className="sub fotos-inline">
                      <Camera size={13} /> {pluralFotos(fotos.length)}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="link destaque"
                    type="button"
                    onClick={() => aoAbrirAluno(avaliacao.aluno)}
                  >
                    {avaliacao.aluno.nome}
                  </button>
                </td>
                <td>{formatarComUnidade(avaliacao.peso_kg, "kg")}</td>
                <td>{formatarComUnidade(avaliacao.percentual_gordura, "%")}</td>
                <td>{formatarComUnidade(avaliacao.imc, "")}</td>
                <td className="acoes-celula">
                  <button
                    type="button"
                    className="botao-montar"
                    onClick={() => aoVisualizar(avaliacao)}
                  >
                    <Eye size={14} /> Ver avaliação
                  </button>
                  <button
                    type="button"
                    className="link"
                    onClick={() => aoImprimir(avaliacao)}
                    aria-label="Gerar PDF"
                    title="Gerar PDF"
                  >
                    <Printer size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EvolucaoAluno({
  alunos,
  alunoSelecionado,
  alunoEvolucao,
  setAlunoEvolucao,
  avaliacoes,
  ultima,
  anterior,
  metricaGrafico,
  setMetricaGrafico,
  aoVisualizar,
  aoImprimir,
}) {
  return (
    <div className="evolucao-aluno">
      <label className="filtro avaliacao-aluno-select">
        <span>Aluno:</span>
        <select value={alunoEvolucao} onChange={(e) => setAlunoEvolucao(e.target.value)}>
          {alunos.map((aluno) => (
            <option key={aluno.id} value={String(aluno.id)}>
              {aluno.nome}
            </option>
          ))}
        </select>
      </label>

      {!alunoSelecionado || avaliacoes.length === 0 ? (
        <Vazio icone={LineChart}>Este aluno ainda não possui avaliação.</Vazio>
      ) : (
        <>
          <div className="evolucao-topo">
            <div>
              <h2>{alunoSelecionado.nome}</h2>
              <span>Última avaliação: {formatarDataLonga(ultima.data)}</span>
            </div>
            <div className="acoes-do-painel">
              <button type="button" className="link" onClick={() => aoImprimir(ultima)}>
                <Printer size={14} /> PDF
              </button>
              <button
                type="button"
                className="botao-montar"
                onClick={() => aoVisualizar(ultima)}
              >
                <Eye size={14} /> Ver avaliação
              </button>
            </div>
          </div>

          <div className="metricas-evolucao">
            {[
              ["peso_kg", "Peso", "kg"],
              ["percentual_gordura", "Gordura", "p.p."],
              ["massa_muscular_kg", "Massa muscular", "kg"],
              ["imc", "IMC", ""],
            ].map(([campo, rotulo, unidadeVariacao]) => (
              <article key={campo} className="painel metrica-evolucao">
                <span>{rotulo}</span>
                <strong>
                  {formatarComUnidade(
                    ultima[campo],
                    campo === "percentual_gordura"
                      ? "%"
                      : campo.includes("_kg")
                        ? "kg"
                        : ""
                  )}
                </strong>
                {anterior ? (
                  <>
                    <small>
                      <Variacao
                        atual={ultima[campo]}
                        anterior={anterior[campo]}
                        unidade={unidadeVariacao}
                      />
                    </small>
                    <em>desde {formatarDataBR(anterior.data).slice(0, 5)}</em>
                  </>
                ) : (
                  <em>Primeira avaliação</em>
                )}
              </article>
            ))}
          </div>

          <GraficoEvolucao
            avaliacoes={avaliacoes}
            metrica={metricaGrafico}
            setMetrica={setMetricaGrafico}
          />

          <div className="historico-aluno">
            <h2>Histórico completo</h2>
            {/* A linha era um <button> só. Virou uma linha com duas ações
                porque botão dentro de botão não é HTML válido — e imprimir
                qualquer avaliação do histórico exige a segunda. */}
            {avaliacoes.map((avaliacao) => (
              <div key={avaliacao.id} className="avaliacao-linha-card">
                <button
                  type="button"
                  className="avaliacao-linha-conteudo"
                  onClick={() => aoVisualizar(avaliacao)}
                >
                  <span>
                    <CalendarDays size={14} /> {formatarDataCurta(avaliacao.data)}
                  </span>
                  <span>{formatarComUnidade(avaliacao.peso_kg, "kg")}</span>
                  <span>{formatarComUnidade(avaliacao.percentual_gordura, "%")}</span>
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => aoImprimir(avaliacao)}
                  aria-label={`Gerar PDF da avaliação de ${formatarDataCurta(avaliacao.data)}`}
                  title="Gerar PDF"
                >
                  <Printer size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GraficoEvolucao({ avaliacoes, metrica, setMetrica }) {
  const [, rotulo, unidade] =
    METRICAS_GRAFICO.find(([campo]) => campo === metrica) ?? METRICAS_GRAFICO[0];
  const pontos = ordenarCronologico(avaliacoes)
    .filter((avaliacao) => avaliacao[metrica] != null)
    .map((avaliacao) => ({ data: avaliacao.data, valor: Number(avaliacao[metrica]) }));
  const valores = pontos.map((ponto) => ponto.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const largura = 100;
  const coords = pontos.map((ponto, indice) => {
    const x = pontos.length === 1 ? 50 : 8 + (indice / (pontos.length - 1)) * 84;
    const y = pontoPorPercentual(ponto.valor, min, max);
    return { ...ponto, x, y };
  });
  const path = coords.map((ponto) => `${ponto.x},${ponto.y}`).join(" ");

  return (
    <section className="painel grafico-evolucao">
      <div className="barra-acoes">
        <h2>Evolução</h2>
        <select value={metrica} onChange={(e) => setMetrica(e.target.value)}>
          {METRICAS_GRAFICO.map(([campo, nome]) => (
            <option key={campo} value={campo}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      {pontos.length < 2 ? (
        <Vazio icone={BarChart3}>Aluno com apenas uma avaliação nessa métrica.</Vazio>
      ) : (
        <>
      <svg viewBox="0 0 100 100" role="img" aria-label={`Evolução de ${rotulo}`}>
            <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" />
            {coords.map((ponto) => (
              <circle key={`${ponto.data}-${ponto.valor}`} cx={ponto.x} cy={ponto.y} r="2.8" />
            ))}
          </svg>
          <div className="grafico-legenda">
            {coords.map((ponto) => (
              <span key={ponto.data}>
                {formatarDataCurta(ponto.data).replace(/\s\d{4}/, "")}
                <strong>{formatarComUnidade(ponto.valor, unidade)}</strong>
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DetalheAvaliacaoModal({ avaliacao, anterior, aoFechar }) {
  const fotos = lerFotos(avaliacao.fotos);

  return (
    <Modal titulo={`Avaliação - ${formatarDataBR(avaliacao.data)}`} largo aoFechar={aoFechar}>
      <div className="detalhe-registro">
        <div className="avaliacao-modal-topo">
          <User size={16} />
          <strong>{avaliacao.aluno.nome}</strong>
          {fotos.length > 0 && (
            <span>
              <Camera size={14} /> {pluralFotos(fotos.length)}
            </span>
          )}
        </div>

        <div className="rolagem-tabela">
          <table className="tabela comparativo-avaliacao">
            <thead>
              <tr>
                <th>Medida</th>
                <th>Atual</th>
                <th>Anterior</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              {CAMPOS_DETALHE.filter(([campo]) => avaliacao[campo] != null).map(
                ([campo, rotulo, unidade]) => (
                  <tr key={campo}>
                    <td>{rotulo}</td>
                    <td>{formatarComUnidade(avaliacao[campo], unidade)}</td>
                    <td>{anterior ? formatarComUnidade(anterior[campo], unidade) : "-"}</td>
                    <td>
                      {anterior ? (
                        <Variacao
                          atual={avaliacao[campo]}
                          anterior={anterior[campo]}
                          unidade={unidade}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="bloco-detalhe">
          <span>Observação</span>
          <p>{avaliacao.observacao || "-"}</p>
        </div>

        {fotos.length > 0 && (
          <div className="galeria-avaliacao">
            {fotos.map((foto) => (
              <figure key={foto.id}>
                <img src={foto.url} alt={foto.nome || "Foto da avaliação"} />
                {foto.nome && <figcaption>{foto.nome}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
