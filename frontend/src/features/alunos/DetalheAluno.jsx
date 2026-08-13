import { useState } from "react";

import Avatar from "../../components/Avatar.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import { CONFIG_DIETA, CONFIG_TREINO } from "../planos/config.js";
import DetalhePlano from "../planos/DetalhePlano.jsx";
import PainelPlano from "../planos/PainelPlano.jsx";
import PainelProgressao from "../progressao/PainelProgressao.jsx";
import PainelAvaliacoes from "./PainelAvaliacoes.jsx";

/**
 * Conteúdo do modal do aluno: dados, situação e as abas de treinos e dietas.
 * Quem abre e fecha é o App; aqui não há wrapper de card — o modal já é um.
 */
export default function DetalheAluno({ aluno, aoErrar, aoMontarTreino }) {
  const [aba, setAba] = useState("treinos");
  const [visualizando, setVisualizando] = useState(null);

  const config = aba === "treinos" ? CONFIG_TREINO : CONFIG_DIETA;

  const detalhes = [
    aluno.email,
    aluno.idade != null ? `${aluno.idade} anos` : null,
    aluno.altura_cm ? `${aluno.altura_cm} cm` : null,
    aluno.objetivo || null,
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
          Aluno inativo — a API recusa criar ou editar treinos e dietas até que ele
          seja reativado.
        </p>
      )}

      <div className="abas">
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
      {aba === "progressao" ? (
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
