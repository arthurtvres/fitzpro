import { TriangleAlert } from "lucide-react";

import { DOCUMENTOS, VERSAO, VIGENTE_DESDE } from "./documentos.js";

/**
 * O corpo de um documento legal, sem moldura.
 *
 * Existe separado porque o mesmo texto aparece em dois lugares: no modal que o
 * aceite abre e na página em `/termos` e `/privacidade`. Duplicar o `map` faria
 * as duas divergirem de formatação na primeira edição — e ninguém percebe isso
 * lendo o diff de um documento jurídico.
 */
export default function ConteudoLegal({ documento, aoTrocar }) {
  const doc = DOCUMENTOS[documento];
  if (!doc) return null;

  const outro = documento === "termos" ? DOCUMENTOS.privacidade : DOCUMENTOS.termos;

  return (
    <div className="conteudo-legal">
      <p className="resumo">{doc.resumo}</p>
      <p className="versao">
        Versão {VERSAO} · em vigor desde {VIGENTE_DESDE}
      </p>

      {/* Some quando os documentos forem revisados: é um rascunho escrito junto
          com o produto, e publicá-lo como definitivo é pior que não ter. */}
      <div className="aviso-rascunho">
        <TriangleAlert size={16} aria-hidden="true" />
        <span>
          <strong>Rascunho não revisado.</strong> Este texto foi redigido junto
          com o produto e ainda não passou por revisão jurídica. Trechos entre
          colchetes são dados que faltam preencher.
        </span>
      </div>

      {doc.secoes.map((secao) => (
        <section key={secao.titulo} className={secao.destaque ? "destaque" : undefined}>
          <h3>{secao.titulo}</h3>
          {secao.paragrafos.map((texto) => (
            <p key={texto}>{texto}</p>
          ))}
          {secao.aviso && <p className="aviso-lgpd">{secao.aviso}</p>}
        </section>
      ))}

      <footer>
        {/* Dentro do modal troca o documento no lugar; na página é um link. */}
        {aoTrocar ? (
          <button type="button" className="link destaque" onClick={() => aoTrocar(outro.slug)}>
            Ler também: {outro.titulo}
          </button>
        ) : (
          <a href={`/${outro.slug}`}>Ler também: {outro.titulo}</a>
        )}
      </footer>
    </div>
  );
}
