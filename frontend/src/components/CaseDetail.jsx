import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateSimulator } from '../services/api';
import { getCaseById } from '../data/casesData';
import ComparisonTimeline from './ComparisonTimeline';

const getSeverityColor = (severidad) => {
  return severidad === 'critical' ? 'bg-red-600' : 'bg-orange-600';
};

export default function CaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const casoSeleccionado = getCaseById(caseId);

  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [logsVisibles, setLogsVisibles] = useState([]);
  const [pasoSimulacion, setPasoSimulacion] = useState(null);
  const [logsCompletos, setLogsCompletos] = useState([]);
  const [logsInyectados, setLogsInyectados] = useState(false);
  const logsContainerRef = useRef(null);

  // Resetear estado cuando cambia el caseId
  useEffect(() => {
    setLoading(false);
    setResultado(null);
    setLogsVisibles([]);
    setPasoSimulacion(null);
    setLogsCompletos([]);
    setLogsInyectados(false);
  }, [caseId]);

  // Auto-scroll cuando aparecen nuevos logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logsVisibles]);

  if (!casoSeleccionado) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-red-400">Caso no encontrado</h1>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const handleSimular = async () => {
    if (!casoSeleccionado) return;

    setLoading(true);
    setResultado(null);
    setLogsVisibles([]);
    setLogsCompletos(casoSeleccionado.logs_raw);
    setPasoSimulacion('recolectando');
    setLogsInyectados(false);

    try {
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
      } else if (casoSeleccionado.id === 'stuxnet') {
        tipo = 'industrial_malware';
        cantidad = 10;
        ip_origen = '172.16.0.50';
      }

      // Llamar al backend para inyectar logs reales
      const { data } = await generateSimulator({
        tipo,
        ip_origen,
        cantidad
      });

      // Efecto typewriter: mostrar logs uno por uno
      const totalLogs = casoSeleccionado.logs_raw.length;
      for (let i = 0; i < totalLogs; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setLogsVisibles(prev => [...prev, casoSeleccionado.logs_raw[i]]);
      }

      // Paso 2: Analizando patrones
      setPasoSimulacion('analizando');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Paso 3: Resultado basado en shouldDetect
      if (casoSeleccionado.shouldDetect) {
        // El SIEM detecta el ataque
        setPasoSimulacion('detectado');
        setLogsInyectados(true);
        setResultado({
          success: true,
          message: `Logs del caso "${casoSeleccionado.titulo}" inyectados al sistema`,
          alerta: data.alerta,
          detected: true
        });
      } else {
        // El SIEM NO detecta el ataque (Stuxnet)
        setPasoSimulacion('no_detectado');
        setLogsInyectados(true);
        setResultado({
          success: false,
          message: `Simulación completada para "${casoSeleccionado.titulo}"`,
          detected: false
        });
      }
    } catch (error) {
      setResultado({
        success: false,
        message: 'Error al simular: ' + error.message,
        detected: false
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          ← Volver a Dashboard
        </button>
      </div>

      {/* Título y Contexto */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mt-1">{casoSeleccionado.titulo}</h1>
            <p className="text-gray-400 mt-2">{casoSeleccionado.empresa}</p>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 mt-4">
          <h3 className="text-lg font-semibold text-white mb-2">Contexto del Ataque</h3>
          <p className="text-gray-300 text-base">{casoSeleccionado.contexto}</p>
        </div>

        <div className="mt-4 p-4 bg-red-900/30 rounded-lg border border-red-700">
          <h3 className="text-lg font-semibold text-white mb-2">Impacto</h3>
          <p className="text-gray-300 text-base">{casoSeleccionado.impacto}</p>
        </div>
      </div>

      {/* Timeline Visual */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4">Línea de Tiempo del Ataque</h2>

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
                  <p className="text-gray-300 mt-1 text-base">{item.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simulación de Detección */}
      <div className="bg-gray-800 rounded-xl p-6 border-2 border-blue-600">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Simulador de Detección SIEM</h2>
          </div>
          {logsInyectados && (
            <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-sm font-bold animate-pulse">
              Simulación Activa
            </span>
          )}
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <p className="text-gray-300 text-base">{casoSeleccionado.regla_deteccion}</p>
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
          {loading
            ? pasoSimulacion === 'recolectando'
              ? 'Recolectando logs...'
              : pasoSimulacion === 'analizando'
                ? 'Analizando patrones...'
                : 'Ejecutando...'
            : 'Ejecutar Simulación de Logs'}
        </button>

        {/* Logs Educativos + Resultado */}
        {(logsInyectados || (loading && logsVisibles.length > 0)) && (
          <div className="space-y-6">
            {/* Panel de Logs */}
            <div className="bg-gray-800 rounded-xl p-6 border-2 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold">Logs del Caso</h3>
                {loading && pasoSimulacion === 'recolectando' && (
                  <span className="px-2 py-1 bg-blue-600 rounded text-xs font-bold animate-pulse">
                    RECOLECTANDO
                  </span>
                )}
                {loading && pasoSimulacion === 'analizando' && (
                  <span className="px-2 py-1 bg-yellow-600 rounded text-xs font-bold animate-pulse">
                    ANALIZANDO
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-base mb-4">
                Eventos registrados durante el incidente:
              </p>
              <div
                ref={logsContainerRef}
                className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto"
              >
                {logsVisibles.map((log, idx) => (
                  <div key={idx} className="p-2 border-b border-gray-800 last:border-0">
                    <span className="text-orange-400 font-mono text-xs">{log}</span>
                  </div>
                ))}
                {loading && logsVisibles.length < logsCompletos.length && (
                  <div className="flex items-center gap-2 p-2">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-ping"></span>
                    <span className="text-orange-400 text-xs">Recibiendo más eventos...</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-gray-500 text-xs">
                  {logsVisibles.length} / {logsCompletos.length} eventos recibidos
                </span>
                <span className="text-orange-400 text-xs font-mono">
                  {loading ? 'EN VIVO' : 'COMPLETADO'}
                </span>
              </div>
            </div>

            {/* Resultado - Detectado ✅ */}
            {logsInyectados && resultado?.detected && (
              <div className="bg-red-950/50 rounded-xl p-6 border-4 border-red-600 shadow-lg shadow-red-600/50">
                <div className="flex items-center gap-3 mb-3">
                   <div>
                     <h3 className="text-2xl font-bold text-white">INCIDENTE DETECTADO</h3>
                   </div>
                 </div>
                 <div className="bg-red-900/70 rounded-lg p-4 border-2 border-red-500">
                   <p className="text-white font-semibold text-lg">
                     Alerta: "{casoSeleccionado.regla_deteccion}"
                   </p>
                  <p className="text-gray-300 text-sm mt-2">
                    {casoSeleccionado.descripcion_regla}
                  </p>
                </div>
              </div>
            )}

            {/* Resultado - NO Detectado ❌ (Stuxnet) */}
            {logsInyectados && resultado?.detected === false && (
              <div className="bg-yellow-950/50 rounded-xl p-6 border-4 border-yellow-600 shadow-lg shadow-yellow-600/50">
                <div className="flex items-center gap-3 mb-3">
                   <div>
                     <h3 className="text-2xl font-bold text-yellow-200">INCIDENTE NO DETECTADO</h3>
                     <p className="text-gray-300 text-sm">Limitaciones de visibilidad del SIEM</p>
                   </div>
                 </div>
                <div className="bg-yellow-900/70 rounded-lg p-4 border-2 border-yellow-500">
                   <p className="text-yellow-100 font-semibold text-lg">
                     El SIEM no pudo detectar este ataque debido a limitaciones de visibilidad en sistemas industriales.
                   </p>
                  <p className="text-gray-300 text-sm mt-2">
                    Este caso ilustra una limitación crítica: sin correlación IT-OT (Operational Technology) y monitoreo a nivel de PLCs (Programmable Logic Controllers), 
                    los ataques sofisticados contra infraestructura industrial pueden pasar desapercibidos.
                  </p>
                </div>

                {/* Explicación adicional para Stuxnet */}
                {casoSeleccionado.id === 'stuxnet' && (
                  <div className="mt-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h4 className="text-gray-200 font-semibold mb-2">¿Por qué falló la detección?</h4>
                    <ul className="text-gray-300 text-sm space-y-2">
                      <li>• <strong>Sin visibilidad OT:</strong> El SIEM monitorea redes IT, pero Stuxnet operaba a nivel PLC (Operational Technology)</li>
                      <li>• <strong>Ocultamiento sofisticado:</strong> El malware utilizaba rootkit para evitar detección en logs de Windows</li>
                      <li>• <strong>Comportamiento aparente normal:</strong> Los parámetros de operación parecían dentro de especificación</li>
                      <li>• <strong>Requerimiento:</strong> Se necesitaría monitoreo de comportamiento anómalo en sistemas SCADA + análisis de firmware</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparación: Sin SIEM vs Con SIEM - Timeline Visual */}
      <ComparisonTimeline caso={casoSeleccionado} />

      {/* Conclusión */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4">Conclusión</h2>
        <p className="text-lg text-gray-200 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
          {casoSeleccionado.conclusion}
        </p>
      </div>
    </div>
  );
}
