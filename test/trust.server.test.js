'use strict';

/*
 * Tests de integración del Trust Event Contract V1 contra el servidor real
 * (child process), en un archivo separado del monolito test/server.test.js
 * — igual que el propio ledger vive separado del estado operativo.
 */

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { after, before, test } = require('node:test');

const root = path.resolve(__dirname, '..');
const testPin = '4455';
let baseUrl, serverProcess, serverOutput = '';

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitUntilReady(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`El servidor terminó antes de iniciar.\n${serverOutput}`);
    try { if ((await fetch(`${url}/api/menu`)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`El servidor no inició dentro de ${timeoutMs} ms.\n${serverOutput}`);
}

function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const forceStop = setTimeout(() => { if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL'); }, 2000);
    forceStop.unref();
    serverProcess.once('exit', () => { clearTimeout(forceStop); resolve(); });
    serverProcess.kill('SIGTERM');
  });
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    // STAFF_LOGIN_RATE_LIMIT_MAX subido acá (default de producción: 20/min):
    // esta suite hace muchos más logins que un uso real para poder probar
    // authSessionId/actorId por separado en cada test, igual que hace
    // test/server.test.js para su propio servidor compartido.
    env: { ...process.env, PORT: String(port), STAFF_PIN: testPin, DATABASE_URL: '', STAFF_LOGIN_RATE_LIMIT_MAX: '500' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk; });
  await waitUntilReady(baseUrl);
});

after(stopServer);

async function loginAs(role) {
  const response = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin, role }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function action(body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}/api/action`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function trustEvents(token, query = '') {
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  return fetch(`${baseUrl}/api/trust/events${query}`, { headers });
}

async function readSseEvent(reader, pending = '') {
  const decoder = new TextDecoder();
  let body = pending;
  while (!body.includes('\n\n')) {
    const { done, value } = await reader.read();
    if (done) return { done: true, pending: body };
    body += decoder.decode(value, { stream: true });
  }
  const boundary = body.indexOf('\n\n');
  const chunk = body.slice(0, boundary);
  const dataLine = chunk.split('\n').find(line => line.startsWith('data: '));
  assert.ok(dataLine, 'SSE debe incluir una línea data');
  return { done: false, message: JSON.parse(dataLine.slice(6)), pending: body.slice(boundary + 2) };
}

// Levanta un servidor propio, independiente del compartido por el resto de
// la suite, para tests que necesitan variables de entorno distintas (por
// ejemplo TRUST_TEST_QUEUE_DELAY_MS) sin afectar la velocidad ni el estado
// del resto de los tests de este archivo.
async function withDedicatedServer(envOverrides, fn) {
  const port = await reservePort();
  const url = `http://127.0.0.1:${port}`;
  let output = '';
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), STAFF_PIN: testPin, DATABASE_URL: '', ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', chunk => { output += chunk; });
  proc.stderr.on('data', chunk => { output += chunk; });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`El servidor dedicado terminó antes de iniciar.\n${output}`);
    try { if ((await fetch(`${url}/api/menu`)).ok) break; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  try {
    await fn(url);
  } finally {
    if (proc.exitCode === null) {
      await new Promise(resolve => {
        const force = setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGKILL'); }, 2000);
        force.unref();
        proc.once('exit', () => { clearTimeout(force); resolve(); });
        proc.kill('SIGTERM');
      });
    }
  }
}

async function loginAt(url, role) {
  const response = await fetch(`${url}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin, role }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function actionAt(url, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${url}/api/action`, { method: 'POST', headers, body: JSON.stringify(body) });
}

test('ledger vacío al arrancar: dueño consulta y no hay eventos previos a esta suite', async () => {
  const dueno = await loginAs('dueno');
  const response = await trustEvents(dueno.token, '?after=999999999');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.events, []);
  assert.equal(body.nextCursor, null);
});

