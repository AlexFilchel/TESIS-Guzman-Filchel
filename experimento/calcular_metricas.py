# -*- coding: utf-8 -*-
"""Recalcula MTTD, MTTA y MTTR y los indicadores de calidad de la detección.

Emite, global y por categoría medida: media, mediana, mínimo, máximo y
desviación estándar de las tres métricas temporales, con el **mismo estimador de
desvío que usa el backend** (`statistics.pstdev`, poblacional). Si los dos
usaran estimadores distintos, el dashboard y el informe publicarían números
diferentes sobre exactamente los mismos datos.

Después vuelve a evaluar el corpus etiquetado y emite la matriz de confusión y
los seis indicadores de calidad.

Definiciones, fijadas por el apartado 6.2 del informe:

    MTTD = fecha - evento_generado_en
    MTTA = reconocida_en - fecha
    MTTR = resuelto_en - fecha      <- desde la creación, NO desde el
                                       reconocimiento; el MTTR contiene al MTTA

Fuente de los datos, por orden de preferencia:

    python experimento/calcular_metricas.py                  # lee mediciones.csv
    python experimento/calcular_metricas.py --desde-db       # consulta PostgreSQL
    python experimento/calcular_metricas.py --desde-db --desde 2026-08-18T10:00:00
"""

import argparse
import csv
import io
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import (  # noqa: E402
    DIR_RESULTADOS, ESTIMADOR_DESVIO, INTERVALO_EVALUACION_S,
    REGLAS_DEL_CORPUS, cargar_reglas, conectar_db, resumen,
)
from escenarios import cargar_corpus  # noqa: E402
from evaluar_corpus import evaluar_escenario, indicadores, matriz  # noqa: E402

METRICAS = (("mttd_s", "MTTD"), ("mtta_s", "MTTA"), ("mttr_s", "MTTR"))


