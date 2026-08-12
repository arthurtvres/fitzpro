import { useCallback, useEffect, useState } from "react";
import { LogOut, X } from "lucide-react";

import { api } from "../../api/index.js";
import Avatar from "../../components/Avatar.jsx";
import Header from "../../components/Header.jsx";
import Sidebar from "../../components/Sidebar.jsx";
import CatalogoExercicios from "../exercicios/CatalogoExercicios.jsx";
import DetalheExercicio from "../exercicios/DetalheExercicio.jsx";
import MeuPerfil from "../perfil/MeuPerfil.jsx";
import { NAVEGACAO_ALUNO } from "./navegacao.js";
import HojeDoAluno from "./HojeDoAluno.jsx";
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
export default function AreaDoAluno({ aluno, aoSair, aoAtualizarPerfil }) {
  const [rota, setRota] = useState("inicio/ver");
  const [menuAberto, setMenuAberto] = useState(false);
  const [erro, setErro] = useState(null);
  const [exercicioDetalhado, setExercicioDetalhado] = useState(null);

  // Treinos e dietas ficam aqui: a tela de hoje e as de plano usam os mesmos
  // dados, e recarregar a cada navegação piscaria a tela sem necessidade.
  const [treinos, setTreinos] = useState([]);
  const [dietas, setDietas] = useState([]);
  const [personal, setPersonal] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // A API ignora qualquer aluno_id vindo de um aluno logado e devolve só
      // o que é dele, então não passamos filtro nenhum.
      const [meusTreinos, minhasDietas, meuPersonal] = await Promise.all([
        api.treinos.listar(),
        api.dietas.listar(),
        api.perfil.meuPersonal(),
      ]);
      setTreinos(meusTreinos);
      setDietas(minhasDietas);
      setPersonal(meuPersonal);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

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
          subtitulo: "O que seu personal montou para você. Toque para ver os exercícios.",
        };
      case "dietas":
        return {
          titulo: "Minha dieta",
          subtitulo: "Seu plano alimentar, refeição por refeição.",
        };
      case "evolucao":
        return {
          titulo: "Minha evolução",
          subtitulo: "Suas medidas ao longo do tempo, como registradas nas avaliações.",
        };
      case "exercicios":
        return {
          titulo: "Exercícios",
          subtitulo: "Consulte a execução de qualquer exercício do catálogo.",
        };
      case "perfil":
        return { titulo: "Minha conta", titulo2: "", subtitulo: "Seus dados de acesso." };
      default:
        return {
          titulo: `Olá, ${primeiroNome}`,
          subtitulo: "Seu treino de hoje e o resumo do seu acompanhamento.",
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
            aoErrar={setErro}
          />
        );
      case "dietas":
        return (
          <MeusPlanos
            tipo="dietas"
            itens={dietas}
            carregando={carregando}
            aoErrar={setErro}
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
      default:
        return (
          <HojeDoAluno
            treinos={treinos}
            dietas={dietas}
            personal={personal}
            carregando={carregando}
            aoAbrirTreinos={() => navegar("treinos/ver")}
            aoAbrirDietas={() => navegar("dietas/ver")}
          />
        );
    }
  }

  const { titulo, subtitulo } = cabecalho();

  return (
    <div className="shell">
      {menuAberto && (
        <div className="fundo-drawer" onClick={() => setMenuAberto(false)} />
      )}

      <Sidebar
        navegacao={NAVEGACAO_ALUNO}
        rotaAtiva={rota}
        aoNavegar={navegar}
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
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
        />

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
