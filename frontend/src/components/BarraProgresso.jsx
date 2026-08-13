/**
 * Quanto já foi feito de um total.
 *
 * Genérico de propósito: serve aos exercícios de um treino e às refeições de um
 * dia. Fica em `components/` porque as duas features usam.
 *
 * `role="progressbar"` com os valores em aria: a barra é informação, não
 * decoração, e quem usa leitor de tela precisa dela tanto quanto quem enxerga.
 */
export default function BarraProgresso({ valor, total, rotulo, className = "" }) {
  const percentual = total ? Math.round((100 * valor) / total) : 0;
  const completo = total > 0 && valor >= total;

  return (
    <div className={`progresso ${className}`.trim()}>
      {rotulo && (
        <div className="progresso-topo">
          <span>{rotulo}</span>
          <strong>
            {valor} de {total}
          </strong>
        </div>
      )}

      <div
        className={`barra-progresso${completo ? " completa" : ""}`}
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={rotulo || "Progresso"}
      >
        <span style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}
