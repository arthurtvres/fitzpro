import { useEffect, useState } from "react";
import { Eye, LineChart, Pencil, Plus, Trash2 } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";
import { prepararFotoDeEvolucao, separarImagens } from "../../utils/imagem.js";

export const CAMPOS_AVALIACAO = [
  ["peso_kg", "Peso (kg)", "0.1"],
  ["altura_cm", "Altura (cm)", "0.5"],
  ["percentual_gordura", "Gordura (%)", "0.1"],
  ["massa_muscular_kg", "Massa muscular (kg)", "0.1"],
  ["cintura_cm", "Cintura (cm)", "0.5"],
  ["quadril_cm", "Quadril (cm)", "0.5"],
  ["braco_cm", "Braço (cm)", "0.5"],
  ["coxa_cm", "Coxa (cm)", "0.5"],
  ["torax_cm", "Tórax (cm)", "0.5"],
];

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const formularioAvaliacaoVazio = () => ({
  data: hojeISO(),
  observacao: "",
  fotos: [],
  ...Object.fromEntries(CAMPOS_AVALIACAO.map(([campo]) => [campo, ""])),
});

const formatarData = (iso) => iso.split("-").reverse().join("/");
export const lerFotos = (valor) => {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try {
    const fotos = JSON.parse(valor);
    return Array.isArray(fotos) ? fotos : [];
  } catch {
    return [];
  }
};
export const serializarFotos = (fotos) => JSON.stringify(fotos);
/**
 * Arquivo escolhido -> foto pronta para salvar.
 *
 * A imagem passa por `prepararFotoDeEvolucao` antes de virar data URL: as fotos
 * vao para uma coluna do banco, e o original de camera (3-8 MB cada, varias por
 * avaliacao) inviabilizaria a linha. Reduzida a 1024px fica em ~150 KB, que e o
 * suficiente para comparar duas datas lado a lado.
 */
