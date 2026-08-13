import { useEffect, useRef, useState } from "react";
import { Check, EyeOff, NotebookPen } from "lucide-react";

import { api } from "../../api/index.js";

// Espelha TAMANHO_MAXIMO_OBSERVACOES do backend.
const TAMANHO_MAXIMO = 5000;

// Tempo parado antes de salvar. Curto demais salva a cada palavra; longo demais
// perde o texto de quem fecha a aba logo depois de escrever.
const ESPERA_PARA_SALVAR = 900;

/**
 * O caderno do personal sobre o aluno — privado, e dito na tela.
 *
 * "Visível apenas para você" não é decoração: quem escreve uma anotação sobre
 * outra pessoa precisa saber, sem ter que deduzir, se ela vai ser lida por
 * quem é o assunto dela. Uma nota clínica escrita achando que é privada e
 * exibida ao aluno é o pior desfecho possível desta tela.
 *
 * A garantia mora no servidor, não aqui: a nota não viaja em `publico()`, e as
 * duas rotas exigem `personal_atual`.
 *
 * Salva sozinho depois de uma pausa na digitação, com o estado dito ao lado do
 * título. Botão "Salvar" exigiria lembrar de clicar — e uma nota que some
 * porque ninguém clicou é pior do que não ter o campo.
 */
export default function ObservacoesDoAluno({ aluno, aoErrar }) {
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState("parado"); // parado | salvando | salvo
  const cronometro = useRef(null);
  // O que está gravado no servidor. Comparar com isso evita salvar quando o
  // texto voltou sozinho ao que já era, e evita um POST logo após carregar.
  const gravado = useRef("");

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    api.alunos.observacoes
      .ler(aluno.id)
      .then(({ texto: salvo }) => {
        if (cancelado) return;
        setTexto(salvo);
        gravado.current = salvo;
      })
      .catch((e) => !cancelado && aoErrar?.(e.message))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
      clearTimeout(cronometro.current);
    };
  }, [aluno.id, aoErrar]);

  async function salvar(valor) {
    if (valor === gravado.current) return;
    setEstado("salvando");
    try {
      const { texto: salvo } = await api.alunos.observacoes.salvar(aluno.id, valor);
      gravado.current = salvo;
      setEstado("salvo");
      setTimeout(() => setEstado((atual) => (atual === "salvo" ? "parado" : atual)), 2000);
    } catch (e) {
      setEstado("parado");
      aoErrar?.(e.message);
    }
  }

  function digitar(evento) {
    const valor = evento.target.value.slice(0, TAMANHO_MAXIMO);
    setTexto(valor);
    clearTimeout(cronometro.current);
    cronometro.current = setTimeout(() => salvar(valor), ESPERA_PARA_SALVAR);
  }

  // Sair do campo salva na hora: esperar a pausa quando a pessoa já foi embora
  // é justamente quando dá tempo de a aba fechar.
  function sair() {
    clearTimeout(cronometro.current);
    salvar(texto);
  }

  const restantes = TAMANHO_MAXIMO - texto.length;

  return (
    <section className="cartao-observacoes">
      <div className="cabecalho-ficha">
        <NotebookPen size={17} aria-hidden="true" />
        <h3>Observações</h3>
        <span className="estado-salvamento" aria-live="polite">
          {estado === "salvando" && "Salvando..."}
          {estado === "salvo" && (
            <>
              <Check size={13} aria-hidden="true" /> Salvo
            </>
          )}
        </span>
      </div>

      <p className="aviso-privado">
        <EyeOff size={13} aria-hidden="true" />
        Visível apenas para você. 
      </p>

      <textarea
        className="campo-observacoes"
        value={texto}
        onChange={digitar}
        onBlur={sair}
        disabled={carregando}
        rows={6}
        maxLength={TAMANHO_MAXIMO}
        placeholder={
          carregando
            ? "Carregando..."
            : "Lesões, restrições, preferências, combinados do atendimento..."
        }
      />

      {/* Só perto do teto: um contador sempre visível vira ruído numa nota que
          quase nunca chega perto do limite. */}
      {restantes < 300 && (
        <span className="ajuda-campo">{restantes} caracteres restantes</span>
      )}
    </section>
  );
}
