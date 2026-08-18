from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.sql import func
from app.database import Base

class Alerta(Base):
    __tablename__ = "alertas"
    
    id = Column(Integer, primary_key=True, index=True)
    evento_generado_en = Column(DateTime)
    fecha = Column(DateTime, default=func.now())
    reconocida_en = Column(DateTime)
    severidad = Column(String(20), nullable=False)
    categoria = Column(String(50), nullable=False)
    # El Anexo A documenta ip_origen como INET; el nodo `Store alerts` del
    # workflow castea a $4::inet. SQLAlchemy devuelve el valor como str.
    ip_origen = Column(INET)
    host_objetivo = Column(String(255))
    cantidad_eventos = Column(Integer, default=1)
    descripcion = Column(Text)
    log_crudo = Column(Text)
    estado = Column(String(20), default="nueva")
    asignado_a = Column(String(100))
    notas = Column(Text)
    resuelto_en = Column(DateTime)

class ReglaDeteccion(Base):
    __tablename__ = "reglas_deteccion"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    patron = Column(Text, nullable=False)
    severidad = Column(String(20), nullable=False)
    umbral = Column(Integer, default=1)
    ventana_tiempo = Column(Integer, default=300)
    habilitada = Column(Boolean, default=True)
    creada_en = Column(DateTime, default=func.now())
    actualizada_en = Column(DateTime, default=func.now())

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    rol = Column(String(20), default="analista")
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=func.now())