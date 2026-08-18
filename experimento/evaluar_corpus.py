# -*- coding: utf-8 -*-
"""Evalúa los dieciséis escenarios etiquetados y arma la matriz de confusión.

Corresponde al apartado 6.5 del informe. Cada escenario se materializa como una
secuencia de líneas de log, se parsea con la misma función que el nodo
`Parse Logs` y se somete al mismo ciclo de evaluación que aplica el sistema en
producción (`evaluador.evaluar`, homólogo del nodo `Apply rules`).

Un escenario se considera **detectado** si al menos una de las siete reglas del
corpus dispara sobre él. Cruzando esa decisión con la etiqueta del escenario
salen los cuatro cuadrantes de la matriz de confusión.

La evaluación es determinista y no necesita el entorno levantado: los tiempos se
calculan en lugar de esperarse, y si PostgreSQL no responde las reglas se leen de
los archivos .sql versionados. Lo que sí cambia con el entorno levantado es el
origen de las reglas, que pasa a ser la base real.

    python experimento/evaluar_corpus.py

Salida: experimento/resultados/corpus.csv
"""

import argparse
import csv
import io
import sys
from datetime import datetime, timedelta

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))

from comun import DIR_RESULTADOS, REGLAS_DEL_CORPUS, cargar_reglas  # noqa: E402
from escenarios import cargar_corpus, duracion, lineas  # noqa: E402
from evaluador import evaluar, parsear_linea  # noqa: E402

CAMPOS = [
    "id", "nombre", "etiqueta", "regla_asociada", "resultado_esperado",
    "eventos", "detectado", "reglas_disparadas", "entidades", "resultado",
    "coincide_con_lo_esperado",
]


def clasificar(etiqueta, detectado):
    if etiqueta == "malicioso":
        return "verdadero_positivo" if detectado else "falso_negativo"
    return "falso_positivo" if detectado else "verdadero_negativo"


def evaluar_escenario(escenario, reglas):
    """Ejecuta el ciclo de evaluación sobre un escenario y devuelve su fila."""
    # El escenario se ubica de modo que termine "ahora": así todos sus eventos
    # caen dentro de las ventanas temporales de las reglas, que es la situación
    # en la que el sistema los vería en operación.
    ahora = datetime.now()
    inicio = ahora - timedelta(seconds=duracion(escenario))

    eventos = []
    for momento, linea in lineas(escenario, inicio):
        evento = parsear_linea(linea, ahora=momento)
        if evento is None:
            continue
        # La marca la fija el escenario, no el reloj de pared: parsear_linea
        # recupera del texto RFC 3164 una precisión de un segundo, y para el
        # corpus interesa la secuencia exacta.
        evento["event_time"] = momento
        eventos.append(evento)

    detecciones = evaluar(eventos, reglas, ahora=ahora)
    disparadas = sorted({d["regla"] for d in detecciones})
    entidades = sorted({d["entidad"] for d in detecciones})
    detectado = bool(detecciones)
    resultado = clasificar(escenario["etiqueta"], detectado)

    return {
        "id": escenario["id"],
        "nombre": escenario["nombre"],
        "etiqueta": escenario["etiqueta"],
        "regla_asociada": escenario.get("regla_asociada") or "",
        "resultado_esperado": escenario["resultado_esperado"],
        "eventos": len(eventos),
        "detectado": "si" if detectado else "no",
        "reglas_disparadas": " | ".join(disparadas),
        "entidades": " | ".join(entidades),
        "resultado": resultado,
        "coincide_con_lo_esperado":
            "si" if resultado == escenario["resultado_esperado"] else "NO",
    }


def matriz(filas):
    conteo = {"verdadero_positivo": 0, "falso_positivo": 0,
              "falso_negativo": 0, "verdadero_negativo": 0}
    for fila in filas:
        conteo[fila["resultado"]] += 1
    return conteo


