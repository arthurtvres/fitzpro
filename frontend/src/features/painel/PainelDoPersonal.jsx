import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarX,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  Weight,
} from "lucide-react";

import { api } from "../../api/index.js";
import Avatar from "../../components/Avatar.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { contar, dataCurta, kg, numero } from "../aluno/home/formato.js";
import AtividadeDosAlunos from "./AtividadeDosAlunos.jsx";

/**
 * A semana do personal: quem treinou, quem sumiu, e onde dá para subir carga.
 *
 * A Home dele mostrava contagem de cadastro — quantos alunos, quantos treinos,
 * quantos exercícios no catálogo. Nenhum desses números responde à pergunta que
 * decide se ele continua pagando: *meus alunos estão treinando?*
 *
 * Aqui tudo é execução registrada. A lista vem do servidor **já ordenada por
 * quem precisa de atenção** — quem sumiu primeiro, quem está em dia por último.
 */
export default function PainelDoPersonal({ aoAbrirAluno, aoMontarTreino, aoErrar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    api.painel
      .resumo()
      .then(setDados)
      .catch((e) => aoErrar(e.message))
      .finally(() => setCarregando(false));
  }, [aoErrar]);

  useEffect(carregar, [carregar]);

  if (carregando) return <Skeleton quantidade={4} />;
  if (!dados) return null;

  const { periodo, volume, alunos, sugestoes } = dados;
  if (periodo.alunos_ativos === 0) {
    return (
      <Vazio icone={Users}>
        Nenhum aluno ativo ainda. O acompanhamento aparece assim que você
        cadastrar alguém.
      </Vazio>
    );
  }

  const precisamDeAtencao = alunos.filter((a) => a.situacao !== "em_dia");

  return (
    <div className="painel-personal">
      <div className="grade-metricas">
        <Metrica
          icone={<Activity size={18} />}
          rotulo={`Treinos em ${periodo.dias} dias`}
          valor={numero(periodo.sessoes)}
          nota={`${periodo.alunos_que_treinaram} de ${periodo.alunos_ativos} alunos treinaram`}
          tendencia={periodo.variacao_percentual}
        />
        <Metrica
          icone={<Weight size={18} />}
          rotulo="Volume da carteira"
          valor={kg(volume.total_kg, { estimado: volume.estimado })}
          nota="somado de todos os alunos"
          tendencia={volume.variacao_percentual}
        />
        <Metrica
          icone={<TriangleAlert size={18} />}
          rotulo="Precisam de atenção"
          valor={numero(precisamDeAtencao.length)}
          nota={
            precisamDeAtencao.length === 0
              ? "todos em dia"
              : contar(precisamDeAtencao.length, "aluno", "alunos")
          }
        />
        <Metrica
          icone={<TrendingUp size={18} />}
          rotulo="Prontos para subir"
          valor={numero(dados.total_sugestoes)}
          nota="exercícios com carga batida"
        />
      </div>

      <section className="painel">
        <h2 className="titulo-secao">Atividade dos alunos</h2>
        <p className="apoio-secao">
          Ordenados por quem precisa de você primeiro — quem sumiu no topo, quem
          está em dia por último. Toque no nome para abrir o aluno.
        </p>

        <AtividadeDosAlunos painel={dados} aoAbrirAluno={aoAbrirAluno} />
      </section>

      {sugestoes.length > 0 && (
        <section className="painel">
          <h2 className="titulo-secao">Prontos para subir a carga</h2>
          <p className="apoio-secao">
            O aluno bateu a carga prescrita nas duas últimas sessões. Quem decide
            se sobe é você — o sistema não altera prescrição.
            {dados.total_sugestoes > sugestoes.length &&
              ` Mostrando ${sugestoes.length} de ${dados.total_sugestoes}.`}
          </p>

          <ul className="lista-sugestoes">
            {sugestoes.map((s) => (
              <li key={s.treino_exercicio_id}>
                <div className="info">
                  <strong>{s.exercicio?.nome ?? s.exercicio_id}</strong>
                  <span>
                    {s.aluno_nome} · {s.treino_nome}
                  </span>
                </div>
                <div className="cargas">
                  <span className="prescrita">{kg(s.carga_prescrita_kg)}</span>
                  <span className="seta" aria-hidden="true">
                    →
                  </span>
                  <strong className="atual">{kg(s.ultima_carga_kg)}</strong>
                </div>
                <button
                  type="button"
                  className="link destaque"
                  onClick={() => aoMontarTreino({ id: s.treino_id, nome: s.treino_nome })}
                >
                  ajustar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {precisamDeAtencao.length > 0 && (
        <section className="painel">
          <h2 className="titulo-secao">
            <CalendarX size={16} aria-hidden="true" /> Quem sumiu
          </h2>
          <p className="apoio-secao">
            Sem registro há mais de dez dias, ou muito abaixo do previsto na
            semana. Uma mensagem costuma resolver.
          </p>

          <ul className="lista-sumidos">
            {precisamDeAtencao.map((linha) => (
              <li key={linha.aluno.id}>
                <Avatar usuario={linha.aluno} tamanho={32} />
                <div className="info">
                  <strong>{linha.aluno.nome}</strong>
                  <span>
                    {linha.ultima_sessao
                      ? `último treino em ${dataCurta(linha.ultima_sessao)}`
                      : "nunca registrou um treino"}
                  </span>
                </div>
                {linha.aluno.telefone && (
                  <a className="link destaque" href={`tel:+55${linha.aluno.telefone}`}>
                    ligar
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metrica({ icone, rotulo, valor, nota, tendencia }) {
  return (
    <article className="painel metrica">
      <span className="icone-metrica" aria-hidden="true">
        {icone}
      </span>
      <span className="rotulo">{rotulo}</span>
      <strong className="valor">{valor}</strong>
      <span className="nota">{nota}</span>
      {tendencia != null && (
        <span className={`tendencia${tendencia >= 0 ? " positiva" : ""}`}>
          {tendencia >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {tendencia > 0 ? "+" : ""}
          {tendencia}% vs. período anterior
        </span>
      )}
    </article>
  );
}
