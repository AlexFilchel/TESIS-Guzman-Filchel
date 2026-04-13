import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const severityColors = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
};

export default function AlertsChart({ data, title = "Tendencia de Alertas" }) {
  // Procesar datos para gráfico de líneas por severidad
  const chartData = data?.reduce((acc, item) => {
    const existing = acc.find(d => d.fecha === item.fecha);
    if (existing) {
      existing[item.severidad] = (existing[item.severidad] || 0) + item.cantidad;
    } else {
      acc.push({ fecha: item.fecha, [item.severidad]: item.cantidad });
    }
    return acc;
  }, []) || [];

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          No hay datos suficientes
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={12} tickFormatter={(v) => v?.slice(5) || ''} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend />
            <Line type="monotone" dataKey="critical" stroke={severityColors.critical} strokeWidth={2} dot={{ fill: severityColors.critical }} name="Critical" />
            <Line type="monotone" dataKey="high" stroke={severityColors.high} strokeWidth={2} dot={{ fill: severityColors.high }} name="High" />
            <Line type="monotone" dataKey="medium" stroke={severityColors.medium} strokeWidth={2} dot={{ fill: severityColors.medium }} name="Medium" />
            <Line type="monotone" dataKey="low" stroke={severityColors.low} strokeWidth={2} dot={{ fill: severityColors.low }} name="Low" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}