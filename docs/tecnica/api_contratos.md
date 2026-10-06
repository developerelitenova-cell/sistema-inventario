# Especificación Completa de APIs y Contratos (REST)

Esta especificación documenta todos los endpoints expuestos por la API FastAPI del **Sistema de Inventario**, indicando métodos HTTP, esquemas de payload (Pydantic), respuestas, códigos de estado y niveles de autorización requeridos.

---

## 1. Convenciones Generales y Respuestas de Error

Todas las rutas privadas requieren el encabezado:
```http
Authorization: Bearer <token_de_sesion>
```

### Códigos de Estado Estándar
| Código | Significado | Causa Típica |
| :--- | :--- | :--- |
| `200 OK` | Operación exitosa | Lectura o actualización correcta. |
| `201 Created` | Recurso creado | Alta de nuevo registro. |
| `204 No Content` | Eliminación exitosa | `DELETE` completado sin cuerpo de respuesta. |
| `400 Bad Request` | Error lógico de validación | Datos inválidos, clave duplicada o activo no disponible. |
| `401 Unauthorized` | No autenticado | Token ausente, alterado o expirado. |
| `403 Forbidden` | Acceso denegado | Rol insuficiente o intento de acceso a bodega no asignada. |
| `404 Not Found` | Recurso no encontrado | ID o código inexistente. |
| `429 Too Many Requests`| Límite de tasa excedido | Superadas 10 peticiones/minuto en login o avalúo IA. |

---

## 2. Módulo de Autenticación (`/auth`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Público | Registra a un nuevo empleado con documento, foto y firma. Retorna `AuthResponse`. |
| `POST` | `/auth/login` | Público | Autentica con email y contraseña. Retorna `AuthResponse`. *(Sujeto a rate limit)* |
| `GET` | `/auth/me` | Todos | Retorna el perfil del usuario autenticado actual (`schemas.User`). |
| `POST` | `/auth/change-password` | Todos | Actualiza la contraseña personal (mínimo 8 caracteres). |
| `POST` | `/auth/logout` | Todos | Invalida y elimina el token activo de la tabla `auth_tokens`. |
| `GET` | `/ping-auth` | Público | Healthcheck para comprobar disponibilidad de la API. |

---

## 3. Módulo de Bodegas y Módulos (`/warehouses`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/warehouses/public` | Público | Lista todas las bodegas activas (usado en formulario de registro). |
| `GET` | `/warehouses/` | Todos | Lista las bodegas visibles para el usuario según su alcance. |
| `POST` | `/warehouses/` | Admin Maestro | Crea una nueva bodega (`WarehouseCreate`: `key`, `name`). |
| `PUT` | `/warehouses/{warehouse_id}` | Admin (de la bodega) | Modifica nombre o estado (`name`, `is_active`). |

---

## 4. Módulo de Usuarios y Permisos (`/users` y `/role-permissions`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/` | Admin, Encargado | Lista usuarios pertenecientes a las bodegas administradas. |
| `POST` | `/users/` | Admin | Crea un nuevo usuario y asocia bodegas (`UserCreate`). |
| `PUT` | `/users/{user_id}` | Admin | Modifica datos del usuario, rol o asignación de bodegas. |
| `POST` | `/users/{user_id}/reset-password` | Admin | Genera contraseña aleatoria e invalida sesiones activas del usuario. |
| `DELETE` | `/users/{user_id}` | Admin | Borrado seguro con limpieza en cascada de solicitudes y desenlace de préstamos. |
| `GET` | `/role-permissions/` | Todos | Consulta matriz de categorías permitidas por cada cargo laboral. |

---

## 5. Módulo de Activos (`/assets`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/assets/` | Admin, Encargado, Salida | Consulta catálogo de activos filtrable por `module`. Oculta valores financieros a no administradores. |
| `GET` | `/assets/by-code/{unique_code}` | Admin, Encargado | Busca un activo por su código QR único dentro de la bodega permitida. |
| `POST` | `/assets/` | Admin, Encargado | Registra un activo individual (`AssetCreate`). Genera QR automático. |
| `POST` | `/assets/batch-generate` | Admin, Encargado | Genera entre 1 y 500 activos en estado `pending_registration` con numeración secuencial. |
| `PUT` | `/assets/{asset_id}` | Admin, Encargado | Actualiza especificaciones, accesorios, estado y precios. |
| `POST` | `/assets/{asset_id}/photo` | Admin, Encargado | Sube fotografía de evidencia (JPEG, PNG, WEBP) a Supabase Storage. |
| `POST` | `/assets/{asset_id}/qr` | Admin, Encargado | Regenera y actualiza el código QR en Base64 del activo. |
| `GET` | `/assets/{asset_id}/depreciation` | Admin, Encargado | Calcula depreciación en línea recta y valor en libros. |
| `POST` | `/assets/estimate` | Todos | Valora un activo analizando su fotografía con **Google Gemini 1.5 Flash**. *(Rate limit: 10/min)* |
| `GET` | `/assets/verify/{unique_code}` | Admin, Encargado, Salida | Endpoint de portería para verificar estado de autorización de salida y firma del tenedor. |
| `GET` | `/assets/{asset_id}/holder` | Todos | Devuelve el custodio actual del activo (sea por préstamo o asignación fija). |
| `GET` | `/assets/availability` | Todos | Reporta cantidad de equipos disponibles y ocupados por categoría. |
| `GET` | `/assets/unused` | Todos | Lista activos disponibles sin uso por más de 180 días. |
| `DELETE` | `/assets/{asset_id}` | Admin Maestro | Elimina activo permanentemente (siempre que no esté prestado o asignado). |
| `POST` | `/assets/{asset_id}/return` | Admin, Encargado | Devolución unificada de activo (cierra préstamo o revoca asignación). |

