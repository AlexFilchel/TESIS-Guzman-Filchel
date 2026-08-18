# -*- coding: utf-8 -*-
"""Emisión de eventos hacia el volumen de logs que consume el sistema.

Los eventos se escriben en `./data/remotos/<host>/{auth,syslog}.log`, que es
exactamente el árbol que produce syslog-ng (ver la sección `destination` de
syslog-ng/syslog-ng.conf) y el que montan logstash y n8n en el
docker-compose.yml. Escribir ahí hace que los eventos del experimento recorran
el mismo camino que los de los contenedores cliente: Logstash los indexa en
Elasticsearch y el ciclo de evaluación los lee del filesystem, igual que el nodo
`Read Logs` del workflow.

El formato de las líneas es RFC 3164 con hora local, que es el que el sistema
recibe realmente y el que `evaluador.parsear_linea` sabe interpretar.
"""

import random
from datetime import datetime

from comun import DIR_LOGS

#: Facilidad a la que se dirige cada tipo de evento. syslog-ng separa los de
#: `auth`/`authpriv` en auth.log y el resto en syslog.log.
ARCHIVO_AUTH = "auth"
ARCHIVO_SYSLOG = "syslog"


def ruta_log(host, archivo=ARCHIVO_AUTH):
    """Ruta del archivo de log de un host, creando el árbol si hace falta."""
    directorio = DIR_LOGS / host
    directorio.mkdir(parents=True, exist_ok=True)
    return directorio / ("%s.log" % archivo)


def formatear(mensaje, host, proceso="sshd", pid=None, momento=None):
    """Arma una línea de log en formato RFC 3164, con hora local del emisor."""
    momento = momento or datetime.now()
    pid = pid if pid is not None else random.randint(1000, 9999)
    # %-d no es portable en Windows; se arma el día a mano con ancho 2.
    marca = "%s %2d %s" % (momento.strftime("%b"), momento.day,
                           momento.strftime("%H:%M:%S"))
    return "%s %s %s[%d]: %s" % (marca, host, proceso, pid, mensaje)


def emitir(mensaje, host, proceso="sshd", archivo=ARCHIVO_AUTH, momento=None):
    """Escribe una línea de log y devuelve el instante en que se emitió.

    El archivo se abre y se cierra en cada línea a propósito: garantiza que la
    línea llega al disco en el momento en que se la da por emitida, sin quedar
    retenida en un buffer de escritura. Ese instante es el que se compara contra
    la creación de la alerta para obtener el MTTD.

    Escribir directo al volumen saltea el trayecto que el evento recorría en el
    entorno original (emisor -> syslog-ng -> archivo por host), y con él la
    demora que ese trayecto introducía. El ciclo de evaluación la reintroduce de
    forma explícita mediante `LATENCIA_PROPAGACION_S`; ver comun.py.
    """
    momento = momento or datetime.now()
    linea = formatear(mensaje, host, proceso=proceso, momento=momento)
    destino = ruta_log(host, archivo)
    with open(destino, "a", encoding="utf-8", newline="\n") as f:
        f.write(linea + "\n")
        f.flush()
    return momento, linea


def limpiar(host, archivo=ARCHIVO_AUTH):
    """Vacía el log de un host. Se usa entre ejecuciones del experimento para
    que la ventana temporal de una ejecución no arrastre eventos de la anterior."""
    destino = ruta_log(host, archivo)
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        f.write("")
