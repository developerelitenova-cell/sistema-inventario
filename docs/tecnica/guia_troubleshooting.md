# Guía de Resolución de Problemas (Troubleshooting)

Esta guía recopila los síntomas comunes, causas raíz y pasos exactos de diagnóstico y remediación para incidencias operativas y de desarrollo en el **Sistema de Inventario**.

---

## 1. Problemas de Autenticación y Autorización

### 1.1 Error `401 Unauthorized` o "Sesión inválida o expirada"
* **Síntoma:** Al recargar la página o tras unos días de inactividad, el usuario es redirigido al login o la consola muestra peticiones con error `401`.
* **Causa Raíz:**
  1. Los tokens de sesión se guardan en la tabla `auth_tokens` con una expiración de 30 días (`TOKEN_TTL_DAYS = 30`).
  2. Si el token fue eliminado manualmente de la base de datos o expiró, el backend rechaza la petición.
  3. El frontend almacena el token en `localStorage`. Si el almacenamiento está corrompido, la cabecera `Authorization: Bearer <token>` viajará incompleta o nula.
* **Solución:**
  * En el frontend: cerrar sesión formalmente mediante el botón de salida y volver a iniciar sesión para generar un nuevo token criptográfico.
  * Para depurar en backend:
    ```bash
    python backend/check_user.py <email>
    ```

### 1.2 Error `403 Forbidden` o "No tenés permiso para esta acción"
* **Síntoma:** Un usuario con rol de Administrador o Encargado recibe un error 403 al intentar registrar activos o crear una bodega.
* **Causa Raíz:**
  1. **Aislamiento Multi-Bodega:** Si el usuario tiene asignada una bodega específica (ej. `elite`), no puede consultar ni mutar activos pertenecientes a `futupro`.
  2. **Admin Maestro vs Admin de Bodega:** La creación de bodegas (`POST /warehouses/`) y el borrado permanente de activos (`DELETE /assets/{id}`) son privilegios exclusivos del **Admin Maestro** (rol `ADMIN` sin ninguna bodega asociada en la tabla intermedia `user_warehouses`).
  3. **Discrepancia en Enums:** Históricamente, las comparaciones `user.role == "admin"` fallaban si `user.role` era una instancia de `RoleEnum`. Este problema fue resuelto extrayendo el `.value` del enum en `services/auth.py`.
* **Solución:**
  * Verificar en la base de datos las bodegas asignadas al usuario en la tabla `user_warehouses`.
  * Si se requiere otorgar privilegios de Admin Maestro a un usuario, desvincular todas las bodegas de su cuenta.

---

## 2. Problemas de Red y CORS

### 2.1 Error de CORS en el Navegador
* **Síntoma:** La consola del navegador muestra: `Access to XMLHttpRequest at 'https://...onrender.com' from origin 'https://...' has been blocked by CORS policy`.
* **Causa Raíz:**
  * El origen del frontend (ej. un nuevo dominio personalizado en Vercel) no está contemplado en `ALLOWED_ORIGINS` ni coincide con la expresión regular `r"https://.*\.vercel\.app"` en `backend/main.py`.
* **Solución:**
  1. Agregar el nuevo dominio a la variable de entorno `ALLOWED_ORIGINS` en el panel de Render, separado por comas:
     ```env
     ALLOWED_ORIGINS=http://localhost:5173,https://sistema-inventario-nu.vercel.app,https://mi-dominio-corporativo.com
     ```
  2. Reiniciar el servicio backend en Render.

---

## 3. Problemas de Tasación y Servicios de IA

### 3.1 Error `429 Too Many Requests` en `/assets/estimate`
* **Síntoma:** Al intentar tasar varios activos seguidos con el botón "Avaluar con IA", el sistema responde `Demasiadas peticiones. Intente más tarde.`
* **Causa Raíz:**
  * El middleware `BasicRateLimitMiddleware` en `backend/main.py` limita el endpoint a un máximo de **10 peticiones por minuto por IP** para proteger los costos y cuotas de la API de Google Gemini.
