export default function StatsCard({ title, value, color = 'blue', icon }) {
  const colors = {
    blue: 'text-white',
    red: 'text-white',
    orange: 'text-white',
    green: 'text-white',
    yellow: 'text-white',
    purple: 'text-white'
  };

  const bgColors = {
    blue: 'bg-blue-900/30 border-blue-700',
    red: 'bg-red-900/30 border-red-700',
    orange: 'bg-orange-900/30 border-orange-700',
    green: 'bg-green-900/30 border-green-700',
    yellow: 'bg-yellow-900/30 border-yellow-700',
    purple: 'bg-purple-900/30 border-purple-700'
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${bgColors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-300 text-base font-medium">{title}</p>
          <p className={`text-4xl font-bold ${colors[color]}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}