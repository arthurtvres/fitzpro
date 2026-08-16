import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Dumbbell, Pencil, Plus } from "lucide-react";

import { api } from "../../api/index.js";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import FormularioExercicioPersonalizado from "./FormularioExercicioPersonalizado.jsx";

// A listagem devolve o id prefixado ("personal:5") — precisa disso para não
// colidir com os ids do catálogo público numa busca combinada. As rotas de
// gerenciamento (arquivar/desarquivar), porém, tomam o id numérico puro.
const idNumerico = (id) => Number(String(id).split(":")[1]);

/**
 * A biblioteca própria do personal: exercícios fora do free-exercise-db.
 * Serve dois contextos, como o catálogo público:
 * - aba "Meus exercícios": gerenciar (criar, editar, arquivar);
 * - seletor dentro de um treino (`aoSelecionar`): o cartão vira botão de adicionar.
 */
export default function MeusExercicios({ aoSelecionar, aoDetalhar, aoErrar, podeGerenciar = false }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [incluirArquivados, setIncluirArquivados] = useState(false);
  // true = criando; um objeto = editando aquele exercício; null = fechado.
  const [emEdicao, setEmEdicao] = useState(null);

  function carregar(incluir = incluirArquivados) {
    setCarregando(true);
    api.exercicios.personalizados
      .listar(incluir)
      .then(setItens)
      .catch((e) => aoErrar(e.message))
      .finally(() => setCarregando(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(carregar, [incluirArquivados]);

  async function alternarArquivamento(item) {
    try {
      if (item.arquivado_em) {
        await api.exercicios.personalizados.desarquivar(idNumerico(item.id));
        aoErrar(null);
        carregar();
      } else {
        await api.exercicios.personalizados.arquivar(idNumerico(item.id));
        aoErrar(null);
        // Sem isto o item some da lista assim que arquiva (a lista padrão
        // exclui arquivado) e o botão de desarquivar nunca aparece — parece
        // uma ação sem volta. Ligar o filtro, e recarregar já com ele, é o
        // que deixa o "Desarquivar" visível na mesma hora, no mesmo cartão.
        setIncluirArquivados(true);
        carregar(true);
      }
    } catch (e) {
      aoErrar(e.message);
    }
  }

  return (
    <>
      {podeGerenciar && (
        <div className="barra-acoes">
          <button type="button" className="primario" onClick={() => setEmEdicao(true)}>
            <Plus size={15} /> Novo exercício
          </button>
          <label className="filtro">
            <input
              type="checkbox"
              checked={incluirArquivados}
              onChange={(e) => setIncluirArquivados(e.target.checked)}
            />
            Mostrar arquivados
          </label>
        </div>
      )}

      {carregando ? (
        <Skeleton forma="cartao" quantidade={4} />
      ) : itens.length === 0 ? (
        <Vazio icone={Dumbbell}>
          {podeGerenciar
            ? "Você ainda não cadastrou nenhum exercício próprio."
            : "Seu personal ainda não cadastrou exercícios próprios."}
        </Vazio>
      ) : (
        <ul className="grade-exercicios">
          {itens.map((exercicio) => (
            <li key={exercicio.id} className="cartao-exercicio">
              <button
                type="button"
                className="miniatura"
                onClick={() => aoDetalhar?.(exercicio.id)}
                title="Ver instruções"
              >
                {exercicio.imagens[0] ? (
                  <img src={exercicio.imagens[0]} alt="" loading="lazy" />
                ) : (
                  <span className="sem-imagem">sem foto</span>
                )}
              </button>

              <div className="dados">
                <strong>{exercicio.nome}</strong>
                <span className="meta">
                  {exercicio.musculos_primarios_pt.join(", ") || "—"} · {exercicio.equipamento_pt}
                </span>
                {exercicio.arquivado_em && <span className="meta fraco">Arquivado</span>}
              </div>

              {aoSelecionar && !exercicio.arquivado_em && (
                <button type="button" className="primario" onClick={() => aoSelecionar(exercicio)}>
                  <Plus size={15} /> Adicionar
                </button>
              )}

              {podeGerenciar && (
                <div className="acoes-cartao">
                  <button type="button" onClick={() => setEmEdicao(exercicio)} title="Editar" aria-label="Editar">
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => alternarArquivamento(exercicio)}
                    title={exercicio.arquivado_em ? "Desarquivar" : "Arquivar"}
                    aria-label={exercicio.arquivado_em ? "Desarquivar" : "Arquivar"}
                  >
                    {exercicio.arquivado_em ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {emEdicao && (
        <FormularioExercicioPersonalizado
          exercicio={emEdicao === true ? null : emEdicao}
          aoSalvar={() => {
            setEmEdicao(null);
            carregar();
          }}
          aoCancelar={() => setEmEdicao(null)}
          aoErrar={aoErrar}
        />
      )}
    </>
  );
}
