import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(username, password);
      localStorage.setItem('token', data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-xl border border-gray-700 w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400 mb-2">🛡️ SIEM</h1>
          <p className="text-gray-400">Monitoreo de Seguridad</p>
        </div>
        
        {error && (
          <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-gray-400 mb-2 text-sm">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
        </div>
        
        <div className="mb-8">
          <label className="block text-gray-400 mb-2 text-sm">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-lg font-semibold transition-colors"
        >
          {loading ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>

        <p className="text-center text-gray-500 text-xs mt-4">
          Default: admin / admin123
        </p>
      </form>
    </div>
  );
}