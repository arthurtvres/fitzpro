import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

import { api } from "../../api/index.js";
import {
  arquivoParaFoto,
  formularioAvaliacaoVazio,
  hojeISO,
  lerFotos,
  serializarFotos,
} from "./PainelAvaliacoes.jsx";
import { separarImagens } from "../../utils/imagem.js";

const COMPOSICAO = [
  ["peso_kg", "Peso", "kg", "Ex.: 75,4"],
  ["altura_cm", "Altura", "cm", "Ex.: 175"],
  ["percentual_gordura", "Gordura corporal", "%", "Ex.: 21,4"],
  ["massa_muscular_kg", "Massa muscular", "kg", "Ex.: 53,1"],
];

const MEDIDAS = [
  ["cintura_cm", "Cintura", "cm", "Ex.: 76"],
  ["quadril_cm", "Quadril", "cm", "Ex.: 98"],
  ["braco_cm", "Braco", "cm", "Ex.: 35"],
  ["coxa_cm", "Coxa", "cm", "Ex.: 57"],
  ["torax_cm", "Torax", "cm", "Ex.: 102"],
];

const TODOS_CAMPOS = [...COMPOSICAO, ...MEDIDAS];

const decimalBR = (valor) => {
  if (valor === "") return null;
  const normalizado = String(valor).replace(",", ".").trim();
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
};

const formatarNumero = (valor) =>
  valor == null
    ? null
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(valor));

const formatarAnterior = (avaliacao, campo, unidade) => {
  const valor = avaliacao?.[campo];
  if (valor == null) return null;
  return `Anterior: ${formatarNumero(valor)} ${unidade}`.trim();
};

function calcularImc(peso, alturaCm) {
  const pesoNumero = decimalBR(peso);
  const alturaNumero = decimalBR(alturaCm);
  if (!pesoNumero || !alturaNumero) return null;
  const alturaM = alturaNumero / 100;
  if (!alturaM) return null;
  return (pesoNumero / (alturaM * alturaM)).toFixed(1).replace(".", ",");
}

