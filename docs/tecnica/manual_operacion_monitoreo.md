# Manual de Operación, Monitoreo y Mantenimiento

Este manual define los procedimientos operativos estándar (SOP), directrices de monitoreo, políticas de copias de seguridad y protocolos de contingencia para la infraestructura en producción del **Sistema de Inventario**.

---

## 1. Alcance y Actores Responsables

Este documento está destinado a:
* **Operadores de Sistemas / DevOps:** Responsables del uptime, certificados TLS, pipelines y variables secretas.
* **Administradores de Base de Datos (DBA):** Responsables de la salud del esquema relacional, pooling de conexiones y copias de seguridad.
* **Soporte de Nivel 2/3:** Responsables de atender incidentes reportados por los usuarios finales.

---

## 2. Mapa de Servicios y Dependencias Operativas

| Servicio | Proveedor | Componente | Responsabilidad Operativa |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Vercel (Edge Network) | SPA React 19 + Vite | Servir activos estáticos optimizados con HTTPS global. |
| **Backend API** | Render (Web Service) | FastAPI + Uvicorn | Ejecución de lógica de negocio, rate limiting y autenticación. |
| **Base de Datos** | Supabase (AWS us-east-1) | PostgreSQL 15+ | Almacenamiento relacional transaccional (vía SQLAlchemy). |
| **Storage de Archivos** | Supabase Storage | Bucket `inventory-assets` | Fotografías de activos, evidencias y firmas digitales. |
| **IA Multimodal** | Google AI Cloud | Gemini 1.5 Flash API | Avalúo y tasación automática de equipos por imagen. |

---

## 3. Endpoints de Verificación de Salud (Healthchecks)

Para monitoreo externo automatizado (UptimeRobot, BetterUptime, Render Health Check) se deben utilizar los siguientes endpoints:

### 3.1 Healthcheck Liviano (Ping)
* **URL:** `GET /ping-auth`
* **Propósito:** Comprueba que el proceso Uvicorn esté vivo y respondiendo solicitudes HTTP sin tocar la base de datos.
* **Respuesta Esperada (`200 OK`):**
  ```json
  {
    "status": "ok"
  }
  ```

### 3.2 Healthcheck de Base de Datos y Negocio
* **URL:** `GET /warehouses/public`
* **Propósito:** Verifica que la conexión hacia el pool de PostgreSQL en Supabase esté activa y operativa.
* **Respuesta Esperada (`200 OK`):** Lista JSON con las bodegas registradas.
* **Alerta Crítica:** Código `500 Internal Server Error` o timeout superior a 5 segundos indica saturación del pool de conexiones o caída de Supabase.

### 3.3 Swagger UI Interactivo
* **URL:** `GET /docs`
* **Propósito:** Inspección manual rápida de esquemas OpenAPI y prueba de endpoints en vivo.

---

## 4. Monitoreo de Recursos y Rendimiento

### 4.1 Métricas Clave en Render
* **CPU y Memoria:** Monitorear en el panel de Render que el consumo de memoria no supere los límites del plan contratado (ej. 512 MB en tier básico). Si el proceso supera el límite, Render enviará una señal `SIGKILL` por OOM (Out Of Memory).
* **Reinicios del Servicio:** Un contador creciente de *Restarts* indica crashes de Uvicorn por excepciones no controladas o límites de RAM excedidos durante el procesamiento de imágenes Base64 pesadas.

### 4.2 Pool de Conexiones de Base de Datos
* En `backend/database.py`, la conexión está configurada con:
  ```python
  engine = create_engine(DATABASE_URL, pool_pre_ping=True)
  ```
* `pool_pre_ping=True` previene errores por sockets cerrados por inactividad (`SSL SYSCALL error: EOF detected`). Sin embargo, en planes gratuitos o Starter de Supabase, el número máximo de conexiones directas es de 60. Si se supera, se debe activar el **Connection Pooler de Supabase (PgBouncer en modo Transaction, puerto 6543)**.

