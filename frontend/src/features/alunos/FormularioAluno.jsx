import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import CampoFoto from "../../components/CampoFoto.jsx";
import {
  apenasDigitos,
  formatarTelefone,
  telefoneValido,
} from "../../utils/telefone.js";

const OBJETIVOS = [
  "Hipertrofia",
  "Emagrecimento",
  "Recomposição corporal",
  "Condicionamento físico",
  "Ganho de força",
  "Saúde e qualidade de vida",
  "Outro",
];

const VAZIO = {
  nome: "",
  email: "",
  confirmacao_email: "",
  telefone: "",
  senha: "",
  data_nascimento: "",
  sexo: "",
  objetivo: "",
  objetivo_outro: "",
  foto_url: null,
};

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function FormularioAluno({ aluno, aoSalvar, aoCancelar }) {
  const [dados, setDados] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  // O padrão é convidar: quem define a senha do aluno é o aluno.
  const [porConvite, setPorConvite] = useState(true);

  const editando = Boolean(aluno);

  useEffect(() => {
    if (!aluno) {
      setDados(VAZIO);
      setErros({});
      return;
    }

    const objetivoPadrao = OBJETIVOS.includes(aluno.objetivo) ? aluno.objetivo : "Outro";
    setDados({
      nome: aluno.nome,
      email: aluno.email,
      // Ao editar, o e-mail ja e conhecido: repetir a conferencia so atrapalha.
      confirmacao_email: aluno.email,
      telefone: formatarTelefone(aluno.telefone ?? ""),
      senha: "",
      data_nascimento: aluno.data_nascimento ?? "",
      sexo: aluno.sexo ?? "",
      objetivo: aluno.objetivo ? objetivoPadrao : "",
      objetivo_outro: objetivoPadrao === "Outro" ? aluno.objetivo : "",
      foto_url: aluno.foto_url ?? null,
    });
    setErros({});
  }, [aluno]);

  const alterarFoto = (foto) => setDados((atual) => ({ ...atual, foto_url: foto }));

  const alterar = (campo) => (evento) => {
    const valor =
      campo === "telefone" ? formatarTelefone(evento.target.value) : evento.target.value;
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: null, formulario: null }));
  };

  const objetivoFinal = useMemo(
    () =>
      dados.objetivo === "Outro"
        ? dados.objetivo_outro.trim()
        : dados.objetivo.trim(),
    [dados.objetivo, dados.objetivo_outro]
  );

  function validar() {
    const proximos = {};

    if (!dados.nome.trim()) proximos.nome = "Informe o nome do aluno.";
    if (!emailValido(dados.email.trim())) {
      proximos.email = "Informe um e-mail válido.";
    } else if (
      dados.email.trim().toLowerCase() !== dados.confirmacao_email.trim().toLowerCase()
    ) {
      proximos.confirmacao_email = "Os e-mails não coincidem.";
    }
    if (!telefoneValido(dados.telefone)) {
      proximos.telefone = "Informe o telefone com DDD.";
    }
    if (!editando && !porConvite && dados.senha.length < 6) {
      proximos.senha = "A senha deve possuir pelo menos 6 caracteres.";
    }
    if (dados.data_nascimento) {
      const hoje = new Date().toISOString().slice(0, 10);
      if (dados.data_nascimento > hoje) {
        proximos.data_nascimento = "Informe uma data de nascimento válida.";
      }
    }
    if (dados.objetivo === "Outro" && !objetivoFinal) {
      proximos.objetivo_outro = "Descreva o objetivo do aluno.";
    }

    setErros(proximos);
    return Object.keys(proximos).length === 0;
  }

  const vazioVirandoNulo = (valor) => (valor === "" ? null : valor);
  const erroDe = (campo) => erros[campo] ?? null;

  async function enviar(evento) {
    evento.preventDefault();
    if (!validar()) return;

    setSalvando(true);
    try {
      const corpo = {
        nome: dados.nome.trim(),
        email: dados.email.trim().toLowerCase(),
        telefone: apenasDigitos(dados.telefone),
        data_nascimento: vazioVirandoNulo(dados.data_nascimento),
        sexo: vazioVirandoNulo(dados.sexo),
        objetivo: objetivoFinal,
        foto_url: dados.foto_url,
      };
      // Sem `senha` no corpo, o servidor manda o convite. Omitir e mandar
      // string vazia sao coisas diferentes ali — por isso a chave so aparece
      // quando o personal escolheu definir a senha.
      if (!editando && !porConvite) corpo.senha = dados.senha;

      await aoSalvar(corpo);
      if (!editando) setDados(VAZIO);
    } catch (e) {
      const mensagem = e?.message ?? "";
      if (mensagem.toLowerCase().includes("email")) {
        setErros({ email: "Já existe um aluno cadastrado com este e-mail." });
      } else {
        setErros({ formulario: mensagem || "Não foi possível salvar o aluno." });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="formulario aluno-form" onSubmit={enviar} noValidate>
      {erros.formulario && <p className="erro-campo geral">{erros.formulario}</p>}

      <SecaoFormulario
        titulo="Dados pessoais"
        descricao="Identificação básica do aluno no FitzPRO."
      />

      <CampoFoto nome={dados.nome} valor={dados.foto_url} aoMudar={alterarFoto} />

      <Campo id="aluno-nome" label="Nome completo" erro={erroDe("nome")} obrigatorio>
        <input
          id="aluno-nome"
          value={dados.nome}
          onChange={alterar("nome")}
          autoComplete="name"
          aria-invalid={Boolean(erroDe("nome"))}
        />
      </Campo>

      <Campo id="aluno-email" label="E-mail" erro={erroDe("email")} obrigatorio>
        <input
          id="aluno-email"
          type="email"
          autoComplete="email"
          value={dados.email}
          onChange={alterar("email")}
          aria-invalid={Boolean(erroDe("email"))}
        />
      </Campo>

      <Campo
        id="aluno-email-confirmacao"
        label="Confirmar e-mail"
        erro={erroDe("confirmacao_email")}
        obrigatorio
      >
        <input
          id="aluno-email-confirmacao"
          type="email"
          value={dados.confirmacao_email}
          onChange={alterar("confirmacao_email")}
          placeholder="Confirme o e-mail do aluno"
          // Colar aqui anularia o propósito da conferência.
          onPaste={(evento) => evento.preventDefault()}
          autoComplete="off"
          aria-invalid={Boolean(erroDe("confirmacao_email"))}
        />
      </Campo>

      <Campo
        id="aluno-telefone"
        label="Telefone celular"
        erro={erroDe("telefone")}
        obrigatorio
      >
        <div className="campo-telefone">
          <span className="prefixo-pais" aria-hidden="true">
            🇧🇷 +55
          </span>
          <input
            id="aluno-telefone"
            type="tel"
            value={dados.telefone}
            onChange={alterar("telefone")}
            placeholder="(11) 96123-4567"
            autoComplete="tel-national"
            inputMode="numeric"
            aria-invalid={Boolean(erroDe("telefone"))}
          />
        </div>
      </Campo>

      <div className="grade-form-aluno">
        <Campo
          id="aluno-nascimento"
          label="Data de nascimento"
          erro={erroDe("data_nascimento")}
        >
          <input
            id="aluno-nascimento"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={dados.data_nascimento}
            onChange={alterar("data_nascimento")}
            aria-invalid={Boolean(erroDe("data_nascimento"))}
          />
        </Campo>

        <Campo id="aluno-sexo" label="Sexo">
          <select id="aluno-sexo" value={dados.sexo} onChange={alterar("sexo")}>
            <option value="">Não informado</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
            <option value="OUTRO">Outro</option>
          </select>
        </Campo>

      </div>

      <SecaoFormulario titulo="Objetivo" />

      <Campo id="aluno-objetivo" label="Objetivo principal">
        <select id="aluno-objetivo" value={dados.objetivo} onChange={alterar("objetivo")}>
          <option value="">Selecione um objetivo</option>
          {OBJETIVOS.map((objetivo) => (
            <option key={objetivo} value={objetivo}>
              {objetivo}
            </option>
          ))}
        </select>
      </Campo>

      {dados.objetivo === "Outro" && (
        <Campo
          id="aluno-objetivo-outro"
          label="Descreva o objetivo"
          erro={erroDe("objetivo_outro")}
        >
          <input
            id="aluno-objetivo-outro"
            value={dados.objetivo_outro}
            onChange={alterar("objetivo_outro")}
            aria-invalid={Boolean(erroDe("objetivo_outro"))}
          />
        </Campo>
      )}

      {!editando && (
        <>
          <SecaoFormulario
            titulo="Acesso ao FitzPRO"
            descricao="Como o aluno vai entrar na área dele pela primeira vez."
          />

          {/* Convite por padrão: senha que o personal digita é senha que duas
              pessoas conhecem, e que alguém precisa ditar por WhatsApp. Definir
              na hora continua possível para quem não quer depender de e-mail. */}
          <label className="opcao-acesso">
            <input
              type="checkbox"
              checked={porConvite}
              onChange={(e) => setPorConvite(e.target.checked)}
            />
            <span>
              <strong>Enviar convite por e-mail</strong>
              <span className="ajuda-campo">
                O aluno recebe um link, cria a própria senha e aceita os termos.
                O link vale por 7 dias e pode ser reenviado.
              </span>
            </span>
          </label>

          {!porConvite && (
          <Campo id="aluno-senha" label="Senha de acesso" erro={erroDe("senha")} obrigatorio>
            <div className="input-senha">
              <input
                id="aluno-senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                value={dados.senha}
                onChange={alterar("senha")}
                aria-invalid={Boolean(erroDe("senha"))}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="ajuda-campo">Mínimo de 6 caracteres</span>
          </Campo>
          )}
        </>
      )}

      <p className="campos-obrigatorios">* Campos obrigatórios</p>

      <div className="acoes-form">
        {aoCancelar && (
          <button type="button" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
        <button type="submit" className="primario" disabled={salvando}>
          {salvando
            ? editando
              ? "Salvando..."
              : "Cadastrando..."
            : editando
              ? "Salvar alterações"
              : "Cadastrar aluno"}
        </button>
      </div>
    </form>
  );
}

function SecaoFormulario({ titulo, descricao }) {
  return (
    <div className="secao-formulario">
      <h2>{titulo}</h2>
      {descricao && <p>{descricao}</p>}
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
      {erro && (
        <span className="erro-campo" id={`${id}-erro`}>
          {erro}
        </span>
      )}
    </div>
  );
}
