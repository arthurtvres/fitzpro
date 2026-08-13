import { useState } from "react";
import { Mail, Phone, Pencil, Send } from "lucide-react";

import { api } from "../../api/index.js";
import { formatarTelefone } from "../../utils/telefone.js";

/** "1994-03-12" -> "12/03/1994". Sem `new Date`: ele desloca por fuso. */
function dataBR(iso) {
  return iso ? iso.split("-").reverse().join("/") : null;
}

// Espelha as opções de FormularioAluno — o banco guarda o código, não o rótulo.
const SEXOS = { F: "Feminino", M: "Masculino", OUTRO: "Outro" };

/**
 * O cadastro do aluno — a primeira coisa que o modal mostra.
 *
 * A aba de treinos era a inicial, e isso partia do princípio de que o personal
 * abre o aluno para *montar* alguma coisa. Na maior parte das vezes ele abre
 * para lembrar quem é a pessoa, ou para achar o telefone dela — e o telefone
 * estava cadastrado, obrigatório desde o formulário novo, sem aparecer em
 * lugar nenhum da interface.
 *
 * Campo vazio aparece como "—" em vez de sumir: a lacuna é informação. Um
 * cadastro sem data de nascimento tem que ser visível para ser preenchido, e
 * uma ficha que esconde o que falta parece completa quando não está.
 */
export default function FichaDoAluno({ aluno, aoEditar, aoErrar }) {
  const [convite, setConvite] = useState(null);
  const telefone = aluno.telefone ? formatarTelefone(aluno.telefone) : null;

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
  const nascimento = dataBR(aluno.data_nascimento);

  const perfil = [
    ["Data de nascimento", nascimento && aluno.idade != null
      ? `${nascimento} (${aluno.idade} anos)`
      : nascimento],
    ["Sexo", SEXOS[aluno.sexo] ?? aluno.sexo],
    ["Objetivo", aluno.objetivo],
  ];

  return (
    <div className="ficha-aluno">
      <section>
        <h3>Contato</h3>
        <ul className="contatos">
          <li>
            <Mail size={16} aria-hidden="true" />
            <a href={`mailto:${aluno.email}`}>{aluno.email}</a>
          </li>
          <li>
            <Phone size={16} aria-hidden="true" />
            {telefone ? (
              <span className="contato-telefone">
                <a href={`tel:+55${aluno.telefone}`}>{telefone}</a>
                {/* O personal fala com aluno por WhatsApp, não por ligação —
                    o link direto poupa copiar o número para outro app.

                    A marca é imagem, e não um ícone do lucide: o balão genérico
                    dizia "mensagem", e é o verde do WhatsApp que faz o link ser
                    reconhecido sem ler o rótulo. `alt=""` porque o texto ao lado
                    já nomeia o destino — um leitor de tela falaria duas vezes. */}
                <a
                  className="link destaque"
                  href={`https://wa.me/55${aluno.telefone}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src="/whatsapp-icone.png" alt="" className="icone-marca" />
                  WhatsApp
                </a>
              </span>
            ) : (
              <span className="sub">telefone não informado</span>
            )}
          </li>
        </ul>
      </section>

      <section>
        <h3>Perfil</h3>
        <dl className="dados-aluno">
          {perfil.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd className={valor ? undefined : "sub"}>{valor || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Só aparece para quem ainda não entrou. Depois do primeiro acesso o
          aluno tem senha própria, e reenviar convite não faria nada por ele —
          o caminho dali em diante é "esqueci minha senha", que é dele. */}
      {!aluno.aceitou_termos && aluno.ativo && (
        <section>
          <h3>Primeiro acesso</h3>
          <p className="pendente-acesso">
            {aluno.nome.split(" ")[0]} ainda não criou a senha dele. O convite
            vale por 7 dias.
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
        </section>
      )}

      {aoEditar && (
        <button type="button" className="link destaque" onClick={() => aoEditar(aluno)}>
          <Pencil size={14} aria-hidden="true" /> Editar cadastro
        </button>
      )}
    </div>
  );
}
