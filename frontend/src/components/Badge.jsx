/**
 * Pílula de status. `tom` escolhe o par fundo/texto já validado para contraste:
 * neutro, info, sucesso, alerta e erro.
 */
export default function Badge({ tom = "neutro", ponto, children }) {
  return (
    <span className={`badge ${tom}`}>
      {ponto && <span className="ponto" aria-hidden="true" />}
      {children}
    </span>
  );
}
