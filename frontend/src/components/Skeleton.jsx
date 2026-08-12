/**
 * Placeholder de carregamento. `forma` decide o desenho:
 * - "linha": itens de lista (aluno, treino, dieta, prescrição)
 * - "cartao": células do grid do catálogo
 *
 * aria-hidden + role="status" no container: o leitor de tela anuncia
 * "carregando" uma vez, em vez de ler as barras cinzas.
 */
export default function Skeleton({ forma = "linha", quantidade = 3 }) {
  const itens = Array.from({ length: quantidade });

  return (
    <div
      className={forma === "cartao" ? "grade-exercicios" : "lista"}
      role="status"
      aria-label="Carregando"
    >
      {itens.map((_, indice) =>
        forma === "cartao" ? (
          <div key={indice} className="esqueleto-cartao" aria-hidden="true">
            <div className="esqueleto bloco" />
            <div className="esqueleto texto" />
            <div className="esqueleto texto curto" />
          </div>
        ) : (
          <div key={indice} className="esqueleto-linha" aria-hidden="true">
            <div className="esqueleto avatar" />
            <div className="corpo">
              <div className="esqueleto texto" />
              <div className="esqueleto texto curto" />
            </div>
          </div>
        )
      )}
    </div>
  );
}
