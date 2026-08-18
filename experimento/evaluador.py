# -*- coding: utf-8 -*-
"""Ciclo de evaluación de reglas: umbral, ventana temporal y entidad de origen.

Este módulo es la pieza que el apartado 4.2.6 del informe llama «lógica homóloga
a la del experimento». Reproduce, en Python y con un período de barrido corto, lo
que los nodos `Parse Logs` y `Apply rules` del workflow de n8n hacen sobre el
mismo material:

* `parsear_linea`  <->  nodo `Parse Logs`  (Anexo C.5)
* `evaluar`        <->  nodo `Apply rules` (Anexo C.6)

Las tres decisiones que definen la semántica y que hay que mantener alineadas con
el workflow son:

1. La marca temporal del evento se extrae del propio registro. Un timestamp
   RFC 3164 (`Aug 11 13:24:05`) no transporta huso horario: es hora local del
   emisor, y se interpreta como tal. Interpretarlo como UTC introduce un desfase
   sistemático igual al del huso local.
2. El umbral se evalúa sobre los eventos comprendidos en la ventana temporal de
   la regla, no sobre todo el lote leído.
3. El umbral se evalúa por entidad de origen. Diez eventos provenientes de diez
   direcciones distintas no son un ataque de una entidad con diez eventos.
"""

import re
from datetime import datetime, timedelta

MESES = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

_RE_ISO = re.compile(
    r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?"
)
_RE_RFC3164 = re.compile(r"^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})")
_RE_IP = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")

#: Entidad que se usa cuando la línea no expone una dirección de origen. Es el
#: mismo valor que usa el nodo `Apply rules`.
SIN_ORIGEN = "sin_origen"


def extraer_marca_temporal(linea, ahora=None):
    """Marca temporal del propio registro, o None si no hay formato reconocible.

    Equivale a `extraerMarcaTemporal` del nodo `Parse Logs`.
    """
    ahora = ahora or datetime.now()

    m = _RE_ISO.search(linea)
    if m:
        texto = m.group(0).replace("Z", "+00:00")
        try:
            d = datetime.fromisoformat(texto)
            return d.replace(tzinfo=None) if d.tzinfo is None else d.astimezone().replace(tzinfo=None)
        except ValueError:
            pass

    m = _RE_RFC3164.match(linea)
    if m and m.group(1) in MESES:
        try:
            # Sin año ni huso horario: se completa con el año en curso y se
            # interpreta como hora local del emisor.
            d = datetime(ahora.year, MESES[m.group(1)], int(m.group(2)),
                         int(m.group(3)), int(m.group(4)), int(m.group(5)))
        except ValueError:
            return None
        # Si la fecha resultante queda en el futuro, corresponde al año anterior.
        if d > ahora + timedelta(days=1):
            d = d.replace(year=ahora.year - 1)
        return d

    return None


def parsear_linea(linea, ahora=None):
    """Convierte una línea de log en un evento estructurado, o devuelve None.

    Los campos son los que produce el nodo `Parse Logs`: `raw`, `source_ip`,
    `category`, `event_time`, `event_time_source` e `ingested_at`.
    """
    if not linea or not linea.strip():
        return None

    ingerido_en = ahora or datetime.now()
    marca = extraer_marca_temporal(linea, ingerido_en)
    ip = _RE_IP.search(linea)

    return {
        "raw": linea.rstrip("\n"),
        "source_ip": ip.group(1) if ip else None,
        "category": ("authentication_failure" if "Failed password" in linea
                     else "general"),
        "event_time": marca or ingerido_en,
        "event_time_source": "log" if marca else "ingesta",
        "ingested_at": ingerido_en,
    }


def evaluar(eventos, reglas, ahora=None):
    """Aplica las reglas sobre los eventos y devuelve las detecciones.

    Cada detección es un diccionario con la regla, la entidad de origen, los
    eventos que la componen y la marca del **primer** evento de la secuencia:
    ese primer evento es el origen del MTTD, porque es el momento en que la
    actividad se volvió observable para el sistema.

    Equivale al nodo `Apply rules`.
    """
    ahora = ahora or datetime.now()
    detecciones = []

    for regla in reglas:
        try:
            patron = re.compile(regla["patron"], re.IGNORECASE)
        except re.error:
            # Una regla con un patrón inválido no puede disparar; el workflow
            # se comporta igual (el RegExp lanza y el nodo la descarta).
            continue

        ventana = timedelta(seconds=regla.get("ventana_tiempo") or 300)

        # 1. Sólo los eventos comprendidos en la ventana temporal de la regla.
        en_ventana = [
            e for e in eventos
            if patron.search(e["raw"] or "")
            and timedelta(0) <= (ahora - e["event_time"]) <= ventana
        ]

        # 2. El umbral se evalúa por entidad, no sobre el lote completo.
        por_entidad = {}
        for evento in en_ventana:
            clave = evento["source_ip"] or SIN_ORIGEN
            por_entidad.setdefault(clave, []).append(evento)

        for entidad, del_entidad in por_entidad.items():
            if len(del_entidad) < (regla.get("umbral") or 1):
                continue
            ordenados = sorted(del_entidad, key=lambda e: e["event_time"])
            detecciones.append({
                "regla": regla["nombre"],
                "severidad": regla.get("severidad") or "media",
                "entidad": entidad,
                "ip_origen": None if entidad == SIN_ORIGEN else entidad,
                "eventos": ordenados,
                "cantidad_eventos": len(ordenados),
                # Origen del MTTD: primer evento de la secuencia que dispara.
                "evento_generado_en": ordenados[0]["event_time"],
                "log_crudo": ordenados[0]["raw"],
                "descripcion": "Regla %s activada para %s" % (regla["nombre"], entidad),
            })

    return detecciones
