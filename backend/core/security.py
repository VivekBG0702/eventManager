import os
from datetime import datetime, timedelta
from typing import Any, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security_bearer = HTTPBearer(auto_error=False)


def _normalize_bcrypt_input(password: str) -> bytes:
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    password_bytes = _normalize_bcrypt_input(password)
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            _normalize_bcrypt_input(plain_password),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, ValueError):
        return None


def get_current_user_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
) -> Optional[dict[str, Any]]:
    if not credentials:
        return None
    return decode_access_token(credentials.credentials)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    from models.admin import Admin
    from models.coordinator import Coordinator
    from models.user import User

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = payload.get("role")
    user_id = payload.get("id") or payload.get("sub")

    if not role or user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is malformed.",
        )

    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token.",
        )

    user_obj = None
    if role == "student":
        user_obj = db.query(User).filter(User.id == user_id_int).first()
    elif role == "coordinator":
        user_obj = db.query(Coordinator).filter(Coordinator.id == user_id_int).first()
    elif role == "admin":
        user_obj = db.query(Admin).filter(Admin.id == user_id_int).first()

    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
        )

    return {
        "id": user_id_int,
        "role": role,
        "user": user_obj,
        "email": payload.get("email"),
    }


def require_role(allowed_roles: list[str]):
    def role_checker(
        current: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        if current["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: {current['role']} does not have required permissions.",
            )
        return current

    return role_checker