import { useState, useEffect } from 'react';
import LogControl from '../components/LogControl';
import QuickTest from '../components/QuickTest';
import AlertaCard from '../components/AlertaCard';
import AlertaModal from '../components/AlertaModal';
import AlertToast from '../components/AlertToast';
import { getSimulatorTipos, getAlertas, generateSimulator } from '../services/api';

export default function Simulador() {
  const [tipos, setTipos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
  const [filtroSeveridad, setFiltroSeveridad] = useState('');

  useEffect(() => {
    loadTipos();
    loadAlertas();
  }, []);

  const loadTipos = async () => {
    try {
      const { data } = await getSimulatorTipos();
      setTipos(data);
    } catch (error) {
      console.error('Error cargando tipos:', error);
    }
  };

  const loadAlertas = async () => {
    try {
      const params = filtroSeveridad ? { severidad: filtroSeveridad } : {};
      const { data } = await getAlertas({ ...params, limit: 20 });
      setAlertas(data);
    } catch (error) {
      console.error('Error cargando alertas:', error);
    }
  };

  useEffect(() => {
    loadAlertas();
  }, [filtroSeveridad]);

  const handleManualTrigger = async (tipo) => {
    setLoading(true);
    try {
      const { data } = await generateSimulator({ tipo, cantidad: 1 });
      setToast(data.alerta);
      loadAlertas();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertaGenerada = (alerta) => {
    setToast(alerta);
    loadAlertas();
  };

  if (!tipos.length) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-3xl font-bold">Simulador de Logs</h1>
      </div>

      {/* Panel de Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log Control */}
        <LogControl onTrigger={handleManualTrigger} loading={loading} />

        {/* Quick Test */}
        <QuickTest 
          onAlertaGenerada={handleAlertaGenerada}
          loading={loading}
          setLoading={setLoading}
        />
      </div>

      {/* Selector Personalizado */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">Simulación Personalizada</h3>
        <div className="flex flex-wrap gap-3">
          {tipos.map((tipo) => (
            <button
              key={tipo.tipo}
              onClick={() => handleManualTrigger(tipo.tipo)}
              disabled={loading}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-base font-medium flex items-center gap-2"
            >
              <span className={`w-2 h-2 rounded-full ${
                tipo.severidad === 'critical' ? 'bg-red-500' :
                tipo.severidad === 'high' ? 'bg-orange-500' :
                tipo.severidad === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
              }`}></span>
              {tipo.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Alertas Generadas */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Alertas Generadas</h2>
          <select
            value={filtroSeveridad}
            onChange={(e) => setFiltroSeveridad(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          >
            <option value="">Todas las severidades</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {alertas.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No hay alertas generadas aún
            </div>
          ) : (
            alertas.map(alerta => (
              <AlertaCard 
                key={alerta.id} 
                alerta={alerta}
                onClick={() => setAlertaSeleccionada(alerta)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {alertaSeleccionada && (
        <AlertaModal 
          alerta={alertaSeleccionada} 
          onClose={() => setAlertaSeleccionada(null)}
          onActualizar={() => {}}
        />
      )}

      {/* Toast */}
      {toast && (
        <AlertToast alerta={toast} onClose={() => setToast(null)} />
      )}
    </div>
  );
}