/**
 * Uma linha de evolução, em SVG escrito à mão.
 *
 * Extraído do `HistoricoCarga`, onde nasceu como função local. Não vale uma
 * biblioteca de charting: o projeto só tem @dnd-kit, lucide e a fonte, e isto
 * aqui é uma polilinha com bolinhas.
 *
 * `escalaTemporal` corrige um defeito da versão original — o eixo X distribuía
 * os pontos por **índice**, então três meses de intervalo ocupavam a mesma
 * largura que dois dias. O default é `false` para a extração ter sido um
 * refactor idêntico ao original; as telas novas ligam.
 */
export default function Sparkline({
  pontos,
  largura = 320,
  altura = 90,
  margem = 8,
  escalaTemporal = false,
  destaques = [],
  className = "",
  rotulo,
}) {
  const validos = pontos.filter((p) => p.valor != null);
  if (validos.length === 0) return null;

  const valores = validos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  // Faixa zero (o valor nunca mudou) desenharia divisão por zero; a linha reta
  // no meio é a leitura correta desse caso.
  const faixa = maximo - minimo || 1;

  const util = largura - 2 * margem;
  const x = escalaTemporal ? posicaoPorData(validos, margem, util) : posicaoPorIndice(validos, margem, util);
  const y = (valor) => altura - margem - ((valor - minimo) / faixa) * (altura - 2 * margem);

  const linha = validos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ");
  const marcados = new Set(destaques);

  return (
    <svg
      className={`sparkline ${className}`.trim()}
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={rotulo ?? `Evolução: de ${minimo} a ${maximo} em ${validos.length} pontos`}
    >
      {validos.length > 1 && <polyline points={linha} />}
      {validos.map((ponto, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(ponto.valor)}
          r={marcados.has(ponto.chave) ? 5 : 3.5}
          className={marcados.has(ponto.chave) ? "destaque" : undefined}
        />
      ))}
    </svg>
  );
}

/** Um ponto por passo igual — ignora o tempo entre eles. */
function posicaoPorIndice(pontos, margem, util) {
  return (i) => (pontos.length === 1 ? margem + util / 2 : margem + (i * util) / (pontos.length - 1));
}

/** Distribui pela data real: intervalos maiores ocupam mais espaço. */
function posicaoPorData(pontos, margem, util) {
  const tempos = pontos.map((p) => new Date(p.data).getTime());
  const inicio = Math.min(...tempos);
  const duracao = Math.max(...tempos) - inicio || 1;
  return (i) => margem + ((tempos[i] - inicio) / duracao) * util;
}
