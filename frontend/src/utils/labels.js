export const SEVERIDAD_LABELS = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja'
};

export const CATEGORIA_LABELS = {
  fuerza_bruta: 'Fuerza bruta',
  login_root: 'Login root',
  sudo_abuso: 'Abuso de sudo',
  port_scan: 'Escaneo de puertos',
  directory_scan: 'Escaneo de directorios',
  consulta_masiva: 'Consulta masiva',
  exploit_web: 'Explotación web',
  info: 'Informativo',
  warning: 'Advertencia',
  critical_event: 'Evento crítico',
  critical_test: 'Prueba crítica',
  high_test: 'Prueba alta',
  medium_test: 'Prueba media',
  low_test: 'Prueba baja'
};

export function traducirSeveridad(severidad) {
  return SEVERIDAD_LABELS[severidad] || severidad;
}

export function traducirCategoria(categoria) {
  return CATEGORIA_LABELS[categoria] || categoria.replace(/_/g, ' ');
}
