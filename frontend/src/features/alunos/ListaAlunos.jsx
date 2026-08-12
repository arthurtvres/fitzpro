import { Pencil, RotateCcw, UserPlus, UserX } from "lucide-react";

import Avatar from "../../components/Avatar.jsx";
import Badge from "../../components/Badge.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import Vazio from "../../components/Vazio.jsx";

export default function ListaAlunos({
  alunos,
  carregando,
  selecionado,
  aoSelecionar,
  aoEditar,
  aoDesativar,
  aoReativar,
}) {
  if (carregando) return <Skeleton quantidade={4} />;
  if (alunos.length === 0)
    return <Vazio icone={UserPlus}>Nenhum aluno por aqui ainda.</Vazio>;

  return (
    <ul className="lista">
      {alunos.map((aluno) => {
        const classes = [
          "item-aluno",
          aluno.ativo ? "" : "inativo",
          selecionado?.id === aluno.id ? "selecionado" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li
            key={aluno.id}
            className={classes}
            onClick={() => aoSelecionar(aluno)}
          >
            <Avatar usuario={aluno} tamanho={36} />

            <div className="info">
              <span className="nome">{aluno.nome}</span>
              <span className="meta">
                {/* idade vem calculada da data de nascimento; pode não existir */}
                {[
                  aluno.email,
                  aluno.idade != null ? `${aluno.idade} anos` : null,
                  aluno.objetivo || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>

            <Badge tom={aluno.ativo ? "sucesso" : "neutro"} ponto>
              {aluno.ativo ? "Ativo" : "Inativo"}
            </Badge>

            {/* stopPropagation para o clique no botão não selecionar o aluno */}
            <div className="acoes" onClick={(e) => e.stopPropagation()}>
              {aluno.ativo ? (
                <>
                  <button className="link" onClick={() => aoEditar(aluno)}>
                    <Pencil size={14} /> editar
                  </button>
                  <button className="link perigo" onClick={() => aoDesativar(aluno)}>
                    <UserX size={14} /> desativar
                  </button>
                </>
              ) : (
                <button className="link destaque" onClick={() => aoReativar(aluno)}>
                  <RotateCcw size={14} /> reativar
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
