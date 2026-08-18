# -*- coding: utf-8 -*-
"""Ejecuta el experimento temporal del Capítulo 6 y vuelca las mediciones.

Reproduce el camino completo de una detección, que es lo que hace medible el
MTTD. El endpoint `POST /api/simulator/generate` del backend **no** sirve para
esto: crea la alerta en el mismo instante en que sella `evento_generado_en`, de
modo que el MTTD que produce es cero por construcción y no hay acumulación de
umbral ni ventana temporal en el medio.

El ciclo que este script recorre, para cada ejecución, es:

1. **Emisión.** Los eventos del escenario se escriben, uno por uno y al ritmo
   que el escenario define, en el volumen de logs que consumen Logstash, n8n y
   el ciclo de evaluación (`./data/remotos/<host>/<archivo>.log`). Se registra
   el instante de emisión de cada uno.
2. **Evaluación periódica.** Cada `INTERVALO_EVALUACION_S` segundos el ciclo
   relee los archivos de log, parsea las líneas con la misma función que el nodo
   `Parse Logs` y aplica la misma semántica que el nodo `Apply rules`: filtra por
   la ventana temporal de la regla, agrupa por entidad de origen y dispara cuando
   el recuento de una entidad alcanza el umbral.
3. **Creación de la alerta.** Al dispararse se inserta la alerta con una
   sentencia parametrizada, igual que el nodo `Store alerts`, con
   `evento_generado_en` = marca del **primer evento de la secuencia que la
   disparó** y `fecha` = instante de la detección. Ahí nace el MTTD, compuesto
   por el tiempo de acumulación del umbral más el piso que impone el ciclo.
4. **Ciclo de vida.** La alerta se lleva a `investigada` y luego a `resuelta` vía
   `PATCH /api/alertas/{id}`, que es lo que sella `reconocida_en` y `resuelto_en`.
5. **Volcado.** Una fila por alerta en `experimento/resultados/mediciones.csv`.

Requiere el entorno levantado:

    docker compose up -d
    docker exec -i siem_postgres psql -U siem -d monitoreo_seguridad \
      < experimento/reglas_auxiliares.sql
    pip install -r experimento/requirements.txt
    python experimento/run_experimento.py
"""

import argparse
import csv
import io
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import emisor  # noqa: E402
from comun import (  # noqa: E402
    DIR_FIXTURES, DIR_RESULTADOS, EJECUCIONES_POR_CATEGORIA,
    INTERVALO_EVALUACION_S, TIMEOUT_DETECCION_S, EntornoNoDisponible,
    api, cargar_reglas, conectar_db,
)
from escenarios import _sustituir  # noqa: E402
from evaluador import evaluar, parsear_linea  # noqa: E402

# =============================================================================
# Cadencia de triage del laboratorio
# =============================================================================
# MTTA y MTTR miden aquí transiciones automáticas de estado dentro del
# laboratorio, no la reacción de un operador humano: el entorno no tiene analista
# que atienda la consola. Estas dos constantes son la cadencia declarada con la
# que el experimento recorre el ciclo de vida de cada alerta, y son la razón por
# la que MTTA y MTTR salen del orden del segundo y no del de la hora.
#
# Lo que se mide es real --las marcas se leen de la base después de cada PATCH,
# no se calculan a partir de estas constantes-- pero la escala la fijan ellas.
RETARDO_RECONOCIMIENTO_S = 2.0
RETARDO_RESOLUCION_S = 2.4

CAMPOS = [
    "ejecucion", "escenario", "categoria_medida", "regla", "umbral",
    "alerta_id", "entidad", "cantidad_eventos",
    "evento_generado_en", "fecha", "reconocida_en", "resuelto_en",
    "mttd_s", "mtta_s", "mttr_s",
]

SQL_INSERTAR = """
INSERT INTO alertas (
  evento_generado_en, fecha, severidad, categoria, ip_origen,
  host_objetivo, cantidad_eventos, descripcion, log_crudo, estado
) VALUES (%s, %s, %s, %s, %s::inet, %s, %s, %s, %s, %s)
RETURNING id;
"""


