# Guía de Flujos Operativos

Esta guía describe el paso a paso de los flujos de negocio más comunes dentro de la plataforma para asegurar que todos los usuarios sigan el conducto regular.

## 1. Flujo de Petición y Préstamo (PQR de Activos)
**Actores:** Empleado, Encargado, Guardia de Seguridad.

1. **El Empleado inicia:** Navega a la pestaña "Peticiones" (`/requests`), presiona "Nueva Solicitud".
2. **Llenado de Formulario:** Selecciona qué categoría necesita (ej. "Laptop") y en el cuadro de texto especifica el por qué ("Se me dañó el cargador antiguo"). Pulsa Enviar.
3. **Revisión del Encargado:** El Encargado visualiza el ticket en su bandeja. Si hay dudas, le deja un mensaje al empleado en el historial de comentarios del ticket.
4. **Asignación (Aprobación):** Cuando el Encargado está listo, presiona "Asignar Equipo". Se abre un modal donde escanea o selecciona el ID del equipo real que le entregará. El estado del ticket cambia a "Cerrado" y se genera automáticamente un **Préstamo**.
5. **Checkout en Bodega:** El Encargado busca el préstamo generado, y le da al botón "Entregar al Empleado".
6. **Validación en Portería:** El Empleado llega a la portería. El Guardia de Seguridad (`SALIDA`), desde su tablet escanea el QR pegado al equipo. El sistema muestra la foto del Empleado y un ✅ verde indicando que tiene permiso de sacarlo de la empresa.
7. **Devolución:** Días o meses después, el empleado devuelve el equipo a la bodega y el Encargado presiona "Devolver".

## 2. Flujo de Ingreso Rápido por Código QR
**Actores:** Encargado.

Cuando llegan decenas de equipos nuevos (por ejemplo, monitores), el encargado usa el flujo rápido:
1. **Generación de Etiquetas:** En la pantalla "QRs", selecciona "Imprimir Lotes". Genera e imprime 50 etiquetas QR y se las pega físicamente a las cajas de los monitores.
2. **Escaneo y Registro Rápido:** Va a la sección de Inventario y presiona el ícono grande flotante de Escáner.
3. Se activa la cámara trasera de su dispositivo móvil. Apunta a la primera etiqueta pegada.
4. El sistema alerta: *"Activo no existe, ¿desea registrarlo?"*.
5. El Encargado presiona **Sí**. Automáticamente la caja de "Código Único" ya viene prellenada con la cadena exacta del QR.
6. El Encargado llena Marca, Categoría (Monitor) y Modelo. Toca el botón "Tomar Foto" para registrar el estado físico real de la caja, y presiona Guardar.
7. Repite el proceso deslizando hacia el siguiente código.

## 3. Flujo de IA (Valoración Automática por Foto)
1. Durante el registro o edición de un activo en la bodega, el encargado sube o captura una foto del equipo.
2. Tras guardarla, pulsa el botón mágico **"Estimar Valor con IA"**.
3. El sistema carga unos segundos. Internamente envía la foto al motor de OpenAI (Vision).
4. El modelo analiza el desgaste físico de las esquinas, la antigüedad del modelo visible, y consulta su base de datos global de depreciación tecnológica.
5. El cuadro de "Valor Actual Estimado" se llena automáticamente (ej. "$250.00") y el campo Origen dice `IA_ESTIMADO`.
