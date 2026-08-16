import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";
import { conferirMidiaDeExercicio, prepararMidiaDeExercicio } from "../../utils/imagem.js";

// A listagem devolve o id prefixado ("personal:5") — precisa disso para não
// colidir com os ids do catálogo público numa busca combinada. As rotas de
// gerenciamento (PUT/arquivar), porém, tomam o id numérico puro.
const idNumerico = (id) => Number(String(id).split(":")[1]);

const VAZIO = {
  nome: "",
  categoria: "",
  equipamento: "",
  nivel: "",
  musculos_primarios: [],
  instrucoes: "",
  imagem_url: null,
};

/**
 * Cria ou edita um exercício da biblioteca do personal — o que fica fora do
 * free-exercise-db. Usa os mesmos vocabulários fechados do catálogo público
 * (`api.exercicios.filtros()`) para categoria, equipamento, nível e músculo,
 * para os filtros da tela de catálogo continuarem valendo sobre os dois.
 */
export default function FormularioExercicioPersonalizado({ exercicio, aoSalvar, aoCancelar, aoErrar }) {
  const [dados, setDados] = useState(
    exercicio
      ? {
          nome: exercicio.nome,
          categoria: exercicio.categoria ?? "",
          equipamento: exercicio.equipamento ?? "",
          nivel: exercicio.nivel ?? "",
          musculos_primarios: exercicio.musculos_primarios ?? [],
          instrucoes: exercicio.instrucoes?.[0] ?? "",
          imagem_url: exercicio.imagens?.[0] ?? null,
        }
      : VAZIO
  );
  const [opcoes, setOpcoes] = useState(null);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [carregandoImagem, setCarregandoImagem] = useState(false);
  const inputImagemRef = useRef(null);

  useEffect(() => {
    api.exercicios.filtros().then(setOpcoes).catch((e) => aoErrar(e.message));
  }, [aoErrar]);

  const alterar = (campo) => (evento) => {
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));
    setErros((atual) => ({ ...atual, [campo]: null, formulario: null }));
  };

  function alternarMusculo(valor) {
    setDados((atual) => ({
      ...atual,
      musculos_primarios: atual.musculos_primarios.includes(valor)
        ? atual.musculos_primarios.filter((m) => m !== valor)
        : [...atual.musculos_primarios, valor],
    }));
  }

  async function escolherImagem(arquivos) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;

    const problema = conferirMidiaDeExercicio(arquivo);
    if (problema) {
      aoErrar(problema);
      return;
    }

    setCarregandoImagem(true);
    try {
      const dataUrl = await prepararMidiaDeExercicio(arquivo);
      setDados((atual) => ({ ...atual, imagem_url: dataUrl }));
      aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    } finally {
      setCarregandoImagem(false);
    }
  }

  function validar() {
    const proximos = {};
    if (!dados.nome.trim()) proximos.nome = "Informe o nome do exercício.";
    setErros(proximos);
    return Object.keys(proximos).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!validar()) return;

    setSalvando(true);
    const corpo = {
      nome: dados.nome.trim(),
      categoria: dados.categoria || null,
      equipamento: dados.equipamento || null,
      nivel: dados.nivel || null,
      musculos_primarios: dados.musculos_primarios,
      instrucoes: dados.instrucoes.trim(),
      imagem_url: dados.imagem_url,
    };

    try {
      if (exercicio) {
        await api.exercicios.personalizados.atualizar(idNumerico(exercicio.id), corpo);
      } else {
        await api.exercicios.personalizados.criar(corpo);
      }
      aoErrar(null);
      aoSalvar();
    } catch (e) {
      setErros({ formulario: e.message || "Não foi possível salvar o exercício." });
      aoErrar(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={exercicio ? "Editar exercício" : "Novo exercício"} aoFechar={aoCancelar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        {erros.formulario && <p className="erro-campo geral">{erros.formulario}</p>}

        <div className={`campo${erros.nome ? " com-erro" : ""}`}>
          <label htmlFor="exp-nome">
            Nome <span>*</span>
          </label>
          <input
            id="exp-nome"
            value={dados.nome}
            onChange={alterar("nome")}
            placeholder="Ex.: Remada no elástico"
            aria-invalid={Boolean(erros.nome)}
          />
          {erros.nome && <span className="erro-campo">{erros.nome}</span>}
        </div>

        <div className="campo">
          <label htmlFor="exp-categoria">Categoria</label>
          <select id="exp-categoria" value={dados.categoria} onChange={alterar("categoria")}>
            <option value="">Não informada</option>
            {(opcoes?.categorias ?? []).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="exp-equipamento">Equipamento</label>
          <select id="exp-equipamento" value={dados.equipamento} onChange={alterar("equipamento")}>
            <option value="">Não informado</option>
            {(opcoes?.equipamentos ?? []).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="exp-nivel">Nível</label>
          <select id="exp-nivel" value={dados.nivel} onChange={alterar("nivel")}>
            <option value="">Não informado</option>
            {(opcoes?.niveis ?? []).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label>Músculos principais</label>
          <div className="chips-fonte">
            {(opcoes?.musculos ?? []).map((o) => (
              <button
                key={o.valor}
                type="button"
                className={`chip${dados.musculos_primarios.includes(o.valor) ? " ativo" : ""}`}
                onClick={() => alternarMusculo(o.valor)}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="campo">
          <label htmlFor="exp-instrucoes">Instruções</label>
          <textarea
            id="exp-instrucoes"
            rows="4"
            value={dados.instrucoes}
            onChange={alterar("instrucoes")}
            placeholder="Como executar o movimento."
          />
        </div>

        <div className="campo">
          <label>Foto ou gif</label>

          {dados.imagem_url ? (
            <figure className="preview-midia-exercicio">
              <img src={dados.imagem_url} alt="" />
              <button
                type="button"
                className="remover-foto"
                aria-label="Remover imagem"
                onClick={() => setDados((atual) => ({ ...atual, imagem_url: null }))}
              >
                <X size={14} />
              </button>
            </figure>
          ) : (
            <div
              className="upload-avaliacao"
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => {
                evento.preventDefault();
                escolherImagem(evento.dataTransfer.files);
              }}
              onClick={() => inputImagemRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" || evento.key === " ") inputImagemRef.current?.click();
              }}
            >
              <Camera size={28} />
              <strong>{carregandoImagem ? "Carregando..." : "Arraste uma foto ou gif"}</strong>
              <span>ou clique para selecionar</span>
              <button
                type="button"
                onClick={(evento) => {
                  evento.stopPropagation();
                  inputImagemRef.current?.click();
                }}
                disabled={carregandoImagem}
              >
                <ImagePlus size={15} /> Selecionar arquivo
              </button>
              <small>JPG, PNG, WEBP ou GIF</small>
              <input
                ref={inputImagemRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(evento) => {
                  escolherImagem(evento.target.files);
                  evento.target.value = "";
                }}
              />
            </div>
          )}
        </div>

        <p className="campos-obrigatorios">* Campos obrigatorios</p>

        <div className="acoes-form">
          <button type="button" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="primario" disabled={salvando || carregandoImagem}>
            {salvando ? "Salvando..." : "Salvar exercício"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
