import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Dumbbell, Play, Plus, Printer, Square, Trophy } from "lucide-react";

import { api } from "../../api/index.js";
import BarraProgresso from "../../components/BarraProgresso.jsx";
import FolhaImpressao from "../../components/FolhaImpressao.jsx";
import { FichaDeTreino } from "../impressao/Documentos.jsx";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import CatalogoExercicios from "../exercicios/CatalogoExercicios.jsx";
import DetalheExercicio from "../exercicios/DetalheExercicio.jsx";
import FormularioPrescricao from "./FormularioPrescricao.jsx";
import ItemPrescricao from "./ItemPrescricao.jsx";

export default function DetalheTreino({
  treino,
  // Só para a folha impressa: o cabeçalho precisa dizer de quem é o treino e
  // quem prescreveu. A tela já sabe as duas coisas pelo contexto.
  aluno,
  personal,
  aoErrar,
  somenteLeitura = false,
  // Modo execução: mostra as caixas de marcar e o histórico de carga. É
  // ortogonal a `somenteLeitura` — o aluno usa as duas juntas, e o personal
  // pode usar só esta para registrar ao lado dele na academia.
  modoExecucao = false,
  aoRegistrar,
  aoVerHistorico,
}) {
  const [itens, setItens] = useState([]);
  const [imprimindo, setImprimindo] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [recordes, setRecordes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  // Fluxo de adicionar: catálogo -> prescrição do exercício escolhido.
  const [escolhendo, setEscolhendo] = useState(false);
  const [prescrevendo, setPrescrevendo] = useState(null);
  const [detalhando, setDetalhando] = useState(null);

  const sensores = useSensors(
    // A distância mínima evita que um clique em "editar" vire arrasto.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    // Em modo execução, `/progresso` já devolve a prescrição, o que foi feito e
    // o histórico de cada exercício — uma requisição no lugar de três.
    const buscar = modoExecucao
      ? api.execucoes.treino.progresso(treino.id).then((resposta) => {
          if (cancelado) return;
          setProgresso(resposta);
          setItens(resposta.itens);
        })
      : api.treinos.exercicios
          .listar(treino.id)
          .then((lista) => !cancelado && setItens(lista));

    buscar
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [treino.id, modoExecucao, aoErrar]);

  /** Abre a sessão — o cronômetro do treino começa aqui. */
  async function iniciar() {
    try {
      const resposta = await api.execucoes.treino.sessoes.iniciar(treino.id);
      setProgresso(resposta);
      setItens(resposta.itens);
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  /**
   * Fecha a sessão e mostra o que ela produziu.
   *
   * O recorde aparece aqui e não em outro lugar: é o momento em que a conquista
   * aconteceu. Fora daqui, só um card discreto na Home.
   */
  async function finalizar() {
    try {
      const resposta = await api.execucoes.treino.sessoes.finalizar(
        treino.id,
        progresso.sessao.id
      );
      setProgresso((atual) => ({ ...atual, ...resposta.resumo, sessao: resposta.sessao }));
      setRecordes(resposta.recordes ?? []);
      aoRegistrar?.(resposta.resumo);
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  /**
   * Marca ou desmarca um exercício.
   *
   * Otimista com rollback, igual ao `persistirOrdem`: a caixa muda na hora,
   * porque quem está na academia com o celular na mão não deve esperar a rede
   * para ver o toque valer; se a API recusar, volta ao que era.
   */
  async function alternarExecucao(item) {
    const marcando = !item.concluido;
    const anterior = itens;

    setItens((atual) =>
      atual.map((i) => (i.id === item.id ? { ...i, concluido: marcando } : i))
    );

    try {
      const sessao_id = progresso?.sessao?.id;
      const resposta = marcando
        ? // Sem carga informada, repete a última registrada — e, na falta dela,
          // a prescrita. É o palpite certo na esmagadora maioria das vezes, e o
          // aluno corrige pelo histórico quando não for. As séries o servidor
          // preenche a partir do prescrito; o volume vem marcado como estimado.
          await api.execucoes.treino.marcar(treino.id, item.id, {
            carga_kg: item.historico?.ultima_carga_kg ?? item.carga_kg ?? null,
            sessao_id,
          })
        : await api.execucoes.treino.desmarcar(treino.id, item.id, { sessao_id });

      setProgresso((atual) => ({ ...atual, ...resposta.progresso }));
      aoRegistrar?.(resposta.progresso);
      aoErrar(null);
    } catch (e) {
      setItens(anterior);
      aoErrar(e.message);
    }
  }

  function escolherDoCatalogo(exercicio) {
    setEscolhendo(false);
    setPrescrevendo({ exercicio, item: null });
  }

  async function salvarPrescricao(corpo) {
    const { item } = prescrevendo;
    try {
      if (item) {
        const atualizado = await api.treinos.exercicios.atualizar(
          treino.id,
          item.id,
          corpo
        );
        setItens((atual) =>
          atual.map((i) => (i.id === atualizado.id ? atualizado : i))
        );
      } else {
        const criado = await api.treinos.exercicios.adicionar(treino.id, corpo);
        setItens((atual) => [...atual, criado]);
      }
      setPrescrevendo(null);
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  async function remover(item) {
    if (!confirm(`Tirar "${item.exercicio?.nome}" do treino?`)) return;
    try {
      await api.treinos.exercicios.remover(treino.id, item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  /**
   * Envia a ordem nova e confirma com o que a API devolveu. Otimista: a lista já
   * foi movida na tela antes de chamar, e `anterior` desfaz se a API recusar.
   */
  async function persistirOrdem(reordenados, anterior) {
    try {
      const confirmados = await api.treinos.exercicios.reordenar(
        treino.id,
        reordenados.map((i) => i.id)
      );
      setItens(confirmados);
      aoErrar(null);
    } catch (e) {
      setItens(anterior);
      aoErrar(e.message);
    }
  }

  /** Move uma posição para cima (-1) ou para baixo (+1) — caminho por teclado. */
  function mover(indice, direcao) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= itens.length) return;

    const reordenados = arrayMove(itens, indice, destino);
    setItens(reordenados);
    persistirOrdem(reordenados, itens);
  }

  function aoTerminarArrasto(evento) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const de = itens.findIndex((i) => i.id === active.id);
    const para = itens.findIndex((i) => i.id === over.id);
    if (de === -1 || para === -1) return;

    const reordenados = arrayMove(itens, de, para);
    setItens(reordenados);
    persistirOrdem(reordenados, itens);
  }

  return (
    <>
      {/* Só existe durante a impressão: monta, abre o diálogo e sai da árvore
          quando ele fecha. Renderiza fora do app, num portal. */}
      {imprimindo && (
        <FolhaImpressao
          titulo="Ficha de treino"
          subtitulo={aluno?.objetivo || undefined}
          aluno={aluno}
          personal={personal}
          aoFechar={() => setImprimindo(false)}
        >
          <FichaDeTreino treino={treino} itens={itens} />
        </FolhaImpressao>
      )}

      <section className="painel">
        <div className="barra-acoes">
          <h2 style={{ margin: 0 }}>Exercícios</h2>
          <div className="acoes-do-painel">
            {itens.length > 0 && (
              <button type="button" onClick={() => setImprimindo(true)}>
                <Printer size={15} /> PDF
              </button>
            )}
            {!somenteLeitura && (
              <button
                type="button"
                className="primario"
                onClick={() => setEscolhendo(true)}
              >
                <Plus size={15} /> Adicionar exercício
              </button>
            )}
          </div>
        </div>

        {recordes.length > 0 && (
          <div className="aviso-recorde">
            <span className="icone" aria-hidden="true">
              <Trophy size={16} />
            </span>
            <div>
              <strong>
                {recordes.length === 1
                  ? "Novo recorde pessoal"
                  : `${recordes.length} novos recordes`}
              </strong>
              {recordes.map((r) => (
                <span key={r.exercicio_id}>
                  {r.exercicio?.nome ?? r.exercicio_id} · {r.carga_kg} kg
                  <em> (antes {r.anterior_kg} kg)</em>
                </span>
              ))}
            </div>
          </div>
        )}

        {modoExecucao && progresso && progresso.total > 0 && (
          <div className="barra-sessao">
            <BarraProgresso
              className="progresso-treino"
              valor={progresso.concluidos}
              total={progresso.total}
              rotulo={
                progresso.concluidos >= progresso.total
                  ? "Treino concluído"
                  : "Exercícios de hoje"
              }
            />

            <div className="acoes-sessao">
              {progresso.volume_kg != null && (
                <span className="volume-sessao">
                  {progresso.volume_estimado ? "≈ " : ""}
                  {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
                    progresso.volume_kg
                  )}{" "}
                  kg de volume
                </span>
              )}

              {progresso.sessao?.em_andamento ? (
                <button type="button" className="primario" onClick={finalizar}>
                  <Square size={14} /> Finalizar treino
                </button>
              ) : (
                <button type="button" onClick={iniciar}>
                  <Play size={14} /> Iniciar treino
                </button>
              )}
            </div>
          </div>
        )}

        {treino.descricao && (
          <div className="bloco-detalhe compacto">
            <span>Observações</span>
            <p>{treino.descricao}</p>
          </div>
        )}

        {carregando ? (
          <Skeleton quantidade={3} />
        ) : itens.length === 0 ? (
          <Vazio icone={Dumbbell}>
            Treino vazio. Use "Adicionar exercício" para montar a série.
          </Vazio>
        ) : (
          <DndContext
            sensors={sensores}
            collisionDetection={closestCenter}
            onDragEnd={aoTerminarArrasto}
          >
            <SortableContext
              items={itens.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="lista lista-prescricao">
                {itens.map((item, indice) => (
                  <ItemPrescricao
                    key={item.id}
                    item={item}
                    indice={indice}
                    total={itens.length}
                    aoDetalhar={setDetalhando}
                    aoEditar={
                      somenteLeitura
                        ? undefined
                        : (alvo) =>
                            setPrescrevendo({ exercicio: alvo.exercicio, item: alvo })
                    }
                    aoRemover={somenteLeitura ? undefined : remover}
                    aoMover={somenteLeitura ? undefined : mover}
                    aoAlternar={modoExecucao ? alternarExecucao : undefined}
                    aoVerHistorico={modoExecucao ? aoVerHistorico : undefined}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {escolhendo && (
        <Modal titulo="Escolher exercício" largo aoFechar={() => setEscolhendo(false)}>
          <CatalogoExercicios
            aoSelecionar={escolherDoCatalogo}
            aoDetalhar={setDetalhando}
            aoErrar={aoErrar}
          />
        </Modal>
      )}

      {prescrevendo && (
        <Modal
          titulo={prescrevendo.item ? "Editar prescrição" : "Prescrição"}
          aoFechar={() => setPrescrevendo(null)}
        >
          <FormularioPrescricao
            exercicio={prescrevendo.exercicio}
            item={prescrevendo.item}
            aoSalvar={salvarPrescricao}
            aoCancelar={() => setPrescrevendo(null)}
          />
        </Modal>
      )}

      {detalhando && (
        <DetalheExercicio
          exercicioId={detalhando}
          aoFechar={() => setDetalhando(null)}
          aoErrar={aoErrar}
        />
      )}
    </>
  );
}
