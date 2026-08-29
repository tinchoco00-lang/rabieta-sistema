# Arquitectura actual

Rabieta es actualmente un MVP ejecutado por un unico proceso de Node.js 18 o superior, sin dependencias externas. `server.js` es el punto de entrada y el codigo real es la fuente de verdad sobre el comportamiento del sistema.

## Componentes existentes

- `server.js`: servidor HTTP, API, archivos estaticos y eventos en vivo mediante Server-Sent Events (SSE).
- `menu-rabieta.json`: catalogo y metadatos consumidos por el servidor.
- `public/mesa.html`: entrada de la experiencia de mesa.
- `public/staff.html`: panel de personal protegido por un PIN simple.
- `public/app.js` y `public/rabieta.css`: comportamiento y presentacion compartidos por la interfaz.

El estado operativo vive en memoria. Un reinicio del proceso elimina mesas ocupadas, pedidos y alertas en curso. En la rama principal no hay una base de datos activa, multi-tenant, pagos ni autenticacion real de API.

## Interfaces verificables

- `GET /api/menu` entrega el menu.
- `POST /api/staff-login` compara el PIN recibido con `STAFF_PIN` o el valor local por defecto.
- `POST /api/action` cambia el estado en memoria.
- `GET /events` distribuye el estado mediante SSE.
- Las demas rutas se resuelven como archivos estaticos bajo `public/`.

Los tests de integracion levantan el proceso real en un puerto local temporal y verifican rutas criticas sin modificar el servidor.
