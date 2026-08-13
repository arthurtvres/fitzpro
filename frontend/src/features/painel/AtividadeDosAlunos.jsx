import { Users } from "lucide-react";

import Avatar from "../../components/Avatar.jsx";
import BarraProgresso from "../../components/BarraProgresso.jsx";
import Badge from "../../components/Badge.jsx";
import Vazio from "../../components/Vazio.jsx";
import { contar, quandoFoi } from "../aluno/home/formato.js";

export const SITUACOES = {
  sumido: { rotulo: "Sumido", tom: "erro" },
  sem_registro: { rotulo: "Sem registro", tom: "neutro" },
  atencao: { rotulo: "Atenção", tom: "alerta" },
  em_dia: { rotulo: "Em dia", tom: "sucesso" },
};

/**
 * Quem treinou nos últimos sete dias — a mesma tabela na Home e no
 * Acompanhamento.
 *
 * É um componente só de propósito. A Home mostra a tabela porque é a primeira
 * coisa que o personal abre de manhã; o Acompanhamento mostra por ser a tela do
 * assunto. Duplicar o JSX faria as duas divergirem no primeiro ajuste de
 * coluna, e nada é mais estranho do que dois lugares do mesmo app discordando
 * sobre quem está em dia.
 *
 * Sem coluna de volume: tonelagem responde "o treino foi puxado?", que é uma
 * pergunta do aluno. Aqui a pergunta é "essa pessoa apareceu?".
 */
export default function AtividadeDosAlunos({ painel, aoAbrirAluno }) {
  if (!painel) return null;

  const { periodo, alunos } = painel;
  if (alunos.length === 0) {
    return (
      <Vazio icone={Users}>
        Nenhum aluno ativo ainda. A atividade aparece assim que você cadastrar
        alguém.
      </Vazio>
    );
  }

  return (
    <>
      <p className="resumo-atividade">
        <strong>{contar(periodo.sessoes, "treino concluído", "treinos concluídos")}</strong>
        <span aria-hidden="true">·</span>
        <span>{periodo.alunos_que_treinaram}/{periodo.alunos_ativos} alunos treinaram</span>
        <span aria-hidden="true">·</span>
        <span>{periodo.percentual_ativos}% ativos</span>
      </p>

      <div className="rolagem-tabela">
        <table className="tabela">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Último treino</th>
              <th>{periodo.dias} dias</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((linha) => {
              const situacao = SITUACOES[linha.situacao] ?? SITUACOES.sem_registro;
              return (
                <tr
                  key={linha.aluno.id}
                  className={linha.situacao === "sumido" ? "destacada" : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className="celula-aluno"
                      onClick={() => aoAbrirAluno(linha.aluno)}
                    >
                      <Avatar usuario={linha.aluno} tamanho={28} />
                      <strong>{linha.aluno.nome}</strong>
                    </button>
                  </td>
                  <td>{quandoFoi(linha.dias_sem_treinar, linha.ultima_sessao_em)}</td>
                  <td>
                    {linha.previstos > 0 ? (
                      <>
                        {linha.feitos}/{linha.previstos}
                        <BarraProgresso valor={linha.feitos} total={linha.previstos} />
                      </>
                    ) : (
                      <span className="sub">Sem treino montado</span>
                    )}
                  </td>
                  <td>
                    <Badge tom={situacao.tom} ponto>
                      {situacao.rotulo}
                    </Badge>
                  </td>
                  <td className="acoes-celula">
                    {linha.prontos_para_subir > 0 && (
                      <Badge tom="alerta">{linha.prontos_para_subir} p/ subir</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
