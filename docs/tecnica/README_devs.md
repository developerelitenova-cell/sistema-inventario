# Guía Rápida para Desarrolladores

Bienvenido al repositorio del Sistema de Inventario. Esta guía explica cómo arrancar el proyecto en un entorno local (tu máquina) para desarrollar nuevas características o probar cambios.

## Prerrequisitos
- **Node.js** (v18 o superior recomendado) y `npm`.
- **Python** (3.10+ recomendado).
- Una instancia local de SQLite, o acceso a las variables del entorno `.env` de Supabase para apuntar a producción (cuidado al alterar datos reales si apuntas al DB de producción).

---

## 1. Configurar el Backend (FastAPI)

El backend expone la API y se conecta a la base de datos.

1. **Navegar a la carpeta:**
   ```bash
   cd backend
   ```
2. **Crear entorno virtual e instalar dependencias:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. **Variables de entorno:**
   Crea un archivo `.env` en la carpeta `backend` basado en el entorno de producción (solicita las credenciales de `SUPABASE_URL`, `DATABASE_URL`, etc., al líder técnico).
4. **Ejecutar servidor local:**
   ```bash
   uvicorn main:app --reload
   ```
   El backend estará disponible en `http://127.0.0.1:8000`.
   Puedes ver la documentación Swagger interactiva en `http://127.0.0.1:8000/docs`.

---

## 2. Configurar el Frontend (React + Vite)

El frontend contiene toda la UI del usuario.

1. **Navegar a la carpeta:**
   ```bash
   cd frontend
   ```
2. **Instalar paquetes:**
   ```bash
   npm install
   ```
3. **Conectar el frontend al backend local:**
   Asegúrate de que en `frontend/src/api.ts`, la variable `API_URL` apunte a `http://127.0.0.1:8000` si deseas probar contra tu servidor local. (Asegúrate de NO hacer commit de este cambio si usas URLs quemadas, o implementa una variable `import.meta.env.VITE_API_URL`).
4. **Arrancar el servidor de desarrollo Vite:**
   ```bash
   npm run dev
   ```
   El frontend estará accesible en `http://localhost:5173`.

---

## 3. Normas de Colaboración
- Utiliza **TypeScript estricto** en el frontend.
- Todo endpoint nuevo en el backend debe definir su `response_model` en FastAPI (`schemas.py`) para auto-documentación.
- Asegúrate de correr los linters antes de realizar commits (si están configurados).
- Si alteras o creas tablas en `models.py`, se requiere correr scripts de actualización o purga de base de datos según convención actual.
