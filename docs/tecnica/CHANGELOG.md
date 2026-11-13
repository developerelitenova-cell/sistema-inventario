# Registro de Cambios (Changelog)

Todos los cambios notables en el **Sistema de Inventario** son documentados en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.5.0] - 2026-11-13

### Añadido
* **Informes Ejecutivos Duales (Resumido y Detallado) para Gerencia y Dirección:**
  * Modo **Informe Resumido**: Documento condensado de 1 a 2 páginas diseñado para Junta Directiva y Gerencia General, con cifras clave, distribución por tipo de inventario, bodega, categorías principales de activos, estados operativos y bloque de firmas formales.
  * Modo **Informe Detallado**: Informe exhaustivo de auditoría con la relación individual renglón por renglón de cada activo físico registrado (código, descripción, marca, tipo, categoría, ubicación, responsable, estado, costo de compra y valor estimado).
  * Selector interactivo de formato para alternar en tiempo real entre Resumido y Detallado tanto en el panel como en la vista de impresión/PDF.
* **Soberanía y Filtrado Multi-Bodega en Informes:**
  * Selector dinámico de bodega/sede en la barra superior del informe ejecutivo.
  * Adaptación automática de membrete oficial, logotipo (Futu Pro vs Elite Nova Group) y cifras consolidadas según la bodega seleccionada.
  * Restricción estricta del informe consolidado general de todas las bodegas exclusivamente para el **Administrador Maestro**; los administradores y encargados de sede quedan acotados a sus bodegas autorizadas.
* **Herramienta Administrativa de Depuración y Purga:**
  * Endpoint `POST /assets/purge-unregistered` para depurar de forma segura códigos pre-generados vacíos.
  * Botón *"Purgar no registrados"* en el panel de Contabilidad y Auditoría para administradores.

### Corregido y Optimizado
* **Purga de Activos Fantasma y Sinceramiento de Inventario:**
  * Depuración en base de datos PostgreSQL de más de 1.900 códigos pre-generados que no tenían activos físicos de la empresa asociados, eliminando datos inflados y resolviendo el cruce de información en Futuro Pro y Elite Nutrición.
  * Filtro estricto en el motor de reportes para excluir automáticamente cualquier código en estado `pending_registration` o sin datos reales de inventario.
* **Gestión de Usuarios y Cambio de Gerente / Titular:**
  * Rediseño completo de `UserEditModal` con layout optimizado, barra de acciones fija (*sticky footer*) y alertas de error visibles sin necesidad de scroll.
  * Soporte para cambiar el nombre de usuario (`username`) y asignar o generar nuevas contraseñas con alternador de visibilidad.
  * Sincronización y transferencia automática de la custodia de activos para mantener trazabilidad limpia cuando una nueva persona asume el cargo.
  * Flexibilización de validación de correos electrónicos para admitir cualquier formato corporativo válido.
* **Entrega y Asignación de Solicitudes por Código Directo:**
  * Búsqueda y llamado instantáneo de activos por código (`getAssetByCode`) en la pantalla de entrega de solicitudes (`Requests.tsx`), permitiendo asignar cualquier activo disponible en la bodega sin bloqueos por categoría estricta.

---

## [1.4.0] - 2026-09-30

### Añadido
* **Módulo de Gestión Multi-Bodega (`/warehouses`):**
  * Nueva pantalla de administración de bodegas en frontend (`frontend/src/pages/Warehouses.tsx`).
  * Endpoint `GET /warehouses/public` para carga rápida en formularios de registro.
  * Endpoint `GET /warehouses/` con filtrado dinámico según las bodegas asignadas al usuario.
  * Distinción operativa entre **Admin Maestro** (sin bodegas asignadas, ve y gestiona la totalidad del sistema) y **Admin de Bodega** (restringido a sus bodegas asignadas).
* **Guías Operativas y de Soporte:**
  * `docs/tecnica/manual_operacion_monitoreo.md`: Procedimientos de operación, healthchecks, pooling y backups.
  * `docs/tecnica/guia_troubleshooting.md`: Diagnóstico y resolución de incidencias comunes (CORS, 401, 403, 429, Gemini AI, cámara QR).
  * `docs/tecnica/inventario_documentacion_pendiente.md`: Registro de pendientes y limitaciones del sistema.
  * `docs/INDICE_MAESTRO.md`: Índice central clasificado por audiencias técnicas y operativas.

### Corregido
* **Comparación de Enums de Roles en Backend:**
  * Corrección en `backend/services/auth.py` para comparar el valor en cadena de `models.RoleEnum` contra cadenas literales o instancias del Enum, resolviendo falsos errores `403 Forbidden`.
* **Filtros por Módulo en Tareas Globales:**
  * Se removieron los filtros forzados de módulo en tareas globales para permitir la visualización consolidada a los administradores correspondientes.
* **Ruta de Eliminación de Activos:**
  * Corrección en el prefijo de la ruta de borrado en `backend/routes/assets.py` para asegurar consistencia en `DELETE /assets/{asset_id}`.
* **Tema Visual en Pase de Salida:**
  * Adaptación de la paleta de colores a tema claro en `frontend/src/pages/SecurityExitPass.tsx` para garantizar legibilidad en dispositivos móviles en portería bajo luz solar.

---

## [1.3.0] - 2026-08-15

### Añadido
* **Tasación Asistida por Inteligencia Artificial:**
  * Integración con Google Gemini 1.5 Flash (`backend/services/ai_estimator.py`) para reconocer marca, modelo, descripción y precio estimado en COP a partir de una fotografía.
  * Middleware de Rate Limiting en `backend/main.py` limitando `/assets/estimate` y `/auth/login` a 10 peticiones/minuto por IP.
* **Control de Salida y Portería (Pentágono):**
  * Módulo `SecurityExitPass.tsx` con verificación de firma digital y checklist de accesorios.
  * Verificación biométrica facial y de documento de identidad (`services/biometrics.py`).

---

## [1.2.0] - 2026-07-01

### Añadido
* **Módulo de Asignaciones Corporativas a Largo Plazo (`/assignments`):**
  * Flujo de asignación fija con actas digitales de aceptación por parte del empleado.
  * Renovación de asignaciones por 90 días adicionales y revocación con retorno automático del activo a disponible.
* **Bitácora Inmutable de Auditoría (`/activity-logs`):**
  * Registro transaccional forense en base de datos (`activity_logs`) para toda mutación de activos, préstamos y usuarios.
  * Pantalla de consulta con filtros por entidad y rango de fechas.

---

## [1.1.0] - 2026-05-20

### Añadido
* **Generación y Escaneo Masivo de Códigos QR:**
  * Creación en lote de activos en estado `pending_registration` con numeración secuencial.
  * Pantalla `QRCodes.tsx` con exportación para impresión en etiquetas físicas.
  * Escáner nativo en navegador con soporte para cámaras traseras y modo de entrada por teclado (`Scanner.tsx`).

---

## [1.0.0] - 2026-03-10

### Añadido
* **Lanzamiento Inicial del Sistema de Inventario:**
  * Arquitectura desacoplada: Frontend SPA en React 19 + Vite + Tailwind CSS; Backend en FastAPI + SQLAlchemy.
  * Base de datos PostgreSQL alojada en Supabase y almacenamiento de fotos en bucket `inventory-assets`.
  * Autenticación basada en Bearer Tokens en base de datos (`auth_tokens`) con TTL de 30 días.
  * Catálogo de activos, préstamos temporales, devoluciones y roles (`ADMIN`, `ENCARGADO`, `SALIDA`, `EMPLEADO`).
