from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AlertaBase(BaseModel):
    severidad: str
    categoria: str
    ip_origen: Optional[str] = None
    host_objetivo: Optional[str] = None
    cantidad_eventos: int = 1
    descripcion: Optional[str] = None
    log_crudo: Optional[str] = None

class AlertaCreate(AlertaBase):
    pass

class AlertaUpdate(BaseModel):
    estado: Optional[str] = None
    asignado_a: Optional[str] = None
    notas: Optional[str] = None

class AlertaResponse(AlertaBase):
    id: int
    fecha: datetime
    estado: str
    resuelto_en: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UsuarioCreate(BaseModel):
    username: str
    email: str
    password: str

class UsuarioResponse(BaseModel):
    id: int
    username: str
    email: str
    rol: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class SimulatorGenerate(BaseModel):
    tipo: str
    ip_origen: Optional[str] = None
    username: Optional[str] = None
    cantidad: Optional[int] = 1

class SimulatorResponse(BaseModel):
    alerta: AlertaResponse
    message: str