import { useCallback, useEffect, useState } from "react";
import { Check, Edit3, User } from "lucide-react";

import { api } from "../../api/index.js";
import BarraProgresso from "../../components/BarraProgresso.jsx";

import { CONFIG_TREINO } from "./config.js";
import { lerPlanoAlimentar } from "./dietaPlano.js";
import DetalheTreino from "../treinos/DetalheTreino.jsx";

const ausente = (valor) => valor === null || valor === undefined || valor === "";

const formatarValor = (valor) => (ausente(valor) ? "-" : valor);

const formatarNumero = (valor) =>
  ausente(valor)
    ? null
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(valor));

const pluralRefeicoes = (total) =>
  `${total} ${total === 1 ? "refeição" : "refeições"}`;

const quantidadeDoAlimento = (alimento) =>
  [alimento.quantidade, alimento.unidade].filter(Boolean).join(" ");

export default function DetalhePlano({
  config,
  item,
  aluno,
  aoEditar,
  aoErrar,
  // Modo execução: cada refeição vira uma caixa de marcar e aparece o progresso
  // do dia. Ausente = leitura, como no resto do projeto.
  modoExecucao = false,
  aoRegistrar,
  aoVerHistorico,
}) {
  // Hooks antes de qualquer return: o ramo de treino sai cedo, mas as regras do
  // React valem para o componente inteiro.
  const ehDieta = config.chave !== CONFIG_TREINO.chave;
  const [progresso, setProgresso] = useState(null);

  const carregarProgresso = useCallback(() => {
    if (!modoExecucao || !ehDieta) return;
    api.execucoes.dieta
      .progresso(item.id)
      .then(setProgresso)
      .catch((e) => aoErrar?.(e.message));
  }, [modoExecucao, ehDieta, item.id, aoErrar]);

  useEffect(carregarProgresso, [carregarProgresso]);

  /** Otimista com rollback, mesmo contrato do treino. */
  async function alternarRefeicao(refeicaoId, concluida) {
    const anterior = progresso;
    setProgresso((atual) =>
      atual
        ? {
            ...atual,
            itens: atual.itens.map((i) =>
              i.id === refeicaoId ? { ...i, concluida: !concluida } : i
            ),
          }
        : atual
    );

    try {
      const resposta = concluida
        ? await api.execucoes.dieta.desmarcar(item.id, refeicaoId)
        : await api.execucoes.dieta.marcar(item.id, refeicaoId);
      setProgresso((atual) => ({ ...atual, ...resposta.progresso }));
      aoRegistrar?.(resposta.progresso);
      aoErrar?.(null);
    } catch (e) {
      setProgresso(anterior);
      aoErrar?.(e.message);
    }
  }

  if (!ehDieta) {
    return (
      <DetalheTreino
        treino={item}
        aoErrar={aoErrar}
        somenteLeitura
        modoExecucao={modoExecucao}
        aoRegistrar={aoRegistrar}
        aoVerHistorico={aoVerHistorico}
      />
    );
  }

  const campoExtra = config.campoExtra;
  const plano = lerPlanoAlimentar(item.descricao);
  const feitas = new Set(
    (progresso?.itens ?? []).filter((i) => i.concluida).map((i) => i.id)
  );

  if (plano) {
    const totalRefeicoes = plano.refeicoes.length;

    return (
      <div className="plano-alimentar plano-alimentar-modal">
        <header className="plano-modal-cabecalho">
          <div>
            <h3>{item.nome}</h3>
            {aluno && (
              <span>
                <User size={14} /> {aluno}
              </span>
            )}
          </div>
          {aoEditar && (
            <button type="button" className="botao-montar" onClick={aoEditar}>
              <Edit3 size={14} /> Editar dieta
            </button>
          )}
        </header>

        <section className="plano-modal-resumo">
          <span>Meta diária</span>
          <strong>
            {formatarNumero(item.calorias)} kcal
            <small> • {pluralRefeicoes(totalRefeicoes)}</small>
          </strong>
        </section>

        {modoExecucao && progresso && progresso.total_refeicoes > 0 && (
          <div className="progresso-dieta">
            <BarraProgresso
              valor={progresso.concluidas}
              total={progresso.total_refeicoes}
              rotulo="Refeições de hoje"
            />
            <p className="calorias-do-dia">
              <strong>{formatarNumero(progresso.calorias_consumidas)}</strong> de{" "}
              {formatarNumero(progresso.calorias_meta)} kcal consumidas
            </p>
          </div>
        )}

        <div className="plano-macros plano-macros-modal">
          {!ausente(plano.proteinas) && (
            <div>
              <span>Proteínas</span>
              <strong>{formatarValor(plano.proteinas)} g</strong>
            </div>
          )}
          {!ausente(plano.carboidratos) && (
            <div>
              <span>Carboidratos</span>
              <strong>{formatarValor(plano.carboidratos)} g</strong>
            </div>
          )}
          {!ausente(plano.gorduras) && (
            <div>
              <span>Gorduras</span>
              <strong>{formatarValor(plano.gorduras)} g</strong>
            </div>
          )}
        </div>

        {plano.refeicoes.length === 0 ? (
          <p className="plano-sem-refeicoes">Esta dieta ainda não possui refeições.</p>
        ) : (
          <div className="plano-refeicoes-modal">
            {plano.refeicoes.map((refeicao) => (
              <section
                className={`refeicao-plano refeicao-plano-modal${
                  feitas.has(refeicao.id) ? " concluida" : ""
                }`}
                key={refeicao.id}
              >
                <div className="refeicao-modal-topo">
                  <h3>
                    {refeicao.horario && <time>{refeicao.horario}</time>}
                    {refeicao.nome}
                  </h3>
                  {refeicao.calorias && (
                    <strong>≈ {formatarNumero(refeicao.calorias)} kcal</strong>
                  )}
                </div>

                {(refeicao.alimentos ?? []).length > 0 ? (
                  <div className="lista-alimentos-plano lista-alimentos-modal">
                    {refeicao.alimentos.map((alimento) => (
                      <div key={alimento.id}>
                        <span>{alimento.nome}</span>
                        <strong>{quantidadeDoAlimento(alimento)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="plano-sem-refeicoes">Sem alimentos cadastrados.</p>
                )}

                {(refeicao.proteinas || refeicao.carboidratos || refeicao.gorduras) && (
                  <p className="macros-refeicao macros-refeicao-modal">
                    {!ausente(refeicao.proteinas) && <strong>P {refeicao.proteinas}g</strong>}
                    {!ausente(refeicao.carboidratos) && <strong>C {refeicao.carboidratos}g</strong>}
                    {!ausente(refeicao.gorduras) && <strong>G {refeicao.gorduras}g</strong>}
                  </p>
                )}

                {refeicao.observacao && (
                  <div className="observacao-plano">
                    <span>Observação</span>
                    <p>{refeicao.observacao}</p>
                  </div>
                )}

                {modoExecucao && (
                  <div className="rodape-refeicao">
                    <label className="marcar-execucao">
                      <input
                        type="checkbox"
                        checked={feitas.has(refeicao.id)}
                        onChange={() =>
                          alternarRefeicao(refeicao.id, feitas.has(refeicao.id))
                        }
                      />
                      <span className="rotulo-marcar">
                        {feitas.has(refeicao.id) ? "Consumida" : "Marcar como consumida"}
                      </span>
                      <span className="caixa" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    </label>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="detalhe-registro">
      <div className="grade-detalhes">
        <div>
          <span>Nome</span>
          <strong>{item.nome}</strong>
        </div>
        <div>
          <span>{campoExtra.rotulo}</span>
          <strong>{campoExtra.formatar(item[campoExtra.nome])}</strong>
        </div>
      </div>

      <div className="bloco-detalhe">
        <span>{config.rotuloDescricao}</span>
        <p>{formatarValor(item.descricao)}</p>
      </div>
    </div>
  );
}
