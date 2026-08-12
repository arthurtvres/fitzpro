import { CalendarCheck, Dumbbell, Mail, Phone, Salad, Sunrise } from "lucide-react";

import Avatar from "../../components/Avatar.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { formatarTelefone } from "../../utils/telefone.js";
import { DIAS } from "../planos/config.js";

/**
 * O dia do aluno: o que treinar hoje, e o que existe no resto da semana.
 *
 * Tudo aqui é derivado do que a API já respondeu — nada de métrica inventada.
 * "Hoje" sai do `dia_semana` do treino, que é um campo real; enquanto não
 * existir modelo de agendamento com horário, não há horário para mostrar.
 */
export default function HojeDoAluno({
  treinos,
  dietas,
  personal,
  carregando,
  aoAbrirTreinos,
  aoAbrirDietas,
}) {
  if (carregando) {
    return (
      <div className="painel">
        <Skeleton quantidade={3} />
      </div>
    );
  }

  // getDay(): 0 = domingo. DIAS começa na segunda, daí o deslocamento.
  const hoje = DIAS[(new Date().getDay() + 6) % 7];
  const doDia = treinos.filter((t) => t.dia_semana === hoje);
  const outros = treinos.filter((t) => t.dia_semana !== hoje);

  return (
    <div className="aluno-hoje">
      {personal && <CartaoDoPersonal personal={personal} />}

      <section className="painel destaque-hoje">
        <header>
          <Sunrise size={18} aria-hidden="true" />
          <div>
            <h2>Hoje é {hoje}</h2>
            <p>
              {doDia.length === 0
                ? "Nenhum treino marcado para hoje. Dia de descanso."
                : doDia.length === 1
                  ? "Você tem 1 treino para hoje."
                  : `Você tem ${doDia.length} treinos para hoje.`}
            </p>
          </div>
        </header>

        {doDia.length > 0 && (
          <ul className="lista-treino-hoje">
            {doDia.map((treino) => (
              <li key={treino.id}>
                <span className="icone-treino" aria-hidden="true">
                  <Dumbbell size={16} />
                </span>
                <div>
                  <strong>{treino.nome}</strong>
                  <span>
                    {treino.total_exercicios === 1
                      ? "1 exercício"
                      : `${treino.total_exercicios} exercícios`}
                    {treino.descricao ? ` · ${treino.descricao}` : ""}
                  </span>
                </div>
                <button type="button" className="primario" onClick={aoAbrirTreinos}>
                  Ver treino
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="cartoes-resumo-aluno">
        <CartaoResumo
          icone={<Dumbbell size={16} />}
          titulo="Treinos na semana"
          valor={treinos.length}
          apoio={
            outros.length > 0
              ? `${outros.length} em outros dias`
              : "Nenhum em outro dia"
          }
          aoAbrir={aoAbrirTreinos}
          rotuloAcao="Ver todos"
        />
        <CartaoResumo
          icone={<Salad size={16} />}
          titulo="Plano alimentar"
          valor={dietas.length}
          apoio={
            dietas.length === 0
              ? "Seu personal ainda não montou"
              : "Toque para ver as refeições"
          }
          aoAbrir={dietas.length > 0 ? aoAbrirDietas : undefined}
          rotuloAcao="Ver dieta"
        />
        <CartaoResumo
          icone={<CalendarCheck size={16} />}
          titulo="Dias com treino"
          valor={new Set(treinos.map((t) => t.dia_semana)).size}
          apoio="de 7 dias da semana"
        />
      </div>
    </div>
  );
}

/**
 * Quem treina este aluno, com o contato.
 *
 * O e-mail e o telefone são links de verdade (`mailto:` e `tel:`) porque o
 * motivo de mostrar o contato é usá-lo — no celular, tocar já liga.
 */
function CartaoDoPersonal({ personal }) {
  return (
    <section className="painel cartao-personal">
      <Avatar usuario={personal} tamanho={48} />

      <div className="info">
        <span className="rotulo">Seu personal</span>
        <strong>{personal.nome}</strong>

        <div className="contatos">
          <a href={`mailto:${personal.email}`}>
            <Mail size={13} aria-hidden="true" />
            {personal.email}
          </a>
          {personal.telefone && (
            <a href={`tel:+55${personal.telefone}`}>
              <Phone size={13} aria-hidden="true" />
              {formatarTelefone(personal.telefone)}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function CartaoResumo({ icone, titulo, valor, apoio, aoAbrir, rotuloAcao }) {
  return (
    <article className="painel cartao-resumo-aluno">
      <span className="icone-resumo" aria-hidden="true">
        {icone}
      </span>
      <strong className="valor">{valor}</strong>
      <span className="titulo">{titulo}</span>
      <span className="apoio">{apoio}</span>
      {aoAbrir && (
        <button type="button" className="link" onClick={aoAbrir}>
          {rotuloAcao}
        </button>
      )}
    </article>
  );
}
