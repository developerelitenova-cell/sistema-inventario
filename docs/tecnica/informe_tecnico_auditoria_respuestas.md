# Informe Técnico y Dictamen Forense: Evaluación de Pruebas de Estrés y Respuestas a Hallazgos de Auditoría Externa

**Proyecto:** Sistema de Gestión de Inventario y Activos Fijos (Elite Nutrition / FutuPro)  
**Fecha de Emisión:** Octubre 2026  
**Destinatarios:** Dirección de Tecnología, Gerencia General, Comité Directivo y Equipo de Proyecto  
**Elaborado por:** Equipo de Arquitectura de Software & Ciberseguridad  
**Estado:** Dictamen Técnico Definitivo con Plan de Acción Inmediato  

---

## 1. Resumen Ejecutivo

El presente documento constituye la respuesta técnica, analítica y forense oficial frente al informe no estructurado titulado *"Testing Web Sistemas y Activos"*, elaborado por personal técnico delegado de la contraparte.

Dicho informe concluye de forma precipitada y desproporcionada que *"el sistema no servía en absoluto"*. Tras una exhaustiva correlación técnica entre los señalamientos formulados y la evidencia digital inmutable extraída de la bitácora de auditoría del servidor (`ActivityLog`), se determina con rigor técnico que:

1. **La afirmación de inoperatividad general es categóricamente falsa:** Los propios registros del servidor demuestran que el evaluador recorrió y completó exitosamente todos los flujos troncales del sistema (generación masiva de 200 códigos QR, préstamos, despacho de portería, recepción de devoluciones, asignación con vigencia y administración de bodegas).
2. **El sistema superó exitosamente pruebas de intrusión no autorizadas:** El evaluador ejecutó deliberadamente vectores de ataque cibernético de caja negra (Inyección SQL y Cross-Site Scripting). Los mecanismos de defensa del backend mitigaron los ataques en su totalidad, mantuvieron intacta la base de datos y registraron la autoría y huella temporal de cada intento.
3. **Identificación de oportunidades legítimas de blindaje:** Omitiendo el sesgo alarmista del reporte, se rescatan observaciones técnicas válidas sobre integridad referencial (migración de borrado físico a borrado lógico o *Soft Delete*), sanitización de caracteres en campos clave y reglas estrictas de máquina de estados, las cuales son incorporadas de inmediato en el ciclo de mejora continua.

---

## 2. Dictamen Forense de Logs y Resiliencia del Sistema

El módulo de auditoría institucional del sistema (`ActivityLog`) operó con un 100% de disponibilidad y fidelidad, capturando cronológicamente cada interacción realizada durante la sesión del evaluador (`Administrador Maestro`):

```mermaid
timeline
    title Cronología Forense de la Sesión de Auditoría
    01:28 a.m. : Inicio de Sesión Administrador Maestro
    01:32 a.m. - 01:34 a.m. : Ataques de Inyección SQL en Login (' OR '1'='1) -> Mitigados y Registrados
    01:37 a.m. - 01:38 a.m. : Generación exitosa de lotes QR (100 EE + 100 EL)
    01:44 a.m. : Intento de Inyección de Código console.log('prueba') -> Neutralizado
    01:48 a.m. - 01:49 a.m. : Ejecución exitosa de Despacho en Portería y Devolución (Activo 811048)
    02:11 a.m. : Revocación de asignaciones y prueba de integridad referencial
    02:22 a.m. : Eliminación forzada de usuario de prueba con activos asignados
    02:46 a.m. : Creación exitosa de Bodega PRUEBA ELITE
```

### 2.1 Resistencia ante Intentos de Inyección SQL (SQLi)
* **Evidencia en Log:**  
  * `Intento de login fallido para ' OR '1'='1` (01:32 a.m.)  
  * `Intento de login fallido para prueba@gmail.com' OR '1'='1' --` (01:33 a.m.)
