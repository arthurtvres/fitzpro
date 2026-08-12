import { useEffect, useState } from "react";
import FormularioDieta from "./FormularioDieta.jsx";

/**
 * Formulário de treino/dieta, usado em dois contextos:
 * - dentro do detalhe de um aluno (`alunoFixo`): sem seletor, aluno já definido;
 * - na tela "Criar treino/dieta" (`alunos`): com seletor de aluno.
 *
 * Salvar fica com o pai — aqui só se monta o corpo da requisição.
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

  // Só alunos ativos podem receber treino/dieta — a API recusa os inativos com 400.
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
      // O pai devolve false quando a API recusou, para o form não se limpar à toa.
      if (salvou !== false && !item) setDados(vazio);
    } finally {
      setSalvando(false);
    }
  }

  const id = (sufixo) => `${config.chave}-${sufixo}`;

  return (
    <form className="formulario" onSubmit={enviar}>
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
            {/* Em edição, o aluno atual pode estar inativo e não aparecer na
                lista de selecionáveis — então entra explicitamente. */}
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
          <label htmlFor={id("nome")}>Nome</label>
          <input id={id("nome")} value={dados.nome} onChange={alterar("nome")} required />
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
          rows="3"
          value={dados.descricao}
          onChange={alterar("descricao")}
          required={config.descricaoObrigatoria}
          placeholder={
            config.descricaoObrigatoria ? "" : "opcional — a série vem dos exercícios"
          }
        />
      </div>

      {bloqueado && (
        <p className="aviso-inativo">
          {alunoAlvo.nome} está inativo — a API recusa criar ou editar{" "}
          {config.chave} enquanto ele não for reativado.
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
              : `Adicionar ${config.singular}`}
        </button>
      </div>
    </form>
  );
}
