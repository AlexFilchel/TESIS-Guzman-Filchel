from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ReglaDeteccion

router = APIRouter(prefix="/api/reglas", tags=["reglas"])


@router.get("/")
async def get_reglas(db: Session = Depends(get_db)):
    reglas = db.query(ReglaDeteccion).order_by(ReglaDeteccion.id).all()
    return [
        {
            "id": r.id,
            "nombre": r.nombre,
            "descripcion": r.descripcion,
            "patron": r.patron,
            "severidad": r.severidad,
            "umbral": r.umbral,
            "ventana_tiempo": r.ventana_tiempo,
            "habilitada": r.habilitada,
        }
        for r in reglas
    ]


@router.patch("/{regla_id}/toggle")
async def toggle_regla(regla_id: int, db: Session = Depends(get_db)):
    regla = db.query(ReglaDeteccion).filter(ReglaDeteccion.id == regla_id).first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    regla.habilitada = not regla.habilitada
    db.commit()
    return {"id": regla.id, "habilitada": regla.habilitada}