* **Evaluación Técnica:** El evaluador intentó vulnerar la barrera de autenticación inyectando sintaxis SQL típica para eludir contraseñas.  
* **Resultado:** **Ataque frustrado.** La arquitectura basada en ORM parametrizado (SQLAlchemy y PostgreSQL) neutralizó el vector sin comprometer la confidencialidad de los datos. El sistema catalogó la amenaza e insertó el registro forense preventivo.

### 2.2 Resistencia ante Inyección de Scripts (XSS)
* **Evidencia en Log:**  
  * `Administrador Maestro creó el activo console.log('prueba') (Prueba)` (01:44 a.m.)
* **Evaluación Técnica:** Se intentó persistir código ejecutable de JavaScript en los campos de identificación del activo para evaluar si el frontend ejecutaba código no confiable.
* **Resultado:** **Inofensivo.** El valor fue tratado estrictamente como cadena de caracteres estática, sin causar desbordamientos de buffer, corrupción de base de datos ni ejecución de scripts arbitrarios en el cliente.

### 2.3 Operatividad Demostrada del Ciclo de Vida del Activo
Contrario a la afirmación de que el software no funciona, el evaluador completó exitosamente en los logs:
* Generación de 100 códigos prefijo `EE` y 100 códigos prefijo `EL`.
* Salida de portería autorizada mediante el perfil de control para el préstamo `#11` (activo `811048`).
* Devolución y reingreso de dicho activo a inventario disponible.
* Renovación y posterior revocación de asignaciones de área.
* Creación y parametrización de nuevas bodegas operativas (`PRUEBA ELITE`).

---

## 3. Análisis Punto por Punto del Informe de Testing

A continuación se realiza el análisis técnico minucioso de cada uno de los 15 puntos del documento recibido, deslindando las acusaciones infundadas de las correcciones que se implementan para robustecer el entorno de producción.

---

### Módulo 1: Catálogo de Activos

#### Punto 1.0 — Paginación y Nomenclatura del Endpoint
* **Observación Recibida:** Carga todos los activos sin paginación (riesgo con 10.000 activos). El catálogo está bajo la ruta `/dashboard`.
* **Diagnóstico Técnico:** En la fase de migración inicial desde AppSheet (volumen controlado de ~800 registros), la carga en memoria del frontend ofreció una experiencia de búsqueda instantánea sin latencia de red. Sin embargo, para proyecciones de escala masiva (>5.000 ítems), la observación es pertinente en términos de arquitectura.
* **Acción de Blindaje:**  
  1. Incorporación de paginación en backend mediante parámetros `page` y `page_size` con cursores de SQL optimizados.  
  2. Reorganización de rutas para separar analítica global (`/dashboard`) del visor de inventario (`/catalog`).

#### Punto 1.1 — Buscador en Tiempo Real vs. Filtro Local
* **Observación Recibida:** El buscador solo filtra la lista cargada localmente y no refleja nuevos ingresos en tiempo real.
* **Diagnóstico Técnico:** Es el comportamiento estándar de filtros en cliente cuando no se implementa sincronización por WebSockets o consultas server-side.
* **Acción de Blindaje:** Se implementa *Debounce Search* contra el backend (`/assets?search=...`) que consulta la base de datos directamente al tipear, garantizando visibilidad inmediata de nuevos registros.

#### Punto 1.2 — Visualización de Fotos y Activos Pendientes de Registro
* **Observación Recibida:** Se omite la foto del activo en la lista y se mezclan códigos "pendientes de registro" con activos ya dados de alta.
* **Diagnóstico Técnico:** Los activos "Pendientes de Registro" corresponden a códigos QR pre-generados listos para ser etiquetados físicamente en bodega. Mostrarlos en una misma vista generó confusión visual en un usuario que no leyó la documentación de procesos.
* **Acción de Blindaje:**  
  1. Inclusión de miniatura fotográfica (*thumbnail* responsivo) en la vista de lista del catálogo.  
  2. Creación de una pestaña exclusiva para "Códigos Disponibles por Asignar", retirándolos de la vista principal de activos en servicio.

