import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** "2026-08-13" -> "13/08/2026". Sem `new Date`: ele desloca por fuso. */
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

const hojeBR = () =>
  new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

/**
 * O documento que vai para o papel (ou para "Salvar como PDF").
 *
 * Renderiza **fora do app**, num portal no `body`, e só é visível em
 * `@media print`. É o contrário de mandar imprimir a tela escondendo o que
 * sobra: a tela tem sidebar, abas, botões e estado do dia — o que está marcado
 * como feito, o que está em edição — e nada disso pertence a uma folha entregue
 * ao aluno. Com documento próprio, o que se imprime é escrito uma vez e não
 * muda quando a tela mudar.
 *
 * Abre o diálogo de impressão sozinho ao montar, e avisa o pai quando fecha —
 * o componente só existe durante a impressão, então o pai o desmonta em
 * seguida e a árvore volta ao normal.
 */
export default function FolhaImpressao({
  titulo,
  subtitulo,
  aluno,
  personal,
  aoFechar,
  children,
}) {
  // A impressão só começa quando a logo terminou de carregar.
  const [logoPronta, setLogoPronta] = useState(false);

  useEffect(() => {
    if (!logoPronta) return;

    // Um quadro depois: sem isso o navegador tira a "foto" da página antes de
    // o portal ter sido pintado, e a folha sai em branco.
    const id = requestAnimationFrame(() => window.print());

    // `afterprint` dispara tanto ao imprimir quanto ao cancelar — nos dois
    // casos o documento cumpriu seu papel e deve sair da árvore.
    const aoTerminar = () => aoFechar?.();
    window.addEventListener("afterprint", aoTerminar);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", aoTerminar);
    };
  }, [logoPronta, aoFechar]);

 return createPortal(
  <div className="folha-impressao">
    <div className="folha-logo">
      {/*
        `onLoad` antes de imprimir, e não um `requestAnimationFrame` seco: o
        quadro seguinte chega antes de o PNG estar decodificado, e o navegador
        imprime a folha sem a logo. Só aparecia a partir do segundo PDF, quando
        a imagem já estava em cache — que é como esse bug se disfarça.

        `onError` também libera: logo faltando atrasa o PDF, não o impede.
      */}
      <img
        src="/fitzprologin.png"
        alt="FitzPRO"
        onLoad={() => setLogoPronta(true)}
        onError={() => setLogoPronta(true)}
      />
    </div>

    <header className="folha-cabecalho">
      <div>
        <h1 className="titulo">{titulo}</h1>
        {subtitulo && <p className="sub">{subtitulo}</p>}
        {/* No cabeçalho, e não só no rodapé: quem recebe a folha precisa saber
            de quem ela veio antes de ler o conteúdo. */}
        {personal?.nome && (
          <p className="prescritor">Prescrito por {personal.nome}</p>
        )}
      </div>

      <div className="quem">
        <strong>{aluno?.nome}</strong>
        {aluno?.data_nascimento && (
          <span>{dataBR(aluno.data_nascimento)}</span>
        )}
      </div>
    </header>

    {children}

    <footer className="folha-rodape">
      <span>FitzPRO</span>
      <span>Emitido em {hojeBR()}</span>
    </footer>
  </div>,
  document.body
);
}
