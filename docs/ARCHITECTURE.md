# Arquitectura actual

Rabieta es actualmente un MVP ejecutado por un unico proceso de Node.js 18 o superior. `server.js` es el punto de entrada y el codigo real es la fuente de verdad sobre el comportamiento del sistema.

## Componentes existentes

- `server.js`: servidor HTTP, API, archivos estaticos y eventos en vivo mediante Server-Sent Events (SSE).
- `persistence.js`: selecciona memoria o PostgreSQL y encapsula la tabla de continuidad del MVP.
- `operational.js`: resolución segura de IP, rate limiting y logging estructurado sin dependencias adicionales.
- `menu-rabieta.json`: catalogo y metadatos consumidos por el servidor.
- `public/mesa.html`: entrada de la experiencia de mesa.
- `public/staff.html`: panel de personal protegido por un PIN simple.
- `public/app.js` y `public/rabieta.css`: comportamiento y presentacion compartidos por la interfaz.

Sin `DATABASE_URL`, el estado operativo vive solamente en memoria y un reinicio elimina mesas ocupadas, pedidos y alertas. Con `DATABASE_URL`, el servidor crea la tabla `rabieta_estado`, recupera su unica fila al iniciar y guarda el estado completo como JSONB después de cada cambio valido. Si PostgreSQL falla cuando está configurado, el servidor informa el error y no reemplaza silenciosamente la persistencia por memoria.

Esta tabla de fila unica es una capa transitoria de continuidad para el MVP. No es el esquema relacional definitivo del futuro SaaS, no agrega multi-tenant y no resuelve auditoria, historial, metricas del piloto ni concurrencia entre multiples procesos.

El dominio actual mantiene un solo `pedido` activo por mesa, pero cada item tiene identidad, estado y timestamp de envio propios. El personal avanza cada item explicitamente y los adicionales nuevos no cambian el estado de los anteriores. `pedido.estado` se conserva como resumen compatible del item menos avanzado; la interfaz muestra el estado individual para no ocultar entregas parciales. Al recuperar el JSONB anterior, el servidor completa estos campos sin descartar el pedido existente.

La carta todavia no define el sector operativo de cada producto. Sus categorias comerciales no deben confundirse automaticamente con cocina, barra u otra estacion. Ese ruteo sigue pendiente de confirmar con el local antes de incorporarlo al modelo.

## Interfaces verificables

- `GET /api/menu` entrega el menu.
- `GET /healthz` confirma que el proceso HTTP responde sin publicar estado interno.
- `POST /api/staff-login` compara el PIN recibido con `STAFF_PIN` o el valor local por defecto.
- `POST /api/staff-logout` revoca el token de staff presentado.
- `POST /api/action` valida y cambia el estado; cuando PostgreSQL está activo confirma la escritura antes de responder éxito.
- Cada item permanece en `enviado` hasta que una accion autenticada de staff confirma su transicion a `preparando`; el reloj no simula actividad de cocina.
- La solicitud de cuenta conserva el pedido. En modo demostracion, staff puede registrar una confirmacion de pago calculada por el servidor y luego liberar la mesa; no existe proveedor, transaccion ni confirmacion bancaria real.
- `GET /events?mesa=N` distribuye mediante SSE solamente el estado de la mesa solicitada.
- `GET /api/staff-events` distribuye el estado completo al personal y exige un Bearer token válido en el header.
- Si `MESA_TOKEN_SECRET` está configurado, las acciones públicas y el stream cliente verifican un HMAC-SHA256 vinculado al número de mesa mediante `X-Mesa-Token`. El secreto y los tokens no se persisten.
- Sin `MESA_TOKEN_SECRET`, se conserva temporalmente el modo legacy y el servidor emite un warning seguro al iniciar.
- Las demas rutas se resuelven como archivos estaticos bajo `public/`.

## Direccion arquitectonica, no implementada

El piloto necesita registrar eventos inmutables con timestamps de reloj real, actor/canal, mesa, pedido, item, sector y motivo. A partir de esos eventos se deben derivar estados y metricas reproducibles. El sistema tambien debera soportar idempotencia y conciliacion para integraciones, aislamiento por restaurante/sucursal y degradacion operativa segura.

El esquema definitivo, multi-tenant y la retencion de datos siguen pendientes de decision. Esta direccion no autoriza una migracion destructiva ni el uso de datos reales.

Los tests de integracion levantan el proceso real en puertos temporales. Sin `DATABASE_URL` verifican el modo memoria. En CI, un servicio PostgreSQL oficial verifica la creacion automatica de la tabla, escritura, cierre, reinicio, recuperacion del estado y que los tokens de staff no sobrevivan al proceso.
