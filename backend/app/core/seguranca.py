"""Hash de senha e emissão/validação do token de acesso."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import ALGORITMO_JWT, HORAS_DE_SESSAO, SEGREDO_JWT

def gerar_hash(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def conferir_senha(senha: str, hash_salvo: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), hash_salvo.encode("utf-8"))
    except ValueError:
        # Hash malformado (registro antigo ou corrompido) não derruba o login.
        return False

def criar_token(usuario_id: int, papel: str) -> str:
    agora = datetime.now(timezone.utc)
    conteudo = {
        "sub": str(usuario_id),  # o padrão JWT exige string aqui
        "papel": papel,
        "iat": agora,
        "exp": agora + timedelta(hours=HORAS_DE_SESSAO),
    }
    return jwt.encode(conteudo, SEGREDO_JWT, algorithm=ALGORITMO_JWT)

def ler_token(token: str) -> dict | None:
    """Devolve o conteúdo do token, ou None se for inválido/expirado."""
    try:
        return jwt.decode(token, SEGREDO_JWT, algorithms=[ALGORITMO_JWT])
    except jwt.PyJWTError:
        return None