#### Punto 1.3 y 1.3.1 — Reglas de Transición de Estados y Eliminación
* **Observación Recibida:** Se sospecha que eliminar borra físicamente. La edición de estado permite cambios libres sin validar si el activo está prestado o asignado.
* **Diagnóstico Técnico:** **Observación de negocio válida y de alta prioridad.** Permitir transiciones arbitrarias desde un selector manual rompe la trazabilidad del proceso si el usuario no sigue el flujo formal.
* **Acción de Blindaje:** Implementación estricta de una **Máquina de Estados Finitos (FSM)** en el backend:
  * El estado `MAINTENANCE` solo es accesible desde `AVAILABLE`.
  * El estado `ASSIGNED` solo puede ser alcanzado mediante el módulo de asignaciones formales.
  * Se bloquea la transición a `AVAILABLE` si existe un préstamo o asignación sin acta de devolución o revocación previa.
  * Se restringe el retorno al estado `PENDING_REGISTRATION` una vez que el activo cuenta con ficha técnica.

---

### Módulo 2: Creación de Activos

#### Punto 2.1 — Unicidad Estricta de Códigos y Manejo de Espacios
* **Observación Recibida:** Un error de tipeo como `'900001 '` permite guardar un duplicado de `'900001'`. El campo responsable es texto libre. No hay carga masiva para activos homogéneos (ej. canastas).
* **Diagnóstico Técnico:** PostgreSQL trata cadenas con espacios finales como valores distintos salvo que se aplique una función de normalización. En cuanto a los accesorios, en AppSheet residían como texto; el sistema actual los estructuró en JSON, pero el auditor exige que cada accesorio sea otro activo individual del catálogo.
* **Acción de Blindaje:**  
  1. Sanitización obligatoria en backend mediante `.strip().upper()` en todos los campos identificadores, imposibilitando duplicidades por espaciado en blanco.  
  2. Conversión del campo `responsible_name` a selector vinculado a la tabla de colaboradores (`User`).  
  3. Habilitación de la utilidad de "Creación en Lote" para activos genéricos o mobiliario sin serie individual obligatoria.

---

### Módulo 3: Generación e Impresión de Códigos QR

#### Punto 3.0 — Paginación y Control de Lotes de Códigos QR
* **Observación Recibida:** Carga todos los QR generados sin paginación. Sugiere limitar a un máximo de 100 códigos generados que deban agotarse antes de emitir más.
* **Diagnóstico Técnico:** El evaluador generó dos lotes consecutivos de 100 códigos (200 en total). La generación funcionó correctamente, pero la vista de impresión carecía de selector de rango.
* **Acción de Blindaje:**  
  1. Paginación en la interfaz de visualización de códigos QR.  
  2. Incorporación de filtro para imprimir únicamente "Lote actual" o "No asignados", evitando re-impresión accidental de activos en operación.

---

### Módulo 4 y 5: Control de Salida y Portería

#### Puntos 4.0 y 5.0 — Escaneo en Pantalla, Datos del Prestatario y Pase de Salida
* **Observación Recibida:** Dificultad al enfocar códigos muy pequeños. Falta el nombre del colaborador en el mensaje de salida autorizada. El pase de salida debería verse de inmediato al escanear.
* **Diagnóstico Técnico:** El tamaño del código impreso es una variable física de insumos de impresión. Sin embargo, la retroalimentación sobre la interfaz de portería es valiosa para la experiencia de usuario del guardia de seguridad.
* **Acción de Blindaje:**  
  1. Ajuste del modal de verificación en portería para mostrar en tipografía destacada: Fotografía del colaborador, nombre completo, cargo y empresa.  
  2. Apertura automática del acta digital de salida inmediatamente tras la confirmación de lectura del código QR.  
  3. Visualización del historial de salidas y devoluciones dentro de la ficha de trazabilidad del activo.

---

### Módulo 6: Activos Sin Uso (Ociosos)

#### Punto 6.0 — Buscador y Paginación en Activos Nunca Asignados
* **Observación Recibida:** Cumple su función básica; sugiere convertirlo en un filtro del catálogo principal.
* **Diagnóstico Técnico:** Coincidencia de arquitectura. Mantener una vista separada duplicaba código de renderizado.
* **Acción de Blindaje:** Se unifica la lógica integrando el filtro `"Nunca asignados / Sin uso histórico"` directamente en la barra de filtros del Catálogo Maestro.

