# AnimeStock · Gestión de peluchitos de anime

Aplicación web para administrar una tienda de peluchitos de anime: **inventario,
ventas, caja y reportes**, con dashboard de indicadores. El backend es
**Spring Boot** y el frontend es **HTML + CSS + JavaScript vanilla** servido por
el mismo backend (no hay build de frontend, no hay `npm`).

La app está pensada para correr **de punta a punta**: navegás por el panel,
cargás productos en el inventario, registrás una venta, se descuenta el stock,
queda el movimiento en caja y aparece en reportes. Todo persistido en PostgreSQL.

---

## Índice

1. [Stack y arquitectura](#1-stack-y-arquitectura)
2. [Requisitos previos](#2-requisitos-previos)
3. [Puesta en marcha (paso a paso)](#3-puesta-en-marcha-paso-a-paso)
4. [Estructura del proyecto](#4-estructura-del-proyecto)
5. [Cómo usar la aplicación](#5-cómo-usar-la-aplicación)
6. [API REST](#6-api-rest)
7. [Inventario: notas técnicas y limitaciones](#7-inventario-notas-técnicas-y-limitaciones)
8. [Flujo completo de venta (guía de prueba)](#8-flujo-completo-de-venta-guía-de-prueba)
9. [Problemas comunes](#9-problemas-comunes)
10. [Estado del proyecto y roadmap](#10-estado-del-proyecto-y-roadmap)

---

## 1. Stack y arquitectura

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Java 27 (toolchain de Gradle) |
| Backend | Spring Boot 4.1.1 · Spring Web MVC · Spring Data JPA (Hibernate) |
| Base de datos | PostgreSQL (por defecto, Neon en la nube) |
| Build | Gradle 9.7.1 (viene con el wrapper `gradlew`) · Lombok |
| Plantillas | Thymeleaf (**multipágina**: una plantilla por pantalla + `fragments/layout.html`) |
| Frontend | HTML5 + CSS3 + JavaScript ES2022 vanilla. **Sin frameworks, sin bundler** |
| Extras | PWA: `manifest.webmanifest` + `sw.js` (service worker) |

**Arquitectura del frontend (multipágina)**

- `templates/` — **una plantilla por pantalla**: `index.html` (Dashboard),
  `inventario.html`, `proveedores.html`, `ventas.html`, `pedidos.html`,
  `caja.html`, `reportes.html`, `configuracion.html`.
- `templates/fragments/layout.html` — **layout compartido**: `head`, `sidebar`,
  `topbar`, `scrim`, `toasts`, los modales globales (checkout y comprobante) y el
  bundle de scripts. Cada página los incluye con `th:replace`, así el chrome se
  define **una sola vez**.
- `Controller/HomeController.java` — mapea cada ruta (`/`, `/inventario`, …) a su
  plantilla. Navegar cambia de URL de verdad (funciona el botón **Atrás**) y cada
  pantalla carga **solo los scripts que usa**.
- `static/css/` — `styles.css` (base, paleta en `:root`), `sales.css`
  (Ventas + Caja + Inventario), `pages.css` (**nuevo**: shell multipágina,
  Pedidos, Configuración y Proveedores), `reports.css`, `print.css`.
- `static/js/mock-data.js` — **única capa de datos**. Expone `window.AnimeStockData`
  con las funciones `fetch*` / `create*` / `update*` / `delete*` que llaman a la
  API. Ninguna vista lee la API directamente.
- `static/js/ui.js` — **kit de UI compartido** (`window.AnimeStockUI`: toasts,
  modales, formateadores, mini-KPIs). Antes vivía dentro de `sales.js`.
- `static/js/*.js` — un archivo por vista (`dashboard.js`, `inventory.js`,
  `sales.js`, `cash.js`, `reports.js` + los nuevos `orders.js`, `settings.js`,
  `suppliers.js`) y el arranque (`app.js`), que despacha según
  `<body data-page="…">`.

El frontend se sirve **desde el mismo origen** que la API (`http://localhost:8080`),
así que las llamadas son `fetch('/api/...')` y **no hacen falta reglas CORS**.

---

## 2. Requisitos previos

- **JDK 27** instalado y accesible. Verificá con:

  ```bash
  java -version
  ```

  Debe reportar `openjdk version "27"`. Gradle usa un *toolchain* fijado en
  `build.gradle.kts` (`languageVersion = 27`), así que necesita un JDK 27 real.

- **Conexión a Internet**. Se usa para:
  - que el wrapper de Gradle descargue Gradle 9.7.1 la primera vez, y
  - que la app se conecte a la base PostgreSQL de Neon.

- **Git** (opcional, solo si vas a clonar el repositorio).

> No se necesita instalar Gradle, Node, ni Docker. El wrapper (`gradlew`) y el
> frontend "sin build" evitan todo eso.

---

## 3. Puesta en marcha (paso a paso)

### 3.1 Obtener el proyecto

```bash
git clone <url-del-repo> springboot
cd springboot
```

(Si ya tenés la carpeta, simplemente `cd` a la raíz donde está `build.gradle.kts`.)

### 3.2 Configurar la base de datos

La conexión vive en
[`src/main/resources/application.properties`](src/main/resources/application.properties):

```properties
spring.datasource.url=jdbc:postgresql://<host>/<db>?sslmode=require&...
spring.datasource.username=<usuario>
spring.datasource.password=<clave>
```

Por defecto apunta a una base **Neon** ya cargada. Para usar otra base,
cambiá esos tres valores. También podés sobreescribirlos sin tocar el archivo,
con variables de entorno estándar de Spring Boot:

```bash
# Linux / macOS
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/animestock?..."
export SPRING_DATASOURCE_USERNAME=postgres
export SPRING_DATASOURCE_PASSWORD=postgres

# Windows PowerShell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/animestock?..."
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="postgres"
```

Notas:

- `spring.jpa.hibernate.ddl-auto=update` → Hibernate **crea/actualiza las tablas
  solo** la primera vez. No hace falta correr migraciones a mano.
- Hay un `compose.yaml` de ejemplo con un Postgres local, pero
  `spring.docker.compose.enabled=false` lo tiene desactivado a propósito (la app
  usa Neon, no Docker).
- ⚠️ Las credenciales están en texto plano en `application.properties`. Para un
  entorno real conviene moverlas a variables de entorno y no versionarlas.

### 3.3 Compilar

En la raíz del proyecto:

```powershell
# Windows
.\gradlew.bat build
```

```bash
# Linux / macOS
./gradlew build
```

Esto compila el Java, procesa los recursos (HTML/CSS/JS) y arma el `.jar`
ejecutable en `build/libs/springboot-0.0.1-SNAPSHOT.jar`.

- Si **no tenés** la base disponible y querés compilar igual, salteá los tests:

  ```powershell
  .\gradlew.bat build -x test
  ```

- Si ya compilaste y solo querés actualizar recursos (por ejemplo, después de
  tocar el HTML/CSS/JS):

  ```powershell
  .\gradlew.bat processResources
  ```

### 3.4 Ejecutar

**Opción A — en desarrollo (recomendada):**

```powershell
# Windows
.\gradlew.bat bootRun
```

```bash
# Linux / macOS
./gradlew bootRun
```

**Opción B — con el `.jar` ya compilado:**

```powershell
.\gradlew.bat build -x test
java -jar build\libs\springboot-0.0.1-SNAPSHOT.jar
```

El servidor escucha en el puerto **8080** por defecto. Para cambiarlo:

```powershell
$env:PORT=9090; .\gradlew.bat bootRun
```

### 3.5 Abrir la aplicación

Con el servidor corriendo, abrí en el navegador:

```
http://localhost:8080
```

Deberías ver el **Dashboard**. Desde el sidebar navegás a cada pantalla por su
propia URL:

| Pantalla | URL |
|----------|-----|
| Dashboard | `http://localhost:8080/` |
| Inventario | `http://localhost:8080/inventario` |
| Proveedores / Compras | `http://localhost:8080/proveedores` |
| Ventas | `http://localhost:8080/ventas` |
| Pedidos | `http://localhost:8080/pedidos` |
| Caja | `http://localhost:8080/caja` |
| Reportes | `http://localhost:8080/reportes` |
| Configuración | `http://localhost:8080/configuracion` |

Si la base está vacía, los KPIs muestran `$0` y valores en cero; es lo esperado
hasta que cargues productos y ventas.

---

## 4. Estructura del proyecto

```
springboot/
├── build.gradle.kts              # dependencias, Java 27, Spring Boot 4.1.1
├── settings.gradle.kts
├── gradlew / gradlew.bat         # wrapper de Gradle 9.7.1
├── compose.yaml                  # Postgres local de ejemplo (desactivado)
├── README.md                     # este archivo
├── PANORAMA-TECNICO.md           # doc técnica del backend
└── src/
    ├── main/
    │   ├── java/com/example/springboot/
    │   │   ├── SpringbootApplication.java
    │   │   ├── Controller/       # endpoints REST + ApiExceptionHandler + HomeController
    │   │   ├── Service/          # ApiService (lógica + mapeo DTO) y servicios JPA
    │   │   ├── Repository/       # Spring Data JPA
    │   │   ├── Models/           # entidades (Producto, Categoria, Venta, ...)
    │   │   └── DTO/              # requests/responses (ProductoRequest, PaginaResponse, ...)
    │   └── resources/
    │       ├── application.properties
    │       ├── templates/        # una plantilla por pantalla
    │       │   ├── fragments/
    │       │   │   └── layout.html   # head · sidebar · topbar · modales · scripts
    │       │   ├── index.html        # Dashboard  (/)
    │       │   ├── inventario.html   # /inventario
    │       │   ├── proveedores.html  # /proveedores
    │       │   ├── ventas.html       # /ventas
    │       │   ├── pedidos.html      # /pedidos
    │       │   ├── caja.html         # /caja
    │       │   ├── reportes.html     # /reportes
    │       │   └── configuracion.html# /configuracion
    │       └── static/
    │           ├── css/          # styles.css · sales.css · pages.css · reports.css · print.css
    │           ├── js/           # mock-data.js · ui.js (kit compartido) · app.js
    │           │                 # dashboard.js · inventory.js · sales.js · checkout.js
    │           │                 # receipt.js · cash.js · reports.js · charts.js
    │           │                 # orders.js · settings.js · suppliers.js
    │           ├── icons/
    │           ├── manifest.json
    │           └── sw.js         # service worker (PWA)
    └── test/java/com/example/springboot/
        ├── SpringbootApplicationTests.java
        └── ApiServiceSmokeTest.java
```

---

## 5. Cómo usar la aplicación

La barra lateral tiene 8 secciones, cada una con su propia URL. **Todas están
operativas**: Dashboard, Inventario, Proveedores, Ventas, Pedidos, Caja,
Reportes y Configuración. Compará con el [roadmap](#10-estado-del-proyecto-y-roadmap)
para ver qué depende del backend y qué es local.

### 5.1 Dashboard

Resumen general: 4 KPIs (ventas del mes, pedidos activos, stock bajo, nuevos
clientes), gráfico de área de ingresos mensuales, donut de ventas por categoría
y tabla de últimas ventas. Se alimenta de `GET /api/dashboard`.

### 5.2 Inventario

Control del catálogo. Es la vista más completa:

- **4 KPIs**: Productos activos · Valor de inventario (Σ costo × stock) ·
  Stock bajo · Valor de venta (Σ precio × stock).
- **Filtros**: búsqueda por **nombre / anime / SKU / categoría**, selector de
  categoría, filtro de **stock** (todos / bajo mínimo / sin stock / en stock),
  **orden** (nombre A-Z, stock ascendente, precio descendente, más recientes) y
  **tamaño de página** (10 / 25 / 50). El botón **Limpiar filtros** los resetea.
- **Tabla** (8 columnas): Producto (miniatura + nombre + SKU), Anime, Categoría,
  Costo, Precio, Margen %, Stock (barra de color + `n / min m`) y Acciones.
- **Stock**: rojo cuando es `0` (fila atenuada + badge **Agotado**), amarillo
  cuando está por debajo del `stock mínimo`, verde cuando está bien.
- **Acciones por fila**: 👁️ ver (detalle de solo lectura), ✏️ editar, 🗑️ eliminar
  (con confirmación).
- **+ Nuevo producto**: abre un modal de dos columnas con imagen a la izquierda
  (arrastrar y soltar o clic) y los campos a la derecha: nombre, anime,
  categoría (con botón **+** para crear una categoría al vuelo), SKU (se
  autogenera si lo dejás vacío), costo, precio, stock, stock mínimo y el check
  *Producto activo*. Valida nombre (2-80), números ≥ 0 y avisa si el **precio es
  menor que el costo**.
- **Imagen del producto**: al guardar, la imagen se **sube al servidor**
  (`POST /api/products/{id}/image`, multipart, JPG/PNG/WebP hasta 5 MB) y queda
  persistida; se puede **quitar** con el botón *Quitar imagen*
  (`DELETE /api/products/{id}/image`). El backend la sirve desde
  `GET /api/products/{id}/image`.
- **Exportar CSV**: descarga **todo** el conjunto filtrado, con BOM UTF-8 y
  separador `;` para que Excel en español lo abra bien (archivo
  `inventario-AAAA-MM-DD.csv`).

> Ver la sección [7](#7-inventario-notas-técnicas-y-limitaciones) para los
> detalles de paginación y de la imagen.

### 5.3 Ventas

Listado de ventas con 4 mini-KPIs, filtros (texto, método de pago, estado y
período), paginación y acciones por fila: ver comprobante, reimprimir, **cobrar**
y editar (ambas solo si está **pendiente**) y anular (con confirmación). Botón
**Exportar CSV** y **+ Nueva venta**.

- **Cobrar** abre el checkout sobre la venta pendiente con el estado ya puesto en
  **Pagado**, así al confirmar se registra el ingreso en caja (es la misma acción
  que el **💵 Cobrar** de Pedidos).

### 5.4 Checkout (nueva venta)

Se abre con **+ Nueva venta** (topbar o panel Ventas):

1. Buscás productos (solo con stock), los agregás al carrito (clic repetido suma
   cantidad).
2. Ajustás cantidades con +/− y el precio unitario; se valida contra el stock.
3. Elegís cliente. Por ahora **siempre es «Consumidor final»** (ver
   limitaciones).
4. Elegís forma de pago (Efectivo, Transferencia, MercadoPago, PayPal, Otro),
   podés aplicar un descuento (% o monto) y, en efectivo, calcula el vuelto.
5. Estado: **Pagado** (genera ingreso en caja), **Pendiente** o **Enviado**.
6. Al confirmar: se crea la venta, **se descuenta el stock**, se registra el
   ingreso en caja (si está pagada) y se abre el **comprobante**.

### 5.5 Comprobante

Ticket de 80 mm (con toggle A4 para impresora común). Permite imprimir
(`window.print()`), descargar como HTML y enviar por email. Muestra cliente,
fecha/hora, ítems, subtotal, descuento, total, método de pago, recibido/vuelto,
estado y notas.

### 5.6 Caja

3 mini-KPIs (Ingresos, Egresos, Saldo) del período elegido, tabla de movimientos
(INGRESO/EGRESO) con su comprobante o marca «Manual», y **+ Nuevo movimiento**
para cargar un ingreso/egreso manual.

- Una venta cobrada suma un **ingreso**.
- Anular una venta pendiente **no** genera egreso.
- Anular una venta pagada devuelve el stock y genera un **egreso** de reversión.
- **+ Nueva venta** abre el mismo checkout que el resto de la app sin salir de
  Caja (venta/cobro directo desde el mostrador).

**Turno de caja (apertura / cierre)** — barra de estado arriba de los KPIs:

- **Abrir caja** registra el **fondo inicial** del turno.
- **Cerrar caja** abre el **arqueo**: calcula el *esperado en caja* como
  `fondo inicial + ingresos − egresos` del turno, te deja cargar el **efectivo
  contado** y guarda la **diferencia**.
- El turno se guarda en el navegador (`localStorage · animestock:cash:session`):
  el backend todavía no modela turnos de caja. El cierre se resume en la barra
  («Último cierre … · diferencia …»).

### 5.7 Reportes

KPIs de ingresos/ganancia y detalle de ventas del período, con **Exportar CSV**.
Se alimenta de `GET /api/reports?from=&to=`.

### 5.8 Pedidos

Tablero (kanban) de las ventas **en curso**, sin endpoint nuevo: las columnas se
derivan de `GET /api/sales?status=…`.

- **Por cobrar** → ventas con estado `PENDIENTE`.
- **En camino** → ventas con estado `ENVIADO`.
- **4 mini-KPIs**: pedidos por cobrar, monto por cobrar, pedidos en camino y
  monto en camino.
- Cada tarjeta muestra comprobante, estado, fecha, cliente, resumen de productos
  y total. Acciones: **👁 Ver** (abre el comprobante) y **💵 Cobrar** (abre el
  checkout sobre esa venta pendiente para pasarla a pagada).
- **+ Nuevo pedido** y **⟳ Actualizar**.

### 5.9 Proveedores / Compras

Registro de compras a proveedores y reposición de stock.

- **4 mini-KPIs**: compras del mes, invertido en el mes, unidades ingresadas y
  proveedores distintos.
- **Tabla** de compras: fecha, proveedor, productos, unidades, total, estado
  (Recibida / Pendiente, y si está pagada) y acciones.
- **+ Nueva compra**: elegís proveedor, fecha, estado (Recibida/Pendiente) y pago
  (Pagada/A pagar), y cargás líneas con producto, cantidad y costo unitario. Al
  **Recibida** se aplica de verdad contra la API: sube el stock con
  `PUT /api/products/{id}` y, si está **Pagada**, registra un **EGRESO** con
  `POST /api/cash/movements`.
- El **registro** de compras se guarda en el navegador
  (`localStorage · animestock:purchases`): el backend todavía no tiene endpoints
  de proveedores/compras. Las compras **pendientes** se pueden «Recibir» después
  desde la tabla.

### 5.10 Configuración

Preferencias de la tienda y del panel: nombre, email, teléfono, dirección,
moneda, umbral de stock bajo, IVA %, filas por página y resaltado de agotados.
Se guardan en `localStorage · animestock:settings` (todavía no existe
`/api/settings`). Incluye **Guardar cambios** y **Restablecer**. El módulo expone
`window.AnimeStockSettings.get()` para que otras vistas lean estos valores.

> **Pedidos, Proveedores y Configuración** reutilizan el mismo kit de UI, la
> misma paleta y los mismos componentes (mini-KPIs, tarjetas, tabla, modales) que
> el resto, así que se ven nativos.

---

## 6. API REST

Todas las rutas viven bajo `/api`. Errores de negocio responden JSON con el
código correcto: `400` (validación), `409` (conflicto) y `500` (error interno),
vía `ApiExceptionHandler`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/dashboard` | KPIs + serie mensual + donut + últimas ventas |
| `GET` | `/api/products?query=&category=&inStockOnly=&limit=` | Productos (paginado). **No acepta `offset`** |
| `GET` | `/api/products/{id}` | Detalle de un producto |
| `GET` | `/api/products/{id}/image` | Imagen del producto (solo si existe) |
| `POST` | `/api/products/{id}/image` | **Sube/reemplaza la imagen** (multipart, campo `file`; JPG/PNG/WebP ≤ 5 MB) |
| `DELETE` | `/api/products/{id}/image` | **Quita la imagen** del producto |
| `POST` | `/api/products` | Alta. Body `ProductoRequest` (JSON) |
| `PUT` | `/api/products/{id}` | Edición. Body `ProductoRequest` |
| `DELETE` | `/api/products/{id}` | Baja |
| `GET` | `/api/categories` | Listado de categorías |
| `POST` | `/api/categories` | Alta. Body `{ "nombre": "..." }` |
| `PUT` | `/api/categories/{id}` | Edición |
| `DELETE` | `/api/categories/{id}` | Baja |
| `GET` | `/api/sales?limit=&offset=&status=&payment=&q=&from=&to=` | Ventas paginadas con filtros |
| `GET` | `/api/sales/{id}` | Detalle de una venta |
| `POST` | `/api/sales` | Crear venta (descuenta stock + crea movimiento de caja) |
| `PUT` | `/api/sales/{id}` | Editar (solo si está **pendiente**) |
| `DELETE` | `/api/sales/{id}` | Anular (devuelve stock, revierte caja) |
| `GET` | `/api/customers?q=` | Clientes. **Siempre devuelve vacío** (ver nota) |
| `POST` | `/api/customers` | Alta. **No soportada** (responde 400) |
| `GET` | `/api/cash/movements?from=&to=&limit=&offset=` | Movimientos de caja |
| `POST` | `/api/cash/movements` | Alta manual de movimiento |
| `GET` | `/api/reports?from=&to=` | KPIs + detalle de ventas del período |

**`ProductoRequest`** (alta/edición de producto):

```json
{
  "sku": "PLU-TOT-40",
  "nombre": "Peluchito Totoro 40cm",
  "anime": "Mi Vecino Totoro",
  "categoriaId": 3,
  "costo": 120.00,
  "precio": 250.00,
  "stock": 5,
  "stockMinimo": 2,
  "activo": true
}
```

**`ProductoResponse`** (lo que devuelve la API):

```json
{
  "id": 3,
  "sku": "PLU-PRO-5A",
  "name": "Peluchito Totoro 40cm",
  "anime": "Mi Vecino Totoro",
  "category": "Figuras",
  "emoji": null,
  "cost": 120.00,
  "price": 250.00,
  "stock": 5,
  "minStock": 2,
  "active": true,
  "imageUrl": null
}
```

Las listas paginadas usan el sobre **`PaginaResponse`**:

```json
{ "content": [ ... ], "page": 0, "size": 25, "totalElements": 137, "totalPages": 6, "from": null, "to": null }
```

---

## 7. Inventario: notas técnicas y limitaciones

El panel de Inventario se adaptó a lo que el backend **realmente ofrece** hoy.
Estas son las decisiones y sus motivos:

- **Paginación y filtros en el cliente.** `GET /api/products` **no acepta
  `offset`**: solo `query`, `category`, `inStockOnly` y `limit`, y siempre
  devuelve la página 0. Por eso la vista trae el catálogo (tope defensivo de
  1000) y aplica **búsqueda, filtro de categoría, filtro de stock, orden y
  paginación en el navegador**. Cuando el backend soporte `offset`, alcanza con
  mover esos filtros a la query (la capa de datos ya envía `query`, `category`,
  `limit` y `offset` en `fetchProducts`).
- **Búsqueda por SKU.** El backend busca por nombre + anime (+ categoría), **no
  por SKU**. Como el filtrado es en el cliente, el buscador de la vista **sí**
  matchea nombre, anime, SKU y categoría. El `input` tiene *debounce* de 300 ms.
- **Imagen persistida.** El producto puede tener una foto. Al guardar el
  producto, la imagen elegida en el modal (arrastrar y soltar o clic, JPG/PNG/
  WebP hasta 5 MB) se sube con `POST /api/products/{id}/image` (multipart, campo
  `file`) y el backend la guarda en la tabla `Foto` (`bytea`). Se puede quitar
  con *Quitar imagen* (`DELETE /api/products/{id}/image`). El flag
  `USE_LOCAL_IMAGES = false` en `inventory.js` indica que ya se sube de verdad;
  si el backend no tuviera el endpoint (405), la vista avisa con un toast y no
  se pierde el producto. Solo se aceptan tipos raster (jpeg/png/webp/gif): **nada
  de SVG**, para no permitir scripts embebidos. La URL incluye `?v=<id de foto>`
  para invalidar la caché al reemplazar la imagen.
- **Miniatura.** Si el producto tiene `imageUrl`, se muestra la foto; si no (o si
  falla la carga), cae a un círculo con degradado y las iniciales del nombre (o
  el `emoji` del producto).
- **«Stock bajo».** Se considera bajo cuando `0 < stock < stockMinimo`, y
  **agotado** cuando `stock == 0`. Ojo: los productos con `stockMinimo = 0` nunca
  entran en «bajo» (solo en «agotado» si llegan a 0).

### Clientes

`GET /api/customers` devuelve **siempre vacío** y `POST /api/customers` responde
**400**: el backend no persiste clientes (decisión «Opción A», todo va a
«Consumidor final»). Por eso el checkout trabaja con Consumidor final.

---

## 8. Flujo completo de venta (guía de prueba)

Para verificar que la app quedó **funcional de punta a punta**:

1. **Levantá la app** (`.\gradlew.bat bootRun`) y abrí <http://localhost:8080>.
2. **Inventario → + Nuevo producto**: creá, por ejemplo,
   *«Gojo chibi»*, anime *Jujutsu Kaisen*, categoría *Figuras* (creala con el
   botón **+**), costo `120`, precio `250`, stock `10`, stock mínimo `3`.
   **Subí una imagen** (arrastrá un JPG/PNG/WebP o hacé clic) y Guardá.
   Debería aparecer en la tabla con su miniatura y subir los KPIs. Recargá la
   página: la imagen **sigue ahí** (quedó guardada en el servidor).
3. Cargá **2 o 3 productos más**, y a uno ponele **stock `0`** para ver el badge
   **Agotado** y la fila atenuada. Probá los filtros, el orden y la paginación.
4. **Exportar CSV** y abrilo en Excel: los acentos deben verse bien.
5. **+ Nueva venta** (topbar): agregá productos al carrito, elegí **Efectivo**,
   poné un monto recibido mayor al total y confirmá. Se abre el **comprobante**.
6. **Ventas**: aparece la venta; el **stock bajó** en Inventario (volvé a la
   sección y refrescá: los KPIs cambian).
7. **Caja**: aparece el **INGRESO** de la venta cobrada.
8. **Ventas → anular** esa venta pagada: el stock **vuelve** y aparece un
   **EGRESO** de reversión en Caja.
9. **Reportes**: se ve el detalle del período.
10. **Inventario → editar** un producto y **eliminar** otro (con confirmación).
11. Recargá la página: todo lo anterior **persiste** (está en PostgreSQL).
12. **Pedidos**: la venta **pendiente** (si creaste una) aparece en la columna
    *Por cobrar*; tocá **💵 Cobrar** para pasarla a pagada sin salir del tablero.
13. **Proveedores → + Nueva compra**: elegí un producto, cantidad y costo, con
    estado *Recibida* y pago *Pagada*. Al guardar, el **stock sube** en Inventario
    y aparece un **EGRESO** en Caja.
14. **Configuración**: cambiá el nombre de la tienda y guardá; recargá y verificá
    que se mantiene (queda en `localStorage`).
15. **Ventas → 💵 Cobrar**: creá una venta en estado *Pendiente* y, en la tabla de
    Ventas, tocá **💵 Cobrar** en su fila: el checkout se abre con el estado ya en
    **Pagado**; confirmá y el **ingreso** entra a Caja.
16. **Caja → Abrir caja**: cargá un fondo inicial (p. ej. `5000`). Después hacé
    alguna venta y tocá **Cerrar caja** para ver el **arqueo** (esperado vs.
    contado) y la **diferencia**. La barra queda en «Último cierre …».
17. **Caja → + Nueva venta**: comprobá que podés cobrar una venta sin salir de la
    pantalla de Caja.

> Si algo falla con un 400 al guardar, el mensaje del backend aparece **inline**
> en el modal sin romper la pantalla.

---

## 9. Problemas comunes

| Síntoma | Causa probable / solución |
|---------|---------------------------|
| `Could not find or load main class` o error de toolchain | No tenés **JDK 27**. Instalalo y verificá `java -version`. |
| La app no arranca y el log muestra un error de conexión a la base | La URL/usuario/clave de Neon son incorrectos o no hay Internet. Revisá `application.properties`. |
| `Port 8080 was already in use` | Ya hay algo en el 8080. Usá `$env:PORT=9090; .\gradlew.bat bootRun` o cerrá el proceso anterior. |
| Cambié el HTML/CSS/JS y no se ve el cambio | En desarrollo, corré `.\gradlew.bat processResources` y recargá. El service worker trabaja en **network-first**, así que igual ves los cambios al recargar; si quedó algo raro, subí `CACHE_VERSION` en `static/sw.js` (hoy `animestock-v4`) o desregistrá el SW en DevTools → *Application → Service Workers*. |
| El wrapper tarda la primera vez | Está descargando Gradle 9.7.1. Necesita Internet; después queda cacheado. |
| `build` falla por los tests | Los tests levantan el contexto de Spring (y necesitan DB). Usá `.\gradlew.bat build -x test`. |
| El frontend no llamó a la API (404) | Confirmá que estás entrando por `http://localhost:8080` (mismo origen) y no abriendo el `index.html` con doble clic. |

---

## 10. Estado del proyecto y roadmap

**Listo y funcional**

- ✅ Arquitectura **multipágina** con Thymeleaf: layout compartido, una plantilla
  y una URL por pantalla, cada vista carga solo sus scripts.
- ✅ Dashboard con KPIs, gráficos y últimas ventas.
- ✅ **Inventario**: KPIs, búsqueda/filtros/orden, tabla paginada, export CSV,
  ABM de productos (crear / ver / editar / eliminar) y **subida de imagen
  persistida** (`POST/DELETE /api/products/{id}/image`).
- ✅ **Proveedores / Compras**: registro de compras + reposición de stock real
  vía API (+ egreso en Caja si está pagada).
- ✅ Ventas: listado, filtros, export CSV, ver/reimprimir/**cobrar**/editar/anular.
- ✅ **Pedidos**: tablero de ventas pendientes/enviadas con cobro directo.
- ✅ Checkout completo + comprobante imprimible.
- ✅ **Caja**: ingresos/egresos/saldo, movimiento manual, **cobro/venta directo**
  y **turno de caja (apertura con fondo + cierre con arqueo)**.
- ✅ Reportes del período + export CSV.
- ✅ **Configuración**: preferencias de la tienda persistidas en el navegador.
- ✅ PWA (manifest + service worker).

**Pendiente / por mejorar**

- ⏳ **`offset` en `GET /api/products`** para paginar/filtrar en el servidor.
- ⏳ **Clientes persistentes**: hoy `GET /api/customers` siempre vacío y el alta
  responde 400; todo es «Consumidor final».
- ⏳ **Backend de Proveedores/Compras**: hoy el registro de compras vive en
  `localStorage`; falta `/api/purchases` y `/api/suppliers`.
- ⏳ **Backend de Configuración**: falta `/api/settings`; hoy se guarda en
  `localStorage`.
- ⏳ **Backend de turnos de caja**: la apertura/cierre (fondo y arqueo) hoy vive en
  `localStorage`; falta un endpoint de sesiones de caja.
- ⏳ Tests automáticos (hoy hay un smoke test mínimo).

---

<p align="center"><sub>Hecho con Spring Boot + JavaScript vanilla, sin frameworks de frontend.</sub></p>
