# Guía de Implementación - SIEM Backend & Frontend

## Visión General

Sistema de monitoreo de seguridad con centralización de logs, detección de anomalías, dashboard en tiempo real y simulador de ataques para pruebas.

## Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Backend | FastAPI | 0.109+ |
| Frontend | React | 18+ |
| Estilos | TailwindCSS | 3.4+ |
| Gráficos | Recharts | 2.12+ |
| Tiempo Real | WebSocket (FastAPI) | - |
| Base de Datos | PostgreSQL | 16 |
| Orquestación | N8N | latest |

## Estructura del Proyecto

```
siem-docker/
├── backend/                 # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   │   ├── alertas.py
│   │   │   ├── metrics.py
│   │   │   └── auth.py
│   │   ├── websocket.py
│   │   └── simulator.py     # Simulador de logs
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StatsCard.jsx
│   │   │   ├── AlertaCard.jsx
│   │   │   ├── AlertaModal.jsx
│   │   │   ├── AlertToast.jsx
│   │   │   ├── LogControl.jsx
│   │   │   └── AlertsChart.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Simulador.jsx
│   │   │   └── Casos.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useAlertas.js
│   │   └── services/
│   │       └── api.js
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── casos_ataques.md         # Casos de estudio
├── docker-compose.yml
└── SPEC.md
```

---

## 1. Fase 1: Backend FastAPI

### 1.1 Dependencias (requirements.txt)

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
```

### 1.2 Modelos de Base de Datos

**Tabla: alertas**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL | PK |
| fecha | TIMESTAMP | Fecha del evento |
| severidad | VARCHAR(20) | low, medium, high, critical |
| categoria | VARCHAR(50) | Tipo de alerta |
| ip_origen | VARCHAR(50) | IP origen del ataque |
| host_objetivo | VARCHAR(255) | Host objetivo |
| cantidad_eventos | INTEGER | Cantidad de eventos |
| descripcion | TEXT | Descripción de la alerta |
| log_crudo | TEXT | Log original |
| estado | VARCHAR(20) | nueva, investigada, resuelta, falso_positivo |

**Tabla: reglas_deteccion**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL | PK |
| nombre | VARCHAR(200) | Nombre de la regla |
| patron | TEXT | Pattern regex |
| severidad | VARCHAR(20) | Severidad asignada |
| umbral | INTEGER | Eventos para activar (default: 6) |
| ventana_tiempo | INTEGER | Ventana en segundos |
| habilitada | BOOLEAN | Si está activa |

### 1.3 Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | Login usuario (JWT) |
| GET | /api/alertas | Listar alertas (con filtros) |
| GET | /api/alertas/{id} | Ver detalle de alerta |
| PATCH | /api/alertas/{id} | Actualizar estado |
| GET | /api/metrics/summary | Resumen de métricas |
| GET | /api/metrics/timeline | Línea de tiempo de alertas |
| GET | /api/metrics/top-ips | Top IPs atacantes |
| POST | /api/simulator/generate | Generar log simulado |
| WS | /ws/alertas | Stream de alertas en tiempo real |

### 1.4 Simulador de Logs (Backend)

**Tipos de logs simulables:**

| Tipo | Categoría | Severidad | Umbral |
|------|-----------|-----------|--------|
| SSH Brute Force | fuerza_bruta | high | 6 |
| Root Login Attempt | login_root | critical | 1 |
| sudo Abuse | sudo_abuso | medium | 10 |
| Port Scan | port_scan | medium | 5 |
| Directory Scan | directory_scan | medium | 3 |
| Generic Info | info | low | 1 |
| Generic Warning | warning | medium | 1 |
| Generic Critical | critical_event | critical | 1 |

**Endpoint: POST /api/simulator/generate**

```json
{
  "tipo": "ssh_brute_force",
  "ip_origen": "192.168.1.100",
  "username": "admin",
  "cantidad": 6
}
```

---

## 2. Fase 2: Frontend React

### 2.1 Estructura de Rutas

```
/login        - Login de usuario
/             - Dashboard principal (default, después de login)
/simulador    - Simulador de Logs
/casos        - Casos de Estudio
```

### 2.2 Layout - Sidebar Colapsable

```
┌─────────────────────────────────────────────────────┐
│  ☰   │  SIEM Dashboard                    │ 👤  │
├──────┼──────────────────────────────────────────────┤
│      │                                              │
│ 📊   │     ÁREA PRINCIPAL DINÁMICA                │
│ Dash │     (cambia según selección)                │
│      │                                              │
│ 🧪   │                                              │
│ Simul│                                              │
│      │                                              │
│ 📚   │                                              │
│ Casos│                                              │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

**Componente: Sidebar**
- Colapsable (botón ☰)
- Tres secciones: Dashboard, Simulador, Casos
- Indicador visual de sección activa
- Transiciones suaves

### 2.3 Dashboard - Panel de Control

**Componentes:**

1. **Stats Cards** (4 cards superiores)
   - Total Alertas
   - Alertas Críticas
   - Alertas Altas
   - Alertas Nuevas

2. **Gráficos Interactivos**
   - Gráfico de línea: Tendencia de alertas (7 días)
   - Gráfico de torta: Distribución por severidad
   - Actualización en tiempo real via WebSocket

3. **Prueba Rápida (Quick Test)**
   - Botones de acceso directo para cada tipo de ataque
   - Al hacer clic → genera logs → actualiza gráficos → muestra AlertToast

