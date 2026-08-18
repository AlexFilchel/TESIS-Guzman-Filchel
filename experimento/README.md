# Experimento reproducible del Capítulo 6

Scripts y fixtures que permiten reejecutar las dos mediciones del Capítulo 6 del informe: las
**treinta alertas** de las métricas temporales (apartado 6.4) y los **dieciséis escenarios** del
corpus etiquetado (apartado 6.5).

El despliegue del entorno está en el [`README.md`](../README.md) de la raíz. Acá va el detalle
del experimento.

---

## 1. Preparación

```bash
# 1. Entorno limpio: sin acumulado previo en la base
docker compose down -v
docker compose up -d

# 2. Dependencias de Python en el host
pip install -r experimento/requirements.txt

# 3. Reglas auxiliares del experimento
docker exec -i siem_postgres psql -U siem -d monitoreo_seguridad \
  < experimento/reglas_auxiliares.sql
```

El paso 3 es necesario porque `sql/01-init.sql` siembra **sólo las seis reglas base** del sistema.
Las dos reglas auxiliares —«Consulta masiva SID» y «Explotación web Apache Struts»— se
incorporaron para representar las señales observables de los casos RENAPER y Equifax y no forman
parte de la configuración base: por eso viven acá y no en `sql/`.

| Regla auxiliar | Patrón | Umbral | Ventana | Severidad |
|---|---|---|---|---|
| Consulta masiva SID | `Query SID: DNI=` | 10 | 300 s | `critical` |
| Explotación web Apache Struts | `runtime.exec` | 1 | 300 s | `critical` |

---

## 2. Por qué el experimento no usa el simulador del backend

`POST /api/simulator/generate` sella `evento_generado_en` e inmediatamente después crea la alerta
con `fecha = utcnow()`. La alerta no nace de una evaluación de regla: nace del mismo request que
generó el evento. El MTTD resultante es **cero por construcción**, y no hay acumulación de umbral
ni ventana temporal en el medio. El simulador sirve para poblar la interfaz durante una
demostración; no sirve para medir tiempos de detección.

El experimento reproduce el camino real, que es el que hace medible el MTTD:

1. **Emisión.** `emisor.py` escribe los eventos del escenario, uno por uno y al ritmo que el
   escenario define, en `./data/remotos/<host>/{auth,syslog}.log`. Es el mismo árbol que produce
   syslog-ng y el mismo que montan Logstash y n8n, así que los eventos del experimento recorren el
   mismo camino que los reales: Logstash los indexa en Elasticsearch y el ciclo de evaluación los
   lee del filesystem, igual que el nodo `Read Logs` del workflow.
2. **Evaluación periódica.** Cada `INTERVALO_EVALUACION_S` segundos el ciclo relee los archivos,
   parsea las líneas con la misma función que el nodo `Parse Logs` y aplica la misma semántica que
   el nodo `Apply rules`: filtra por la `ventana_tiempo` de la regla, agrupa por entidad de origen
   y dispara cuando el recuento de una entidad alcanza el `umbral`. Es lo que el apartado 4.2.6
   llama «lógica homóloga a la del experimento», y está en `evaluador.py`.
3. **Creación de la alerta.** Al dispararse se inserta la alerta con una sentencia parametrizada,
   igual que el nodo `Store alerts`, con `evento_generado_en` = marca del **primer evento de la
   secuencia que la disparó** y `fecha` = instante de la detección.
4. **Ciclo de vida.** La alerta se lleva a `investigada` y después a `resuelta` mediante
   `PATCH /api/alertas/{id}`, que es lo que sella `reconocida_en` y `resuelto_en` en el backend.
5. **Volcado.** Una fila por alerta en `resultados/mediciones.csv`.

### Parámetros del ciclo

Están todos en `comun.py` y `run_experimento.py`, como constantes nombradas:

| Constante | Valor | Qué es |
|---|---|---|
| `INTERVALO_EVALUACION_S` | `5` | Período del barrido de reglas. Es el parámetro que fija el piso del MTTD: una alerta no puede detectarse antes del primer barrido posterior a que la secuencia alcance el umbral. |
| `EJECUCIONES_POR_CATEGORIA` | `10` | Tres escenarios × diez ejecuciones = las treinta alertas medidas. |
| `RETARDO_RECONOCIMIENTO_S` | `2.0` | Espera antes de pasar la alerta a `investigada`. |
| `RETARDO_RESOLUCION_S` | `2.4` | Espera adicional antes de pasarla a `resuelta`. |
| `TIMEOUT_DETECCION_S` | `180` | Tiempo máximo de espera antes de dar una ejecución por perdida. |

