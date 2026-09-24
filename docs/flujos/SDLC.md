# Ciclo de Vida del Desarrollo de Software (SDLC)

El desarrollo, mejora y corrección de errores en el Sistema de Inventario sigue un ciclo estandarizado y rápido, priorizando la intervención de Agentes IA para la redacción y revisión, pero bajo supervisión arquitectónica humana.

## 1. Etapa de Planeación (Requisitos)
1. El negocio reporta una necesidad o un bug al Líder Técnico.
2. Si la tarea es compleja (ej. "Añadir un nuevo módulo de reportería"), el Líder invoca un Agente Documentador para crear un *Implementation Plan*.
3. El Agente desglosa las piezas de código que se van a tocar y pide autorización.
4. Si el Líder aprueba el plan, se pasa a Desarrollo.

## 2. Etapa de Desarrollo Asistido por IA (Coding)
1. El Agente o desarrollador clona el repositorio localmente.
2. Modifica el código en `backend/` o `frontend/`.
3. El Agente ejecuta pruebas locales si es posible (`npm run build`, `vitest`).
4. Cualquier error de compilación en React (como un error de importación) se retroalimenta inmediatamente al agente para su auto-reparación antes de realizar commit.

## 3. Etapa de Revisión de Código y Seguridad
- **Commit Atómico:** Los commits deben abarcar un solo flujo de cambio, nunca arreglos de UI y refactorización de bases de datos al mismo tiempo.
- **Agent Council (Opcional):** Para cambios drásticos, un Agente Auditor (como el Auditor de Arquitectura) revisará el código del Agente Desarrollador, actuando como un revisor par (Peer Review).

## 4. Integración y Despliegue Continuo (CI/CD)
1. Se hace `git push origin main`.
2. **Vercel** intercepta el webhook. Instala dependencias (`npm install`), compila TypeScript, comprime los assets y despliega estáticamente a la CDN. (Tiempo prom.: ~1 minuto).
3. **Render** intercepta el webhook. Ejecuta el `pip install` del `requirements.txt` y arranca la imagen del contenedor con FastAPI. (Tiempo prom.: ~3 minutos).
4. La actualización ya es visible por el cliente.

## 5. Mantenimiento y Monitorización
- Los registros del servidor se auditan directamente desde los logs nativos de Render.
- Para rastrear incidentes internos de negocio (ej. "quién prestó esta laptop a un extraño"), se utiliza el módulo nativo `/activity-logs` disponible para Administradores en el Dashboard.
- En caso de un *rollback* (desplegar un fallo grave), el desarrollador entra al panel de Vercel/Render y utiliza la opción "Redeploy to previous version" a un solo clic.
