import { Check, Circle, Dot, Minus, X } from "lucide-react";

/**
 * A semana de relance: onde você esteve e o que ainda falta.
 *
 * **Nenhuma lógica de data aqui.** O servidor manda os 7 dias com o estado já
 * resolvido, porque "previsto" depende de comparar o `dia_semana` do treino com
 * o dia do calendário — e foi exatamente essa comparação, feita no cliente, que
 * produziu o bug de um treino "terça" sumir da tela do aluno.
 */
const GLIFOS = {
  feito: { icone: Check, titulo: "treino feito" },
  hoje: { icone: Dot, titulo: "hoje" },
  previsto: { icone: Circle, titulo: "treino previsto" },
  perdido: { icone: X, titulo: "treino não realizado" },
  vazio: { icone: Minus, titulo: "Sem treino" },
};

export default function CalendarioDaSemana({ semana }) {
  return (
    <section className="painel calendario-semana">
      <h2 className="titulo-secao">Sua semana</h2>

      <ol className="grade-semana">
        {semana.dias.map((dia) => {
          const { icone: Icone, titulo } = GLIFOS[dia.estado] ?? GLIFOS.vazio;
          const legenda = dia.estado === "feito" ? "feito" : "";

          return (
            <li key={dia.indice} className={`dia ${dia.estado}`}>
              <span className="sigla">{dia.sigla}</span>
              <span className="marca" title={titulo} aria-label={`${dia.sigla}: ${titulo}`}>
                <Icone size={dia.estado === "hoje" ? 20 : 14} />
              </span>
              {legenda && <span className="legenda">{legenda}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
