# -*- coding: utf-8 -*-
"""Carga y materialización de los escenarios del corpus etiquetado.

Un escenario de fixtures describe una secuencia de eventos de forma relativa:
cada bloque dice qué mensaje se emite, cuántas veces, cada cuántos segundos y a
partir de qué desplazamiento respecto del inicio del escenario. Materializarlo
consiste en convertir esos desplazamientos en marcas temporales reales.

Los tokens que las plantillas admiten están documentados en el propio archivo de
fixtures, en la clave `tokens`.
"""

import io
import json

from comun import DIR_FIXTURES
from emisor import formatear

ARCHIVOS = {
    "malicioso": DIR_FIXTURES / "escenarios_maliciosos.json",
    "benigno": DIR_FIXTURES / "escenarios_benignos.json",
}


def _sustituir(plantilla, bloque, indice):
    """Reemplaza los tokens de una plantilla para el evento número `indice`."""
    valores = bloque.get("valores") or []
    texto = plantilla
    texto = texto.replace("<<N6>>", "%06d" % indice)
    texto = texto.replace("<<N>>", str(indice))
    texto = texto.replace("<<IP>>", bloque.get("ip") or "")
    texto = texto.replace("<<PUERTO>>", str(40000 + indice))
    if valores:
        texto = texto.replace("<<VALOR>>", str(valores[(indice - 1) % len(valores)]))
    return texto


def materializar(escenario, inicio):
    """Devuelve los eventos del escenario como (momento, mensaje), ordenados.

    `inicio` es el instante que corresponde al desplazamiento cero. Los tiempos
    se calculan, no se esperan: esto permite evaluar el corpus completo de forma
    determinista y en menos de un segundo, sin depender del reloj de pared.
    """
    from datetime import timedelta

    eventos = []
    for bloque in escenario["bloques"]:
        base = float(bloque.get("offset_s") or 0.0)
        paso = float(bloque.get("intervalo_s") or 1.0)
        for k in range(int(bloque.get("repeticiones") or 1)):
            indice = k + 1
            momento = inicio + timedelta(seconds=base + k * paso)
            eventos.append((momento, _sustituir(bloque["plantilla"], bloque, indice)))
    eventos.sort(key=lambda e: e[0])
    return eventos


def lineas(escenario, inicio):
    """Los eventos del escenario ya formateados como líneas de log RFC 3164."""
    return [
        (momento, formatear(mensaje, escenario["host"],
                            proceso=escenario.get("proceso") or "sshd",
                            momento=momento))
        for momento, mensaje in materializar(escenario, inicio)
    ]


def duracion(escenario):
    """Segundos que abarca el escenario, del primer evento al último."""
    mayor = 0.0
    for bloque in escenario["bloques"]:
        base = float(bloque.get("offset_s") or 0.0)
        paso = float(bloque.get("intervalo_s") or 1.0)
        n = int(bloque.get("repeticiones") or 1)
        mayor = max(mayor, base + (n - 1) * paso)
    return mayor


def cargar_corpus():
    """Los dieciséis escenarios del corpus, maliciosos primero."""
    corpus = []
    for etiqueta, archivo in ARCHIVOS.items():
        datos = json.loads(io.open(archivo, encoding="utf-8").read())
        for escenario in datos["escenarios"]:
            escenario.setdefault("etiqueta", etiqueta)
            corpus.append(escenario)
    corpus.sort(key=lambda e: e["id"])
    return corpus
