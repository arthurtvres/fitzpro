import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Copy,
  Dumbbell,
  Edit3,
  Flame,
  MoreVertical,
  Salad,
  Search,
  Trash2,
  Utensils,
  User,
} from "lucide-react";

import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { DIAS } from "./config.js";
import { mesmoDia } from "../../utils/dias.js";
import DetalhePlano from "./DetalhePlano.jsx";
import { lerPlanoAlimentar } from "./dietaPlano.js";
import ListaPlanos from "./ListaPlanos.jsx";

/**
 * Tela global "Ver treinos" / "Ver dietas": tudo que existe, com filtro por aluno.
 * Editar sai daqui e vai para a tela de criação em modo edição (mesmo padrão dos alunos).
 */
export default function ViewPlanos({
  config,
  alunos,
  aoCriar,
  aoEditar,
  aoAbrir,
  aoErrar,
}) {
  const recurso = config.recurso;

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroAluno, setFiltroAluno] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroDia, setFiltroDia] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [visualizacao, setVisualizacao] = useState("todos");
  const [menuAberto, setMenuAberto] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);
  const [erroLocal, setErroLocal] = useState(null);

  useEffect(() => {
    let cancelado = false;

    setCarregando(true);
    recurso
      .listar(filtroAluno === "" ? null : Number(filtroAluno))
      .then((lista) => {
        if (!cancelado) setItens(lista);
      })
      .catch((erro) => {
        if (!cancelado) aoErrar(erro.message);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.chave, filtroAluno]);

  const nomeDoAluno = (id) =>
    alunos.find((a) => a.id === id)?.nome ?? `aluno #${id}`;

  async function remover(item) {
    try {
      await recurso.deletar(item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      setConfirmandoExclusao(null);
      aoErrar(null);
    } catch (erro) {
      aoErrar(erro.message);
    }
  }

  if (config.chave === "treinos") {
    return (
      <TreinosPage
        treinos={itens}
        alunos={alunos}
        carregando={carregando}
        busca={busca}
        setBusca={setBusca}
        filtroAluno={filtroAluno}
        setFiltroAluno={setFiltroAluno}
        filtroDia={filtroDia}
        setFiltroDia={setFiltroDia}
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        visualizacao={visualizacao}
        setVisualizacao={setVisualizacao}
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        confirmandoExclusao={confirmandoExclusao}
        setConfirmandoExclusao={setConfirmandoExclusao}
        erroLocal={erroLocal}
        setErroLocal={setErroLocal}
        aoEditar={aoEditar}
        aoCriar={aoCriar}
        aoAbrir={aoAbrir}
        aoRemover={remover}
        aoDuplicar={async (treino) => {
          try {
            const criado = await recurso.criar({
              nome: `${treino.nome} (cópia)`,
              dia_semana: treino.dia_semana,
              descricao: treino.descricao ?? "",
              aluno_id: treino.aluno_id,
            });

            const exercicios = await recurso.exercicios.listar(treino.id);
            for (const item of exercicios) {
              await recurso.exercicios.adicionar(criado.id, {
                exercicio_id: item.exercicio_id,
                series: item.series,
                repeticoes: item.repeticoes,
                carga_kg: item.carga_kg,
                descanso_segundos: item.descanso_segundos,
                observacao: item.observacao,
              });
            }

            setItens((atual) => [
              ...atual,
              { ...criado, total_exercicios: exercicios.length },
            ]);
            setMenuAberto(null);
            setErroLocal(null);
            aoErrar(null);
          } catch (erro) {
            aoErrar(erro.message);
          }
        }}
        aoArquivar={() => {
          setMenuAberto(null);
          setErroLocal("Arquivar treino ainda precisa de suporte no backend.");
        }}
      />
    );
  }

  if (config.chave === "dietas") {
    return (
      <DietasPage
        config={config}
        dietas={itens}
        alunos={alunos}
        carregando={carregando}
        busca={busca}
        setBusca={setBusca}
        filtroAluno={filtroAluno}
        setFiltroAluno={setFiltroAluno}
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        confirmandoExclusao={confirmandoExclusao}
        setConfirmandoExclusao={setConfirmandoExclusao}
        aoCriar={aoCriar}
        aoEditar={aoEditar}
        aoRemover={remover}
        aoErrar={aoErrar}
      />
    );
  }

  return (
    <section className="painel">
      <div className="barra-acoes">
        <h2 style={{ margin: 0 }}>
          {carregando ? "Carregando" : `${itens.length} ${config.chave}`}
        </h2>
        <label className="filtro">
          <span>Aluno:</span>
          <select value={filtroAluno} onChange={(e) => setFiltroAluno(e.target.value)}>
            <option value="">todos</option>
            {alunos.map((aluno) => (
              <option key={aluno.id} value={String(aluno.id)}>
                {aluno.nome}
                {aluno.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ListaPlanos
        config={config}
        itens={itens}
        carregando={carregando}
        nomeDoAluno={nomeDoAluno}
        aoEditar={aoEditar}
        aoAbrir={aoAbrir}
        aoRemover={remover}
        textoVazio={
          filtroAluno === ""
            ? `${config.textoVazio} ainda.`
            : `${config.textoVazio} para ${nomeDoAluno(Number(filtroAluno))}.`
        }
      />
    </section>
  );
}

const pluralExercicios = (total) =>
  `${total} ${total === 1 ? "exercício" : "exercícios"}`;

const pluralDietas = (total) => `${total} ${total === 1 ? "dieta" : "dietas"}`;

const pluralRefeicoes = (total) =>
  `${total} ${total === 1 ? "refeição" : "refeições"}`;

const numeroPtBR = (valor) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(valor || 0));

const macro = (valor, prefixo) => (valor ? `${prefixo} ${valor}g` : null);

function resumoDieta(dieta) {
  const plano = lerPlanoAlimentar(dieta.descricao);
  return {
    plano,
    refeicoes: plano?.refeicoes?.length ?? 0,
    proteinas: plano?.proteinas ?? "",
    carboidratos: plano?.carboidratos ?? "",
    gorduras: plano?.gorduras ?? "",
  };
}

const statusDoTreino = (treino) =>
  Number(treino.total_exercicios ?? 0) > 0 ? "completo" : "sem";

const rotuloDia = (dia) =>
  ({
    segunda: "Segunda-feira",
    terça: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sábado: "Sábado",
    domingo: "Domingo",
  })[dia] ?? dia;

function DietasPage({
  config,
  dietas,
  alunos,
  carregando,
  busca,
  setBusca,
  filtroAluno,
  setFiltroAluno,
  menuAberto,
  setMenuAberto,
  confirmandoExclusao,
  setConfirmandoExclusao,
  aoCriar,
  aoEditar,
  aoRemover,
  aoErrar,
}) {
  const [visualizando, setVisualizando] = useState(null);
  const nomeDoAluno = (id) =>
    alunos.find((aluno) => aluno.id === id)?.nome ?? `Aluno #${id}`;

  const dietasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dietas.filter((dieta) => {
      const aluno = nomeDoAluno(dieta.aluno_id);
      const bateBusca =
        termo === "" ||
        dieta.nome.toLowerCase().includes(termo) ||
        aluno.toLowerCase().includes(termo);
      const bateAluno = filtroAluno === "" || String(dieta.aluno_id) === filtroAluno;
      return bateBusca && bateAluno;
    });
  }, [dietas, busca, filtroAluno, alunos]);

  return (
    <section className="dietas-page">
      <div className="dietas-toolbar">
        <div className="campo-busca">
          <span className="lupa" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar dieta ou aluno..."
          />
        </div>

        <select value={filtroAluno} onChange={(e) => setFiltroAluno(e.target.value)}>
          <option value="">Todos os alunos</option>
          {alunos.map((aluno) => (
            <option key={aluno.id} value={String(aluno.id)}>
              {aluno.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="treinos-resumo">
        <span>{carregando ? "Carregando dietas" : pluralDietas(dietasFiltradas.length)}</span>
      </div>

      {carregando ? (
        <div className="dietas-lista">
          <Skeleton quantidade={4} />
        </div>
      ) : dietas.length === 0 ? (
        <Vazio icone={Salad}>
          <strong>Nenhuma dieta cadastrada</strong>
          <span>Crie um plano alimentar para começar a organizar as refeições do aluno.</span>
          <button type="button" className="primario" onClick={aoCriar}>
            + Prescrever dieta
          </button>
        </Vazio>
      ) : dietasFiltradas.length === 0 ? (
        <Vazio icone={Search}>Nenhuma dieta encontrada para esses filtros.</Vazio>
      ) : (
        <div className="dietas-lista">
          {dietasFiltradas.map((dieta) => (
            <DietaCard
              key={dieta.id}
              dieta={dieta}
              aluno={nomeDoAluno(dieta.aluno_id)}
              menuAberto={menuAberto}
              setMenuAberto={setMenuAberto}
              aoVisualizar={setVisualizando}
              aoEditar={aoEditar}
              aoExcluir={() => setConfirmandoExclusao(dieta)}
            />
          ))}
        </div>
      )}

      {visualizando && (
        <Modal
          titulo={visualizando.nome}
          largo
          aoFechar={() => setVisualizando(null)}
        >
          <DetalhePlano
            config={config}
            item={visualizando}
            aluno={nomeDoAluno(visualizando.aluno_id)}
            aoEditar={() => {
              setVisualizando(null);
              aoEditar(visualizando);
            }}
            aoErrar={aoErrar}
          />
        </Modal>
      )}

      {confirmandoExclusao && (
        <Modal titulo="Excluir dieta" aoFechar={() => setConfirmandoExclusao(null)}>
          <div className="confirmacao-exclusao">
            <p>
              Tem certeza que deseja excluir <strong>{confirmandoExclusao.nome}</strong>?
              Esse plano alimentar deixará de aparecer para o aluno.
            </p>
            <div className="acoes-form">
              <button type="button" onClick={() => setConfirmandoExclusao(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="perigo"
                onClick={() => aoRemover(confirmandoExclusao)}
              >
                Excluir dieta
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DietaCard({
  dieta,
  aluno,
  menuAberto,
  setMenuAberto,
  aoVisualizar,
  aoEditar,
  aoExcluir,
}) {
  const ref = useRef(null);
  const resumo = resumoDieta(dieta);
  const macros = [
    macro(resumo.proteinas, "P"),
    macro(resumo.carboidratos, "C"),
    macro(resumo.gorduras, "G"),
  ].filter(Boolean);

  useEffect(() => {
    if (menuAberto !== dieta.id) return;
    const aoClicar = (evento) => {
      if (!ref.current?.contains(evento.target)) setMenuAberto(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [menuAberto, dieta.id, setMenuAberto]);

  return (
    <article className="dieta-card">
      <div className="dieta-card-corpo">
        <div className="dieta-card-titulo">
          <h3>{dieta.nome}</h3>
        </div>

        <div className="dieta-aluno">
          <User size={14} /> {aluno}
        </div>

        <div className="dieta-meta">
          <span>
            <Flame size={14} /> {numeroPtBR(dieta.calorias)} kcal
          </span>
          <span>
            <Utensils size={14} /> {pluralRefeicoes(resumo.refeicoes)}
          </span>
          {macros.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="dieta-acoes" ref={ref}>
        <button type="button" className="botao-montar" onClick={() => aoVisualizar(dieta)}>
          Ver dieta
        </button>
        <button type="button" className="link" onClick={() => aoEditar(dieta)}>
          <Edit3 size={14} /> Editar
        </button>
        <button
          type="button"
          className="botao-menu-card"
          aria-label="Mais ações"
          onClick={() => setMenuAberto(menuAberto === dieta.id ? null : dieta.id)}
        >
          <MoreVertical size={18} />
        </button>

        {menuAberto === dieta.id && (
          <div className="menu-card">
            <button type="button" onClick={() => aoEditar(dieta)}>
              <Edit3 size={14} /> Editar
            </button>
            <button type="button" className="perigo" onClick={aoExcluir}>
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function TreinosPage({
  treinos,
  alunos,
  carregando,
  busca,
  setBusca,
  filtroAluno,
  setFiltroAluno,
  filtroDia,
  setFiltroDia,
  filtroStatus,
  setFiltroStatus,
  visualizacao,
  setVisualizacao,
  menuAberto,
  setMenuAberto,
  confirmandoExclusao,
  setConfirmandoExclusao,
  erroLocal,
  setErroLocal,
  aoEditar,
  aoCriar,
  aoAbrir,
  aoRemover,
  aoDuplicar,
  aoArquivar,
}) {
  const nomeDoAluno = (id) =>
    alunos.find((aluno) => aluno.id === id)?.nome ?? `Aluno #${id}`;

  const treinosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return treinos.filter((treino) => {
      const aluno = nomeDoAluno(treino.aluno_id);
      const total = Number(treino.total_exercicios ?? 0);
      const status = statusDoTreino(treino);
      const bateBusca =
        termo === "" ||
        treino.nome.toLowerCase().includes(termo) ||
        aluno.toLowerCase().includes(termo);
      const bateAluno = filtroAluno === "" || String(treino.aluno_id) === filtroAluno;
      // Comparar com `===` perdia treinos gravados com outra grafia.
      const bateDia = filtroDia === "" || mesmoDia(treino.dia_semana, filtroDia);
      const bateStatus =
        filtroStatus === "" ||
        (filtroStatus === "completo" && status === "completo") ||
        (filtroStatus === "incompleto" && total === 0) ||
        (filtroStatus === "sem" && total === 0);

      return bateBusca && bateAluno && bateDia && bateStatus;
    });
  }, [treinos, busca, filtroAluno, filtroDia, filtroStatus, alunos]);

  const grupos = useMemo(() => {
    const porAluno = new Map();
    for (const treino of treinosFiltrados) {
      const nome = nomeDoAluno(treino.aluno_id);
      if (!porAluno.has(treino.aluno_id)) {
        porAluno.set(treino.aluno_id, { alunoId: treino.aluno_id, nome, treinos: [] });
      }
      porAluno.get(treino.aluno_id).treinos.push(treino);
    }
    return Array.from(porAluno.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [treinosFiltrados, alunos]);

  return (
    <section className="treinos-page">
      <div className="treinos-toolbar">
        <div className="campo-busca treino-busca">
          <span className="lupa" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar treino ou aluno..."
          />
        </div>

        <select value={filtroAluno} onChange={(e) => setFiltroAluno(e.target.value)}>
          <option value="">Todos os alunos</option>
          {alunos.map((aluno) => (
            <option key={aluno.id} value={String(aluno.id)}>
              {aluno.nome}
            </option>
          ))}
        </select>

        <select value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)}>
          <option value="">Todos os dias</option>
          {DIAS.map((dia) => (
            <option key={dia} value={dia}>
              {rotuloDia(dia)}
            </option>
          ))}
        </select>

        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="completo">Completo</option>
          <option value="incompleto">Incompleto</option>
          <option value="sem">Sem exercícios</option>
        </select>
      </div>

      <div className="treinos-resumo">
        <span>
          {carregando
            ? "Carregando treinos"
            : `${treinosFiltrados.length} treinos cadastrados`}
        </span>
        <div className="controle-segmentado">
          <button
            type="button"
            className={visualizacao === "todos" ? "ativo" : ""}
            onClick={() => setVisualizacao("todos")}
          >
            Todos os treinos
          </button>
          <button
            type="button"
            className={visualizacao === "aluno" ? "ativo" : ""}
            onClick={() => setVisualizacao("aluno")}
          >
            Agrupar por aluno
          </button>
        </div>
      </div>

      {erroLocal && (
        <div className="aviso-inline">
          <span>{erroLocal}</span>
          <button type="button" className="link" onClick={() => setErroLocal(null)}>
            fechar
          </button>
        </div>
      )}

      {carregando ? (
        <TreinosSkeleton />
      ) : treinos.length === 0 ? (
        <Vazio icone={Dumbbell}>
          <strong>Nenhum treino cadastrado</strong>
          <span>Crie o primeiro treino para começar a montar os exercícios dos seus alunos.</span>
          <button type="button" className="primario" onClick={aoCriar}>
            + Prescrever treino
          </button>
        </Vazio>
      ) : treinosFiltrados.length === 0 ? (
        <Vazio icone={Search}>Nenhum treino encontrado para esses filtros.</Vazio>
      ) : visualizacao === "aluno" ? (
        <div className="treinos-grupos">
          {grupos.map((grupo) => (
            <section key={grupo.alunoId} className="grupo-aluno-treinos">
              <div className="grupo-aluno-topo">
                <h2>{grupo.nome}</h2>
                <span>{pluralExercicios(grupo.treinos.length).replace("exercício", "treino")}</span>
              </div>
              <div className="treinos-lista">
                {grupo.treinos.map((treino) => (
                  <TreinoCard
                    key={treino.id}
                    treino={treino}
                    aluno={nomeDoAluno(treino.aluno_id)}
                    mostrarAluno={false}
                    menuAberto={menuAberto}
                    setMenuAberto={setMenuAberto}
                    aoAbrir={aoAbrir}
                    aoEditar={aoEditar}
                    aoDuplicar={aoDuplicar}
                    aoArquivar={aoArquivar}
                    aoExcluir={() => setConfirmandoExclusao(treino)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="treinos-lista">
          {treinosFiltrados.map((treino) => (
            <TreinoCard
              key={treino.id}
              treino={treino}
              aluno={nomeDoAluno(treino.aluno_id)}
              mostrarAluno
              menuAberto={menuAberto}
              setMenuAberto={setMenuAberto}
              aoAbrir={aoAbrir}
              aoEditar={aoEditar}
              aoDuplicar={aoDuplicar}
              aoArquivar={aoArquivar}
              aoExcluir={() => setConfirmandoExclusao(treino)}
            />
          ))}
        </div>
      )}

      {confirmandoExclusao && (
        <Modal
          titulo="Excluir treino"
          aoFechar={() => setConfirmandoExclusao(null)}
        >
          <div className="confirmacao-exclusao">
            <p>
              Tem certeza que deseja excluir <strong>{confirmandoExclusao.nome}</strong>?
              Os exercícios montados nesse treino também serão removidos.
            </p>
            <div className="acoes-form">
              <button type="button" onClick={() => setConfirmandoExclusao(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="perigo"
                onClick={() => aoRemover(confirmandoExclusao)}
              >
                Excluir treino
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function TreinoCard({
  treino,
  aluno,
  mostrarAluno = true,
  menuAberto,
  setMenuAberto,
  aoAbrir,
  aoEditar,
  aoDuplicar,
  aoArquivar,
  aoExcluir,
}) {
  const ref = useRef(null);
  const total = Number(treino.total_exercicios ?? 0);
  const completo = total > 0;

  useEffect(() => {
    if (menuAberto !== treino.id) return;
    const aoClicar = (evento) => {
      if (!ref.current?.contains(evento.target)) setMenuAberto(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [menuAberto, treino.id, setMenuAberto]);

  return (
    <article className={`treino-card${completo ? "" : " incompleto"}`}>
      <div className="treino-card-corpo">
        <div className="treino-card-titulo">
          <h3>{treino.nome}</h3>
          <span className={`badge-status ${completo ? "completo" : "incompleto"}`}>
            {completo ? "Completo" : "Incompleto"}
          </span>
        </div>

        <div className="treino-meta">
          {mostrarAluno && (
            <span>
              <User size={14} /> {aluno}
            </span>
          )}
          <span>
            <CalendarDays size={14} /> {rotuloDia(treino.dia_semana)}
          </span>
          <span>
            <Dumbbell size={14} /> {pluralExercicios(total)}
          </span>
        </div>

        {treino.descricao && <p>{treino.descricao}</p>}
      </div>

      <div className="treino-acoes" ref={ref}>
        <button type="button" className="botao-montar" onClick={() => aoAbrir(treino)}>
          Montar treino
        </button>
        <button type="button" className="link" onClick={() => aoEditar(treino)}>
          <Edit3 size={14} /> Editar
        </button>
        <button
          type="button"
          className="botao-menu-card"
          aria-label="Mais ações"
          onClick={() => setMenuAberto(menuAberto === treino.id ? null : treino.id)}
        >
          <MoreVertical size={18} />
        </button>

        {menuAberto === treino.id && (
          <div className="menu-card">
            <button type="button" onClick={() => aoDuplicar(treino)}>
              <Copy size={14} /> Duplicar treino
            </button>
            <button type="button" onClick={() => aoEditar(treino)}>
              <Edit3 size={14} /> Editar
            </button>
            <button type="button" onClick={aoArquivar}>
              Arquivar
            </button>
            <button type="button" className="perigo" onClick={aoExcluir}>
              <Trash2 size={14} /> Excluir treino
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function TreinosSkeleton() {
  return (
    <div className="treinos-lista">
      <Skeleton quantidade={4} />
    </div>
  );
}