class CicloEvaluacion:
    """Barrido periódico de reglas sobre los archivos de log del filesystem.

    Es el equivalente del par `Cronómetro` + `Read Logs` + `Parse Logs` +
    `Apply rules` del workflow, con un período corto para poder medir tiempos de
    detección con resolución de segundos.
    """

    def __init__(self, reglas, intervalo_s=INTERVALO_EVALUACION_S):
        self.reglas = reglas
        self.intervalo_s = intervalo_s
        self.archivos = {}
        self.proximo_tick = time.monotonic()

    def seguir(self, ruta):
        """Empieza a seguir un archivo de log desde su final actual."""
        ruta = Path(ruta)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        if not ruta.exists():
            ruta.touch()
        self.archivos[str(ruta)] = ruta.stat().st_size

    def _leer_nuevo(self):
        """Devuelve las líneas aparecidas desde el último barrido."""
        nuevas = []
        for clave, desplazamiento in list(self.archivos.items()):
            ruta = Path(clave)
            if not ruta.exists():
                continue
            with io.open(ruta, "r", encoding="utf-8", errors="replace") as f:
                f.seek(desplazamiento)
                contenido = f.read()
                self.archivos[clave] = f.tell()
            nuevas.extend(contenido.splitlines())
        return nuevas

    def toca(self):
        """True si venció el período del ciclo. Reprograma el siguiente tick."""
        ahora = time.monotonic()
        if ahora < self.proximo_tick:
            return False
        # La grilla es fija: los ticks caen cada INTERVALO_EVALUACION_S desde el
        # arranque, sin desplazarse por el tiempo que tarde el barrido. Es lo que
        # hace que la fase del escenario respecto de la grilla varíe entre
        # ejecuciones, y de ahí sale la dispersión del MTTD.
        while self.proximo_tick <= ahora:
            self.proximo_tick += self.intervalo_s
        return True

    def barrer(self, buffer, momentos):
        """Un barrido: incorpora lo nuevo y evalúa. Devuelve las detecciones."""
        for linea in self._leer_nuevo():
            evento = parsear_linea(linea)
            if evento is None:
                continue
            # El log RFC 3164 tiene resolución de un segundo. Para medir tiempos
            # se usa el instante real de emisión que el script registró, que es
            # el dato que la instrumentación busca; el campo `event_time_source`
            # del evento deja constancia de que la marca vino del log.
            clave = evento["raw"]
            if clave in momentos:
                evento["event_time"] = momentos[clave]
            buffer.append(evento)
        return evaluar(buffer, self.reglas)


def cargar_escenarios_medicion():
    datos = json.loads(
        io.open(DIR_FIXTURES / "escenarios_medicion.json", encoding="utf-8").read())
    return datos["escenarios"]


def plan_de_emision(escenario):
    """Lista de (retardo_s, mensaje) del escenario, ordenada por retardo."""
    plan = []
    for bloque in escenario["bloques"]:
        base = float(bloque.get("offset_s") or 0.0)
        paso = float(bloque.get("intervalo_s") or 1.0)
        for k in range(int(bloque.get("repeticiones") or 1)):
            plan.append((base + k * paso,
                         _sustituir(bloque["plantilla"], bloque, k + 1)))
    plan.sort(key=lambda p: p[0])
    return plan


def insertar_alerta(conexion, deteccion, regla, host_objetivo):
    """Persiste la alerta con una sentencia parametrizada, como `Store alerts`."""
    with conexion.cursor() as cur:
        cur.execute(SQL_INSERTAR, (
            deteccion["evento_generado_en"],
            datetime.now(),
            regla.get("severidad") or "media",
            regla["nombre"],
            deteccion["ip_origen"],
            host_objetivo,
            deteccion["cantidad_eventos"],
            deteccion["descripcion"],
            deteccion["log_crudo"],
            "nueva",
        ))
        alerta_id = cur.fetchone()[0]
    conexion.commit()
    return alerta_id


def recorrer_ciclo_de_vida(alerta_id):
    """Lleva la alerta a investigada y luego a resuelta, vía la API."""
    time.sleep(RETARDO_RECONOCIMIENTO_S)
    api("PATCH", "/api/alertas/%d" % alerta_id, {"estado": "investigada"})
    time.sleep(RETARDO_RESOLUCION_S)
    return api("PATCH", "/api/alertas/%d" % alerta_id, {"estado": "resuelta"})


def segundos(desde, hasta):
    if desde is None or hasta is None:
        return None
    return round((hasta - desde).total_seconds(), 2)


def leer_marcas(conexion, alerta_id):
    """Las cuatro marcas, leídas de la base. No se calculan: se consultan."""
    with conexion.cursor() as cur:
        cur.execute(
            "SELECT evento_generado_en, fecha, reconocida_en, resuelto_en "
            "FROM alertas WHERE id = %s;", (alerta_id,))
        return cur.fetchone()


