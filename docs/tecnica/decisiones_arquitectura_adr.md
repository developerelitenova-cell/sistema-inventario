# Registro de Decisiones Arquitectónicas (ADRs)

Este documento recopila las decisiones de diseño arquitectónico tomadas durante el desarrollo del **Sistema de Inventario**, su justificación técnica basada en el código y sus implicaciones.

---

## ADR-001: Autenticación Basada en Tokens en Base de Datos (`auth_tokens`) vs JWT Stateless

- **Estado:** Aceptado e Implementado
- **Ubicación en Código:** `backend/services/auth.py`, `backend/models.py` (`AuthToken`), `backend/routes/auth.py`
- **Contexto:**
  Tradicionalmente se utiliza JWT (JSON Web Tokens) sin estado para autenticar SPAs. No obstante, en un sistema de inventario corporativo, la revocación inmediata de credenciales (por despido de personal, pérdida de equipo o reseteo forzoso de clave) es prioritaria frente a la escalabilidad horizontal masiva.
- **Decisión:**
  Generar tokens aleatorios criptográficamente seguros (`secrets.token_urlsafe(32)`), almacenar su hash SHA-256 en la tabla `auth_tokens` y validar contra la base de datos en cada llamada (`get_current_user`).
- **Consecuencias:**
  - *Positivas:* Revocación instantánea en `/auth/logout` o `/users/{id}/reset-password`; no requiere listas negras de tokens en Redis; control exacto de sesiones abiertas.
  - *Negativas:* Requiere una consulta SQL de lectura por cada petición autenticada (mitigado por índice único sobre `token`).

---

## ADR-002: Almacenamiento Centralizado de Timestamps en UTC (`time_util.py`)

- **Estado:** Aceptado e Implementado
- **Ubicación en Código:** `backend/time_util.py`, `backend/models.py`
- **Contexto:**
  Inicialmente se guardaba hora local colombiana directamente en el motor de base de datos sin información de zona horaria, lo que causaba desfases al migrar entre servidores en Render (configurados por defecto en UTC) y clientes web locales.
- **Decisión:**
  `get_colombia_time()` fue refactorizado para devolver consistentemente `datetime.now(timezone.utc)`. La persistencia en PostgreSQL / SQLite almacena instantes UTC unificados ('Z') y la capa de presentación (Frontend) formatea a la zona horaria del usuario (`America/Bogota`).
- **Consecuencias:**
  - *Positivas:* Compatibilidad estándar con ISO-8601; elimina ambigüedades en auditorías forenses y cálculos de depreciación.

---

## ADR-003: Control de Acceso Híbrido: RBAC + Aislamiento por Bodega (Scoping)

- **Estado:** Aceptado e Implementado
- **Ubicación en Código:** `backend/services/auth.py` (`visible_warehouse_keys`, `can_access_warehouse`, `is_master_admin`), `backend/routes/warehouses.py`
- **Contexto:**
  La organización opera múltiples sedes y bodegas físicas (ej. Elite Nutrition vs Futuro Pro). Un encargado de una sede no debe ver ni aprobar préstamos de otra sede.
- **Decisión:**
  Implementar un esquema de doble filtro:
  1. Nivel de permiso jerárquico por rol (`RoleEnum`: ADMIN, ENCARGADO, SALIDA, EMPLEADO).
  2. Alcance geográfico/organizacional (`user_warehouses`).
  3. Definición de **Admin Maestro**: Un admin sin bodegas asociadas tiene alcance omnímodo (`visible_warehouse_keys` devuelve `None`). Si un admin tiene bodegas asignadas, sus facultades quedan estrictamente acotadas a esas bodegas.
- **Consecuencias:**
  - *Positivas:* Soporte multi-sede sin requerir bases de datos separadas (multitenancy lógico limpio).

---

## ADR-004: Bitácora Inmutable en la Misma Transacción (`activity_logs`)

- **Estado:** Aceptado e Implementado
- **Ubicación en Código:** `backend/services/audit.py`, `backend/routes/*.py`
- **Contexto:**
  Para auditoría interna y prevención de pérdidas de activos, toda operación de mutación (creación, edición, préstamo, devolución, reseteo de claves) debe quedar registrada inmutablemente.
- **Decisión:**
  La función `audit.log_action()` recibe la misma sesión `db` de SQLAlchemy que la operación de negocio, ejecutándose antes del `db.commit()`.
- **Consecuencias:**
  - *Positivas:* Atomicidad garantizada: si la operación falla, el log no se inserta; si la operación tiene éxito, el log siempre queda persistido.

---

## ADR-005: Avalúo Asistido por Inteligencia Artificial Multimodal (Google Gemini 1.5 Flash)

- **Estado:** Aceptado e Implementado
- **Ubicación en Código:** `backend/services/ai_estimator.py`, `backend/routes/assets.py` (`/assets/estimate`)
- **Contexto:**
  El personal operativo de bodega que ingresa nuevos activos a menudo desconoce la marca exacta, especificación técnica o precio aproximado de mercado para depreciación.
- **Decisión:**
  Integrar el modelo `gemini-1.5-flash` a través del SDK `google.generativeai`. La imagen se comprime previamente con Pillow a un tamaño óptimo (1024x1024) y el modelo responde exclusivamente un esquema JSON con descripción sugerida, marca/modelo y precio de referencia estimado en pesos colombianos (COP).
- **Consecuencias:**
  - *Positivas:* Aceleración drástica del registro de inventario y estimación de valor contable.
  - *Mitigaciones:* Protegido con middleware de Rate Limiting (10 peticiones/minuto por IP) para evitar sobrecostos de cuota.

---

## ADR-006: Desacoplamiento entre Préstamos (`Loan`) y Asignaciones Fijas (`AssetAssignment`)

- **Estado:** Aceptado e Implementado
- **Ubicación en Código:** `backend/models.py`, `backend/routes/loans.py`, `backend/routes/assignments.py`
- **Contexto:**
  Un préstamo puntual (ej. una cámara para una sesión de fotos de 3 días) tiene un ciclo transaccional con entrega, salida por portería y retorno. Por el contrario, un equipo de dotación laboral (ej. laptop del contador) no se entrega y devuelve diariamente, sino que tiene vigencia semestral o anual y requiere firmas de aceptación y renovaciones periódicas.
- **Decisión:**
  Separar conceptual y tabularmente ambas entidades: `Loan` modela el ciclo dinámico de uso temporal, mientras que `AssetAssignment` modela la tenencia laboral con fecha de caducidad (`expiration_date`) y confirmación formal (`is_accepted`).
- **Consecuencias:**
  - *Positivas:* Claridad operativa total en los formularios del frontend y en los reportes contables.
