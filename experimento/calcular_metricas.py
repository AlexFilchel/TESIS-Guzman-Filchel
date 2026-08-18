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

Con `--verificar` cada valor recalculado se imprime al lado del publicado en el
Capítulo 6 y de la diferencia entre ambos. Los valores de referencia salen de
`experimento/valores_publicados.json`, que indica de qué apartado del informe
proviene cada uno.

    python experimento/calcular_metricas.py --verificar
"""

import argparse
import csv
import io
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import (  # noqa: E402
    DIR_EXPERIMENTO, DIR_RESULTADOS, ESTIMADOR_DESVIO, INTERVALO_EVALUACION_S,
    LATENCIA_PROPAGACION_S, REGLAS_DEL_CORPUS, cargar_reglas, conectar_db,
    resumen,
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


def calidad_de_deteccion(imprimir=True):
    """Evalúa el corpus. Devuelve (conteo, indicadores, filas, origen)."""
    reglas, origen = cargar_reglas(preferir_db=True, solo=REGLAS_DEL_CORPUS)
    filas = [evaluar_escenario(e, reglas) for e in cargar_corpus()]
    conteo = matriz(filas)
    ind = indicadores(conteo)

    if not imprimir:
        return conteo, ind, filas, origen

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

    return conteo, ind, filas, origen


# =============================================================================
# Modo --verificar: recalculado contra publicado
# =============================================================================

ARCHIVO_PUBLICADOS = DIR_EXPERIMENTO / "valores_publicados.json"
#: Diferencia a partir de la cual una divergencia se marca. Por debajo de una
#: centésima de segundo la diferencia es redondeo, no discrepancia.
TOLERANCIA_S = 0.01
DESCRIPTORES = ("media", "mediana", "min", "max", "desvio")


def cargar_publicados():
    return json.loads(io.open(ARCHIVO_PUBLICADOS, encoding="utf-8").read())


def _fila_comparada(etiqueta, obtenido, publicado):
    """Una línea de la tabla comparativa: obtenido, publicado y diferencia."""
    celdas = []
    marcado = False
    for descriptor in DESCRIPTORES:
        actual = None if obtenido is None else obtenido.get(descriptor)
        ref = None if publicado is None else publicado.get(descriptor)

        if actual is None:
            celdas.append("%18s" % "sin datos")
        elif ref is None:
            # El informe no publica este descriptor: es de los que hay que
            # reportar, no una divergencia.
            celdas.append("%8.2f %9s" % (actual, "s/publ."))
        else:
            diferencia = actual - ref
            if abs(diferencia) > TOLERANCIA_S:
                marcado = True
            celdas.append("%8.2f %+9.2f" % (actual, diferencia))
    return "  %-8s %s" % (etiqueta, " ".join(celdas)), marcado


def _cabecera_comparada(titulo, seccion):
    print()
    print("%s   [informe %s]" % (titulo, seccion))
    print("-" * 78)
    print("  %-8s %18s %18s %18s" % ("", "MEDIA  (dif)", "MEDIANA  (dif)", "MINIMO  (dif)"),
          end="")
    print(" %18s %18s" % ("MAXIMO  (dif)", "DESVIO  (dif)"))


def verificar_tiempos(filas, publicados):
    """Compara lo recalculado contra lo publicado, global y por categoría."""
    divergencias = []

    ambitos = [("global", filas)]
    categorias = {}
    for fila in filas:
        clave = fila.get("categoria_medida") or fila.get("regla") or "sin categoria"
        categorias.setdefault(clave, []).append(fila)

    for nombre, referencia in publicados["tiempos"].items():
        if nombre == "global":
            continue
        claves = referencia.get("claves") or [nombre]
        propias = []
        for clave in claves:
            propias.extend(categorias.get(clave, []))
        ambitos.append((nombre, propias))

    for nombre, propias in ambitos:
        referencia = publicados["tiempos"].get(nombre)
        if referencia is None:
            continue
        _cabecera_comparada("%s (n=%d)" % (referencia["etiqueta"], len(propias)),
                            referencia["seccion"])
        for clave, etiqueta in METRICAS:
            obtenido = resumen([_num(f.get(clave)) for f in propias])
            linea, marcado = _fila_comparada(etiqueta, obtenido, referencia.get(clave.replace("_s", "")))
            print(linea)
            if marcado:
                divergencias.append("%s / %s" % (referencia["etiqueta"], etiqueta))
        if referencia.get("nota"):
            print("  nota: %s" % referencia["nota"])

    return divergencias


def verificar_corpus(conteo, ind, publicados):
    referencia = publicados["corpus"]
    divergencias = []

    print()
    print("%s   [informe %s]" % (referencia["etiqueta"], referencia["seccion"]))
    print("-" * 78)
    print("  %-26s %10s %10s %10s" % ("", "OBTENIDO", "PUBLICADO", "DIF"))
    for clave, etiqueta in (
        ("verdadero_positivo", "Verdaderos positivos"),
        ("falso_positivo", "Falsos positivos"),
        ("falso_negativo", "Falsos negativos"),
        ("verdadero_negativo", "Verdaderos negativos"),
    ):
        actual = conteo[clave]
        ref = referencia["matriz"][clave]
        print("  %-26s %10d %10d %+10d" % (etiqueta, actual, ref, actual - ref))
        if actual != ref:
            divergencias.append("corpus / %s" % etiqueta)

    for clave, etiqueta in (
        ("precision", "Precision"),
        ("recall", "Recall (sensibilidad)"),
        ("exactitud", "Exactitud"),
        ("f1", "Medida F1"),
        ("tasa_falsos_positivos", "Tasa de falsos positivos"),
        ("tasa_falsos_negativos", "Tasa de falsos negativos"),
    ):
        actual = ind[clave]
        ref = referencia["indicadores"].get(clave)
        if actual is None:
            print("  %-26s %10s %10s %10s" % (etiqueta, "n/d", "-", "-"))
        elif ref is None:
            print("  %-26s %9.2f%% %10s %10s" % (etiqueta, actual, "s/publ.", "-"))
        else:
            print("  %-26s %9.2f%% %9.2f%% %+9.2f%%"
                  % (etiqueta, actual, ref, actual - ref))
            if abs(actual - ref) > TOLERANCIA_S:
                divergencias.append("corpus / %s" % etiqueta)

    return divergencias


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
    parser.add_argument("--verificar", action="store_true",
                        help="Contrastar cada valor recalculado contra el "
                             "publicado en el Capitulo 6 e imprimir la diferencia.")
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

    if not args.verificar:
        calidad_de_deteccion()
        return 0

    # --- modo verificacion -------------------------------------------------
    publicados = cargar_publicados()
    conteo, ind, corpus, origen = calidad_de_deteccion(imprimir=False)

    print()
    print("=" * 78)
    print("VERIFICACION CONTRA LOS VALORES PUBLICADOS EN EL CAPITULO 6")
    print("Referencia: %s" % ARCHIVO_PUBLICADOS.name)
    print("Estimador de desviacion estandar: %s" % ESTIMADOR_DESVIO)
    print("Ciclo de evaluacion: %.2f s | Piso de propagacion: %.2f s"
          % (INTERVALO_EVALUACION_S, LATENCIA_PROPAGACION_S))
    print("Cada celda: valor recalculado y (diferencia contra lo publicado).")
    print("'s/publ.' = el informe no publica ese descriptor todavia.")
    print("=" * 78)

    divergencias = []
    if filas:
        divergencias += verificar_tiempos(filas, publicados)
    else:
        print()
        print("[aviso] Sin mediciones temporales: falta %s." % args.csv)
        print("[aviso] Corre primero: python experimento/run_experimento.py")
    divergencias += verificar_corpus(conteo, ind, publicados)

    sin_publicar = [f["id"] for f in corpus if f["coincide_con_lo_esperado"] != "si"]
    if sin_publicar:
        print()
        print("[aviso] Escenarios que no coinciden con su fixture: %s"
              % ", ".join(sin_publicar))

    print()
    print("=" * 78)
    if divergencias:
        print("DIVERGENCIAS A INFORMAR (%d):" % len(divergencias))
        for d in divergencias:
            print("  - %s" % d)
        print()
        print("No se ajusta nada para que cierren: se reporta la diferencia.")
        return 1
    print("Sin divergencias por encima de %.2f s respecto de lo publicado."
          % TOLERANCIA_S)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
