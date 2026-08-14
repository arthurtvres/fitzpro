import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import FormularioPlano from "./FormularioPlano.jsx";
import ListaPlanos from "./ListaPlanos.jsx";
import FolhaImpressao from "../../components/FolhaImpressao.jsx";
import { FichaDeTreino, PlanoAlimentarImpresso } from "../impressao/Documentos.jsx";
import { lerPlanoAlimentar } from "./dietaPlano.js";
import { api } from "../../api/index.js";

/**
 * Treinos ou dietas de um aluno específico, dentro da página dele.
 *
 * **Lista primeiro, formulário sob demanda** — o mesmo arranjo de Avaliações.
 * Antes o formulário ficava aberto no topo e a lista embaixo, o que funcionava
 * mal em treino e péssimo em dieta: o formulário de dieta tem macros e refeições
 * e ocupa a tela inteira, então abrir a aba de dietas *parecia* uma tela de
 * prescrever, com a lista escondida abaixo da dobra. A pergunta ao abrir um
 * aluno é "o que ele já tem?", não "o que vou criar agora".
 */
export default function PainelPlano({
  config,
  aluno,
  // Só para o cabeçalho da folha impressa.
  personal,
  aoErrar,
  aoAbrir,
  aoVisualizar,
}) {
  const recurso = config.recurso;

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  // null = formulário fechado. Um item = editando; `true` = prescrevendo novo.
  const [emEdicao, setEmEdicao] = useState(null);
  // O item a imprimir, já com o que a folha precisa. Um treino precisa dos
  // exercícios, que a lista não traz (ela só sabe a contagem) — daí a busca.
  const [imprimindo, setImprimindo] = useState(null);
  const aberto = emEdicao !== null;
  const editando = aberto && emEdicao !== true ? emEdicao : null;
  const rotuloPrescrever = `Prescrever ${config.singular}`;

  useEffect(() => {
    let cancelado = false;

    setCarregando(true);
    recurso
      .listar(aluno.id)
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
  }, [aluno.id, config.chave]);

  async function salvar(corpo) {
    try {
      if (editando) {
        const atualizado = await recurso.atualizar(editando.id, corpo);
        setItens((atual) =>
          atual.map((i) => (i.id === atualizado.id ? atualizado : i))
        );
      } else {
        const criado = await recurso.criar(corpo);
        setItens((atual) => [...atual, criado]);
      }
      // Fecha nos dois casos: prescreveu, o resultado é a linha nova na lista.
      setEmEdicao(null);
      aoErrar(null);
      return true;
    } catch (erro) {
      aoErrar(erro.message);
      return false;
    }
  }

  async function preparar(item) {
    if (config.chave === "dietas") {
      setImprimindo({ item, plano: lerPlanoAlimentar(item.descricao) });
      return;
    }
    try {
      setImprimindo({ item, itens: await api.treinos.exercicios.listar(item.id) });
    } catch (erro) {
      aoErrar(erro.message);
    }
  }

  async function remover(item) {
    if (!confirm(`Remover "${item.nome}"?`)) return;
    try {
      await recurso.deletar(item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      if (editando?.id === item.id) setEmEdicao(null);
      aoErrar(null);
    } catch (erro) {
      aoErrar(erro.message);
    }
  }

  return (
    <>
      {imprimindo && (
        <FolhaImpressao
          titulo={config.chave === "treinos" ? "Ficha de treino" : "Plano alimentar"}
          aluno={aluno}
          personal={personal}
          aoFechar={() => setImprimindo(null)}
        >
          {config.chave === "treinos" ? (
            <FichaDeTreino treino={imprimindo.item} itens={imprimindo.itens} />
          ) : (
            <PlanoAlimentarImpresso
              dieta={imprimindo.item}
              plano={imprimindo.plano}
            />
          )}
        </FolhaImpressao>
      )}

      <div className="barra-acoes">
        <h2 style={{ margin: 0 }}>
          {config.chave === "treinos" ? "Treinos" : "Dietas"}
        </h2>
        {!aberto && (
          <button type="button" className="primario" onClick={() => setEmEdicao(true)}>
            <Plus size={15} /> {rotuloPrescrever}
          </button>
        )}
      </div>

      {aberto && (
        <>
          <FormularioPlano
            config={config}
            item={editando}
            alunoFixo={aluno}
            aoSalvar={salvar}
            aoCancelar={() => setEmEdicao(null)}
          />
          <hr className="divisor" />
        </>
      )}

      <ListaPlanos
        config={config}
        itens={itens}
        carregando={carregando}
        aoEditar={setEmEdicao}
        aoAbrir={aoAbrir}
        aoVisualizar={aoVisualizar}
        aoRemover={remover}
        aoImprimir={preparar}
        textoVazio={`${config.textoVazio} para ${aluno.nome}.`}
      />
    </>
  );
}
