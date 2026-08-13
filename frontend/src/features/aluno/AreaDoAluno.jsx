import { useCallback, useEffect, useState } from "react";
import { LogOut, X } from "lucide-react";

import { api } from "../../api/index.js";
import Avatar from "../../components/Avatar.jsx";
import BotaoTema from "../../components/BotaoTema.jsx";
import Header from "../../components/Header.jsx";
import Sidebar from "../../components/Sidebar.jsx";
import CatalogoExercicios from "../exercicios/CatalogoExercicios.jsx";
import DetalheExercicio from "../exercicios/DetalheExercicio.jsx";
import MeuPerfil from "../perfil/MeuPerfil.jsx";
import EvolucaoDoExercicio from "../progressao/EvolucaoDoExercicio.jsx";
import { NAVEGACAO_ALUNO } from "./navegacao.js";
import HojeDoAluno from "./HojeDoAluno.jsx";
import MeuPersonal from "./MeuPersonal.jsx";
import MeusPlanos from "./MeusPlanos.jsx";
import MinhaEvolucao from "./MinhaEvolucao.jsx";

/**
 * O FitzPro visto por quem treina.
 *
 * É um app separado do painel do personal, não o mesmo com botões escondidos:
 * as tarefas são outras. O personal gerencia muitos alunos; o aluno só consulta
 * o que é dele — e não cria, edita nem apaga nada, tirando o próprio cadastro.
 *
 * O isolamento não depende desta tela: a API já força `aluno_id` para o id de
 * quem está logado. Aqui é só a interface que corresponde a essa permissão.
 */
