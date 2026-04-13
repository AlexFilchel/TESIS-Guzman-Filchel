import { generateSimulator } from '../services/api';

const tiposAtaque = [
  { tipo: 'ssh_brute_force', nombre: 'SSH Brute Force', severidad: 'high', icono: '🔓' },
  { tipo: 'root_login', nombre: 'Root Login', severidad: 'critical', icono: '👤' },
  { tipo: 'sudo_abuse', nombre: 'sudo Abuse', severidad: 'medium', icono: '⚡' },
  { tipo: 'port_scan', nombre: 'Port Scan', severidad: 'medium', icono: '🔍' },
  { tipo: 'directory_scan', nombre: 'Directory Scan', severidad: 'medium', icono: '📁' },
];

const severityColors = {
  critical: 'bg-red-600 hover:bg-red-500',
  high: 'bg-orange-600 hover:bg-orange-500',
  medium: 'bg-yellow-600 hover:bg-yellow-500',
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
      <h3 className="text-lg font-semibold mb-4">🧪 Pruebas Rápidas</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {tiposAtaque.map((ataque) => (
          <button
            key={ataque.tipo}
            onClick={() => handleTest(ataque.tipo)}
            disabled={loading}
            className={`${severityColors[ataque.severidad]} disabled:opacity-50 px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors`}
          >
            <span>{ataque.icono}</span>
            <span className="truncate">{ataque.nombre}</span>
          </button>
        ))}
      </div>
      {loading && (
        <p className="text-gray-400 text-sm mt-2">Ejecutando prueba...</p>
      )}
    </div>
  );
}