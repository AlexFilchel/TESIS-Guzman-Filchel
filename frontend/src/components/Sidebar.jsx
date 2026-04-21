import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const mainNavItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/simulador', label: 'Simulador', icon: '🧪' },
];

const caseItems = [
  { path: '/casos/renaper', label: 'Caso A: RENAPER', id: 'renaper' },
  { path: '/casos/equifax', label: 'Caso B: Equifax', id: 'equifax' },
  { path: '/casos/stuxnet', label: 'Caso C: Stuxnet', id: 'stuxnet' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [casesExpanded, setCasesExpanded] = useState(false);
  const location = useLocation();

  // Detectar si estamos en una página de casos
  const isInCases = location.pathname.startsWith('/casos');
  const currentCaseId = location.pathname.split('/').pop();

  return (
    <aside 
      className={`bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-52'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center border-b border-gray-700">
        {!collapsed && (
          <Link to="/" className="text-xl font-bold text-blue-400">
            🛡️ SIEM
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {/* Main items */}
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setCasesExpanded(false)}
              className={`flex items-center gap-3 px-4 py-3 transition-colors text-base font-medium ${
                isActive 
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400' 
                  : 'text-white hover:bg-gray-700'
              }`}
            >
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Cases Dropdown */}
        <div className="mt-2">
          <button
            onClick={() => setCasesExpanded(!casesExpanded)}
            className={`flex items-center gap-3 w-full px-4 py-3 transition-colors text-base font-medium ${
              isInCases
                ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400'
                : 'text-white hover:bg-gray-700'
            }`}
          >
            {!collapsed && (
              <>
                <span>Casos</span>
                <span className={`ml-auto text-xs transition-transform ${casesExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </>
            )}
          </button>

          {/* Submenu */}
          {casesExpanded && !collapsed && (
            <div className="bg-gray-700/30 border-l-2 border-gray-600">
              {caseItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                     key={item.path}
                     to={item.path}
                     className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${
                       isActive
                         ? 'bg-blue-600/40 text-blue-300 border-r-2 border-blue-400'
                         : 'text-white hover:bg-gray-600'
                     }`}
                   >
                     <span>{item.label}</span>
                   </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        {!collapsed && (
          <p className="text-xs text-gray-500">v1.0.0</p>
        )}
      </div>
    </aside>
  );
}