import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Dumbbell, Play } from "lucide-react";

import { api } from "../../api/index.js";
import Badge from "../../components/Badge.jsx";
import BarraProgresso from "../../components/BarraProgresso.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { DIAS, ROTULOS, SIGLAS, normalizar } from "../../utils/dias.js";
import { contar, dataCurta, minutos } from "./home/formato.js";

/**
 * Agrupa os treinos por dia da semana, na ordem da semana.
 *
 * Só entram dias que têm treino: uma grade fixa de sete títulos deixaria a tela
 * cheia de seções vazias, que é justamente o vazio que esta tela veio corrigir.
 * Dia fora da lista canônica (dado antigo) cai num grupo próprio no fim, em vez
 * de sumir da tela — é melhor mostrar estranho do que esconder.
 */
function agruparPorDia(treinos) {
  const grupos = new Map();
  for (const treino of treinos) {
    const dia = normalizar(treino.dia_semana) ?? treino.dia_semana ?? "";
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(treino);
  }

  const posicao = (dia) => (DIAS.includes(dia) ? DIAS.indexOf(dia) : DIAS.length);
  return [...grupos.entries()]
    .sort(([a], [b]) => posicao(a) - posicao(b))
    .map(([dia, itens]) => ({
      dia,
      rotulo: (ROTULOS[dia] ?? dia).toUpperCase(),
      itens,
    }));
}

/**
 * O que a ação faz depende do estado, e o rótulo tem que dizer a verdade.
 *
 * "Iniciar" abre uma sessão antes de entrar no treino; "Continuar" e "Ver" só
 * entram — a sessão já existe, ou não há o que abrir.
 */
function acaoDoCartao(treino) {
  if (treino.estado === "em_andamento") {
    return { rotulo: "Continuar treino", iniciar: false, icone: Play };
  }
  if (treino.estado === "concluido_hoje") {
    return { rotulo: "Ver detalhes", iniciar: false, icone: null };
  }
  if (treino.e_de_hoje) {
    return { rotulo: "Iniciar treino", iniciar: true, icone: Play };
  }
  return { rotulo: "Ver treino", iniciar: false, icone: null };
}

/** A linha de estado: o que o aluno já fez neste treino. */
function Estado({ treino }) {
  if (treino.estado === "concluido_hoje") {
    return (
      <p className="estado-treino concluido">
        <CheckCircle2 size={15} aria-hidden="true" />
        Concluído hoje
        {treino.ultima_vez?.duracao_segundos
          ? ` · ${minutos(treino.ultima_vez.duracao_segundos)}`
          : ""}
      </p>
    );
  }

  if (treino.estado === "em_andamento") {
    return (
      <div className="estado-treino andamento">
        <p>
          Em andamento · {treino.concluidos_hoje}/{treino.total_exercicios} exercícios
        </p>
        <BarraProgresso valor={treino.concluidos_hoje} total={treino.total_exercicios} />
      </div>
    );
  }

  if (!treino.ultima_vez) {
    return <p className="estado-treino sub">Ainda não realizado</p>;
  }

  // Data, séries e duração, nesta ordem: "quando" é a pergunta, o resto é
  // contexto. Duração some quando a sessão fechou sem relógio — nulo ali é
  // "não sei", e inventar um número seria pior que omitir.
  const partes = [
    dataCurta(treino.ultima_vez.data),
    contar(treino.ultima_vez.exercicios ?? treino.total_exercicios, "exercício"),
    treino.ultima_vez.series ? contar(treino.ultima_vez.series, "série") : null,
    treino.ultima_vez.duracao_segundos
      ? minutos(treino.ultima_vez.duracao_segundos)
      : null,
  ].filter(Boolean);

  return (
    <p className="estado-treino">
      <span className="rotulo-estado">Última vez</span>
      {partes.join(" · ")}
    </p>
  );
}

/** "4 exercícios · ~45 min" — o `~` só quando o tempo é palpite, não relógio. */
function linhaResumo(treino) {
  const partes = [contar(treino.total_exercicios, "exercício")];
  if (treino.duracao.segundos) {
    partes.push(
      `${treino.duracao.estimada ? "~" : ""}${minutos(treino.duracao.segundos)}`
    );
  }
  return partes.join(" · ");
}

