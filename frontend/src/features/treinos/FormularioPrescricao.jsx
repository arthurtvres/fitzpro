import { useState } from "react";

/** Séries, repetições, carga, descanso e observação de um exercício no treino. */
export default function FormularioPrescricao({ item, exercicio, aoSalvar, aoCancelar }) {
  const [dados, setDados] = useState({
    series: String(item?.series ?? 3),
    repeticoes: item?.repeticoes ?? "10",
    carga_kg: item?.carga_kg == null ? "" : String(item.carga_kg),
    descanso_segundos:
      item?.descanso_segundos == null ? "" : String(item.descanso_segundos),
    observacao: item?.observacao ?? "",
  });
  const [salvando, setSalvando] = useState(false);

  const alterar = (campo) => (evento) =>
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));

  /** Campos numéricos opcionais viram null quando ficam em branco. */
  const numeroOuNulo = (valor) => (valor === "" ? null : Number(valor));

  async function enviar(evento) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await aoSalvar({
        exercicio_id: exercicio.id,
        series: Number(dados.series),
        repeticoes: dados.repeticoes.trim(),
        carga_kg: numeroOuNulo(dados.carga_kg),
        descanso_segundos: numeroOuNulo(dados.descanso_segundos),
        observacao: dados.observacao.trim() || null,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <p className="meta">
        <strong>{exercicio.nome}</strong>
        {exercicio.equipamento_pt ? ` · ${exercicio.equipamento_pt}` : ""}
      </p>

      <div className="linha">
        <div className="campo">
          <label htmlFor="presc-series">Séries</label>
          <input
            id="presc-series"
            type="number"
            min="1"
            max="20"
            value={dados.series}
            onChange={alterar("series")}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="presc-reps">Repetições</label>
          <input
            id="presc-reps"
            value={dados.repeticoes}
            onChange={alterar("repeticoes")}
            placeholder="8-12"
            required
          />
        </div>
      </div>

      <div className="linha">
        <div className="campo">
          <label htmlFor="presc-carga">Carga (kg)</label>
          <input
            id="presc-carga"
            type="number"
            min="0"
            step="0.5"
            value={dados.carga_kg}
            onChange={alterar("carga_kg")}
            placeholder="opcional"
          />
        </div>
        <div className="campo">
          <label htmlFor="presc-descanso">Descanso (s)</label>
          <input
            id="presc-descanso"
            type="number"
            min="0"
            step="15"
            value={dados.descanso_segundos}
            onChange={alterar("descanso_segundos")}
            placeholder="opcional"
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="presc-obs">Observação</label>
        <textarea
          id="presc-obs"
          rows="2"
          value={dados.observacao}
          onChange={alterar("observacao")}
          placeholder="opcional — ex.: cadência lenta na descida"
        />
      </div>

      <div className="acoes-form">
        <button type="button" onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="primario" disabled={salvando}>
          {salvando ? "Salvando..." : item ? "Salvar alterações" : "Adicionar ao treino"}
        </button>
      </div>
    </form>
  );
}
