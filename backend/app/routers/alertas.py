from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Alerta
from app.schemas import AlertaResponse, AlertaUpdate
from app.auth import get_current_user

router = APIRouter(prefix="/api/alertas", tags=["alertas"])

@router.get("/", response_model=List[AlertaResponse])
async def listar_alertas(
    skip: int = 0,
    limit: int = 50,
    severidad: Optional[str] = None,
    categoria: Optional[str] = None,
    estado: Optional[str] = None,
    desde: Optional[datetime] = None,
    hasta: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Alerta)
    
    if severidad:
        query = query.filter(Alerta.severidad == severidad)
    if categoria:
        query = query.filter(Alerta.categoria == categoria)
    if estado:
        query = query.filter(Alerta.estado == estado)
    if desde:
        query = query.filter(Alerta.fecha >= desde)
    if hasta:
        query = query.filter(Alerta.fecha <= hasta)
    
    return query.order_by(Alerta.fecha.desc()).offset(skip).limit(limit).all()

@router.get("/{alerta_id}", response_model=AlertaResponse)
async def obtener_alerta(
    alerta_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    alerta = db.query(Alerta).filter(Alerta.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return alerta

@router.patch("/{alerta_id}", response_model=AlertaResponse)
async def actualizar_alerta(
    alerta_id: int,
    alerta_update: AlertaUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    alerta = db.query(Alerta).filter(Alerta.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    
    update_data = alerta_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(alerta, key, value)
    
    if alerta_update.estado == "resuelta":
        alerta.resuelto_en = datetime.utcnow()
    
    db.commit()
    db.refresh(alerta)
    return alerta