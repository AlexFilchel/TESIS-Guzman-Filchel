# 📋 RESUMEN DEL PROYECTO SIEM (Sistema de Gestión de Eventos de Seguridad)

## 🎯 ¿Qué es?

Es un **SIEM (Security Information and Event Management)** educativo que simula un sistema real de monitoreo de seguridad. Recolecta logs de red, detecta ataques comunes (fuerza bruta SSH, escaneo de puertos, etc.) y muestra alertas en tiempo real.

---

## 🏗️ ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│                   Puerto: 3000                               │
│    Dashboard + Gráficos + Simulador de Ataques              │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                   BACKEND (FastAPI - Python)                │
│                   Puerto: 8000                               │
│    API REST + WebSocket para alertas en tiempo real          │
└───────┬─────────────────────┬───────────────────┬────────────┘
        │                     │                   │
┌───────▼───────┐   ┌─────────▼─────────┐  ┌──────▼──────────┐
│  PostgreSQL   │   │   Elasticsearch   │  │    Grafana     │
│  Puerto: 5432 │   │   Puerto: 9200   │  │   Puerto: 3001  │
│  - Alertas    │   │  - Logs indexados │  │  - Dashboards   │
│  - Usuarios   │   │  - Búsqueda       │  │  - Métricas     │
│  - Reglas     │   └───────────────────┘  └─────────────────┘
└───────────────┘
        ▲
        │ Recolecta logs
┌───────┴───────────────┐
│     SYSLOG-NG         │
│  Puerto: 514/UDP       │
│  Recolector central    │
└───────┬───────────────┘
        ▲
        │ Envío de logs
┌───────┴───────────┐ ┌─────────┐ ┌─────────┐
│   Cliente 1      │ │Cliente 2│ │Cliente 3│
│   (Alpine)        │ │(Alpine) │ │(Alpine) │
└───────────────────┘ └─────────┘ └─────────┘
```

---

## 🛠️ TECNOLOGÍAS UTILIZADAS

### **Backend**

| Tecnología | Uso |
|------------|-----|
| **FastAPI** | API REST con Python |
| **SQLAlchemy** | ORM para base de datos |
| **PostgreSQL** | Base de datos relacional |
| **WebSocket** | Alertas en tiempo real |
| **JWT/PyJWT** | Autenticación |

### **Frontend**

| Tecnología | Uso |
|------------|-----|
| **React 18** | Framework de UI |
| **Vite** | Bundler y dev server |
| **Tailwind CSS** | Estilos (modo oscuro) |
| **Recharts** | Gráficos (pastel, barras) |
| **Axios** | Cliente HTTP |
| **React Router** | Navegación |

### **Infraestructura**

| Tecnología | Uso |
|------------|-----|
| **Docker Compose** | Orquestación de contenedores |
| **Elasticsearch** | Motor de búsqueda/indexación de logs |
| **Logstash** | Pipeline de procesamiento de logs |
| **Syslog-ng** | Recolector centralizado de logs |
| **Grafana** | Visualización de métricas |
| **N8N** | Automatización de workflows (flujos de análisis) |

---

## 📊 PÁGINAS PRINCIPALES

### 1. **Dashboard** (`/`)

- Tarjetas con estadísticas (total alertas, críticas, recientes)
- Gráfico de torta por severidad
- Gráfico de barras de alertas por categoría
- Lista de alertas recientes
- **WebSocket**: recibe alertas en tiempo real (sin recargar)

### 2. **Simulador** (`/simulador`)

- Generador de logs de ataque simulado
- Tipos de ataque:
  - 🔴 **SSH Brute Force** - Intentos fallidos de password
  - 🔴 **Root Login Attempt** - Intento de autenticación como root
  - 🟡 **Sudo Abuse** - Uso excesivo de sudo
  - 🟡 **Port Scan** - Escaneo de puertos
  - 🟡 **Directory Scan** - Escaneo de rutas web (admin, wp-admin)

### 3. **Casos** (`/casos`)

- Gestión de incidentes/alertas
- Estados: Nueva → En Investigación → Resuelta
- Notas y asignación a analistas

### 4. **Login** (`/login`)

- Autenticación con usuario/contraseña
- Credenciales por defecto: `admin` / `admin123`

---

## 🔄 FLUJO DE DATOS

```
1. CLIENTES (contenedores Alpine)
   └─► Generan eventos/logs de sistema
   
2. SYSLOG-NG (puerto 514/UDP)
   └─► Recolector centralizado
       └─► Guarda logs en archivos

3. LOGSTASH
   └─► Lee logs → Procesa/Parsea → Envía a Elasticsearch

4. ELASTICSEARCH
   └─► Indexa logs → Permite búsqueda

5. BACKEND (FastAPI)
   └─► Consulta PostgreSQL
   └─► Aplica reglas de detección
   └─► Genera alertas
   └─► Broadcast por WebSocket

6. FRONTEND (React)
   └─► Recibe alertas en tiempo real
   └─► Muestra dashboard con gráficos