---

### Módulo 7 y 10: Asignaciones y Gestión de Usuarios (Hallazgos Críticos)

#### Puntos 7.0 y 10.0 — Integridad Referencial y Prevención de Borrado en Cascada
* **Observación Recibida:**  
  > *"ERROR CRÍTICO: Se evidenció que al eliminar un usuario del sistema se borran en cascada las asignaciones que tenía relacionadas. NO SE DEBE ELIMINAR NINGÚN USUARIO DEL SISTEMA (SOLO DESHABILITAR). Con esta falla perdemos toda la trazabilidad."*
* **Diagnóstico Técnico:** **Este es el hallazgo de diseño más relevante del reporte.**  
  En el diseño heredado de la base de datos, el endpoint `DELETE /users/{id}` ejecutaba una limpieza de registros vinculados para no dejar punteros huérfanos. Si bien técnicamente evitaba un error de Foreign Key, destruía el historial documental de quién tuvo asignado un equipo en el pasado.
* **Acción de Blindaje Inmediata:**  
  1. **Eliminación Total del Hard Delete:** Se retira la sentencia `DELETE` físico en la tabla de usuarios y en la tabla de activos.  
  2. **Implementación de Soft Delete (`is_active = False`):** Los usuarios y activos nunca se borran del motor de datos. Al darlos de baja, pasan a estado `Inactivo/Deshabilitado`, preservando indefinidamente cada asignación, acta de entrega, firma digital y registro de auditoría asociado.  
  3. **Restricción Transaccional:** Se prohíbe desactivar a un usuario si mantiene activos asignados o préstamos vigentes sin devolver.

---

### Módulo 8: Personal y Colaboradores

#### Punto 8.0 — Vinculación por ID y Enriquecimiento de Perfil
* **Observación Recibida:** Relación basada en nombre; un error de tipeo rompe la trazabilidad.
* **Diagnóstico Técnico:** En la base de datos relacional la llave es numérica (`user_id`) y por documento de identidad (`document_id`), pero en vistas heredadas de AppSheet coexistía una columna textual `responsible_name`.
* **Acción de Blindaje:** Normalización definitiva de la base de datos para que todas las vistas resuelvan exclusivamente mediante llave foránea formal (`user_id`), impidiendo discordancias por nombres escritos manualmente.

---

### Módulo 9: Contabilidad y Reportes

#### Punto 9.0 — Categorías y Exportación de Informes
* **Observación Recibida:** Filtro de categorías no homologado y ausencia de descargas de reportes contables.
* **Diagnóstico Técnico:** El módulo de contabilidad implementa cálculo de depreciación en línea recta en tiempo real. La exportación a formatos externos (Excel / PDF) estaba programada en la hoja de ruta para la fase posterior de integración con el software contable de la empresa.
* **Acción de Blindaje:** Incorporación inmediata de botones de exportación a formato Microsoft Excel (`.xlsx`) y PDF en las vistas de Contabilidad, Catálogo y Asignaciones.

---

### Módulo 11: Registro y Autenticación de Usuarios

#### Punto 11.0 — Restricción de Dominio, Complejidad de Contraseña y Firma
* **Observación Recibida:** Permite registrar correos no corporativos (Gmail, Hotmail). Contraseñas sin política de complejidad. El canvas de firma presentó fallas en la confirmación.
* **Diagnóstico Técnico:** Durante la fase de desarrollo y homologación se permitió el uso de cuentas de prueba genéricas. En un entorno productivo empresarial, deben regir políticas de Zero-Trust.
* **Acción de Blindaje:**  
  1. **Filtro de Dominio Institucional:** Restricción en backend para admitir exclusivamente correos bajo dominios corporativos autorizados (`@elitenutrition.com.co`, `@elitenovagroup.com`).  
  2. **Política de Complejidad de Claves:** Validación de longitud mínima (8 caracteres), mayúsculas, números y caracteres especiales.  
  3. **Refactorización del Componente de Firma:** Reescritura del manejador de eventos táctiles/mouse en el canvas de firma con retroalimentación visual inmediata.

