import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Hand, LogOut, X } from "lucide-react";

import { api } from "./api/index.js";
import { lerToken, quandoSessaoExpirar } from "./api/client.js";
import AreaDoAluno from "./features/aluno/AreaDoAluno.jsx";
import CriarConta from "./features/auth/CriarConta.jsx";
import Login from "./features/auth/Login.jsx";
import Avatar from "./components/Avatar.jsx";
import BotaoTema from "./components/BotaoTema.jsx";
import Header from "./components/Header.jsx";
import Modal from "./components/Modal.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DetalheAluno from "./features/alunos/DetalheAluno.jsx";
import CriarAvaliacao from "./features/alunos/CriarAvaliacao.jsx";
import FormularioAluno from "./features/alunos/FormularioAluno.jsx";
import ViewAlunos from "./features/alunos/ViewAlunos.jsx";
import ViewAvaliacoes from "./features/alunos/ViewAvaliacoes.jsx";
import CatalogoExercicios from "./features/exercicios/CatalogoExercicios.jsx";
import DetalheExercicio from "./features/exercicios/DetalheExercicio.jsx";
import Home from "./features/inicio/Home.jsx";
import MeuPerfil from "./features/perfil/MeuPerfil.jsx";
import { CONFIG_POR_CHAVE } from "./features/planos/config.js";
import FormularioPlano from "./features/planos/FormularioPlano.jsx";
import ViewPlanos from "./features/planos/ViewPlanos.jsx";
import DetalheTreino from "./features/treinos/DetalheTreino.jsx";

