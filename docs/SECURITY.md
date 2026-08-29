# Seguridad

## Estado actual

El endpoint de personal usa un PIN compartido. Esto es una barrera basica de interfaz, no autenticacion real: no hay usuarios individuales, sesiones, autorizacion por rol ni proteccion general de la API. Tampoco existen pagos en el sistema actual.

El valor de `STAFF_PIN` puede suministrarse mediante el entorno. Los secretos nunca deben guardarse en el repositorio, archivos de ejemplo con valores reales, logs, tests ni documentacion. `.env` y sus variantes locales estan ignorados.

## Riesgos actuales pendientes

Estos riesgos describen el codigo actual. Se registran para orientar trabajo futuro; no estan solucionados por esta documentacion.

- `POST /api/action` no tiene autenticacion real.
- La accion `reset_demo` puede modificar o eliminar el estado operativo sin proteccion suficiente.
- El servidor no valida completamente los productos y precios recibidos en un pedido contra `menu-rabieta.json`.
- Existe riesgo de stored XSS cuando textos libres persisten en memoria y luego se muestran mediante `innerHTML`.
- No existe rate limiting.
- No existe un limite robusto para el tamano del body de las solicitudes.
- El PIN es compartido y no identifica usuarios individuales.
- No existen sesiones ni autorizacion real por roles.
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