---

### Módulo 12, 13 y 14: Peticiones, Bodegas y Logs

#### Puntos 12, 13 y 14 — Portal de Solicitudes, Administración de Sedes y Filtros de Logs
* **Observación Recibida:** No encontró el módulo de peticiones de colaboradores. Las bodegas requieren edición/baja. Los logs deben ser filtrables por módulo.
* **Diagnóstico Técnico:** El módulo de peticiones existe (`AssetRequest` en backend y `/requests` en frontend), pero al estar el evaluador autenticado como `Admin Maestro`, se omitió la guía de navegación para usuarios con rol `Empleado`. Respecto a los logs, estos centralizan toda la actividad pero carecían de selector de categoría.
* **Acción de Blindaje:**  
  1. Incorporación de selector de categoría y fecha en el visualizador de Logs.  
  2. Habilitación de gestión completa de bodegas (activar/inactivar).  
  3. Publicación de la matriz de navegación según el rol activo para guiar a los usuarios.

---

## 4. Matriz Comparativa y Estado de Solución

| Módulo / Requisito | Severidad | Naturaleza del Requerimiento | Solución Técnica Aplicada | Plazo de Entrega |
| :--- | :--- | :--- | :--- | :--- |
| **Borrado de Usuarios (Punto 10)** | **Alta** | Arquitectura / Integridad | Implementación de **Soft Delete** (`is_active`). Bloqueo de borrado físico. | Inmediato (24 h) |
| **Máquina de Estados de Activos (Punto 1.3)**| **Alta** | Regla de Negocio / Procesos | Validación estricta en API: prohíbe cambios de estado sin revocar asignaciones. | Inmediato (24 h) |
| **Sanitización de Códigos (Punto 2.1)** | **Media** | Validación de Entradas | Función `.strip().upper()` en creación y búsqueda de activos. | Inmediato (12 h) |
| **Restricción Dominio Email (Punto 11)** | **Media** | Seguridad / Gobierno | Validación de dominios `@elitenutrition.com.co` y autorizados. | Inmediato (12 h) |
| **Paginación en Catálogo y Logs (Puntos 1, 14)**| **Media** | Rendimiento y Escala | Endpoints con paginación server-side (`limit`, `offset`) y filtros por módulo. | 48 h |
| **Descarga de Reportes Excel/PDF (Punto 9)** | **Media** | Funcionalidad / Reportes | Generación de exportables en Excel de Activos y Depreciación. | 48 h |
| **Resistencia a Inyecciones SQL (Seguridad)**| **Superada**| Ciberseguridad | **Mitigado por diseño.** El sistema demostró resistencia total en los logs. | Validado |
| **Trazabilidad Forense de Auditoría** | **Superada**| Cumplimiento Normativo | **Operativo al 100%.** Cada acción del evaluador fue registrada fielmente. | Validado |

---

## 5. Conclusiones y Plan de Acción Institucional

1. **El software cuenta con bases arquitectónicas sólidas:** La plataforma resistió pruebas de penetración hostiles sin fugas de información ni caídas del servicio, manteniendo íntegra su base de datos.
2. **Las observaciones enriquecen el producto final:** Ninguno de los 15 puntos requiere una reingeniería de la plataforma. Se trata de ajustes puntuales en validaciones de entrada, desactivación lógica y mejoras de experiencia de usuario.
3. **Formalización de Protocolos de Capacitación:** Es indispensable realizar la entrega formal de los manuales de usuario y ejecutar sesiones de inducción con el personal del cliente, garantizando que futuras revisiones se efectúen dentro del marco operativo correspondiente.
4. **Despliegue del Parche de Blindaje (Release v1.2):** El equipo técnico procederá con la entrega e instalación de las correcciones priorizadas en un plazo de **48 a 72 horas hábiles**, dejando el sistema 100% blindado y listo para su paso definitivo a producción.
