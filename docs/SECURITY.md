# Seguridad

## Estado actual

El endpoint de personal usa un PIN compartido. Esto es una barrera basica de interfaz, no autenticacion real: no hay usuarios individuales, sesiones, autorizacion por rol ni proteccion general de la API. Tampoco existen pagos en el sistema actual.

El valor de `STAFF_PIN` puede suministrarse mediante el entorno. Los secretos nunca deben guardarse en el repositorio, archivos de ejemplo con valores reales, logs, tests ni documentacion. `.env` y sus variantes locales estan ignorados.

## Reglas de cambio

Requieren aprobacion humana previa:

- acceso o cambios en produccion;
- uso de datos reales o secretos;
- cambios de precios o productos;
- integraciones de pagos;
- migraciones destructivas;
- acciones irreversibles.

Antes de afirmar que una proteccion funciona hay que verificarla. Los hallazgos deben describir el riesgo real sin presentar el PIN actual como un mecanismo de seguridad suficiente.
