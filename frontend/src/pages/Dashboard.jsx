import { useEffect, useState, useCallback } from 'react';
import StatsCard from '../components/StatsCard';
import AlertsChart from '../components/AlertsChart';
import SeverityPieChart from '../components/SeverityPieChart';
import AlertaCard from '../components/AlertaCard';
import AlertaModal from '../components/AlertaModal';
import AlertToast from '../components/AlertToast';
import QuickTest from '../components/QuickTest';
import { getMetrics, getTimeline, getAlertas, updateAlerta } from '../services/api';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [metricsRes, timelineRes, alertasRes] = await Promise.all([
        getMetrics(),
        getTimeline(7),
        getAlertas({ limit: 5 })
      ]);
      setMetrics(metricsRes.data);
      setTimeline(timelineRes.data);
      setRecientes(alertasRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Refrescar cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAlertaGenerada = (alerta) => {
    setToast(alerta);
    loadData(); // Recargar datos
  };

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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard 
          title="Total Alertas" 
          value={metrics?.total || 0} 
          color="blue" 
        />
        <StatsCard 
          title="Critical" 
          value={porSeveridad.critical} 
          color="red" 
        />
        <StatsCard 
          title="High" 
          value={porSeveridad.high} 
          color="orange" 
        />
        <StatsCard 
          title="Medium" 
          value={porSeveridad.medium} 
          color="yellow" 
        />
        <StatsCard 
          title="Low" 
          value={porSeveridad.low} 
          color="green" 
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertsChart data={timeline} title="Tendencia de Alertas (7 días)" />
        <SeverityPieChart data={porSeveridad} title="Distribución por Severidad" />
      </div>

      {/* Quick Test */}
      <QuickTest 
        onAlertaGenerada={handleAlertaGenerada} 
        loading={testLoading}
        setLoading={setTestLoading}
      />

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