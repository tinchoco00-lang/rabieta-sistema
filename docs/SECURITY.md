# Seguridad

## Estado actual

El endpoint de personal usa un PIN compartido para emitir un token aleatorio que vive solamente en memoria. Ese token protege las acciones internas actuales, pero no constituye autenticacion completa: no hay usuarios individuales, sesiones persistentes ni autorizacion por rol. Tampoco existen pagos en el sistema actual.

El valor de `STAFF_PIN` puede suministrarse mediante el entorno. Los secretos nunca deben guardarse en el repositorio, archivos de ejemplo con valores reales, logs, tests ni documentacion. `.env` y sus variantes locales estan ignorados.

## Resuelto en la Mision 002

- Las acciones internas `pedido_estado`, `alerta_atender`, `alerta_resolver`, `pago_demo_confirmar`, `mesa_liberar` y `reset_demo` exigen un Bearer token valido emitido tras verificar el PIN. El token expira automáticamente a las 8 horas y los tokens vencidos se eliminan de memoria.
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
- El panel autenticado ya genera localmente los QR y enlaces vinculados a cada mesa sin enviar el token a servicios externos. Siguen pendientes el procedimiento físico de impresión/colocación y la rotación coordinada del secreto en el local.
- Sin `DATABASE_URL`, el estado operativo existe solamente en memoria y se pierde al reiniciar el proceso. Con PostgreSQL hay continuidad del estado completo, pero todavía no existen historial, auditoria ni un esquema relacional definitivo.
- Un futuro ledger de metricas puede contener datos personales u operativos sensibles; antes de usar datos reales necesita minimizacion, permisos, retencion, borrado y auditoria definidos.
- `pago_demo_confirmar` es solamente una marca operativa de sandbox: calcula el total desde el pedido validado, no acepta datos de tarjeta, no llama a un proveedor y no representa dinero cobrado.
- Los pagos reales futuros deben confirmar estado exclusivamente desde el proveedor mediante webhooks autenticados e idempotentes, con conciliacion y manejo explicito de estados inciertos. Una pantalla del cliente nunca sera prueba suficiente de pago.

## Trust Foundation — #45A (ledger de confianza)

Esta sección documenta con precisión qué garantiza y qué NO garantiza el
Trust Event Contract V1 (`trust/`) agregado en #45A. El objetivo es no
sobre-prometer: cada guarantee de abajo está probada por
`test/trust.server.test.js`; lo que no está probado se lista aparte como
pendiente.

### Identidad y `shared_credential`

- El staff sigue autenticándose con un PIN **compartido por rol**
  (`STAFF_PIN`/`STAFF_PINS`), igual que documenta la sección de arriba. El
  Trust Event Contract no cambia eso ni lo oculta: todo evento generado por
  una sesión de staff lleva `actor.identityAssurance: 'shared_credential'`,
  nunca un nivel de certeza mayor.
- Qué garantiza hoy: cada login emite un `authSessionId` nuevo (UUID), así
  que se puede distinguir "esta sesión de login" de otra, y el `actorId` es
  estable por rol (nunca se arma con `MOZOS` ni con ningún nombre propio).
- Qué NO garantiza hoy: que la persona detrás del PIN sea siempre la misma,
  ni que dos empleados con el mismo rol sean distinguibles entre sí. Un
  evento con `role: 'mozo'` dice "alguien que tenía el PIN de mozo en ese
  momento", nunca "Fulano hizo esto". Ningún reporte ni vista debe presentar
  esto como identidad personal.
- Mejora de aislamiento por rol: no se implementó en #45A (requeriría PINs
  individuales o un login real, fuera del alcance de esta PR) para no
  romper la demo ni el flujo operativo actual. Queda como candidato de
  #45B/#45C si el negocio lo pide.

### Sesión de mesa (`mesaSessionId`) y replay entre ocupaciones

- Cada ocupación real de una mesa recibe un `mesaSessionId` (UUID) nuevo,
  estable mientras la mesa sigue ocupada, y se limpia (`null`) al liberarla.
  Se expone en el estado de esa mesa vía SSE (`GET /events?mesa=N`), así un
  cliente real puede conocer su propio `mesaSessionId`.
- Protección de replay implementada: si una request de acción (`pedido_nuevo`,
  `pedir_cuenta`, `llamar_mozo`, etc.) incluye `mesaSessionId` y la mesa está
  ocupada por una sesión **distinta**, el servidor la rechaza con `409` en
  vez de aplicarla — ver el test "replay: una acción vieja de la ocupación A
  nunca puede tocar la ocupación B" en `test/trust.server.test.js`.
