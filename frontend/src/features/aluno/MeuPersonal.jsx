import { Mail, MessageCircle, Phone } from "lucide-react";

import Avatar from "../../components/Avatar.jsx";
import Vazio from "../../components/Vazio.jsx";
import { formatarTelefone } from "../../utils/telefone.js";

export default function MeuPersonal({ personal }) {
  if (!personal) {
    return (
      <section className="painel painel-personal-aluno">
        <Vazio icone={MessageCircle}>Seu personal ainda não está vinculado.</Vazio>
      </section>
    );
  }

  const telefone = personal.telefone ? formatarTelefone(personal.telefone) : null;

  return (
    <section className="painel painel-personal-aluno">
      <div className="personal-aluno-topo">
        <Avatar usuario={personal} tamanho={64} />
        <div>
          <span>Seu personal</span>
          <h2>{personal.nome}</h2>
          {personal.email && <p>{personal.email}</p>}
        </div>
      </div>

      <dl className="personal-aluno-dados">
        <div>
          <dt>Nome</dt>
          <dd>{personal.nome}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            {personal.email ? (
              <a href={`mailto:${personal.email}`}>
                <Mail size={15} aria-hidden="true" />
                {personal.email}
              </a>
            ) : (
              <span className="sub">email não informado</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Telefone</dt>
          <dd>
            {telefone ? (
              <a href={`tel:+55${personal.telefone}`}>
                <Phone size={15} aria-hidden="true" />
                {telefone}
              </a>
            ) : (
              <span className="sub">telefone não informado</span>
            )}
          </dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>
            {personal.telefone ? (
              <a
                href={`https://wa.me/55${personal.telefone}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src="/whatsapp-icone.png" alt="" className="icone-marca" />
                Chamar no WhatsApp
              </a>
            ) : (
              <span className="sub">telefone não informado</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
