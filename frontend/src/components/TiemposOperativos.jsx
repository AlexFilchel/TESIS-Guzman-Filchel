function formatSegundos(valor) {
  if (valor === null || valor === undefined) return '—';
  if (valor < 60) return `${valor.toFixed(1)} s`;
  return `${(valor / 60).toFixed(1)} min`;
}

function MetricaCard({ titulo, resumen }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <p className="text-gray-300 text-base font-medium">{titulo}</p>
      <p className="text-3xl font-bold text-white">{formatSegundos(resumen?.media)}</p>
      <p className="text-gray-500 text-xs mt-1">
        {resumen ? `mediana ${formatSegundos(resumen.mediana)} · n=${resumen.n}` : 'Sin datos aún'}
      </p>
    </div>
  );
}

export default function TiemposOperativos({ tiempos }) {
  const global = tiempos?.global;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">Tiempos de Detección y Respuesta</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricaCard titulo="MTTD (detección)" resumen={global?.mttd} />
        <MetricaCard titulo="MTTA (reconocimiento)" resumen={global?.mtta} />
        <MetricaCard titulo="MTTR (resolución)" resumen={global?.mttr} />
      </div>
      <p className="text-gray-500 text-xs mt-2">
        MTTA y MTTR son tiempos automáticos entre transiciones de estado dentro del laboratorio, no tiempos de un operador humano.
      </p>
    </div>
  );
}
