-- =============================================================================
-- Reglas auxiliares del experimento del Capítulo 6
-- =============================================================================
-- sql/01-init.sql siembra las SEIS reglas base del sistema. Estas dos reglas no
-- son parte de esa base: se incorporaron para representar las señales
-- observables de los dos casos documentados --RENAPER y Equifax-- y sólo tienen
-- sentido dentro del experimento.
--
-- Mantenerlas separadas es lo que hace verificable la frase del apartado 6.5.1
-- del informe: seis reglas base en sql/, dos reglas auxiliares en experimento/.
--
-- Se carga como paso previo a run_experimento.py y a evaluar_corpus.py:
--
--   docker exec -i siem_postgres psql -U siem -d monitoreo_seguridad \
--     < experimento/reglas_auxiliares.sql
--
-- Es idempotente: volver a ejecutarlo no duplica las reglas.
-- =============================================================================

INSERT INTO reglas_deteccion (nombre, descripcion, patron, severidad, umbral, ventana_tiempo)
SELECT * FROM (VALUES
('Consulta masiva SID', 'Detecta consultas masivas al servicio SID con número de documento', 'Query SID: DNI=', 'critical', 10, 300),
('Explotación web Apache Struts', 'Detecta invocación de runtime.exec en encabezados de peticiones web', 'runtime.exec', 'critical', 1, 300)
) AS nuevas(nombre, descripcion, patron, severidad, umbral, ventana_tiempo)
WHERE NOT EXISTS (
   SELECT 1 FROM reglas_deteccion r WHERE r.nombre = nuevas.nombre
);

-- Verificación: la base queda con las seis reglas base más estas dos.
--   SELECT id, nombre, umbral, ventana_tiempo FROM reglas_deteccion ORDER BY id;
