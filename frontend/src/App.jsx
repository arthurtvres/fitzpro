import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Hand, LogOut, X } from "lucide-react";

import { api } from "./api/index.js";
import { lerToken, quandoSessaoExpirar } from "./api/client.js";
import AreaDoAluno from "./features/aluno/AreaDoAluno.jsx";
import AceitarConvite from "./features/auth/AceitarConvite.jsx";
import CriarConta from "./features/auth/CriarConta.jsx";
import EsqueciSenha from "./features/auth/EsqueciSenha.jsx";
import Login from "./features/auth/Login.jsx";
import RedefinirSenha from "./features/auth/RedefinirSenha.jsx";
import Avatar from "./components/Avatar.jsx";
import BotaoTema from "./components/BotaoTema.jsx";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import CriarAvaliacao from "./features/alunos/CriarAvaliacao.jsx";
import FormularioAluno from "./features/alunos/FormularioAluno.jsx";
import PaginaDoAluno from "./features/alunos/PaginaDoAluno.jsx";
import ViewAlunos from "./features/alunos/ViewAlunos.jsx";
import ViewAvaliacoes from "./features/alunos/ViewAvaliacoes.jsx";
import CatalogoExercicios from "./features/exercicios/CatalogoExercicios.jsx";
import DetalheExercicio from "./features/exercicios/DetalheExercicio.jsx";
import Home from "./features/inicio/Home.jsx";
import PaginaLegal from "./features/legal/PaginaLegal.jsx";
import ReaceitarTermos from "./features/legal/ReaceitarTermos.jsx";
import PainelDoPersonal from "./features/painel/PainelDoPersonal.jsx";
import MeuPerfil from "./features/perfil/MeuPerfil.jsx";
import { CONFIG_POR_CHAVE } from "./features/planos/config.js";
import FormularioPlano from "./features/planos/FormularioPlano.jsx";
import ViewPlanos from "./features/planos/ViewPlanos.jsx";
import DetalheTreino from "./features/treinos/DetalheTreino.jsx";

