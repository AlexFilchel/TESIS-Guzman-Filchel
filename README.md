# Sistema SIEM para análisis automatizado de registros de seguridad

Repositorio del trabajo final *«Sistema SIEM para análisis automatizado de registros de
seguridad»* (Guzmán / Filchel). Contiene el código fuente de la arquitectura, los archivos de
configuración de los contenedores, el esquema SQL, el workflow exportado de n8n y los scripts y
fixtures del experimento reproducible del Capítulo 6.

Este archivo es el procedimiento completo: desde un clon limpio y con Docker instalado se llega a
las métricas publicadas sin ningún paso manual fuera de los que están escritos acá.

---

## 1. Qué es

Una arquitectura SIEM de laboratorio montada sobre Docker Compose. Los componentes y el papel de
cada uno:

| Componente | Papel |
|---|---|
| **syslog-ng** | Recolección centralizada. Recibe syslog por UDP/514 de los contenedores cliente y escribe un árbol de archivos por host en el volumen compartido. |
| **Logstash** | Pipeline de procesamiento. Lee ese árbol de archivos y entrega los eventos a Elasticsearch. |
| **Elasticsearch** | Indexación y búsqueda de los logs recolectados. |
| **PostgreSQL** | Almacenamiento de las alertas, las reglas de detección y los usuarios. |
| **n8n** | Orquestación de la detección. Cada cinco minutos lee los logs, los normaliza, los correlaciona contra las reglas activas, persiste las alertas y notifica. |
| **Backend (FastAPI)** | API REST y WebSocket sobre las alertas, las reglas y las métricas. |
| **Frontend (React)** | Interfaz de gestión: dashboard, listado y detalle de alertas, reglas, simulador y visor de logs. |
| **cliente1 / 2 / 3** | Contenedores emisores, que representan los hosts monitoreados. |

El flujo de detección es: los hosts emiten syslog → syslog-ng los deposita en
`./data/remotos/<host>/{auth,syslog}.log` → Logstash los indexa en Elasticsearch y n8n los
correlaciona contra las reglas → las alertas se persisten en PostgreSQL → el backend las expone y
el frontend las muestra.

---

## 2. Requisitos previos

* **Docker** y **Docker Compose v2** (`docker compose`, no `docker-compose`).
* **RAM**: Elasticsearch arranca con `-Xms1g -Xmx1g`, así que conviene tener al menos 4 GB libres
  para el conjunto. En Docker Desktop, subir el límite de memoria si está por debajo.
* **Python 3.9 o superior** en el host, sólo para los scripts del experimento (sección 7).
* Puertos libres en el host: 5432, 9200, 5044, 514/udp, 5678, 8000 y 3002.

---

## 3. Despliegue

Desde un clon limpio:

```bash
git clone https://github.com/AlexFilchel/TESIS-Guzman-Filchel.git
cd TESIS-Guzman-Filchel
docker compose up -d
```

La primera vez tarda unos minutos: construye las imágenes del backend y del frontend y descarga
las de PostgreSQL, Elasticsearch, Logstash, syslog-ng y n8n.

Verificación de que el entorno quedó arriba:

```bash
docker compose ps                       # los diez contenedores en estado running
curl http://localhost:8000/health       # {"status":"healthy"}
curl http://localhost:9200              # respuesta de Elasticsearch
```

Para detenerlo conservando los datos, `docker compose down`. Para detenerlo **borrando los
volúmenes** —que es lo que hay que hacer antes de reejecutar el experimento—,
`docker compose down -v`.

---

## 4. Puertos publicados y acceso a cada servicio

| Servicio | Puerto host | Acceso |
|---|---|---|
| PostgreSQL | 5432 | usuario `siem`, contraseña `siem123`, base `monitoreo_seguridad` |
| Elasticsearch | 9200 | sin seguridad (`xpack.security.enabled: false`) |
| Logstash | 5044 | pipeline definido en `logstash/syslog-remotos.conf` |
| syslog-ng | 514/udp | ingesta de los contenedores cliente |
| n8n | 5678 | basic auth, usuario `admin`, contraseña `admin123` |
| Backend (FastAPI) | 8000 | `http://localhost:8000/docs` para la API |
| Frontend | 3002 | interfaz de gestión, usuario `admin`, contraseña `admin123` |

El frontend se publica en 3002 y no en 3000 porque ese puerto ya estaba ocupado en el host de
desarrollo; dentro del contenedor sigue escuchando en 3000.

---

## 5. Esquema SQL

