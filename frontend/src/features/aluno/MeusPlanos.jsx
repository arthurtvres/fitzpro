import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Dumbbell, Salad } from "lucide-react";

import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { CONFIG_DIETA, CONFIG_TREINO } from "../planos/config.js";
import DetalhePlano from "../planos/DetalhePlano.jsx";

/**
 * Treinos ou dietas do aluno: lista e, ao escolher um, o conteúdo dele.
 *
 * O detalhe reusa `DetalhePlano`, o mesmo que o personal vê no modal do aluno.
 * Para treino ele delega ao `DetalheTreino` em `somenteLeitura`, que já existia
 * — o aluno enxerga séries, repetições, carga e as instruções do catálogo, sem
 * arrastar, editar nem remover.
 *
 * Abre em tela cheia, e não em modal como no painel do personal: aqui isto é o
 * conteúdo principal, e boa parte do uso é no celular durante o treino.
 */
export default function MeusPlanos({
  tipo,
  itens,
  carregando,
  aoErrar,
  aoRegistrar,
  aoVerHistorico,
}) {
  const config = tipo === "treinos" ? CONFIG_TREINO : CONFIG_DIETA;
  const [aberto, setAberto] = useState(null);

  // Trocar de seção pelo menu fecha o que estava aberto.
  useEffect(() => setAberto(null), [tipo]);

  if (carregando) {
    return (
      <section className="painel">
        <Skeleton quantidade={3} />
      </section>
    );
  }

  if (aberto) {
    return (
      <section className="painel">
        <button type="button" className="link voltar-plano" onClick={() => setAberto(null)}>
          <ArrowLeft size={15} /> Voltar
        </button>
        <DetalhePlano
          config={config}
          item={aberto}
          aoErrar={aoErrar}
          modoExecucao
          aoRegistrar={aoRegistrar}
          aoVerHistorico={aoVerHistorico}
        />
      </section>
    );
  }

  if (itens.length === 0) {
    return (
      <section className="painel">
        <Vazio icone={tipo === "treinos" ? Dumbbell : Salad}>
          {tipo === "treinos"
            ? "Seu personal ainda não montou nenhum treino para você."
            : "Seu personal ainda não montou seu plano alimentar."}
        </Vazio>
      </section>
    );
  }

  return (
    <section className="painel">
      <ul className="lista-planos-aluno">
        {itens.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => setAberto(item)}>
              <span className="icone-treino" aria-hidden="true">
                {tipo === "treinos" ? <Dumbbell size={16} /> : <Salad size={16} />}
              </span>

              <span className="info">
                <strong>{item.nome}</strong>
                <span>{subtitulo(tipo, item)}</span>
              </span>

              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function subtitulo(tipo, item) {
  if (tipo !== "treinos") {
    if (item.refeicoes_concluidas_hoje > 0) {
      return `${item.refeicoes_concluidas_hoje} de ${item.total_refeicoes} refeições hoje · ${item.calorias_consumidas_hoje} kcal`;
    }
    return item.calorias ? `${item.calorias} kcal por dia` : "Plano alimentar";
  }

  const exercicios =
    item.total_exercicios === 1 ? "1 exercício" : `${item.total_exercicios} exercícios`;
  const feitos =
    item.concluidos_hoje > 0
      ? `${item.concluidos_hoje} de ${item.total_exercicios} feitos hoje`
      : null;
  return [item.dia_semana, feitos ?? exercicios].filter(Boolean).join(" · ");
}