def indicadores(conteo):
    vp = conteo["verdadero_positivo"]
    fp = conteo["falso_positivo"]
    fn = conteo["falso_negativo"]
    vn = conteo["verdadero_negativo"]

    def pct(numerador, denominador):
        return None if denominador == 0 else round(100.0 * numerador / denominador, 2)

    precision = pct(vp, vp + fp)
    recall = pct(vp, vp + fn)
    f1 = None
    if precision is not None and recall is not None and (precision + recall):
        f1 = round(2 * precision * recall / (precision + recall), 2)

    return {
        "precision": precision,
        "recall": recall,
        "exactitud": pct(vp + vn, vp + vn + fp + fn),
        "f1": f1,
        "tasa_falsos_positivos": pct(fp, fp + vn),
        "tasa_falsos_negativos": pct(fn, fn + vp),
    }


def imprimir(filas, conteo, ind, origen_reglas, reglas):
    print("=" * 78)
    print("CORPUS ETIQUETADO - %d escenarios contra %d reglas" % (len(filas), len(reglas)))
    print("Reglas tomadas de: %s" % origen_reglas)
    print("=" * 78)
    print()
    encabezado = "%-8s %-10s %-22s %-22s %s" % (
        "ID", "ETIQUETA", "ESPERADO", "OBTENIDO", "REGLAS DISPARADAS")
    print(encabezado)
    print("-" * 78)
    for fila in filas:
        marca = "" if fila["coincide_con_lo_esperado"] == "si" else "   <-- DIVERGE"
        print("%-8s %-10s %-22s %-22s %s%s" % (
            fila["id"], fila["etiqueta"], fila["resultado_esperado"],
            fila["resultado"], fila["reglas_disparadas"] or "-", marca))

    print()
    print("MATRIZ DE CONFUSION")
    print("-" * 78)
    print("  Verdaderos positivos : %d" % conteo["verdadero_positivo"])
    print("  Falsos positivos     : %d" % conteo["falso_positivo"])
    print("  Falsos negativos     : %d" % conteo["falso_negativo"])
    print("  Verdaderos negativos : %d" % conteo["verdadero_negativo"])
    print()
    print("INDICADORES DE CALIDAD")
    print("-" * 78)
    etiquetas = [
        ("precision", "Precision"),
        ("recall", "Recall (sensibilidad)"),
        ("exactitud", "Exactitud"),
        ("f1", "Medida F1"),
        ("tasa_falsos_positivos", "Tasa de falsos positivos"),
        ("tasa_falsos_negativos", "Tasa de falsos negativos"),
    ]
    for clave, texto in etiquetas:
        valor = ind[clave]
        print("  %-26s : %s" % (texto, "n/d" if valor is None else "%.2f %%" % valor))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sin-db", action="store_true",
        help="No consultar PostgreSQL; leer las reglas de los archivos .sql.")
    parser.add_argument(
        "--salida", default=str(DIR_RESULTADOS / "corpus.csv"),
        help="Archivo CSV de salida.")
    args = parser.parse_args()

    reglas, origen = cargar_reglas(preferir_db=not args.sin_db,
                                   solo=REGLAS_DEL_CORPUS)

    corpus = cargar_corpus()
    filas = [evaluar_escenario(e, reglas) for e in corpus]
    conteo = matriz(filas)
    ind = indicadores(conteo)

    DIR_RESULTADOS.mkdir(parents=True, exist_ok=True)
    with io.open(args.salida, "w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS)
        escritor.writeheader()
        escritor.writerows(filas)

    imprimir(filas, conteo, ind, origen, reglas)
    print()
    print("Resultado por escenario en: %s" % args.salida)

    divergentes = [f["id"] for f in filas if f["coincide_con_lo_esperado"] != "si"]
    if divergentes:
        print()
        print("[aviso] Escenarios cuyo resultado no coincide con el declarado en "
              "los fixtures: %s" % ", ".join(divergentes))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
