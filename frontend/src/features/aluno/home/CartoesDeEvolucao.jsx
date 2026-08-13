import { Dumbbell, History, MessageCircle, Repeat2, Salad, Scale, Trophy } from "lucide-react";

import Avatar from "../../../components/Avatar.jsx";
import BarraProgresso from "../../../components/BarraProgresso.jsx";
import Sparkline from "../../../components/Sparkline.jsx";
import { formatarTelefone } from "../../../utils/telefone.js";
import { contar, dataCurta, delta, kg, minutos, numero } from "./formato.js";

/**
 * Evolução de carga: o exercício com mais histórico, e o quanto ele andou.
 *
 * Escolhido pelo servidor por número de execuções, não pela carga mais alta —
 * o card serve para mostrar evolução, e evolução precisa de pontos.
 */
export function CartaoEvolucaoCarga({ carga, aoAbrir }) {
  if (!carga || carga.pontos.length === 0) return null;

  return (
    <section className="painel cartao-evolucao">
      <h2 className="titulo-secao">Evolução de carga</h2>
      <p className="apoio-secao">{carga.exercicio?.nome ?? carga.exercicio_id}</p>

      <div className="numero-destaque">
        <strong>{kg(carga.atual_kg)}</strong>
        {carga.delta_kg != null && carga.delta_kg !== 0 && (
          <span className={carga.delta_kg > 0 ? "positiva" : ""}>
            {delta(carga.delta_kg, " kg")}
          </span>
        )}
      </div>

      <Sparkline
        pontos={carga.pontos.map((p) => ({ data: p.data, valor: p.carga_kg }))}
        escalaTemporal
        rotulo={`Evolução de carga em ${carga.pontos.length} sessões`}
      />

      <button type="button" className="link" onClick={aoAbrir}>
        Ver minha evolução
      </button>
    </section>
  );
}

/** A última ida à academia, com o que ela produziu. */
export function CartaoUltimoTreino({ treino, aoAbrir }) {
  if (!treino) return null;

  return (
    <section className="painel cartao-ultimo-treino">
      <h2 className="titulo-secao">Último treino</h2>
      <p className="apoio-secao">
        {treino.treino_nome} · {dataCurta(treino.data)}
        {treino.duracao_segundos != null && ` · ${minutos(treino.duracao_segundos)}`}
      </p>

      <ul className="numeros-treino">
        <li>
          <strong>
            <Dumbbell size={20} aria-hidden="true" />
            {numero(treino.exercicios ?? 0)}
          </strong>
          <span>exercícios</span>
        </li>
        <li>
          <strong>
            <Repeat2 size={20} aria-hidden="true" />
            {numero(treino.series ?? 0)}
          </strong>
          <span>séries</span>
        </li>
      </ul>

      {treino.treino_id && (
        <button type="button" className="link" onClick={() => aoAbrir(treino)}>
          <History size={14} /> Ver execução
        </button>
      )}
    </section>
  );
}

/** Peso, gordura e massa — o que muda devagar. */
export function CartaoEvolucaoCorporal({ corpo, aoAbrir }) {
  if (!corpo) return null;

  const linhas = [
    ["Peso", corpo.peso_kg, " kg", false],
    ["Gordura", corpo.percentual_gordura, "%", false],
    ["Massa muscular", corpo.massa_muscular_kg, " kg", true],
  ].filter(([, campo]) => campo?.valor != null);

  if (linhas.length === 0) return null;

  return (
    <section className="painel cartao-corpo">
      <h2 className="titulo-secao">Evolução corporal</h2>
      <p className="apoio-secao">
        Medição de {dataCurta(corpo.data)}
        {corpo.data_anterior && ` · vs. ${dataCurta(corpo.data_anterior)}`}
      </p>

      <ul className="linhas-corpo">
        {linhas.map(([rotulo, campo, unidade, subirEBom]) => (
          <li key={rotulo}>
            <span>{rotulo}</span>
            <strong>
              {campo.valor}
              {unidade}
            </strong>
            {campo.delta != null && campo.delta !== 0 && (
              // Verde só quando o sentido é inequívoco: massa subindo é ganho,
              // peso caindo pode ser objetivo de um e problema de outro.
              <em className={campo.delta > 0 === subirEBom ? "positiva" : ""}>
                {delta(campo.delta, unidade)}
              </em>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="link" onClick={aoAbrir}>
        <Scale size={14} /> Ver avaliações
      </button>
    </section>
  );
}

/** Quanto do plano alimentar já foi cumprido hoje. */
export function CartaoPlanoAlimentar({ dieta, aoAbrir }) {
  if (!dieta) return null;

  return (
    <section className="painel cartao-dieta">
      <h2 className="titulo-secao">Plano alimentar</h2>
      <p className="apoio-secao">{dieta.nome}</p>

      <div className="numero-destaque">
        <strong>
          {numero(dieta.calorias_consumidas)}
          <em> / {numero(dieta.calorias_meta)} kcal</em>
        </strong>
      </div>

      {dieta.total_refeicoes > 0 && (
        <BarraProgresso
          valor={dieta.refeicoes_concluidas}
          total={dieta.total_refeicoes}
          rotulo="Refeições de hoje"
        />
      )}

      <button type="button" className="link" onClick={aoAbrir}>
        <Salad size={14} /> Ver dieta
      </button>
    </section>
  );
}

/**
 * Recorde pessoal — **no máximo um, e só dos últimos dias**.
 *
 * A moderação é o ponto: o servidor já filtra por 7 dias e exige 3 execuções
 * anteriores. Troféu em toda tela é como esse tipo de feature perde o sentido.
 */
export function CartaoRecorde({ recorde }) {
  if (!recorde) return null;

  return (
    <section className="painel cartao-recorde">
      <span className="icone" aria-hidden="true">
        <Trophy size={18} />
      </span>
      <div>
        <strong>Novo recorde pessoal</strong>
        <span>
          {recorde.exercicio?.nome ?? recorde.exercicio_id} · {kg(recorde.carga_kg)}
        </span>
        <em>Seu recorde anterior era {kg(recorde.anterior_kg)}.</em>
      </div>
    </section>
  );
}

/**
 * Quem treina o aluno, em uma faixa fina.
 *
 * Era um card gigante ocupando a área mais nobre da tela. Continua no topo, mas
 * **compacto**: o aluno já sabe quem é o personal dele, então isto aqui é
 * cabeçalho de contexto, não conteúdo — o que ele veio buscar é o treino de
 * hoje, logo abaixo. O telefone vira link de conversa direto.
 */
export function CartaoPersonal({ personal, aoAbrir }) {
  if (!personal) return null;

  return (
    <button type="button" className="painel cartao-personal compacto" onClick={aoAbrir}>
      <Avatar usuario={personal} tamanho={36} />
      <div className="info">
        <span className="rotulo">Seu personal</span>
        <strong>{personal.nome}</strong>
        <span className="email-personal">{personal.email}</span>
      </div>
      <div className="contato-rapido">
        {personal.telefone ? (
          <span>
            <MessageCircle size={22} aria-hidden="true" />
            {formatarTelefone(personal.telefone)}
          </span>
        ) : (
          <span aria-label="Chat do personal">
            <MessageCircle size={22} aria-hidden="true" />
          </span>
        )}
      </div>
    </button>
  );
}

export { Dumbbell };