Todas se pueden sobrescribir por variable de entorno, con el mismo nombre.

El workflow de n8n usa un ciclo de **cinco minutos** (nodo `Cronómetro 5 min`), adecuado para
operación continua pero inservible para medir tiempos de detección con resolución de segundos. El
experimento aplica la misma semántica de evaluación con un período corto: lo único que cambia es
la frecuencia del barrido.

`RETARDO_RECONOCIMIENTO_S` y `RETARDO_RESOLUCION_S` merecen una aclaración. En este laboratorio
MTTA y MTTR miden **transiciones automáticas de estado**, no la reacción de un analista humano: el
entorno no tiene a nadie atendiendo la consola. Esas dos constantes son la cadencia declarada con
la que el experimento recorre el ciclo de vida, y son la razón por la que MTTA y MTTR salen del
orden del segundo. Lo que se mide es real —las cuatro marcas se leen de la base después de cada
`PATCH`, no se calculan a partir de las constantes—, pero la escala la fijan ellas.

---

## 3. Medición temporal — las treinta alertas

```bash
python experimento/run_experimento.py
```

Tres categorías, diez ejecuciones cada una, con los parámetros de regla que el informe publica:

| Categoría medida | Regla | Patrón | Umbral | Ventana | Severidad |
|---|---|---|---|---|---|
| Consulta masiva (RENAPER) | Consulta masiva SID | `Query SID: DNI=` | 10 | 300 s | crítica |
| Explotación web (Equifax) | Explotación web Apache Struts | `runtime.exec` | 1 | 300 s | crítica |
| Fuerza bruta SSH | Fuerza bruta SSH | `Failed password` | 6 | 300 s | alta |

Los escenarios están en `fixtures/escenarios_medicion.json`. El campo `intervalo_s` de cada uno es
el tiempo entre eventos consecutivos de la secuencia atacante, y es una propiedad del ataque
simulado, no un parámetro del sistema de detección —el sistema no lo conoce—. Los valores se
derivan de los propios números publicados en el informe: el MTTD medio de la explotación web
(umbral 1, sin acumulación) es 9,10 s; el de la fuerza bruta (umbral 6, cinco intervalos) es
12,10 s, tres segundos más, o sea 0,6 s por intervalo; el de la consulta masiva (umbral 10, nueve
intervalos) es 31,80 s, veintidós con setenta más, o sea 2,52 s por intervalo.

Ese ordenamiento —31,80 / 12,10 / 9,10 para umbrales 10 / 6 / 1— es el argumento central del
apartado 6.2: la dispersión del MTTD se explica por la configuración de las reglas y no por el
rendimiento del sistema. Una reejecución que rompa ese ordenamiento es un resultado a informar.

**Salida:** `resultados/mediciones.csv`, con una fila por alerta:

| Columna | Contenido |
|---|---|
| `ejecucion`, `escenario`, `categoria_medida`, `regla`, `umbral` | Identificación de la corrida. |
| `alerta_id`, `entidad`, `cantidad_eventos` | La alerta creada y la entidad de origen que la disparó. |
| `evento_generado_en`, `fecha`, `reconocida_en`, `resuelto_en` | Las cuatro marcas, leídas de la base. |
| `mttd_s`, `mtta_s`, `mttr_s` | Las tres métricas, en segundos. |

Al terminar, el script imprime la ventana `desde`/`hasta` de la corrida, para filtrar el endpoint
`GET /api/metrics/tiempos` y ver el dashboard sobre el conjunto medido.

---

## 4. Corpus etiquetado — los dieciséis escenarios

```bash
python experimento/evaluar_corpus.py
```

Ocho escenarios maliciosos (`fixtures/escenarios_maliciosos.json`) y ocho benignos
(`fixtures/escenarios_benignos.json`), evaluados contra **siete** reglas: las cinco reglas base con
correspondencia en las fuentes de log del laboratorio —fuerza bruta SSH, intento de login root,
abuso de sudo, escaneo de puertos y escaneo de directorios web— más las dos auxiliares.

La sexta regla base, **inyección SQL**, queda deliberadamente fuera: opera sobre el cuerpo de las
peticiones HTTP, y las fuentes de log del laboratorio (syslog `auth` y syslog de los contenedores
cliente) no transportan ese contenido. Ningún escenario, malicioso o benigno, podría producir
eventos del tipo que la regla evalúa; incluirla sólo habría agregado un verdadero negativo
trivial, sin información sobre la calidad de la detección.

### Criterio de construcción del conjunto benigno

