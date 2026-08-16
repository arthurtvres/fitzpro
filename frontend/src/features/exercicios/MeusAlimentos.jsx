import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Utensils } from "lucide-react";

import { api } from "../../api/index.js";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import FormularioAlimentoPersonalizado from "./FormularioAlimentoPersonalizado.jsx";

// A listagem devolve o id prefixado ("personal:5") — precisa disso para não
// colidir com os ids da TACO numa busca combinada. As rotas de gerenciamento
// (arquivar/desarquivar), porém, tomam o id numérico puro.
const idNumerico = (id) => Number(String(id).split(":")[1]);

const numero = (valor) => (valor == null ? "—" : new Intl.NumberFormat("pt-BR").format(valor));

/** A biblioteca própria do personal: alimentos fora da TACO. */
export default function MeusAlimentos({ aoErrar, podeGerenciar = false }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [incluirArquivados, setIncluirArquivados] = useState(false);
  // true = criando; um objeto = editando aquele alimento; null = fechado.
  const [emEdicao, setEmEdicao] = useState(null);

  function carregar(incluir = incluirArquivados) {
    setCarregando(true);
    api.alimentos.personalizados
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
        await api.alimentos.personalizados.desarquivar(idNumerico(item.id));
        aoErrar(null);
        carregar();
      } else {
        await api.alimentos.personalizados.arquivar(idNumerico(item.id));
        aoErrar(null);
        // Sem isto o item some da lista assim que arquiva (a lista padrão
        // exclui arquivado) e o botão de desarquivar nunca aparece — parece
        // uma ação sem volta. Ligar o filtro, e recarregar já com ele, é o
        // que deixa o "Desarquivar" visível na mesma hora, na mesma linha.
        setIncluirArquivados(true);
        carregar(true);
      }
    } catch (e) {
      aoErrar(e.message);
    }
  }

  return (
    <section className="painel">
      {podeGerenciar && (
        <div className="barra-acoes">
          <button type="button" className="primario" onClick={() => setEmEdicao(true)}>
            <Plus size={15} /> Novo alimento
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
        <Skeleton quantidade={4} />
      ) : itens.length === 0 ? (
        <Vazio icone={Utensils}>
          {podeGerenciar
            ? "Você ainda não cadastrou nenhum alimento próprio."
            : "Seu personal ainda não cadastrou alimentos próprios."}
        </Vazio>
      ) : (
        <div className="rolagem-tabela">
          <table className="tabela">
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Energia</th>
                <th>Proteína</th>
                <th>Carboidrato</th>
                <th>Gordura</th>
                <th>Fibra</th>
                {podeGerenciar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((alimento) => (
                <tr key={alimento.id}>
                  <td>
                    <strong>{alimento.nome}</strong>
                    {alimento.kcal == null && <span className="sub">sem dados</span>}
                    {alimento.arquivado_em && <span className="sub">arquivado</span>}
                  </td>
                  <td>{numero(alimento.kcal)} kcal</td>
                  <td>{numero(alimento.proteina_g)} g</td>
                  <td>{numero(alimento.carboidrato_g)} g</td>
                  <td>{numero(alimento.gordura_g)} g</td>
                  <td>{numero(alimento.fibra_g)} g</td>
                  {podeGerenciar && (
                    <td>
                      <div className="acoes-cartao">
                        <button type="button" onClick={() => setEmEdicao(alimento)} title="Editar" aria-label="Editar">
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarArquivamento(alimento)}
                          title={alimento.arquivado_em ? "Desarquivar" : "Arquivar"}
                          aria-label={alimento.arquivado_em ? "Desarquivar" : "Arquivar"}
                        >
                          {alimento.arquivado_em ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {emEdicao && (
        <FormularioAlimentoPersonalizado
          alimento={emEdicao === true ? null : emEdicao}
          aoSalvar={() => {
            setEmEdicao(null);
            carregar();
          }}
          aoCancelar={() => setEmEdicao(null)}
          aoErrar={aoErrar}
        />
      )}
    </section>
  );
}
