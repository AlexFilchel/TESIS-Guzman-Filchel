-- =============================================================================
-- Migración idempotente de instrumentación temporal
-- =============================================================================
-- Los scripts de ./sql sólo se ejecutan la primera vez que se inicializa el
-- volumen postgres_data. Una instancia creada antes de la instrumentación del
-- ciclo de vida de las alertas no tiene las columnas nuevas ni el tipo INET.
-- Este archivo se puede ejecutar sobre una base ya existente, todas las veces
-- que haga falta, sin efectos colaterales:
--
--   docker exec -i siem_postgres psql -U siem -d monitoreo_seguridad \
--     < sql/02-migracion-instrumentacion.sql
--
-- Sobre una base recién inicializada por 01-init.sql no cambia nada.
-- =============================================================================

-- --- Marcas temporales del ciclo de vida de la alerta -----------------------
-- evento_generado_en: instante del primer evento de la secuencia que dispara la
--                     regla. Es el origen del MTTD (fecha - evento_generado_en).
-- reconocida_en:      instante en que la alerta pasa a estado 'investigada'.
-- resuelto_en:        instante en que la alerta pasa a estado 'resuelta'.
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS evento_generado_en TIMESTAMP;
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS reconocida_en      TIMESTAMP;
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS resuelto_en        TIMESTAMP;

-- --- Tipo de ip_origen ------------------------------------------------------
-- El Anexo A documenta ip_origen INET; las instancias viejas lo tienen como
-- VARCHAR(50). El nodo `Store alerts` del workflow ya castea a $4::inet.
-- Las cadenas vacías o no parseables se descartan para que el USING no falle.
DO $$
BEGIN
   IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'alertas'
        AND column_name = 'ip_origen'
        AND data_type <> 'inet'
   ) THEN
      UPDATE alertas
         SET ip_origen = NULL
       WHERE ip_origen IS NOT NULL
         AND ip_origen !~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
         AND ip_origen !~ '^[0-9a-fA-F:]+$';

      ALTER TABLE alertas
         ALTER COLUMN ip_origen TYPE INET USING ip_origen::inet;
   END IF;
END
$$;

-- --- Índices ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_alertas_fecha     ON alertas(fecha);
CREATE INDEX IF NOT EXISTS idx_alertas_severidad ON alertas(severidad);
CREATE INDEX IF NOT EXISTS idx_alertas_ip        ON alertas(ip_origen);
CREATE INDEX IF NOT EXISTS idx_alertas_categoria ON alertas(categoria);
