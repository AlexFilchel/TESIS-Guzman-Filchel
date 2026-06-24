export default function ComparisonTimeline({ caso }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6">
      {/* Métricas Comparativas */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-4">Comparativa de Métricas</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-3 px-4 text-white font-semibold text-lg">Métrica</th>
                <th className="text-left py-3 px-4 text-white font-semibold text-lg">
                  <span className="text-red-400">SIN SIEM</span>
                </th>
                <th className="text-left py-3 px-4 text-white font-semibold text-lg">
                  <span className="text-green-400">CON SIEM</span>
                </th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              <tr className="border-b border-gray-700 hover:bg-gray-700/30">
                <td className="py-3 px-4 text-white text-base">MTTD (Detección)</td>
                <td className="py-3 px-4 text-white text-base">{caso.sin_siem.tiempo_deteccion}</td>
                <td className="py-3 px-4 text-white text-base">
                  {caso.con_siem?.tiempo_deteccion || caso.con_siem_tradicional?.tiempo_deteccion}
                </td>
              </tr>
              <tr className="border-b border-gray-700 hover:bg-gray-700/30">
                <td className="py-3 px-4 text-white text-base">Impacto</td>
                <td className="py-3 px-4 text-white text-base">Alto</td>
                <td className="py-3 px-4 text-white text-base">Bajo/Contenido</td>
              </tr>
              <tr className="border-b border-gray-700 hover:bg-gray-700/30">
                <td className="py-3 px-4 text-white text-base">Tipo de Respuesta</td>
                <td className="py-3 px-4 text-white text-base">Reactiva</td>
                <td className="py-3 px-4 text-white text-base">Proactiva</td>
              </tr>
              <tr className="hover:bg-gray-700/30">
                <td className="py-3 px-4 text-white text-base">Daño Final</td>
                <td className="py-3 px-4 text-white text-base">{caso.sin_siem.impacto}</td>
                <td className="py-3 px-4 text-white text-base">
                  {caso.con_siem?.impacto || caso.con_siem_tradicional?.impacto}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