export default function App() {
  // null = ninguém logado; undefined = ainda restaurando a sessão do token.
  const [logado, setLogado] = useState(lerToken() ? undefined : null);
  const [rota, setRota] = useState("inicio/ver");
  // Qual tela aparece para quem não está logado: entrar ou criar conta.
  const [telaAuth, setTelaAuth] = useState("login");
  // Sempre carregamos todos os alunos: as telas de treino/dieta precisam do nome
  // até dos inativos, e o filtro da lista é só de exibição.
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [alunoEmEdicao, setAlunoEmEdicao] = useState(null);
  const [planoEmEdicao, setPlanoEmEdicao] = useState(null);
  const [treinoAberto, setTreinoAberto] = useState(null);
  const [exercicioDetalhado, setExercicioDetalhado] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [erro, setErro] = useState(null);
  // Lê o que o script inline do index.html já decidiu, em vez de recalcular:
  // com `?? "light"`, quem não tem preferência salva e usa o sistema no escuro
  // veria a tela nascer escura e clarear logo depois — o efeito abaixo desfaria
  // a decisão do script.
  const [tema, setTema] = useState(
    () => document.documentElement.dataset.tema ?? "light"
  );

  const carregarAlunos = useCallback(async () => {
    setCarregando(true);
    try {
      setAlunos(await api.alunos.listar(true));
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Token guardado: confirma com a API antes de mostrar o painel.
  useEffect(() => {
    if (logado !== undefined) return;
    api.auth
      .eu()
      .then(setLogado)
      .catch(() => setLogado(null));
  }, [logado]);

  // A API avisa quando o token cai; aqui isso vira "volte para o login".
  useEffect(() => {
    quandoSessaoExpirar(() => setLogado(null));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    localStorage.setItem("fitzpro-tema", tema);
    // A barra do navegador no celular acompanha — senão fica branca por cima
    // da tela escura. Os valores espelham `--fundo` de tokens.css.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", tema === "dark" ? "#0f1217" : "#f8f9fa");
  }, [tema]);

  // Só o personal tem lista de alunos; para o aluno essa chamada daria 403.
  useEffect(() => {
    if (logado?.papel === "PERSONAL") carregarAlunos();
  }, [logado, carregarAlunos]);

  function sair() {
    api.auth.sair();
    setLogado(null);
    setTelaAuth("login");
    setAlunos([]);
    setSelecionado(null);
    setRota("inicio/ver");
  }

  /** Navegar pelo menu sempre sai dos modos de edição — senão o form voltaria preenchido. */
  function navegar(novaRota) {
    setAlunoEmEdicao(null);
    setPlanoEmEdicao(null);
    setTreinoAberto(null);
    setErro(null);
    setMenuAberto(false);
    setRota(novaRota);
  }

  function alternarTema() {
    setTema((atual) => (atual === "dark" ? "light" : "dark"));
  }

  // ---------- alunos ----------

  function editarAluno(aluno) {
    setAlunoEmEdicao(aluno);
    setErro(null);
    setRota("alunos/criar");
  }

  /** Reflete no painel de detalhe a versão nova do aluno selecionado. */
  function sincronizarSelecionado(aluno) {
    setSelecionado((atual) => (atual?.id === aluno.id ? aluno : atual));
  }

  async function salvarAluno(dados) {
    try {
      if (alunoEmEdicao) {
        const atualizado = await api.alunos.atualizar(alunoEmEdicao.id, dados);
        setAlunos((atual) =>
          atual.map((a) => (a.id === atualizado.id ? atualizado : a))
        );
        sincronizarSelecionado(atualizado);
        setAlunoEmEdicao(null);
      } else {
        const criado = await api.alunos.criar(dados);
        setAlunos((atual) => [...atual, criado]);
        setSelecionado(criado);
      }
      setErro(null);
      setRota("alunos/ver");
    } catch (e) {
      setErro(e.message);
    }
  }

  async function desativarAluno(aluno) {
    try {
      await api.alunos.desativar(aluno.id);
      const inativo = { ...aluno, ativo: false };
      setAlunos((atual) => atual.map((a) => (a.id === aluno.id ? inativo : a)));
      sincronizarSelecionado(inativo);
      if (alunoEmEdicao?.id === aluno.id) setAlunoEmEdicao(null);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    }
  }

  async function reativarAluno(aluno) {
    try {
      const reativado = await api.alunos.reativar(aluno.id);
      setAlunos((atual) => atual.map((a) => (a.id === reativado.id ? reativado : a)));
      sincronizarSelecionado(reativado);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    }
  }

  // ---------- treinos e dietas ----------

  function editarPlano(chave, item) {
    setPlanoEmEdicao(item);
    setErro(null);
    setRota(`${chave}/criar`);
  }

  function montarTreino(treino) {
    setTreinoAberto(treino);
    setSelecionado(null); // fecha o modal do aluno, se veio de lá
    setErro(null);
    setRota("treinos/detalhe");
  }

  /** Vindo da home: leva para a lista de alunos com o modal daquele aluno aberto. */
  function abrirAluno(aluno) {
    setErro(null);
    setRota("alunos/ver");
    setSelecionado(aluno);
  }

  /** Devolve false quando a API recusou, para o formulário não se limpar. */
  async function salvarPlano(config, corpo) {
    try {
      if (planoEmEdicao) {
        await config.recurso.atualizar(planoEmEdicao.id, corpo);
        setPlanoEmEdicao(null);
      } else {
        await config.recurso.criar(corpo);
      }
      setErro(null);
      setRota(`${config.chave}/ver`);
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    }
  }

  // ---------- render ----------

  const [secao, pagina] = rota.split("/");
  const config = CONFIG_POR_CHAVE[secao];
  const totalAtivos = alunos.filter((a) => a.ativo).length;
  const alunoDoTreino = treinoAberto
    ? alunos.find((a) => a.id === treinoAberto.aluno_id)
    : null;

  /** Título, subtítulo e ações do Header para a rota atual. */
  function cabecalho() {
    if (secao === "inicio") {
      return {
        titulo: (
          <>
            Olá, {logado.nome.split(" ")[0]}{" "}
            <Hand className="icone-tchau" size={20} aria-hidden="true" />
          </>
        ),
        subtitulo: "O que está acontecendo hoje e o que precisa da sua atenção.",
      };
    }

    if (secao === "exercicios") {
      return {
        titulo: "Catálogo de exercícios",
        subtitulo:
          "873 exercícios do free-exercise-db. Clique na foto para ver as instruções.",
      };
    }

    if (secao === "perfil") {
      return {
        titulo: "Minha conta",
        subtitulo: "Seus dados de acesso ao FitzPRO.",
      };
    }

    if (secao === "avaliacoes") {
      return {
        titulo: pagina === "criar" ? "Criar avaliação" : "Avaliações",
        subtitulo:
          pagina === "criar"
            ? "Registre medidas, observações e acompanhe a evolução do aluno."
            : "Acompanhe medidas e evolução física dos seus alunos.",
        acoes:
          pagina === "criar" ? undefined : (
            <button
              type="button"
              className="primario"
              onClick={() => navegar("avaliacoes/criar")}
            >
              + Nova avaliação
            </button>
          ),
      };
    }

    if (config) {
      if (pagina === "detalhe" && treinoAberto) {
        const partes = [treinoAberto.dia_semana];
        if (alunoDoTreino) partes.push(alunoDoTreino.nome);
        if (treinoAberto.descricao) partes.push(treinoAberto.descricao);
        return {
          titulo: treinoAberto.nome,
          subtitulo: partes.join(" · "),
          acoes: (
            <button type="button" onClick={() => navegar("treinos/ver")}>
              <ArrowLeft size={15} /> voltar
            </button>
          ),
        };
      }
      if (pagina === "criar") {
        const editando = Boolean(planoEmEdicao);
        return {
          titulo: `${editando ? "Editar" : "Criar"} ${config.singular}`,
          subtitulo:
            alunos.length === 0
              ? "Cadastre um aluno antes — todo treino e dieta pertence a alguém."
              : `Escolha o aluno e descreva ${config.artigoIndefinido} ${config.singular}.`,
        };
      }
      return {
        titulo: config.chave === "treinos" ? "Treinos" : "Dietas",
        subtitulo:
          config.chave === "treinos"
            ? "Gerencie e monte os treinos dos seus alunos."
            : "Gerencie os planos alimentares dos seus alunos.",
        acoes:
          config.chave === "treinos" ? (
            <button
              type="button"
              className="primario"
              onClick={() => navegar("treinos/criar")}
            >
              + Novo treino
            </button>
          ) : (
            <button
              type="button"
              className="primario"
              onClick={() => navegar("dietas/criar")}
            >
              + Nova dieta
            </button>
          ),
      };
    }

    if (pagina === "criar") {
        return {
        titulo: alunoEmEdicao ? `Editar ${alunoEmEdicao.nome}` : "Cadastrar aluno",
        subtitulo: alunoEmEdicao
          ? "Alterações valem para os treinos e dietas já vinculados."
          : "Cadastre um novo aluno para começar a montar seus treinos e planejamentos.",
      };
    }

    return {
      titulo: "Alunos",
      subtitulo: "Gerencie seus alunos e acompanhe seus planejamentos.",
      acoes: (
        <button type="button" className="primario" onClick={() => navegar("alunos/criar")}>
          + Novo aluno
        </button>
      ),
    };
  }

  function renderizarConteudo() {
    if (secao === "inicio") {
      return (
        <Home
          alunos={alunos}
          aoAbrirAluno={abrirAluno}
          aoMontarTreino={montarTreino}
          aoErrar={setErro}
        />
      );
    }

    if (secao === "exercicios") {
      return (
        <section className="painel">
          <CatalogoExercicios aoDetalhar={setExercicioDetalhado} aoErrar={setErro} />
        </section>
      );
    }

    if (secao === "perfil") {
      return <MeuPerfil usuario={logado} aoAtualizar={setLogado} aoErrar={setErro} />;
    }

    if (secao === "avaliacoes") {
      if (pagina === "criar") {
        return (
          <CriarAvaliacao
            alunos={alunos}
            aoSalvar={() => setRota("avaliacoes/ver")}
            aoCancelar={() => navegar("avaliacoes/ver")}
            aoErrar={setErro}
          />
        );
      }

      return (
        <ViewAvaliacoes
          alunos={alunos}
          aoAbrirAluno={abrirAluno}
          aoCriar={() => navegar("avaliacoes/criar")}
          aoErrar={setErro}
        />
      );
    }

    if (config) {
      if (pagina === "detalhe" && treinoAberto) {
        return (
          <DetalheTreino
            key={treinoAberto.id}
            treino={treinoAberto}
            aoErrar={setErro}
          />
        );
      }

      if (pagina === "criar") {
        return (
          <section
            className={
              config.chave === "dietas"
                ? "painel painel-formulario-dieta"
                : "painel painel-estreito"
            }
          >
            <FormularioPlano
              key={`${config.chave}-${planoEmEdicao?.id ?? "novo"}`}
              config={config}
              item={planoEmEdicao}
              alunos={alunos}
              aoSalvar={(corpo) => salvarPlano(config, corpo)}
              aoCancelar={() => navegar(`${config.chave}/ver`)}
            />
          </section>
        );
      }

      return (
        <ViewPlanos
          key={config.chave}
          config={config}
          alunos={alunos}
          aoCriar={() => navegar(`${config.chave}/criar`)}
          aoEditar={(item) => editarPlano(config.chave, item)}
          aoAbrir={config.chave === "treinos" ? montarTreino : undefined}
          aoErrar={setErro}
        />
      );
    }

    if (pagina === "criar") {
      return (
        <section className="painel painel-formulario-aluno">
          <FormularioAluno
            aluno={alunoEmEdicao}
            aoSalvar={salvarAluno}
            aoCancelar={() => navegar("alunos/ver")}
          />
        </section>
      );
    }

    return (
      <ViewAlunos
        alunos={alunos}
        carregando={carregando}
        aoCriar={() => navegar("alunos/criar")}
        aoSelecionar={setSelecionado}
        aoEditar={editarAluno}
        aoDesativar={desativarAluno}
        aoReativar={reativarAluno}
        aoCriarTreino={() => navegar("treinos/criar")}
        aoCriarDieta={() => navegar("dietas/criar")}
        aoCriarAvaliacao={() => navegar("avaliacoes/criar")}
        aoErrar={setErro}
      />
    );
  }

  if (logado === undefined) {
    return <div className="tela-login">Carregando...</div>;
  }
  if (!logado) {
    return telaAuth === "criar" ? (
      <CriarConta
        tema={tema}
        aoEntrar={setLogado}
        aoVoltar={() => setTelaAuth("login")}
      />
    ) : (
      <Login tema={tema} aoEntrar={setLogado} aoCriarConta={() => setTelaAuth("criar")} />
    );
  }

  // O aluno tem um app próprio, não o painel do personal com botões escondidos:
  // as tarefas são outras. Tudo abaixo daqui é o painel de quem gerencia.
  if (logado.papel === "ALUNO") {
    return (
      <AreaDoAluno
        aluno={logado}
        tema={tema}
        aoAlternarTema={alternarTema}
        aoSair={sair}
        aoAtualizarPerfil={setLogado}
      />
    );
  }

  const { titulo, subtitulo, acoes } = cabecalho();

  return (
    <div className="shell">
      {menuAberto && (
        <div className="fundo-drawer" onClick={() => setMenuAberto(false)} />
      )}

      <Sidebar
        rotaAtiva={rota}
        aoNavegar={navegar}
        resumo={
          <>
            <button
              type="button"
              className="atalho-conta"
              onClick={() => navegar("perfil/ver")}
            >
              <Avatar usuario={logado} tamanho={34} />
              <span className="atalho-conta-texto">
                <strong>{logado.nome}</strong>
                <span>{logado.email}</span>
              </span>
            </button>
            <button type="button" className="sair" onClick={sair}>
              <LogOut size={14} /> sair
            </button>
          </>
        }
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
      />

      <main className="conteudo">
        <Header
          titulo={titulo}
          subtitulo={subtitulo}
          aoAbrirMenu={() => setMenuAberto(true)}
        >
          <BotaoTema tema={tema} aoAlternar={alternarTema} />
          {acoes}
        </Header>

        <div className="conteudo-corpo">
          {erro && (
            <div className="erro">
              <span>{erro}</span>
              <button onClick={() => setErro(null)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
          )}

          {renderizarConteudo()}

          {/* O aluno abre em modal por cima da lista, que fica em largura total. */}
          {selecionado && (
            <Modal
              titulo={selecionado.nome}
              largo
              aoFechar={() => setSelecionado(null)}
            >
              <DetalheAluno
                aluno={selecionado}
                aoErrar={setErro}
                aoMontarTreino={montarTreino}
              />
            </Modal>
          )}

          {/* Fora do renderizarConteudo: o detalhe do exercício abre por cima de
              qualquer tela (catálogo, treino em montagem). */}
          {exercicioDetalhado && (
            <DetalheExercicio
              exercicioId={exercicioDetalhado}
              aoFechar={() => setExercicioDetalhado(null)}
              aoErrar={setErro}
            />
          )}
        </div>
      </main>
    </div>
  );
}
