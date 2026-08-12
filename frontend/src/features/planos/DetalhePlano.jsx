import { Edit3, User } from "lucide-react";

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

export default function DetalhePlano({ config, item, aluno, aoEditar, aoErrar }) {
  if (config.chave === CONFIG_TREINO.chave) {
    return <DetalheTreino treino={item} aoErrar={aoErrar} somenteLeitura />;
  }

  const campoExtra = config.campoExtra;
  const plano = lerPlanoAlimentar(item.descricao);

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
              <section className="refeicao-plano refeicao-plano-modal" key={refeicao.id}>
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