def ejecutar_una(escenario, regla, ciclo, conexion, numero):
    """Una ejecución completa del escenario. Devuelve la fila de medición."""
    ruta = emisor.ruta_log(escenario["host"], escenario.get("archivo", "auth"))
    emisor.limpiar(escenario["host"], escenario.get("archivo", "auth"))
    ciclo.seguir(ruta)

    plan = plan_de_emision(escenario)
    buffer, momentos = [], {}
    t0 = time.monotonic()
    emitidos = 0
    deteccion = None

    while deteccion is None and (time.monotonic() - t0) < TIMEOUT_DETECCION_S:
        transcurrido = time.monotonic() - t0

        while emitidos < len(plan) and plan[emitidos][0] <= transcurrido:
            momento, linea = emisor.emitir(
                plan[emitidos][1], escenario["host"],
                proceso=escenario.get("proceso") or "sshd",
                archivo=escenario.get("archivo", "auth"))
            momentos[linea] = momento
            emitidos += 1

        if ciclo.toca():
            detecciones = [d for d in ciclo.barrer(buffer, momentos)
                           if d["regla"] == regla["nombre"]]
            if detecciones:
                deteccion = detecciones[0]

        time.sleep(0.02)

    if deteccion is None:
        print("  [%02d] sin deteccion tras %.0f s" % (numero, TIMEOUT_DETECCION_S))
        return None

    alerta_id = insertar_alerta(conexion, deteccion, regla, escenario["host"])
    recorrer_ciclo_de_vida(alerta_id)
    generado, fecha, reconocida, resuelto = leer_marcas(conexion, alerta_id)

    fila = {
        "ejecucion": numero,
        "escenario": escenario["id"],
        "categoria_medida": escenario["categoria_medida"],
        "regla": regla["nombre"],
        "umbral": regla["umbral"],
        "alerta_id": alerta_id,
        "entidad": deteccion["entidad"],
        "cantidad_eventos": deteccion["cantidad_eventos"],
        "evento_generado_en": generado.isoformat() if generado else "",
        "fecha": fecha.isoformat() if fecha else "",
        "reconocida_en": reconocida.isoformat() if reconocida else "",
        "resuelto_en": resuelto.isoformat() if resuelto else "",
        "mttd_s": segundos(generado, fecha),
        "mtta_s": segundos(fecha, reconocida),
        "mttr_s": segundos(fecha, resuelto),
    }
    print("  [%02d] alerta #%s  MTTD %.2f s  MTTA %.2f s  MTTR %.2f s"
          % (numero, alerta_id, fila["mttd_s"] or 0, fila["mtta_s"] or 0,
             fila["mttr_s"] or 0))
    return fila


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ejecuciones", type=int, default=EJECUCIONES_POR_CATEGORIA,
                        help="Ejecuciones por categoria (por defecto %d)."
                             % EJECUCIONES_POR_CATEGORIA)
    parser.add_argument("--salida", default=str(DIR_RESULTADOS / "mediciones.csv"),
                        help="Archivo CSV de salida.")
    args = parser.parse_args()

    escenarios = cargar_escenarios_medicion()
    nombres = [e["regla"] for e in escenarios]

    try:
        reglas, origen = cargar_reglas(preferir_db=True, solo=nombres)
        if not origen.startswith("base"):
            raise EntornoNoDisponible(
                "El experimento temporal necesita el entorno levantado: las "
                "alertas se persisten en PostgreSQL y el ciclo de vida se "
                "recorre por la API del backend.")
        conexion = conectar_db()
    except EntornoNoDisponible as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 2

    por_nombre = {r["nombre"]: r for r in reglas}

    print("=" * 78)
    print("EXPERIMENTO TEMPORAL - %d escenarios x %d ejecuciones = %d alertas"
          % (len(escenarios), args.ejecuciones, len(escenarios) * args.ejecuciones))
    print("Ciclo de evaluacion: %.2f s" % INTERVALO_EVALUACION_S)
    print("Retardo de reconocimiento: %.2f s | de resolucion: %.2f s"
          % (RETARDO_RECONOCIMIENTO_S, RETARDO_RESOLUCION_S))
    print("=" * 78)

    ciclo = CicloEvaluacion(reglas)
    filas = []
    inicio = datetime.now()

    try:
        for escenario in escenarios:
            regla = por_nombre[escenario["regla"]]
            print()
            print("%s - %s (umbral %d, ventana %d s)"
                  % (escenario["id"], escenario["nombre"],
                     regla["umbral"], regla["ventana_tiempo"]))
            for numero in range(1, args.ejecuciones + 1):
                fila = ejecutar_una(escenario, regla, ciclo, conexion, numero)
                if fila:
                    filas.append(fila)
    finally:
        conexion.close()

    DIR_RESULTADOS.mkdir(parents=True, exist_ok=True)
    with io.open(args.salida, "w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS)
        escritor.writeheader()
        escritor.writerows(filas)

    fin = datetime.now()
    print()
    print("%d alertas medidas, volcadas en %s" % (len(filas), args.salida))
    print("Ventana del experimento (para filtrar el endpoint de metricas):")
    print("  desde=%s" % (inicio - timedelta(seconds=5)).isoformat(timespec="seconds"))
    print("  hasta=%s" % (fin + timedelta(seconds=5)).isoformat(timespec="seconds"))
    print()
    print("Siguiente paso:")
    print("  python experimento/calcular_metricas.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
