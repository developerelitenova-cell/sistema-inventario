# Arquitectura Interna del Código Frontend (React + Vite)

Este documento detalla la estructura, organización y funcionamiento interno de la Single Page Application (SPA) del **Sistema de Inventario**, desarrollada con React 19, TypeScript y empaquetada con Vite.

---

## 1. Estructura de Directorios del Frontend

```
frontend/
├── package.json              # Dependencias y scripts (React 19, Vite 8, Vitest 5, oxlint)
├── vite.config.ts            # Configuración del bundler Vite y plugins
├── tsconfig.json             # Configuración raíz de TypeScript
├── tsconfig.app.json         # Reglas de tipado estricto para el código de aplicación
│
├── public/                   # Recursos estáticos servidos directamente
└── src/
    ├── main.tsx              # Punto de entrada del árbol DOM de React
    ├── App.tsx               # Enrutador principal y cascarón de aplicación (AppShell)
    ├── App.css / index.css   # Estilos base, variables CSS y diseño adaptativo
    │
    ├── api.ts                # Cliente HTTP unificado, interfaces de datos y tipos
    ├── auth.ts               # Utilidades de autenticación de bajo nivel (App Password)
    ├── session.ts            # Gestión de persistencia de sesión de usuario en LocalStorage
    ├── warehouseContext.tsx  # Contexto de bodega/módulo activo y selector global
    ├── moduleContext.tsx     # Contexto de compatibilidad para módulos de inventario
    │
    ├── components/           # Componentes UI reutilizables
    │   ├── Navbar.tsx        # Barra de navegación principal adaptada por rol
    │   ├── LoginGate.tsx     # Barrera de autenticación que protege las rutas privadas
    │   ├── AuthGate.tsx      # Control de acceso complementario
    │   ├── ModuleSelector.tsx# Menú desplegable para alternar la bodega activa
    │   ├── CameraCapture.tsx # Captura fotográfica vía WebCam con recorte automático
    │   ├── ThreeBackground.tsx # Renderizado de fondo 3D interactivo con Three.js
    │   ├── UserProfileCard.tsx # Tarjeta de resumen de usuario con badges de rol
    │   ├── AssetEditModal.tsx # Modal de edición de activo (incluye accesorios y fotos)
    │   ├── AssetViewModal.tsx # Modal de inspección de detalle de activo
    │   ├── RequestLoanModal.tsx # Modal para solicitar préstamo directo
    │   ├── ReturnAssetModal.tsx # Modal para formalizar la devolución de equipos
    │   ├── ChangePasswordModal.tsx # Modal de cambio de clave de usuario
    │   ├── UserCreateModal.tsx # Modal administrativo para registrar usuarios
    │   ├── UserEditModal.tsx   # Modal administrativo para editar perfiles y roles
    │   ├── HolderInfoPopup.tsx # Pop-up para consultar el custodio actual del activo
    │   └── RequestCommentThread.tsx # Hilo de comentarios estilo chat para solicitudes
    │
    ├── pages/                # Vistas principales de la aplicación
    │   ├── Dashboard.tsx     # Vista general, KPIs, catálogo de inventario y acciones
    │   ├── Scanner.tsx       # Lector de códigos QR en tiempo real para auditorías
    │   ├── Approvals.tsx     # Panel de aprobación de préstamos para encargados/admins
    │   ├── Requests.tsx      # Gestión de solicitudes de equipos tipo ticket PQR
    │   ├── Assignments.tsx   # Panel de control de asignaciones fijas y vencimientos
    │   ├── Responsibles.tsx  # Vista consolidada de custodios y tenedores de equipos
    │   ├── Returns.tsx       # Módulo de recepción física y devolución de activos
    │   ├── Accounting.tsx    # Métricas financieras, depreciación acumulada y avalúos
    │   ├── AddAsset.tsx      # Formulario de alta de activos con sugerencia IA
    │   ├── RegisterByCode.tsx# Registro y vinculación de activo a código pre-impreso
    │   ├── QRCodes.tsx       # Generador masivo e impresión de etiquetas con código QR
    │   ├── UnusedAssets.tsx  # Reporte de activos ociosos sin movimiento reciente
    │   ├── Users.tsx         # Gestión administrativa de empleados y asignación a bodegas
    │   ├── Warehouses.tsx    # Administración de bodegas (claves, nombres y estado)
    │   ├── ActivityLogs.tsx  # Visor de la bitácora inmutable de auditoría
    │   ├── Register.tsx      # Página pública de registro de empleados con firma y foto
    │   └── SecurityExitPass.tsx # Pase digital de salida para control en portería
    │
    ├── utils/                # Funciones auxiliares de formateo y validación
    └── tests/                # Pruebas de integración y componentes con Vitest
```

---

## 2. Gestión del Estado y Contextos

