# Inventario de Documentación Pendiente y Limitaciones Conocidas

Este documento consolida las limitaciones arquitectónicas, restricciones operativas de infraestructura y puntos técnicos que se encuentran actualmente como **"pendiente de verificación"** o en hoja de ruta de mejora continua.

---

## 1. Limitaciones Técnicas y de Arquitectura Conocidas

### 1.1 Rate Limiting en Memoria Volátil
* **Estado Actual:** El middleware `BasicRateLimitMiddleware` en `backend/main.py` almacena los registros de IPs y contadores en un diccionario Python en memoria (`self.ip_records`).
* **Limitación:** Si el servicio en Render se reinicia o se escalara horizontalmente a múltiples réplicas/instancias Uvicorn, la memoria no se comparte entre procesos, reiniciando o desincronizando las cuotas por IP.
* **Recomendación Técnica:** Para entornos con balanceo multirréplica, migrar el rate limiter a un backend persistente como Redis o Upstash.

### 1.2 Estrategia de Migraciones de Base de Datos
* **Estado Actual:** Las tablas se inicializan automáticamente en el arranque mediante `models.Base.metadata.create_all(bind=engine)`. Las mutaciones estructurales previas se han gestionado mediante scripts en Python (`migrate_db.py`, `run_migration.py`, `migrate_is_accepted.py`).
* **Limitación:** No existe historial secuencial versionado bidireccional (migraciones hacia adelante y hacia atrás / rollback de esquema).
* **Recomendación Técnica:** Configurar e inicializar **Alembic** para versionar formalmente el DDL de PostgreSQL.

### 1.3 Concurrencia y Pooling en Supabase
* **Estado Actual:** `backend/database.py` se conecta directamente a PostgreSQL con `pool_pre_ping=True`.
* **Limitación:** El nivel de servicio actual en Supabase limita las conexiones directas simultáneas a 60 clientes. En picos altos de concurrencia, una ráfaga de peticiones simultáneas podría agotar el pool directo.
* **Recomendación Técnica:** En caso de superar 40 usuarios concurrentes, cambiar la cadena de conexión en `DATABASE_URL` para apuntar al puerto transaccional de PgBouncer (`6543`) provisto por Supabase.

### 1.4 Dependencia de Cuota en API Multimodal de Google Gemini
* **Estado Actual:** El servicio `ai_estimator.py` utiliza el modelo `gemini-1.5-flash` mediante la clave `GEMINI_API_KEY`.
* **Limitación:** Las cuotas del tier gratuito o Pay-as-you-go imponen límites de solicitudes por minuto (RPM) y solicitudes por día (RPD). Un uso desmedido o ráfagas de avalúos simultáneos podrían generar excepciones `429 Resource Exhausted`.
* **Mitigación Actual:** Protegido a nivel de API con rate limit de 10 peticiones/minuto por IP.

---

## 2. Inventario de Documentación y Puntos "Pendiente de Verificación"

La siguiente tabla registra los aspectos técnicos y operativos cuyo estado definitivo requiere validación adicional en campo:

| Ítem Técnico | Ubicación / Módulo | Estado | Descripción del Pendiente |
| :--- | :--- | :--- | :--- |
| **Política de Retención en Storage** | `backend/supabase_client.py` | *Pendiente de verificación* | Determinar si las fotografías de activos dados de baja y firmas de préstamos concluidos deben eliminarse del bucket `inventory-assets` tras 1 año o conservarse indefinidamente por auditoría legal. |
| **Integración con ERP / Contabilidad Externa** | `backend/services/depreciation.py` | *Pendiente de verificación* | El cálculo de depreciación en línea recta es actualmente informativo en la vista de contabilidad. Falta verificar si se requerirá exportación contable hacia software como Siigo, SAP o World Office. |
| **Pruebas Automatizadas E2E en Dispositivos Táctiles** | `frontend/src/pages/SecurityExitPass.tsx` | *Pendiente de verificación* | La captura de firma manuscrita sobre canvas táctil en portería ha sido probada manualmente en navegadores móviles, pero carece de suite automatizada con Playwright en emulación táctil. |
| **Soporte Offline PWA para Escaneo de Códigos** | `frontend/src/pages/Scanner.tsx` | *Pendiente de verificación* | Si una bodega subterránea pierde cobertura de datos móviles, el escaneo QR no puede verificar en tiempo real contra `/assets/verify/{code}`. Pendiente evaluar implementación de Service Workers para caché de lectura. |
| **Certificación de Lector de Barras Físico USB/Bluetooth** | `frontend/src/pages/Scanner.tsx` | *Pendiente de verificación* | El modo de entrada por teclado soporta lectores estándar que envían la tecla `Enter`, pero falta verificar compatibilidad con modelos industriales específicos (Zebra / Honeywell). |

---

## 3. Matriz de Cobertura Documental

| Entregable de Documentación | Archivo Fuente | Estado de Cobertura |
| :--- | :--- | :--- |
| **README Principal** | `README.md` | 100% Completo y Actualizado |
| **Guía de Instalación y Configuración** | `docs/instalacion_configuracion.md` | 100% Completo y Actualizado |
| **Arquitectura Global** | `docs/tecnica/arquitectura.md` | 100% Completo |
| **Arquitectura Backend** | `docs/tecnica/arquitectura_backend.md` | 100% Completo |
| **Arquitectura Frontend** | `docs/tecnica/arquitectura_frontend.md` | 100% Completo |
| **Registro de Decisiones (ADR)** | `docs/tecnica/decisiones_arquitectura_adr.md`| 100% Completo |
| **Especificación de APIs y Contratos** | `docs/tecnica/api_contratos.md` | 100% Completo |
| **Diccionario del Modelo de Datos** | `docs/modelo_datos.md` | 100% Completo |
| **Guía para Desarrolladores** | `docs/tecnica/README_devs.md` | 100% Completo |
| **Guía de Pruebas y Calidad** | `docs/tecnica/guia_pruebas.md` | 100% Completo |
| **Despliegue y Entorno** | `docs/tecnica/despliegue_y_entorno.md` | 100% Completo |
| **Manual de Operación y Monitoreo** | `docs/tecnica/manual_operacion_monitoreo.md` | 100% Completo |
| **Guía de Troubleshooting** | `docs/tecnica/guia_troubleshooting.md` | 100% Completo |
| **Historial de Versiones (Changelog)** | `docs/tecnica/CHANGELOG.md` | 100% Completo |
| **Inventario de Pendientes y Limitaciones** | `docs/tecnica/inventario_documentacion_pendiente.md`| 100% Completo |
| **Índice Maestro del Sistema** | `docs/INDICE_MAESTRO.md` | 100% Completo |
