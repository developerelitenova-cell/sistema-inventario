# Guía de Pruebas Automatizadas y Calidad de Código

Este documento describe la estrategia de pruebas, la infraestructura de testeo y los procedimientos para validar la integridad del backend y frontend del **Sistema de Inventario**.

---

## 1. Estrategia General de Pruebas

El proyecto implementa una pirámide de pruebas automatizadas:
1. **Pruebas Unitarias de Lógica Pura:** Algoritmos de clasificación (`services/asset_classifier.py`), hashing y tokens (`services/auth.py`), cálculo de depreciación (`services/depreciation.py`) y generación de QR (`services/qr_generator.py`).
2. **Pruebas de Integración de Endpoints (Backend):** Pruebas de integración sobre FastAPI utilizando `TestClient` y una base de datos SQLite en memoria aislada por transacciones.
3. **Pruebas de Componentes e Interfaces (Frontend):** Pruebas de renderizado y flujos de usuario con Vitest y React Testing Library en entorno simulado JSDOM.

---

## 2. Pruebas del Backend (Pytest)

### 2.1 Infraestructura de Pruebas (`backend/tests/conftest.py`)
- **Base de Datos en Memoria:** Cada suite corre sobre `sqlite:///:memory:`.
- **Aislamiento por Transacciones:** Cada test se ejecuta dentro de una transacción (`transaction = connection.begin()`) y se revierte al finalizar (`transaction.rollback()`), asegurando que ningún test contamine el estado de otros.
- **Inyección de Dependencias:** FastAPI sustituye la dependencia de base de datos (`app.dependency_overrides[get_db] = override_get_db`).
- **Sembrado Automático:** Cada ejecución inicializa automáticamente una bodega de prueba (`key="test_module"`) y provee fixtures preconfigurados para `test_user` (rol empleado) y `admin_user` (rol admin).

### 2.2 Inventario de Archivos de Prueba
| Archivo | Objetivo de Prueba |
| :--- | :--- |
| `test_auth_service.py` | Generación segura de contraseñas, hash con Bcrypt y tokens SHA-256. |
| `test_auth.py` | Endpoints de login, registro, cambio de contraseña, me y logout. |
| `test_assets.py` | Creación de activos, unicidad de código, scoping por bodega y generación por lotes. |
| `test_loans.py` | Transiciones completas de estado: solicitud -> aprobación -> entrega -> salida -> devolución. |
| `test_assignments.py` | Asignaciones fijas, confirmación del empleado, renovación y revocación. |
| `test_asset_classifier.py`| Precisión del clasificador heurístico sobre marcas, modelos y descripciones. |
| `test_qr_generator.py` | Generación correcta del payload Base64 y formato de imagen QR. |
| `test_main.py` | Verificación de arranque, middleware CORS y ping de salud. |

### 2.3 Ejecución de Pruebas en Backend
Desde el directorio raíz o `backend/`:
```bash
# Activar entorno virtual
cd backend
source venv/bin/activate

# Ejecutar todas las pruebas
pytest

# Ejecutar con reporte detallado
pytest -v

# Ejecutar un archivo específico
pytest tests/test_loans.py

# Medir cobertura de código
pytest --cov=. --cov-report=term-missing
```

---

## 3. Pruebas del Frontend (Vitest + React Testing Library)

### 3.1 Infraestructura de Pruebas
- **Test Runner:** **Vitest** v5 configurado con plugin `@vitejs/plugin-react`.
- **Entorno:** `jsdom` para emular el DOM del navegador.
- **Linter de Código:** `oxlint` para análisis estático ultrarrápido antes de compilar.

### 3.2 Inventario de Pruebas Frontend
| Archivo | Objetivo de Prueba |
| :--- | :--- |
| `src/App.test.tsx` | Montaje inicial del enrutador y componentes raíz. |
| `src/api.test.ts` | Formateo monetario (`formatCOP`), mapeo de labels y helpers de API. |
| `src/pages/RegisterByCode.test.tsx` | Flujo de búsqueda y registro de activos pregenerados por código. |
| `src/pages/Scanner.test.tsx` | Renderizado y comportamiento de la cámara y controles del escáner. |

### 3.3 Ejecución de Pruebas en Frontend
Desde el directorio `frontend/`:
```bash
cd frontend

# Ejecutar suite de pruebas en modo interactivo/watch
npm test

# Ejecutar pruebas una sola vez con cobertura
npm run coverage

# Ejecutar linter rápido
npm run lint

# Validar tipado TypeScript sin emitir archivos
npm run build
```

---

## 4. Criterios de Aceptación para Pull Requests (Quality Gates)

Antes de fusionar cualquier cambio a la rama `main`:
1. **0 errores de compilación:** `npm run build` en frontend debe completar sin errores tipográficos (`tsc -b`).
2. **0 fallos en Pytest:** Los 10 suites de prueba del backend deben pasar al 100%.
3. **0 fallos en Vitest:** Los tests de interfaz deben ejecutarse en verde.
4. **Idempotencia de Esquema:** Si se alteran modelos en `models.py`, debe proveerse o verificarse el script de migración SQL correspondiente en `migrations/`.
