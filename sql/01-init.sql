CREATE TABLE IF NOT EXISTS alertas (
   id SERIAL PRIMARY KEY,
   fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   severidad VARCHAR(20) NOT NULL,
   categoria VARCHAR(50) NOT NULL,
   ip_origen INET,
   host_objetivo VARCHAR(255),
   cantidad_eventos INTEGER DEFAULT 1,
   descripcion TEXT,
   log_crudo TEXT,
   estado VARCHAR(20) DEFAULT 'nueva',
   asignado_a VARCHAR(100),
   notas TEXT,
   resuelto_en TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reglas_deteccion (
   id SERIAL PRIMARY KEY,
   nombre VARCHAR(200) NOT NULL,
   descripcion TEXT,
   patron TEXT NOT NULL,
   severidad VARCHAR(20) NOT NULL,
   umbral INTEGER DEFAULT 1,
   ventana_tiempo INTEGER DEFAULT 300,
   habilitada BOOLEAN DEFAULT true,
   creada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   actualizada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON alertas(fecha);
CREATE INDEX IF NOT EXISTS idx_alertas_severidad ON alertas(severidad);
CREATE INDEX IF NOT EXISTS idx_alertas_ip ON alertas(ip_origen);

INSERT INTO reglas_deteccion (nombre, descripcion, patron, severidad, umbral, ventana_tiempo)
VALUES
('Fuerza bruta SSH', 'Detecta múltiples intentos fallidos de SSH', 'Failed password', 'high', 6, 300),
('Intento login root', 'Detecta intento de autenticación como root', 'Failed password for root', 'critical', 1, 60),
('Uso sospechoso de sudo', 'Detecta múltiples ejecuciones de sudo', 'sudo', 'medium', 10, 600),
('Escaneo puertos', 'Detecta múltiples paquetes bloqueados por firewall', 'DROP|UFW BLOCK|iptables', 'medium', 5, 300),
('Escaneo directorios web', 'Detecta acceso a rutas comunes de ataque web', 'GET.*(admin|phpmyadmin|wp-admin|\\.env)', 'medium', 3, 300)
ON CONFLICT DO NOTHING;