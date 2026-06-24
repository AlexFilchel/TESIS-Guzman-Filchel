import { useState, useEffect } from 'react';
import { getLogs } from '../services/api';

export default function Logs() {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await getLogs({ size: 200 });
        setAllLogs(data);
      } catch (err) {
        console.error('Error cargando logs:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const query = input.trim().toLowerCase();
  const logs = query
    ? allLogs.filter((l) => l.message.toLowerCase().includes(query))
    : allLogs;

  const handleSearch = (e) => e.preventDefault();

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const highlightMessage = (msg) => {
    if (!query) return msg;
    const parts = msg.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query
        ? <mark key={i} className="bg-yellow-400/30 text-yellow-300 rounded px-0.5">{part}</mark>
        : part
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 p-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Visor de Logs</h1>
        <p className="text-gray-400 text-sm mt-1">
          Eventos registrados en Elasticsearch — {logs.length} entradas
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Buscar en logs..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
        >
          Buscar
        </button>
        {input && (
          <button
            type="button"
            onClick={() => setInput('')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            Limpiar
          </button>
        )}
      </form>

      <div className="flex-1 overflow-y-auto bg-gray-950 rounded-lg border border-gray-800 font-mono text-xs">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">
            Cargando logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-500">
            No se encontraron entradas
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-2 w-40">Timestamp</th>
                <th className="px-4 py-2 w-48">Fuente</th>
                <th className="px-4 py-2">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
                >
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-2 text-blue-400/70 truncate max-w-0">
                    {log.source.split('/').pop() || log.source}
                  </td>
                  <td className="px-4 py-2 text-gray-300 break-all">
                    {highlightMessage(log.message)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