export const arquivoParaFoto = async (arquivo) => ({
  id: `foto-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  nome: arquivo.name,
  url: await prepararFotoDeEvolucao(arquivo),
});

/** Histórico de medidas do aluno. O IMC vem calculado pela API. */
export default function PainelAvaliacoes({ aluno, aoErrar }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // null = fechado
  const [visualizando, setVisualizando] = useState(null);
  const [dados, setDados] = useState(formularioAvaliacaoVazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    api.alunos.avaliacoes
      .listar(aluno.id)
      .then((lista) => !cancelado && setItens(lista))
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [aluno.id, aoErrar]);

  const alterar = (campo) => (evento) =>
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));

  function abrirNova() {
    setDados(formularioAvaliacaoVazio());
    setEditando("nova");
  }

  function abrirEdicao(item) {
    setDados({
      data: item.data,
      observacao: item.observacao ?? "",
      fotos: lerFotos(item.fotos),
      ...Object.fromEntries(
        CAMPOS_AVALIACAO.map(([campo]) => [campo, item[campo] == null ? "" : String(item[campo])])
      ),
    });
    setEditando(item);
  }

  async function salvar(evento) {
    evento.preventDefault();
    setSalvando(true);

    const corpo = {
      data: dados.data,
      observacao: dados.observacao.trim() || null,
      fotos: serializarFotos(dados.fotos),
      ...Object.fromEntries(
        CAMPOS_AVALIACAO.map(([campo]) => [campo, dados[campo] === "" ? null : Number(dados[campo])])
      ),
    };

    try {
      if (editando === "nova") {
        const criada = await api.alunos.avaliacoes.criar(aluno.id, corpo);
        // A API devolve da mais recente para a mais antiga; mantemos isso aqui.
        setItens((atual) =>
          [criada, ...atual].sort((a, b) => b.data.localeCompare(a.data))
        );
      } else {
        const atualizada = await api.alunos.avaliacoes.atualizar(
          aluno.id,
          editando.id,
          corpo
        );
        setItens((atual) =>
          atual
            .map((i) => (i.id === atualizada.id ? atualizada : i))
            .sort((a, b) => b.data.localeCompare(a.data))
        );
      }
      setEditando(null);
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item) {
    if (!confirm(`Remover a avaliação de ${formatarData(item.data)}?`)) return;
    try {
      await api.alunos.avaliacoes.remover(aluno.id, item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  async function adicionarFotos(evento) {
    const { validos, problema } = separarImagens(evento.target.files);
    // Limpar sempre: sem isso escolher o mesmo arquivo de novo nao dispara.
    evento.target.value = "";

    if (problema) aoErrar(problema);
    if (validos.length === 0) return;

    try {
      const novas = await Promise.all(validos.map(arquivoParaFoto));
      setDados((atual) => ({ ...atual, fotos: [...atual.fotos, ...novas] }));
      if (!problema) aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  }

  function removerFoto(id) {
    setDados((atual) => ({
      ...atual,
      fotos: atual.fotos.filter((foto) => foto.id !== id),
    }));
  }

  /** Diferença de peso entre esta avaliação e a anterior no tempo. */
  function variacaoDePeso(indice) {
    const atual = itens[indice]?.peso_kg;
    const anterior = itens[indice + 1]?.peso_kg;
    if (atual == null || anterior == null) return null;
    const delta = +(atual - anterior).toFixed(1);
    if (delta === 0) return "manteve";
    return `${delta > 0 ? "+" : ""}${delta} kg`;
  }

  return (
    <>
      <div className="barra-acoes">
        <h2 style={{ margin: 0 }}>Histórico</h2>
        {editando === null && (
          <button type="button" className="primario" onClick={abrirNova}>
            <Plus size={15} /> Nova avaliação
          </button>
        )}
      </div>

      {editando !== null && (
        <form className="formulario" onSubmit={salvar}>
          <div className="campo">
            <label htmlFor="av-data">Data</label>
            <input
              id="av-data"
              type="date"
              max={hojeISO()}
              value={dados.data}
              onChange={alterar("data")}
              required
            />
          </div>

          <div className="grade-medidas">
            {CAMPOS_AVALIACAO.map(([campo, rotulo, passo]) => (
              <div className="campo" key={campo}>
                <label htmlFor={`av-${campo}`}>{rotulo}</label>
                <input
                  id={`av-${campo}`}
                  type="number"
                  min="0"
                  step={passo}
                  value={dados[campo]}
                  onChange={alterar(campo)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>

          <div className="campo">
            <label htmlFor="av-obs">Observação</label>
            <textarea
              id="av-obs"
              rows="2"
              value={dados.observacao}
              onChange={alterar("observacao")}
              placeholder="opcional"
            />
          </div>

          <div className="campo">
            <label htmlFor="av-fotos">Fotos de evolucao</label>
            <input
              id="av-fotos"
              type="file"
              accept="image/*"
              multiple
              onChange={adicionarFotos}
            />
          </div>

          {dados.fotos.length > 0 && (
            <div className="grade-fotos-avaliacao">
              {dados.fotos.map((foto) => (
                <figure key={foto.id}>
                  <img src={foto.url} alt={foto.nome || "Foto da avaliação"} />
                  <button
                    type="button"
                    className="link perigo"
                    onClick={() => removerFoto(foto.id)}
                  >
                    Remover
                  </button>
                </figure>
              ))}
            </div>
          )}

          <div className="acoes-form">
            <button type="button" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className="primario" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar avaliação"}
            </button>
          </div>
        </form>
      )}

      <hr className="divisor" />

      {carregando ? (
        <Skeleton quantidade={2} />
      ) : itens.length === 0 ? (
        <Vazio icone={LineChart}>
          Nenhuma avaliação registrada para {aluno.nome}.
        </Vazio>
      ) : (
        <div className="rolagem-tabela">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso</th>
                <th>Variação</th>
                <th>IMC</th>
                <th>Gordura</th>
                <th>Cintura</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, indice) => (
                <tr key={item.id}>
                  <td>
                    <strong>{formatarData(item.data)}</strong>
                    {item.observacao && <span className="sub">{item.observacao}</span>}
                    {lerFotos(item.fotos).length > 0 && (
                      <span className="sub">{lerFotos(item.fotos).length} foto(s)</span>
                    )}
                  </td>
                  <td>{item.peso_kg != null ? `${item.peso_kg} kg` : "—"}</td>
                  <td className="variacao">{variacaoDePeso(indice) ?? "—"}</td>
                  <td>{item.imc ?? "—"}</td>
                  <td>
                    {item.percentual_gordura != null
                      ? `${item.percentual_gordura}%`
                      : "—"}
                  </td>
                  <td>{item.cintura_cm != null ? `${item.cintura_cm} cm` : "—"}</td>
                  <td className="acoes-celula">
                    <button className="link destaque" onClick={() => setVisualizando(item)}>
                      <Eye size={14} />
                    </button>
                    <button className="link" onClick={() => abrirEdicao(item)}>
                      <Pencil size={14} />
                    </button>
                    <button className="link perigo" onClick={() => remover(item)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visualizando && (
        <Modal
          titulo={`Avaliação de ${formatarData(visualizando.data)}`}
          aoFechar={() => setVisualizando(null)}
        >
          <div className="detalhe-registro">
            <div className="grade-detalhes">
              <div>
                <span>Data</span>
                <strong>{formatarData(visualizando.data)}</strong>
              </div>
              <div>
                <span>IMC</span>
                <strong>{visualizando.imc ?? "-"}</strong>
              </div>
              {CAMPOS_AVALIACAO.map(([campo, rotulo]) => (
                <div key={campo}>
                  <span>{rotulo}</span>
                  <strong>{visualizando[campo] ?? "-"}</strong>
                </div>
              ))}
            </div>

            <div className="bloco-detalhe">
              <span>Observação</span>
              <p>{visualizando.observacao || "-"}</p>
            </div>

            {lerFotos(visualizando.fotos).length > 0 && (
              <div className="galeria-avaliacao">
                {lerFotos(visualizando.fotos).map((foto) => (
                  <figure key={foto.id}>
                    <img src={foto.url} alt={foto.nome || "Foto da avaliação"} />
                    {foto.nome && <figcaption>{foto.nome}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
