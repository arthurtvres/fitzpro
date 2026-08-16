import { useEffect, useState } from "react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";

/** Instruções e fotos de um exercício do catálogo. */
export default function DetalheExercicio({ exercicioId, aoFechar, aoErrar }) {
  const [exercicio, setExercicio] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api.exercicios
      .buscar(exercicioId)
      .then((dados) => !cancelado && setExercicio(dados))
      .catch((e) => !cancelado && aoErrar(e.message));
    return () => {
      cancelado = true;
    };
  }, [exercicioId, aoErrar]);

  return (
    <Modal titulo={exercicio?.nome ?? "Carregando..."} aoFechar={aoFechar} largo>
      {!exercicio ? (
        <p className="vazio">Carregando...</p>
      ) : (
        <>
          <div className="selos-exercicio">
            {/* mecanica_pt/forca_pt são específicos do free-exercise-db — um
                exercício da biblioteca do personal não os tem. */}
            <span className="selo">{exercicio.equipamento_pt}</span>
            {exercicio.nivel_pt && <span className="selo">{exercicio.nivel_pt}</span>}
            {exercicio.categoria_pt && <span className="selo">{exercicio.categoria_pt}</span>}
            {exercicio.mecanica_pt && <span className="selo">{exercicio.mecanica_pt}</span>}
            {exercicio.forca_pt && <span className="selo">{exercicio.forca_pt}</span>}
            {exercicio.fonte === "personal" && <span className="selo">meu</span>}
          </div>

          <p className="meta">
            <strong>Principais:</strong>{" "}
            {exercicio.musculos_primarios_pt.join(", ") || "—"}
            {exercicio.musculos_secundarios_pt?.length > 0 && (
              <>
                {" · "}
                <strong>Secundários:</strong>{" "}
                {exercicio.musculos_secundarios_pt.join(", ")}
              </>
            )}
          </p>

          {exercicio.imagens.length > 0 && (
            <div className="fotos-exercicio">
              {exercicio.imagens.map((url) => (
                <img key={url} src={url} alt={exercicio.nome} loading="lazy" />
              ))}
            </div>
          )}

          {/* As instruções vêm do dataset em inglês. */}
          <ol className="instrucoes">
            {exercicio.instrucoes.map((passo, indice) => (
              <li key={indice}>{passo}</li>
            ))}
          </ol>
        </>
      )}
    </Modal>
  );
}
