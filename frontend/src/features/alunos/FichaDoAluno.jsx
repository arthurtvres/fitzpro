import { useState } from "react";
import { Check, Copy, Lock, Pencil, Send, UserRoundCheck } from "lucide-react";

import { api } from "../../api/index.js";
import { personalPodeEditar } from "./regras.js";
import { formatarTelefone } from "../../utils/telefone.js";

/** "1994-03-12" -> "12/03/1994". Sem `new Date`: ele desloca por fuso. */
function dataBR(iso) {
  return iso ? iso.split("-").reverse().join("/") : null;
}

// Espelha as opções de FormularioAluno — o banco guarda o código, não o rótulo.
const SEXOS = { F: "Feminino", M: "Masculino", OUTRO: "Outro" };

/**
 * Copia sem tirar o dado da tela.
 *
 * O personal copia telefone e e-mail para colar em outro app o tempo todo, e
 * selecionar texto no meio de uma grade é justamente o que dá errado no
 * celular. O ícone só aparece no hover, para não competir com o valor.
 */
function BotaoCopiar({ valor, rotulo }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sem permissão de área de transferência (http, navegador antigo): o
      // valor continua na tela para selecionar à mão. Falhar em silêncio aqui
      // é melhor que um alerta para uma ação acessória.
    }
  }

  return (
    <button
      type="button"
      className="botao-copiar"
      onClick={copiar}
      aria-label={copiado ? "Copiado" : `Copiar ${rotulo}`}
      title={copiado ? "Copiado" : `Copiar ${rotulo}`}
    >
      {copiado ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

/** Um par rótulo/valor da grade. Vazio vira "—", nunca some. */
function Dado({ rotulo, children, vazio }) {
  return (
    <div className="dado">
      <dt>{rotulo}</dt>
      <dd className={vazio ? "sub" : undefined}>{vazio ? "—" : children}</dd>
    </div>
  );
}

/**
 * O cadastro do aluno — a primeira aba da página dele.
 *
 * Grade de rótulo sobre valor em vez de lista corrida: o personal vem aqui
 * procurar **um** dado (o telefone, quase sempre), e uma grade se varre com o
 * olho enquanto um parágrafo precisa ser lido.
 *
 * Campo vazio aparece como "—" em vez de sumir: a lacuna é informação. Um
 * cadastro sem data de nascimento tem que ser visível para ser preenchido, e
 * uma ficha que esconde o que falta parece completa quando não está.
 */
export default function FichaDoAluno({ aluno, aoEditar, aoErrar }) {
  const [convite, setConvite] = useState(null);

  const telefone = aluno.telefone ? formatarTelefone(aluno.telefone) : null;
  const nascimento = dataBR(aluno.data_nascimento);
  const primeiroNome = aluno.nome.split(" ")[0];

  async function reenviarConvite() {
    setConvite("enviando");
    try {
      await api.alunos.reenviarConvite(aluno.id);
      setConvite("enviado");
    } catch (e) {
      setConvite(null);
      aoErrar?.(e.message);
    }
  }

  return (
    <div className="ficha-aluno">
      <div className="cabecalho-ficha">
        <UserRoundCheck size={17} aria-hidden="true" />
        <h3>Informações do aluno</h3>
      </div>

      <dl className="dados-aluno">
        <Dado rotulo="Nome">{aluno.nome}</Dado>

        <Dado rotulo="E-mail">
          <span className="valor-com-acao">
            <a href={`mailto:${aluno.email}`}>{aluno.email}</a>
            <BotaoCopiar valor={aluno.email} rotulo="e-mail" />
          </span>
        </Dado>

        <Dado rotulo="Telefone" vazio={!telefone}>
          <span className="valor-com-acao">
            <a href={`tel:+55${aluno.telefone}`}>+55 {telefone}</a>
            {/* A marca é imagem, e não um ícone do lucide: o balão genérico
                dizia "mensagem", e é o verde do WhatsApp que faz o link ser
                reconhecido sem ler rótulo. `alt=""` porque o `title` já nomeia
                o destino — um leitor de tela falaria duas vezes. */}
            <a
              href={`https://wa.me/55${aluno.telefone}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir no WhatsApp"
              aria-label="Abrir no WhatsApp"
            >
              <img src="/whatsapp-icone.png" alt="" className="icone-marca" />
            </a>
            <BotaoCopiar valor={aluno.telefone} rotulo="telefone" />
          </span>
        </Dado>

        <Dado rotulo="Data de nascimento" vazio={!nascimento}>
          {nascimento}
          {aluno.idade != null && <span className="sufixo">({aluno.idade} anos)</span>}
        </Dado>

        <Dado rotulo="Sexo" vazio={!aluno.sexo}>
          {SEXOS[aluno.sexo] ?? aluno.sexo}
        </Dado>

        <Dado rotulo="Objetivo" vazio={!aluno.objetivo}>
          {aluno.objetivo}
        </Dado>
      </dl>

      {/* Só aparece para quem ainda não entrou. Depois do primeiro acesso o
          aluno tem senha própria, e reenviar convite não faria nada por ele —
          o caminho dali em diante é "esqueci minha senha", que é dele. */}
      {!aluno.aceitou_termos && aluno.ativo && (
        <div className="bloco-primeiro-acesso">
          <p className="pendente-acesso">
            {primeiroNome} ainda não criou a senha dele. O convite vale por 7 dias.
          </p>
          {convite === "enviado" ? (
            <p className="sub">Convite reenviado para {aluno.email}.</p>
          ) : (
            <button
              type="button"
              className="link destaque"
              onClick={reenviarConvite}
              disabled={convite === "enviando"}
            >
              <Send size={14} aria-hidden="true" />
              {convite === "enviando" ? "Enviando..." : "Reenviar convite"}
            </button>
          )}
        </div>
      )}

      {/* Some quando o aluno assume a conta. A frase explica em vez de só
          desaparecer: o botão existia ontem, e sumir sem motivo parece bug. */}
      {aoEditar &&
        (personalPodeEditar(aluno) ? (
          <button type="button" className="link destaque" onClick={() => aoEditar(aluno)}>
            <Pencil size={14} aria-hidden="true" /> Editar cadastro
          </button>
        ) : (
          <p className="nota-cadastro-do-aluno">
            <Lock size={13} aria-hidden="true" />
            Cadastro gerenciado pelo aluno · Alterações em Minha conta
          </p>
        ))}
    </div>
  );
}