---

## 6. Módulo de Préstamos (`/loans`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/loans/` | Todos | Lista préstamos. Empleados solo ven los propios; Encargados ven los de su bodega. |
| `GET` | `/loans/{loan_id}` | Todos (autorizados) | Detalle de un préstamo puntual. |
| `POST` | `/loans/request` | Empleado | Solicita un activo disponible en estado `pending`. |
| `POST` | `/loans/direct` | Admin, Encargado | Préstamo express directo sin solicitud previa (pasa de inmediato a `approved`). |
| `POST` | `/loans/{loan_id}/approve` | Admin, Encargado | Aprueba o rechaza una solicitud de préstamo (`LoanApproval`). |
| `POST` | `/loans/{loan_id}/accept` | Solicitante (Empleado)| El empleado confirma la recepción física del activo (`checked_out`). |
| `POST` | `/loans/{loan_id}/checkout-security`| Admin, Encargado, Salida | El personal de portería firma digitalmente y registra los accesorios entregados. |
| `POST` | `/loans/{loan_id}/checkout` | Admin, Encargado, Salida | Salida con verificación biométrica facial y de documento. |
| `POST` | `/loans/{loan_id}/return` | Admin, Encargado, Salida | Formaliza la devolución física. Si el estado es "DAÑADO", pasa el activo a `maintenance`. |

---

## 7. Módulo de Asignaciones a Largo Plazo (`/assignments`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/assignments/` | Todos | Lista asignaciones fijas activas o expiradas (filtrables por estado). |
| `POST` | `/assignments/` | Admin, Encargado | Asigna un activo a un usuario con fecha de expiración determinada. |
| `POST` | `/assignments/{assignment_id}/accept` | Asignado | El empleado confirma formalmente la recepción del equipo. |
| `POST` | `/assignments/{assignment_id}/renew` | Admin, Encargado | Extiende la fecha de expiración por N días adicionales (default 90). |
| `POST` | `/assignments/{assignment_id}/revoke` | Admin, Encargado | Revoca la asignación y devuelve el activo a estado `available`. |
| `PUT` | `/assignments/{assignment_id}` | Admin, Encargado | Modifica notas o autorización de salida de la asignación. |

---

## 8. Módulo de Solicitudes Tipo Ticket PQR (`/asset-requests`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/asset-requests/` | Todos | Crea una solicitud describiendo una necesidad sin elegir un activo puntual. |
| `GET` | `/asset-requests/mine` | Todos | Lista las solicitudes creadas por el usuario autenticado. |
| `GET` | `/asset-requests/` | Admin, Encargado | Lista solicitudes abiertas en las bodegas autorizadas. |
| `POST` | `/asset-requests/{request_id}/assign` | Admin, Encargado | Aprueba el ticket asociando un activo físico disponible, generando un `Loan` automáticamente. |
| `POST` | `/asset-requests/{request_id}/reject` | Admin, Encargado | Deniega la solicitud registrando el motivo en `review_notes`. |
| `GET` | `/asset-requests/{request_id}/comments` | Solicitante, Admin, Encargado | Obtiene el hilo de mensajes del ticket. |
| `POST` | `/asset-requests/{request_id}/comments` | Solicitante, Admin, Encargado | Publica un nuevo comentario en el hilo del ticket. |

---

## 9. Módulo de Bitácora de Auditoría (`/activity-logs`)

| Método | Endpoint | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/activity-logs/` | Todos | Consulta el historial inmutable de eventos. Los usuarios regulares solo consultan sus propias acciones; el Admin Maestro puede auditar eventos de todo el sistema. Soporta paginación (`limit`, `offset`) y filtro por `entity_type`. |
