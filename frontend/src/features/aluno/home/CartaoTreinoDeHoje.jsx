import { CalendarOff, Dumbbell, Play } from "lucide-react";

import BarraProgresso from "../../../components/BarraProgresso.jsx";
import { contar, dataCurta, kg, minutos } from "./formato.js";

/**
 * O treino de hoje — o card que ocupa a área mais valiosa da tela.
 *
 * A pergunta que o aluno traz ao abrir o app é "o que eu faço hoje", e a
 * segunda é "como foi da última vez". As duas ficam aqui, uma acima da outra,
 * porque a segunda é o que ancora a decisão de carga da primeira.
 */
export default function CartaoTreinoDeHoje({ treinos, aoIniciar, aoAbrir }) {
  if (treinos.length === 0) {
    return (
      <section className="painel cartao-hoje vazio">
        <span className="icone-descanso" aria-hidden="true">
          <CalendarOff size={20} />
        </span>
        <div>
          <h2>Sem treino hoje</h2>
          <p>Dia de descanso — recuperação também faz parte.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      {treinos.map((treino) => {
        const emAndamento = treino.sessao_aberta_id != null;
        const comecou = treino.concluidos > 0;
        const ultima = treino.ultima_vez;

        return (
          <section className="painel cartao-hoje" key={treino.treino_id}>
            <header>
              <span className="etiqueta">Treino de hoje</span>
              <div className="titulo">
                <span className="icone-treino" aria-hidden="true">
                  <Dumbbell size={18} />
                </span>
                <div>
                  <h2>{treino.nome}</h2>
                  <span>{contar(treino.total_exercicios, "exercício")}</span>
                </div>
              </div>
            </header>

            {comecou && (
              <BarraProgresso
                valor={treino.concluidos}
                total={treino.total_exercicios}
                rotulo="Progresso de hoje"
              />
            )}

            {ultima && (
              <div className="ultima-vez">
                <span className="rotulo">Última vez · {dataCurta(ultima.data)}</span>
                <span className="numeros">
                  {contar(ultima.exercicios ?? 0, "exercício")}
                  {" · "}
                  {contar(ultima.series ?? 0, "série")}
                  {ultima.duracao_segundos != null && (
                    <> {" · "}{minutos(ultima.duracao_segundos)}</>
                  )}
                  {ultima.volume_kg != null && (
                    <>
                      {" · "}
                      {kg(ultima.volume_kg, { estimado: ultima.volume_estimado })}
                    </>
                  )}
                </span>
              </div>
            )}

            <div className="acoes-hoje">
              <button
                type="button"
                className="primario"
                onClick={() => (emAndamento || comecou ? aoAbrir(treino) : aoIniciar(treino))}
              >
                {emAndamento || comecou ? (
                  "Continuar treino"
                ) : (
                  <>
                    <Play size={15} /> Iniciar treino
                  </>
                )}
              </button>
              {!emAndamento && !comecou && (
                <button type="button" className="link" onClick={() => aoAbrir(treino)}>
                  só ver os exercícios
                </button>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
