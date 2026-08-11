from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from statistics import mean, median, pstdev

from app.database import get_db
from app.models import Alerta

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def _segundos(desde, hasta):
    if desde is None or hasta is None:
        return None
    return (hasta - desde).total_seconds()


def _resumen(valores):
    limpios = [v for v in valores if v is not None]
    if not limpios:
        return None
    return {
        "n": len(limpios),
        "media": round(mean(limpios), 2),
        "mediana": round(median(limpios), 2),
        "min": round(min(limpios), 2),
        "max": round(max(limpios), 2),
        "desvio": round(pstdev(limpios), 2) if len(limpios) > 1 else 0.0
    }

@router.get("/summary")
async def get_summary(db: Session = Depends(get_db)):
    total = db.query(Alerta).count()
    criticas = db.query(Alerta).filter(Alerta.severidad == "critical").count()
    altas = db.query(Alerta).filter(Alerta.severidad == "high").count()
    medias = db.query(Alerta).filter(Alerta.severidad == "medium").count()
    bajas = db.query(Alerta).filter(Alerta.severidad == "low").count()
    
    nuevas = db.query(Alerta).filter(Alerta.estado == "nueva").count()
    investigadas = db.query(Alerta).filter(Alerta.estado == "investigada").count()
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
            "investigadas": investigadas,
            "resueltas": resueltas
        }
    }

@router.get("/timeline")
async def get_timeline(dias: int = 7, db: Session = Depends(get_db)):
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
async def get_top_ips(limit: int = 10, db: Session = Depends(get_db)):
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
async def get_by_category(db: Session = Depends(get_db)):
    resultados = db.query(
        Alerta.categoria,
        func.count(Alerta.id).label("cantidad")
    ).group_by(Alerta.categoria).all()

    return [{"categoria": r.categoria, "cantidad": r.cantidad} for r in resultados]

@router.get("/tiempos")
async def get_tiempos(db: Session = Depends(get_db)):
    alertas = db.query(Alerta).all()

    mttd, mtta, mttr = [], [], []
    por_categoria = {}

    for a in alertas:
        d = _segundos(a.evento_generado_en, a.fecha)
        t = _segundos(a.fecha, a.reconocida_en)
        r = _segundos(a.fecha, a.resuelto_en)
        mttd.append(d)
        mtta.append(t)
        mttr.append(r)

        cat = por_categoria.setdefault(a.categoria, {"mttd": [], "mtta": [], "mttr": []})
        cat["mttd"].append(d)
        cat["mtta"].append(t)
        cat["mttr"].append(r)

    return {
        "global": {
            "mttd": _resumen(mttd),
            "mtta": _resumen(mtta),
            "mttr": _resumen(mttr)
        },
        "por_categoria": {
            categoria: {
                "mttd": _resumen(valores["mttd"]),
                "mtta": _resumen(valores["mtta"]),
                "mttr": _resumen(valores["mttr"])
            }
            for categoria, valores in por_categoria.items()
        }
    }