# Guía de Instalación y Configuración

## Requisitos Previos
* **Node.js** (v18 o superior)
* **Python** (v3.10 o superior)
* **Git**

## Configuración del Backend

1. **Navegar a la carpeta del backend:**
   ```bash
   cd backend
   ```

2. **Crear y activar un entorno virtual:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # En Linux/Mac
   # venv\Scripts\activate   # En Windows
   ```

3. **Instalar las dependencias:**
   ```bash
   pip install -r ../requirements.txt
   ```

4. **Variables de Entorno (`.env`):**
   Crea un archivo `.env` en la carpeta `backend` basado en el siguiente esquema:
   ```env
   # Configuración de Base de Datos
   # Puedes usar un archivo local SQLite por defecto si omites esta variable
   # DATABASE_URL=postgresql://user:password@host:port/dbname

   # Integración con Supabase (Almacenamiento de archivos)
   SUPABASE_URL=tu_supabase_url
   SUPABASE_KEY=tu_supabase_key

   # Inteligencia Artificial Multimodal (Google Gemini)
   GEMINI_API_KEY=tu_gemini_api_key

   # Seguridad
   APP_PASSWORD=clave_global_de_proteccion_api

   # Integración Opcional (AppSheet)
   APPSHEET_APP_ID=tu_app_id
   APPSHEET_ACCESS_KEY=tu_access_key
   APPSHEET_ESTUDIO_APP_ID=tu_app_id_estudio
   APPSHEET_ESTUDIO_ACCESS_KEY=tu_access_key_estudio

   # CORS
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

5. **Levantar el servidor local:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   *La API estará disponible en `http://localhost:8000` y su documentación interactiva en `http://localhost:8000/docs`.*

---

## Configuración del Frontend

1. **Navegar a la carpeta del frontend:**
   ```bash
   cd frontend
   ```

2. **Instalar las dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno (`.env.local`):**
   Crea un archivo `.env.local` en la carpeta `frontend` si necesitas sobreescribir la URL de la API:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
   *(Nota: Revisa si el código usa directamente una constante en `src/api.ts` o si soporta la inyección de esta variable de entorno).*

4. **Levantar el entorno de desarrollo:**
   ```bash
   npm run dev
   ```
   *La aplicación estará disponible en `http://localhost:5173`.*

## Migraciones y Mantenimiento de Base de Datos
Actualmente, las tablas se generan dinámicamente mediante `models.Base.metadata.create_all(bind=engine)` en el arranque del backend. 

Para modificaciones complejas o si necesitas aplicar fixes al esquema, revisa los scripts disponibles en la raíz de `backend/` (ej. `fix_db.py`, `run_migration.py`). 
*(Se recomienda en el futuro inmediato migrar esta estrategia hacia Alembic).*
