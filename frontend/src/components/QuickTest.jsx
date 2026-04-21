import { generateSimulator } from '../services/api';

const pruebasRapidas = [
  { tipo: 'critical_alert', nombre: 'Critical', severidad: 'critical', icono: '🚨' },
  { tipo: 'high_alert', nombre: 'High', severidad: 'high', icono: '⚠️' },
  { tipo: 'medium_alert', nombre: 'Medium', severidad: 'medium', icono: '⚡' },
  { tipo: 'low_alert', nombre: 'Low', severidad: 'low', icono: '📋' },
];

const severityColors = {
  critical: 'bg-red-600 hover:bg-red-500',
  high: 'bg-orange-600 hover:bg-orange-500',
  medium: 'bg-yellow-600 hover:bg-yellow-500',
  low: 'bg-green-600 hover:bg-green-500',
};

export default function QuickTest({ onAlertaGenerada, loading, setLoading }) {
  const handleTest = async (tipo) => {
    setLoading(true);
    try {
      const { data } = await generateSimulator({
        tipo,
        cantidad: tipo === 'ssh_brute_force' ? 6 : tipo === 'sudo_abuse' ? 10 : 1
      });
      if (onAlertaGenerada) {
        onAlertaGenerada(data.alerta);
      }
    } catch (error) {
      console.error('Error en prueba rápida:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Pruebas Rápidas</h3>
      
      {/* Pruebas por Severidad */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {pruebasRapidas.map((prueba) => (
          <button
            key={prueba.tipo}
            onClick={() => handleTest(prueba.tipo)}
            disabled={loading}
            className={`${severityColors[prueba.severidad]} disabled:opacity-50 px-3 py-2 rounded text-base font-medium transition-colors`}
          >
            <span>{prueba.nombre}</span>
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-gray-400 text-sm mt-2">Ejecutando prueba...</p>
      )}
    </div>
  );
}