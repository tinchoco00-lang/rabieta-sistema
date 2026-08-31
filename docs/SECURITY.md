# Seguridad

## Estado actual

El endpoint de personal usa un PIN compartido para emitir un token aleatorio que vive solamente en memoria. Ese token protege las acciones internas actuales, pero no constituye autenticacion completa: no hay usuarios individuales, sesiones persistentes ni autorizacion por rol. Tampoco existen pagos en el sistema actual.

El valor de `STAFF_PIN` puede suministrarse mediante el entorno. Los secretos nunca deben guardarse en el repositorio, archivos de ejemplo con valores reales, logs, tests ni documentacion. `.env` y sus variantes locales estan ignorados.

## Resuelto en la Mision 002

- Las acciones internas `pedido_estado`, `alerta_atender`, `alerta_resolver`, `mesa_liberar` y `reset_demo` exigen un Bearer token valido emitido tras verificar el PIN. El token expira automáticamente a las 8 horas y los tokens vencidos se eliminan de memoria.
- Las acciones de cliente `pedido_nuevo`, `llamar_mozo`, `pedir_cuenta` y `ayuda` siguen disponibles sin login.
- El servidor reconstruye nombres y precios desde `menu-rabieta.json`; rechaza productos, variantes y opciones invalidas.
- Existe una allowlist de acciones y se validan mesas y transiciones de estado de pedidos antes de modificar el estado.
- Los textos libres se escapan antes de insertarse en vistas construidas con `innerHTML`.
- Los bodies JSON tienen un limite de 32 KB; JSON invalido devuelve `400` y un body demasiado grande devuelve `413`.
- `POST /api/staff-login` y `POST /api/action` solo procesan bodies con `Content-Type: application/json`; otros tipos devuelven `415` sin modificar estado.

Estas protecciones estan cubiertas por pruebas automatizadas nativas de Node.js. Deben volver a ejecutarse con `npm test` y `npm run check` después de cada cambio relevante.

## Resuelto en la Mision 004

- `POST /api/staff-login` y `POST /api/action` tienen rate limiting en memoria y devuelven `429` al superar el límite.
- Los límites se configuran con `RATE_LIMIT_WINDOW_MS`, `STAFF_LOGIN_RATE_LIMIT_MAX` y `API_ACTION_RATE_LIMIT_MAX`.
- Por defecto se usa la IP del socket. `X-Forwarded-For` solo se considera cuando el proxy inmediato está listado explícitamente en `TRUSTED_PROXY_IPS`; no se debe configurar esa lista sin conocer las IP reales del proxy autorizado.
- Cada respuesta incluye `X-Request-Id`. Los logs estructurados registran ruta, método, status y duración sin incluir bodies, PIN, tokens ni `DATABASE_URL`.
- `GET /healthz` informa solamente que el proceso responde, sin exponer estado operativo.
- `POST /api/staff-logout` revoca inmediatamente el Bearer token presentado.
- `GET /events?mesa=N` expone solamente el estado de esa mesa; no distribuye pedidos, alertas ni mesas ajenas.
- `GET /api/staff-events` exige un Bearer token válido y entrega el estado completo mediante fetch streaming/SSE, sin incluir el token en la URL. Los streams se cierran cuando su token vence o es revocado.
- Cuando existe `MESA_TOKEN_SECRET`, el servidor exige en `X-Mesa-Token` un HMAC-SHA256 válido para la misma mesa en streams y acciones públicas. El cliente toma el token del fragmento local `#token=...`, lo conserva en `sessionStorage` ligado a esa mesa, limpia la URL visible y nunca lo pone en query strings.
- Para no romper instalaciones existentes, la ausencia de `MESA_TOKEN_SECRET` mantiene el modo legacy y genera un warning estructurado que no incluye secretos ni tokens.
- Los errores inesperados devuelven una respuesta genérica con requestId y nunca incluyen stack traces.

## Pendiente

Estos riesgos describen el codigo actual. Se registran para orientar trabajo futuro; no estan solucionados por esta documentacion.

- El PIN es compartido y no identifica usuarios individuales.
- No existen sesiones ni autorizacion real por roles.
- La identidad HMAC de mesa solo queda activa cuando un operador configura `MESA_TOKEN_SECRET`; el modo legacy sin esa variable no autentica la mesa y debe considerarse transitorio.
- Todavía no existe generación ni distribución operativa de QR por mesa. Esta misión solamente implementa la validación compatible con futuros enlaces `mesa.html?mesa=N#token=...`.
- Sin `DATABASE_URL`, el estado operativo existe solamente en memoria y se pierde al reiniciar el proceso. Con PostgreSQL hay continuidad del estado completo, pero todavía no existen historial, auditoria ni un esquema relacional definitivo.

## Reglas de cambio

Requieren aprobacion humana previa:

- acceso o cambios en produccion;
- uso de datos reales o secretos;
- cambios de precios o productos;
- integraciones de pagos;
- migraciones destructivas;
- acciones irreversibles.

Antes de afirmar que una proteccion funciona hay que verificarla. Los hallazgos deben describir el riesgo real sin presentar el PIN actual como un mecanismo de seguridad suficiente.