El esquema se carga solo. `./sql` está montado en `/docker-entrypoint-initdb.d` del contenedor de
PostgreSQL, y los scripts corren en orden alfabético **la primera vez que se inicializa el
volumen** `postgres_data`:

| Archivo | Qué hace |
|---|---|
| `sql/01-init.sql` | Crea `alertas`, `usuarios` y `reglas_deteccion`, siembra las **seis reglas base** y el usuario `admin`. |
| `sql/02-migracion-instrumentacion.sql` | Migración idempotente para instancias creadas antes de la instrumentación temporal: agrega `evento_generado_en`, `reconocida_en` y `resuelto_en` y lleva `ip_origen` a `INET`. Sobre una base recién inicializada no cambia nada. |

Verificación de que las seis reglas base quedaron sembradas:

```bash
docker exec -it siem_postgres psql -U siem -d monitoreo_seguridad \
  -c "SELECT id, nombre, umbral, ventana_tiempo FROM reglas_deteccion ORDER BY id;"
```

Tienen que aparecer exactamente seis filas: fuerza bruta SSH, intento de login root, uso
sospechoso de sudo, escaneo de puertos, escaneo de directorios web e inyección SQL.

> **Importante.** Si el volumen `postgres_data` ya existe, los scripts de inicialización **no**
> vuelven a ejecutarse: PostgreSQL los corre únicamente sobre un directorio de datos vacío. Para
> reinicializar hay que borrar el volumen con `docker compose down -v`. Esto también vale para el
> experimento: las mediciones y las capturas se toman sobre una base limpia, porque de lo
> contrario las métricas mezclan las alertas medidas con el acumulado histórico del laboratorio.

Si el volumen ya existe y sólo hace falta poner al día una instancia vieja:

```bash
docker exec -i siem_postgres psql -U siem -d monitoreo_seguridad \
  < sql/02-migracion-instrumentacion.sql
```

---

## 6. Importar el workflow de n8n

El workflow exportado está en `n8n/workflow.json`. Trae los nueve nodos de la cadena de detección,
en este orden: `Cronómetro 5 min`, `GetRules`, `Read Logs`, `Extract from File`, `Parse Logs`,
`Apply rules`, `Store alerts`, `Es alerta nueva?` y `Send an Email`.

1. Abrir `http://localhost:5678` y autenticarse con `admin` / `admin123`.
2. Menú del workspace → **Import from File** → elegir `n8n/workflow.json`.
3. Configurar las credenciales, que **no se versionan** y por eso el archivo las trae vacías:
   * **PostgreSQL** (nodos `GetRules` y `Store alerts`): host `postgres`, puerto `5432`, base
     `monitoreo_seguridad`, usuario `siem`, contraseña `siem123`.
   * **SMTP** (nodo `Send an Email`): servidor, usuario y contraseña del relay que se quiera usar.
     Los campos de remitente y destinatario del nodo también quedan vacíos a propósito y hay que
     completarlos.
4. Activar el workflow con el interruptor de la esquina superior derecha.

El nodo `Read Logs` accede a `/var/log/remotos`, que es el volumen compartido con syslog-ng y
Logstash. El acceso al filesystem está acotado por `N8N_RESTRICT_FILE_ACCESS_TO` en el
`docker-compose.yml`.

Detalles del workflow que conviene tener presentes:

* **`Parse Logs`** interpreta las marcas RFC 3164 (`Aug 11 13:24:05`) como **hora local del
  emisor**, que es lo que el protocolo transporta: RFC 3164 no lleva huso horario. Interpretarlas
  como UTC introduce un desfase sistemático igual al del huso local.
* **`Apply rules`** filtra los eventos por la `ventana_tiempo` de cada regla y evalúa el umbral
  **por entidad de origen**, no sobre el lote completo. Sin ese agrupamiento, diez eventos
  provenientes de diez direcciones distintas dispararían una única alerta atribuida a la primera.
* **`Store alerts`** usa una sentencia parametrizada (`$1 … $9`). El campo `log_crudo` transporta
  contenido bajo control potencial de un atacante, así que interpolarlo en el texto SQL sería una
  vulnerabilidad de inyección.
* **`Es alerta nueva?`** deduplica por categoría de regla y entidad de origen antes de notificar,
  para que una condición sostenida no genere un correo por cada ciclo de cinco minutos. La
  persistencia ocurre antes, en `Store alerts`: no se pierde ningún registro en base.

---

## 7. Reejecución del experimento del Capítulo 6

