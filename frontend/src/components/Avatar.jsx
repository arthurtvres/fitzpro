import { iniciaisDe } from "../utils/imagem.js";

/**
 * Foto do usuário, com as iniciais como reserva.
 *
 * Genérico de propósito: sidebar, lista de alunos, cartão e perfil. O tamanho
 * vem em px porque cada contexto usa um, e fixar por classe daria uma variação
 * de CSS por chamada. Com `aoClicar` sai um botão, senão um span decorativo —
 * na lista o nome do aluno já está ao lado, então a foto não acrescenta
 * informação para quem usa leitor de tela.
 */
export default function Avatar({ usuario, tamanho = 40, className = "", aoClicar, rotulo }) {
  const conteudo = usuario?.foto_url ? (
    <img className="avatar-foto" src={usuario.foto_url} alt="" />
  ) : (
    iniciaisDe(usuario?.nome)
  );

  const estilo = {
    width: tamanho,
    height: tamanho,
    minWidth: tamanho,
    fontSize: Math.round(tamanho * 0.36),
  };

  const classes = `avatar ${className}`.trim();

  if (aoClicar) {
    return (
      <button type="button" className={classes} style={estilo} onClick={aoClicar} aria-label={rotulo}>
        {conteudo}
      </button>
    );
  }

  return (
    <span className={classes} style={estilo} aria-hidden="true">
      {conteudo}
    </span>
  );
}
