import Skeleton from "../../components/Skeleton.jsx";
import CalendarioDaSemana from "./home/CalendarioDaSemana.jsx";
import CartaoTreinoDeHoje from "./home/CartaoTreinoDeHoje.jsx";
import CartoesDaSemana from "./home/CartoesDaSemana.jsx";
import {
  CartaoEvolucaoCarga,
  CartaoEvolucaoCorporal,
  CartaoPersonal,
  CartaoPlanoAlimentar,
  CartaoRecorde,
  CartaoUltimoTreino,
} from "./home/CartoesDeEvolucao.jsx";

/**
 * A Home do aluno, organizada em torno de execução.
 *
 * Antes era um painel de contadores — "treinos na semana: 3", "dias com treino:
 * 2" — que não usava o recurso mais valioso do sistema: o que o aluno de fato
 * fez. E o card do personal ocupava o topo, informação que ele já sabe.
 *
 * A hierarquia agora responde às perguntas na ordem em que elas aparecem:
 *
 *   1. o que eu faço hoje, e como foi da última vez
 *   2. como está a semana, sou consistente, quanto levantei
 *   3. onde estou no calendário
 *   4. minha carga está subindo? como foi o último treino?
 *   5. e o corpo? e a dieta?
 *   6. quem é meu personal
 *
 * Este componente não busca nada: tudo vem do `/progressao/resumo`, uma
 * requisição só, montada no servidor. Ele é composição pura.
 */
export default function HojeDoAluno({
  resumo,
  carregando,
  aoIniciarTreino,
  aoAbrirTreino,
  aoAbrirDietas,
  aoAbrirEvolucao,
}) {
  if (carregando || !resumo) {
    return (
      <div className="painel">
        <Skeleton quantidade={3} />
      </div>
    );
  }

  return (
    <div className="aluno-home">
      <CartaoPersonal personal={resumo.personal} />

      <div className="dupla-cartoes">
        <CartaoPlanoAlimentar dieta={resumo.dieta} aoAbrir={aoAbrirDietas} />
        <CartaoUltimoTreino treino={resumo.ultimo_treino} aoAbrir={aoAbrirTreino} />
      </div>

      <CartaoRecorde recorde={resumo.recorde} />

      <CartaoTreinoDeHoje
        treinos={resumo.hoje.treinos}
        aoIniciar={aoIniciarTreino}
        aoAbrir={aoAbrirTreino}
      />

      <CartoesDaSemana
        semana={resumo.semana}
        consistencia={resumo.consistencia}
      />

      <CalendarioDaSemana semana={resumo.semana} />

      <div className="dupla-cartoes">
        <CartaoEvolucaoCarga carga={resumo.carga_destaque} aoAbrir={aoAbrirEvolucao} />
        <CartaoEvolucaoCorporal corpo={resumo.corpo} aoAbrir={aoAbrirEvolucao} />
      </div>
    </div>
  );
}
