from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from database import get_db
from models import Alerta
from auth import get_current_user

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

@router.get("/summary")
async def get_summary(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    total = db.query(Alerta).count()
    criticas = db.query(Alerta).filter(Alerta.severidad == "critical").count()
    altas = db.query(Alerta).filter(Alerta.severidad == "high").count()
    medias = db.query(Alerta).filter(Alerta.severidad == "medium").count()
    bajas = db.query(Alerta).filter(Alerta.severidad == "low").count()
    
    nuevas = db.query(Alerta).filter(Alerta.estado == "nueva").count()
    resueltas = db.query(Alerta).filter(Alerta.estado == "resuelta").count()
    
    return {
        "total": total,
        "por_severidad": {
            "critical": criticas,
            "high": altas,
            "medium": medias,
            "low": bajas
        },
        "por_estado": {
            "nuevas": nuevas,
            "resueltas": resueltas
        }
    }

@router.get("/timeline")
async def get_timeline(
    dias: int = 7,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    desde = datetime.utcnow() - timedelta(days=dias)
    
    resultados = db.query(
        func.date(Alerta.fecha).label("fecha"),
        Alerta.severidad,
        func.count(Alerta.id).label("cantidad")
    ).filter(Alerta.fecha >= desde).group_by(
        func.date(Alerta.fecha), Alerta.severidad
    ).all()
    
    return [
        {"fecha": str(r.fecha), "severidad": r.severidad, "cantidad": r.cantidad}
        for r in resultados
    ]

@router.get("/top-ips")
async def get_top_ips(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    resultados = db.query(
        Alerta.ip_origen,
        func.count(Alerta.id).label("alertas"),
        func.max(Alerta.fecha).label("ultima")
    ).filter(
        Alerta.ip_origen.isnot(None)
    ).group_by(Alerta.ip_origen).order_by(
        func.count(Alerta.id).desc()
    ).limit(limit).all()
    
    return [
        {"ip": r.ip_origen, "alertas": r.alertas, "ultima": r.ultima}
        for r in resultados
    ]

@router.get("/by-category")
async def get_by_category(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    resultados = db.query(
        Alerta.categoria,
        func.count(Alerta.id).label("cantidad")
    ).group_by(Alerta.categoria).all()
    
    return [{"categoria": r.categoria, "cantidad": r.cantidad} for r in resultados]