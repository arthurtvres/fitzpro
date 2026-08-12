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
import { Dumbbell, Plus } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import CatalogoExercicios from "../exercicios/CatalogoExercicios.jsx";
import DetalheExercicio from "../exercicios/DetalheExercicio.jsx";
import FormularioPrescricao from "./FormularioPrescricao.jsx";
import ItemPrescricao from "./ItemPrescricao.jsx";

export default function DetalheTreino({ treino, aoErrar, somenteLeitura = false }) {
  const [itens, setItens] = useState([]);
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
    api.treinos.exercicios
      .listar(treino.id)
      .then((lista) => !cancelado && setItens(lista))
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [treino.id, aoErrar]);

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
      <section className="painel">
        <div className="barra-acoes">
          <h2 style={{ margin: 0 }}>Exercícios</h2>
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
