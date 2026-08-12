import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, LineChart, Minus } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { CAMPOS_AVALIACAO, lerFotos } from "../alunos/PainelAvaliacoes.jsx";

const formatarData = (iso) => iso.split("-").reverse().join("/");

/**
 * As avaliações do aluno, só para ler.
 *
 * Não é o `PainelAvaliacoes` do personal com botões escondidos: ali o objetivo
 * é registrar medições, aqui é acompanhar a própria evolução. Por isso o
 * destaque vai para a variação desde a primeira medição, que é a pergunta que
 * o aluno realmente faz — e não para a tabela de campos.
 *
 * Quem cria e edita avaliação é o personal; a API recusa as duas coisas para
 * um aluno logado, então nem existe caminho para elas nesta tela.
 */
export default function MinhaEvolucao({ aluno, aoErrar }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    api.alunos.avaliacoes
      .listar(aluno.id)
      .then((lista) => !cancelado && setItens(lista))
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [aluno.id, aoErrar]);

  if (carregando) {
    return (
      <section className="painel">
        <Skeleton quantidade={3} />
      </section>
    );
  }

  if (itens.length === 0) {
    return (
      <section className="painel">
        <Vazio icone={LineChart}>
          Você ainda não tem avaliações registradas. Seu personal cadastra elas
          conforme as medições acontecem.
        </Vazio>
      </section>
    );
  }

  // A API já devolve da mais recente para a mais antiga.
  const atual = itens[0];
  const primeira = itens[itens.length - 1];
  const temHistorico = itens.length > 1;

  return (
    <div className="aluno-evolucao">
      <section className="painel">
        <h2 className="titulo-secao">Onde você está</h2>
        <p className="apoio-secao">
          Medição de {formatarData(atual.data)}
          {temHistorico && `, comparada com a de ${formatarData(primeira.data)}`}
        </p>

        <div className="grade-evolucao">
          <Metrica
            rotulo="Peso"
            valor={atual.peso_kg}
            unidade="kg"
            inicial={temHistorico ? primeira.peso_kg : null}
          />
          <Metrica rotulo="IMC" valor={atual.imc} inicial={temHistorico ? primeira.imc : null} />
          <Metrica
            rotulo="Gordura"
            valor={atual.percentual_gordura}
            unidade="%"
            inicial={temHistorico ? primeira.percentual_gordura : null}
          />
          <Metrica
            rotulo="Massa muscular"
            valor={atual.massa_muscular_kg}
            unidade="kg"
            inicial={temHistorico ? primeira.massa_muscular_kg : null}
            // Ganhar massa é progresso; nas outras, o desejável é cair.
            subirEBom
          />
          <Metrica
            rotulo="Cintura"
            valor={atual.cintura_cm}
            unidade="cm"
            inicial={temHistorico ? primeira.cintura_cm : null}
          />
        </div>
      </section>

      <section className="painel">
        <h2 className="titulo-secao">Histórico</h2>
        <p className="apoio-secao">
          {itens.length === 1
            ? "1 avaliação registrada."
            : `${itens.length} avaliações registradas.`}{" "}
          Toque para ver todos os dados e as fotos.
        </p>

        <ul className="lista-avaliacoes-aluno">
          {itens.map((item) => {
            const fotos = lerFotos(item.fotos);
            return (
              <li key={item.id}>
                <button type="button" onClick={() => setAberta(item)}>
                  <span className="data">{formatarData(item.data)}</span>
                  <span className="resumo">
                    {[
                      item.peso_kg != null ? `${item.peso_kg} kg` : null,
                      item.imc != null ? `IMC ${item.imc}` : null,
                      fotos.length > 0
                        ? `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem medidas registradas"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {aberta && (
        <Modal
          titulo={`Avaliação de ${formatarData(aberta.data)}`}
          aoFechar={() => setAberta(null)}
        >
          <div className="detalhe-registro">
            <div className="grade-detalhes">
              <div>
                <span>IMC</span>
                <strong>{aberta.imc ?? "—"}</strong>
              </div>
              {CAMPOS_AVALIACAO.map(([campo, rotulo]) => (
                <div key={campo}>
                  <span>{rotulo}</span>
                  <strong>{aberta[campo] ?? "—"}</strong>
                </div>
              ))}
            </div>

            {aberta.observacao && (
              <p className="observacao-avaliacao">{aberta.observacao}</p>
            )}

            {lerFotos(aberta.fotos).length > 0 && (
              <div className="grade-fotos-avaliacao">
                {lerFotos(aberta.fotos).map((foto) => (
                  <figure key={foto.id}>
                    <img src={foto.url} alt={foto.nome || "Foto da avaliação"} />
                  </figure>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Um número da avaliação mais recente e o quanto ele andou desde a primeira.
 *
 * A seta é neutra por padrão: para peso, gordura e cintura, cair costuma ser o
 * objetivo; para massa muscular é o contrário. Não damos veredito de "bom" ou
 * "ruim" com cor — objetivo é do aluno com o personal, e um verde errado na
 * tela de alguém em ganho de peso seria pior que não colorir nada.
 */
function Metrica({ rotulo, valor, unidade, inicial, subirEBom = false }) {
  if (valor == null) {
    return (
      <div className="metrica-evolucao vazia">
        <span className="rotulo">{rotulo}</span>
        <strong>—</strong>
        <span className="variacao">não medido</span>
      </div>
    );
  }

  const diferenca = inicial == null ? null : Number((valor - inicial).toFixed(1));
  const parado = diferenca === 0 || diferenca === null;
  const subiu = diferenca > 0;
  const Icone = parado ? Minus : subiu ? ArrowUp : ArrowDown;

  return (
    <div className="metrica-evolucao">
      <span className="rotulo">{rotulo}</span>
      <strong>
        {valor}
        {unidade && <em>{unidade}</em>}
      </strong>
      <span className={`variacao${parado ? "" : subiu === subirEBom ? " positiva" : ""}`}>
        <Icone size={13} aria-hidden="true" />
        {diferenca === null
          ? "primeira medição"
          : parado
            ? "sem mudança"
            : `${subiu ? "+" : ""}${diferenca}${unidade ?? ""} desde o início`}
      </span>
    </div>
  );
}
