# Manual de Roles y Permisos

El Sistema de Inventario cuenta con un esquema de autorización basado en roles, diseñado para otorgar acceso estricto a las funciones que cada tipo de empleado necesita, minimizando los riesgos de errores y manipulación no autorizada del inventario.

## 1. Rol Administrador (`ADMIN`)
El rol con mayores privilegios dentro del sistema.
- **Acceso a Módulos:** Todos los módulos sin restricción.
- **Funciones Exclusivas:**
  - Crear y gestionar usuarios en el panel `Usuarios`.
  - Forzar restablecimiento de contraseñas de otros usuarios.
  - Eliminar o modificar configuraciones globales.
  - Ver todos los reportes, depreciaciones y `KPIs`.
- **Flujos Operativos:** Puede aprobar préstamos, añadir inventario y asignar activos directamente saltándose los flujos regulares.

## 2. Rol Encargado (`ENCARGADO`)
Personal de Bodega, TI o Recursos Humanos encargado de administrar directamente el inventario físico y responder a los tickets.
- **Acceso a Módulos:** Dashboard, Inventario (Añadir Activo), Préstamos, Peticiones, Asignaciones Fijas.
- **Funciones:**
  - Registrar activos nuevos y escanear códigos de barras/QR (`AddAsset`, `RegisterByCode`).
  - Recibir y gestionar Peticiones de Empleados, decidiendo si aprueban o rechazan las solicitudes.
  - Generar QRs masivamente (`QRCodes`).
  - Entregar (Checkout) los equipos en bodega a quien hizo la solicitud de préstamo.

## 3. Rol Empleado (`EMPLEADO`)
El usuario base del sistema (cualquier colaborador de la empresa).
- **Acceso a Módulos:** Mis Peticiones, Escáner QR.
- **Funciones:**
  - Crear solicitudes o "Tickets" (ej. "Necesito un cargador para Mac").
  - Chatear con el encargado en el hilo de comentarios de su petición.
  - Escanear el código QR de un activo que tiene en su poder para consultar si está asignado a su nombre o conocer el estado.
- **Restricciones:** No puede ver el inventario global, no puede aprobar préstamos, no tiene acceso a históricos de actividad.

## 4. Rol Guardia de Seguridad / Salida (`SALIDA`)
Personal de portería (ej. Pentágono). Su uso es exclusivamente para validación física en la puerta.
- **Acceso a Módulos:** Lector de Salida (`SecurityExitPass`).
- **Funciones:**
  - Escanear el código QR del equipo que un empleado lleva en las manos al salir de las instalaciones.
  - Verificar visualmente si la plataforma muestra una tarjeta verde autorizando la salida del equipo, con el nombre de la persona autorizada.
  - Confirmar la salida (checkout de seguridad).
- **Restricciones:** Es una cuenta altamente limitada diseñada para una tablet o celular en portería. No puede crear peticiones, ver el inventario ni añadir activos.

---
## 5. Matriz Resumen de Accesos (RACI)

| Función | ADMIN | ENCARGADO | EMPLEADO | SALIDA |
|---------|:---:|:---:|:---:|:---:|
| Ver Inventario Total | ✅ | ✅ | ❌ | ❌ |
| Añadir/Editar Activos | ✅ | ✅ | ❌ | ❌ |
| Solicitar Equipos (PQR) | ✅ | ✅ | ✅ | ❌ |
| Aprobar Préstamos | ✅ | ✅ | ❌ | ❌ |
| Escanear y Validar en Portería| ✅ | ❌ | ❌ | ✅ |
| Consultar KPI Contables | ✅ | ❌ | ❌ | ❌ |
| Administrar Empleados | ✅ | ❌ | ❌ | ❌ |
| Ver Bitácora (`ActivityLogs`) | ✅ | ✅ | ❌ | ❌ |
