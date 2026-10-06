# Arquitectura Interna del Código Backend (FastAPI)

Este documento detalla la estructura, organización y componentes internos del backend del **Sistema de Inventario**, construido con Python 3 y FastAPI.

---

## 1. Estructura de Directorios del Backend

```
backend/
├── main.py                   # Punto de entrada ASGI, middlewares, registro de routers
├── database.py               # Configuración del engine SQLAlchemy y generador de sesiones
├── models.py                 # Definición declarativa de modelos de base de datos y Enums
├── schemas.py                # Modelos Pydantic v2 para validación, serialización y contratos
├── time_util.py              # Manejo centralizado de timestamps en UTC
├── supabase_client.py        # Adaptador para subida y almacenamiento de imágenes y firmas
│
├── routes/                   # Routers modulares por dominio de negocio
│   ├── __init__.py           # Exportación unificada de routers
│   ├── auth.py               # Registro, login, cambio de clave, sesión actual (/auth)
│   ├── users.py              # CRUD de usuarios, reseteo de claves, permisos por cargo (/users)
│   ├── warehouses.py         # Gestión de bodegas y módulos (/warehouses)
│   ├── assets.py             # CRUD de activos, generación masiva de QR, avalúo con IA (/assets)
│   ├── loans.py              # Ciclo de préstamos, entregas, salidas y devoluciones (/loans)
│   ├── assignments.py        # Asignaciones fijas de activos a largo plazo (/assignments)
│   ├── requests.py           # Solicitudes tipo ticket PQR y comentarios (/asset-requests)
│   └── audit.py              # Consulta de bitácora inmutable de auditoría (/activity-logs)
│
├── services/                 # Capa de lógica de negocio y servicios auxiliares
│   ├── auth.py               # Hash de claves, generación/validación de AuthTokens, RBAC
│   ├── ai_estimator.py       # Estimación de valor mediante Google Gemini 1.5 Flash
│   ├── asset_classifier.py   # Clasificador heurístico de categorías por palabras clave
│   ├── depreciation.py       # Algoritmo de depreciación en línea recta por vida útil
│   ├── qr_generator.py       # Generador de códigos QR en formato Base64 PNG
│   ├── biometrics.py         # Interfaz para verificación biométrica facial y de documento
│   └── audit.py              # Función transaccional para registro en bitácora de auditoría
│
└── tests/                    # Suite de pruebas automatizadas con Pytest
    ├── conftest.py           # Fixtures de BD en memoria SQLite y TestClient
    ├── test_auth.py          # Pruebas de endpoints de autenticación
    ├── test_auth_service.py  # Pruebas unitarias de funciones criptográficas
    ├── test_assets.py        # Pruebas de ciclo de vida de activos
    ├── test_loans.py         # Pruebas de máquinas de estado de préstamos
    ├── test_assignments.py    # Pruebas de asignaciones y renovaciones
    ├── test_asset_classifier.py # Pruebas del clasificador heurístico
    └── test_qr_generator.py  # Pruebas de generación de QR
```

---

## 2. Ciclo de Vida de la Aplicación y Middlewares (`main.py`)

### 2.1 Inicialización
- **Creación de Tablas:** `models.Base.metadata.create_all(bind=engine)` se ejecuta en el arranque para garantizar que todas las tablas y relaciones existan en el motor configurado.
- **Configuración CORS:** Implementa `CORSMiddleware` con soporte para dominios locales (`localhost:5173`, `localhost:3000`), dominios en producción de Vercel y una expresión regular dinámica (`r"https://.*\.vercel\.app"`) para soportar vistas previas de despliegue.

### 2.2 Middleware de Control de Tasa (`BasicRateLimitMiddleware`)
Implementado mediante Starlette `BaseHTTPMiddleware`:
- **Objetivo:** Mitigar ataques de fuerza bruta y abusos de consumo en endpoints críticos:
  - `/auth/login`
  - `/assets/estimate` y `/api/assets/estimate`
- **Mecanismo:** Mantiene un registro en memoria de IPs con ventana de tiempo rodante de 60 segundos. Si una IP supera las 10 peticiones en 1 minuto, el middleware intercepta la llamada y responde inmediatamente con código `HTTP 429 Too Many Requests`.

---

## 3. Modelo de Seguridad y Autorización (`services/auth.py`)

### 3.1 Tokens de Sesión en Base de Datos (Estrategia sin JWT)
A diferencia de un token JWT autofirmado y sin estado, el sistema utiliza tokens opacos almacenados en la tabla `auth_tokens`:
1. Al autenticarse satisfactoriamente, se genera un token aleatorio con `secrets.token_urlsafe(32)`.
2. Se computa el hash SHA-256 del token (`hashlib.sha256(token.encode()).hexdigest()`).
3. El hash se persiste en `auth_tokens` junto con el `user_id` y una expiración (`expires_at`) calculada a 30 días (`TOKEN_TTL_DAYS = 30`).
4. El cliente recibe el token en texto plano y lo envía en el encabezado `Authorization: Bearer <token>`.
5. En cada petición, la dependencia `get_current_user` hashea el token recibido y hace un lookup directo en la base de datos.
- **Ventaja de diseño:** Permite revocación instantánea (logout o cambio de contraseña purga los registros en BD) y evita problemas de sincronización de claves secretas.

