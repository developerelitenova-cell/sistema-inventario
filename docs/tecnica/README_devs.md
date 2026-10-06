# Guía para Desarrolladores (Onboarding y Convenciones de Código)

Bienvenido al repositorio del **Sistema de Inventario**. Esta guía contiene las convenciones de ingeniería de software, estándares de código y pasos necesarios para contribuir activamente en el proyecto.

---

## 1. Prerrequisitos de Entorno Local

- **Node.js:** v18.0 o superior (recomendado v20 LTS) y `npm`.
- **Python:** v3.10 o superior (recomendado v3.11+).
- **Git:** Para control de versiones.
- **SQLite o PostgreSQL:** SQLite viene soportado de fábrica sin instalación adicional para desarrollo local (`backend/inventario.db`). Para simular producción, se puede configurar una instancia de PostgreSQL en `.env`.

---

## 2. Puesta en Marcha Rápida

### 2.1 Backend (FastAPI)
```bash
# 1. Navegar a la carpeta del backend
cd backend

# 2. Crear y activar entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# 3. Instalar dependencias
pip install -r ../requirements.txt

# 4. Crear archivo .env local
# Configura variables básicas (puedes omitir DATABASE_URL para usar SQLite local)
cat <<EOF > .env
APP_PASSWORD=dev_secret_key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
EOF

# 5. Levantar el servidor en modo autoreload
uvicorn main:app --reload --port 8000
```
La API estará accesible en `http://127.0.0.1:8000` y la documentación Swagger interactiva en `http://127.0.0.1:8000/docs`.

### 2.2 Frontend (React + Vite)
```bash
# 1. Navegar a la carpeta del frontend
cd frontend

# 2. Instalar paquetes npm
npm install

# 3. Levantar el servidor de desarrollo Vite
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

## 3. Convenciones de Código y Buenas Prácticas

### 3.1 Backend (Python / FastAPI)
- **Tipado Estricto con Pydantic:** Todo nuevo endpoint debe declarar estrictamente su modelo de solicitud (`request_model` en el body) y su modelo de respuesta (`response_model` en el decorador del router).
- **Inyección de Dependencias:** Usar siempre `Depends(get_db)` para obtener la sesión de base de datos y `Depends(auth_service.get_current_user)` o `Depends(auth_service.require_role(...))` para seguridad.
- **Manejo de Fechas:** Nunca usar `datetime.now()` directo. Usar siempre `get_colombia_time()` de `time_util.py` para asegurar que las fechas se registren en UTC.
- **Auditoría Obligatoria:** Toda operación que mute el estado de un activo, usuario, préstamo o asignación debe invocar `audit.log_action(...)` dentro de la misma transacción antes de ejecutar `db.commit()`.

### 3.2 Frontend (TypeScript / React)
- **TypeScript Estricto:** Evitar el uso de `any`. Toda interfaz de datos debe añadirse en `src/api.ts` reflejando los schemas del backend.
- **Linter Rápido con Oxlint:** Antes de hacer commit, ejecutar `npm run lint`.
- **Componentes Modulares:** Mantener las vistas en `src/pages/` y los diálogos o componentes visuales reutilizables en `src/components/`.
- **Manejo de Errores en UI:** Toda llamada asíncrona a la API debe capturar excepciones y mostrar mensajes claros al usuario evitando que la pantalla quede bloqueada en estado de carga.

---

## 4. Ejecución de la Suite de Pruebas

Antes de enviar cambios para revisión:
```bash
# Correr pruebas del backend
cd backend
pytest -v

# Correr pruebas y linter del frontend
cd ../frontend
npm run lint
npm test
npm run build
```
Consulte la [Guía de Pruebas](guia_pruebas.md) para más detalles sobre fixtures y cobertura.