test('authSessionId nuevo por login, actorId estable (credencial compartida correcta)', async () => {
  const first = await loginAs('encargado');
  const second = await loginAs('encargado');
  const dueno = await loginAs('dueno');
  const response = await trustEvents(dueno.token, '?limit=200');
  const { events } = await response.json();
  const logins = events.filter(e => e.action === 'staff_login' && e.role === 'encargado');
  assert.ok(logins.length >= 2, 'debe haber al menos dos staff_login de encargado');
  const sessionIds = logins.map(e => e.authSessionId);
  assert.equal(new Set(sessionIds).size, sessionIds.length, 'cada login debe tener un authSessionId distinto');
  const actorIds = new Set(logins.map(e => e.actor.actorId));
  assert.equal(actorIds.size, 1, 'el actorId debe ser estable para la misma credencial de rol compartida');
  logins.forEach(event => {
    assert.equal(event.actor.identityAssurance, 'shared_credential');
    assert.equal(event.actor.kind, 'staff');
  });
});

test('MOZOS nunca se usa como autor de un evento de confianza', async () => {
  const dueno = await loginAs('dueno');
  const response = await trustEvents(dueno.token, '?limit=200');
  const { events } = await response.json();
  const MOZOS = ['Martín', 'Sofía', 'Lucas'];
  events.forEach(event => {
    MOZOS.forEach(nombre => {
      assert.ok(!event.actor.label.includes(nombre), `actor.label no debe contener "${nombre}": ${event.actor.label}`);
      assert.ok(!event.actor.actorId.includes(nombre), `actor.actorId no debe contener "${nombre}"`);
    });
  });
});

test('mesaSessionId: estable durante la ocupación, UUID nuevo en cada ocupación nueva', async () => {
  const encargado = await loginAs('encargado');
  const dueno = await loginAs('dueno');

  await action({ type: 'pedido_nuevo', mesa: 3, items: [{ productoId: 'hummus-rabieta' }] });
  await action({ type: 'pedido_nuevo', mesa: 3, items: [{ productoId: 'hummus-rabieta' }] }); // segunda ronda, misma ocupación
  const cuentaResponse = await action({ type: 'pedir_cuenta', mesa: 3 });
  assert.equal(cuentaResponse.status, 200);
  const pagoResponse = await action({ type: 'pago_demo_confirmar', mesa: 3 }, encargado.token);
  assert.equal(pagoResponse.status, 200);
  const liberarResponse = await action({ type: 'mesa_liberar', mesa: 3 }, encargado.token);
  assert.equal(liberarResponse.status, 200);
  await action({ type: 'pedido_nuevo', mesa: 3, items: [{ productoId: 'hummus-rabieta' }] }); // nueva ocupación

  const response = await trustEvents(dueno.token, '?limit=200');
  const { events } = await response.json();
  const sesionesMesa3 = events.filter(e => e.mesa === 3 && e.action === 'mesa_session_started');
  assert.equal(sesionesMesa3.length, 2, 'dos ocupaciones reales de la mesa 3 deben producir dos mesa_session_started');
  assert.notEqual(sesionesMesa3[0].mesaSessionId, sesionesMesa3[1].mesaSessionId, 'cada ocupación nueva debe tener un UUID distinto');

  const cierre = events.find(e => e.mesa === 3 && e.action === 'mesa_session_ended');
  assert.ok(cierre, 'mesa_liberar con una ocupación activa debe emitir mesa_session_ended');
  assert.equal(cierre.mesaSessionId, sesionesMesa3[0].mesaSessionId, 'el cierre debe referenciar la sesión que efectivamente terminó');
});

test('reset_demo no borra el MemoryTrustStore (vive fuera de state)', async () => {
  const dueno = await loginAs('dueno');
  const encargado = await loginAs('encargado');
  const before = await (await trustEvents(dueno.token, '?limit=200')).json();
  const countBefore = before.events.length;
  assert.ok(countBefore > 0, 'debe haber eventos previos de los tests anteriores');

  await action({ type: 'reset_demo' }, encargado.token);

  const after = await (await trustEvents(dueno.token, '?limit=200')).json();
  assert.ok(after.events.length >= countBefore, 'reset_demo no debe reducir el ledger de confianza');
});

test('query API: dueño y encargado sí, mozo/cocina/cliente no', async () => {
  const dueno = await loginAs('dueno');
  const encargado = await loginAs('encargado');
  const mozo = await loginAs('mozo');
  const cocina = await loginAs('cocina');

  assert.equal((await trustEvents(dueno.token)).status, 200);
  assert.equal((await trustEvents(encargado.token)).status, 200);
  assert.equal((await trustEvents(mozo.token)).status, 403);
  assert.equal((await trustEvents(cocina.token)).status, 403);
  assert.equal((await trustEvents(null)).status, 401); // "cliente": sin sesión de staff
});

