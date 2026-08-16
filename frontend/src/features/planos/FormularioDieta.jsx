import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Plus, Trash2 } from "lucide-react";

import BuscaDeAlimento from "./BuscaDeAlimento.jsx";
import { macrosDaPorcao, somarMacros } from "./macros.js";

import {
  criarPlanoAlimentarVazio,
  lerPlanoAlimentar,
  serializarPlanoAlimentar,
} from "./dietaPlano.js";

const novoId = (prefixo) =>
  `${prefixo}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const UNIDADES = ["g", "ml", "unidade", "fatia", "porção"];

const decimalBR = (valor) => {
  if (valor === "") return null;
  const numero = Number(String(valor).trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : NaN;
};

const formatarNumero = (valor) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(valor || 0));

const soma = (lista, campo) =>
  lista.reduce((total, item) => total + (decimalBR(item[campo]) || 0), 0);

const progresso = (atual, meta) => {
  const metaNumero = decimalBR(meta);
  if (!metaNumero) return 0;
  return Math.min(100, Math.round((atual / metaNumero) * 100));
};

const novaRefeicao = (nome = "") => ({
  id: novoId("ref"),
  horario: "",
  nome,
  calorias: "",
  proteinas: "",
  carboidratos: "",
  gorduras: "",
  observacao: "",
  // "g" e nao "unidade": e a unidade em que a TACO publica, entao escolher um
  // alimento da tabela ja calcula os macros. Com "unidade", toda linha nova
  // nascia dizendo "informe em g ou ml". O `adicionarAlimento` ja usava "g" —
  // era o primeiro alimento de cada refeicao que destoava.
  alimentos: [{ id: novoId("alim"), nome: "", quantidade: "", unidade: "g" }],
});

export default function FormularioDieta({
  config,
  item,
  alunos,
  alunoFixo,
  aoSalvar,
  aoCancelar,
}) {
  const [dados, setDados] = useState({
    nome: "",
    calorias: "",
    aluno_id: alunoFixo ? String(alunoFixo.id) : "",
  });
  const [plano, setPlano] = useState(criarPlanoAlimentarVazio);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setDados(
      item
        ? {
            nome: item.nome,
            calorias: String(item.calorias),
            aluno_id: String(item.aluno_id),
          }
        : { nome: "", calorias: "", aluno_id: alunoFixo ? String(alunoFixo.id) : "" }
    );
    setPlano(lerPlanoAlimentar(item?.descricao) ?? criarPlanoAlimentarVazio());
    setErros({});
  }, [item, alunoFixo?.id]);

  const id = (sufixo) => `${config.chave}-${sufixo}`;
  const alunosSelecionaveis = (alunos ?? []).filter((a) => a.ativo);
  const alunoAlvo = alunoFixo ?? alunos?.find((a) => String(a.id) === dados.aluno_id);
  const bloqueado = Boolean(alunoAlvo && !alunoAlvo.ativo);

  const totais = useMemo(
    () => ({
      calorias: soma(plano.refeicoes, "calorias"),
      proteinas: soma(plano.refeicoes, "proteinas"),
      carboidratos: soma(plano.refeicoes, "carboidratos"),
      gorduras: soma(plano.refeicoes, "gorduras"),
      refeicoes: plano.refeicoes.length,
    }),
    [plano.refeicoes]
  );

  const alterarDados = (campo) => (evento) => {
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));
    setErros((atual) => ({ ...atual, [campo]: null }));
  };

  const alterarPlano = (campo) => (evento) => {
    setPlano((atual) => ({ ...atual, [campo]: evento.target.value }));
    setErros((atual) => ({ ...atual, [campo]: null }));
  };

  const alterarRefeicao = (idRefeicao, campo, valor) =>
    setPlano((atual) => ({
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao) =>
        refeicao.id === idRefeicao
          ? {
              ...refeicao,
              ...(typeof campo === "object" ? campo : { [campo]: valor }),
            }
          : refeicao
      ),
    }));

  // Aceita `(campo, valor)` ou um objeto de campos: escolher um alimento muda
  // nome, vínculo e macros de uma vez, e três chamadas em sequência fariam a
  // linha passar por estados intermediários incoerentes.
  const alterarAlimento = (refeicaoId, alimentoId, campo, valor) =>
    setPlano((atual) => ({
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao) =>
        refeicao.id === refeicaoId
          ? {
              ...refeicao,
              alimentos: refeicao.alimentos.map((alimento) =>
                alimento.id === alimentoId
                  ? {
                      ...alimento,
                      ...(typeof campo === "object" ? campo : { [campo]: valor }),
                    }
                  : alimento
              ),
            }
          : refeicao
      ),
    }));

  function adicionarRefeicao() {
    setPlano((atual) => ({
      ...atual,
      refeicoes: [...atual.refeicoes, novaRefeicao()],
    }));
  }

  function removerRefeicao(refeicao) {
    const temConteudo =
      refeicao.nome ||
      refeicao.horario ||
      refeicao.alimentos.some((alimento) => alimento.nome || alimento.quantidade);
    if (temConteudo && !confirm(`Remover ${refeicao.nome || "esta refeição"}?`)) return;

    setPlano((atual) => ({
      ...atual,
      refeicoes: atual.refeicoes.filter((item) => item.id !== refeicao.id),
    }));
  }

  function adicionarAlimento(refeicaoId) {
    setPlano((atual) => ({
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao) =>
        refeicao.id === refeicaoId
          ? {
              ...refeicao,
              alimentos: [
                ...refeicao.alimentos,
                { id: novoId("alim"), nome: "", quantidade: "", unidade: "g" },
              ],
            }
          : refeicao
      ),
    }));
  }

  function removerAlimento(refeicaoId, alimentoId) {
    setPlano((atual) => ({
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao) =>
        refeicao.id === refeicaoId
          ? {
              ...refeicao,
              alimentos: refeicao.alimentos.filter((alimento) => alimento.id !== alimentoId),
            }
          : refeicao
      ),
    }));
  }

  function validar() {
    const proximos = {};
    if (!dados.aluno_id) proximos.aluno_id = "Selecione um aluno.";
    if (!dados.nome.trim()) proximos.nome = "Informe o nome do plano.";
    if (!decimalBR(dados.calorias) || decimalBR(dados.calorias) < 0) {
      proximos.calorias = "Informe uma meta calórica válida.";
    }
    for (const campo of ["proteinas", "carboidratos", "gorduras"]) {
      const valor = decimalBR(plano[campo]);
      if (Number.isNaN(valor) || valor < 0) proximos[campo] = "Informe uma meta válida.";
    }
    for (const refeicao of plano.refeicoes) {
      for (const alimento of refeicao.alimentos) {
        if (alimento.nome.trim() && !alimento.quantidade.trim()) {
          proximos[`quantidade-${alimento.id}`] = "Informe a quantidade.";
        }
      }
    }
    setErros(proximos);
    return Object.keys(proximos).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!validar()) return;

    setSalvando(true);
    try {
      const salvou = await aoSalvar({
        nome: dados.nome.trim(),
        calorias: Math.round(decimalBR(dados.calorias)),
        descricao: serializarPlanoAlimentar(plano),
        aluno_id: Number(dados.aluno_id),
      });
      if (salvou !== false && !item) {
        setDados({ nome: "", calorias: "", aluno_id: alunoFixo ? String(alunoFixo.id) : "" });
        setPlano(criarPlanoAlimentarVazio());
        setErros({});
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="formulario formulario-dieta dieta-editor" onSubmit={enviar} noValidate>
      <div className="dieta-editor-grid">
        <div className="dieta-editor-principal">
          <SecaoFormulario titulo="Informações do plano" />

          {!alunoFixo && (
            <Campo id={id("aluno")} label="Aluno" obrigatorio erro={erros.aluno_id}>
              <select
                id={id("aluno")}
                value={dados.aluno_id}
                onChange={alterarDados("aluno_id")}
              >
                <option value="">Selecione um aluno</option>
                {item && alunoAlvo && !alunoAlvo.ativo && (
                  <option value={String(alunoAlvo.id)}>{alunoAlvo.nome} (inativo)</option>
                )}
                {alunosSelecionaveis.map((aluno) => (
                  <option key={aluno.id} value={String(aluno.id)}>
                    {aluno.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <div className="grade-dieta-plano">
            <Campo id={id("nome")} label="Nome do plano" obrigatorio erro={erros.nome}>
              <input
                id={id("nome")}
                value={dados.nome}
                onChange={alterarDados("nome")}
                placeholder="Plano alimentar principal"
              />
            </Campo>

            <Campo id={id("calorias")} label="Meta diária" erro={erros.calorias}>
              <div className="input-com-sufixo">
                <input
                  id={id("calorias")}
                  inputMode="decimal"
                  value={dados.calorias}
                  onChange={alterarDados("calorias")}
                  placeholder="2200"
                />
                <span>kcal</span>
              </div>
            </Campo>
          </div>

          <SecaoFormulario titulo="Metas nutricionais" />
          <div className="grade-dieta-macros">
            <Campo id={id("proteinas")} label="Proteínas" erro={erros.proteinas}>
              <InputSufixo
                id={id("proteinas")}
                valor={plano.proteinas}
                onChange={alterarPlano("proteinas")}
                sufixo="g"
                placeholder="140"
              />
            </Campo>
            <Campo id={id("carboidratos")} label="Carboidratos" erro={erros.carboidratos}>
              <InputSufixo
                id={id("carboidratos")}
                valor={plano.carboidratos}
                onChange={alterarPlano("carboidratos")}
                sufixo="g"
                placeholder="235"
              />
            </Campo>
            <Campo id={id("gorduras")} label="Gorduras" erro={erros.gorduras}>
              <InputSufixo
                id={id("gorduras")}
                valor={plano.gorduras}
                onChange={alterarPlano("gorduras")}
                sufixo="g"
                placeholder="60"
              />
            </Campo>
          </div>

          <SecaoFormulario titulo="Refeições" />
          {/* Sem refeição ainda: diz o que fazer, em vez de deixar um vão. */}
          {plano.refeicoes.length === 0 && (
            <p className="apoio-secao">
              Nenhuma refeição no plano. Comece adicionando a primeira.
            </p>
          )}

          <div className="lista-refeicoes-form">
            {plano.refeicoes.map((refeicao) => (
              <RefeicaoCard
                key={refeicao.id}
                refeicao={refeicao}
                erros={erros}
                alterarRefeicao={alterarRefeicao}
                alterarAlimento={alterarAlimento}
                adicionarAlimento={adicionarAlimento}
                removerAlimento={removerAlimento}
                removerRefeicao={removerRefeicao}
              />
            ))}
          </div>

          <button type="button" className="botao-adicionar-refeicao" onClick={adicionarRefeicao}>
            <Plus size={15} /> Adicionar refeição
          </button>
        </div>

        <ResumoDieta dados={dados} plano={plano} totais={totais} />
      </div>

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
            ? item
              ? "Salvando..."
              : "Prescrevendo..."
            : item
              ? "Salvar alterações"
              : "Prescrever dieta"}
        </button>
      </div>
    </form>
  );
}

function RefeicaoCard({
  refeicao,
  erros,
  alterarRefeicao,
  alterarAlimento,
  adicionarAlimento,
  removerAlimento,
  removerRefeicao,
}) {
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const total = {
    calorias: decimalBR(refeicao.calorias) || 0,
    proteinas: decimalBR(refeicao.proteinas) || 0,
    carboidratos: decimalBR(refeicao.carboidratos) || 0,
    gorduras: decimalBR(refeicao.gorduras) || 0,
  };

  return (
    <section className="refeicao-form refeicao-editor">
      <div className="refeicao-topo">
        <div className="refeicao-titulo-wrap">
          {editandoTitulo ? (
            <input
              value={refeicao.nome}
              onChange={(e) => alterarRefeicao(refeicao.id, "nome", e.target.value)}
              onBlur={() => setEditandoTitulo(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setEditandoTitulo(false);
                }
              }}
              placeholder="Café da manhã"
              aria-label="Nome da refeição"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="refeicao-titulo-botao"
              onClick={() => setEditandoTitulo(true)}
            >
              {refeicao.nome || "Nome da refeição"}
            </button>
          )}
        </div>
        <input
          value={refeicao.horario}
          onChange={(e) => alterarRefeicao(refeicao.id, "horario", e.target.value)}
          placeholder="07:30"
          aria-label="Horário"
        />
        <div className="refeicao-menu">
        <button
          type="button"
          className="botao-menu-card"
          aria-label="Opções da refeição"
          onClick={() => setMenuAberto((atual) => !atual)}
        >
          <MoreVertical size={17} />
        </button>
          {menuAberto && (
            <div className="menu-card">
              <button type="button" onClick={() => setEditandoTitulo(true)}>
                Editar nome
              </button>
              <button
                type="button"
                className="perigo"
                onClick={() => removerRefeicao(refeicao)}
              >
                <Trash2 size={14} /> Remover refeição
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="alimentos-editor">
        {refeicao.alimentos.map((alimento) => (
          <div className="alimento-editor" key={alimento.id}>
            <div className="campo alimento-nome">
              <label>Alimento</label>
              <BuscaDeAlimento
                valor={alimento.nome}
                fonte={alimento.por_cem ? alimento.fonte : null}
                aoDigitar={(texto) =>
                  // Digitar à mão desfaz o vínculo: os macros guardados eram
                  // do alimento escolhido, e mantê-los faria a linha exibir um
                  // nome com os números de outra coisa.
                  alterarAlimento(refeicao.id, alimento.id, {
                    nome: texto,
                    alimento_id: null,
                    por_cem: null,
                    fonte: null,
                  })
                }
                aoEscolher={(escolhido) =>
                  alterarAlimento(refeicao.id, alimento.id, {
                    nome: escolhido.nome,
                    alimento_id: escolhido.id,
                    // "taco" ou "personal" — só para o selo mostrar de onde veio.
                    fonte: escolhido.fonte,
                    // A tabela é sempre por 100 g; a porção sai da quantidade.
                    por_cem: {
                      kcal: escolhido.kcal,
                      proteina_g: escolhido.proteina_g,
                      carboidrato_g: escolhido.carboidrato_g,
                      gordura_g: escolhido.gordura_g,
                      fibra_g: escolhido.fibra_g,
                    },
                    unidade: alimento.unidade === "unidade" ? "g" : alimento.unidade,
                  })
                }
              />
            </div>
            <div className="campo">
              <label>Quantidade</label>
              <input
                value={alimento.quantidade}
                onChange={(e) =>
                  alterarAlimento(refeicao.id, alimento.id, "quantidade", e.target.value)
                }
                placeholder="3"
              />
              {erros[`quantidade-${alimento.id}`] && (
                <span className="erro-campo">{erros[`quantidade-${alimento.id}`]}</span>
              )}
            </div>
            <div className="campo">
              <label>Unidade</label>
              <select
                value={alimento.unidade ?? ""}
                onChange={(e) =>
                  alterarAlimento(refeicao.id, alimento.id, "unidade", e.target.value)
                }
              >
                <option value="">livre</option>
                {UNIDADES.map((unidade) => (
                  <option key={unidade} value={unidade}>
                    {unidade}
                  </option>
                ))}
              </select>
            </div>
            <MacrosDaLinha alimento={alimento} />
            <button
              type="button"
              className="link perigo remover-alimento"
              onClick={() => removerAlimento(refeicao.id, alimento.id)}
              aria-label="Remover alimento"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <TotalDaRefeicao
        alimentos={refeicao.alimentos}
        aoUsar={(total) =>
          alterarRefeicao(refeicao.id, {
            calorias: String(total.kcal),
            proteinas: String(total.proteina_g),
            carboidratos: String(total.carboidrato_g),
            gorduras: String(total.gordura_g),
          })
        }
      />

      <button type="button" className="link destaque" onClick={() => adicionarAlimento(refeicao.id)}>
        <Plus size={14} /> Adicionar alimento
      </button>

      <div className="grade-refeicao-nutrientes">
        <Campo label="Calorias">
          <InputSufixo
            valor={refeicao.calorias}
            onChange={(e) => alterarRefeicao(refeicao.id, "calorias", e.target.value)}
            sufixo="kcal"
          />
        </Campo>
        <Campo label="P">
          <InputSufixo
            valor={refeicao.proteinas}
            onChange={(e) => alterarRefeicao(refeicao.id, "proteinas", e.target.value)}
            sufixo="g"
          />
        </Campo>
        <Campo label="C">
          <InputSufixo
            valor={refeicao.carboidratos}
            onChange={(e) => alterarRefeicao(refeicao.id, "carboidratos", e.target.value)}
            sufixo="g"
          />
        </Campo>
        <Campo label="G">
          <InputSufixo
            valor={refeicao.gorduras}
            onChange={(e) => alterarRefeicao(refeicao.id, "gorduras", e.target.value)}
            sufixo="g"
          />
        </Campo>
      </div>

      <details className="observacao-refeicao">
        <summary>+ Adicionar observação</summary>
        <textarea
          rows="2"
          value={refeicao.observacao ?? ""}
          onChange={(e) => alterarRefeicao(refeicao.id, "observacao", e.target.value)}
          placeholder="Consumir aproximadamente 60 minutos antes do treino."
        />
      </details>

      <div className="total-refeicao">
        Total: {formatarNumero(total.calorias)} kcal • P{formatarNumero(total.proteinas)}g • C
        {formatarNumero(total.carboidratos)}g • G{formatarNumero(total.gorduras)}g
      </div>
    </section>
  );
}

/** Os macros de uma linha, ou o motivo de não haver conta. */
function MacrosDaLinha({ alimento }) {
  if (!alimento.por_cem) return <span className="macros-linha vazio" />;

  const macros = macrosDaPorcao(alimento.por_cem, alimento.quantidade, alimento.unidade);
  if (!macros) {
    // O caso comum: escolheu da tabela mas a unidade é "unidade" ou "fatia".
    // A TACO não traz o peso da unidade, então não há conversão possível — e
    // dizer isso é melhor que mostrar um número inventado ou não mostrar nada.
    return <span className="macros-linha aviso">informe em g ou ml</span>;
  }

  return (
    <span className="macros-linha">
      <strong>{macros.kcal ?? "—"} kcal</strong>
      <span>
        P {macros.proteina_g ?? "—"} · C {macros.carboidrato_g ?? "—"} · G{" "}
        {macros.gordura_g ?? "—"}
      </span>
    </span>
  );
}

/**
 * O total da refeição, somando só as linhas que têm cálculo.
 *
 * O "usar" existe porque a refeição continua tendo campos de kcal e macros
 * digitados à mão — é deles que sai o total da dieta. Sem uma ponte entre os
 * dois, a tela mostraria um número calculado ao lado de outro digitado, e o
 * resumo lá em cima seguiria o digitado. Preencher com um clique, em vez de
 * sobrescrever sozinho, mantém quem prescreve no controle.
 */
function TotalDaRefeicao({ alimentos, aoUsar }) {
  const total = somarMacros(
    alimentos.map((a) => macrosDaPorcao(a.por_cem, a.quantidade, a.unidade))
  );
  if (total.contadas === 0) return null;

  return (
    <p className="total-refeicao">
      <strong>{total.kcal} kcal</strong>
      <span>
        P {total.proteina_g} g · C {total.carboidrato_g} g · G {total.gordura_g} g
      </span>
      {/* Sem este aviso, um total que ignora metade das linhas passaria por
          total exato — e é justamente o número que decide a dieta. */}
      {total.parciais && (
        <em>parcial: {alimentos.length - total.contadas} sem cálculo</em>
      )}
      <button type="button" className="link destaque" onClick={() => aoUsar(total)}>
        usar na refeição
      </button>
    </p>
  );
}

function ResumoDieta({ dados, plano, totais }) {
  const metaCalorias = decimalBR(dados.calorias);
  return (
    <aside className="painel resumo-dieta">
      <h2>Resumo do dia</h2>
      <strong>
        {metaCalorias
          ? `${formatarNumero(totais.calorias)} / ${formatarNumero(metaCalorias)} kcal`
          : `${formatarNumero(totais.calorias)} kcal`}
      </strong>
      <BarraResumo rotulo="Proteínas" atual={totais.proteinas} meta={plano.proteinas} />
      <BarraResumo rotulo="Carboidratos" atual={totais.carboidratos} meta={plano.carboidratos} />
      <BarraResumo rotulo="Gorduras" atual={totais.gorduras} meta={plano.gorduras} />
      <span className="resumo-refeicoes">
        {totais.refeicoes} refeição{totais.refeicoes === 1 ? "" : "ões"}
      </span>
    </aside>
  );
}

function BarraResumo({ rotulo, atual, meta }) {
  const metaNumero = decimalBR(meta);
  return (
    <div className="linha-resumo-dieta">
      <span>{rotulo}</span>
      <strong>
        {metaNumero
          ? `${formatarNumero(atual)} / ${formatarNumero(metaNumero)} g`
          : `${formatarNumero(atual)} g`}
      </strong>
      <div className="barra-progresso">
        <span style={{ width: `${progresso(atual, meta)}%` }} />
      </div>
    </div>
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
      {label && (
        <label htmlFor={id}>
          {label}
          {obrigatorio && <span> *</span>}
        </label>
      )}
      {children}
      {erro && <span className="erro-campo">{erro}</span>}
    </div>
  );
}

function InputSufixo({ id, valor, onChange, sufixo, placeholder }) {
  return (
    <div className="input-com-sufixo">
      <input
        id={id}
        inputMode="decimal"
        value={valor}
        onChange={onChange}
        placeholder={placeholder}
      />
      <span>{sufixo}</span>
    </div>
  );
}
