import { rotulo as rotuloDoDia } from "../../utils/dias.js";

/** "2026-08-13" -> "13/08/2026". Sem `new Date`: ele desloca por fuso. */
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");

const numero = (valor) =>
  valor == null || valor === "" ? "—" : new Intl.NumberFormat("pt-BR").format(valor);

/**
 * Ficha de treino: o que o aluno leva para a academia.
 *
 * Traz uma coluna vazia de anotação de propósito. Quem imprime treino costuma
 * ser justamente quem prefere anotar a carga no papel — sem esse espaço, a
 * folha vira consulta e não registro.
 *
 * Não traz nada de execução (o que foi feito hoje, última carga, volume): isso
 * é estado do dia, e a folha é impressa uma vez e usada por semanas.
 */
export function FichaDeTreino({ treino, itens }) {
  return (
    <>
      <h2>
        {treino.nome}
        {treino.dia_semana ? ` · ${rotuloDoDia(treino.dia_semana)}` : ""}
      </h2>
      {treino.descricao && <p className="observacao">{treino.descricao}</p>}

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Exercício</th>
            <th>Séries × reps</th>
            <th>Carga</th>
            <th>Descanso</th>
            <th className="coluna-anotacao">Anotações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, indice) => (
            <tr key={item.id}>
              <td>{indice + 1}</td>
              <td>
                {item.exercicio?.nome ?? item.exercicio_id}
                {item.observacao && <p className="observacao">{item.observacao}</p>}
              </td>
              <td>
                {item.series} × {item.repeticoes}
              </td>
              <td>{item.carga_kg != null ? `${numero(item.carga_kg)} kg` : "—"}</td>
              <td>
                {item.descanso_segundos != null ? `${item.descanso_segundos}s` : "—"}
              </td>
              <td className="coluna-anotacao"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Plano alimentar: refeições, horários e o que comer em cada uma. */
export function PlanoAlimentarImpresso({ dieta, plano }) {
  const refeicoes = plano?.refeicoes ?? [];

  return (
    <>
      <h2>{dieta.nome}</h2>
      <p className="observacao">
        {dieta.calorias ? `Meta diária: ${numero(dieta.calorias)} kcal` : ""}
        {plano?.proteinas != null && ` · Proteínas ${numero(plano.proteinas)} g`}
        {plano?.carboidratos != null && ` · Carboidratos ${numero(plano.carboidratos)} g`}
        {plano?.gorduras != null && ` · Gorduras ${numero(plano.gorduras)} g`}
      </p>

      {refeicoes.length === 0 ? (
        <p>{dieta.descricao}</p>
      ) : (
        refeicoes.map((refeicao) => (
          <div key={refeicao.id ?? refeicao.nome} className="bloco">
            <h2>
              {refeicao.horario ? `${refeicao.horario} · ` : ""}
              {refeicao.nome}
              {refeicao.calorias != null ? ` — ${numero(refeicao.calorias)} kcal` : ""}
            </h2>
            <table>
              <tbody>
                {(refeicao.alimentos ?? []).map((alimento, i) => (
                  <tr key={alimento.id ?? i}>
                    <td>{alimento.nome}</td>
                    <td>
                      {[alimento.quantidade, alimento.unidade]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {refeicao.observacao && (
              <p className="observacao">{refeicao.observacao}</p>
            )}
          </div>
        ))
      )}
    </>
  );
}

/**
 * Avaliação física: as medidas de uma data.
 *
 * Campo não medido aparece como "—" e não some. Numa avaliação, a lacuna é
 * informação: mostra o que não foi aferido naquele dia, e uma folha que esconde
 * isso parece completa quando não está.
 */
export function AvaliacaoImpressa({ avaliacao, campos }) {
  return (
    <>
      <h2>Avaliação de {dataBR(avaliacao.data)}</h2>

      <table>
        <thead>
          <tr>
            <th>Medida</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {campos.map(([campo, rotulo]) => (
            <tr key={campo}>
              <td>{rotulo}</td>
              <td>{numero(avaliacao[campo])}</td>
            </tr>
          ))}
          {avaliacao.imc != null && (
            <tr>
              <td>IMC</td>
              <td>{numero(avaliacao.imc)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {avaliacao.observacao && (
        <>
          <h2>Observações</h2>
          <p>{avaliacao.observacao}</p>
        </>
      )}
    </>
  );
}