Un escenario de actividad legítima por cada una de las siete reglas —capaz de producir eventos del
mismo tipo que la regla evalúa, pero originados en operación autorizada— más un octavo de
operación normal sin correspondencia con ninguna regla, incorporado como control. Sin ese
criterio el conjunto benigno sería trivial de clasificar y no diría nada sobre la calidad de la
detección.

### Los dos casos que no se clasifican bien

Están identificados en los fixtures por su campo `resultado_esperado` y por su `justificacion`:

* **`BEN-05` — falso positivo.** Uso legítimo del portal administrativo: un operador autorizado
  emite nueve peticiones `GET` a rutas bajo `/admin`, todas respondidas con 200. La regla de
  escaneo de directorios web sigue sólo el patrón de la ruta, no el código de respuesta ni la
  autenticación de la sesión, y las marca igual que a una enumeración automatizada.
* **`MAL-08` — falso negativo.** Consultas SID distribuidas por debajo del umbral: veintisiete
  consultas repartidas entre nueve direcciones de origen. El volumen agregado es el de una
  extracción masiva, pero ninguna entidad llega por sí sola a las diez consultas del umbral. El
  agrupamiento por entidad, que es lo que evita atribuir a una sola dirección la actividad de
  muchas, es también lo que abre esta evasión.

La evaluación es determinista y no necesita el entorno levantado: los tiempos se calculan en lugar
de esperarse, y si PostgreSQL no responde las reglas se leen de `sql/01-init.sql` y de
`reglas_auxiliares.sql`, que son los mismos archivos que la base carga. Con el entorno levantado
las reglas se leen de la base, que es lo que el sistema realmente aplica.

**Salida:** `resultados/corpus.csv` y la matriz de confusión por pantalla. Si algún escenario
arroja un resultado distinto del declarado en su fixture, el script lo señala y termina con
código de salida 1.

---

## 5. Recálculo de métricas

```bash
python experimento/calcular_metricas.py                 # desde resultados/mediciones.csv
python experimento/calcular_metricas.py --desde-db      # consultando PostgreSQL
python experimento/calcular_metricas.py --solo-corpus   # sólo la matriz de confusión
```

Emite, global y por categoría medida, **media, mediana, mínimo, máximo y desviación estándar** de
MTTD, MTTA y MTTR, y después la matriz de confusión con los seis indicadores de calidad
(precisión, recall, exactitud, F1, tasa de falsos positivos y tasa de falsos negativos).

Definiciones, fijadas por el apartado 6.2:

    MTTD = fecha - evento_generado_en
    MTTA = reconocida_en - fecha
    MTTR = resuelto_en - fecha      <- desde la creación, NO desde el reconocimiento;
                                       el MTTR reportado contiene al MTTA

La desviación estándar usa el estimador **poblacional** (`statistics.pstdev`), el mismo que
`backend/app/routers/metrics.py`. Si se cambia en un lado hay que cambiarlo en el otro, o el
dashboard y el informe publicarían desvíos distintos sobre los mismos datos.

---

## 6. Estructura

```
experimento/
├── README.md                    Este archivo.
├── requirements.txt             psycopg2-binary, única dependencia externa.
├── reglas_auxiliares.sql        Las dos reglas auxiliares (RENAPER y Equifax).
├── comun.py                     Configuración, conexión, carga de reglas y estadística.
├── evaluador.py                 Ciclo de evaluación: umbral, ventana y entidad de origen.
├── emisor.py                    Emisión de eventos RFC 3164 al volumen de logs.
├── escenarios.py                Carga y materialización de los fixtures.
├── run_experimento.py           Medición temporal: las treinta alertas.
├── evaluar_corpus.py            Corpus etiquetado: los dieciséis escenarios.
├── calcular_metricas.py         Recálculo de métricas e indicadores de calidad.
├── fixtures/
│   ├── escenarios_maliciosos.json
│   ├── escenarios_benignos.json
│   └── escenarios_medicion.json
└── resultados/
    ├── corpus.csv               Una fila por escenario, con etiqueta y resultado.
    └── mediciones.csv           Una fila por alerta medida (lo genera run_experimento.py).
```

Correspondencia entre los scripts y los nodos del workflow:

| Script del experimento | Nodo del workflow |
|---|---|
| `evaluador.parsear_linea` | `Parse Logs` (Anexo C.5) |
| `evaluador.evaluar` | `Apply rules` (Anexo C.6) |
| `run_experimento.CicloEvaluacion` | `Cronómetro 5 min` + `Read Logs` + `Extract from File` |
| `run_experimento.insertar_alerta` | `Store alerts` (Anexo C.7) |