```

---

## 🗄️ BASE DE DATOS (PostgreSQL)

### Tabla `alertas`

| Campo | Descripción |
|-------|-------------|
| id | Identificador único |
| fecha | Timestamp de detección |
| severidad | critical / high / medium / low |
| categoria | Tipo de ataque |
| ip_origen | IP del atacante |
| descripcion | Detalle de la alerta |
| estado | nueva / investigacion / resuelta |

### Tabla `reglas_deteccion`

Reglas predefinidas para detectar ataques:

- SSH Brute Force (>6 intentos fallidos)
- Root Login Attempt (intento como root)
- Sudo Abuse (>10 comandos sudo)
- Port Scan (>5 paquetes bloqueados)
- Directory Scan (>3 accesos a rutas sensibles)

### Tabla `usuarios`

- Autenticación de analistas SOC

---

## 🎮 SIMULADOR DE ATAQUES

El simulador permite generar logs controlados para **probar el sistema**:

| Tipo | Mensaje Simulado | Severidad |
|------|------------------|-----------|
| SSH Brute Force | `Failed password for admin from 192.168.1.100` | HIGH |
| Root Login | `Failed password for root from 192.168.1.100` | CRITICAL |
| Sudo Abuse | `sudo: admin : COMMAND=/bin/bash` | MEDIUM |
| Port Scan | `UFW BLOCK [SRC=192.168.1.100]` | MEDIUM |
| Directory Scan | `GET /admin/index.php 404` | MEDIUM |

---

## 🚀 ¿CÓMO ARRANCARLO?

```bash
# Levantar todos los servicios
docker-compose up -d

# Ver estado
docker-compose ps

# Ver logs del backend
docker-compose logs -f backend

# Acceder a:
# - Frontend:       http://localhost:3000
# - Backend API:    http://localhost:8000
# - Grafana:        http://localhost:3001
# - N8N:            http://localhost:5678
# - Elasticsearch:  http://localhost:9200
```

---

## 📝 PREGUNTAS PROBABLES DEL PROFESOR

### 1. **¿Qué es un SIEM?**

> Es un sistema que recoleta, analiza y correlaciona eventos de seguridad de múltiples fuentes para detectar amenazas y generar alertas.

### 2. **¿Por qué usar Docker Compose?**

> Para orquestar todos los servicios (backend, frontend, base de datos, Elasticsearch, etc.) de forma reproducible y aislada.

### 3. **¿Qué es Syslog-ng?**

> Es un demonio de logging que permite recolectar logs de múltiples fuentes y redirigirlos a diferentes destinos (archivos, red, bases de datos).

### 4. **¿Cómo funciona la detección de ataques?**

> El backend tiene **reglas de detección** con patrones (regex), umbrales (cuántos eventos) y ventanas de tiempo. Cuando un log coincide con una regla y supera el umbral, se genera una alerta.

### 5. **¿Qué es WebSocket y por qué lo usan?**

> Es una conexión bidireccional persistente. Permite que el frontend **reciba alertas en tiempo real** sin hacer polling (sin preguntar cada tantos segundos).

### 6. **¿Qué es Elasticsearch?**

> Motor de búsqueda y análisis distribuidos. Permite indexar millones de logs y hacer búsquedas rápidas, además de generar métricas.

### 7. **¿Cuál es el flujo desde que ocurre un evento hasta que se muestra en el dashboard?**

> Cliente genera log → Syslog-ng recolecta → Logstash procesa → Elasticsearch indexa → Backend detecta patrón → Guarda alerta en PostgreSQL → Envía por WebSocket → Frontend muestra en tiempo real.

---

## 💡 PUNTOS FUERTES DEL PROYECTO

- ✅ Arquitectura completa de SIEM real
- ✅ Contenedores Docker (reproducible)
- ✅ Tiempo real con WebSocket
- ✅ Dashboard con visualizaciones
- ✅ Simulador para testing
- ✅ Reglas de detección configurables
- ✅ Escalable (agregar clientes es trivial)

---

## 📁 ESTRUCTURA DEL PROYECTO

```
siem-docker/
├── docker-compose.yml          # Orquestación de todos los servicios
├── sql/
│   └── 01-init.sql            # Schema de base de datos
├── backend/
│   ├── Dockerfile
│   └── app/
│       ├── main.py            # FastAPI app + WebSocket
│       ├── models.py          # Modelos SQLAlchemy
│       ├── database.py        # Conexión a PostgreSQL
│       ├── schemas.py         # Pydantic schemas
│       ├── routers/          # Endpoints de API
│       └── websocket.py      # Gestión de conexiones WS
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx            # Router principal
│       ├── pages/
│       │   ├── Dashboard.jsx  # Dashboard principal
│       │   ├── Simulador.jsx  # Generador de ataques
│       │   ├── Casos.jsx      # Gestión de incidentes
│       │   └── Login.jsx      # Autenticación
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── AlertsChart.jsx
│       │   ├── SeverityPieChart.jsx
│       │   └── ...
│       ├── hooks/
│       │   └── useWebSocket.js # Hook para WebSocket
│       └── services/
│           └── api.js          # Cliente axios
├── logstash/
│   └── syslog-remotos.conf    # Pipeline de procesamiento
├── syslog-ng/
│   └── syslog-ng.conf         # Configuración del collector
└── data/
    └── remotos/               # Logs centralizados
```

---

*Documento generado para presentación académica*
