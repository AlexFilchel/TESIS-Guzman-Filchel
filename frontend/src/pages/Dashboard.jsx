import { useEffect, useState, useCallback } from 'react';
import StatsCard from '../components/StatsCard';
import AlertsChart from '../components/AlertsChart';
import SeverityPieChart from '../components/SeverityPieChart';
import AlertaCard from '../components/AlertaCard';
import AlertaModal from '../components/AlertaModal';
import AlertToast from '../components/AlertToast';
import TiemposOperativos from '../components/TiemposOperativos';
import { getMetrics, getTimeline, getAlertas, updateAlerta, getTiempos } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tiempos, setTiempos] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const { lastMessage, connected } = useWebSocket();

  const loadData = useCallback(async () => {
    try {
      const [metricsRes, timelineRes, alertasRes, tiemposRes] = await Promise.all([
        getMetrics(),
        getTimeline(7),
        getAlertas({ limit: 5 }),
        getTiempos()
      ]);
      setMetrics(metricsRes.data);
      setTimeline(timelineRes.data);
      setRecientes(alertasRes.data);
      setTiempos(tiemposRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!lastMessage) return;
    loadData();
    setToast(lastMessage);
  }, [lastMessage, loadData]);

  const handleActualizar = async (id, update) => {
    try {
      await updateAlerta(id, update);
      loadData();
      setAlertaSeleccionada(null);
    } catch (error) {
      console.error('Error actualizando alerta:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Cargando dashboard...</div>
      </div>
    );
  }

  const porSeveridad = metrics?.por_severidad || { critical: 0, high: 0, medium: 0, low: 0 };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoreo de Seguridad</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
            {connected ? 'En vivo' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard 
          title="Total Alertas" 
          value={metrics?.total || 0} 
          color="blue" 
        />
        <StatsCard
          title="Crítica"
          value={porSeveridad.critical}
          color="red"
        />
        <StatsCard
          title="Alta"
          value={porSeveridad.high}
          color="orange"
        />
        <StatsCard
          title="Media"
          value={porSeveridad.medium}
          color="yellow"
        />
        <StatsCard
          title="Baja"
          value={porSeveridad.low}
          color="green" 
        />
      </div>

      {/* Tiempos operativos (MTTD/MTTA/MTTR) */}
      <TiemposOperativos tiempos={tiempos} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertsChart data={timeline} title="Tendencia de Alertas (7 días)" />
        <SeverityPieChart data={porSeveridad} title="Distribución por Severidad" />
      </div>

      {/* Alertas Recientes */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Alertas Recientes</h2>
        </div>
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {recientes.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No hay alertas aún. ¡Ejecuta una prueba rápida!
            </div>
          ) : (
            recientes.map(alerta => (
              <AlertaCard 
                key={alerta.id} 
                alerta={alerta}
                onClick={() => setAlertaSeleccionada(alerta)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal de Detalle */}
      {alertaSeleccionada && (
        <AlertaModal 
          alerta={alertaSeleccionada} 
          onClose={() => setAlertaSeleccionada(null)}
          onActualizar={handleActualizar}
        />
      )}

      {/* Toast de notificación */}
      {toast && (
        <AlertToast 
          alerta={toast} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}