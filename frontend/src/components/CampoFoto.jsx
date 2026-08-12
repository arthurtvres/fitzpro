import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import Avatar from "./Avatar.jsx";
import { TIPOS_ACEITOS, conferirImagem, prepararFotoDePerfil } from "../utils/imagem.js";

/**
 * Escolher a foto de perfil: preview, trocar e remover.
 *
 * Não salva nada — devolve a data URL já reduzida por `aoMudar`, e quem salva é
 * o formulário que o contém, junto com o resto dos campos. Assim serve tanto ao
 * perfil do personal quanto ao cadastro do aluno, que gravam em rotas diferentes.
 */
export default function CampoFoto({ nome, valor, aoMudar, erro }) {
  const entradaRef = useRef(null);
  const [erroLocal, setErroLocal] = useState(null);
  const [processando, setProcessando] = useState(false);

  async function escolher(evento) {
    const arquivo = evento.target.files?.[0];
    // Sempre limpa: sem isso escolher o mesmo arquivo duas vezes não dispara.
    evento.target.value = "";
    if (!arquivo) return;

    const problema = conferirImagem(arquivo);
    if (problema) {
      setErroLocal(problema);
      return;
    }

    setErroLocal(null);
    setProcessando(true);
    try {
      aoMudar(await prepararFotoDePerfil(arquivo));
    } catch (e) {
      setErroLocal(e.message || "Não foi possível ler a imagem.");
    } finally {
      setProcessando(false);
    }
  }

  const problema = erro ?? erroLocal;

  return (
    <div className={`campo campo-foto${problema ? " com-erro" : ""}`}>
      <span className="rotulo-foto">Foto de perfil</span>

      <div className="campo-foto-corpo">
        <Avatar usuario={{ nome, foto_url: valor }} tamanho={88} />

        <div className="campo-foto-acoes">
          <button
            type="button"
            onClick={() => entradaRef.current?.click()}
            disabled={processando}
          >
            <ImagePlus size={15} />
            {processando ? "Processando..." : valor ? "Trocar foto" : "Escolher foto"}
          </button>

          {valor && (
            <button
              type="button"
              className="remover-foto-perfil"
              onClick={() => {
                setErroLocal(null);
                aoMudar(null);
              }}
            >
              <Trash2 size={15} /> Remover
            </button>
          )}

          <span className="ajuda-campo">
            JPG, PNG ou WEBP. A imagem é recortada em quadrado e reduzida a 256px.
          </span>
        </div>
      </div>

      <input
        ref={entradaRef}
        type="file"
        accept={TIPOS_ACEITOS.join(",")}
        onChange={escolher}
        hidden
      />

      {problema && <span className="erro-campo">{problema}</span>}
    </div>
  );
}
