import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, GripVertical, History, Pencil, Trash2 } from "lucide-react";

/** "2026-08-12" -> "12/08". A série de carga é sempre do ano corrente na prática. */
const formatarData = (iso) => iso.split("-").reverse().slice(0, 2).join("/");

/** Descreve a prescrição em uma linha: "4 × 8-12 · 60 kg · 90s". */
export function resumirPrescricao(item) {
  const partes = [`${item.series} × ${item.repeticoes}`];
  if (item.carga_kg != null) partes.push(`${item.carga_kg} kg`);
  if (item.descanso_segundos != null) partes.push(`${item.descanso_segundos}s`);
  return partes.join(" · ");
}

/**
 * Uma linha do treino. Arrastar pela alça é o caminho do mouse; os botões ↑↓
 * fazem o mesmo pelo teclado e continuam sendo o caminho acessível.
 */
export default function ItemPrescricao({
  item,
  indice,
  total,
  aoDetalhar,
  aoEditar,
  aoRemover,
  aoMover,
  // Modo execução: `aoAlternar` ausente significa que a linha é só de consulta,
  // mesma convenção das props acima.
  aoAlternar,
  aoVerHistorico,
}) {
  const concluido = Boolean(item.concluido);
  const historico = item.historico;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const estilo = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Mantém a linha arrastada acima das outras enquanto se move.
    zIndex: isDragging ? 1 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={estilo}
      className={`cartao${isDragging ? " arrastando" : ""}${
        concluido ? " concluido" : ""
      }`}
    >
      {aoMover && (
        <button
          type="button"
          className="alca"
          aria-label={`Arrastar ${item.exercicio?.nome ?? "exercício"}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      )}

      {!aoAlternar && <span className="posicao">{indice + 1}</span>}

      {item.exercicio?.imagem && (
        <button
          type="button"
          className="miniatura pequena"
          onClick={() => aoDetalhar(item.exercicio_id)}
          title="Ver instruções"
        >
          <img src={item.exercicio.imagem} alt="" loading="lazy" />
        </button>
      )}

      <div className="corpo">
        <div className="titulo">
          {/* Se o id sumir do catálogo, ainda mostramos algo útil. */}
          {item.exercicio?.nome ?? item.exercicio_id}
          <span className="selo">{resumirPrescricao(item)}</span>
        </div>
        <div className="descricao">
          {item.exercicio?.musculos_primarios_pt?.join(", ")}
          {item.exercicio?.equipamento_pt ? ` · ${item.exercicio.equipamento_pt}` : ""}
          {item.observacao ? ` — ${item.observacao}` : ""}
        </div>

        {historico?.ultima_carga_kg != null && (
          <button
            type="button"
            className="linha-historico"
            onClick={() => aoVerHistorico?.(item)}
            disabled={!aoVerHistorico}
          >
            <History size={12} aria-hidden="true" />
            última vez: {historico.ultima_carga_kg} kg
            {historico.ultima_data ? ` · ${formatarData(historico.ultima_data)}` : ""}
            {item.carga_kg != null && historico.ultima_carga_kg > item.carga_kg && (
              <span className="acima-do-alvo">acima do prescrito</span>
            )}
          </button>
        )}
      </div>

      <div className="acoes">
        {aoMover && (
          <>
            <button
              className="link"
              onClick={() => aoMover(indice, -1)}
              disabled={indice === 0}
              aria-label="Subir"
            >
              <ArrowUp size={14} />
            </button>
            <button
              className="link"
              onClick={() => aoMover(indice, 1)}
              disabled={indice === total - 1}
              aria-label="Descer"
            >
              <ArrowDown size={14} />
            </button>
          </>
        )}
        {aoEditar && (
          <button className="link" onClick={() => aoEditar(item)}>
            <Pencil size={14} /> Editar
          </button>
        )}
        {aoRemover && (
          <button className="link perigo" onClick={() => aoRemover(item)}>
            <Trash2 size={14} /> Remover
          </button>
        )}
      </div>

      {aoAlternar && (
        <label className="marcar-execucao">
          <input
            type="checkbox"
            checked={concluido}
            onChange={() => aoAlternar(item)}
          />
          <span className="rotulo-marcar">{concluido ? "Feito" : "Marcar"}</span>
          <span className="caixa" aria-hidden="true">
            <Check size={14} />
          </span>
          <span className="sr-apenas">
            Marcar {item.exercicio?.nome ?? "exercício"} como feito
          </span>
        </label>
      )}
    </li>
  );
}
