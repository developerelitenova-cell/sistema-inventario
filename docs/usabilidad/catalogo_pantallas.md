# Catálogo de Pantallas de Interfaz (UI)

Este documento lista las pantallas principales disponibles en la aplicación y describe su uso para apoyar el soporte a usuarios.

### 1. `Dashboard.tsx` (Panel Principal)
**Descripción:** La vista de bienvenida (Home) para encargados y administradores.
- **Gráficos:** Contiene tarjetas (Cards) resumen: total de activos, en préstamo, en mantenimiento y métricas visuales clave.
- **Gestión Histórica:** Antes alojaba la pestaña "Mi Historial", la cual fue **retirada** de esta vista para simplificar la interfaz.
- **Micro-interacciones:** Los módulos horizontales (ej. categorías superiores) cuentan con un gradiente de desvanecimiento sutil y un botón pulsante (chevron) para insinuar gráficamente al usuario que "puede deslizar hacia los lados" si la pantalla es pequeña.

### 2. `Scanner.tsx` (Escáner Global Flotante)
**Descripción:** Accesible desde el Navbar o un botón flotante. Invoca la API nativa de `html5-qrcode`.
- **Comportamiento por defecto:** Bloqueado a la cámara trasera (`environment`) para evitar que el usuario se confunda viendo su propio rostro al intentar escanear un activo. 
- **Acción:** Si escanea un QR existente, navega al detalle del activo. Si escanea un QR huérfano, navega a `RegisterByCode.tsx`.

### 3. `AddAsset.tsx` / `RegisterByCode.tsx`
**Descripción:** Formularios de captura de datos técnicos de un activo.
- **Botón "Tomar Foto":** Permite al navegador activar la cámara o elegir una imagen local (Subida hacia Supabase).
- **Control de Acceso:** La UI esconde automáticamente los botones de Guardar y Editar si el rol del usuario conectado no es `ENCARGADO` ni `ADMIN`, mostrando un error 401 preventivo de "No autorizado".

### 4. `Requests.tsx` (Módulo PQR)
**Descripción:** Bandeja combinada que cambia de vista según el rol.
- Si eres `EMPLEADO`: Muestra solo las tuyas y un botón grande de "Nueva".
- Si eres `ENCARGADO`: Muestra una tabla estilo Jira Kanban con columnas (Pendiente, Aprobada, Rechazada). Se puede hacer clic en un ticket para desplegar un chat (Comentarios).

### 5. `ActivityLogs.tsx` (Historial de Auditoría)
**Descripción:** Tabla densa de solo lectura para los administradores.
- **Formato de Fecha:** Muestra todas las horas en el estándar local de Colombia (ej. "3:14 p.m.") corrigiendo confusiones históricas del servidor UTC.

### 6. `SecurityExitPass.tsx` (Portería)
**Descripción:** Interfaz minimalista diseñada explícitamente para tablets. Letra enorme, colores puros (Rojo/Verde) para el guardia. No tiene barra de navegación superior (Kiosko mode).
