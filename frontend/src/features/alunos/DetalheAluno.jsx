import { useState } from "react";

import Avatar from "../../components/Avatar.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import { CONFIG_DIETA, CONFIG_TREINO } from "../planos/config.js";
import DetalhePlano from "../planos/DetalhePlano.jsx";
import PainelPlano from "../planos/PainelPlano.jsx";
import PainelProgressao from "../progressao/PainelProgressao.jsx";
import FichaDoAluno from "./FichaDoAluno.jsx";
import PainelAvaliacoes from "./PainelAvaliacoes.jsx";

/**
 * Conteúdo do modal do aluno: dados, situação e as abas de treinos e dietas.
 * Quem abre e fecha é o App; aqui não há wrapper de card — o modal já é um.
 */
export default function DetalheAluno({ aluno, aoErrar, aoMontarTreino, aoEditar }) {
  // "Informações" e nao "treinos": abrir um aluno é, na maioria das vezes,
  // lembrar quem é a pessoa ou achar o telefone dela. Montar treino tem porta
  // própria — a ação "montar" no cartão do treino.
  const [aba, setAba] = useState("informacoes");
  const [visualizando, setVisualizando] = useState(null);

  const config = aba === "treinos" ? CONFIG_TREINO : CONFIG_DIETA;

  // Sem o objetivo: virou subtítulo do cabeçalho da página, logo acima desta
  // linha. Repetir a mesma frase a 40px de distância só rouba espaço.
  const detalhes = [
    aluno.email,
    aluno.idade != null ? `${aluno.idade} anos` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="resumo-aluno">
        <Avatar usuario={aluno} tamanho={48} />
        <div className="info">
          <strong>{aluno.nome}</strong>
          <span className="meta">{detalhes.join(" · ")}</span>
        </div>
        <Badge tom={aluno.ativo ? "sucesso" : "neutro"} ponto>
          {aluno.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {!aluno.ativo && (
        <p className="aviso-inativo">
          Aluno inativo. Reative antes de prescrever treino ou dieta.
        </p>
      )}

      <div className="abas">
        <button
          className={aba === "informacoes" ? "ativa" : ""}
          onClick={() => setAba("informacoes")}
        >
          Informações
        </button>
        <button
          className={aba === "treinos" ? "ativa" : ""}
          onClick={() => setAba("treinos")}
        >
          Treinos
        </button>
        <button
          className={aba === "dietas" ? "ativa" : ""}
          onClick={() => setAba("dietas")}
        >
          Dietas
        </button>
        <button
          className={aba === "avaliacoes" ? "ativa" : ""}
          onClick={() => setAba("avaliacoes")}
        >
          Avaliações
        </button>
        <button
          className={aba === "progressao" ? "ativa" : ""}
          onClick={() => setAba("progressao")}
        >
          Progressão
        </button>
      </div>

      {/* key força remontar ao trocar de aba/aluno, zerando formulário e lista */}
      {aba === "informacoes" ? (
        <FichaDoAluno aluno={aluno} aoEditar={aoEditar} aoErrar={aoErrar} />
      ) : aba === "progressao" ? (
        <PainelProgressao key={`${aluno.id}-pr`} aluno={aluno} aoErrar={aoErrar} />
      ) : aba === "avaliacoes" ? (
        <PainelAvaliacoes key={`${aluno.id}-av`} aluno={aluno} aoErrar={aoErrar} />
      ) : (
        <PainelPlano
          key={`${aluno.id}-${config.chave}`}
          config={config}
          aluno={aluno}
          aoErrar={aoErrar}
          aoAbrir={aba === "treinos" ? aoMontarTreino : undefined}
          aoVisualizar={(item) => setVisualizando({ config, item })}
        />
      )}

      {visualizando && (
        <Modal
          titulo={visualizando.item.nome}
          largo={visualizando.config.chave === "treinos"}
          aoFechar={() => setVisualizando(null)}
        >
          <DetalhePlano
            config={visualizando.config}
            item={visualizando.item}
            aoErrar={aoErrar}
          />
        </Modal>
      )}
    </>
  );
}
