# -*- coding: utf-8 -*-
"""Configuración y utilidades compartidas por los scripts del experimento.

Todo lo que los scripts necesitan saber sobre el entorno vive acá: los
parámetros del ciclo de evaluación, la conexión a PostgreSQL, el acceso a la API
del backend, la ubicación del volumen de logs y el estimador estadístico.
"""

import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# =============================================================================
# Parámetros del ciclo de evaluación
# =============================================================================

#: Período del ciclo de evaluación de reglas, en segundos.
#:
#: Es el parámetro que gobierna el piso del MTTD: una alerta no puede detectarse
#: antes del primer barrido posterior a que la secuencia alcance el umbral, así
#: que sobre un escenario de umbral unitario el MTTD queda repartido de forma
#: aproximadamente uniforme en el intervalo [0, INTERVALO_EVALUACION_S] más la
#: latencia de propagación del log.
#:
#: El nodo `Cronómetro 5 min` del workflow de n8n usa un período de cinco
#: minutos, adecuado para operación continua pero inservible para medir tiempos
#: de detección con resolución de segundos. El experimento aplica el mismo ciclo
#: con un período corto: la semántica de evaluación es idéntica (ver
#: evaluador.py), lo único que cambia es la frecuencia del barrido.
INTERVALO_EVALUACION_S = float(os.environ.get("INTERVALO_EVALUACION_S", "5"))

#: Ejecuciones por categoría medida. Tres categorías x diez ejecuciones = 30 alertas.
EJECUCIONES_POR_CATEGORIA = int(os.environ.get("EJECUCIONES_POR_CATEGORIA", "10"))

#: Tiempo máximo que el script espera una detección antes de darla por perdida.
TIMEOUT_DETECCION_S = float(os.environ.get("TIMEOUT_DETECCION_S", "180"))

# =============================================================================
# Rutas
# =============================================================================

RAIZ = Path(__file__).resolve().parent.parent
DIR_EXPERIMENTO = RAIZ / "experimento"
DIR_FIXTURES = DIR_EXPERIMENTO / "fixtures"
DIR_RESULTADOS = DIR_EXPERIMENTO / "resultados"

#: Volumen de logs compartido. Es el mismo directorio que montan logstash,
#: syslog-ng y n8n en el docker-compose.yml (`./data/remotos`), de modo que los
#: eventos que emite el experimento recorren el mismo camino que los reales.
DIR_LOGS = Path(os.environ.get("DIR_LOGS", str(RAIZ / "data" / "remotos")))

# =============================================================================
# Conexión al entorno
# =============================================================================

API_URL = os.environ.get("SIEM_API_URL", "http://localhost:8000")

PG = {
    "host": os.environ.get("PGHOST", "localhost"),
    "port": int(os.environ.get("PGPORT", "5432")),
    "dbname": os.environ.get("PGDATABASE", "monitoreo_seguridad"),
    "user": os.environ.get("PGUSER", "siem"),
    "password": os.environ.get("PGPASSWORD", "siem123"),
}


class EntornoNoDisponible(RuntimeError):
    """El stack de docker compose no está levantado o no es alcanzable."""


def conectar_db():
    """Devuelve una conexión a PostgreSQL, o lanza EntornoNoDisponible."""
    try:
        import psycopg2
    except ImportError as exc:
        raise EntornoNoDisponible(
            "Falta psycopg2. Instalá las dependencias del experimento con:\n"
            "    pip install -r experimento/requirements.txt"
        ) from exc

    try:
        return psycopg2.connect(**PG)
    except Exception as exc:
        raise EntornoNoDisponible(
            "No se pudo conectar a PostgreSQL en %s:%s. ¿Está levantado el "
            "entorno? Probá: docker compose up -d" % (PG["host"], PG["port"])
        ) from exc


def api(metodo, ruta, cuerpo=None, timeout=15):
    """Llamada JSON a la API del backend. Devuelve el objeto decodificado."""
    datos = None
    cabeceras = {"Accept": "application/json"}
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode("utf-8")
        cabeceras["Content-Type"] = "application/json"

    peticion = urllib.request.Request(
        API_URL.rstrip("/") + ruta, data=datos, headers=cabeceras, method=metodo
    )
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
            crudo = respuesta.read().decode("utf-8")
    except urllib.error.URLError as exc:
        raise EntornoNoDisponible(
            "No se pudo hablar con el backend en %s (%s). ¿Está levantado el "
            "entorno? Probá: docker compose up -d" % (API_URL, exc)
        ) from exc
    return json.loads(crudo) if crudo else None


# =============================================================================
# Reglas de detección
# =============================================================================

#: Las siete reglas que el corpus etiquetado evalúa: las cinco reglas base con
#: correspondencia en las fuentes de log del laboratorio más las dos auxiliares.
#:
#: La sexta regla base, `SQL Injection`, queda deliberadamente fuera del corpus:
#: opera sobre el cuerpo de las peticiones HTTP, y las fuentes de log del
#: laboratorio (syslog auth y syslog de los contenedores cliente) no transportan
#: ese contenido, de modo que ningún escenario --malicioso o benigno-- podría
#: producir eventos del tipo que la regla evalúa. Evaluarla habría agregado un
#: verdadero negativo trivial, sin información sobre la calidad de la detección.
REGLAS_DEL_CORPUS = (
    "Fuerza bruta SSH",
    "Intento login root",
    "Uso sospechoso de sudo",
    "Escaneo puertos",
    "Escaneo directorios web",
    "Consulta masiva SID",
    "Explotación web Apache Struts",
)

