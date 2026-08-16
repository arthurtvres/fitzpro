/**
 * Preparação de imagem antes de salvar: do arquivo escolhido para uma data URL.
 *
 * Foto de perfil e foto de evolução são guardadas como base64 em coluna do
 * banco. Isso só se sustenta porque a imagem é reduzida **aqui**, antes de
 * subir — uma foto de celular tem 3-8 MB, e ela viajaria inteira em toda
 * resposta que incluísse o registro.
 *
 * Os dois casos pedem tratamentos diferentes:
 *
 * - **perfil**: 256px, recortado em quadrado. É um avatar, sempre exibido
 *   redondo e pequeno, e volta em toda listagem de alunos.
 * - **evolução**: 1024px, proporção preservada. Serve para comparar duas datas
 *   lado a lado, então recortar seria destrutivo e 256px não deixaria ver nada.
 */

const LADO_PERFIL = 256;
const LADO_EVOLUCAO = 1024;
const LADO_EXERCICIO = 800;
const QUALIDADE = 0.82;

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
// Gif entra num grupo à parte: os outros três passam pelo canvas de
// redimensionar, e desenhar um gif animado num canvas captura só um quadro —
// achataria a animação numa imagem parada.
export const TIPOS_ACEITOS_COM_GIF = [...TIPOS_ACEITOS, "image/gif"];

/** Antes da leitura: erra cedo, com mensagem que dá para mostrar no campo. */
export function conferirImagem(arquivo) {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return "Formato não suportado. Use JPG, PNG ou WEBP.";
  }
  // 12 MB: acima disso o navegador sofre para decodificar, e não há foto de
  // perfil legítima desse tamanho.
  if (arquivo.size > 12 * 1024 * 1024) {
    return "Imagem muito grande. Escolha uma de até 12 MB.";
  }
  return null;
}

/**
 * Mesma ideia de `conferirImagem`, mas aceitando gif — e com um teto menor,
 * porque o gif não é reduzido antes de subir (ao contrário de jpg/png/webp,
 * que passam pelo canvas em `prepararMidiaDeExercicio`).
 */
export function conferirMidiaDeExercicio(arquivo) {
  if (!TIPOS_ACEITOS_COM_GIF.includes(arquivo.type)) {
    return "Formato não suportado. Use JPG, PNG, WEBP ou GIF.";
  }
  const limite = arquivo.type === "image/gif" ? 4 : 12;
  if (arquivo.size > limite * 1024 * 1024) {
    return `Arquivo muito grande. Escolha um de até ${limite} MB.`;
  }
  return null;
}

/**
 * Separa o que dá para usar do que não dá, numa seleção de vários arquivos.
 *
 * Descartar em silêncio é pior do que recusar: quem arrastou 5 fotos e viu 3
 * aparecerem não descobre o motivo. Devolve o primeiro problema para exibir.
 */
export function separarImagens(arquivos) {
  const validos = [];
  let problema = null;

  for (const arquivo of Array.from(arquivos ?? [])) {
    const erro = conferirImagem(arquivo);
    if (erro) problema ??= `${arquivo.name}: ${erro}`;
    else validos.push(arquivo);
  }

  return { validos, problema };
}

function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const endereco = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(endereco);
      resolve(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(endereco);
      reject(new Error("Não foi possível ler a imagem."));
    };
    imagem.src = endereco;
  });
}

/**
 * Desenha num canvas do tamanho pedido e devolve a data URL.
 *
 * Sai sempre em JPEG: PNG de fotografia fica grande, e nem avatar nem foto de
 * evolução precisam de transparência.
 */
function paraDataUrl(imagem, largura, altura, recorte) {
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;

  const contexto = tela.getContext("2d");
  contexto.imageSmoothingQuality = "high";

  if (recorte) {
    const { x, y, lado } = recorte;
    contexto.drawImage(imagem, x, y, lado, lado, 0, 0, largura, altura);
  } else {
    contexto.drawImage(imagem, 0, 0, largura, altura);
  }

  return tela.toDataURL("image/jpeg", QUALIDADE);
}

/**
 * Avatar: recorta no centro e reduz para um quadrado de 256px.
 *
 * O recorte quadrado é feito aqui e não no CSS porque o que é salvo precisa já
 * estar no formato final — o mesmo dado é exibido em avatar redondo, em lista e
 * no formulário, e nenhum deles deveria depender de object-fit para não distorcer.
 */
export async function prepararFotoDePerfil(arquivo) {
  const imagem = await carregarImagem(arquivo);

  const lado = Math.min(imagem.width, imagem.height);
  const recorte = {
    lado,
    x: (imagem.width - lado) / 2,
    y: (imagem.height - lado) / 2,
  };

  return paraDataUrl(imagem, LADO_PERFIL, LADO_PERFIL, recorte);
}

/**
 * Foto de evolução: cabe num quadrado de 1024px sem perder a proporção.
 *
 * Nunca amplia — `Math.min(1, ...)`. Uma foto já pequena reencodada para cima
 * só ganharia peso, sem ganhar detalhe nenhum.
 */
export async function prepararFotoDeEvolucao(arquivo) {
  const imagem = await carregarImagem(arquivo);

  const escala = Math.min(1, LADO_EVOLUCAO / Math.max(imagem.width, imagem.height));

  return paraDataUrl(
    imagem,
    Math.round(imagem.width * escala),
    Math.round(imagem.height * escala)
  );
}

function paraDataUrlBruta(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Foto ou gif de demonstração de um exercício.
 *
 * Gif sobe como veio — sem o canvas de redimensionar, que achataria a
 * animação num quadro só. Jpg/png/webp continuam passando pelo mesmo
 * pipeline das outras fotos, reduzidos para caber num quadrado de 800px.
 */
export async function prepararMidiaDeExercicio(arquivo) {
  if (arquivo.type === "image/gif") {
    return paraDataUrlBruta(arquivo);
  }

  const imagem = await carregarImagem(arquivo);
  const escala = Math.min(1, LADO_EXERCICIO / Math.max(imagem.width, imagem.height));

  return paraDataUrl(
    imagem,
    Math.round(imagem.width * escala),
    Math.round(imagem.height * escala)
  );
}

/** Iniciais para quem ainda não tem foto: "Arthur Tavares" -> "AT". */
export function iniciaisDe(nome) {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}