Todo el material está en `experimento/`. El procedimiento completo, con el detalle de cada
script, está en [`experimento/README.md`](experimento/README.md); acá va la secuencia mínima.

### 7.1 · Preparar el entorno

```bash
docker compose down -v          # base limpia: las métricas se toman sin acumulado previo
docker compose up -d
pip install -r experimento/requirements.txt
```

Cargar las **dos reglas auxiliares** del experimento. No forman parte de las seis reglas base:
representan las señales observables de los casos RENAPER y Equifax y sólo tienen sentido dentro
del experimento, por eso viven en `experimento/` y no en `sql/`.

```bash
docker exec -i siem_postgres psql -U siem -d monitoreo_seguridad \
  < experimento/reglas_auxiliares.sql
```

Después de este paso la base tiene ocho reglas: las seis base más las dos auxiliares.

### 7.2 · Medición temporal — las treinta alertas

```bash
python experimento/run_experimento.py
```

Tres escenarios por diez ejecuciones. Cada ejecución emite los eventos del escenario en el volumen
de logs, espera a que el ciclo de evaluación los correlacione, persiste la alerta con una sentencia
parametrizada y la lleva por sus dos transiciones de estado.

Salida: `experimento/resultados/mediciones.csv`, una fila por alerta con las cuatro marcas
temporales. Al terminar, el script imprime la ventana `desde`/`hasta` del experimento, que sirve
para filtrar el endpoint de métricas (sección 8).

Duración aproximada: entre ocho y doce minutos.

### 7.3 · Corpus etiquetado — los dieciséis escenarios

```bash
python experimento/evaluar_corpus.py
```

Ocho escenarios maliciosos y ocho benignos, evaluados contra siete reglas. Es determinista y tarda
menos de un segundo. Salida: `experimento/resultados/corpus.csv` y la matriz de confusión por
pantalla.

### 7.4 · Recálculo de las métricas

```bash
python experimento/calcular_metricas.py
```

Ver la sección 8.

---

## 8. Recálculo de MTTD, MTTA y MTTR y de la matriz de confusión

```bash
python experimento/calcular_metricas.py
```

Imprime, **global y por categoría medida**, la media, la mediana, el mínimo, el máximo y la
desviación estándar de las tres métricas temporales, y a continuación la matriz de confusión del
corpus con los seis indicadores de calidad.

Las definiciones son las del apartado 6.2 del informe y no deben cambiarse:

| Métrica | Definición |
|---|---|
| **MTTD** | `fecha − evento_generado_en` — de la generación del primer evento de la secuencia a la creación de la alerta. |
| **MTTA** | `reconocida_en − fecha` — de la creación al reconocimiento. |
| **MTTR** | `resuelto_en − fecha` — **desde la creación, no desde el reconocimiento**. Por lo tanto el MTTR reportado contiene al MTTA. |

La desviación estándar se calcula con el estimador **poblacional** (`statistics.pstdev`): las
ejecuciones medidas se toman como la población completa del experimento y no como una muestra. El
backend usa el mismo estimador en `backend/app/routers/metrics.py`, de modo que el dashboard y el
informe publican el mismo número sobre los mismos datos.

Para recalcular directamente desde la base en lugar del CSV:

```bash
python experimento/calcular_metricas.py --desde-db \
  --desde 2026-08-18T10:00:00 --hasta 2026-08-18T10:30:00
```

### 8.1 · Ver las métricas en el dashboard sobre el conjunto medido

El endpoint `GET /api/metrics/tiempos` acepta filtros opcionales, para que las métricas puedan
calcularse sobre las treinta alertas del experimento y no sobre todo el acumulado del laboratorio:

```bash
# Todo el acumulado (comportamiento por defecto)
curl "http://localhost:8000/api/metrics/tiempos"

# Sólo la ventana del experimento
curl "http://localhost:8000/api/metrics/tiempos?desde=2026-08-18T10:00:00&hasta=2026-08-18T10:30:00"

# Sólo las tres categorías medidas
curl "http://localhost:8000/api/metrics/tiempos?categorias=Consulta%20masiva%20SID&categorias=Fuerza%20bruta%20SSH"

# Alertas concretas, por id
curl "http://localhost:8000/api/metrics/tiempos?ids=1&ids=2&ids=3"
```

Parámetros: `desde`, `hasta` (ISO 8601, sobre `fecha`), `categorias` e `ids`, los dos últimos
repetibles. La respuesta incluye un bloque `filtro` con lo que se aplicó y cuántas alertas
entraron en el cálculo.

---

## 9. Mapa del repositorio

