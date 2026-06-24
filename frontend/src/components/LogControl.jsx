export default function LogControl({ onTrigger, loading }) {
  const niveles = [
    { id: 'info', label: 'Info', color: 'bg-blue-600 hover:bg-blue-500' },
    { id: 'warning', label: 'Warning', color: 'bg-yellow-600 hover:bg-yellow-500' },
    { id: 'critical_event', label: 'Critical', color: 'bg-red-600 hover:bg-red-500' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Disparar Log Manual</h3>
      <div className="flex gap-3">
        {niveles.map((nivel) => (
          <button
            key={nivel.id}
            onClick={() => onTrigger(nivel.id)}
            disabled={loading}
            className={`${nivel.color} disabled:opacity-50 px-4 py-2 rounded font-semibold transition-colors`}
          >
            <span>{nivel.label}</span>
          </button>
        ))}
      </div>
      {loading && (
        <p className="text-gray-400 text-sm mt-2">Generando...</p>
      )}
    </div>
  );
}