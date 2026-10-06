# Sistema de Inventario - Elite Nutrition / FutuPro

Plataforma web integral para la administración, valorización, seguimiento y trazabilidad del ciclo de vida de activos físicos corporativos, préstamos temporales, asignaciones fijas y control de bodegas operativas.

---

## 1. Propósito y Alcance del Sistema

El **Sistema de Inventario** unifica el control de equipos tecnológicos, material publicitario y mobiliario de las sedes de Elite Nutrition y Futuro Pro. Proporciona:
- **Gestión Multi-Bodega:** Aislamiento operativo entre módulos físicos (`elite`, `futupro`, etc.) con control de acceso por roles y bodegas.
- **Ciclo Transaccional de Préstamos:** Solicitud, aprobación por encargados, firma manuscrita de salida en portería (Pentágono) y retorno con verificación de estado.
- **Asignaciones Fijas Corporativas:** Control de dotación laboral con actas de aceptación digital y renovación programada.
- **Auditoría e Identificación QR:** Escaneo nativo con cámara y generación masiva de etiquetas QR para auditorías rápidas de inventario.
- **Avalúo con Inteligencia Artificial:** Reconocimiento de equipos y estimación de valor de mercado en pesos colombianos mediante **Google Gemini 1.5 Flash**.
- **Trazabilidad Inmutable:** Bitácora forense de eventos en base de datos para todas las operaciones críticas.

---

## 2. Pila Tecnológica

| Componente | Tecnología | Versión / Detalle |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | React 19, TypeScript 5+, Vite 8, React Router v7 |
| **Diseño / UI** | Tailwind CSS, Lucide Icons, Three.js | Micro-animaciones, canvas 3D y componentes responsivos |
| **Backend** | Python, FastAPI, Uvicorn | Python 3.10+, FastAPI modular con Pydantic v2 |
| **ORM / Datos** | SQLAlchemy, SQLite / PostgreSQL | Modelado declarativo con migraciones SQL y timestamps UTC |
| **Almacenamiento** | Supabase Storage | Bucket `inventory-assets` para fotografías y firmas digitales |
| **IA Multimodal** | Google Generative AI | Modelo `gemini-1.5-flash` para estimación de activos |
| **Testing** | Pytest, Vitest, Testing Library | Pruebas de integración, unitarias y de componentes |
| **Infraestructura**| Render & Vercel | Despliegue continuo automatizado en la rama `main` |

---

## 3. Índice Maestro de Documentación Técnica

Consulte el **[Índice Maestro Central](docs/INDICE_MAESTRO.md)** para una navegación clasificada por rol y perfil (Desarrolladores, Operadores, Administradores, Usuarios y Auditores).

### 3.1 Arquitectura y Código
* [Arquitectura Global del Sistema](docs/tecnica/arquitectura.md): Diagrama C4 de alto nivel, flujo cliente-servidor y consideraciones de seguridad.
* [Arquitectura Interna del Backend](docs/tecnica/arquitectura_backend.md): Estructura de routers, middleware de rate limiting, servicios de IA, clasificadores y autenticación por tokens en BD.
* [Arquitectura Interna del Frontend](docs/tecnica/arquitectura_frontend.md): Gestión de estado con React Contexts, enrutador, modales interactivos, escáner QR y capa de API.
* [Registro de Decisiones Arquitectónicas (ADRs)](docs/tecnica/decisiones_arquitectura_adr.md): Documentación de los ADRs (Tokens en BD vs JWT, Timestamps UTC, Scoping de Bodega, etc.).
* [Historial de Versiones (Changelog)](docs/tecnica/CHANGELOG.md): Registro estructurado de versiones y cambios del sistema.

### 3.2 APIs y Modelo de Datos
* [Especificación Completa de APIs y Contratos](docs/tecnica/api_contratos.md): Catálogo detallado de endpoints REST, esquemas de entrada/salida, códigos HTTP y roles.
* [Diccionario del Modelo de Datos Relacional](docs/modelo_datos.md): Diagrama ERD detallado, tablas, campos, llaves foráneas, enums y restricciones.

### 3.3 Guías de Ingeniería y Desarrollo
* [Guía para Desarrolladores](docs/tecnica/README_devs.md): Configuración de entorno local, estándares de código y convenciones de Pull Request.
* [Guía de Pruebas Automatizadas y Calidad](docs/tecnica/guia_pruebas.md): Ejecución de suites en Pytest (backend) y Vitest (frontend), fixtures en memoria y quality gates.
* [Guía de Instalación y Configuración](docs/instalacion_configuracion.md): Dependencias de sistema y variables de entorno (`.env`).

### 3.4 Operación, Soporte y Auditoría
* [Despliegue y Entorno](docs/tecnica/despliegue_y_entorno.md): Pipeline CI/CD en Vercel y Render, configuración de producción y variables secretas.
* [Manual de Operación y Monitoreo](docs/tecnica/manual_operacion_monitoreo.md): Procedimientos operativos, healthchecks, pooling, backups con `pg_dump` y planes de rollback.
* [Guía de Troubleshooting](docs/tecnica/guia_troubleshooting.md): Diagnóstico paso a paso para incidencias de CORS, 401/403/429, Gemini AI, cámara QR y reparación de estados.
* [Inventario de Pendientes y Limitaciones](docs/tecnica/inventario_documentacion_pendiente.md): Limitaciones técnicas y registro de puntos pendientes de verificación.
* [Flujos de Desarrollo (SDLC) y RACI](docs/flujos/SDLC.md): Ciclo de vida del software, ramas y matriz de responsabilidades.
* [Manual de Roles, Pantallas y Usabilidad](docs/usabilidad/manual_roles_permisos.md): Guía funcional orientada a los roles operativos del sistema.

---

## 4. Inicio Rápido Local

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd "Sistema de Inventario"

# 2. Levantar el Backend (FastAPI)
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000

# 3. Levantar el Frontend (En otra terminal)
cd ../frontend
npm install
npm run dev
```

La aplicación web estará disponible en `http://localhost:5173` y la documentación interactiva Swagger en `http://localhost:8000/docs`.

---
*Documentación técnica elaborada bajo el rol de Arquitecto y Documentador Técnico Profesional de Software.*