```
TESIS-Guzman-Filchel/
├── README.md                    Este archivo: despliegue y reejecución del experimento.
├── docker-compose.yml           Definición de los diez contenedores del laboratorio.
├── .gitignore
├── backend/                     API FastAPI.
│   ├── Dockerfile
│   ├── requirements.txt         Dependencias de Python del backend.
│   └── app/
│       ├── main.py              Aplicación, CORS y WebSocket de alertas.
│       ├── models.py            Modelos SQLAlchemy: Alerta, ReglaDeteccion, Usuario.
│       ├── schemas.py           Esquemas Pydantic de entrada y salida.
│       ├── auth.py, config.py, database.py, websocket.py
│       └── routers/
│           ├── alertas.py       Listado, detalle y PATCH del ciclo de vida.
│           ├── metrics.py       Resumen, timeline, top de IP y MTTD/MTTA/MTTR con filtros.
│           ├── reglas.py        Listado y habilitación de reglas.
│           ├── logs.py          Visor de logs sobre Elasticsearch.
│           ├── simulator.py     Generador de alertas de demostración.
│           └── auth.py
├── frontend/                    Interfaz React + Vite + TailwindCSS.
│   └── src/
│       ├── pages/               Dashboard, Casos, Reglas, Logs, Simulador, Login.
│       ├── components/          TiemposOperativos.jsx (MTTD/MTTA/MTTR), AlertaModal.jsx
│       │                        (ciclo de vida de la alerta), gráficos y tarjetas.
│       └── services/api.js      Cliente HTTP.
├── logstash/
│   └── syslog-remotos.conf      Pipeline de archivos a Elasticsearch.
├── syslog-ng/
│   └── syslog-ng.conf           Recolección UDP/514 y separación auth / syslog por host.
├── sql/
│   ├── 01-init.sql              Esquema y seis reglas base.
│   └── 02-migracion-instrumentacion.sql   Migración idempotente para bases existentes.
├── n8n/
│   └── workflow.json            Workflow exportado, nueve nodos, sin credenciales.
├── experimento/                 Material del experimento del Capítulo 6.
│   ├── README.md                Procedimiento detallado.
│   ├── requirements.txt
│   ├── reglas_auxiliares.sql    Las dos reglas auxiliares (RENAPER y Equifax).
│   ├── comun.py                 Configuración compartida; INTERVALO_EVALUACION_S.
│   ├── evaluador.py             Ciclo de evaluación: umbral, ventana y entidad.
│   ├── emisor.py                Emisión de eventos al volumen de logs.
│   ├── escenarios.py            Carga y materialización de los fixtures.
│   ├── run_experimento.py       Medición temporal: las treinta alertas.
│   ├── evaluar_corpus.py        Corpus etiquetado: los dieciséis escenarios.
│   ├── calcular_metricas.py     Recálculo de métricas e indicadores.
│   ├── fixtures/
│   │   ├── escenarios_maliciosos.json     8 escenarios etiquetados como maliciosos.
│   │   ├── escenarios_benignos.json       8 escenarios etiquetados como benignos.
│   │   └── escenarios_medicion.json       3 escenarios de la medición temporal.
│   └── resultados/
│       ├── corpus.csv           Resultado por escenario del corpus.
│       └── mediciones.csv       Una fila por alerta medida (lo genera run_experimento.py).
└── docs/                        Documentación de desarrollo del proyecto.
```

---

## 10. Alcance del entorno

Este repositorio despliega un **entorno de laboratorio**, y varias de sus decisiones lo son por
esa razón y no por la arquitectura que el trabajo propone:

* Las credenciales están escritas en el `docker-compose.yml` (`siem`/`siem123` para PostgreSQL,
  `admin`/`admin123` para n8n y para el frontend) y son valores por defecto conocidos.
* Los servicios se publican sobre todas las interfaces del host, no sólo sobre la de loopback, de
  modo que el entorno pueda inspeccionarse desde otra máquina de la red de pruebas.
* Elasticsearch corre con `xpack.security.enabled: false` y no hay TLS en ninguna comunicación
  interna.
* El backend monta `./backend` dentro del contenedor, lo que facilita el desarrollo pero no
  corresponde a un despliegue productivo.

Un despliegue real exigiría credenciales gestionadas fuera del repositorio, publicación acotada,
TLS entre componentes y autenticación en Elasticsearch. Nada de eso cambia el diseño de la
arquitectura ni las mediciones del Capítulo 6: cambia la configuración del entorno en el que se
la ejecuta.
