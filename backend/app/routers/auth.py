from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import Usuario
from app.auth import verify_password, create_access_token, get_password_hash, get_current_user
from app.schemas import Token, UsuarioCreate, UsuarioResponse
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(Usuario).filter(Usuario.username == form_data.username).first()
        if not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "Usuario o contraseña incorrectos"}
            )
        if not verify_password(form_data.password, user.hashed_password):
            return JSONResponse(
                status_code=401,
                content={"detail": "Usuario o contraseña incorrectos"}
            )
        if not user.activo:
            return JSONResponse(
                status_code=400,
                content={"detail": "Usuario inactivo"}
            )
        
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logger.error(f"Login error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor"}
        )

@router.post("/register", response_model=UsuarioResponse)
async def register(
    user_data: UsuarioCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(Usuario).filter(
        (Usuario.username == user_data.username) | (Usuario.email == user_data.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Usuario o email ya existe")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = Usuario(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/me", response_model=UsuarioResponse)
async def me(current_user: Usuario = Depends(get_current_user)):
    return current_user