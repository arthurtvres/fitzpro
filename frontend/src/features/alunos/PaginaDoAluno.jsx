import { useEffect, useState } from "react";

import { api } from "../../api/index.js";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { Users } from "lucide-react";
import DetalheAluno from "./DetalheAluno.jsx";

/**
 * O aluno como destino, e não como camada por cima da lista.
 *
 * Antes isto era um `Modal largo` aberto sobre a tela de alunos, e o sintoma de
 * que tinha passado do ponto era o empilhamento: ver um treino dentro do
 * detalhe abria modal sobre modal. Modal é para interrupção curta com uma
 * decisão; aqui o personal fica, navega entre cinco abas e preenche formulário.
 *
 * **Busca por id, sempre.** É o que faz a URL valer: colar /alunos/12 numa aba
 * nova, dar F5 ou voltar pelo histórico chega aqui sem nenhum estado do React
 * preservado.
 *
 * Havia um atalho aqui — usar o aluno que a lista já tinha, para não mostrar
 * spinner. Ele caiu quando a listagem passou a devolver um resumo: o resumo não
 * tem nascimento, sexo nem endereço, e a ficha piscaria "—" nesses campos até a
 * busca responder. Mostrar o esqueleto por um instante é melhor que mostrar
 * dado errado por um instante.
 */
export default function PaginaDoAluno({ alunoId, aoErrar, ...resto }) {
  const [aluno, setAluno] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [sumido, setSumido] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setSumido(false);

    api.alunos
      .buscar(alunoId)
      .then((dados) => !cancelado && setAluno(dados))
      .catch(() => {
        if (cancelado) return;
        // 404 aqui é aluno de outro personal ou id inventado — a mesma resposta
        // nos dois casos, de propósito (ver `aluno_do_tenant` no backend). Não
        // vira erro global: a tela toda é sobre este aluno.
        setSumido(true);
      })
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  if (carregando && !aluno) return <Skeleton quantidade={4} />;
  if (sumido && !aluno) {
    return (
      <Vazio icone={Users}>
        Aluno não encontrado. Ele pode ter sido removido, ou o endereço está
        errado.
      </Vazio>
    );
  }
  if (!aluno) return null;

  return (
    <section className="painel pagina-aluno">
      <DetalheAluno aluno={aluno} aoErrar={aoErrar} {...resto} />
    </section>
  );
}