def _num(valor):
    if valor is None or valor == "":
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def leer_csv(ruta):
    with io.open(ruta, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def leer_db(desde=None, hasta=None, categorias=None):
    """Recalcula desde la base, sobre el mismo conjunto que ve el dashboard."""
    condiciones, parametros = [], []
    if desde:
        condiciones.append("fecha >= %s")
        parametros.append(desde)
    if hasta:
        condiciones.append("fecha <= %s")
        parametros.append(hasta)
    if categorias:
        condiciones.append("categoria = ANY(%s)")
        parametros.append(list(categorias))
    donde = ("WHERE " + " AND ".join(condiciones)) if condiciones else ""

    conexion = conectar_db()
    try:
        with conexion.cursor() as cur:
            cur.execute(
                "SELECT id, categoria, evento_generado_en, fecha, reconocida_en, "
                "resuelto_en FROM alertas %s ORDER BY fecha;" % donde, parametros)
            filas = []
            for f in cur.fetchall():
                def seg(a, b):
                    return None if (a is None or b is None) else round((b - a).total_seconds(), 2)
                filas.append({
                    "alerta_id": f[0],
                    "categoria_medida": f[1],
                    "regla": f[1],
                    "mttd_s": seg(f[2], f[3]),
                    "mtta_s": seg(f[3], f[4]),
                    "mttr_s": seg(f[3], f[5]),
                })
            return filas
    finally:
        conexion.close()


def tabla(titulo, filas):
    print()
    print(titulo)
    print("-" * 78)
    print("%-8s %8s %8s %8s %8s %8s %6s"
          % ("METRICA", "MEDIA", "MEDIANA", "MINIMO", "MAXIMO", "DESVIO", "N"))
    for clave, etiqueta in METRICAS:
        r = resumen([_num(f.get(clave)) for f in filas])
        if r is None:
            print("%-8s %8s %8s %8s %8s %8s %6s"
                  % (etiqueta, "-", "-", "-", "-", "-", 0))
            continue
        print("%-8s %8.2f %8.2f %8.2f %8.2f %8.2f %6d"
              % (etiqueta, r["media"], r["mediana"], r["min"], r["max"],
                 r["desvio"], r["n"]))


def metricas_temporales(filas):
    print("=" * 78)
    print("METRICAS TEMPORALES - %d alertas" % len(filas))
    print("Estimador de desviacion estandar: %s" % ESTIMADOR_DESVIO)
    print("Ciclo de evaluacion del experimento: %.2f s" % INTERVALO_EVALUACION_S)
    print("Valores en segundos. MTTR se computa desde la creacion de la alerta,")
    print("no desde el reconocimiento: el MTTR reportado contiene al MTTA.")
    print("=" * 78)

    tabla("GLOBAL", filas)

    categorias = {}
    for fila in filas:
        clave = fila.get("categoria_medida") or fila.get("regla") or "sin categoria"
        categorias.setdefault(clave, []).append(fila)

    for categoria in sorted(categorias):
        propias = categorias[categoria]
        tabla("%s (n=%d)" % (categoria.upper(), len(propias)), propias)


def calidad_de_deteccion():
    reglas, origen = cargar_reglas(preferir_db=True, solo=REGLAS_DEL_CORPUS)
    filas = [evaluar_escenario(e, reglas) for e in cargar_corpus()]
    conteo = matriz(filas)
    ind = indicadores(conteo)

    print()
    print("=" * 78)
    print("CALIDAD DE LA DETECCION - corpus de %d escenarios contra %d reglas"
          % (len(filas), len(reglas)))
    print("Reglas tomadas de: %s" % origen)
    print("=" * 78)
    print()
    print("MATRIZ DE CONFUSION")
    print("-" * 78)
    print("%-24s %10s %10s" % ("", "DETECTADO", "NO DETECT."))
    print("%-24s %10d %10d" % ("Etiquetado malicioso",
                               conteo["verdadero_positivo"], conteo["falso_negativo"]))
    print("%-24s %10d %10d" % ("Etiquetado benigno",
                               conteo["falso_positivo"], conteo["verdadero_negativo"]))
    print()
    print("INDICADORES DE CALIDAD")
    print("-" * 78)
    for clave, etiqueta in (
        ("precision", "Precision"),
        ("recall", "Recall (sensibilidad)"),
        ("exactitud", "Exactitud"),
        ("f1", "Medida F1"),
        ("tasa_falsos_positivos", "Tasa de falsos positivos"),
        ("tasa_falsos_negativos", "Tasa de falsos negativos"),
    ):
        valor = ind[clave]
        print("  %-26s : %s" % (etiqueta, "n/d" if valor is None else "%.2f %%" % valor))

    divergentes = [f["id"] for f in filas if f["coincide_con_lo_esperado"] != "si"]
    if divergentes:
        print()
        print("[aviso] Escenarios que no coinciden con lo declarado en los "
              "fixtures: %s" % ", ".join(divergentes))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=str(DIR_RESULTADOS / "mediciones.csv"),
                        help="Archivo de mediciones a leer.")
    parser.add_argument("--desde-db", action="store_true",
                        help="Recalcular consultando PostgreSQL en vez del CSV.")
    parser.add_argument("--desde", help="Limite inferior de fecha (ISO 8601).")
    parser.add_argument("--hasta", help="Limite superior de fecha (ISO 8601).")
    parser.add_argument("--categorias", nargs="*",
                        help="Categorias a incluir cuando se consulta la base.")
    parser.add_argument("--solo-corpus", action="store_true",
                        help="Omitir las metricas temporales.")
    args = parser.parse_args()

    if not args.solo_corpus:
        if args.desde_db:
            filas = leer_db(
                datetime.fromisoformat(args.desde) if args.desde else None,
                datetime.fromisoformat(args.hasta) if args.hasta else None,
                args.categorias)
        elif Path(args.csv).exists():
            filas = leer_csv(args.csv)
        else:
            filas = []
            print("[aviso] No existe %s." % args.csv, file=sys.stderr)
            print("[aviso] Corre primero: python experimento/run_experimento.py",
                  file=sys.stderr)

        if filas:
            metricas_temporales(filas)

    calidad_de_deteccion()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
