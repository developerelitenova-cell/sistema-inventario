# Fase 3: Asignaciones Temporales y Seguridad

- [x] 1. Campo en la BD: Añadir columna `security_authorization` a la tabla `asset_assignments`.
- [x] 2. Endpoints Backend: Modificar los esquemas y lógica de `create_assignment` en `assignments.py` para grabar esta autorización.
- [x] 3. Interfaz Frontend: Agregar un selector en `Assignments.tsx` con opciones ("Uso Interno" vs "Autorizado para Salir") y mostrar esta info visualmente en cada tarjeta.
- [x] 4. Escáner de Portería: Modificar `verify_asset_status` en `assets.py` para comprobar si el activo tiene una asignación activa (en vez de préstamo) y enviar esa data.
- [x] 5. Interfaz Escáner: Modificar `Scanner.tsx` para permitir salida directa (luz verde) a activos asignados autorizados, y bloquear los de uso interno.
