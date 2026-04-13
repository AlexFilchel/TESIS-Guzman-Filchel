import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Simulador from './pages/Simulador';
import Casos from './pages/Casos';

function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login disponible pero no requerido */}
        <Route path="/login" element={<Login />} />
        
        {/* Dashboard accesible directamente (sin login) */}
        <Route 
          path="/" 
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          } 
        />
        
        <Route 
          path="/simulador" 
          element={
            <AppLayout>
              <Simulador />
            </AppLayout>
          } 
        />
        
        <Route 
          path="/casos" 
          element={
            <AppLayout>
              <Casos />
            </AppLayout>
          } 
        />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}