import { useState, useEffect } from 'react';
import { generateSimulator, getAlertas } from '../services/api';

// =============================================================================
// CASOS REALES - Datos para la tesis
// =============================================================================
const CASOS_REALES = [
  {
    id: 'renaper',
    titulo: 'Caso A: RENAPER',
    anio: 2021,
    pais: 'Argentina',
    empresa: 'Registro Nacional de las Personas',
    tipo: 'acceso_indebido',
    severidad: 'critical',
    // Resumen ejecutivo
    contexto: `En octubre de 2021, un atacante utilizó credenciales válidas del Ministerio de Salud para acceder al Sistema de Identidad Digital (SID) del RENAPER. A través de una conexión VPN autorizada, realizó consultas masivas de DNIs, extrayendo datos personales de millones de argentinos que luego fueron publicados en redes sociales y vendidos en foros de hacking.`,
    impacto: 'Potencialmente 45 millones de registros de ciudadanos comprometidos (datos completos: nombre, dirección, foto DNI, número de trámite)',
    // Timeline del ataque
    timeline: [
      { paso: 1, tiempo: '15:01', descripcion: 'Obtención de credenciales válidas del Ministerio de Salud' },
      { paso: 2, tiempo: '15:05', descripcion: 'Conexión VPN autorizada establecida' },
      { paso: 3, tiempo: '15:10', descripcion: 'Primera consulta al SID con DNI válido' },
      { paso: 4, tiempo: '15:15-15:30', descripcion: 'Múltiples consultas automáticas a diferentes DNIs' },
      { paso: 5, tiempo: '15:55', descripcion: 'Última consulta - 19 fotos filtradas coinciden' },
      { paso: 6, tiempo: '18:00', descripcion: 'Fotos publicadas en Twitter (@AnibalLeaks)' }
    ],
    // Logs que se habrían generado (simulados)
    logs_raw: [
      'Oct 13 15:05:01 renaper-vpn vpn-ga: Connection established from 200.51.100.45 (MinisterioSalud)',
      'Oct 13 15:10:23 sid-server app[9231]: Query SID: DNI=30123456, Sexo=M, User=usr_salud_001',
      'Oct 13 15:15:07 sid-server app[9231]: Query SID: DNI=18567890, Sexo=F, User=usr_salud_001',
      'Oct 13 15:15:09 sid-server app[9231]: Query SID: DNI=42345678, Sexo=M, User=usr_salud_001',
      'Oct 13 15:15:12 sid-server app[9231]: Query SID: DNI=28901234, Sexo=F, User=usr_salud_001',
      'Oct 13 15:20:45 sid-server app[9231]: Query SID: DNI=40123456, Sexo=M, User=usr_salud_001',
      'Oct 13 15:25:33 sid-server app[9231]: Query SID: DNI=11567890, Sexo=F, User=usr_salud_001',
      'Oct 13 15:30:10 sid-server app[9231]: Query SID: DNI=55012345, Sexo=M, User=usr_salud_001',
      'Oct 13 15:40:22 sid-server app[9231]: Query SID: DNI=32111222, Sexo=F, User=usr_salud_001',
      'Oct 13 15:55:44 sid-server app[9231]: Query SID: DNI=12345678, Sexo=M, User=usr_salud_001'
    ],
    // Reglas SIEM que detectarían el ataque
    regla_deteccion: 'ALTO VOLUMEN DE CONSULTAS POR USUARIO',
    descripcion_regla: 'Si un mismo usuario realiza más de 10 consultas al sistema SID en un intervalo de 30 minutos, generar ALERTA CRÍTICA',
    // Comparativa sin SIEM vs con SIEM
    sin_siem: {
      tiempo_deteccion: '~3 días (alertas en redes sociales)',
      impacto: 'Miles de datos filtrados antes de detectar',
      acciones: 'Investigación reactiva post-publicación'
    },
    con_siem: {
      tiempo_deteccion: '~15 minutos (en tiempo real)',
      impacto: 'Mínimas consultas antes de bloquear',
      acciones: 'Bloqueo inmediato + alerta al equipo de seguridad'
    },
    // Conclusión técnica
    conclusion: 'El patrón de consultas anómalas (alto volumen en corto tiempo) desde un mismo usuario habría sido detectado inmediatamente por un SIEM con reglas de correlación, evitando la masiva filtración de datos personales. La ausencia de monitoreo permitió que el ataque pasara desapercibido durante horas.'
  },
  {
    id: 'equifax',
    titulo: 'Caso B: Equifax',
    anio: 2017,
    pais: 'Estados Unidos',
    empresa: 'Equifax Inc.',
    tipo: 'exploit_web',
    severidad: 'critical',
    contexto: `En mayo de 2017, atacantes explotaron una vulnerabilidad conhecida (CVE-2017-5638) en Apache Struts, un framework web usado por Equifax. Aunque el parche estaba disponible desde marzo, la empresa no lo aplicó. Durante ~76 días los atacantes tuvieron acceso no autorizado a la base de datos, robando información sensible de 147 millones de personas.`,
    impacto: '147 millones de registros filtrados: números de tarjeta de crédito (209k), licencias de conducir, SSN, fechas de nacimiento, direcciones',
    timeline: [
      { paso: 1, tiempo: 'Mayo 2017', descripcion: 'Explotación de CVE-2017-5638 en aplicación web' },
      { paso: 2, tiempo: 'Mayo 2017', descripcion: 'Ejecución remota de código en servidorcomprometido' },
      { paso: 3, tiempo: 'Junio 2017', descripcion: 'Movimiento lateral a otros sistemas internos' },
      { paso: 4, tiempo: 'Junio 2017', descripcion: 'Acceso a bases de datos con información financiera' },
      { paso: 5, tiempo: 'Julio 2017', descripcion: 'Exfiltración sostenida de datos' },
      { paso: 6, tiempo: 'Julio 29', descripcion: 'Equifax detecta el incidente (76 días después)' }
    ],
    logs_raw: [
      'May 07 14:23:11 web01 httpd[12345]: Client 192.168.2.55 - - "GET /api/query HTTP/1.1" 200',
      'May 07 14:23:12 web01 httpd[12345]: X-Handler: ${${runtime.exec("whoami")}}',
      'May 07 14:23:13 web01 kernel: [12345] execve("/bin/sh", ["/bin/sh", "-c", "whoami"])',
      'May 07 14:23:14 web01 httpd[12345]: Out: www-data',
      'May 08 09:15:00 db01 postgres[5432]: CONNECT: host=10.0.0.25(4321) user=equifax_db',
      'May 08 09:15:30 db01 postgres[5432]: SELECT * FROM consumers WHERE credit_score > 700',
      'May 08 09:16:01 db01 postgres[5432]: COPY consumers TO STDOUT',
      'Jun 15 10:30:00 internal-nas smbd[8801]: Connection from 192.168.2.55',
      'Jun 15 10:30:15 internal-nas smbd[8801]: COPY /var/backup/*.sql /tmp/exfil.tar.gz',
      'Jul 20 03:45:00 ext-gw firewall: ACCEPT OUT: 192.168.2.55 -> 185.141.25.10:443'
    ],
    regla_deteccion: 'PATRÓN EXPLOIT WEB + EJECUCIÓN DE COMANDOS',
    descripcion_regla: 'Detectar patrones de explotación (CVE-2017-5638) en logs de aplicación + correlación con ejecución de comandos en el servidor = ALERTA CRÍTICA inmediata',
    sin_siem: {
      tiempo_deteccion: '76 días',
      impacto: '147 millones de registros robados',
      acciones: 'Descubrimiento post-hoc, months de investigación'
    },
    con_siem: {
      tiempo_deteccion: '~1-2 horas (detección inicial)',
      impacto: 'Contención en horas, no días',
      acciones: 'Alerta automática + aislamiento del servidor'
    },
    conclusion: 'Un SIEM habría detectado: (1) los patrones de exploit en los requests HTTP malformed, (2) la ejecución de comandos sospechosa, (3) el movimiento lateral a otros sistemas. La persistencia de 76 días fue posible por falta de correlación de eventos entre capas.'
  }
];

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function Casos() {
  const [casoSeleccionado, setCasoSeleccionado] = useState(null);
  const [vista, setVista] = useState('seleccion');
  const [logsInyectados, setLogsInyectados] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Para la visualización de logs
  const [mostrarAnalizados, setMostrarAnalizados] = useState(false);

  // Colors para severidad
  const getSeverityColor = (severidad) => {
    return severidad === 'critical' ? 'bg-red-600' : 'bg-orange-600';
  };

  // Manejar inyección de logs al sistema
  const handleSimular = async () => {
    if (!casoSeleccionado) return;
    
    setLoading(true);
    
    try {
      // Simular según el tipo de caso
      let tipo = 'info';
      let cantidad = 20;
      let ip_origen = '192.168.1.100';
      
      if (casoSeleccionado.id === 'renaper') {
        tipo = 'high_volume_query';
        cantidad = 15;
        ip_origen = '200.51.100.45';
      } else if (casoSeleccionado.id === 'equifax') {
        tipo = 'web_exploit';
        cantidad = 10;
        ip_origen = '192.168.2.55';
      }
      
      const { data } = await generateSimulator({
        tipo,
        ip_origen,
        cantidad
      });
      
      setLogsInyectados(true);
      // No necesitamos mensaje separado - los logs se muestran directamente
      
    } catch (error) {
      console.error('Error en simulación:', error);
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // VISTA: SELECCIÓN DE CASOS
  // =============================================================================
  if (vista === 'seleccion') {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">📚 Casos de Estudio Reales</h1>
          <p className="text-gray-400 mt-2">
            Análisis de incidentes de seguridad donde un SIEM habría detectado o mitigado el ataque
          </p>
        </div>

        {/* Tarjetas de Casos Reales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CASOS_REALES.map((caso) => (
            <div
              key={caso.id}
              className="bg-gray-800 rounded-xl p-6 border-2 border-gray-700 cursor-pointer transition-all hover:border-blue-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
              onClick={() => {
                setCasoSeleccionado(caso);
                setVista('detalle');
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {caso.anio} • {caso.pais}
                  </span>
                  <h2 className="text-xl font-bold mt-1">{caso.titulo}</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getSeverityColor(caso.severidad)} text-white`}>
                  {caso.severidad.toUpperCase()}
                </span>
              </div>
              
              <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                {caso.contexto}
              </p>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-400 font-medium">
                  Ver análisis completo →
                </span>
                <span className="text-gray-500">
                  {caso.timeline.length} pasos
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Badge explicativo */}
        <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-blue-300 text-sm">
            💡 <strong>Nota:</strong> Estos casos demuestran cómo un SIEM correlaciona eventos de múltiples fuentes para detectar ataques que, de otra forma, pasarían desapercibidos durante días o semanas.
          </p>
        </div>
      </div>
    );
  }

  // =============================================================================
  // VISTA: DETALLE DEL CASO
  // =============================================================================
  if (vista === 'detalle' && casoSeleccionado) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              setVista('seleccion');
              setCasoSeleccionado(null);
              setLogsInyectados(false);
            }}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            ← Volver a Casos
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${getSeverityColor(casoSeleccionado.severidad)} text-white`}>
            {casoSeleccionado.severidad.toUpperCase()}
          </span>
        </div>

        {/* Título y Contexto */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-sm text-gray-500">{casoSeleccionado.anio} • {casoSeleccionado.pais}</span>
              <h1 className="text-2xl font-bold mt-1">{casoSeleccionado.titulo}</h1>
              <p className="text-gray-400 mt-2">{casoSeleccionado.empresa}</p>
            </div>
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-orange-400 mb-2">📋 Contexto del Ataque</h3>
            <p className="text-gray-300">{casoSeleccionado.contexto}</p>
          </div>
          
          <div className="mt-4 p-4 bg-red-900/30 rounded-lg border border-red-700">
            <h3 className="font-semibold text-red-400 mb-2">💥 Impacto</h3>
            <p className="text-gray-300">{casoSeleccionado.impacto}</p>
          </div>
        </div>

        {/* Timeline Visual */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">📅 Línea de Tiempo del Ataque</h2>
          
          <div className="relative ml-4">
            {/* Línea vertical */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700"></div>
            
            {/* Pasos */}
            <div className="space-y-4">
              {casoSeleccionado.timeline.map((item, idx) => (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold z-10">
                    {item.paso}
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-blue-400 text-sm">{item.tiempo}</span>
                      <span className="text-gray-400">Paso {item.paso}</span>
                    </div>
                    <p className="text-gray-300 mt-1">{item.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparativa: Logs Raw vs Logs Analizados */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">🔍 Logs "Raw" vs Logs Analizados por SIEM</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Raw Logs - Diffícil de leer */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400">📄</span>
                <h3 className="font-semibold text-gray-400">Logs Raw (Sin SIEM)</h3>
              </div>
              <pre className="text-xs text-gray-500 font-mono overflow-x-auto max-h-48">
                {casoSeleccionado.logs_raw.slice(0, 6).join('\n')}
                {casoSeleccionado.logs_raw.length > 6 && '\n...'}
              </pre>
              <p className="text-gray-600 text-xs mt-3">
                ⚠️ Pattern de ataque no evidente
              </p>
            </div>
            
            {/* Analizados - Fácil de ver */}
            <div className="bg-gray-900 rounded-lg p-4 border-2 border-red-500">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400">📊</span>
                <h3 className="font-semibold text-green-400">Logs Analizados (Con SIEM)</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {casoSeleccionado.logs_raw.slice(0, 4).map((log, idx) => (
                  <div key={idx} className="p-2 bg-red-900/30 rounded border-l-4 border-red-500">
                    <span className="text-red-400 text-xs">ALERTA </span>
                    <span className="text-gray-400 text-xs">| Patrón sospechoso</span>
                    <div className="text-gray-500 text-xs mt-1 truncate">{log}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-green-900/50 rounded">
                <p className="text-green-400 text-sm font-bold">
                  ✅ PATRÓN DETECTADO: {casoSeleccionado.regla_deteccion}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Simulación de Detección */}
        <div className="bg-gray-800 rounded-xl p-6 border-2 border-blue-600">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">🎮 Simulador de Detección SIEM</h2>
              <p className="text-gray-400 text-sm mt-1">
                Ejecuta la simulación para ver cómo el dashboard detecta el ataque en tiempo real
              </p>
            </div>
            {logsInyectados && (
              <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-sm font-bold animate-pulse">
                🔴 Simulación Activa
              </span>
            )}
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-orange-400 mb-2">📋 Regla de Detección</h4>
            <p className="text-gray-300">{casoSeleccionado.descripcion_regla}</p>
          </div>
          
          <button
            onClick={handleSimular}
            disabled={loading}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              loading 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 hover:scale-[1.01] shadow-lg shadow-blue-500/30'
            }`}
          >
{loading ? '⏳ Ejecutando...' : '🎯 Ejecutar Simulación de Logs'}
          </button>
          
          {/* Logs Educativos + Alerta Disparada */}
          {logsInyectados && (
            <div className="space-y-6">
              {/* Panel de Logs */}
              <div className="bg-gray-800 rounded-xl p-6 border-2 border-orange-500">
                <h3 className="text-xl font-bold mb-4">📄 Logs del Caso</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Eventos registrados durante el incidente:
                </p>
                <div className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {casoSeleccionado.logs_raw.map((log, idx) => (
                    <div key={idx} className="p-2 border-b border-gray-800 last:border-0">
                      <span className="text-orange-400 font-mono text-xs">{log}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerta Disparada - Visualización del efecto */}
              <div className="bg-red-900/20 rounded-xl p-6 border-2 border-red-500 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h3 className="text-xl font-bold text-red-400">INCIDENTE DETECTADO</h3>
                    <p className="text-gray-400 text-sm">Regla de correlación activada</p>
                  </div>
                </div>
                <div className="bg-red-900/50 rounded-lg p-4 border border-red-600">
                  <p className="text-red-300 font-semibold">
                    🔴 Alerta: "{casoSeleccionado.regla_deteccion}"
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {casoSeleccionado.descripcion_regla}
                  </p>
                </div>
              </div>

              {/* Análisis Post-Incidente */}
              <div className="bg-blue-900/20 rounded-xl p-6 border-2 border-blue-500">
                <h3 className="text-xl font-bold mb-4">📊 Análisis Post-Incidente</h3>
                <p className="text-gray-300">
                  Un <strong>SIEM</strong> correlaciona estos eventos en tiempo real y genera una alerta automática cuando detecta el patrón de comportamiento anómalo. Sin monitoreo, estos logs pasan desapercibidos hasta que el daño ya está hecho.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Comparación: Sin SIEM vs Con SIEM */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">⚖️ Comparación: Escenario Real vs Con SIEM</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sin SIEM */}
            <div className="bg-red-900/30 rounded-lg p-4 border-2 border-red-600">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400 text-2xl">❌</span>
                <h3 className="font-bold text-red-400">SIN SIEM (Escenario Real)</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Tiempo de Detección</span>
                  <p className="text-xl font-bold text-red-400">{casoSeleccionado.sin_siem.tiempo_deteccion}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Impacto</span>
                  <p className="text-gray-300">{casoSeleccionado.sin_siem.impacto}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Acciones</span>
                  <p className="text-gray-400">{casoSeleccionado.sin_siem.acciones}</p>
                </div>
              </div>
            </div>
            
            {/* Con SIEM */}
            <div className="bg-green-900/30 rounded-lg p-4 border-2 border-green-600">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 text-2xl">✅</span>
                <h3 className="font-bold text-green-400">CON SIEM (Propuesto)</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Tiempo de Detección</span>
                  <p className="text-xl font-bold text-green-400">{casoSeleccionado.con_siem.tiempo_deteccion}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Impacto</span>
                  <p className="text-gray-300">{casoSeleccionado.con_siem.impacto}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Acciones</span>
                  <p className="text-gray-400">{casoSeleccionado.con_siem.acciones}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conclusión Técnica */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-6 border border-blue-500">
          <h2 className="text-xl font-bold mb-4">🎓 Conclusión Técnica</h2>
          <div className="p-4 bg-black/30 rounded-lg">
            <p className="text-lg text-gray-200 leading-relaxed">
              {casoSeleccionado.conclusion}
            </p>
          </div>
          
          {/* Badges finales */}
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="px-4 py-2 bg-green-600 rounded-full font-bold">
              ✅Detectado
            </span>
            <span className="px-4 py-2 bg-orange-600 rounded-full font-bold">
              ⚡MTTD Reducido
            </span>
            <span className="px-4 py-2 bg-blue-600 rounded-full font-bold">
              📊Correlación de Eventos
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}