### 2.4 Simulador de Logs

**Componente: SimuladorPanel**

Opciones de simulación:

1. **Selector de Tipo de Log**
   - SSH Brute Force
   - Root Login Attempt
   - sudo Abuse
   - Port Scan
   - Directory Scan
   - Generic Info/Warning/Critical

2. **LogControl** - Botones para niveles
   - 🔵 Info (genera log info)
   - 🟡 Warning (genera log warning)
   - 🔴 Critical (genera log critical)

3. **Botón "Disparar"**
   - Envía solicitud al backend
   - Genera alerta correspondiente
   - Actualiza dashboard automáticamente

### 2.5 Casos de Estudio

**Componente: CasosPanel**

1. **Fuente de Datos**
   - Lee archivo `casos_ataques.md`
   - Formato estructurado (ver sección 4)

2. **Flujo Paso a Paso**
   - Ver lista de casos disponibles
   - Seleccionar caso → muestra resumen
   - Botón "Inyectar Logs" → envía los logs del caso

3. **Visualización de Resumen**
   - Título del caso
   - Descripción
   - IPs involucradas
   - Timestamp del ataque real

### 2.6 AlertToast - Notificaciones

**Componente: AlertToast**

Aparece cuando:
- Se genera una alerta por simulación
- Nueva alerta en tiempo real (WebSocket)

Contenido:
- Tipo de ataque
- IP origen
- Timestamp
- Severidad (color según nivel)

Animación: slide-in desde arriba/derecha, auto-dismiss en 5s

---

## 3. Fase 3: Archivo casos_ataques.md

### Formato Estructurado

```markdown
# Casos de Estudio - SIEM

## Caso 1: Ataque de Fuerza Bruta SSH

**Fecha:** 2024-03-15 14:32:00
**Severidad:** High
**IP Atacante:** 192.168.1.105
**Usuario Objetivo:** admin
**Descripción:** Múltiples intentos de login SSH fallidos detectados

### Logs Asociados
[Estos logs se inyectan al simular]

Mar 15 14:30:01 server1 sshd[12345]: Failed password for invalid user admin from 192.168.1.105 port 45231 ssh2
Mar 15 14:30:03 server1 sshd[12347]: Failed password for invalid user admin from 192.168.1.105 port 45232 ssh2
Mar 15 14:30:05 server1 sshd[12349]: Failed password for invalid user admin from 192.168.1.105 port 45233 ssh2
Mar 15 14:30:07 server1 sshd[12351]: Failed password for invalid user admin from 192.168.1.105 port 45234 ssh2
Mar 15 14:30:09 server1 sshd[12353]: Failed password for invalid user admin from 192.168.1.105 port 45235 ssh2
Mar 15 14:30:11 server1 sshd[12355]: Failed password for invalid user admin from 192.168.1.105 port 45236 ssh2

---
```

### Casos Predefinidos (iniciales)

1. **SSH Brute Force** - 6 intentos fallidos
2. **Root Login Attempt** - Intento acceso root
3. **Port Scan** - Escaneo de puertos
4. **sudo Abuse** - Uso excesivo de sudo
5. **Web Directory Scan** - Acceso a rutas sensibles

---

## 4. Fase 4: Dockerización

### docker-compose.yml (actualizado)

```yaml
services:
  # ... servicios existentes ...

  backend:
    build: ./backend
    container_name: siem_backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://siem:siem123@postgres:5432/monitoreo_seguridad
      - SECRET_KEY=siem-secret-key-change-in-production
    depends_on:
      - postgres
    networks:
      - siem-net

  frontend:
    build: ./frontend
    container_name: siem_frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_WS_URL=ws://localhost:8000
    depends_on:
      - backend
    networks:
      - siem-net

networks:
  siem-net:
    driver: bridge
```

---

## 5. Credenciales

| Servicio | Usuario | Contraseña | Puerto |
|----------|---------|------------|--------|
| PostgreSQL | siem | siem123 | 5432 |
| Backend FastAPI | - | - | 8000 |
| Frontend React | - | - | 3000 |
| n8n | admin | admin123 | 5678 |
| Grafana | admin | admin | 3001 |

---

## 6. Reglas de Detección Predefinidas

| Nombre | Patrón | Severidad | Umbral | Ventana |
|--------|--------|-----------|--------|---------|
| SSH Brute Force | Failed password | high | 6 | 300s |
| Root Login | Failed password for root | critical | 1 | 60s |
| sudo Abuse | sudo | medium | 10 | 600s |
| Port Scan | DROP\|UFW BLOCK\|iptables | medium | 5 | 300s |
| Directory Scan | GET.*(admin\|phpmyadmin\|wp-admin) | medium | 3 | 300s |

---

## 7. Flujo de Uso - Quick Reference

### Para pruebas rápidas (Dashboard)
1. Hacer clic en botón de tipo de ataque
2. Ver actualización instantánea de gráficos
3. AlertToast muestra detalles del ataque

### Para pruebas manuales (Simulador)
1. Ir a sección Simulador
2. Seleccionar tipo de log
3. Hacer clic en "Disparar"
4. Ver respuesta del sistema

### Para casos reales (Casos)
1. Ir a sección Casos
2. Seleccionar caso de la lista
3. Revisar resumen
4. Click en "Inyectar Logs"
5. Ver cómo el sistema detecta el ataque

---

**Fin del documento**