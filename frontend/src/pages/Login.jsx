import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    // Login simple - redirige directamente al dashboard
    // (el backend no requiere autenticación para las APIs)
    navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="text-center">
        <div className="text-4xl mb-4">🛡️</div>
        <h1 className="text-2xl font-bold text-blue-400 mb-2">SIEM Dashboard</h1>
        <p className="text-gray-400">Cargando...</p>
      </div>
    </div>
  );
}