import { useParams, useNavigate } from 'react-router-dom';
import CaseDetail from '../components/CaseDetail';
import { CASOS_REALES } from '../data/casesData';

const getSeverityColor = (severidad) => {
  return severidad === 'critical' ? 'bg-red-600' : 'bg-orange-600';
};

export default function Casos() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  // Si hay un caseId en la URL, mostrar el detalle del caso
  if (caseId) {
    return <CaseDetail />;
  }

  // De lo contrario, mostrar la selección de casos
  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Casos de Estudio Reales</h1>
        <p className="text-gray-400 mt-2">
          Análisis de incidentes de seguridad donde un SIEM habría detectado o identificado limitaciones críticas
        </p>
      </div>

      {/* Tarjetas de Casos Reales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CASOS_REALES.map((caso) => (
          <div
            key={caso.id}
            className="bg-gray-800 rounded-xl p-6 border-2 border-gray-700 cursor-pointer transition-all hover:border-blue-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
            onClick={() => navigate(`/casos/${caso.id}`)}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {caso.anio} • {caso.pais}
                </span>
                <h2 className="text-xl font-bold mt-1">{caso.titulo}</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getSeverityColor(caso.severidad)} text-white`}>
                {caso.severidad.toUpperCase()}
              </span>
            </div>

            <p className="text-gray-400 text-sm line-clamp-3 mb-4">
              {caso.contexto}
            </p>

            <div className="flex justify-between items-center text-sm mt-4 pt-4 border-t border-gray-700">
              <span className="text-blue-400 font-medium">
                Ver análisis completo
              </span>
              <span className="text-gray-500">
                {caso.timeline.length} pasos
              </span>
            </div>

            {/* Badge de detección */}
            <div className="mt-3">
              <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                caso.shouldDetect
                  ? 'bg-green-900/50 text-green-300'
                  : 'bg-yellow-900/50 text-yellow-300'
              }`}>
                {caso.shouldDetect ? '✅ Detectable' : '⚠️ Indetectable'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Badge explicativo */}
      <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
        <p className="text-blue-300 text-sm">
          💡 <strong>Nota:</strong> Estos casos demuestran cómo un SIEM correlaciona eventos de múltiples fuentes para detectar ataques conocidos. 
          El caso Stuxnet ilustra las limitaciones actuales del SIEM tradicional cuando enfrenta amenazas sofisticadas contra infraestructura industrial (OT).
        </p>
      </div>
    </div>
  );
}
