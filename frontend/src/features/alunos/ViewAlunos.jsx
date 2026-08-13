import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  Dumbbell,
  Edit3,
  MoreVertical,
  RotateCcw,
  Salad,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { api } from "../../api/index.js";
import Avatar from "../../components/Avatar.jsx";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";

const plural = (total, singular, pluralizado) =>
  `${total} ${total === 1 ? singular : pluralizado}`;

const diasDesde = (iso) => {
  if (!iso) return null;
  const data = new Date(`${iso}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje - data) / 86400000));
};

const formatarUltimaAvaliacao = (dias) => {
  if (dias == null) return "Sem avaliação";
  if (dias === 0) return "Avaliada hoje";
  if (dias === 1) return "Avaliada ontem";
  if (dias < 30) return `Avaliada há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return `Avaliada há ${meses} ${meses === 1 ? "mês" : "meses"}`;
};

const textoPendencias = (total) => {
  if (total === 0) return "Tudo em dia";
  if (total === 1) return "1 pendência";
  return `${total} pendências`;
};

export default function ViewAlunos({
  alunos,
  carregando,
  aoCriar,
  aoSelecionar,
  aoEditar,
  aoDesativar,
  aoReativar,
  aoCriarTreino,
  aoCriarDieta,
  aoCriarAvaliacao,
  aoErrar,
}) {
  const [treinos, setTreinos] = useState([]);
  const [dietas, setDietas] = useState([]);
  const [avaliacoesPorAluno, setAvaliacoesPorAluno] = useState({});
  const [carregandoResumo, setCarregandoResumo] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroObjetivo, setFiltroObjetivo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [filtroOperacional, setFiltroOperacional] = useState("");
  const [menuAberto, setMenuAberto] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  useEffect(() => {
    if (carregando) return;
    let cancelado = false;

    setCarregandoResumo(true);
    Promise.all([
      api.treinos.listar(),
      api.dietas.listar(),
      Promise.all(
        alunos.map((aluno) =>
          api.alunos.avaliacoes
            .listar(aluno.id)
            .then((lista) => [aluno.id, lista])
        )
      ),
    ])
      .then(([listaTreinos, listaDietas, gruposAvaliacoes]) => {
        if (cancelado) return;
        setTreinos(listaTreinos);
        setDietas(listaDietas);
        setAvaliacoesPorAluno(Object.fromEntries(gruposAvaliacoes));
        aoErrar(null);
      })
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregandoResumo(false));

    return () => {
      cancelado = true;
    };
  }, [alunos, carregando, aoErrar]);

  const resumoPorAluno = useMemo(() => {
    const treinosPorAluno = new Map();
    const dietasPorAluno = new Map();

    for (const treino of treinos) {
      treinosPorAluno.set(treino.aluno_id, (treinosPorAluno.get(treino.aluno_id) ?? 0) + 1);
    }
    for (const dieta of dietas) {
      dietasPorAluno.set(dieta.aluno_id, (dietasPorAluno.get(dieta.aluno_id) ?? 0) + 1);
    }

    return Object.fromEntries(
      alunos.map((aluno) => {
        const totalTreinos = treinosPorAluno.get(aluno.id) ?? 0;
        const totalDietas = dietasPorAluno.get(aluno.id) ?? 0;
        const avaliacoes = avaliacoesPorAluno[aluno.id] ?? [];
        const ultimaAvaliacao = avaliacoes[0]?.data ?? null;
        const pendencias = [
          totalTreinos === 0 ? "Sem treino" : null,
          totalDietas === 0 ? "Sem dieta" : null,
          avaliacoes.length === 0 ? "Sem avaliação" : null,
        ].filter(Boolean);

        return [
          aluno.id,
          {
            totalTreinos,
            totalDietas,
            avaliacoes,
            ultimaAvaliacao,
            diasUltimaAvaliacao: diasDesde(ultimaAvaliacao),
            pendencias,
          },
        ];
      })
    );
  }, [alunos, treinos, dietas, avaliacoesPorAluno]);

  const alunosAtivos = alunos.filter((aluno) => aluno.ativo);
  const metricas = useMemo(() => {
    const totalAtivos = alunosAtivos.length;
    const comTreino = alunosAtivos.filter(
      (aluno) => (resumoPorAluno[aluno.id]?.totalTreinos ?? 0) > 0
    ).length;
    const comDieta = alunosAtivos.filter(
      (aluno) => (resumoPorAluno[aluno.id]?.totalDietas ?? 0) > 0
    ).length;
    const pendentes = alunosAtivos.filter(
      (aluno) => (resumoPorAluno[aluno.id]?.pendencias.length ?? 0) > 0
    ).length;

    const percentual = (valor) =>
      totalAtivos === 0 ? "0%" : `${Math.round((valor / totalAtivos) * 100)}%`;

    return [
      {
        chave: "ativos",
        rotulo: "Alunos ativos",
        valor: String(totalAtivos),
        nota: null,
        Icone: Users,
      },
      {
        chave: "com-treino",
        rotulo: "Com treino",
        valor: `${comTreino} de ${totalAtivos}`,
        nota: percentual(comTreino),
        Icone: Dumbbell,
      },
      {
        chave: "com-dieta",
        rotulo: "Com dieta",
        valor: `${comDieta} de ${totalAtivos}`,
        nota: percentual(comDieta),
        Icone: Salad,
      },
      {
        chave: "pendencias",
        rotulo: "Pendências",
        valor: String(pendentes),
        nota:
          pendentes === 0
            ? "Tudo em dia"
            : pendentes === 1
              ? "Aluno precisa de atenção"
              : "Alunos precisam de atenção",
        Icone: AlertTriangle,
      },
    ];
  }, [alunosAtivos, resumoPorAluno]);

  const objetivos = useMemo(
    () =>
      Array.from(new Set(alunos.map((aluno) => aluno.objetivo).filter(Boolean))).sort(),
    [alunos]
  );

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return alunos.filter((aluno) => {
      const bateBusca =
        termo === "" ||
        aluno.nome.toLowerCase().includes(termo) ||
        aluno.email.toLowerCase().includes(termo);
      const bateObjetivo = filtroObjetivo === "" || aluno.objetivo === filtroObjetivo;
      const bateStatus =
        filtroStatus === "todos" ||
        (filtroStatus === "ativos" && aluno.ativo) ||
        (filtroStatus === "inativos" && !aluno.ativo);
      const resumo = resumoPorAluno[aluno.id];
      const bateOperacional =
        filtroOperacional === "" ||
        (filtroOperacional === "ativos" && aluno.ativo) ||
        (filtroOperacional === "com-treino" && (resumo?.totalTreinos ?? 0) > 0) ||
        (filtroOperacional === "com-dieta" && (resumo?.totalDietas ?? 0) > 0) ||
        (filtroOperacional === "pendencias" &&
          aluno.ativo &&
          (resumo?.pendencias.length ?? 0) > 0);

      return bateBusca && bateObjetivo && bateStatus && bateOperacional;
    });
  }, [alunos, busca, filtroObjetivo, filtroStatus, filtroOperacional, resumoPorAluno]);

  const carregandoTudo = carregando || carregandoResumo;

  async function confirmarAcao() {
    if (!confirmando) return;
    if (confirmando.tipo === "desativar") await aoDesativar(confirmando.aluno);
    setConfirmando(null);
  }

  return (
    <section className="alunos-page">
      <div className="metricas-alunos">
        {carregandoTudo ? (
          <Skeleton quantidade={4} />
        ) : (
          metricas.map(({ Icone, ...metrica }) => (
            <button
              type="button"
              className={`painel metrica metrica-aluno${
                filtroOperacional === metrica.chave ? " ativa" : ""
              }`}
              key={metrica.rotulo}
              onClick={() =>
                setFiltroOperacional((atual) =>
                  atual === metrica.chave ? "" : metrica.chave
                )
              }
            >
              <span className="icone-metrica" aria-hidden="true">
                <Icone size={17} />
              </span>
              <span className="rotulo">{metrica.rotulo}</span>
              <strong className="valor">{metrica.valor}</strong>
              {metrica.nota && <span className="nota">{metrica.nota}</span>}
            </button>
          ))
        )}
      </div>

      <div className="treinos-toolbar alunos-toolbar">
        <div className="campo-busca treino-busca">
          <span className="lupa" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar aluno por nome ou e-mail..."
          />
        </div>
        <select value={filtroObjetivo} onChange={(e) => setFiltroObjetivo(e.target.value)}>
          <option value="">Todos os objetivos</option>
          {objetivos.map((objetivo) => (
            <option key={objetivo} value={objetivo}>
              {objetivo}
            </option>
          ))}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
      </div>

      <div className="treinos-resumo">
        <span>{carregandoTudo ? "Carregando alunos" : plural(alunosFiltrados.length, "aluno", "alunos")}</span>
      </div>

      {carregandoTudo ? (
        <Skeleton quantidade={4} />
      ) : alunos.length === 0 ? (
        <Vazio icone={UserPlus}>
          <strong>Nenhum aluno cadastrado</strong>
          <span>Cadastre seu primeiro aluno para começar a criar treinos e acompanhar sua evolução.</span>
          <button type="button" className="primario" onClick={aoCriar}>
            + Criar aluno
          </button>
        </Vazio>
      ) : alunosFiltrados.length === 0 ? (
        <Vazio icone={Search}>
          <strong>Nenhum aluno encontrado.</strong>
          <span>Experimente alterar os filtros ou o termo pesquisado.</span>
        </Vazio>
      ) : (
        <div className="alunos-lista">
          {alunosFiltrados.map((aluno) => (
            <AlunoCard
              key={aluno.id}
              aluno={aluno}
              resumo={resumoPorAluno[aluno.id]}
              menuAberto={menuAberto}
              setMenuAberto={setMenuAberto}
              aoSelecionar={aoSelecionar}
              aoEditar={aoEditar}
              aoCriarTreino={aoCriarTreino}
              aoCriarDieta={aoCriarDieta}
              aoCriarAvaliacao={aoCriarAvaliacao}
              aoDesativar={() => setConfirmando({ tipo: "desativar", aluno })}
              aoReativar={aoReativar}
            />
          ))}
        </div>
      )}

      {confirmando && (
        <Modal titulo="Desativar aluno" aoFechar={() => setConfirmando(null)}>
          <div className="confirmacao-exclusao">
            <p>
              Desativar <strong>{confirmando.aluno.nome}</strong>? O histórico será preservado.
            </p>
            <div className="acoes-form">
              <button type="button" onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
              <button type="button" className="perigo" onClick={confirmarAcao}>
                Desativar aluno
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AlunoCard({
  aluno,
  resumo,
  menuAberto,
  setMenuAberto,
  aoSelecionar,
  aoEditar,
  aoCriarTreino,
  aoCriarDieta,
  aoCriarAvaliacao,
  aoDesativar,
  aoReativar,
}) {
  const ref = useRef(null);
  const temPendencia = aluno.ativo && resumo?.pendencias.length > 0;

  useEffect(() => {
    if (menuAberto !== aluno.id) return;
    const aoClicar = (evento) => {
      if (!ref.current?.contains(evento.target)) setMenuAberto(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [menuAberto, aluno.id, setMenuAberto]);

  return (
    <article className={`aluno-card${aluno.ativo ? "" : " inativo"}`}>
      <Avatar
        usuario={aluno}
        tamanho={36}
        className="aluno-avatar"
        rotulo={`Abrir ${aluno.nome}`}
        aoClicar={() => aoSelecionar(aluno)}
      />

      <div className="aluno-card-corpo">
        <div className="aluno-card-titulo">
          <h3>{aluno.nome}</h3>
          <span className={`badge-status ${aluno.ativo ? "completo" : "incompleto"}`}>
            {aluno.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>
        <p>{aluno.objetivo || "Sem objetivo"}</p>

        <div className="aluno-operacional">
          <span>
            <Dumbbell size={14} />
            {(resumo?.totalTreinos ?? 0) > 0
              ? plural(resumo.totalTreinos, "treino", "treinos")
              : "Sem treino"}
          </span>
          <span>
            <Salad size={14} />
            {(resumo?.totalDietas ?? 0) > 0 ? "Dieta ativa" : "Sem dieta"}
          </span>
          <span>
            <BarChart3 size={14} /> {formatarUltimaAvaliacao(resumo?.diasUltimaAvaliacao)}
          </span>
          <span className={temPendencia ? "aluno-pendencia" : "aluno-ok"}>
            {temPendencia ? (
              <>
                <AlertTriangle size={14} /> {textoPendencias(resumo?.pendencias.length ?? 0)}
              </>
            ) : aluno.ativo ? (
              "✓ Tudo em dia"
            ) : (
              "Aluno inativo"
            )}
          </span>
        </div>
      </div>

      <div className="aluno-card-acoes" ref={ref}>
        <button type="button" className="botao-montar" onClick={() => aoSelecionar(aluno)}>
          Ver aluno
        </button>
        <button
          type="button"
          className="botao-menu-card"
          aria-label="Mais ações"
          onClick={() => setMenuAberto(menuAberto === aluno.id ? null : aluno.id)}
        >
          <MoreVertical size={18} />
        </button>

        {menuAberto === aluno.id && (
          <div className="menu-card">
            <button type="button" onClick={() => aoEditar(aluno)}>
              <Edit3 size={14} /> Editar aluno
            </button>
            {aluno.ativo && (
              <>
                <button type="button" onClick={() => aoCriarTreino(aluno)}>
                  <Dumbbell size={14} /> Prescrever treino
                </button>
                <button type="button" onClick={() => aoCriarDieta(aluno)}>
                  <Salad size={14} /> Prescrever dieta
                </button>
                <button type="button" onClick={() => aoCriarAvaliacao(aluno)}>
                  <CalendarPlus size={14} /> Nova avaliação
                </button>
                <button type="button" className="perigo" onClick={aoDesativar}>
                  <Trash2 size={14} /> Desativar aluno
                </button>
              </>
            )}
            {!aluno.ativo && (
              <button type="button" onClick={() => aoReativar(aluno)}>
                <RotateCcw size={14} /> Reativar aluno
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
