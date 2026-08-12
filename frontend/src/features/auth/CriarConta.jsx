import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { api } from "../../api/index.js";
import {
  FAIXAS_DE_ALUNOS,
  apenasDigitos,
  formatarTelefone,
  telefoneValido,
} from "../../utils/telefone.js";

// Espelha TAMANHO_MINIMO_SENHA do backend. Validar aqui é só para dar retorno
// imediato — quem decide é a API.
const MINIMO_SENHA = 8;

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const VAZIO = {
  nome: "",
  email: "",
  confirmacao_email: "",
  telefone: "",
  quantidade_alunos: "",
  senha: "",
  confirmacao_senha: "",
  aceitou_termos: false,
};

/**
 * Criação de conta de personal.
 *
 * Cada conta é um tenant: os alunos cadastrados aqui dentro pertencem a esta
 * conta e não aparecem para mais ninguém. Por isso não há escolha de papel —
 * quem se cadastra é sempre o personal, e os alunos ele cria depois.
 *
 * Confirmar e-mail é checagem só de tela: a API recebe um endereço só. Ela
 * existe porque errar o e-mail aqui é irreversível — sem recuperação de senha,
 * não há como reaver uma conta presa num endereço que não existe.
 */
export default function CriarConta({ aoEntrar, aoVoltar }) {
  const [dados, setDados] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [criando, setCriando] = useState(false);

  const alterar = (campo) => (evento) => {
    const valor =
      campo === "telefone" ? formatarTelefone(evento.target.value) : evento.target.value;
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: null }));
    setErroGeral(null);
  };

  const alternarTermos = (evento) => {
    setDados((atual) => ({ ...atual, aceitou_termos: evento.target.checked }));
    setErros((atual) => ({ ...atual, aceitou_termos: null }));
  };

  function validar() {
    const proximos = {};

    if (!dados.nome.trim()) proximos.nome = "Informe o seu nome.";

    if (!emailValido(dados.email.trim())) {
      proximos.email = "Informe um e-mail válido.";
    } else if (
      dados.email.trim().toLowerCase() !== dados.confirmacao_email.trim().toLowerCase()
    ) {
      proximos.confirmacao_email = "Os e-mails não coincidem.";
    }

    // Opcional, mas se foi preenchido tem que estar certo.
    if (dados.telefone && !telefoneValido(dados.telefone)) {
      proximos.telefone = "Informe o telefone com DDD.";
    }

    if (!dados.quantidade_alunos) {
      proximos.quantidade_alunos = "Selecione uma opção.";
    }

    if (dados.senha.length < MINIMO_SENHA) {
      proximos.senha = `A senha deve ter pelo menos ${MINIMO_SENHA} caracteres.`;
    } else if (dados.senha !== dados.confirmacao_senha) {
      proximos.confirmacao_senha = "As senhas não coincidem.";
    }

    if (!dados.aceitou_termos) {
      proximos.aceitou_termos = "É preciso aceitar os termos para continuar.";
    }

    setErros(proximos);
    return Object.keys(proximos).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!validar()) return;

    setCriando(true);
    try {
      // Sucesso já traz a sessão pronta: o App troca para o painel sozinho.
      aoEntrar(
        await api.auth.registrar({
          nome: dados.nome.trim(),
          email: dados.email.trim().toLowerCase(),
          telefone: apenasDigitos(dados.telefone) || null,
          quantidade_alunos: dados.quantidade_alunos,
          aceitou_termos: dados.aceitou_termos,
          senha: dados.senha,
        })
      );
    } catch (e) {
      const mensagem = e?.message ?? "";
      if (mensagem.toLowerCase().includes("email")) {
        setErros({ email: "Já existe uma conta com este e-mail." });
      } else {
        setErroGeral(mensagem || "Não foi possível criar a conta.");
      }
      setCriando(false);
    }
  }

  const tipoSenha = mostrarSenha ? "text" : "password";

  return (
    <div className="tela-login">
      <div className="cartao-login cartao-cadastro">
        <div className="marca-login">
          <img src="/fitzprologin.png" alt="FitzPro" />
        </div>

        <h1>Criar conta</h1>
        <p className="apoio-login">
          Sua conta é sua: os alunos que você cadastrar aparecem só para você.
        </p>

        {erroGeral && <div className="erro">{erroGeral}</div>}

        <form className="formulario" onSubmit={enviar} noValidate>
          <Campo id="criar-nome" label="Nome completo" erro={erros.nome} obrigatorio>
            <input
              id="criar-nome"
              value={dados.nome}
              onChange={alterar("nome")}
              placeholder="Seu nome completo"
              autoComplete="name"
              autoFocus
              aria-invalid={Boolean(erros.nome)}
            />
          </Campo>

          <Campo id="criar-email" label="E-mail" erro={erros.email} obrigatorio>
            <input
              id="criar-email"
              type="email"
              value={dados.email}
              onChange={alterar("email")}
              placeholder="seu.email@exemplo.com"
              autoComplete="email"
              aria-invalid={Boolean(erros.email)}
            />
          </Campo>

          <Campo
            id="criar-email-confirmacao"
            label="Confirmar e-mail"
            erro={erros.confirmacao_email}
            obrigatorio
          >
            <input
              id="criar-email-confirmacao"
              type="email"
              value={dados.confirmacao_email}
              onChange={alterar("confirmacao_email")}
              placeholder="Confirme seu e-mail"
              // Colar aqui anularia o propósito da conferência.
              onPaste={(evento) => evento.preventDefault()}
              autoComplete="off"
              aria-invalid={Boolean(erros.confirmacao_email)}
            />
          </Campo>

          <Campo id="criar-telefone" label="Telefone celular" erro={erros.telefone}>
            <div className="campo-telefone">
              <span className="prefixo-pais" aria-hidden="true">
                🇧🇷 +55
              </span>
              <input
                id="criar-telefone"
                type="tel"
                value={dados.telefone}
                onChange={alterar("telefone")}
                placeholder="(11) 96123-4567"
                autoComplete="tel-national"
                inputMode="numeric"
                aria-invalid={Boolean(erros.telefone)}
              />
            </div>
          </Campo>

          <Campo
            id="criar-quantidade"
            label="Quantos alunos você possui atualmente?"
            erro={erros.quantidade_alunos}
            obrigatorio
          >
            <select
              id="criar-quantidade"
              value={dados.quantidade_alunos}
              onChange={alterar("quantidade_alunos")}
              aria-invalid={Boolean(erros.quantidade_alunos)}
            >
              <option value="">Selecione uma opção</option>
              {FAIXAS_DE_ALUNOS.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id="criar-senha" label="Senha" erro={erros.senha} obrigatorio>
            <div className="input-senha">
              <input
                id="criar-senha"
                type={tipoSenha}
                value={dados.senha}
                onChange={alterar("senha")}
                placeholder={`Mínimo ${MINIMO_SENHA} caracteres`}
                autoComplete="new-password"
                aria-invalid={Boolean(erros.senha)}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Campo>

          <Campo
            id="criar-senha-confirmacao"
            label="Confirmar senha"
            erro={erros.confirmacao_senha}
            obrigatorio
          >
            <input
              id="criar-senha-confirmacao"
              type={tipoSenha}
              value={dados.confirmacao_senha}
              onChange={alterar("confirmacao_senha")}
              placeholder="Confirme sua senha"
              autoComplete="new-password"
              aria-invalid={Boolean(erros.confirmacao_senha)}
            />
          </Campo>

          <div className={`campo${erros.aceitou_termos ? " com-erro" : ""}`}>
            <label className="opcao-caixa aceite-termos">
              <input
                type="checkbox"
                checked={dados.aceitou_termos}
                onChange={alternarTermos}
                aria-invalid={Boolean(erros.aceitou_termos)}
              />
              <span>
                Li e aceito os <a href="#termos">termos de uso</a> e a{" "}
                <a href="#privacidade">política de privacidade</a>
              </span>
            </label>
            {erros.aceitou_termos && (
              <span className="erro-campo">{erros.aceitou_termos}</span>
            )}
          </div>

          <button type="submit" className="primario" disabled={criando}>
            {criando ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>

        <button type="button" className="link alternar-auth" onClick={aoVoltar}>
          <ArrowLeft size={14} /> Já tenho conta
        </button>
      </div>
    </div>
  );
}

function Campo({ id, label, erro, obrigatorio, children }) {
  return (
    <div className={`campo${erro ? " com-erro" : ""}`}>
      <label htmlFor={id}>
        {obrigatorio && <span className="asterisco">*</span>}
        {label}
      </label>
      {children}
      {erro && <span className="erro-campo">{erro}</span>}
    </div>
  );
}