test('paginación estable: cursor no repite ni salta eventos', async () => {
  const dueno = await loginAs('dueno');
  const firstPage = await (await trustEvents(dueno.token, '?limit=2')).json();
  assert.equal(firstPage.events.length, 2);
  assert.ok(Number.isInteger(firstPage.nextCursor));
  const secondPage = await (await trustEvents(dueno.token, `?limit=2&after=${firstPage.nextCursor}`)).json();
  const firstIds = new Set(firstPage.events.map(e => e.eventId));
  secondPage.events.forEach(event => assert.ok(!firstIds.has(event.eventId), 'la segunda página no debe repetir eventos de la primera'));
  secondPage.events.forEach(event => assert.ok(event.sequence > firstPage.nextCursor));
});

test('tenantId/localId nunca vienen del cliente: la query string no puede spoofearlos', async () => {
  const dueno = await loginAs('dueno');
  const response = await trustEvents(dueno.token, '?limit=200&tenantId=otro-tenant&localId=otro-local');
  const { events } = await response.json();
  assert.ok(events.length > 0);
  events.forEach(event => {
    assert.equal(event.tenantId, 'rabieta');
    assert.equal(event.localId, 'lomitas');
  });
});

test('privacidad: ningún secreto viaja serializado en un evento de confianza', async () => {
  const dueno = await loginAs('dueno');
  const response = await trustEvents(dueno.token, '?limit=200');
  const raw = await response.text();
  const prohibido = [testPin, 'Bearer ', 'Authorization', 'DATABASE_URL', 'MESA_TOKEN_SECRET'];
  prohibido.forEach(fragmento => {
    assert.ok(!raw.includes(fragmento), `la respuesta del ledger no debe contener "${fragmento}"`);
  });
});

test('ningún evento de confianza aparece en el snapshot SSE del staff (el ledger no se mezcla con state)', async () => {
  const encargado = await loginAs('encargado');
  const response = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${encargado.token}` } });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  while (!body.includes('\n\n')) {
    const { done, value } = await reader.read();
    if (done) break;
    body += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  assert.ok(!body.includes('mesa_session_started'), 'el stream de staff no debe incluir acciones del ledger de confianza');
  assert.ok(!body.includes('trustLedger'), 'el stream de staff no debe exponer el ledger de confianza');
});

// P0-4 (SSE): no alcanza con probar que no exista una propiedad llamada
// trustLedger en el frame inicial de un solo rol. Acá se captura frame
// inicial + un broadcast disparado por una acción real + una reconexión,
// para cada rol de staff y para el cliente de mesa, y se verifica que en
// NINGUNO aparezcan acciones ni campos del ledger de confianza.
const LEDGER_LEAK_MARKERS = [
  'mesa_session_started', 'mesa_session_ended', 'staff_login',
  'trustLedger', 'eventId', 'authSessionId', 'identityAssurance', 'demoRunId',
];

function assertNoLedgerLeak(frameText, contexto) {
  LEDGER_LEAK_MARKERS.forEach(marker => {
    assert.ok(!frameText.includes(marker), `${contexto}: no debe contener "${marker}"`);
  });
}

async function captureStaffFrame(token) {
  const response = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${token}` } });
  const reader = response.body.getReader();
  const { message } = await readSseEvent(reader);
  await reader.cancel();
  return message;
}

test('SSE: frame inicial por rol de staff (mozo, cocina, encargado, dueño) nunca filtra el ledger', async () => {
  for (const role of ['mozo', 'cocina', 'encargado', 'dueno']) {
    const session = await loginAs(role);
    const message = await captureStaffFrame(session.token);
    assertNoLedgerLeak(JSON.stringify(message), `frame inicial de staff (${role})`);
  }
});

