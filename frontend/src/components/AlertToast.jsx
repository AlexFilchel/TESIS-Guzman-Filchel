import { useEffect, useState } from 'react';

const severidadConfig = {
  critical: { bg: 'bg-red-600', text: 'text-white', icon: '🚨' },
  high: { bg: 'bg-orange-600', text: 'text-white', icon: '⚠️' },
  medium: { bg: 'bg-yellow-600', text: 'text-white', icon: '⚡' },
  low: { bg: 'bg-green-600', text: 'text-white', icon: 'ℹ️' }
};

export default function AlertToast({ alerta, onClose }) {
  const [visible, setVisible] = useState(false);
  const config = severidadConfig[alerta?.severidad] || severidadConfig.low;

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setVisible(true), 10);

    // Auto-dismiss después de 5 segundos
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [alerta, onClose]);

  if (!alerta) return null;

  return (
    <div 
      className={`fixed top-4 right-4 z-50 max-w-md transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${config.bg} ${config.text} rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold uppercase text-sm">{alerta.severidad}</h4>
                <button 
                  onClick={() => {
                    setVisible(false);
                    setTimeout(onClose, 300);
                  }}
                  className="text-white/70 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="font-semibold mt-1">{alerta.categoria.replace('_', ' ')}</p>
              <p className="text-sm text-white/80 mt-1">{alerta.descripcion}</p>
              <div className="flex gap-4 mt-2 text-xs text-white/70">
                <span>IP: {alerta.ip_origen || 'N/A'}</span>
                <span>{new Date(alerta.fecha).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}