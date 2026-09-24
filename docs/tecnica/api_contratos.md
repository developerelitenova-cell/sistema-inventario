# API y Contratos del Sistema de Inventario

La API REST del backend expone los siguientes módulos, accesibles bajo la ruta raíz, protegiendo todas las interacciones con el token del usuario (`Authorization: Bearer <token>`).

## 1. Módulo `assets` (Activos)
Rutas con prefijo base `/assets`. Permiten la gestión física de los activos.

- `POST /assets/`: Registra un activo individual (requiere rol Admin o Encargado).
- `POST /assets/batch-generate`: Genera N activos de manera masiva con datos repetitivos.
- `GET /assets/`: Lista los activos, soportando filtrado por módulo, query y estado.
- `GET /assets/by-code/{unique_code}`: Busca un activo por su etiqueta (código QR).
- `GET /assets/availability`: Retorna estadísticas de disponibilidad según categoría (Dashboard).
- `GET /assets/unused`: Lista de equipos que no tienen registros de actividad en X días (KPIs).
- `PUT /assets/{asset_id}`: Modifica los datos descriptivos y técnicos de un activo.
- `POST /assets/{asset_id}/photo`: Endpoint `multipart/form-data` para adjuntar fotos de evidencia de estado.
- `GET /assets/{asset_id}/depreciation`: Calcula el valor contable y depreciación lineal del equipo.
- `POST /assets/estimate` / `/api/assets/estimate`: Estimación automática del valor del activo basada en su foto (OpenAI Vision).
- `GET /assets/verify/{unique_code}`: Verifica públicamente los datos de un activo escaneado por personal de seguridad.

## 2. Módulo `loans` (Préstamos)
Maneja las transacciones temporales o la asignación reactiva a tickets.

- `GET /loans/`: Lista préstamos.
- `POST /loans/request`: Solicita directamente en la bodega un equipo que ya ha sido seleccionado.
- `POST /loans/direct`: Asignación expedita de un activo a un usuario (Admin/Encargado bypass).
- `POST /loans/{loan_id}/approve`: El encargado aprueba un préstamo solicitado.
- `POST /loans/{loan_id}/checkout`: Entrega física del equipo en bodega.
- `POST /loans/{loan_id}/checkout-security`: El guardia de Pentágono valida la salida en portería mediante QR.
- `POST /loans/{loan_id}/return`: Devolución del equipo al finalizar el préstamo.

## 3. Módulo `requests` (Peticiones tipo PQR)
Prefijo: `/requests`. Los empleados solicitan "Necesito un mouse" sin elegir el ID concreto.

- `POST /`: Crea una solicitud de categoría.
- `GET /mine`: El empleado consulta sus solicitudes.
- `GET /`: El encargado ve todas las peticiones abiertas en su módulo.
- `POST /{request_id}/assign`: El encargado asocia un `asset_id` a la solicitud (la aprueba y despacha).
- `POST /{request_id}/reject`: Deniega la petición.
- `GET /{request_id}/comments` y `POST /{request_id}/comments`: Hilo de conversación estilo WhatsApp entre Encargado y Empleado sobre la solicitud.

## 4. Módulo `assignments` (Asignaciones Fijas)
Asignaciones laborales (computador del empleado).
- `POST /`: Crea la asignación (start, expiration).
- `POST /{assignment_id}/renew`: Renueva fecha de expiración.
- `POST /{assignment_id}/revoke`: Devuelve permanentemente el equipo.

## 5. Módulo `users` y `auth` (Seguridad y Perfiles)
- `POST /auth/login` y `POST /auth/register`.
- `GET /auth/me`: Retorna la sesión activa (`models.User`).
- `POST /auth/change-password`: Flujo de actualización.
- `GET /users/`: Gestión administrativa de empleados (rol Admin).
- `POST /users/{user_id}/reset-password`: Fuerza regeneración de clave a nivel admin.

## 6. Módulo `audit` (Bitácora inmutable)
- `GET /activity-logs/`: Histórico del sistema filtrable por `entity_type` y `actor_id`.

## Patrones de Respuesta y Error

- **Formato OK:** Todos devuelven JSON según los modelos Pydantic (`backend/schemas.py`).
- **Errores HTTP 401:** "No autenticado" (falta token o es inválido).
- **Errores HTTP 403:** "No tenés permiso para esta acción" (el `role` del JWT no concuerda con los roles permitidos en el decorador).
- **Errores HTTP 404:** Entidad no hallada.
- **Errores HTTP 400:** Fallos lógicos de negocio (ej. "El activo no está disponible para préstamo").
