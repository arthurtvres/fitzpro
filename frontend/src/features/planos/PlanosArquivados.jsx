import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, CalendarDays, Trash2, User } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";

/** "2026-08-13T20:42:00Z" -> "13/08/2026". */
function dataBR(iso) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Treinos ou dietas fora do ar.
 *
 * Tela separada, e não um filtro dentro de "Ver treinos": arquivado é o oposto
 * do que aquela tela existe para mostrar. Misturar os dois obrigaria toda
 * listagem, contagem e filtro de lá a perguntar "e este está no ar?" — e o
 * item arquivado apareceria sem querer no dia em que alguém esquecesse.
 *
 * Aqui não há busca nem filtro: é uma lista de consulta ocasional, e quem chega
 * quer trazer um plano de volta, não navegar por ele.
 */
export default function PlanosArquivados({ config, alunos, aoErrar }) {
  const recurso = config.recurso;
  const ehTreino = config.chave === "treinos";

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);

  const nomeDoAluno = (id) =>
    alunos.find((aluno) => aluno.id === id)?.nome ?? `Aluno #${id}`;

  const carregar = useCallback(() => {
    setCarregando(true);
    recurso
      .listar(undefined, true)
      // O servidor devolve arquivados **e** ativos quando se pede tudo; o
      // recorte é aqui, para não existir uma segunda rota só para esta tela.
      .then((lista) => setItens(lista.filter((item) => item.arquivado_em)))
      .catch((e) => aoErrar(e.message))
      .finally(() => setCarregando(false));
  }, [recurso, aoErrar]);

  useEffect(carregar, [carregar]);

  async function desarquivar(item) {
    try {
      await recurso.desarquivar(item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  async function excluir(item) {
    try {
      await recurso.deletar(item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      setConfirmandoExclusao(null);
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  if (carregando) {
    return (
      <section className="painel">
        <Skeleton quantidade={3} />
      </section>
    );
  }

  return (
    <section className="painel">
      {itens.length === 0 ? (
        <Vazio icone={Archive}>
          <div>
            <strong>Nada arquivado</strong>
            <span>
              {ehTreino ? "Treinos arquivados" : "Dietas arquivadas"} somem das
              listas e da tela do aluno, e aparecem aqui para voltar quando você
              quiser.
            </span>
          </div>
        </Vazio>
      ) : (
        <ul className="lista">
          {itens.map((item) => (
            <li key={item.id} className="cartao">
              <div className="corpo">
                <div className="titulo">{item.nome}</div>
                <div className="descricao">
                  <span>
                    <User size={13} /> {nomeDoAluno(item.aluno_id)}
                  </span>
                  {" · "}
                  <span>
                    <CalendarDays size={13} /> arquivado em{" "}
                    {dataBR(item.arquivado_em)}
                  </span>
                </div>
              </div>
              <div className="acoes">
                <button
                  type="button"
                  className="link destaque"
                  onClick={() => desarquivar(item)}
                >
                  <ArchiveRestore size={14} /> Desarquivar
                </button>
                <button
                  type="button"
                  className="link perigo"
                  onClick={() => setConfirmandoExclusao(item)}
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmandoExclusao && (
        <Modal
          titulo={ehTreino ? "Excluir treino" : "Excluir dieta"}
          aoFechar={() => setConfirmandoExclusao(null)}
        >
          <div className="confirmacao-exclusao">
            <p>
              Excluir <strong>{confirmandoExclusao.nome}</strong> em definitivo?
            </p>
            {/* O que se perde é o vínculo, não o histórico — e é por isso que
                arquivar existe. Dizer a diferença aqui evita a exclusão feita
                por achar que arquivar não bastava. */}
            <p className="sub">
              O que o aluno já registrou continua no histórico dele, mas perde a
              ligação com este plano. Arquivado, ele ficaria inteiro.
            </p>
            <div className="acoes-form">
              <button type="button" onClick={() => setConfirmandoExclusao(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="perigo"
                onClick={() => excluir(confirmandoExclusao)}
              >
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