### 4.3 Monitoreo de Rate Limiting
* El backend cuenta con un middleware nativo `BasicRateLimitMiddleware` en `main.py` que restringe `/auth/login` y `/assets/estimate` a un máximo de **10 peticiones por minuto por dirección IP**.
* Si un usuario legítimo reporta errores `429 Too Many Requests`, verificar si varias terminales operan tras la misma IP pública (NAT corporativo).

---

## 5. Estrategia de Copias de Seguridad (Backups)

### 5.1 Base de Datos Relacional (PostgreSQL en Supabase)
1. **Snapshots Automáticos:** Supabase realiza copias de seguridad automáticas diarias retenidas durante 7 días (planes Pro cuentan con PITR de hasta 30 días).
2. **Respaldo Manual Lógico (pg_dump):**
   Antes de aplicar migraciones estructurales o modificaciones de roles, ejecutar desde una terminal autorizada:
   ```bash
   pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
     --format=custom \
     --file="backup_inventario_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. **Restauración ante Desastres:**
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     -d "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
     "backup_inventario_YYYYMMDD_HHMMSS.dump"
   ```

### 5.2 Almacenamiento de Archivos (Supabase Storage)
* Los archivos residen en el bucket `inventory-assets`.
* Contienen las firmas de aceptación y fotografías de auditoría.
* Como política de seguridad, los nombres de archivos generados por `upload_base64_image` utilizan UUIDs y extensiones sanitizadas (`.png`, `.jpeg`, `.webp`), lo que evita colisiones de nombres o sobrescrituras accidentales.

### 5.3 Entorno de Desarrollo Local (SQLite)
* En desarrollo sin `DATABASE_URL`, el sistema crea `backend/inventory.db`.
* Para respaldarlo manualmente:
  ```bash
  sqlite3 backend/inventory.db ".backup 'backend/inventory.db.bak_$(date +%Y%m%d)'"
  ```

---

## 6. Procedimiento de Rotación de Credenciales

Si se sospecha de fuga de claves o por política periódica de seguridad (ej. cada 90 días):

1. **`DATABASE_URL`:**
   * Cambiar la contraseña del usuario `postgres` en la consola de Supabase (*Project Settings -> Database*).
   * Actualizar inmediatamente la variable `DATABASE_URL` en el panel de Render.
   * Render redeployará automáticamente el contenedor con la nueva cadena.
2. **`SUPABASE_KEY` (Service Role / Anon):**
   * Rotar la API Key en el panel de Supabase API Settings.
   * Actualizar `SUPABASE_KEY` en Render.
3. **`GEMINI_API_KEY`:**
   * Generar una nueva clave en Google AI Studio.
   * Actualizar `GEMINI_API_KEY` en Render.
4. **`APP_PASSWORD`:**
   * Generar un string aleatorio (`openssl rand -hex 16`).
   * Actualizar la variable en Render.

---

## 7. Plan de Rollback Inmediato (Marcha Atrás)

Si un despliegue en la rama `main` introduce un defecto crítico en producción:

1. **Rollback del Frontend (Vercel):**
   * Ingresar a `https://vercel.com/` -> Proyecto `sistema-inventario`.
   * Pestaña **Deployments**.
   * Ubicar el despliegue estable anterior, hacer clic en los tres puntos (`...`) y seleccionar **Promote to Production**. El cambio es instantáneo (menos de 5 segundos).
2. **Rollback del Backend (Render):**
   * Ingresar a `https://dashboard.render.com/` -> Servicio del backend.
   * Pestaña **Events** o **Deploys**.
   * Seleccionar el commit estable previo y dar clic en **Rollback to this deploy**.
3. **Rollback en Git:**
   * Para sincronizar el repositorio con el estado restaurado:
     ```bash
     git revert HEAD --no-edit
     git push origin main
     ```