test('SSE: frame inicial del cliente de mesa nunca filtra el ledger (aunque sí expone su propio mesaSessionId operativo)', async () => {
  const response = await fetch(`${baseUrl}/events?mesa=8`);
  const reader = response.body.getReader();
  const { message } = await readSseEvent(reader);
  await reader.cancel();
  const raw = JSON.stringify(message);
  // mesaSessionId del ESTADO OPERATIVO de la mesa es intencional (así el
  // cliente puede reenviarlo y habilitar la protección de replay), pero no
  // debe venir acompañado de ningún otro campo propio del ledger.
  ['mesa_session_started', 'mesa_session_ended', 'staff_login', 'trustLedger', 'eventId', 'authSessionId', 'identityAssurance', 'demoRunId'].forEach(marker => {
    assert.ok(!raw.includes(marker), `frame inicial de mesa: no debe contener "${marker}"`);
  });
});

test('SSE: un broadcast disparado por una acción real tampoco filtra el ledger', async () => {
  const encargado = await loginAs('encargado');
  const response = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${encargado.token}` } });
  const reader = response.body.getReader();
  let { pending } = await readSseEvent(reader); // consume el frame inicial

  // Cualquier acción de staff dispara broadcast() al final de /api/action.
  await action({ type: 'baseline_actualizar', costoLaboralPorCubiertoBaseline: 111 }, encargado.token);

  const { message } = await readSseEvent(reader, pending);
  await reader.cancel();
  assertNoLedgerLeak(JSON.stringify(message), 'broadcast tras una acción');
});

test('SSE: al reconectar (cerrar y abrir de nuevo la conexión) el frame inicial sigue sin filtrar el ledger', async () => {
  const encargado = await loginAs('encargado');
  const first = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${encargado.token}` } });
  const firstReader = first.body.getReader();
  await readSseEvent(firstReader);
  await firstReader.cancel();

  const message = await captureStaffFrame(encargado.token);
  assertNoLedgerLeak(JSON.stringify(message), 'frame inicial tras reconexión');
});

// P0-1 (mesa session replay): generar mesaSessionId no alcanza si nadie lo
// valida contra la ocupación actual. Escenario exacto pedido: A ocupada,
// liberar A, abrir B, reenviar una acción vieja de A — B debe quedar intacta.
test('replay de mesa: una acción vieja de la ocupación A nunca puede tocar la ocupación B', async () => {
  const encargado = await loginAs('encargado');
  const dueno = await loginAs('dueno');
  const mesaNumero = 7;

  // Ocupación A.
  await action({ type: 'pedido_nuevo', mesa: mesaNumero, items: [{ productoId: 'hummus-rabieta' }] });
  const eventosTrasA = await (await trustEvents(dueno.token, '?limit=500')).json();
  const inicioA = eventosTrasA.events.filter(e => e.mesa === mesaNumero && e.action === 'mesa_session_started').at(-1);
  assert.ok(inicioA, 'debe existir un mesa_session_started para la ocupación A');
  const sessionA = inicioA.mesaSessionId;

  // Liberar A (requiere cuenta pedida + pago confirmado, igual que el resto de la suite).
  assert.equal((await action({ type: 'pedir_cuenta', mesa: mesaNumero })).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: mesaNumero }, encargado.token)).status, 200);
  assert.equal((await action({ type: 'mesa_liberar', mesa: mesaNumero }, encargado.token)).status, 200);

  // Abrir B: nueva ocupación de la misma mesa física, con su propio pedido.
  const nuevoPedidoB = await action({ type: 'pedido_nuevo', mesa: mesaNumero, items: [{ productoId: 'hummus-rabieta' }] });
  assert.equal(nuevoPedidoB.status, 200);
  const eventosTrasB = await (await trustEvents(dueno.token, '?limit=500')).json();
  const iniciosMesa = eventosTrasB.events.filter(e => e.mesa === mesaNumero && e.action === 'mesa_session_started');
  const sessionB = iniciosMesa.at(-1).mesaSessionId;
  assert.notEqual(sessionA, sessionB, 'la ocupación B debe tener un mesaSessionId propio, distinto del de A');

  // Reenviar una acción "vieja" de A (pedir la cuenta) contra la mesa, pero
  // indicando el mesaSessionId de A — que ya no es el que ocupa la mesa.
  const replay = await action({ type: 'pedir_cuenta', mesa: mesaNumero, mesaSessionId: sessionA });
  assert.equal(replay.status, 409, 'una acción que declara la sesión vieja debe rechazarse, no aplicarse a B');

  // B queda intacta: su pedido sigue sin "cuenta pedida" y su sesión no cambió.
  const estadoMesaResponse = await fetch(`${baseUrl}/events?mesa=${mesaNumero}`);
  const reader = estadoMesaResponse.body.getReader();
  const { message } = await readSseEvent(reader);
  await reader.cancel();
  const mesaState = message.state.mesas[0];
  assert.equal(mesaState.mesaSessionId, sessionB, 'B debe seguir siendo la ocupación activa de la mesa');
  assert.equal(mesaState.cuentaPedida, false, 'el replay de A no debe haber pedido la cuenta de B');

  // Control positivo: la MISMA acción, ahora indicando el mesaSessionId
  // correcto de B, sí debe poder ejecutarse normalmente.
  const accionLegitima = await action({ type: 'pedir_cuenta', mesa: mesaNumero, mesaSessionId: sessionB });
  assert.equal(accionLegitima.status, 200, 'una acción que declara el mesaSessionId correcto de la ocupación actual debe funcionar');

  // Limpieza para no interferir con otros tests que reutilicen esta mesa.
  await action({ type: 'pago_demo_confirmar', mesa: mesaNumero }, encargado.token);
  await action({ type: 'mesa_liberar', mesa: mesaNumero }, encargado.token);
});