_RE_INSERT_REGLA = re.compile(
    r"^\('(?P<nombre>(?:[^']|'')*)',\s*"
    r"'(?P<descripcion>(?:[^']|'')*)',\s*"
    r"'(?P<patron>(?:[^']|'')*)',\s*"
    r"'(?P<severidad>[^']*)',\s*"
    r"(?P<umbral>\d+),\s*"
    r"(?P<ventana>\d+)\)",
    re.MULTILINE,
)


def _sin_escapes(valor):
    """Deshace el escapado SQL de comillas simples y de la barra invertida."""
    return valor.replace("''", "'").replace("\\\\", "\\")


def cargar_reglas_desde_sql():
    """Lee las reglas directamente de los archivos .sql versionados.

    Es la fuente de verdad cuando el entorno no está levantado: garantiza que el
    conjunto de reglas evaluado es exactamente el que el repositorio siembra, sin
    duplicar la definición dentro del código Python.
    """
    reglas = []
    archivos = [RAIZ / "sql" / "01-init.sql",
                DIR_EXPERIMENTO / "reglas_auxiliares.sql"]
    for archivo in archivos:
        if not archivo.exists():
            continue
        texto = io.open(archivo, encoding="utf-8").read()
        for m in _RE_INSERT_REGLA.finditer(texto):
            reglas.append({
                "nombre": _sin_escapes(m.group("nombre")),
                "descripcion": _sin_escapes(m.group("descripcion")),
                "patron": _sin_escapes(m.group("patron")),
                "severidad": m.group("severidad"),
                "umbral": int(m.group("umbral")),
                "ventana_tiempo": int(m.group("ventana")),
                "habilitada": True,
            })
    return reglas


def cargar_reglas_desde_db():
    """Lee las reglas habilitadas de la tabla reglas_deteccion."""
    conexion = conectar_db()
    try:
        with conexion.cursor() as cur:
            cur.execute(
                "SELECT nombre, descripcion, patron, severidad, umbral, "
                "ventana_tiempo FROM reglas_deteccion WHERE habilitada = true "
                "ORDER BY id;"
            )
            return [
                {
                    "nombre": f[0], "descripcion": f[1], "patron": f[2],
                    "severidad": f[3], "umbral": f[4], "ventana_tiempo": f[5],
                    "habilitada": True,
                }
                for f in cur.fetchall()
            ]
    finally:
        conexion.close()


def cargar_reglas(preferir_db=True, solo=None):
    """Devuelve las reglas a evaluar y el origen del que se obtuvieron.

    Con el entorno levantado usa la base, que es lo que el sistema realmente
    aplica. Si no está disponible, cae a los archivos .sql versionados y lo
    informa por stderr en lugar de fallar: el corpus etiquetado se puede evaluar
    sin levantar Docker.
    """
    origen = "base de datos"
    reglas = None
    if preferir_db:
        try:
            reglas = cargar_reglas_desde_db()
        except EntornoNoDisponible as exc:
            print("[aviso] %s" % exc, file=sys.stderr)
            print("[aviso] Se usan las reglas de los archivos .sql versionados.",
                  file=sys.stderr)
    if not reglas:
        reglas = cargar_reglas_desde_sql()
        origen = "archivos sql/01-init.sql y experimento/reglas_auxiliares.sql"

    if solo is not None:
        indice = {r["nombre"]: r for r in reglas}
        faltantes = [n for n in solo if n not in indice]
        if faltantes:
            raise RuntimeError(
                "Faltan reglas requeridas por el experimento: %s.\n"
                "Si el entorno está levantado, cargá las auxiliares con:\n"
                "    docker exec -i siem_postgres psql -U siem "
                "-d monitoreo_seguridad < experimento/reglas_auxiliares.sql"
                % ", ".join(faltantes)
            )
        reglas = [indice[n] for n in solo]

    return reglas, origen


# =============================================================================
# Estadística
# =============================================================================

#: Estimador de desviación estándar. Tiene que ser el mismo que usa
#: backend/app/routers/metrics.py, o el dashboard y el informe publicarían
#: desvíos distintos sobre los mismos datos.
ESTIMADOR_DESVIO = "poblacional (statistics.pstdev)"


def resumen(valores):
    """Media, mediana, mínimo, máximo y desvío de una serie, en segundos.

    `pstdev` es el desvío poblacional: las ejecuciones medidas se toman como la
    población completa del experimento y no como una muestra de una población
    mayor. Es la misma decisión que toma `_resumen` en el backend.
    """
    from statistics import mean, median, pstdev

    limpios = [v for v in valores if v is not None]
    if not limpios:
        return None
    return {
        "n": len(limpios),
        "media": round(mean(limpios), 2),
        "mediana": round(median(limpios), 2),
        "min": round(min(limpios), 2),
        "max": round(max(limpios), 2),
        "desvio": round(pstdev(limpios), 2) if len(limpios) > 1 else 0.0,
    }