* **Solución:**
  * Esperar 60 segundos antes de realizar una nueva estimación.
  * Si se requiere subir masivamente activos con estimación, utilizar el registro en lote manual o espaciar las solicitudes.

### 3.2 Error "La API Key de Gemini no está configurada" o fallo de parsing JSON
* **Síntoma:** El modal de avalúo muestra un mensaje de error interno al procesar la fotografía.
* **Causa Raíz:**
  1. Falta la variable `GEMINI_API_KEY` en el archivo `.env` o en la consola de Render.
  2. La respuesta de Gemini incluyó formato no estructurado o texto explicativo fuera del JSON solicitado.
* **Solución:**
  * Verificar que `GEMINI_API_KEY` sea válida consultando `https://aistudio.google.com/`.
  * En `backend/services/ai_estimator.py`, el sistema implementa limpieza defensiva de bloques markdown (```json ... ```); si Gemini retorna un error de cuota (`RESOURCE_EXHAUSTED`), verificar el plan de cuota en Google Cloud Console.

---

## 4. Problemas en Frontend (Cámara y Códigos QR)

### 4.1 La cámara no inicia en el Escáner (`Scanner.tsx`)
* **Síntoma:** Pantalla negra o mensaje "No se pudo acceder a la cámara".
* **Causa Raíz:**
  1. **Contexto no Seguro (HTTP):** Los navegadores modernos bloquean la API `navigator.mediaDevices.getUserMedia` a menos que el sitio se sirva bajo `https://` o `localhost`.
  2. **Permisos Denegados:** El usuario bloqueó el acceso a la cámara en el navegador.
  3. **Dispositivo en uso:** Otra aplicación (Zoom, Meet, otra pestaña) tiene bloqueado el hardware de la cámara.
* **Solución:**
  * Asegurarse de acceder mediante HTTPS en producción.
  * Restablecer los permisos del sitio en el icono de candado de la barra de direcciones del navegador.
  * Como alternativa, utilizar la pestaña de ingreso manual por teclado o usar un lector de código de barras físico (emula entrada de teclado).

---

## 5. Problemas de Almacenamiento e Imágenes (Supabase Storage)

### 5.1 Las fotografías de activos o firmas no se guardan
* **Síntoma:** El activo se crea correctamente pero el campo `photo_url` o la firma en el pase de salida queda vacío o muestra un enlace roto.
* **Causa Raíz:**
  1. Las credenciales `SUPABASE_URL` o `SUPABASE_KEY` no están presentes en el entorno.
  2. La imagen excede el límite defensivo de 5 MB configurado en `backend/supabase_client.py` (`MAX_IMAGE_BYTES = 5 * 1024 * 1024`).
  3. El bucket `inventory-assets` no fue creado en el proyecto de Supabase o no tiene políticas de lectura pública habilitadas.
* **Solución:**
  * Verificar la existencia y permisos públicos del bucket ejecutando el script de diagnóstico:
    ```bash
    python backend/test_buckets.py
    ```
  * Si el bucket no existe, crearlo con el script utilitario:
    ```bash
    python backend/create_bucket.py
    ```

---

## 6. Diagnóstico y Reparación de Estados de Activos

Si por alguna desconexión de red o interrupción de proceso un activo queda en un estado inconsistente (ej. marcado como `loaned` pero el préstamo fue cancelado o devuelto):

1. **Inspeccionar el activo puntual:**
   ```bash
   python backend/check_asset.py <codigo_unico_o_id>
   ```
2. **Ejecutar el script de reparación de activos prestados:**
   ```bash
   python backend/fix_loaned.py
   python backend/fix_assets_status.py
   ```
   *Estos scripts analizan las relaciones en base de datos y corrigen el flag `status` regresando a `available` aquellos equipos cuyos préstamos o asignaciones ya no estén vigentes.*