export default function App() {
  // null = ninguém logado; undefined = ainda restaurando a sessão do token.
  const [logado, setLogado] = useState(lerToken() ? undefined : null);

  // A rota vive na URL. `rota` continua sendo a string "secao/pagina" que a
  // sidebar e o `cabecalho()` sempre leram — só que derivada do endereço, e não
  // guardada em estado. Trocar a fonte, e não o formato, é o que deixou o resto
  // do arquivo praticamente intacto nesta migração.
  const local = useLocation();
  const irPara = useNavigate();
  const rota = local.pathname.replace(/^\/+|\/+$/g, "") || "inicio/ver";
  const setRota = (nova) => irPara(`/${nova}`);
  // Qual tela aparece para quem não está logado: entrar ou criar conta.
  const [telaAuth, setTelaAuth] = useState("login");
  // Sempre carregamos todos os alunos: as telas de treino/dieta precisam do nome
  // até dos inativos, e o filtro da lista é só de exibição.
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [alunoEmEdicao, setAlunoEmEdicao] = useState(null);
  const [planoEmEdicao, setPlanoEmEdicao] = useState(null);
  const [treinoAberto, setTreinoAberto] = useState(null);
  const [exercicioDetalhado, setExercicioDetalhado] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
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

  /**
   * Abre o formulário com o cadastro **completo**, buscado por id.
   *
   * O item que vem da lista é um resumo (ver `resumo()` no backend) e não tem
   * nascimento, sexo nem endereço. Preencher o formulário com ele deixaria
   * esses campos em branco, e salvar apagaria o que não veio — o formulário
   * manda o objeto inteiro, não só o que mudou.
   */
  async function editarAluno(aluno) {
    setErro(null);
    setAlunoEmEdicao(aluno);
    setRota("alunos/criar");
    try {
      setAlunoEmEdicao(await api.alunos.buscar(aluno.id));
    } catch (e) {
      setErro(e.message);
    }
  }

  async function salvarAluno(dados) {
    try {
      if (alunoEmEdicao) {
        const atualizado = await api.alunos.atualizar(alunoEmEdicao.id, dados);
        setAlunos((atual) =>
          atual.map((a) => (a.id === atualizado.id ? atualizado : a))
        );
        setAlunoEmEdicao(null);
        // Volta para a ficha de quem foi editado, e não para a lista: quase
        // sempre se chega ao formulário a partir dela, e é lá que a alteração
        // aparece. Salvar não deveria custar a navegação de volta.
        setErro(null);
        setRota(`alunos/${atualizado.id}`);
        return;
      }

      const criado = await api.alunos.criar(dados);
      setAlunos((atual) => [...atual, criado]);
      // Cadastrou: cai direto na ficha de quem acabou de criar, que é onde
      // faltam treino e dieta.
      setErro(null);
      setRota(`alunos/${criado.id}`);
    } catch (e) {
      setErro(e.message);
    }
  }

  async function desativarAluno(aluno) {
    try {
      await api.alunos.desativar(aluno.id);
      const inativo = { ...aluno, ativo: false };
      setAlunos((atual) => atual.map((a) => (a.id === aluno.id ? inativo : a)));
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
    setErro(null);
    setRota("treinos/detalhe");
  }

  /** Home, acompanhamento, avaliações: todos levam para a página do aluno. */
  function abrirAluno(aluno) {
    setErro(null);
    setRota(`alunos/${aluno.id}`);
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
  // /alunos/12 — "ver" e "criar" ja ocupam esse lugar, entao so numero conta.
  const alunoIdDaRota =
    secao === "alunos" && /^\d+$/.test(pagina ?? "") ? Number(pagina) : null;
  // A lista costuma estar carregada; quando esta, a ficha aparece sem spinner.
  const alunoDaRota = alunoIdDaRota
    ? alunos.find((a) => a.id === alunoIdDaRota)
    : null;
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
        subtitulo: "Resumo do dia.",
      };
    }

    if (secao === "acompanhamento") {
      return {
        titulo: "Acompanhamento",
        subtitulo: "Desempenho e atividade dos seus alunos.",
      };
    }

    if (secao === "exercicios") {
      return {
        titulo: "Catálogo de exercícios",
        subtitulo: "Exercícios e instruções.",
      };
    }

    if (secao === "perfil") {
      return {
        titulo: "Minha conta",
        subtitulo: "Conta, senha e plano.",
      };
    }

    if (secao === "avaliacoes") {
      return {
        titulo: pagina === "criar" ? "Nova avaliação" : "Avaliações",
        subtitulo:
          pagina === "criar"
            ? "Medidas e evolução."
            : "Histórico corporal.",
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
              <ArrowLeft size={15} /> Voltar
            </button>
          ),
        };
      }
      if (pagina === "criar") {
        const editando = Boolean(planoEmEdicao);
        const acaoNovo =
          config.chave === "treinos" ? "Prescrever treino" : "Prescrever dieta";
        return {
          titulo: editando ? `Editar ${config.singular}` : acaoNovo,
          subtitulo:
            alunos.length === 0
              ? "Cadastre um aluno antes."
              : config.chave === "treinos"
                ? "Aluno e rotina."
                : "Aluno e plano alimentar.",
        };
      }
      return {
        titulo: config.chave === "treinos" ? "Treinos" : "Dietas",
        subtitulo:
          config.chave === "treinos"
            ? "Treinos prescritos."
            : "Dietas prescritas.",
        acoes:
          config.chave === "treinos" ? (
            <button
              type="button"
              className="primario"
              onClick={() => navegar("treinos/criar")}
            >
              + Prescrever treino
            </button>
          ) : (
            <button
              type="button"
              className="primario"
              onClick={() => navegar("dietas/criar")}
            >
              + Prescrever dieta
            </button>
          ),
      };
    }

    if (alunoIdDaRota) {
      return {
        titulo: alunoDaRota?.nome ?? "Aluno",
        subtitulo: alunoDaRota?.objetivo || "Ficha do aluno.",
        acoes: (
          <button type="button" onClick={() => navegar("alunos/ver")}>
            <ArrowLeft size={15} /> Voltar
          </button>
        ),
      };
    }

    if (pagina === "criar") {
        return {
        titulo: alunoEmEdicao ? `Editar ${alunoEmEdicao.nome}` : "Cadastrar aluno",
        subtitulo: alunoEmEdicao
          ? "Cadastro do aluno."
          : "Novo aluno.",
      };
    }

    return {
      titulo: "Alunos",
      subtitulo: "Cadastros e planos.",
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

    if (secao === "acompanhamento") {
      return (
        <PainelDoPersonal
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
                : "painel painel-formulario-treino"
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

    if (alunoIdDaRota) {
      return (
        <PaginaDoAluno
          key={alunoIdDaRota}
          alunoId={alunoIdDaRota}
          aoErrar={setErro}
          aoMontarTreino={montarTreino}
          aoEditar={editarAluno}
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
        aoSelecionar={abrirAluno}
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

  // Antes de qualquer verificação de sessão: os documentos legais são públicos
  // e precisam abrir para quem ainda não tem conta — o checkbox de aceite no
  // cadastro e no convite aponta para cá. Ficam também acessíveis a quem já
  // está logado, sem o shell, porque a leitura é a mesma.
  if (rota === "termos" || rota === "privacidade") {
    return (
      <PaginaLegal
        documento={rota}
        aoVoltar={() => (window.history.length > 1 ? irPara(-1) : irPara("/"))}
      />
    );
  }

  if (logado === undefined) {
    return <div className="tela-login">Carregando...</div>;
  }
  if (!logado) {
    // Estas duas vêm da URL, e não do `telaAuth`: o link do e-mail chega de
    // fora, num navegador que nunca viu este app, e o token viaja na query.
    if (rota === "redefinir") {
      return (
        <RedefinirSenha
          tema={tema}
          token={new URLSearchParams(local.search).get("token") ?? ""}
          aoEntrar={(usuario) => {
            setLogado(usuario);
            // `replace`: o endereço com o token sai do histórico. Ele já foi
            // consumido, então voltar para ele só daria "link inválido" — e um
            // token de senha não fica na barra depois de usado.
            irPara("/", { replace: true });
          }}
          aoVoltar={() => irPara("/", { replace: true })}
        />
      );
    }
    if (rota === "convite") {
      return (
        <AceitarConvite
          tema={tema}
          token={new URLSearchParams(local.search).get("token") ?? ""}
          aoEntrar={(usuario) => {
            setLogado(usuario);
            irPara("/", { replace: true });
          }}
          aoVoltar={() => irPara("/", { replace: true })}
        />
      );
    }
    if (rota === "esqueci-senha") {
      return <EsqueciSenha tema={tema} aoVoltar={() => irPara("/")} />;
    }

    return telaAuth === "criar" ? (
      <CriarConta
        tema={tema}
        aoEntrar={setLogado}
        aoVoltar={() => setTelaAuth("login")}
      />
    ) : (
      <Login
        tema={tema}
        aoEntrar={setLogado}
        aoCriarConta={() => setTelaAuth("criar")}
        aoEsquecerSenha={() => irPara("/esqueci-senha")}
      />
    );
  }

  // Antes de escolher o app: os termos valem para os dois papéis. Fica **depois**
  // das páginas legais, que são públicas — senão a pessoa não conseguiria ler o
  // que está sendo pedida para aceitar.
  if (logado.termos_pendentes) {
    return (
      <ReaceitarTermos
        tema={tema}
        usuario={logado}
        aoAceitar={setLogado}
        aoSair={sair}
      />
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
    <div className={`shell${sidebarRecolhida ? " sidebar-recolhida" : ""}`}>
      {menuAberto && (
        <div className="fundo-drawer" onClick={() => setMenuAberto(false)} />
      )}

      <Sidebar
        // A página de um aluno pertence à seção Alunos: sem isto o menu
        // fecharia o grupo e apagaria o destaque ao abrir alguém.
        rotaAtiva={alunoIdDaRota ? "alunos/ver" : rota}
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
        recolhida={sidebarRecolhida}
        aoAlternarRecolhida={() => setSidebarRecolhida((atual) => !atual)}
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
