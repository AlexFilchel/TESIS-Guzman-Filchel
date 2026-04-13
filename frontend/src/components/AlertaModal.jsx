export default function AlertaModal({ alerta, onClose, onActualizar }) {
  if (!alerta) return null;

  const estados = ['nueva', 'investigada', 'resuelta', 'falso_positivo'];
  
  const severidadConfig = {
    critical: { bg: 'bg-red-900', border: 'border-red-500' },
    high: { bg: 'bg-orange-900', border: 'border-orange-500' },
    medium: { bg: 'bg-yellow-900', border: 'border-yellow-500' },
    low: { bg: 'bg-green-900', border: 'border-green-500' }
  };
  
  const config = severidadConfig[alerta.severidad] || severidadConfig.low;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div 
        className={`bg-gray-800 rounded-lg max-w-2xl w-full p-6 border ${config.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Alerta #{alerta.id}</h2>
            <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${config.bg} ${config.border}`}>
              {alerta.severidad}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Categoría</p>
              <p className="font-semibold">{alerta.categoria.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Estado</p>
              <select 
                value={alerta.estado}
                onChange={(e) => onActualizar(alerta.id, { estado: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 mt-1"
              >
                {estados.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-gray-400 text-sm">IP Origen</p>
              <p className="font-mono">{alerta.ip_origen || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Host Objetivo</p>
              <p>{alerta.host_objetivo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Cantidad Eventos</p>
              <p className="font-bold">{alerta.cantidad_eventos}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Fecha</p>
              <p>{new Date(alerta.fecha).toLocaleString()}</p>
            </div>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">Descripción</p>
            <p>{alerta.descripcion}</p>
          </div>
          
          {alerta.log_crudo && (
            <div>
              <p className="text-gray-400 text-sm mb-2">Log Crudo</p>
              <pre className="bg-gray-900 p-3 rounded text-xs overflow-x-auto max-h-40">
                {alerta.log_crudo}
              </pre>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}