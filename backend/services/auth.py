from time_util import get_colombia_time
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List

import bcrypt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

TOKEN_TTL_DAYS = 30


def generate_password() -> str:
    """Contraseña aleatoria ultra-segura, generada por el sistema (no la elige el usuario)."""
    return secrets.token_urlsafe(12)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(db: Session, user: "models.User") -> str:
    token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    auth_token = models.AuthToken(
        user_id=user.id,
        token=hashed_token,
        expires_at=get_colombia_time() + timedelta(days=TOKEN_TTL_DAYS),
    )
    db.add(auth_token)
    db.commit()
    return token


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> "models.User":
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")

    token = authorization.removeprefix("Bearer ").strip()
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    auth_token = db.query(models.AuthToken).filter(models.AuthToken.token == hashed_token).first()
    if not auth_token or auth_token.expires_at < get_colombia_time():
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")

    return auth_token.user


def require_role(*roles: "models.RoleEnum"):
    def dependency(current_user: "models.User" = Depends(get_current_user)) -> "models.User":
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="No tenés permiso para esta acción")
        return current_user

    return dependency


def visible_warehouse_keys(user: "models.User") -> Optional[List[str]]:
    """None = sin restricción (ve/opera sobre todas las bodegas).
    Lista = solo esas bodegas. Aplica igual para cualquier rol: un usuario
    sin bodegas asignadas queda sin restricción (así es como un admin
    "maestro" se distingue de un admin acotado a su(s) bodega(s))."""
    keys = [w.key for w in user.warehouses]
    return keys or None


def can_access_warehouse(user: "models.User", warehouse_key: Optional[str]) -> bool:
    """Chequeo puntual para un asset/loan/request concreto o un query param."""
    allowed = visible_warehouse_keys(user)
    return allowed is None or warehouse_key is None or warehouse_key in allowed


def is_master_admin(user: "models.User") -> bool:
    """Admin maestro = rol admin sin bodegas asignadas (ve/gestiona todo).
    Un admin CON bodegas asignadas queda acotado a esas bodegas, igual que
    un encargado, pero conserva las acciones de nivel admin dentro de ellas."""
    return user.role == models.RoleEnum.ADMIN and not user.warehouses


def require_master_admin():
    def dependency(current_user: "models.User" = Depends(get_current_user)) -> "models.User":
        if not is_master_admin(current_user):
            raise HTTPException(status_code=403, detail="Esta acción es exclusiva del administrador maestro")
        return current_user

    return dependency
