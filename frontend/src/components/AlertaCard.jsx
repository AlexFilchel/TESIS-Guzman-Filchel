const severidadConfig = {
  critical: { bg: 'bg-red-900/50', border: 'border-red-500', text: 'text-red-400', label: 'CRITICAL' },
  high: { bg: 'bg-orange-900/50', border: 'border-orange-500', text: 'text-orange-400', label: 'HIGH' },
  medium: { bg: 'bg-yellow-900/50', border: 'border-yellow-500', text: 'text-yellow-400', label: 'MEDIUM' },
  low: { bg: 'bg-green-900/50', border: 'border-green-500', text: 'text-green-400', label: 'LOW' }
};

export default function AlertaCard({ alerta, onClick }) {
  const config = severidadConfig[alerta.severidad] || severidadConfig.low;

  return (
    <div 
      onClick={onClick}
      className={`p-4 border-l-4 rounded cursor-pointer hover:bg-gray-800/80 transition ${config.bg} ${config.border}`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${config.bg} ${config.text} border`}>
              {config.label}
            </span>
            <span className="text-gray-500 text-xs">{alerta.categoria.replace('_', ' ')}</span>
          </div>
          <h3 className="font-semibold text-white truncate">{alerta.descripcion}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {alerta.ip_origen || 'Sin IP'} • {alerta.cantidad_eventos} eventos
          </p>
        </div>
        <div className="text-right text-xs text-gray-500 whitespace-nowrap">
          <p>{new Date(alerta.fecha).toLocaleDateString()}</p>
          <p>{new Date(alerta.fecha).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}