# Seguridad

## Estado actual

El endpoint de personal usa un PIN compartido para emitir un token aleatorio que vive solamente en memoria. Ese token protege las acciones internas actuales, pero no constituye autenticacion completa: no hay usuarios individuales, sesiones persistentes ni autorizacion por rol. Tampoco existen pagos en el sistema actual.

El valor de `STAFF_PIN` puede suministrarse mediante el entorno. Los secretos nunca deben guardarse en el repositorio, archivos de ejemplo con valores reales, logs, tests ni documentacion. `.env` y sus variantes locales estan ignorados.

## Resuelto en la Mision 002

- Las acciones internas `pedido_estado`, `alerta_atender`, `alerta_resolver`, `mesa_liberar` y `reset_demo` exigen un Bearer token valido emitido tras verificar el PIN.
- Las acciones de cliente `pedido_nuevo`, `llamar_mozo`, `pedir_cuenta` y `ayuda` siguen disponibles sin login.
- El servidor reconstruye nombres y precios desde `menu-rabieta.json`; rechaza productos, variantes y opciones invalidas.
- Existe una allowlist de acciones y se validan mesas y transiciones de estado de pedidos antes de modificar el estado.
- Los textos libres se escapan antes de insertarse en vistas construidas con `innerHTML`.
- Los bodies JSON tienen un limite de 32 KB; JSON invalido devuelve `400` y un body demasiado grande devuelve `413`.

Estas protecciones estan cubiertas por pruebas automatizadas nativas de Node.js. Deben volver a ejecutarse con `npm test` y `npm run check` después de cada cambio relevante.

## Pendiente

Estos riesgos describen el codigo actual. Se registran para orientar trabajo futuro; no estan solucionados por esta documentacion.

- No existe rate limiting.
- El PIN es compartido y no identifica usuarios individuales.
- No existen sesiones ni autorizacion real por roles.
- Los tokens viven en memoria, no expiran y no existe un mecanismo de revocacion o cierre de sesion.
- Las acciones publicas de clientes no autentican que quien envia la solicitud pertenezca realmente a la mesa indicada.
- SSE distribuye el estado completo a los clientes conectados a `/events`.
- El estado operativo existe solamente en memoria y se pierde al reiniciar el proceso.

## Reglas de cambio

Requieren aprobacion humana previa:

- acceso o cambios en produccion;
- uso de datos reales o secretos;
- cambios de precios o productos;
- integraciones de pagos;
- migraciones destructivas;
- acciones irreversibles.

Antes de afirmar que una proteccion funciona hay que verificarla. Los hallazgos deben describir el riesgo real sin presentar el PIN actual como un mecanismo de seguridad suficiente.