test('replay de mesa: sin mesaSessionId en el body, el comportamiento pre-existente no cambia (protección opt-in)', async () => {
  // Documenta el límite real: si quien llama no manda mesaSessionId (como
  // hoy hace el cliente público real), no hay nada que comparar y la acción
  // se procesa igual que antes de #45A — ver docs/SECURITY.md.
  const mesaNumero = 9;
  const response = await action({ type: 'pedido_nuevo', mesa: mesaNumero, items: [{ productoId: 'hummus-rabieta' }] });
  assert.equal(response.status, 200);
  const encargado = await loginAs('encargado');
  assert.equal((await action({ type: 'pedir_cuenta', mesa: mesaNumero })).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: mesaNumero }, encargado.token)).status, 200);
  assert.equal((await action({ type: 'mesa_liberar', mesa: mesaNumero }, encargado.token)).status, 200);
});

// P0-2 (auth + cola): autenticar antes de encolar no alcanza si la mutación
// se ejecuta después de que el token venció o se cerró sesión. Se usa un
// servidor dedicado con TRUST_TEST_QUEUE_DELAY_MS para volver determinística
// una carrera que en producción dura microsegundos.
test('auth + cola: un logout durante la espera en cola invalida la mutación en vez de ejecutarla igual', async () => {
  await withDedicatedServer({ TRUST_TEST_QUEUE_DELAY_MS: '300' }, async (url) => {
    const encargado = await loginAt(url, 'encargado');

    // Se dispara la acción (pre-chequeo de sesión pasa: el token todavía es
    // válido en este instante) pero NO se espera su respuesta todavía — va a
    // quedar esperando el delay artificial dentro de la cola.
    const accionPromise = actionAt(url, { type: 'baseline_actualizar', costoLaboralPorCubiertoBaseline: 222 }, encargado.token);

    // Mientras la mutación espera en la cola, se cierra la sesión.
    await new Promise(resolve => setTimeout(resolve, 20)); // dar tiempo a que la acción arrancó a encolarse
    const logoutResponse = await fetch(`${url}/api/staff-logout`, {
      method: 'POST', headers: { authorization: `Bearer ${encargado.token}` },
    });
    assert.equal(logoutResponse.status, 200);

    const accionResponse = await accionPromise;
    assert.equal(accionResponse.status, 401, 'la acción no debe ejecutarse con una sesión ya cerrada, aunque haya sido válida al llegar');

    // La baseline no debe haber cambiado: la mutación se abortó de verdad.
    const otraSesion = await loginAt(url, 'dueno');
    const estado = await (await fetch(`${url}/api/staff-events`, { headers: { authorization: `Bearer ${otraSesion.token}` } })).body.getReader();
    const { message } = await readSseEvent(estado);
    await estado.cancel();
    assert.notEqual(message.state.baseline.costoLaboralPorCubiertoBaseline, 222, 'la mutación revocada no debe haber aplicado su cambio');
  });
});