export default function CriarAvaliacao({ alunos, aoSalvar, aoCancelar, aoErrar }) {
  const [alunoId, setAlunoId] = useState("");
  const [dados, setDados] = useState(formularioAvaliacaoVazio);
  const [avaliacoesAluno, setAvaliacoesAluno] = useState([]);
  const [carregandoReferencia, setCarregandoReferencia] = useState(false);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const inputFotosRef = useRef(null);

  const alunosAtivos = alunos.filter((aluno) => aluno.ativo);
  const avaliacaoAnterior = avaliacoesAluno[0] ?? null;
  const imcCalculado = calcularImc(
    dados.peso_kg,
    dados.altura_cm || avaliacaoAnterior?.altura_cm
  );

  useEffect(() => {
    if (!alunoId) {
      setAvaliacoesAluno([]);
      return;
    }

    let cancelado = false;
    setCarregandoReferencia(true);
    api.alunos.avaliacoes
      .listar(Number(alunoId))
      .then((lista) => {
        if (!cancelado) setAvaliacoesAluno(lista);
      })
      .catch((e) => !cancelado && aoErrar(e.message))
      .finally(() => !cancelado && setCarregandoReferencia(false));

    return () => {
      cancelado = true;
    };
  }, [alunoId, aoErrar]);

  const alterar = (campo) => (evento) => {
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));
    setErros((atual) => ({ ...atual, [campo]: null, formulario: null }));
  };

  const alterarAluno = (evento) => {
    setAlunoId(evento.target.value);
    setErros((atual) => ({ ...atual, aluno: null, formulario: null }));
  };

  const alterarFotos = async (arquivos) => {
    const { validos, problema } = separarImagens(arquivos);

    if (problema) aoErrar(problema);
    if (validos.length === 0) return;

    try {
      const novas = await Promise.all(validos.map(arquivoParaFoto));
      setDados((atual) => ({ ...atual, fotos: [...atual.fotos, ...novas] }));
      if (!problema) aoErrar(null);
    } catch (e) {
      aoErrar(e.message);
    }
  };

  function validar() {
    const proximos = {};
    if (!alunoId) proximos.aluno = "Selecione um aluno.";
    if (!dados.data || dados.data > hojeISO()) proximos.data = "Informe uma data valida.";

    for (const [campo, rotulo, unidade] of TODOS_CAMPOS) {
      const numero = decimalBR(dados[campo]);
      if (Number.isNaN(numero) || numero < 0) {
        proximos[campo] =
          unidade === "%"
            ? "Informe um percentual valido."
            : rotulo === "Peso"
              ? "Informe um peso valido."
              : "Informe uma medida valida.";
      }
    }

    setErros(proximos);
    return Object.keys(proximos).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!validar()) return;

    setSalvando(true);

    const corpo = {
      data: dados.data,
      observacao: dados.observacao.trim() || null,
      fotos: serializarFotos(dados.fotos),
      ...Object.fromEntries(
        TODOS_CAMPOS.map(([campo]) => [campo, decimalBR(dados[campo])])
      ),
    };

    try {
      await api.alunos.avaliacoes.criar(Number(alunoId), corpo);
      setDados(formularioAvaliacaoVazio());
      setAlunoId("");
      setAvaliacoesAluno([]);
      setErros({});
      aoErrar(null);
      aoSalvar?.();
    } catch (e) {
      setErros({ formulario: e.message || "Não foi possível salvar a avaliação." });
      aoErrar(e.message);
    } finally {
      setSalvando(false);
    }
  }

  function removerFoto(id) {
    setDados((atual) => ({
      ...atual,
      fotos: atual.fotos.filter((foto) => foto.id !== id),
    }));
  }

  const referenciaTexto = useMemo(() => {
    if (!alunoId) return null;
    if (carregandoReferencia) return "Carregando avaliação anterior...";
    if (!avaliacaoAnterior) return "Primeira avaliação.";
    return "Valores anteriores carregados como referencia.";
  }, [alunoId, carregandoReferencia, avaliacaoAnterior]);

  return (
    <section className="painel painel-formulario-avaliacao">
      <form className="formulario aluno-form avaliacao-form" onSubmit={enviar} noValidate>
        {erros.formulario && <p className="erro-campo geral">{erros.formulario}</p>}

        <SecaoFormulario titulo="Avaliacao" />

        <Campo id="avaliacao-aluno" label="Aluno" obrigatorio erro={erros.aluno}>
          <select
            id="avaliacao-aluno"
            value={alunoId}
            onChange={alterarAluno}
            aria-invalid={Boolean(erros.aluno)}
          >
            <option value="">Selecione um aluno</option>
            {alunosAtivos.map((aluno) => (
              <option key={aluno.id} value={String(aluno.id)}>
                {aluno.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="avaliacao-data" label="Data" obrigatorio erro={erros.data}>
          <input
            id="avaliacao-data"
            type="date"
            max={hojeISO()}
            value={dados.data}
            onChange={alterar("data")}
            aria-invalid={Boolean(erros.data)}
          />
        </Campo>

        {referenciaTexto && <p className="ajuda-campo referencia-avaliacao">{referenciaTexto}</p>}

        <SecaoFormulario titulo="Composicao corporal" />
        <div className="grade-avaliacao composicao">
          {COMPOSICAO.map(([campo, label, unidade, placeholder]) => (
            <CampoNumerico
              key={campo}
              campo={campo}
              label={label}
              unidade={unidade}
              placeholder={placeholder}
              valor={dados[campo]}
              erro={erros[campo]}
              anterior={formatarAnterior(avaliacaoAnterior, campo, unidade)}
              onChange={alterar(campo)}
            />
          ))}
        </div>

        <div className="imc-calculado">
          <span>IMC calculado</span>
          {imcCalculado ? (
            <strong>{imcCalculado}</strong>
          ) : (
            <em>Informe peso e altura nesta avaliação para calcular o IMC.</em>
          )}
        </div>

        <SecaoFormulario titulo="Medidas corporais" />
        <div className="grade-avaliacao medidas">
          {MEDIDAS.map(([campo, label, unidade, placeholder]) => (
            <CampoNumerico
              key={campo}
              campo={campo}
              label={label}
              unidade={unidade}
              placeholder={placeholder}
              valor={dados[campo]}
              erro={erros[campo]}
              anterior={formatarAnterior(avaliacaoAnterior, campo, unidade)}
              onChange={alterar(campo)}
            />
          ))}
        </div>

        <SecaoFormulario titulo="Observacoes" />
        <Campo id="avaliacao-observacao" label="Observação">
          <textarea
            id="avaliacao-observacao"
            rows="4"
            value={dados.observacao}
            onChange={alterar("observacao")}
            placeholder="Ex.: evolução observada, condições da avaliação ou observações relevantes."
          />
        </Campo>

        <SecaoFormulario titulo="Fotos de evolucao" />
        <div
          className="upload-avaliacao"
          onDragOver={(evento) => evento.preventDefault()}
          onDrop={(evento) => {
            evento.preventDefault();
            alterarFotos(evento.dataTransfer.files);
          }}
          onClick={() => inputFotosRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" || evento.key === " ") inputFotosRef.current?.click();
          }}
        >
          <Camera size={28} />
          <strong>Arraste fotos para esta area</strong>
          <span>ou clique para selecionar</span>
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              inputFotosRef.current?.click();
            }}
          >
            <ImagePlus size={15} /> Selecionar fotos
          </button>
          <small>JPG ou PNG</small>
          <input
            ref={inputFotosRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(evento) => {
              alterarFotos(evento.target.files);
              evento.target.value = "";
            }}
          />
        </div>

        {lerFotos(dados.fotos).length > 0 && (
          <div className="grade-fotos-avaliacao">
            {dados.fotos.map((foto) => (
              <figure key={foto.id}>
                <img src={foto.url} alt={foto.nome || "Foto da avaliação"} />
                <button
                  type="button"
                  aria-label="Remover foto"
                  className="remover-foto"
                  onClick={() => removerFoto(foto.id)}
                >
                  <X size={14} />
                </button>
              </figure>
            ))}
          </div>
        )}

        <p className="campos-obrigatorios">* Campos obrigatorios</p>

        <div className="acoes-form">
          <button type="button" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar avaliação"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SecaoFormulario({ titulo }) {
  return (
    <div className="secao-formulario">
      <h2>{titulo}</h2>
    </div>
  );
}

function Campo({ id, label, obrigatorio, erro, children }) {
  return (
    <div className={`campo${erro ? " com-erro" : ""}`}>
      <label htmlFor={id}>
        {label}
        {obrigatorio && <span> *</span>}
      </label>
      {children}
      {erro && <span className="erro-campo">{erro}</span>}
    </div>
  );
}

function CampoNumerico({
  campo,
  label,
  unidade,
  placeholder,
  valor,
  erro,
  anterior,
  onChange,
}) {
  return (
    <Campo id={`avaliacao-${campo}`} label={label} erro={erro}>
      <div className="input-com-sufixo">
        <input
          id={`avaliacao-${campo}`}
          inputMode="decimal"
          value={valor}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={Boolean(erro)}
        />
        <span>{unidade}</span>
      </div>
      {anterior && <span className="ajuda-campo">{anterior}</span>}
    </Campo>
  );
}