- Límite honesto: esta protección es **opt-in por diseño** — solo actúa
  cuando quien llama efectivamente manda `mesaSessionId` en el body. El
  cliente público actual (`public/app.js`/`mesa.html`) todavía **no** lo
  hace en todas sus acciones, así que hoy en producción esta protección
  cierra el hueco a nivel de contrato/API pero no está siendo ejercitada
  todavía por el cliente real end-to-end. Cerrar eso (que el cliente lea su
  `mesaSessionId` del estado SSE y lo reenvíe en cada acción) queda
  pendiente y se documenta como riesgo MEDIUM, no como algo ya resuelto.

### Autorización y la cola de mutaciones (`enqueueMutation`)

- `staffSession(req)` ahora también purga tokens vencidos (antes solo lo
  hacía `validStaffToken`), y la validación de rol/token se repite **de
  nuevo, en fresco**, justo antes de ejecutar la mutación encolada — no solo
  al llegar el request. Si el token venció o el staff se deslogueó mientras
  la acción esperaba detrás de otras en la cola, la acción se aborta con
  `401`/`403` y nunca llega a `handleAction`.
- Test específico: `test/trust.server.test.js` fuerza esta ventana con una
  instrumentación de test explícita (`TRUST_TEST_QUEUE_DELAY_MS`, inactiva
  salvo que se la configure) para volver determinística una carrera que en
  producción normalmente dura microsegundos.

### Almacenamiento separado del estado operativo

- `MemoryTrustStore`/`PostgresTrustStore` viven fuera de `state`: un
  `reset_demo` (que reemplaza `state` entero) no borra el ledger.
- `trust_events` es una tabla independiente (ver `migrations/0001_trust_events.sql`),
  no otro snapshot JSONB — a diferencia de `rabieta_estado`.

### Postgres real: qué está probado y qué no

- Los tests con `FakePool` (inyección de pool al estilo `persistence.js`)
  prueban la forma del SQL emitido y el comportamiento del store en Node,
  pero **no** demuestran append-only real, atomicidad, permisos de DB,
  rollback ni que `TRUNCATE` quede efectivamente bloqueado.
- Este sandbox de desarrollo no tiene forma de levantar un Postgres real
  (`apt-get install postgresql` está bloqueado por la política de red del
  entorno), así que los tests reales contra Postgres (gateados con
  `{ skip: !process.env.DATABASE_URL }`, mismo patrón que
  `test/postgres.integration.test.js`) **no se ejecutaron localmente**. Sí
  se ejecutan en CI (`.github/workflows/ci.yml` levanta `postgres:16-alpine`),
  pero eso todavía no corrió para esta rama al momento de escribir esto.
  **Esto se reporta como limitación HIGH pendiente, no como validado.**
- El `REVOKE UPDATE, DELETE, TRUNCATE ON trust_events FROM PUBLIC` de la
  migración es una mitigación parcial: no protege contra el rol dueño de la
  tabla ni contra un superusuario, que es exactamente la conexión que la
  mayoría de los hostings gestionados usan por defecto. Ver el comentario en
  `migrations/0001_trust_events.sql` y `trust/postgresStore.js`.

### Multi-tenant: preparación, no un sistema multi-tenant

- `tenantId`/`localId` existen en cada evento y se resuelven en el servidor
  desde configuración (`TENANT_ID`/`LOCAL_ID`), nunca desde el body del
  request — pero esto es **preparación futura únicamente**. El snapshot
  operativo (`state`) sigue siendo un singleton: hay un solo local
  ("Rabieta Lomitas"), sin aislamiento de datos entre tenants, sin router
  por tenant y sin ningún otro componente multi-tenant real. No debe
  describirse como "sistema multi-tenant" en ningún reporte.

### Disciplina de lenguaje (claims)

Ninguna documentación, comentario o reporte de esta feature debe usar
"inmutable", "fraude imposible", "auditoría completa", "multi-tenant" (como
si ya fuera un sistema multi-tenant) o "pago real auditado" salvo que esté
efectivamente probado — hoy ninguno de esos cinco lo está en su forma
fuerte. Los términos correctos son los usados arriba: append-only con
límites documentados, ledger separado, preparación multi-tenant, e
identidad con `shared_credential` explícito.

## Reglas de cambio

Requieren aprobacion humana previa:

- acceso o cambios en produccion;
- uso de datos reales o secretos;
- cambios de precios o productos;
- integraciones de pagos;
- migraciones destructivas;
- acciones irreversibles.

Antes de afirmar que una proteccion funciona hay que verificarla. Los hallazgos deben describir el riesgo real sin presentar el PIN actual como un mecanismo de seguridad suficiente.