export default function AreaDoAluno({
  aluno,
  tema,
  aoAlternarTema,
  aoSair,
  aoAtualizarPerfil,
}) {
  const [rota, setRota] = useState("inicio/ver");
  const [menuAberto, setMenuAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
  const [erro, setErro] = useState(null);
  const [exercicioDetalhado, setExercicioDetalhado] = useState(null);
  // O exercício cuja evolução de carga está aberta, vindo do "última vez".
  const [cargaAberta, setCargaAberta] = useState(null);

  // Treinos e dietas ficam aqui: a tela de hoje e as de plano usam os mesmos
  // dados, e recarregar a cada navegação piscaria a tela sem necessidade.
  const [treinos, setTreinos] = useState([]);
  const [dietas, setDietas] = useState([]);
  const [personal, setPersonal] = useState(null);
  // Tudo o que a Home mostra, numa chamada só.
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // O treino aberto em modo execução, com a sessão em andamento.
  const [emExecucao, setEmExecucao] = useState(null);

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    // Silencioso ao voltar de uma marcação: os números da listagem se atualizam
    // sem o skeleton reaparecer por baixo do que o aluno acabou de tocar.
    if (!silencioso) setCarregando(true);
    try {
      // A API ignora qualquer aluno_id vindo de um aluno logado e devolve só
      // o que é dele, então não passamos filtro nenhum.
      const [meusTreinos, minhasDietas, meuPersonal, meuResumo] = await Promise.all([
        api.treinos.listar(),
        api.dietas.listar(),
        api.perfil.meuPersonal(),
        // Falha em silêncio: a Home degrada para as listagens em vez de a área
        // inteira do aluno virar uma tela de erro.
        api.progressao.resumo(aluno.id).catch(() => null),
      ]);
      setTreinos(meusTreinos);
      setDietas(minhasDietas);
      setPersonal(meuPersonal);
      setResumo(meuResumo);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [aluno.id]);

  const recarregarSilencioso = useCallback(
    () => carregar({ silencioso: true }),
    [carregar]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * "Iniciar treino": abre a sessão e leva para a lista, onde o aluno marca.
   *
   * A sessão nasce aqui e não na tela de treino porque é a Home que tem o botão
   * — e porque abrir uma sessão fecha a anterior, o que é decisão de nível de
   * app, não de um card.
   */
  async function iniciarTreino(treino) {
    try {
      await api.execucoes.treino.sessoes.iniciar(treino.treino_id);
      setEmExecucao(treino.treino_id);
      await recarregarSilencioso();
      navegar("treinos/ver");
    } catch (e) {
      setErro(e.message);
    }
  }

  function navegar(novaRota) {
    setErro(null);
    setMenuAberto(false);
    setRota(novaRota);
  }

  const [secao] = rota.split("/");

  function cabecalho() {
    const primeiroNome = aluno.nome.split(" ")[0];
    switch (secao) {
      case "treinos":
        return {
          titulo: "Meus treinos",
          subtitulo: "Treinos prescritos.",
        };
      case "dietas":
        return {
          titulo: "Minha dieta",
          subtitulo: "Plano alimentar.",
        };
      case "evolucao":
        return {
          titulo: "Minha evolução",
          subtitulo: "Medidas e evolução.",
        };
      case "exercicios":
        return {
          titulo: "Exercícios",
          subtitulo: "Execução e cargas.",
        };
      case "perfil":
        return { titulo: "Minha conta", titulo2: "", subtitulo: "Conta e acesso." };
      case "personal":
        return {
          titulo: "Meu personal",
          subtitulo: "Contato do personal.",
        };
      default:
        return {
          titulo: `Olá, ${primeiroNome}`,
          subtitulo: "Treino e acompanhamento.",
        };
    }
  }

  function conteudo() {
    switch (secao) {
      case "treinos":
        return (
          <MeusPlanos
            tipo="treinos"
            itens={treinos}
            carregando={carregando}
            aluno={aluno}
            aoErrar={setErro}
            aoRegistrar={recarregarSilencioso}
            aoVerHistorico={(item) => setCargaAberta(item.exercicio_id)}
          />
        );
      case "dietas":
        return (
          <MeusPlanos
            tipo="dietas"
            itens={dietas}
            carregando={carregando}
            aoErrar={setErro}
            aoRegistrar={recarregarSilencioso}
          />
        );
      case "evolucao":
        return <MinhaEvolucao aluno={aluno} aoErrar={setErro} />;
      case "exercicios":
        return (
          <section className="painel">
            <CatalogoExercicios aoDetalhar={setExercicioDetalhado} aoErrar={setErro} />
          </section>
        );
      case "perfil":
        return (
          <MeuPerfil usuario={aluno} aoAtualizar={aoAtualizarPerfil} aoErrar={setErro} />
        );
      case "personal":
        return <MeuPersonal personal={personal ?? resumo?.personal} />;
      default:
        return (
          <HojeDoAluno
            resumo={resumo}
            carregando={carregando}
            aoIniciarTreino={iniciarTreino}
            aoAbrirTreino={() => navegar("treinos/ver")}
            aoAbrirDietas={() => navegar("dietas/ver")}
            aoAbrirEvolucao={() => navegar("evolucao/ver")}
            aoAbrirPersonal={() => navegar("personal/ver")}
          />
        );
    }
  }

  const { titulo, subtitulo } = cabecalho();

  return (
    <div className={`shell${sidebarRecolhida ? " sidebar-recolhida" : ""}`}>
      {menuAberto && (
        <div className="fundo-drawer" onClick={() => setMenuAberto(false)} />
      )}

      <Sidebar
        navegacao={NAVEGACAO_ALUNO}
        rotaAtiva={rota}
        aoNavegar={navegar}
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        recolhida={sidebarRecolhida}
        aoAlternarRecolhida={() => setSidebarRecolhida((atual) => !atual)}
        resumo={
          <>
            <button
              type="button"
              className="atalho-conta"
              onClick={() => navegar("perfil/ver")}
            >
              <Avatar usuario={aluno} tamanho={34} />
              <span className="atalho-conta-texto">
                <strong>{aluno.nome}</strong>
                <span>{aluno.email}</span>
              </span>
            </button>
            <button type="button" className="sair" onClick={aoSair}>
              <LogOut size={14} /> sair
            </button>
          </>
        }
      />

      <main className="conteudo">
        <Header
          titulo={titulo}
          subtitulo={subtitulo}
          aoAbrirMenu={() => setMenuAberto(true)}
        >
          <BotaoTema tema={tema} aoAlternar={aoAlternarTema} />
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

          {conteudo()}

          {cargaAberta && (
            <EvolucaoDoExercicio
              alunoId={aluno.id}
              exercicioId={cargaAberta}
              aoFechar={() => setCargaAberta(null)}
              aoErrar={setErro}
            />
          )}

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