### 2.1 Persistencia de Sesión (`session.ts`)
- Almacena en `localStorage` los datos del usuario logueado (`user_session`) y el token Bearer (`auth_token`).
- Expone funciones puras: `getToken()`, `setSession(token, user)`, `clearSession()` y `getCurrentUser()`.
- Garantiza que al recargar el navegador se restaure el estado de sesión sin requerir re-login hasta que el token expire o sea revocado.

### 2.2 Contexto de Bodega (`warehouseContext.tsx`)
- Centraliza la bodega activa seleccionada por el usuario en el cliente.
- Provee:
  - `currentWarehouse`: Objeto con la bodega actualmente seleccionada.
  - `warehouses`: Lista de bodegas a las que el usuario tiene acceso según su rol y permisos.
  - `setCurrentWarehouse(warehouse)`: Mutador que sincroniza con `localStorage`.
- Cuando el usuario es un *Admin Maestro*, puede conmutar dinámicamente entre todas las bodegas existentes. Si es un *Encargado* o *Admin Acotado*, solo se listan sus bodegas autorizadas.

### 2.3 Barrera de Autenticación (`LoginGate.tsx`)
- Envuelve las rutas privadas de la aplicación.
- Verifica la presencia de un token válido en `localStorage` y valida la disponibilidad del servicio.
- Si no existe sesión activa, redirige automáticamente al formulario de autenticación o a la pantalla de registro sin exponer datos del sistema.

---

## 3. Capa de Comunicación con el Servidor (`api.ts`)

La capa de API es un cliente fuertemente tipado que abstrae las llamadas `fetch`:
- **Inyección Automática de Encabezados:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` (si existe token activo)
  - `X-App-Password` (clave global de acceso si está configurada)
- **Manejo Centralizado de Errores:** Intercepta códigos de error HTTP y extrae el mensaje de `detail` provisto por FastAPI para presentarlo en la interfaz mediante mensajes comprensibles.
- **Tipado Estricto de Datos:** Contiene definiciones TypeScript exhaustivas (`Asset`, `User`, `Loan`, `Warehouse`, `Category`, `Role`, `AccessoryItem`, etc.) que replican fielmente los schemas de Pydantic del backend.

---

## 4. Enrutamiento y Navegación (`App.tsx`)

La aplicación utiliza `react-router-dom` v7 con la siguiente jerarquía:
- **Rutas Públicas:**
  - `/register`: Registro autoservicio de nuevos empleados con captura de fotografía y firma digital en canvas.
- **Rutas Protegidas (Bajo `LoginGate` y `AppShell`):**
  - `/dashboard`: Panel central y catálogo filtrable por bodega y categoría.
  - `/scanner`: Lector QR en tiempo real para validaciones de seguridad y consultas rápidas.
  - `/assets/new`: Formulario de creación de activos con integración a Gemini Vision.
  - `/assets/register-by-code`: Asociación de un activo físico a una etiqueta QR pregenerada.
  - `/approvals`: Cola de autorización de préstamos.
  - `/requests`: Centro de solicitudes de equipos para empleados y encargados.
  - `/assignments`: Gestión de asignaciones fijas corporativas.
  - `/responsibles`: Directorio de tenedores actuales de activos.
  - `/returns`: Registro de recepción y retorno de equipos a inventario.
  - `/accounting`: Valorización financiera y depreciación lineal.
  - `/qr-codes`: Generador y visor para impresión de etiquetas QR en lote.
  - `/unused`: Módulo de detección de activos ociosos.
  - `/users`: Control administrativo de usuarios y roles.
  - `/warehouses`: Administración de bodegas físicas y lógicas.
  - `/logs`: Auditoría forense de eventos del sistema.
  - `/security-exit/:id`: Validación de pase de salida por personal de portería.

---

## 5. Componentes Destacados e Integraciones Visuales

### 5.1 Escáner QR Nativo (`html5-qrcode`)
- Utilizado en `Scanner.tsx` y componentes de lectura.
- Accede a la cámara del dispositivo móvil o de escritorio para decodificar códigos QR al vuelo sin enviar streams de video pesados al servidor.

### 5.2 Fondo Interactivo 3D (`ThreeBackground.tsx`)
- Implementado con **Three.js** (`three`).
- Renderiza partículas geométricas interactivas que reaccionan sutilmente al cursor y al redimensionamiento de ventana, otorgando una estética futurista y corporativa coherente con la identidad de marca (Elite Nutrition / FutuPro).

### 5.3 Captura Fotográfica y Firma Digital
- `CameraCapture.tsx`: Proporciona una interfaz amigable para tomar fotos de activos y rostros desde la cámara web.
- `Register.tsx` y `SecurityExitPass.tsx`: Implementan lienzos HTML5 Canvas interactivos para captura de firmas manuscritas vectorizadas y exportadas a Base64.