### 3.2 Hashing de Contraseñas
- Utiliza **Bcrypt** (`bcrypt.hashpw` con salt dinámico generado mediante `bcrypt.gensalt()`).
- La verificación se realiza con `bcrypt.checkpw` capturando excepciones de valor.

### 3.3 Control de Acceso Basado en Roles (RBAC)
La función de orden superior `require_role(*roles: RoleEnum)` valida que el usuario autenticado posea uno de los roles permitidos:
- `RoleEnum.ADMIN`: Acceso total o acotado a bodega.
- `RoleEnum.ENCARGADO`: Gestión de activos, préstamos y aprobaciones de su bodega.
- `RoleEnum.SALIDA`: Validación en portería/seguridad (Pentágono) y firma de actas de salida.
- `RoleEnum.EMPLEADO`: Consulta de activos propios, peticiones de equipos y recepción física.

### 3.4 Scoping por Bodegas (Aislamiento Multi-Bodega)
El sistema implementa un modelo de tenencia compartida basado en bodegas (`warehouses`):
- **Admin Maestro:** Usuario con rol `ADMIN` que no tiene registros en la tabla `user_warehouses`. Tiene alcance global (`visible_warehouse_keys` retorna `None`).
- **Admin Acotado / Encargado:** Usuario asignado a una o más bodegas específicas. Solo puede listar, editar o aprobar elementos pertenecientes a sus bodegas (`module.in_(allowed)`).
- **Funciones de control:**
  - `visible_warehouse_keys(user)`: Retorna la lista de slugs de bodega accesibles o `None`.
  - `can_access_warehouse(user, warehouse_key)`: Validación booleana puntual por entidad.
  - `require_master_admin()`: Dependencia para operaciones exclusivas (ej. crear bodegas o eliminar activos).

---

## 4. Servicios de Negocio (`services/`)

### 4.1 Estimación de Valor con Inteligencia Artificial (`services/ai_estimator.py`)
- **Proveedor:** Google Generative AI (`google.generativeai`).
- **Modelo:** `gemini-1.5-flash`.
- **Flujo:**
  1. Recibe la imagen en formato Data URI Base64.
  2. Decodifica y redimensiona la imagen a un máximo de 1024x1024 píxeles mediante Pillow para optimizar latencia y costos.
  3. Ejecuta un prompt multimodal especializado en avalúo de activos de oficina y tecnología en pesos colombianos (COP).
  4. Extrae y valida el JSON devuelto con `description`, `brand_model` y `estimated_price_cop`.

### 4.2 Clasificación Heurística de Activos (`services/asset_classifier.py`)
- Infiere la categoría (`CategoryEnum`) de un activo a partir de su `description` y `brand_model`.
- **Estrategia:** Normalización Unicode (eliminación de tildes y diacríticos) y coincidencia ordenada de expresiones clave para prevenir falsos positivos (por ejemplo, clasificar un "cable HDMI de cámara" en `CABLES` antes de evaluar `CAMARAS`).

### 4.3 Depreciación en Línea Recta (`services/depreciation.py`)
- Calcula el valor en libros (`book_value`) y la depreciación acumulada.
- Utiliza la tabla de vida útil reglamentaria:
  - Computadores: 3 años
  - Celulares: 2 años
  - Tablets: 3 años
  - Cámaras, Micrófonos, Audio, Impresoras, Proyectores, Teléfono: 5 años
  - Trípodes: 8 años
  - Cables: 3 años
  - Otros: 5 años
- Solo se calcula cuando el activo cuenta con `purchase_price` y `purchase_date`.

### 4.4 Generador de Códigos QR (`services/qr_generator.py`)
- Genera una imagen QR codificando el identificador único del activo (`unique_code`).
- Retorna una cadena Base64 lista para ser renderizada en clientes web o almacenada en el campo `qr_data` de la tabla `assets`.

### 4.5 Almacenamiento en la Nube (`supabase_client.py`)
- Encapsula la comunicación con **Supabase Storage**.
- Soporta subida a buckets públicos (`inventory-assets`) para fotos de equipos y usuarios, y gestión de firmas digitales con rutas seguras.

### 4.6 Bitácora Inmutable de Auditoría (`services/audit.py`)
- Expone `log_action(db, actor, action, description, entity_type, entity_id)`.
- Crea una fila en `activity_logs` ligada a la misma sesión transaccional de base de datos, garantizando atomicidad entre la mutación del recurso y su registro en la bitácora.

---

## 5. Manejo de Tiempos y Fechas (`time_util.py`)

- Todas las marcas de tiempo en el servidor (`created_at`, `request_date`, `expiration_date`, etc.) se registran en **UTC** mediante `datetime.now(timezone.utc)`.
- La conversión a la hora local de Bogotá/Colombia (`America/Bogota`, UTC-5) se delega a la capa de presentación del cliente (Frontend) mediante el formateo estándar del navegador.
