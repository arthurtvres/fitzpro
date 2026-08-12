import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  ListPlus,
  Plus,
  Salad,
  TriangleAlert,
  Users,
} from "lucide-react";

import { api } from "../../api/index.js";
import Badge from "../../components/Badge.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { DIAS } from "../planos/config.js";

const semAcento = (texto) =>
  texto?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() ?? "";

function diaDeHoje() {
  const indice = (new Date().getDay() + 6) % 7;
  return DIAS[indice];
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataPorExtenso() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const novoAgendamento = () => ({
  horario: "",
  tipo: "treino",
  aluno_id: "",
  treino_id: "",
  titulo: "",
});

function tituloTipo(tipo) {
  if (tipo === "avaliacao") return "Avaliação física";
  if (tipo === "retorno") return "Retorno/acompanhamento";
  return "Sessão de treino";
}

export default function Home({ alunos, aoAbrirAluno, aoMontarTreino, aoErrar }) {
  const [treinos, setTreinos] = useState([]);
  const [dietas, setDietas] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [totalExercicios, setTotalExercicios] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [formAgendaAberto, setFormAgendaAberto] = useState(false);
  const [agendamento, setAgendamento] = useState(novoAgendamento);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      api.treinos.listar(),
      api.dietas.listar(),
      api.exercicios.listar({ limite: 1 }),
      api.agendamentos.listar({ data: hojeISO() }),
    ])
      .then(([listaTreinos, listaDietas, catalogo, listaAgenda]) => {
        if (cancelado) return;
        setTreinos(listaTreinos);
        setDietas(listaDietas);
        setTotalExercicios(catalogo.total);
        setAgenda(listaAgenda);
        aoErrar(null);
      })
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [aoErrar]);

  const ativos = useMemo(() => alunos.filter((a) => a.ativo), [alunos]);

  const linhas = useMemo(() => {
    return ativos.map((aluno) => {
      const treinosDoAluno = treinos.filter((t) => t.aluno_id === aluno.id);
      const dietasDoAluno = dietas.filter((d) => d.aluno_id === aluno.id);
      return {
        aluno,
        treinos: treinosDoAluno,
        dietas: dietasDoAluno,
        completo: treinosDoAluno.length > 0 && dietasDoAluno.length > 0,
        vazio: treinosDoAluno.length === 0 && dietasDoAluno.length === 0,
      };
    });
  }, [ativos, treinos, dietas]);

  const precisamAtencao = linhas.filter((l) => !l.completo);
  const hoje = diaDeHoje();
  const treinosDeHoje = useMemo(
    () => treinos.filter((t) => semAcento(t.dia_semana) === semAcento(hoje)),
    [treinos, hoje]
  );
  const treinosDoAlunoAgenda = treinos.filter(
    (treino) => String(treino.aluno_id) === String(agendamento.aluno_id)
  );

  function alterarAgenda(campo) {
    return (evento) =>
      setAgendamento((atual) => {
        const proximo = { ...atual, [campo]: evento.target.value };
        if (campo === "tipo" && evento.target.value !== "treino") proximo.treino_id = "";
        if (campo === "aluno_id") proximo.treino_id = "";
        return proximo;
      });
  }

  async function salvarAgendamento(evento) {
    evento.preventDefault();
    setSalvandoAgenda(true);
    try {
      const criado = await api.agendamentos.criar({
        data: hojeISO(),
        horario: agendamento.horario,
        tipo: agendamento.tipo,
        aluno_id: Number(agendamento.aluno_id),
        treino_id: agendamento.treino_id ? Number(agendamento.treino_id) : null,
        titulo: agendamento.titulo.trim() || tituloTipo(agendamento.tipo),
        observacao: "",
      });
      setAgenda((atual) =>
        [...atual, criado].sort((a, b) => a.horario.localeCompare(b.horario))
      );
      setAgendamento(novoAgendamento());
      setFormAgendaAberto(false);
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    } finally {
      setSalvandoAgenda(false);
    }
  }

  const metricas = [
    {
      rotulo: "Alunos ativos",
      valor: ativos.length,
      nota:
        alunos.length - ativos.length > 0
          ? `${alunos.length - ativos.length} inativo(s)`
          : "nenhum inativo",
      icone: Users,
    },
    {
      rotulo: "Treinos",
      valor: treinos.length,
      nota: `${agenda.length} na agenda hoje`,
      icone: Dumbbell,
    },
    {
      rotulo: "Dietas",
      valor: dietas.length,
      nota: `${dietas.length ? "criadas" : "nenhuma criada"}`,
      icone: Salad,
    },
    {
      rotulo: "Catálogo",
      valor: totalExercicios ?? "—",
      nota: "exercícios disponíveis",
      icone: ListPlus,
    },
  ];

  return (
    <div className="home">
      <p className="data-hoje">{dataPorExtenso()}</p>

      <section className="grade-metricas">
        {metricas.map(({ rotulo, valor, nota, icone: Icone }) => (
          <article key={rotulo} className="painel metrica">
            <span className="icone-metrica" aria-hidden="true">
              <Icone size={18} />
            </span>
            <span className="rotulo">{rotulo}</span>
            <strong className="valor">{carregando ? "—" : valor}</strong>
            <span className="nota">{carregando ? "carregando" : nota}</span>
          </article>
        ))}
      </section>

      <div className="grade-home">
        <section className="painel agenda-home">
          <div className="barra-acoes">
            <h2 style={{ margin: 0 }}>Agenda de hoje</h2>
            <div className="agenda-acoes">
              <button
                type="button"
                className="primario"
                onClick={() => setFormAgendaAberto((atual) => !atual)}
              >
                <Plus size={14} /> Agendar
              </button>
            </div>
          </div>

          {formAgendaAberto && (
            <form className="agenda-form" onSubmit={salvarAgendamento}>
              <input
                type="time"
                value={agendamento.horario}
                onChange={alterarAgenda("horario")}
                required
              />
              <select value={agendamento.tipo} onChange={alterarAgenda("tipo")}>
                <option value="treino">Sessão de treino</option>
                <option value="avaliacao">Avaliação</option>
                <option value="retorno">Retorno/acompanhamento</option>
              </select>
              <select
                value={agendamento.aluno_id}
                onChange={alterarAgenda("aluno_id")}
                required
              >
                <option value="">Aluno</option>
                {ativos.map((aluno) => (
                  <option key={aluno.id} value={String(aluno.id)}>
                    {aluno.nome}
                  </option>
                ))}
              </select>
              {agendamento.tipo === "treino" ? (
                <select
                  value={agendamento.treino_id}
                  onChange={alterarAgenda("treino_id")}
                  required
                >
                  <option value="">Treino</option>
                  {treinosDoAlunoAgenda.map((treino) => (
                    <option key={treino.id} value={String(treino.id)}>
                      {treino.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={agendamento.titulo}
                  onChange={alterarAgenda("titulo")}
                  placeholder={tituloTipo(agendamento.tipo)}
                />
              )}
              <button type="submit" className="primario" disabled={salvandoAgenda}>
                {salvandoAgenda ? "Salvando..." : "Salvar"}
              </button>
            </form>
          )}

          {carregando ? (
            <Skeleton quantidade={2} />
          ) : agenda.length === 0 ? (
            <Vazio icone={CalendarDays}>
              Nenhum compromisso marcado para hoje.
            </Vazio>
          ) : (
            <ol className="agenda-lista">
              {agenda.map((item) => (
                <li key={item.id} className="agenda-item">
                  <time>{String(item.horario).slice(0, 5)}</time>
                  <div>
                    <button
                      type="button"
                      className="link destaque agenda-aluno"
                      onClick={() => item.aluno && aoAbrirAluno(item.aluno)}
                    >
                      {item.aluno?.nome ?? `Aluno #${item.aluno_id}`}
                    </button>
                    <span>
                      {item.tipo === "treino" ? (
                        <Dumbbell size={14} />
                      ) : (
                        <ClipboardCheck size={14} />
                      )}
                      {item.treino?.nome ?? item.titulo ?? tituloTipo(item.tipo)}
                    </span>
                  </div>
                  {item.treino && (
                    <button
                      type="button"
                      className="link destaque"
                      onClick={() => aoMontarTreino(item.treino)}
                    >
                      abrir
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="painel">
          <div className="barra-acoes">
            <h2 style={{ margin: 0 }}>Precisam de atenção</h2>
            {!carregando && precisamAtencao.length > 0 && (
              <Badge tom="alerta">{precisamAtencao.length}</Badge>
            )}
          </div>

          {carregando ? (
            <Skeleton quantidade={2} />
          ) : precisamAtencao.length === 0 ? (
            <Vazio icone={TriangleAlert}>
              {ativos.length === 0
                ? "Nenhum aluno ativo ainda."
                : "Todos os alunos ativos têm treino e dieta."}
            </Vazio>
          ) : (
            <ul className="lista">
              {precisamAtencao.map(({ aluno, treinos: t, dietas: d }) => (
                <li key={aluno.id} className="cartao">
                  <div className="corpo">
                    <div className="titulo">{aluno.nome}</div>
                    <div className="descricao">
                      {t.length === 0 && d.length === 0
                        ? "sem treino e sem dieta"
                        : t.length === 0
                          ? "sem treino"
                          : "sem dieta"}
                    </div>
                  </div>
                  <div className="acoes">
                    <button className="link" onClick={() => aoAbrirAluno(aluno)}>
                      abrir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="painel">
        <div className="barra-acoes">
          <h2 style={{ margin: 0 }}>Alunos</h2>
          <span className="filtro">{ativos.length} ativo(s)</span>
        </div>

        {carregando ? (
          <Skeleton quantidade={3} />
        ) : linhas.length === 0 ? (
          <Vazio icone={Users}>Nenhum aluno ativo ainda.</Vazio>
        ) : (
          <div className="rolagem-tabela">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Objetivo</th>
                  <th>Situação</th>
                  <th>Treinos</th>
                  <th>Dietas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ aluno, treinos: t, dietas: d, completo, vazio }) => (
                  <tr key={aluno.id}>
                    <td>
                      <strong>{aluno.nome}</strong>
                      <span className="sub">{aluno.idade} anos</span>
                    </td>
                    <td>{aluno.objetivo}</td>
                    <td>
                      <Badge
                        tom={completo ? "sucesso" : vazio ? "erro" : "alerta"}
                        ponto
                      >
                        {completo ? "Completo" : vazio ? "Sem plano" : "Parcial"}
                      </Badge>
                    </td>
                    <td>{t.length}</td>
                    <td>{d.length}</td>
                    <td className="acoes-celula">
                      <button className="link" onClick={() => aoAbrirAluno(aluno)}>
                        abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
