"""Quem está logado, o que essa pessoa pode fazer e sobre quem.

O sistema é multi-tenant: cada personal enxerga só os próprios alunos. O tenant
é o `personal_id` do usuário — um ALUNO aponta para o personal dono dele, e um
PERSONAL é o próprio tenant. Toda consulta a dados de aluno passa por aqui.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.core.seguranca import ler_token
from app.db.session import get_session
from app.models import Papel, Usuario

# auto_error=False para responder 401 com a nossa mensagem, em vez de 403.
esquema = HTTPBearer(auto_error=False)

NAO_AUTENTICADO = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Não autenticado",
    headers={"WWW-Authenticate": "Bearer"},
)

# Pedir dado de outro tenant responde 404, não 403: um 403 confirmaria que
# aquele id existe, e daria para varrer a base contando alunos dos concorrentes.
# Para quem está de fora, o que não é seu simplesmente não existe.
ALUNO_INEXISTENTE = HTTPException(status_code=404, detail="Aluno não encontrado")

def usuario_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(esquema),
    session: Session = Depends(get_session),
) -> Usuario:
    if not credenciais:
        raise NAO_AUTENTICADO

    conteudo = ler_token(credenciais.credentials)
    if not conteudo:
        raise NAO_AUTENTICADO

    usuario = session.get(Usuario, int(conteudo["sub"]))
    if not usuario or not usuario.ativo:
        # Conta apagada ou desativada depois do token ser emitido.
        raise NAO_AUTENTICADO

    return usuario

def personal_atual(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    """Só o personal gerencia alunos, treinos e dietas."""
    if usuario.papel != Papel.PERSONAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o personal pode fazer isso",
        )
    return usuario

def quem_registra(alvo: Usuario, logado: Usuario) -> Usuario:
    """
    Autoriza registrar execução em nome de `alvo`, e devolve quem registrou.

    Esta é a **primeira escrita que um ALUNO faz** neste sistema — até aqui toda
    rota de escrita exigia `personal_atual`. Ela é segura porque `alvo` nunca vem
    do corpo: já saiu de `treino.aluno_id` (ou `dieta.aluno_id`) depois de passar
    por `aluno_do_tenant`, que é quem barra o tenant alheio e também o colega de
    tenant. Aqui só resta a regra que aquele caminho não cobre.

    O personal pode registrar por um aluno dele — é o caso real, ele está ao lado
    na academia — e isso não abre nada: o alcance dele já era esse. Quem apertou
    o botão fica gravado em `registrado_por_id`.

    Deliberadamente **não** existe um `aluno_atual` simétrico a `personal_atual`:
    autorizar por papel daria falsa sensação de proteção e deixaria a checagem
    que importa (é o treino dele?) para o corpo da rota — que é justamente o erro
    que `aluno_do_tenant` foi criado para eliminar.
    """
    if not alvo.ativo:
        raise HTTPException(status_code=400, detail="Aluno está inativo")
    return logado

def tenant_de(usuario: Usuario) -> int:
    """
    O tenant a que o usuário pertence.

    Para o personal é ele mesmo; para o aluno, o personal dono. Um aluno sem
    dono não deveria existir (a migration adotou os antigos e o cadastro sempre
    grava o dono), mas se aparecer, cai no próprio id e não enxerga nada de
    ninguém — falhar fechado é o comportamento seguro aqui.
    """
    if usuario.papel == Papel.PERSONAL:
        return usuario.id
    return usuario.personal_id or usuario.id

def aluno_do_tenant(aluno_id: int, logado: Usuario, session: Session) -> Usuario:
    """
    Busca o aluno garantindo que ele é do tenant de quem pediu.

    É o único caminho para chegar num aluno. Junta as três checagens que antes
    estavam espalhadas — existe, é ALUNO, e é seu — porque separá-las é o que
    fazia cada router lembrar de umas e esquecer de outras.
    """
    aluno = session.get(Usuario, aluno_id)

    if not aluno or aluno.papel != Papel.ALUNO:
        raise ALUNO_INEXISTENTE

    if aluno.personal_id != tenant_de(logado):
        raise ALUNO_INEXISTENTE

    # Aluno logado só chega em si mesmo — sem isto ele veria os colegas de
    # tenant, que são os outros alunos do mesmo personal.
    if logado.papel == Papel.ALUNO and logado.id != aluno_id:
        raise ALUNO_INEXISTENTE

    return aluno
