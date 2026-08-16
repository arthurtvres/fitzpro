import { useState } from "react";

import { api } from "../../api/index.js";
import Modal from "../../components/Modal.jsx";

// A listagem devolve o id prefixado ("personal:5") — precisa disso para não
// colidir com os ids da TACO numa busca combinada. A rota de gerenciamento
// (PUT/arquivar), porém, toma o id numérico puro.
const idNumerico = (id) => Number(String(id).split(":")[1]);

const MACROS = [
  ["kcal", "Energia", "kcal"],
  ["proteina_g", "Proteína", "g"],
  ["carboidrato_g", "Carboidrato", "g"],
  ["gordura_g", "Gordura", "g"],
  ["fibra_g", "Fibra", "g"],
];

const paraTexto = (valor) => (valor == null ? "" : String(valor).replace(".", ","));

const decimalBR = (valor) => {
  if (valor === "") return null;
  const normalizado = String(valor).replace(",", ".").trim();
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
};

/**
 * Cria ou edita um alimento da biblioteca do personal: marca, receita ou
 * suplemento fora da TACO. Mesma regra de nulidade da TACO — campo em branco
 * é "não analisado", nunca vira 0 na conta da refeição.
 */
export default function FormularioAlimentoPersonalizado({ alimento, aoSalvar, aoCancelar, aoErrar }) {
  const [nome, setNome] = useState(alimento?.nome ?? "");
  const [macros, setMacros] = useState(() =>
    Object.fromEntries(MACROS.map(([campo]) => [campo, paraTexto(alimento?.[campo])]))
  );
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const alterarMacro = (campo) => (evento) => {
    setMacros((atual) => ({ ...atual, [campo]: evento.target.value }));
    setErros((atual) => ({ ...atual, [campo]: null, formulario: null }));
  };

  function validar() {
    const proximos = {};
    if (!nome.trim()) proximos.nome = "Informe o nome do alimento.";
    for (const [campo, rotulo] of MACROS) {
      const numero = decimalBR(macros[campo]);
      if (Number.isNaN(numero) || (numero !== null && numero < 0)) {
        proximos[campo] = `Informe um valor válido para ${rotulo.toLowerCase()}.`;
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
      nome: nome.trim(),
      ...Object.fromEntries(MACROS.map(([campo]) => [campo, decimalBR(macros[campo])])),
    };

    try {
      if (alimento) {
        await api.alimentos.personalizados.atualizar(idNumerico(alimento.id), corpo);
      } else {
        await api.alimentos.personalizados.criar(corpo);
      }
      aoErrar(null);
      aoSalvar();
    } catch (e) {
      setErros({ formulario: e.message || "Não foi possível salvar o alimento." });
      aoErrar(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={alimento ? "Editar alimento" : "Novo alimento"} aoFechar={aoCancelar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        {erros.formulario && <p className="erro-campo geral">{erros.formulario}</p>}

        <div className={`campo${erros.nome ? " com-erro" : ""}`}>
          <label htmlFor="alp-nome">
            Nome <span>*</span>
          </label>
          <input
            id="alp-nome"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErros((atual) => ({ ...atual, nome: null, formulario: null }));
            }}
            placeholder="Ex.: Whey da marca X"
            aria-invalid={Boolean(erros.nome)}
          />
          {erros.nome && <span className="erro-campo">{erros.nome}</span>}
        </div>

        <p className="ajuda-campo">Valores por 100 g. Deixe em branco o que não souber.</p>

        <div className="grade-avaliacao composicao">
          {MACROS.map(([campo, label, unidade]) => (
            <div key={campo} className={`campo${erros[campo] ? " com-erro" : ""}`}>
              <label htmlFor={`alp-${campo}`}>{label}</label>
              <div className="input-com-sufixo">
                <input
                  id={`alp-${campo}`}
                  inputMode="decimal"
                  value={macros[campo]}
                  onChange={alterarMacro(campo)}
                  placeholder="—"
                  aria-invalid={Boolean(erros[campo])}
                />
                <span>{unidade}</span>
              </div>
              {erros[campo] && <span className="erro-campo">{erros[campo]}</span>}
            </div>
          ))}
        </div>

        <p className="campos-obrigatorios">* Campos obrigatorios</p>

        <div className="acoes-form">
          <button type="button" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alimento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
