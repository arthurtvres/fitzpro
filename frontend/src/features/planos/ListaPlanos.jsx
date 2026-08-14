import { Eye, ListPlus, Pencil, Printer, Trash2 } from "lucide-react";

import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { resumoPlanoAlimentar } from "./dietaPlano.js";

/**
 * Lista de treinos ou dietas em cartões. `nomeDoAluno` só é passado nas telas
 * globais — dentro do detalhe de um aluno o nome seria repetição.
 */
export default function ListaPlanos({
  config,
  itens,
  carregando,
  nomeDoAluno,
  aoEditar,
  aoRemover,
  aoAbrir,
  aoVisualizar,
  aoImprimir,
  textoVazio,
}) {
  if (carregando) return <Skeleton quantidade={3} />;
  if (itens.length === 0)
    return <Vazio>{textoVazio ?? config.textoVazio}</Vazio>;

  const { campoExtra } = config;
  const descricaoDoItem = (item) =>
    config.chave === "dietas" ? resumoPlanoAlimentar(item) : item.descricao;

  return (
    <ul className="lista">
      {itens.map((item) => (
        <li key={item.id} className="cartao">
          <div className="corpo">
            <div className="titulo">
              {item.nome}
              <span className="selo">{campoExtra.formatar(item[campoExtra.nome])}</span>
              {/* Só treinos têm exercícios — a contagem vem do backend. */}
              {item.total_exercicios != null && (
                <span className="selo">{item.total_exercicios} exercício(s)</span>
              )}
              {nomeDoAluno && (
                <span className="selo aluno">{nomeDoAluno(item.aluno_id)}</span>
              )}
            </div>
            {descricaoDoItem(item) && (
              <div className="descricao">{descricaoDoItem(item)}</div>
            )}
          </div>
          <div className="acoes">
            {aoVisualizar && (
              <button className="link destaque" onClick={() => aoVisualizar(item)}>
                <Eye size={14} /> ver
              </button>
            )}
            {aoAbrir && (
              <button className="link destaque" onClick={() => aoAbrir(item)}>
                <ListPlus size={14} /> montar
              </button>
            )}
            {aoImprimir && (
              <button className="link" onClick={() => aoImprimir(item)}>
                <Printer size={14} /> PDF
              </button>
            )}
            <button className="link" onClick={() => aoEditar(item)}>
              <Pencil size={14} /> Editar
            </button>
            <button className="link perigo" onClick={() => aoRemover(item)}>
              <Trash2 size={14} /> Remover
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
