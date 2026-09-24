# Despliegue y Entorno (Operación)

El Sistema de Inventario consta de una arquitectura desacoplada alojada en PaaS modernos de integración continua. Toda subida a la rama `main` de GitHub desencadena automáticamente los webhooks de despliegue en Vercel y Render.

## 1. Frontend (Vercel)
El frontend (`frontend/`) es construido como una aplicación estática utilizando `Vite` y alojado en **Vercel**. 

- **Comandos de Build:** `npm run build` (`tsc -b && vite build`).
- **Variables de Entorno:**
  No requiere secretos sensibles. En `frontend/src/api.ts` la URL base del backend se apunta estáticamente hacia el servidor en producción de Render:
  `const API_URL = 'https://sistema-inventario-kxdc.onrender.com';`

## 2. Backend (Render)
El backend (`backend/`) es expuesto a través de **Render**, corriendo Uvicorn como servidor ASGI para la aplicación FastAPI.

- **Comandos de Build:** (Se usan los del archivo `render.yaml` o los definidos en la interfaz de Render, típicamente `pip install -r requirements.txt`).
- **Comando de Arranque:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Variables de Entorno Clave (`.env`):**
  - `DATABASE_URL`: URI de conexión a PostgreSQL.
  - `SUPABASE_URL` y `SUPABASE_KEY`: Credenciales del Storage para fotos de activos.
  - `APPSHEET_*`: Variables heredadas para compatibilidad o migración antigua.

## 3. Base de Datos y Almacenamiento (Supabase)
La base de datos relacional PostgreSQL está aprovisionada en **Supabase** (en `aws-0-us-east-1.pooler.supabase.com`). Supabase ofrece:
1. Conexión de base de datos directa para SQLAlchemy.
2. Almacenamiento de objetos (`Storage`) donde se suben las imágenes de evidencia de activos y firmas, consumido a través del cliente oficial de Supabase en Python.

## 4. Gestión de Dependencias
- **Frontend:** Manejador de paquetes `npm`. (Listado en `package.json`).
- **Backend:** Manejador `pip` (Listado en `requirements.txt`). Entorno local típicamente orquestado con `venv`.

## 5. Estrategia de Versionado
Actualmente se maneja control de versiones con **Git** utilizando el modelo *Trunk-Based Development* o un flujo directo a `main`. Cada push (aprobación) a `main` activa la sincronización y actualización inmediata en producción sin requerir intervención manual (CI/CD nativo de Vercel y Render).
