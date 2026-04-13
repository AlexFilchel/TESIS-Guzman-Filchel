from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import random
from app.database import get_db
from app.models import Alerta
from app.schemas import SimulatorGenerate, SimulatorResponse, AlertaResponse

router = APIRouter(prefix="/api/simulator", tags=["simulator"])

# Templates de logs por tipo
LOG_TEMPLATES = {
    "ssh_brute_force": {
        "categoria": "fuerza_bruta",
        "severidad": "high",
        "umbral": 6,
        "template": "Failed password for {user} from {ip} port {port} ssh2",
        "host": "server1"
    },
    "root_login": {
        "categoria": "login_root",
        "severidad": "critical",
        "umbral": 1,
        "template": "Failed password for root from {ip} port {port} ssh2",
        "host": "server1"
    },
    "sudo_abuse": {
        "categoria": "sudo_abuso",
        "severidad": "medium",
        "umbral": 10,
        "template": "{user} : TTY=pts/0 ; PWD=/home/{user} ; USER=root ; COMMAND=/bin/{cmd}",
        "host": "server1"
    },
    "port_scan": {
        "categoria": "port_scan",
        "severidad": "medium",
        "umbral": 5,
        "template": "iptables DROP: IN=eth0 OUT= MAC=00:00:00:00:00:00 SRC={ip} DST=192.168.1.1 PROTO=TCP DPT={port} SYN",
        "host": "firewall"
    },
    "directory_scan": {
        "categoria": "directory_scan",
        "severidad": "medium",
        "umbral": 3,
        "template": 'GET /{path} 404 1234 "-" "Mozilla/5.0"',
        "host": "webserver"
    },
    "info": {
        "categoria": "info",
        "severidad": "low",
        "umbral": 1,
        "template": "Service started successfully",
        "host": "server1"
    },
    "warning": {
        "categoria": "warning",
        "severidad": "medium",
        "umbral": 1,
        "template": "High memory usage detected: {percent}%",
        "host": "server1"
    },
    "critical_event": {
        "categoria": "critical_event",
        "severidad": "critical",
        "umbral": 1,
        "template": "CRITICAL: Service {service} unresponsive",
        "host": "server1"
    }
}

# Datos aleatorios para simulación
IPS = ["192.168.1.100", "10.0.0.50", "172.16.0.25", "192.168.5.10", "203.0.113.45"]
USERS = ["admin", "root", "test", "guest", "backup", "mysql", "www-data"]
PORTS = [22, 80, 443, 3306, 8080, 5432, 21]
PATHS = ["admin", "phpmyadmin", "wp-admin", ".env", "config.php", "backup.sql", "uploads"]
COMMANDS = ["ls", "cat", "wget", "curl", "bash", "sh", "nc"]
SERVICES = ["nginx", "mysql", "redis", "postgres", "docker"]
PERCENTS = [85, 90, 95, 98]

def generate_ip():
    return random.choice(IPS) if random.random() > 0.3 else f"192.168.{random.randint(1,255)}.{random.randint(1,255)}"

def generate_log(tipo: str, ip: str = None, username: str = None, cantidad: int = 1):
    template_data = LOG_TEMPLATES.get(tipo, LOG_TEMPLATES["info"])
    
    logs = []
    for i in range(cantidad):
        log_ip = ip or generate_ip()
        log_user = username or random.choice(USERS)
        
        if tipo == "ssh_brute_force":
            msg = template_data["template"].format(user=log_user, ip=log_ip, port=random.choice(PORTS))
        elif tipo == "root_login":
            msg = template_data["template"].format(ip=log_ip, port=random.choice(PORTS))
        elif tipo == "sudo_abuse":
            msg = template_data["template"].format(user=log_user, cmd=random.choice(COMMANDS))
        elif tipo == "port_scan":
            msg = template_data["template"].format(ip=log_ip, port=random.randint(1, 65535))
        elif tipo == "directory_scan":
            msg = template_data["template"].format(path=random.choice(PATHS))
        elif tipo == "warning":
            msg = template_data["template"].format(percent=random.choice(PERCENTS))
        elif tipo == "critical_event":
            msg = template_data["template"].format(service=random.choice(SERVICES))
        else:
            msg = template_data["template"]
        
        timestamp = datetime.utcnow().strftime("%b %d %H:%M:%S")
        log_line = f"{timestamp} {template_data['host']} sshd[{random.randint(1000,9999)}]: {msg}"
        logs.append(log_line)
    
    return "\n".join(logs), template_data["categoria"], template_data["severidad"]

@router.post("/generate", response_model=SimulatorResponse)
async def generate_alerta(
    data: SimulatorGenerate,
    db: Session = Depends(get_db)
):
    # Generar log simulado
    log_crudo, categoria, severidad = generate_log(
        data.tipo,
        data.ip_origen,
        data.username,
        data.cantidad
    )
    
    # Determinar cantidad de eventos
    cantidad = data.cantidad or 1
    
    # Crear alerta
    nueva_alerta = Alerta(
        fecha=datetime.utcnow(),
        severidad=severidad,
        categoria=categoria,
        ip_origen=data.ip_origen or generate_ip(),
        host_objetivo="server1",
        cantidad_eventos=cantidad,
        descripcion=f"Simulación de {categoria.replace('_', ' ')}",
        log_crudo=log_crudo,
        estado="nueva"
    )
    
    db.add(nueva_alerta)
    db.commit()
    db.refresh(nueva_alerta)
    
    return SimulatorResponse(
        alerta=nueva_alerta,
        message=f"Alerta de {severidad} generada correctamente"
    )

@router.get("/tipos")
async def get_tipos():
    """Retorna los tipos de simulación disponibles"""
    return [
        {"tipo": "ssh_brute_force", "nombre": "SSH Brute Force", "severidad": "high", "descripcion": "6+ intentos fallidos de SSH"},
        {"tipo": "root_login", "nombre": "Root Login Attempt", "severidad": "critical", "descripcion": "Intento de acceso como root"},
        {"tipo": "sudo_abuse", "nombre": "sudo Abuse", "severidad": "medium", "descripcion": "Múltiples ejecuciones sudo"},
        {"tipo": "port_scan", "nombre": "Port Scan", "severidad": "medium", "descripcion": "Escaneo de puertos"},
        {"tipo": "directory_scan", "nombre": "Directory Scan", "severidad": "medium", "descripcion": "Acceso a rutas sensibles"},
        {"tipo": "info", "nombre": "Generic Info", "severidad": "low", "descripcion": "Log informativo"},
        {"tipo": "warning", "nombre": "Generic Warning", "severidad": "medium", "descripcion": "Advertencia del sistema"},
        {"tipo": "critical_event", "nombre": "Critical Event", "severidad": "critical", "descripcion": "Evento crítico del sistema"}
    ]