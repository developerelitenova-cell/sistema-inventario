# Matriz RACI (Operaciones y Desarrollo)

Esta matriz define los roles en el ciclo de vida del software, incidentes en producción y auditorías de base de datos.

**Significado RACI:**
- **R (Responsible):** El que ejecuta la tarea.
- **A (Accountable):** El que aprueba y rinde cuentas.
- **C (Consulted):** El que es consultado (brinda información).
- **I (Informed):** El que es notificado del resultado.

## Matriz del Equipo Técnico y de Negocio

| Tarea / Proceso | Agente de IA | Líder Técnico | Administrador del Sistema | Negocio / Stakeholders |
|-----------------|:---:|:---:|:---:|:---:|
| Redacción del Código Base | **R** | **A** | I | I |
| Revisión de Seguridad | **R** | **A** | I | C |
| Despliegue a Producción | **R** | **A** | I | I |
| Auditoría de Inventario Físico | I | C | **A** | **R** |
| Gestión de Variables de Entorno | I | **R, A** | C | I |
| Recuperación de Desastres (DB) | C | **R** | **A** | I |
| Actualización de Manuales UI | **R** | **A** | C | I |

### Aclaraciones de Bloqueos (Escalamiento)
1. **Errores de Código (Bugs):** El Agente de IA intenta corregir automáticamente los fallos. Si no puede acceder a credenciales o un problema escapa del servidor, se escala al Líder Técnico.
2. **Caídas de Servidor (Downtime):** Se escalan al Líder Técnico para revisar Render/Vercel.
3. **Pérdida de Datos:** El Líder Técnico interviene conectándose a Supabase para restaurar un volcado histórico (Dump).
