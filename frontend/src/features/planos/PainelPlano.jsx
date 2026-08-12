import { useEffect, useState } from "react";

import FormularioPlano from "./FormularioPlano.jsx";
import ListaPlanos from "./ListaPlanos.jsx";

/**
 * Treinos ou dietas de um aluno específico, dentro do detalhe dele:
 * formulário em cima, lista embaixo, tudo já amarrado ao aluno.
 */
export default function PainelPlano({
  config,
  aluno,
  aoErrar,
  aoAbrir,
  aoVisualizar,
}) {
  const recurso = config.recurso;

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [emEdicao, setEmEdicao] = useState(null);

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
      if (emEdicao) {
        const atualizado = await recurso.atualizar(emEdicao.id, corpo);
        setItens((atual) =>
          atual.map((i) => (i.id === atualizado.id ? atualizado : i))
        );
        setEmEdicao(null);
      } else {
        const criado = await recurso.criar(corpo);
        setItens((atual) => [...atual, criado]);
      }
      aoErrar(null);
      return true;
    } catch (erro) {
      aoErrar(erro.message);
      return false;
    }
  }

  async function remover(item) {
    if (!confirm(`Remover "${item.nome}"?`)) return;
    try {
      await recurso.deletar(item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      if (emEdicao?.id === item.id) setEmEdicao(null);
      aoErrar(null);
    } catch (erro) {
      aoErrar(erro.message);
    }
  }

  return (
    <>
      <FormularioPlano
        config={config}
        item={emEdicao}
        alunoFixo={aluno}
        aoSalvar={salvar}
        aoCancelar={emEdicao ? () => setEmEdicao(null) : undefined}
      />

      <hr className="divisor" />

      <ListaPlanos
        config={config}
        itens={itens}
        carregando={carregando}
        aoEditar={setEmEdicao}
        aoAbrir={aoAbrir}
        aoVisualizar={aoVisualizar}
        aoRemover={remover}
        textoVazio={`${config.textoVazio} para ${aluno.nome}.`}
      />
    </>
  );
}
