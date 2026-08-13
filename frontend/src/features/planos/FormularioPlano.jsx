import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Dumbbell, Sparkles, UserRound } from "lucide-react";

import FormularioDieta from "./FormularioDieta.jsx";

const MODELOS_TREINO = [
  {
    nome: "Treino A - Superiores",
    dia: "segunda",
    descricao: "Peito, costas, ombros e bracos.",
  },
  {
    nome: "Treino B - Inferiores",
    dia: "quarta",
    descricao: "Quadriceps, posteriores, gluteos e panturrilhas.",
  },
  {
    nome: "Full body",
    dia: "sexta",
    descricao: "Treino geral com movimentos basicos e controle de volume.",
  },
  {
    nome: "Cardio + mobilidade",
    dia: "sabado",
    descricao: "Condicionamento, mobilidade e recuperacao ativa.",
  },
];

/**
 * Formulario de treino/dieta, usado em dois contextos:
 * - dentro do detalhe de um aluno (`alunoFixo`): sem seletor, aluno ja definido;
 * - na tela "Prescrever treino/dieta" (`alunos`): com seletor de aluno.
 *
 * Salvar fica com o pai. Aqui so se monta o corpo da requisicao.
 */
export default function FormularioPlano({
  config,
  item,
  alunos,
  alunoFixo,
  aoSalvar,
  aoCancelar,
}) {
  if (config.chave === "dietas") {
    return (
      <FormularioDieta
        config={config}
        item={item}
        alunos={alunos}
        alunoFixo={alunoFixo}
        aoSalvar={aoSalvar}
        aoCancelar={aoCancelar}
      />
    );
  }

  const { campoExtra } = config;

  const vazio = {
    nome: "",
    descricao: "",
    [campoExtra.nome]: campoExtra.padrao,
    aluno_id: alunoFixo ? String(alunoFixo.id) : "",
  };

  const [dados, setDados] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setDados(
      item
        ? {
            nome: item.nome,
            descricao: item.descricao,
            [campoExtra.nome]: String(item[campoExtra.nome]),
            aluno_id: String(item.aluno_id),
          }
        : vazio
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, config.chave, alunoFixo?.id]);

  const alterar = (campo) => (evento) =>
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));

  const aplicarModelo = (modelo) =>
    setDados((atual) => ({
      ...atual,
      nome: modelo.nome,
      descricao: modelo.descricao,
      [campoExtra.nome]: modelo.dia,
    }));

  // So alunos ativos podem receber treino/dieta; a API recusa os inativos.
  const alunosSelecionaveis = (alunos ?? []).filter((a) => a.ativo);
  const alunoAlvo = alunoFixo ?? alunos?.find((a) => String(a.id) === dados.aluno_id);
  const bloqueado = Boolean(alunoAlvo && !alunoAlvo.ativo);

  async function enviar(evento) {
    evento.preventDefault();
    setSalvando(true);
    try {
      const salvou = await aoSalvar({
        nome: dados.nome.trim(),
        descricao: dados.descricao.trim(),
        [campoExtra.nome]: campoExtra.converter(dados[campoExtra.nome]),
        aluno_id: Number(dados.aluno_id),
      });
      if (salvou !== false && !item) setDados(vazio);
    } finally {
      setSalvando(false);
    }
  }

  const id = (sufixo) => `${config.chave}-${sufixo}`;
  const resumoAluno =
    alunoAlvo &&
    [alunoAlvo.objetivo, alunoAlvo.idade != null ? `${alunoAlvo.idade} anos` : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <form className="formulario formulario-treino" onSubmit={enviar}>
      <div className="treino-prescricao-layout">
        <section className="treino-prescricao-card">
          <div className="secao-formulario">
            <h2>Dados do treino</h2>
            <p>Aluno, dia e foco.</p>
          </div>

          {!alunoFixo && (
            <div className="campo">
              <label htmlFor={id("aluno")}>Aluno</label>
              <select
                id={id("aluno")}
                value={dados.aluno_id}
                onChange={alterar("aluno_id")}
                required
              >
                <option value="" disabled>
                  Selecione um aluno
                </option>
                {item && alunoAlvo && !alunoAlvo.ativo && (
                  <option value={String(alunoAlvo.id)}>{alunoAlvo.nome} (inativo)</option>
                )}
                {alunosSelecionaveis.map((aluno) => (
                  <option key={aluno.id} value={String(aluno.id)}>
                    {aluno.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="linha">
            <div className="campo">
              <label htmlFor={id("nome")}>Nome do treino</label>
              <input
                id={id("nome")}
                value={dados.nome}
                onChange={alterar("nome")}
                placeholder="Ex.: Treino A - Inferiores"
                required
              />
            </div>
            <div className="campo">
              <label htmlFor={id("extra")}>{campoExtra.rotulo}</label>
              {campoExtra.tipo === "select" ? (
                <select
                  id={id("extra")}
                  value={dados[campoExtra.nome]}
                  onChange={alterar(campoExtra.nome)}
                >
                  {campoExtra.opcoes.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id("extra")}
                  type="number"
                  min="0"
                  value={dados[campoExtra.nome]}
                  onChange={alterar(campoExtra.nome)}
                  required
                />
              )}
            </div>
          </div>

          <div className="campo">
            <label htmlFor={id("descricao")}>{config.rotuloDescricao}</label>
            <textarea
              id={id("descricao")}
              rows="4"
              value={dados.descricao}
              onChange={alterar("descricao")}
              required={config.descricaoObrigatoria}
              placeholder={
                config.descricaoObrigatoria
                  ? ""
                  : "Foco do treino, grupos musculares, restricoes ou observacoes."
              }
            />
          </div>
        </section>

        <aside className="treino-prescricao-lateral">
          <section className="treino-prescricao-card aluno-contexto">
            <div className="icone-bloco">
              <UserRound size={18} aria-hidden="true" />
            </div>
            <div>
              <span>Aluno selecionado</span>
              <strong>{alunoAlvo?.nome ?? "Nenhum aluno"}</strong>
              <p>
                {alunoAlvo
                  ? resumoAluno || "Sem objetivo informado"
                  : "Selecione um aluno."}
              </p>
            </div>
          </section>

          <section className="treino-prescricao-card modelos-treino">
            <div className="secao-formulario">
              <h2>Modelos rápidos</h2>
            </div>
            <div className="modelos-treino-lista">
              {MODELOS_TREINO.map((modelo) => (
                <button key={modelo.nome} type="button" onClick={() => aplicarModelo(modelo)}>
                  <Sparkles size={14} aria-hidden="true" />
                  <span>
                    <strong>{modelo.nome}</strong>
                    <small>{modelo.dia}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="treino-exercicios-preview">
        <div>
          <div className="icone-bloco">
            <Dumbbell size={18} aria-hidden="true" />
          </div>
          <div>
            <h2>Exercícios</h2>
            <p>Séries, reps, carga e descanso.</p>
          </div>
        </div>
        <div className="treino-preview-grid">
          <span>
            <ClipboardList size={15} aria-hidden="true" />
            Estrutura pronta
          </span>
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {dados[campoExtra.nome]}
          </span>
        </div>
      </section>

      {bloqueado && (
        <p className="aviso-inativo">
          {alunoAlvo.nome} está inativo. Reative antes de prescrever.
        </p>
      )}

      <div className="acoes-form">
        {aoCancelar && (
          <button type="button" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
        <button type="submit" className="primario" disabled={salvando || bloqueado}>
          {salvando
            ? "Salvando..."
            : item
              ? "Salvar alterações"
              : `Prescrever ${config.singular}`}
        </button>
      </div>
    </form>
  );
}
