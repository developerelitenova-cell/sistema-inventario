# Flujos de Auditoría, Control y Seguridad

Este documento describe cómo se protege la integridad de los datos en el sistema frente a acciones humanas o de IA, y los procesos de contingencia.

## 1. Controles para Desarrollo Asistido por IA
Todo código generado por agentes de IA pasa por las siguientes barreras:
1. **Auto-Corrección en Build:** El agente siempre debe verificar que `tsc -b` (TypeScript) compile antes de recomendar un PR.
2. **Revisión del Líder Técnico:** Ningún commit de IA entra a producción sin que el humano haya revisado las modificaciones en el editor local o apruebe el *Implementation Plan*.
3. **Restricción de Memoria:** Los agentes operan sobre copias de sesión locales; si destruyen el código, se recupera vía Git (`git checkout .`).

## 2. Flujo de Control de Seguridad del Sistema (Producción)

### A. Autenticación y Criptografía
- Todas las contraseñas se derivan usando `bcrypt` (vía `passlib` en Python). 
- Los tokens de sesión son generados con algoritmos criptográficos (`secrets.token_urlsafe`) e inyectados como Bearer Tokens, revirtiéndose y destruyéndose directamente en Base de Datos cuando un usuario hace logout.

### B. Trazabilidad Inmutable (Activity Logs)
Cada transacción modifica la tabla `activity_logs`. El flujo de control es:
1. Alguien inserta un nuevo activo, asigna una laptop, o elimina un usuario.
2. SQLAlchemy inyecta en la misma transacción SQL el log descriptivo.
3. El Administrador usa la pantalla de `ActivityLogs` para auditar problemas. Las filas en esta tabla carecen de interfaces (endpoints HTTP) para modificarse o borrarse (solo escritura y lectura).

## 3. Planes de Recuperación y Respaldo
- **Base de datos (Supabase):** Cuenta con *Point-in-Time Recovery* (PITR) integrado por la infraestructura de Supabase. Diariamente se conservan Snapshots de seguridad.
- **Rollback de App:** Como se aloja en Vercel y Render, restaurar un estado de código limpio toma un clic en el historial de Deployments del dashboard de dichos servicios. No se requiere SSH, terminal ni orquestación de contenedores manual en un pánico.