function ListaDeExercicios({ treino }) {
  if (treino.exercicios.length === 0) return null;
  const restantes = treino.total_exercicios - treino.exercicios.length;
  return (
    <p className="previa-exercicios">
      {treino.exercicios.join(" • ")}
      {restantes > 0 && <span className="mais"> +{restantes}</span>}
    </p>
  );
}

/**
 * "Meus treinos": o plano do aluno, com o estado de execução de cada treino.
 *
 * Era um índice — nome, dia e contagem de exercícios, ou seja, só o que o
 * personal cadastrou. Todos os treinos tinham o mesmo peso visual, e a pergunta
 * que traz o aluno aqui ("qual eu faço agora, e como estou nele?") não tinha
 * resposta na tela.
 *
 * Agora o treino de hoje é um cartão em destaque com a ação principal, e os
 * outros ficam secundários. O que entra em cada cartão é só o que ajuda a
 * escolher e começar: dia, exercícios, duração, última execução, estado e ação.
 * Consistência, volume e recordes continuam em "Hoje" e "Minha evolução" — a
 * tela ficaria cheia sem ficar mais útil.
 */
export default function ListaDeTreinos({ aluno, aoAbrir, aoErrar, recarregarEm }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [iniciando, setIniciando] = useState(null);

  const carregar = useCallback(() => {
    api.progressao
      .meusTreinos(aluno.id)
      .then(setDados)
      .catch((e) => aoErrar(e.message))
      .finally(() => setCarregando(false));
  }, [aluno.id, aoErrar]);

  useEffect(carregar, [carregar, recarregarEm]);

  async function abrir(treino, iniciar) {
    if (!iniciar) return aoAbrir(treino);
    setIniciando(treino.id);
    try {
      await api.execucoes.treino.sessoes.iniciar(treino.id);
      aoErrar(null);
      aoAbrir(treino);
    } catch (e) {
      aoErrar(e.message);
    } finally {
      setIniciando(null);
    }
  }

  if (carregando) {
    return (
      <section className="painel">
        <Skeleton quantidade={3} />
      </section>
    );
  }

  const treinos = dados?.treinos ?? [];
  if (treinos.length === 0) {
    return (
      <section className="painel">
        <Vazio icone={Dumbbell}>
          Seu personal ainda não montou nenhum treino para você.
        </Vazio>
      </section>
    );
  }

  const deHoje = treinos.filter((t) => t.e_de_hoje);
  const outros = treinos.filter((t) => !t.e_de_hoje);

  return (
    <div className="meus-treinos">
      {deHoje.map((treino) => {
        const acao = acaoDoCartao(treino);
        const Icone = acao.icone;
        return (
          <section key={treino.id} className="painel cartao-treino-hoje">
            <header>
              <span className="etiqueta">Treino de hoje</span>
              <Badge tom="info">
                {SIGLAS[normalizar(treino.dia_semana)] ?? treino.dia_semana}
              </Badge>
            </header>

            <h2>{treino.nome}</h2>
            {treino.descricao && <p className="descricao">{treino.descricao}</p>}
            <p className="resumo">{linhaResumo(treino)}</p>

            <ListaDeExercicios treino={treino} />
            <Estado treino={treino} />

            <button
              type="button"
              className="primario acao-treino"
              onClick={() => abrir(treino, acao.iniciar)}
              disabled={iniciando === treino.id}
            >
              {Icone && <Icone size={16} aria-hidden="true" />}
              {iniciando === treino.id ? "Iniciando..." : acao.rotulo}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        );
      })}

      {outros.length > 0 && (
        <section className="painel">
          {deHoje.length > 0 && <h2 className="titulo-secao">Outros treinos</h2>}

          {agruparPorDia(outros).map((grupo) => (
            <div key={grupo.dia} className="grupo-dia">
              <h3 className="titulo-dia">{grupo.rotulo}</h3>

              <ul className="lista-treinos-aluno">
                {grupo.itens.map((treino) => {
                  const acao = acaoDoCartao(treino);
                  return (
                    <li key={treino.id}>
                      <button type="button" onClick={() => abrir(treino, acao.iniciar)}>
                        <span className="icone-treino" aria-hidden="true">
                          <Dumbbell size={16} />
                        </span>

                        <span className="info">
                          <strong>{treino.nome}</strong>
                          <span className="resumo">{linhaResumo(treino)}</span>
                          <Estado treino={treino} />
                        </span>

                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
