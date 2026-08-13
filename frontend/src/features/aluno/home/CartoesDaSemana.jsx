import { CalendarCheck, Flame } from "lucide-react";

import { contar } from "./formato.js";

/**
 * Números simples da semana. Mantém apenas o que faz sentido imediato para o
 * aluno: se cumpriu os treinos previstos e como anda a consistência.
 */
export default function CartoesDaSemana({ semana, consistencia }) {
  return (
    <div className="cartoes-semana">
      <Cartao
        icone={<CalendarCheck size={16} />}
        rotulo="Esta semana"
        valor={`${semana.feitos}/${semana.previstos}`}
        apoio={contar(semana.feitos, "treino feito", "treinos feitos")}
      />

      {consistencia && (
        <Cartao
          icone={<Flame size={16} />}
          rotulo="Consistência"
          valor={`${consistencia.percentual}%`}
          apoio={`últimas ${consistencia.semanas} semanas`}
          extra={
            consistencia.sequencia_semanas > 1
              ? `${consistencia.sequencia_semanas} semanas seguidas`
              : null
          }
        />
      )}
    </div>
  );
}

function Cartao({ icone, rotulo, valor, apoio, extra }) {
  return (
    <article className="painel cartao-metrica">
      <span className="icone" aria-hidden="true">
        {icone}
      </span>
      <span className="rotulo">{rotulo}</span>
      <strong className="valor">{valor}</strong>
      <span className="apoio">{apoio}</span>
      {extra && <span className="extra">{extra}</span>}
    </article>
  );
}
