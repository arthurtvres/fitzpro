import { useEffect, useState } from "react";
import { Check, Crown, Eye, EyeOff, IdCard, Lock } from "lucide-react";

import { api } from "../../api/index.js";
import CampoFoto from "../../components/CampoFoto.jsx";
import {
  cepValido,
  cpfValido,
  formatarCep,
  formatarCpf,
} from "../../utils/documentos.js";
import {
  apenasDigitos,
  formatarTelefone,
  telefoneValido,
} from "../../utils/telefone.js";

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const SENHAS_VAZIAS = { senha_atual: "", senha_nova: "", confirmacao: "" };

/**
 * Os dados do próprio usuário logado: identificação e troca de senha.
 *
 * Não é uma variação de FormularioAluno — ali o personal edita outra pessoa e
 * o foco é o perfil físico (altura, objetivo); aqui a pessoa edita a si mesma e
 * o que importa é o acesso. Os campos físicos do modelo continuam existindo no
 * registro, preservados por `api.perfil.atualizar`.
 */
export default function MeuPerfil({ usuario, aoAtualizar, aoErrar }) {
  const [aba, setAba] = useState("conta");
  const abas = [
    ["conta", "Informações da conta", IdCard],
    ["senha", "Senha", Lock],
    ...(usuario.papel === "PERSONAL" ? [["plano", "Meu plano", Crown]] : []),
  ];

  return (
    <div className="perfil">
      <div className="perfil-abas" role="tablist" aria-label="Minha conta">
        {abas.map(([chave, rotulo, Icone]) => (
          <button
            key={chave}
            type="button"
            className={aba === chave ? "ativa" : ""}
            onClick={() => setAba(chave)}
            role="tab"
            aria-selected={aba === chave}
          >
            <Icone size={16} aria-hidden="true" />
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "conta" && (
        <DadosDaConta usuario={usuario} aoAtualizar={aoAtualizar} aoErrar={aoErrar} />
      )}
      {aba === "senha" && <TrocaDeSenha usuario={usuario} aoErrar={aoErrar} />}
      {aba === "plano" && usuario.papel === "PERSONAL" && <MeuPlano usuario={usuario} />}
    </div>
  );
}

const PLANOS = [
  {
    nome: "Essencial",
    preco: "R$ 29,90",
    periodo: "/mês",
    limite: "até 6 alunos",
    custo: "R$ 4,98",
  },
  {
    nome: "Pro",
    preco: "R$ 49,90",
    periodo: "/mês",
    limite: "até 20 alunos",
    custo: "R$ 2,50",
    destaque: true,
  },
  {
    nome: "Max",
    preco: "R$ 79,90",
    periodo: "/mês",
    limite: "até 50 alunos",
    custo: "R$ 1,60",
  },
  {
    nome: "50+",
    preco: "Sob consulta",
    periodo: "",
    limite: "sob consulta",
    custo: "—",
  },
];

function planoAtual(usuario) {
  const faixa = usuario.quantidade_alunos;
  if (faixa === "MAIS_DE_50") return "50+";
  if (faixa === "DE_31_A_50") return "Max";
  if (["DE_6_A_15", "DE_16_A_30"].includes(faixa)) return "Pro";
  return "Essencial";
}

function MeuPlano({ usuario }) {
  const atual = planoAtual(usuario);

  return (
    <section className="painel painel-perfil painel-planos">
      <SecaoFormulario
        titulo="Meu plano"
        descricao="Veja seu plano atual e compare as opções disponíveis."
      />

      <div className="plano-atual-card">
        <div className="plano-atual-topo">
          <span className="icone-plano">
            <Crown size={16} aria-hidden="true" />
          </span>
          <strong>Seu plano atual</strong>
          <em>Ativo</em>
        </div>
        <div>
          <h3>{atual}</h3>
          <p>Renova mensalmente</p>
        </div>
        <button type="button" className="link perigo">
          Cancelar assinatura
        </button>
      </div>

      <div className="cabecalho-planos-disponiveis">
        <span className="icone-plano">
          <Crown size={16} aria-hidden="true" />
        </span>
        <strong>Planos disponíveis</strong>
      </div>

      <div className="grade-planos">
        {PLANOS.map((plano) => {
          const ativo = plano.nome === atual;
          return (
            <article
              key={plano.nome}
              className={`cartao-plano${ativo ? " ativo" : ""}${plano.destaque ? " destaque" : ""}`}
            >
              <div>
                <span>{ativo ? "Plano atual" : "Disponível"}</span>
                <h3>{plano.nome}</h3>
                <strong>
                  {plano.preco}
                  {plano.periodo && <small>{plano.periodo}</small>}
                </strong>
              </div>
              <dl>
                <div>
                  <dt>Alunos</dt>
                  <dd>{plano.limite}</dd>
                </div>
                <div>
                  <dt>Custo/aluno no limite</dt>
                  <dd>{plano.custo}</dd>
                </div>
              </dl>
              <button type="button" className={ativo ? "" : "primario"} disabled={ativo}>
                {ativo ? "Plano atual" : plano.nome === "50+" ? "Falar conosco" : "Contratar"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DadosDaConta({ usuario, aoAtualizar, aoErrar }) {
  // Telefone e data de nascimento são exigências do cadastro de ALUNO; o
  // personal informa se quiser. A API aplica a mesma distinção.
  const ehAluno = usuario.papel === "ALUNO";
  const [dados, setDados] = useState({
    nome: "",
    email: "",
    data_nascimento: "",
    sexo: "",
    telefone: "",
    cpf: "",
    cep: "",
    logradouro: "",
    numero_endereco: "",
    complemento: "",
    bairro: "",
    foto_url: null,
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    setDados({
      nome: usuario.nome,
      email: usuario.email,
      data_nascimento: usuario.data_nascimento ?? "",
      sexo: usuario.sexo ?? "",
      telefone: formatarTelefone(usuario.telefone ?? ""),
      // O servidor guarda so digitos; a mascara e para ler.
      cpf: formatarCpf(usuario.cpf ?? ""),
      cep: formatarCep(usuario.cep ?? ""),
      logradouro: usuario.logradouro ?? "",
      numero_endereco: usuario.numero_endereco ?? "",
      complemento: usuario.complemento ?? "",
      bairro: usuario.bairro ?? "",
      foto_url: usuario.foto_url ?? null,
    });
    setErros({});
  }, [usuario]);

  const alterarFoto = (foto) => {
    setDados((atual) => ({ ...atual, foto_url: foto }));
    setSalvo(false);
  };

  const mascaraDe = { telefone: formatarTelefone, cpf: formatarCpf, cep: formatarCep };

  const alterar = (campo) => (evento) => {
    const mascara = mascaraDe[campo];
    const valor = mascara ? mascara(evento.target.value) : evento.target.value;
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: null }));
    setSalvo(false);
  };

  async function enviar(evento) {
    evento.preventDefault();

    const proximos = {};
    if (!dados.nome.trim()) proximos.nome = "Informe o seu nome.";
    if (!emailValido(dados.email.trim())) proximos.email = "Informe um e-mail válido.";
    // Obrigatória só para aluno, como o telefone: é regra do cadastro de
    // aluno, e a API recusa o PUT sem ela. O personal não precisa informar.
    if (ehAluno && !dados.data_nascimento) {
      proximos.data_nascimento = "Informe a data de nascimento.";
    } else if (
      dados.data_nascimento &&
      dados.data_nascimento > new Date().toISOString().slice(0, 10)
    ) {
      proximos.data_nascimento = "Informe uma data de nascimento válida.";
    }
    // Opcionais, mas preenchidos têm que fechar a conta — a API recusa de
    // qualquer forma, e descobrir aqui poupa a ida ao servidor.
    if (dados.cpf && !cpfValido(dados.cpf)) proximos.cpf = "CPF inválido.";
    if (dados.cep && !cepValido(dados.cep)) {
      proximos.cep = "Informe o CEP com 8 dígitos.";
    }
    // A API exige telefone de aluno; do personal, aceita em branco. Preenchido,
    // porém, tem que estar certo nos dois casos.
    if ((ehAluno || dados.telefone) && !telefoneValido(dados.telefone)) {
      proximos.telefone = "Informe o telefone com DDD.";
    }
    setErros(proximos);
    if (Object.keys(proximos).length > 0) return;

    setSalvando(true);
    try {
      const atualizado = await api.perfil.atualizar(usuario, {
        nome: dados.nome.trim(),
        email: dados.email.trim().toLowerCase(),
        data_nascimento: dados.data_nascimento || null,
        sexo: dados.sexo || null,
        telefone: apenasDigitos(dados.telefone) || null,
        cpf: dados.cpf.trim() || null,
        cep: dados.cep.trim() || null,
        logradouro: dados.logradouro.trim() || null,
        numero_endereco: dados.numero_endereco.trim() || null,
        complemento: dados.complemento.trim() || null,
        bairro: dados.bairro.trim() || null,
        foto_url: dados.foto_url,
      });
      aoAtualizar(atualizado);
      aoErrar(null);
      setSalvo(true);
    } catch (e) {
      const mensagem = e?.message ?? "";
      if (mensagem.toLowerCase().includes("email")) {
        setErros({ email: "Já existe uma conta com este e-mail." });
      } else {
        aoErrar(mensagem || "Não foi possível salvar os seus dados.");
      }
    } finally {
      setSalvando(false);
    }
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <section className="painel painel-perfil">
      <form className="formulario aluno-form" onSubmit={enviar} noValidate>
        <SecaoFormulario
          titulo="Dados da conta"
          descricao="Como você aparece no FitzPRO e o e-mail que usa para entrar."
        />

        <CampoFoto nome={dados.nome} valor={dados.foto_url} aoMudar={alterarFoto} />

        <Campo id="perfil-nome" label="Nome completo" erro={erros.nome} obrigatorio>
          <input
            id="perfil-nome"
            value={dados.nome}
            onChange={alterar("nome")}
            autoComplete="name"
            aria-invalid={Boolean(erros.nome)}
          />
        </Campo>

        <Campo id="perfil-email" label="E-mail" erro={erros.email} obrigatorio>
          <input
            id="perfil-email"
            type="email"
            value={dados.email}
            onChange={alterar("email")}
            autoComplete="email"
            aria-invalid={Boolean(erros.email)}
          />
          <span className="ajuda-campo">É com ele que você faz login.</span>
        </Campo>

        <Campo
          id="perfil-telefone"
          label="Telefone celular"
          erro={erros.telefone}
          obrigatorio={ehAluno}
        >
          <div className="campo-telefone">
            <span className="prefixo-pais" aria-hidden="true">
              🇧🇷 +55
            </span>
            <input
              id="perfil-telefone"
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

        <div className="grade-form-aluno">
          <Campo
            id="perfil-nascimento"
            label="Data de nascimento"
            erro={erros.data_nascimento}
            obrigatorio={ehAluno}
          >
            <input
              id="perfil-nascimento"
              type="date"
              max={hoje}
              value={dados.data_nascimento}
              onChange={alterar("data_nascimento")}
              aria-invalid={Boolean(erros.data_nascimento)}
            />
          </Campo>

          <Campo id="perfil-sexo" label="Sexo">
            <select id="perfil-sexo" value={dados.sexo} onChange={alterar("sexo")}>
              <option value="">Não informado</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="OUTRO">Outro</option>
            </select>
          </Campo>
        </div>

        {usuario.papel === "PERSONAL" && (
          <>
            <SecaoFormulario
              titulo="Dados do personal"
              descricao="Dados cadastrais e endereço do seu perfil profissional."
            />

            <Campo id="perfil-cpf" label="CPF" erro={erros.cpf}>
              <input
                id="perfil-cpf"
                value={dados.cpf}
                onChange={alterar("cpf")}
                placeholder="000.000.000-00"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={Boolean(erros.cpf)}
              />
            </Campo>

            <div className="grade-form-aluno">
              <Campo id="perfil-cep" label="CEP" erro={erros.cep}>
                <input
                  id="perfil-cep"
                  value={dados.cep}
                  onChange={alterar("cep")}
                  placeholder="00000-000"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  aria-invalid={Boolean(erros.cep)}
                />
              </Campo>

              <Campo id="perfil-logradouro" label="Logradouro">
                <input
                  id="perfil-logradouro"
                  value={dados.logradouro}
                  onChange={alterar("logradouro")}
                  placeholder="Rua, avenida..."
                  autoComplete="address-line1"
                />
              </Campo>
            </div>

            <div className="grade-form-aluno">
              <Campo id="perfil-numero-endereco" label="Número">
                <input
                  id="perfil-numero-endereco"
                  value={dados.numero_endereco}
                  onChange={alterar("numero_endereco")}
                  placeholder="0000"
                  autoComplete="address-line2"
                />
              </Campo>

              <Campo id="perfil-complemento" label="Complemento">
                <input
                  id="perfil-complemento"
                  value={dados.complemento}
                  onChange={alterar("complemento")}
                  placeholder="Sala, bloco, condomínio..."
                />
              </Campo>

              <Campo id="perfil-bairro" label="Bairro">
                <input
                  id="perfil-bairro"
                  value={dados.bairro}
                  onChange={alterar("bairro")}
                  autoComplete="address-level3"
                />
              </Campo>
            </div>
          </>
        )}

        <p className="campos-obrigatorios">* Campos obrigatórios</p>

        <div className="acoes-form">
          {salvo && (
            <span className="aviso-salvo">
              <Check size={15} /> Dados atualizados
            </span>
          )}
          <button type="submit" className="primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </section>
  );
}

function TrocaDeSenha({ usuario, aoErrar }) {
  const [dados, setDados] = useState(SENHAS_VAZIAS);
  const [erros, setErros] = useState({});
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocada, setTrocada] = useState(false);

  const alterar = (campo) => (evento) => {
    const valor = evento.target.value;
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: null }));
    setTrocada(false);
  };

  async function enviar(evento) {
    evento.preventDefault();

    const proximos = {};
    if (!dados.senha_atual) proximos.senha_atual = "Informe a sua senha atual.";
    if (dados.senha_nova.length < 6) {
      proximos.senha_nova = "A nova senha deve ter pelo menos 6 caracteres.";
    } else if (dados.senha_nova === dados.senha_atual) {
      proximos.senha_nova = "A nova senha precisa ser diferente da atual.";
    }
    if (dados.confirmacao !== dados.senha_nova) {
      proximos.confirmacao = "As senhas não coincidem.";
    }
    setErros(proximos);
    if (Object.keys(proximos).length > 0) return;

    setSalvando(true);
    try {
      await api.perfil.trocarSenha(usuario, dados.senha_atual, dados.senha_nova);
      setDados(SENHAS_VAZIAS);
      aoErrar(null);
      setTrocada(true);
    } catch (e) {
      const mensagem = e?.message ?? "";
      // O backend responde 400 "Senha atual incorreta" — é erro de campo, não de tela.
      if (mensagem.toLowerCase().includes("senha atual")) {
        setErros({ senha_atual: "Senha atual incorreta." });
      } else {
        aoErrar(mensagem || "Não foi possível trocar a senha.");
      }
    } finally {
      setSalvando(false);
    }
  }

  const tipo = mostrar ? "text" : "password";

  return (
    <section className="painel painel-perfil">
      <form className="formulario aluno-form" onSubmit={enviar} noValidate>
        <SecaoFormulario
          titulo="Alterar senha"
          descricao="Trocar a própria senha exige a atual, mesmo sendo personal."
        />

        <Campo id="perfil-senha-atual" label="Senha atual" erro={erros.senha_atual} obrigatorio>
          <div className="input-senha">
            <input
              id="perfil-senha-atual"
              type={tipo}
              autoComplete="current-password"
              value={dados.senha_atual}
              onChange={alterar("senha_atual")}
              aria-invalid={Boolean(erros.senha_atual)}
            />
            <button
              type="button"
              onClick={() => setMostrar((atual) => !atual)}
              aria-label={mostrar ? "Ocultar senhas" : "Mostrar senhas"}
            >
              {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Campo>

        <Campo id="perfil-senha-nova" label="Nova senha" erro={erros.senha_nova} obrigatorio>
          <input
            id="perfil-senha-nova"
            type={tipo}
            autoComplete="new-password"
            minLength={6}
            value={dados.senha_nova}
            onChange={alterar("senha_nova")}
            aria-invalid={Boolean(erros.senha_nova)}
          />
          <span className="ajuda-campo">Mínimo de 6 caracteres</span>
        </Campo>

        <Campo
          id="perfil-senha-confirmacao"
          label="Confirmar nova senha"
          erro={erros.confirmacao}
          obrigatorio
        >
          <input
            id="perfil-senha-confirmacao"
            type={tipo}
            autoComplete="new-password"
            value={dados.confirmacao}
            onChange={alterar("confirmacao")}
            aria-invalid={Boolean(erros.confirmacao)}
          />
        </Campo>

        <div className="acoes-form">
          {trocada && (
            <span className="aviso-salvo">
              <Check size={15} /> Senha alterada
            </span>
          )}
          <button type="submit" className="primario" disabled={salvando}>
            {salvando ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </form>
    </section>
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