// P0-9 (privacidad): valores canario inyectados en campos sensibles no deben
// aparecer nunca en el ledger de confianza ni en respuestas de error.
//
// Nota de alcance: un PIN "canario" es un secreto — no tiene ninguna razón
// legítima para aparecer en ningún lado. Un mensaje de "ayuda" con texto
// libre es distinto: el staff SÍ debe poder leerlo en su panel (state.mesas
// vía SSE) para poder atenderlo — eso es una función operativa correcta de
// la app, no una fuga del ledger de confianza. Por eso este test solo
// verifica que el ledger (que hoy no captura texto libre de clientes en
// antes/después de ningún evento instrumentado) y las respuestas de error
// nunca lo contengan — no que el panel de staff deje de mostrarlo.
test('privacidad: un PIN canario nunca aparece en el ledger ni en errores', async () => {
  const canarioPin = 'TEST_SECRET_PIN_123';
  const dueno = await loginAs('dueno');

  const loginFallido = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: canarioPin, role: 'encargado' }),
  });
  assert.equal(loginFallido.status, 401);
  const errorBody = await loginFallido.text();
  assert.ok(!errorBody.includes(canarioPin), 'la respuesta de error de login no debe reflejar el PIN recibido');

  const ledgerRaw = await (await trustEvents(dueno.token, '?limit=500')).text();
  assert.ok(!ledgerRaw.includes(canarioPin), 'el ledger no debe contener el PIN canario: un login fallido no debe dejar rastro del valor probado');
});

test('privacidad: canarios en texto libre de cliente (ayuda) nunca llegan al ledger de confianza', async () => {
  const canarios = ['TEST_BEARER_XYZ', 'test@example.com', '<script>alert(1)</script>TEST_MALICIOUS'];
  const dueno = await loginAs('dueno');
  await action({ type: 'pedido_nuevo', mesa: 11, items: [{ productoId: 'hummus-rabieta' }] });
  const ayudaResponse = await action({ type: 'ayuda', mesa: 11, categoria: 'otro', mensaje: canarios.join(' ') });
  assert.equal(ayudaResponse.status, 200, 'la acción en sí es legítima: el punto es qué pasa con ese texto después');

  const ledgerRaw = await (await trustEvents(dueno.token, '?limit=500')).text();
  canarios.forEach(canario => {
    assert.ok(!ledgerRaw.includes(canario), `el ledger de confianza no debe contener texto libre de cliente ("${canario}"): "ayuda" no está instrumentada hoy y before/after usan allowlist por acción`);
  });
});

// P0-8 (paginación): inserciones concurrentes entre pedir la página 1 y la
// página 2 no deben producir huecos ni duplicados — el cursor es sequence,
// nunca timestamp.
test('paginación: inserciones concurrentes entre página 1 y página 2 no rompen el orden ni duplican eventos', async () => {
  const dueno = await loginAs('dueno');
  const encargado = await loginAs('encargado');
  const page1 = await (await trustEvents(dueno.token, '?limit=3')).json();
  assert.equal(page1.events.length, 3);

  // Insertar eventos concurrentemente (varios logins en paralelo) justo
  // entre leer la página 1 y pedir la página 2.
  await Promise.all(Array.from({ length: 5 }, () => loginAs('mozo')));

  const page2 = await (await trustEvents(dueno.token, `?limit=50&after=${page1.nextCursor}`)).json();
  const idsPage1 = new Set(page1.events.map(e => e.eventId));
  page2.events.forEach(event => {
    assert.ok(!idsPage1.has(event.eventId), 'la página 2 no debe repetir eventos de la página 1');
    assert.ok(event.sequence > page1.nextCursor, 'todo evento de la página 2 debe tener sequence mayor al cursor de la página 1');
  });
  const sequences = page2.events.map(e => e.sequence);
  const ordenados = [...sequences].sort((a, b) => a - b);
  assert.deepEqual(sequences, ordenados, 'la página 2 debe venir en orden estable por sequence');
  void encargado;
});
