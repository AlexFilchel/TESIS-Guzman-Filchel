import { useState, useEffect } from 'react';
import { getReglas, toggleRegla } from '../services/api';

const SEVERITY_STYLES = {
  critical: 'bg-red-900/40 text-red-400 border border-red-800',
  high: 'bg-orange-900/40 text-orange-400 border border-orange-800',
  medium: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  low: 'bg-green-900/40 text-green-400 border border-green-800',
};

export default function Reglas() {
  const [reglas, setReglas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const { data } = await getReglas();
      setReglas(data);
    } catch (err) {
      console.error('Error cargando reglas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    setToggling(id);
    try {
      const { data } = await toggleRegla(id);
      setReglas((prev) =>
        prev.map((r) => (r.id === id ? { ...r, habilitada: data.habilitada } : r))
      );
    } catch (err) {
      console.error('Error actualizando regla:', err);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reglas de Detección</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Patrones activos que el sistema usa para identificar actividad sospechosa
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-500">Cargando reglas...</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Patrón</th>
                <th className="px-4 py-3 text-left">Severidad</th>
                <th className="px-4 py-3 text-center">Umbral</th>
                <th className="px-4 py-3 text-center">Ventana</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((regla, idx) => (
                <tr
                  key={regla.id}
                  className={`border-b border-gray-700 last:border-0 transition-colors ${
                    idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'
                  } hover:bg-gray-700/50`}
                >
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{regla.nombre}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{regla.descripcion}</p>
                  </td>
                  <td className="px-4 py-4">
                    <code className="text-xs text-blue-300 bg-gray-900/60 px-2 py-1 rounded font-mono">
                      {regla.patron}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase ${
                        SEVERITY_STYLES[regla.severidad] || 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {regla.severidad}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-300">
                    {regla.umbral}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-300">
                    {regla.ventana_tiempo}s
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleToggle(regla.id)}
                      disabled={toggling === regla.id}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        regla.habilitada ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                      title={regla.habilitada ? 'Deshabilitar' : 'Habilitar'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          regla.habilitada ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
