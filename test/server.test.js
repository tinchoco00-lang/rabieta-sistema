'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const vm = require('node:vm');
const { after, before, test } = require('node:test');

const root = path.resolve(__dirname, '..');
const testPin = '7391';
let baseUrl, serverProcess, staffToken;
let serverOutput = '';

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

async function waitUntilReady(url, processHandle = serverProcess, output = () => serverOutput, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`El servidor terminó antes de iniciar.\n${output()}`);
    try { if ((await fetch(`${url}/api/menu`)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`El servidor no inició dentro de ${timeoutMs} ms.\n${output()}`);
}

function stopServer(processHandle = serverProcess) {
  if (!processHandle || processHandle.exitCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const forceStop = setTimeout(() => { if (processHandle.exitCode === null) processHandle.kill('SIGKILL'); }, 2000);
    forceStop.unref();
    processHandle.once('exit', () => { clearTimeout(forceStop); resolve(); });
    processHandle.kill('SIGTERM');
  });
}

async function action(body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}/api/action`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function postJson(url, body, forwardedFor) {
  const headers = { 'content-type': 'application/json' };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  return fetch(`${url}/api/action`, { method: 'POST', headers, body: JSON.stringify(body) });
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
  const event = body.slice(0, boundary);
  const dataLine = event.split('\n').find(line => line.startsWith('data: '));
  assert.ok(dataLine, 'SSE debe incluir una línea data');
  return { done: false, message: JSON.parse(dataLine.slice(6)), pending: body.slice(boundary + 2) };
}

async function getStateFrom(url, mesa = 1, mesaToken) {
  const headers = mesaToken ? { 'x-mesa-token': mesaToken } : undefined;
  const response = await fetch(`${url}/events?mesa=${mesa}`, { headers });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  while (!body.includes('\n\n')) {
    const { done, value } = await reader.read();
    if (done) break;
    body += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  const dataLine = body.split('\n').find(line => line.startsWith('data: '));
  assert.ok(dataLine, 'SSE debe enviar un snapshot inicial');
  return JSON.parse(dataLine.slice(6)).state;
}

async function getState() { return getStateFrom(baseUrl); }

async function getStaffState() {
  return (await getStaffStateWithToken(staffToken)).state;
}

async function getStaffStateWithToken(token) {
  const response = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${token}` } });
  const reader = response.body.getReader();
  const event = await readSseEvent(reader);
  await reader.cancel();
  return event.message;
}

async function loginAs(role) {
  const response = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin, role }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

function tokenForMesa(secret, mesa) {
  return crypto.createHmac('sha256', secret).update(`mesa:${mesa}`).digest('hex');
}

// Reemplaza a la API real de Mercado Pago en los tests: nunca tuvimos
// credenciales propias para ejercitar la integración contra el servicio real,
// así que este mock imita el contrato documentado (POST /checkout/preferences,
// GET /v1/payments/:id) para poder probar nuestro código de punta a punta.
function startMockMercadoPago({ onPreference, onPayment } = {}) {
  const calls = { preferences: [], payments: [] };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      if (req.method === 'POST' && req.url.startsWith('/checkout/preferences')) {
        const parsedBody = rawBody ? JSON.parse(rawBody) : {};
        calls.preferences.push(parsedBody);
        const result = (onPreference && onPreference(parsedBody)) || {
          status: 201,
          body: { id: 'mock-pref-id', init_point: 'https://mp.mock/init', sandbox_init_point: 'https://mp.mock/sandbox-init' },
        };
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
        return;
      }
      const paymentMatch = req.url.match(/^\/v1\/payments\/([^/?]+)/);
      if (req.method === 'GET' && paymentMatch) {
        const paymentId = decodeURIComponent(paymentMatch[1]);
        calls.payments.push(paymentId);
        const result = (onPayment && onPayment(paymentId)) || { status: 200, body: { status: 'approved', external_reference: null } };
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
function stopMockServer(server) {
  return new Promise(resolve => server.close(() => resolve()));
}
function mercadoPagoWebhookHeaders(secret, dataId, tsSeconds = Math.floor(Date.now() / 1000)) {
  const ts = String(tsSeconds);
  const requestId = 'test-request-id';
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

async function resetState() {
  assert.equal((await action({ type: 'reset_demo' }, staffToken)).status, 200);
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root, env: { ...process.env, DATABASE_URL: '', PORT: String(port), STAFF_PIN: testPin }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk; });
  await waitUntilReady(baseUrl);
});

after(async () => { await stopServer(); });

test('endpoints base y login de staff generan un token aleatorio', async () => {
  const menu = await fetch(`${baseUrl}/api/menu`);
  assert.equal(menu.status, 200);
  assert.ok((await menu.json())._meta);
  const mesa = await fetch(`${baseUrl}/mesa.html?mesa=1`);
  assert.equal(mesa.status, 200);
  assert.match(await mesa.text(), /<!doctype html>/i);
  const bad = await fetch(`${baseUrl}/api/staff-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: 'incorrecto' }) });
  assert.equal(bad.status, 401);
  const badResult = await bad.json();
  assert.equal(badResult.ok, false);
  assert.equal(badResult.token, undefined);
  const login = await fetch(`${baseUrl}/api/staff-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin }) });
  assert.equal(login.status, 200);
  const result = await login.json();
  assert.equal(result.ok, true);
  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.equal(result.role, 'encargado');
  assert.deepEqual(result.allowedViews, ['encargado', 'mozo', 'cocina', 'dueno', 'qrs']);
  staffToken = result.token;
});

test('cada rol recibe sólo sus vistas, datos y acciones operativas', async () => {
  await resetState();
  const mozo = await loginAs('mozo');
  const cocina = await loginAs('cocina');
  const dueno = await loginAs('dueno');

  assert.deepEqual(mozo.allowedViews, ['mozo']);
  assert.deepEqual(cocina.allowedViews, ['cocina']);
  assert.deepEqual(dueno.allowedViews, ['dueno']);
  assert.equal((await getStaffStateWithToken(mozo.token)).state.analytics, undefined);
  assert.ok((await getStaffStateWithToken(dueno.token)).state.analytics);
  assert.equal((await fetch(`${baseUrl}/api/mesa-links`, { headers: { authorization: `Bearer ${mozo.token}` } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/mesa-links`, { headers: { authorization: `Bearer ${staffToken}` } })).status, 200);

  assert.equal((await action({ type: 'reset_demo' }, dueno.token)).status, 403);
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  const itemId = (await getState()).mesas[0].pedido.items[0].id;
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId, estado: 'preparando' }, mozo.token)).status, 403);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId, estado: 'preparando' }, cocina.token)).status, 200);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId, estado: 'listo' }, cocina.token)).status, 200);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId, estado: 'entregado' }, cocina.token)).status, 403);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId, estado: 'entregado' }, mozo.token)).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, cocina.token)).status, 403);
  await resetState();
});

test('Dueño entra directo a analytics sin pedir activar avisos operativos', () => {
  const staffHtml = fs.readFileSync(path.join(root, 'public', 'staff.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(staffHtml, /if\(res\.role===['"]dueno['"]\) abrirPanelStaff\(\)/);
  assert.match(appSource, /STAFF_ROLE!==['"]dueno['"]/);
});

test('Encargado carga un escenario sintético visible de punta a punta', async () => {
  const encargado = await loginAs('encargado');
  assert.equal((await action({ type: 'reset_demo' }, encargado.token)).status, 200);
  const dueno = await loginAs('dueno');
  assert.equal((await action({ type: 'demo_escenario_cargar' }, dueno.token)).status, 403);
  assert.equal((await action({ type: 'demo_escenario_cargar' }, encargado.token)).status, 200);

  const scenario = (await getStaffStateWithToken(encargado.token)).state;
  assert.equal(scenario.presentacionCargada, true);
  assert.deepEqual(scenario.mesas[0].pedido.items.map(item => [item.destino, item.estado]), [['cocina', 'preparando'], ['barra', 'listo']]);
  assert.equal(scenario.mesas[1].pedido.items.length, 2);
  assert.equal(scenario.mesas[2].cuentaPedida, true);
  assert.equal(scenario.mesas[3].alertas[0].prioridad, 'urgente');
  assert.equal(scenario.mesas[4].pago.estado, 'confirmado');
  // Mesa 7 (asignada a Sofía, igual que Mesa 1 y Mesa 4) llama al mozo y queda
  // sin resolver: es el paso "llamado al mozo" del recorrido guiado completo.
  assert.equal(scenario.mesas[6].alertas.length, 1);
  assert.equal(scenario.mesas[6].alertas[0].tipo, 'mozo');
  assert.equal(scenario.mesas[6].alertas[0].estado, 'recibido');
  assert.equal(scenario.mesas[6].mozo, 'Sofía');
  assert.equal(scenario.analytics.pagosConfirmados, 1);
  assert.equal(scenario.analytics.resenas[0].puntuacion, 5);
  assert.equal(scenario.analytics.crmContactos[0].contacto, 'demo@rabieta.local');
  const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(appSource, /state\.presentacionCargada = msg\.state\.presentacionCargada === true/);
  assert.match(appSource, /Recorrido de demo · 5 minutos/);
  assert.match(appSource, /mesaDemoLinkHtml\(1,state\.demoPasosVistos\.has\(1\)\?'Volver a abrir':'Empezar demo','primary','user',1\)/);
  assert.match(appSource, /type:'mesa-preview',numero,path:mesa\.path/);
  assert.match(appSource, /title="Vista cliente de Mesa \$\{state\.modal\.numero\}"/);
  assert.match(appSource, /Modo presentador · paso \$\{paso\} de 5/);
  assert.match(appSource, /Seguir a Cocina \+ Barra/);
  assert.match(appSource, /Abrir cuenta cliente/);
  assert.match(appSource, /Repetir recorrido/);
  assert.match(appSource, /Paso 2 · tocá esta tarjeta/);
  assert.match(appSource, /Paso 3 · entregá este ítem/);
  assert.match(appSource, /Paso 3 · resolvé este reclamo/);
  assert.match(appSource, /Paso 3 · atendé este llamado/);
  assert.match(appSource, /atendé el llamado al mozo de Mesa 7/);
  assert.match(appSource, /Elegí Mercado Pago o tarjeta demo para cerrarla — pago de prueba, sin dinero real/);
  assert.match(appSource, /Mirá el feed de actividad en vivo — analytics y CRM son sintéticos/);
  assert.match(appSource, /preview=1\$\{hash\}/);
  assert.match(appSource, /root\.dataset\.modalKey===modalKey/);
  assert.doesNotMatch(appSource, /window\.open\(mesaAccessUrl/);
  assert.match(fs.readFileSync(path.join(root, 'public', 'mesa.html'), 'utf8'), /clienteSplashDismissed = params\.get\('preview'\) === '1'/);
  assert.match(appSource, /irPasoDemo\('dueno',null,5\)/);
  assert.equal((await action({ type: 'reset_demo' }, encargado.token)).status, 200);
});

test('recorrido completo QR a analytics funciona con roles separados', async () => {
  staffToken = (await loginAs('encargado')).token;
  await resetState();
  const cocina = await loginAs('cocina');
  const mozo = await loginAs('mozo');
  const dueno = await loginAs('dueno');

  const linksResponse = await fetch(`${baseUrl}/api/mesa-links`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(linksResponse.status, 200);
  const links = await linksResponse.json();
  assert.equal(links.mesas[0].numero, 1);
  assert.match(links.mesas[0].path, /^\/mesa\.html\?mesa=1(?:#token=[a-f0-9]{64})?$/);

  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [
    { productoId: 'hummus-rabieta' },
    { productoId: 'agua' },
  ] })).status, 200);

  let mesa = (await getState()).mesas[0];
  assert.equal(mesa.ocupada, true);
  assert.deepEqual(mesa.pedido.items.map(item => item.destino), ['cocina', 'barra']);

  for (const item of mesa.pedido.items) {
    assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'preparando' }, cocina.token)).status, 200);
    assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'listo' }, cocina.token)).status, 200);
    assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'entregado' }, mozo.token)).status, 200);
  }

  mesa = (await getState()).mesas[0];
  assert.equal(mesa.pedido.estado, 'entregado');
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  mesa = (await getState()).mesas[0];
  const alertaCuenta = mesa.alertas.find(alerta => alerta.tipo === 'cuenta');
  assert.ok(alertaCuenta);
  assert.equal((await action({ type: 'alerta_atender', alertaId: alertaCuenta.id }, mozo.token)).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, mozo.token)).status, 200);
  assert.equal((await action({
    type: 'resena_enviar', mesa: 1, puntuacion: 5, comentario: 'Demo punta a punta lista',
    crmConsentimiento: true, crmCanal: 'whatsapp', crmContacto: '+54 11 5555 5555', crmNombre: 'Cliente demo',
  })).status, 200);

  const ownerState = (await getStaffStateWithToken(dueno.token)).state;
  assert.equal(ownerState.analytics.pagosConfirmados, 1);
  assert.equal(ownerState.analytics.itemsVendidos, 2);
  assert.equal(ownerState.analytics.itemsListos, 2);
  assert.equal(ownerState.analytics.itemsEntregados, 2);
  assert.equal(ownerState.analytics.destinos.cocina.itemsListos, 1);
  assert.equal(ownerState.analytics.destinos.barra.itemsListos, 1);
  assert.ok(Number.isFinite(ownerState.analytics.tiempoPreparacionTotalSec));
  assert.ok(Number.isFinite(ownerState.analytics.tiempoPaseTotalSec));
  assert.equal(ownerState.analytics.resenas.length, 1);
  assert.equal(ownerState.analytics.resenas[0].comentario, 'Demo punta a punta lista');
  assert.deepEqual(ownerState.analytics.crmContactos[0], {
    id: ownerState.analytics.crmContactos[0].id,
    mesa: 1,
    canal: 'whatsapp',
    contacto: '+54 11 5555 5555',
    nombre: 'Cliente demo',
    consentimientoTs: ownerState.analytics.crmContactos[0].consentimientoTs,
    origen: 'post_pago',
  });
  assert.equal((await action({ type: 'mesa_liberar', mesa: 1 }, mozo.token)).status, 200);

  mesa = (await getState()).mesas[0];
  assert.equal(mesa.ocupada, false);
  assert.equal(mesa.pedido, null);
  const retainedAnalytics = (await getStaffStateWithToken(dueno.token)).state.analytics;
  assert.equal(retainedAnalytics.pagosConfirmados, 1);
  assert.equal(retainedAnalytics.itemsEntregados, 2);
  await resetState();
});

test('acciones internas requieren Bearer token y las públicas no', async () => {
  assert.equal((await action({ type: 'reset_demo' })).status, 401);
  assert.equal((await action({ type: 'reset_demo' }, 'token-invalido')).status, 401);
  assert.equal((await action({ type: 'llamar_mozo', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, estado: 'preparando' })).status, 401);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, estado: 'preparando' }, staffToken)).status, 200);
  assert.equal((await getState()).mesas[0].pedido.estado, 'preparando');
  assert.equal((await action({ type: 'reset_demo' }, staffToken)).status, 200);
});

test('un pedido permanece enviado hasta que cocina confirma la preparación', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  const initialState = await getState();
  const initialClock = initialState.clockMs;
  assert.equal(initialState.mesas[0].pedido.estado, 'enviado');

  const deadline = Date.now() + 9000;
  let laterState = initialState;
  while (laterState.clockMs - initialClock < 7 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 200));
    laterState = await getState();
  }

  assert.ok(laterState.clockMs - initialClock >= 7, 'el reloj operativo debe avanzar al menos siete segundos');
  assert.equal(laterState.mesas[0].pedido.estado, 'enviado');
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, estado: 'preparando' }, staffToken)).status, 200);
  assert.equal((await getState()).mesas[0].pedido.estado, 'preparando');
  await resetState();
});

test('cocina avanza cada item por separado y el pedido termina al entregar todos', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [
    { productoId: 'hummus-rabieta' },
    { productoId: 'burrata' },
  ] })).status, 200);

  let pedido = (await getState()).mesas[0].pedido;
  const [hummus, burrata] = pedido.items;
  assert.notEqual(hummus.id, burrata.id);
  assert.deepEqual(pedido.items.map(item => item.estado), ['enviado', 'enviado']);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, estado: 'preparando' }, staffToken)).status, 400);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: hummus.id, estado: 'listo' }, staffToken)).status, 409);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: 999999, estado: 'preparando' }, staffToken)).status, 404);

  for (const estado of ['preparando', 'listo', 'entregado']) {
    assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: hummus.id, estado }, staffToken)).status, 200);
  }
  pedido = (await getState()).mesas[0].pedido;
  assert.equal(pedido.items[0].estado, 'entregado');
  assert.equal(pedido.items[1].estado, 'enviado');
  assert.equal(pedido.estado, 'enviado');

  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [
    { productoId: 'papas-bravas' },
  ] })).status, 200);
  pedido = (await getState()).mesas[0].pedido;
  const papas = pedido.items[2];
  assert.equal(pedido.items[0].id, hummus.id);
  assert.equal(pedido.items[0].estado, 'entregado');
  assert.deepEqual(pedido.items.slice(1).map(item => item.estado), ['enviado', 'enviado']);

  for (const itemId of [burrata.id, papas.id]) {
    for (const estado of ['preparando', 'listo', 'entregado']) {
      assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId, estado }, staffToken)).status, 200);
    }
  }
  pedido = (await getState()).mesas[0].pedido;
  assert.deepEqual(pedido.items.map(item => item.estado), ['entregado', 'entregado', 'entregado']);
  assert.equal(pedido.estado, 'entregado');
  await resetState();
});

test('una segunda ronda conserva consumos ya entregados y acumula la cuenta', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  let pedido = (await getState()).mesas[0].pedido;
  const firstItem = pedido.items[0];
  for (const estado of ['preparando', 'listo', 'entregado']) {
    assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: firstItem.id, estado }, staffToken)).status, 200);
  }
  assert.equal((await getState()).mesas[0].pedido.estado, 'entregado');

  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'agua' }] })).status, 200);
  pedido = (await getState()).mesas[0].pedido;
  assert.equal(pedido.items.length, 2);
  assert.deepEqual(pedido.items.map(item => [item.ronda, item.estado]), [[1, 'entregado'], [2, 'enviado']]);
  assert.equal(pedido.items[0].id, firstItem.id);
  const expectedTotal = pedido.items.reduce((total, item) => total + item.precio, 0);

  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, staffToken)).status, 200);
  const mesa = (await getState()).mesas[0];
  assert.equal(mesa.pago.total, expectedTotal);
  assert.match(fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8'), /Revisar y.*enviar otra ronda/);
  await resetState();
});

test('cada avance de cocina conserva una marca de tiempo auditable por ítem', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  let item = (await getState()).mesas[0].pedido.items[0];
  assert.deepEqual(item.estadoTs, { enviado: item.enviadoTs });

  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'preparando' }, staffToken)).status, 200);
  const preparingState = await getState();
  item = preparingState.mesas[0].pedido.items[0];
  assert.equal(item.estadoTs.enviado, item.enviadoTs);
  assert.equal(item.estadoTs.preparando, preparingState.clockMs);

  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'listo' }, staffToken)).status, 200);
  item = (await getState()).mesas[0].pedido.items[0];
  assert.ok(Number.isFinite(item.estadoTs.listo));
  await resetState();
});

test('los ítems se enrutan a Cocina o Barra desde una configuración demo del servidor', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [
    { productoId: 'hummus-rabieta' },
    { productoId: 'american-ipa-latitudes' },
  ] })).status, 200);
  const items = (await getState()).mesas[0].pedido.items;
  assert.equal(items[0].destino, 'cocina');
  assert.equal(items[1].destino, 'barra');
  await resetState();
});

test('cuenta y pago demo conservan el pedido hasta que staff libera la mesa', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [
    { productoId: 'hummus-rabieta' },
    { productoId: 'burrata' },
  ] })).status, 200);

  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 })).status, 401);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 409);
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'papas-bravas' }] })).status, 409);

  let mesa = (await getState()).mesas[0];
  const cuentaAlert = mesa.alertas.find(alerta => alerta.tipo === 'cuenta');
  assert.equal(mesa.cuentaPedida, true);
  assert.equal(mesa.pago, null);
  assert.ok(cuentaAlert);
  assert.equal((await action({ type: 'mesa_liberar', mesa: 1 }, staffToken)).status, 409);
  assert.equal((await getState()).mesas[0].ocupada, true);

  assert.equal((await action({ type: 'alerta_resolver', alertaId: cuentaAlert.id }, staffToken)).status, 200);
  mesa = (await getState()).mesas[0];
  assert.equal(mesa.ocupada, true);
  assert.equal(mesa.pedido.items.length, 2);
  assert.equal(mesa.cuentaPedida, true);

  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, staffToken)).status, 200);
  mesa = (await getState()).mesas[0];
  assert.deepEqual(mesa.pago, {
    modo: 'demo', estado: 'confirmado', medio: 'staff', total: 7700,
    referencia: mesa.pago.referencia, confirmadoTs: mesa.pago.confirmadoTs,
  });
  assert.match(mesa.pago.referencia, /^RAB-01-\d{6}$/);
  assert.ok(Number.isFinite(mesa.pago.confirmadoTs));
  assert.equal(mesa.pedido.items.length, 2);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, staffToken)).status, 409);

  let analytics = (await getStaffState()).analytics;
  assert.equal(analytics.pagosConfirmados, 1);
  assert.equal(analytics.ventasDemo, 7700);
  assert.equal(analytics.itemsVendidos, 2);
  assert.deepEqual(analytics.productos['hummus-rabieta'], { nombre: 'Hummus Rabieta', cantidad: 1, total: 4600 });
  assert.deepEqual(analytics.productos.burrata, { nombre: 'Burrata', cantidad: 1, total: 3100 });

  assert.equal((await action({ type: 'mesa_liberar', mesa: 1 }, staffToken)).status, 200);
  mesa = (await getState()).mesas[0];
  assert.equal(mesa.ocupada, false);
  assert.equal(mesa.pedido, null);
  assert.equal(mesa.cuentaPedida, false);
  assert.equal(mesa.pago, null);
  analytics = (await getStaffState()).analytics;
  assert.equal(analytics.pagosConfirmados, 1);
  assert.equal(analytics.ventasDemo, 7700);
  await resetState();
});

test('pago demo rechaza cuentas con precios pendientes', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'rabas-romana' }] })).status, 200);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, staffToken)).status, 409);
  assert.equal((await getState()).mesas[0].pago, null);
  await resetState();
});

test('cliente completa checkout sandbox y recibe comprobante sin credenciales staff', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [
    { productoId: 'hummus-rabieta' }, { productoId: 'burrata' },
  ] })).status, 200);
  assert.equal((await action({ type: 'pago_sandbox_confirmar', mesa: 1, medio: 'tarjeta' })).status, 409);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'pago_sandbox_confirmar', mesa: 1, medio: 'efectivo' })).status, 400);
  assert.equal((await action({ type: 'pago_sandbox_confirmar', mesa: 1, medio: 'mercado_pago' })).status, 200);

  const mesa = (await getState()).mesas[0];
  assert.equal(mesa.pago.modo, 'demo');
  assert.equal(mesa.pago.estado, 'confirmado');
  assert.equal(mesa.pago.medio, 'mercado_pago');
  assert.equal(mesa.pago.total, 7700);
  assert.match(mesa.pago.referencia, /^RAB-01-\d{6}$/);
  assert.ok(mesa.alertas.filter(alerta => alerta.tipo === 'cuenta').every(alerta => alerta.estado === 'resuelto'));
  await resetState();
});

test('la mesa puede dejar una única reseña post-pago y captar CRM solo con consentimiento', async () => {
  await resetState();
  assert.equal((await action({ type: 'resena_enviar', mesa: 1, puntuacion: 5 })).status, 409);
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'pago_demo_confirmar', mesa: 1 }, staffToken)).status, 200);
  assert.equal((await action({ type: 'resena_enviar', mesa: 1, puntuacion: 0 })).status, 400);
  assert.equal((await action({
    type: 'resena_enviar', mesa: 1, puntuacion: 4, crmCanal: 'email', crmContacto: 'cliente@demo.com',
  })).status, 400);
  assert.equal((await action({
    type: 'resena_enviar', mesa: 1, puntuacion: 4, crmConsentimiento: true, crmCanal: 'email', crmContacto: 'email-invalido',
  })).status, 400);
  assert.equal((await action({
    type: 'resena_enviar', mesa: 1, puntuacion: 4, comentario: 'Muy buena atención <script>alert(1)</script>',
    crmConsentimiento: true, crmCanal: 'email', crmContacto: 'cliente@demo.com', crmNombre: 'Ana Demo',
  })).status, 200);
  assert.equal((await action({ type: 'resena_enviar', mesa: 1, puntuacion: 5 })).status, 409);

  const publicState = await getState();
  assert.equal(publicState.analytics, undefined);
  assert.equal(publicState.mesas[0].resenaEnviada, true);
  let analytics = (await getStaffState()).analytics;
  assert.equal(analytics.resenas.length, 1);
  assert.deepEqual(analytics.resenas[0], {
    id: analytics.resenas[0].id,
    mesa: 1,
    puntuacion: 4,
    comentario: 'Muy buena atención <script>alert(1)</script>',
    creadoTs: analytics.resenas[0].creadoTs,
  });
  assert.ok(Number.isInteger(analytics.resenas[0].id));
  assert.ok(Number.isFinite(analytics.resenas[0].creadoTs));
  assert.deepEqual(analytics.crmContactos[0], {
    id: analytics.crmContactos[0].id,
    mesa: 1,
    canal: 'email',
    contacto: 'cliente@demo.com',
    nombre: 'Ana Demo',
    consentimientoTs: analytics.crmContactos[0].consentimientoTs,
    origen: 'post_pago',
  });
  assert.ok(Number.isInteger(analytics.crmContactos[0].id));
  assert.ok(Number.isFinite(analytics.crmContactos[0].consentimientoTs));

  assert.equal((await action({ type: 'mesa_liberar', mesa: 1 }, staffToken)).status, 200);
  analytics = (await getStaffState()).analytics;
  assert.equal(analytics.resenas.length, 1);
  assert.equal(analytics.crmContactos.length, 1);
  await resetState();
});

test('logout revoca inmediatamente el token actual', async () => {
  const logout = await fetch(`${baseUrl}/api/staff-logout`, {
    method: 'POST', headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { ok: true });
  assert.equal((await action({ type: 'reset_demo' }, staffToken)).status, 401);

  const login = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin }),
  });
  staffToken = (await login.json()).token;
  assert.match(staffToken, /^[a-f0-9]{64}$/);
});

test('streams realtime aíslan mesas y protegen el estado completo de staff', async () => {
  await resetState();
  assert.equal((await action({ type: 'llamar_mozo', mesa: 1 })).status, 200);
  assert.equal((await action({ type: 'llamar_mozo', mesa: 2 })).status, 200);
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 2, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);

  const mesaResponse = await fetch(`${baseUrl}/events?mesa=1`);
  assert.equal(mesaResponse.status, 200);
  const mesaReader = mesaResponse.body.getReader();
  let mesaPending = '';
  const initialMesa = await readSseEvent(mesaReader, mesaPending);
  mesaPending = initialMesa.pending;
  assert.equal(initialMesa.message.state.mesas.length, 1);
  assert.equal(initialMesa.message.state.mesas[0].numero, 1);
  assert.equal(initialMesa.message.state.mesas[0].alertas.length, 1);
  assert.equal(initialMesa.message.state.mesas[0].pedido, null);
  assert.equal(initialMesa.message.mesasTotal, undefined);

  const manuallyChangedMesa = await getStateFrom(baseUrl, 2);
  assert.deepEqual(manuallyChangedMesa.mesas.map(mesa => mesa.numero), [2]);
  assert.equal(manuallyChangedMesa.mesas[0].alertas.length, 1);
  assert.equal(manuallyChangedMesa.mesas[0].pedido.items[0].productoId, 'hummus-rabieta');

  assert.equal((await fetch(`${baseUrl}/events?mesa=0`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/events?mesa=texto`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/staff-events`)).status, 401);

  const staffResponse = await fetch(`${baseUrl}/api/staff-events`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(staffResponse.status, 200);
  const staffReader = staffResponse.body.getReader();
  const initialStaff = await readSseEvent(staffReader);
  assert.ok(initialStaff.message.state.mesas.length > 1);
  assert.equal(initialStaff.message.mesasTotal, initialStaff.message.state.mesas.length);
  await staffReader.cancel();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.doesNotMatch(serverOutput, new RegExp(staffToken));

  assert.equal((await action({ type: 'llamar_mozo', mesa: 2 })).status, 200);
  const afterOtherMesa = await readSseEvent(mesaReader, mesaPending);
  mesaPending = afterOtherMesa.pending;
  assert.deepEqual(afterOtherMesa.message.state.mesas.map(mesa => mesa.numero), [1]);
  assert.equal(afterOtherMesa.message.state.mesas[0].alertas.length, 1);

  for (let update = 0; update < 3; update++) {
    assert.equal((await action({ type: 'llamar_mozo', mesa: 1 })).status, 200);
    const expectedAlerts = 2 + update;
    let updatedMesa;
    for (let attempt = 0; attempt < 4; attempt++) {
      const event = await readSseEvent(mesaReader, mesaPending);
      mesaPending = event.pending;
      assert.deepEqual(event.message.state.mesas.map(mesa => mesa.numero), [1]);
      assert.equal(event.message.state.mesas[0].pedido, null);
      if (event.message.state.mesas[0].alertas.length === expectedAlerts) { updatedMesa = event.message; break; }
    }
    assert.ok(updatedMesa, `el stream de mesa debe recibir la actualización ${update + 1}`);
  }
  await mesaReader.cancel();
});

test('identidad HMAC vincula token y acciones a una sola mesa sin afectar staff', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  const mesaSecret = crypto.randomBytes(32).toString('hex');
  const mesaOneToken = tokenForMesa(mesaSecret, 1);
  const mesaTwoToken = tokenForMesa(mesaSecret, 2);
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: '',
      MESA_TOKEN_SECRET: mesaSecret,
      PORT: String(port),
      STAFF_PIN: testPin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);

    const mesaOneState = await getStateFrom(isolatedUrl, 1, mesaOneToken);
    assert.deepEqual(mesaOneState.mesas.map(mesa => mesa.numero), [1]);
    assert.equal((await fetch(`${isolatedUrl}/events?mesa=1`)).status, 401);
    assert.equal((await fetch(`${isolatedUrl}/events?mesa=2`, {
      headers: { 'x-mesa-token': mesaOneToken },
    })).status, 403);
    const tamperedToken = `${mesaOneToken.slice(0, -1)}${mesaOneToken.endsWith('0') ? '1' : '0'}`;
    assert.equal((await fetch(`${isolatedUrl}/events?mesa=1`, {
      headers: { 'x-mesa-token': tamperedToken },
    })).status, 403);
    const invalidTokens = [
      mesaOneToken.slice(0, -1),
      `${mesaOneToken}0`,
      'z'.repeat(64),
      'token-invalido',
    ];
    for (const invalidToken of invalidTokens) {
      assert.equal((await fetch(`${isolatedUrl}/events?mesa=1`, {
        headers: { 'x-mesa-token': invalidToken },
      })).status, 403);
    }
    const duplicatedHeaders = new Headers();
    duplicatedHeaders.append('x-mesa-token', mesaOneToken);
    duplicatedHeaders.append('x-mesa-token', mesaTwoToken);
    assert.equal((await fetch(`${isolatedUrl}/events?mesa=1`, { headers: duplicatedHeaders })).status, 403);
    assert.equal((await fetch(`${isolatedUrl}/api/mesa-token?mesa=1`)).status, 404);

    const publicMesaHtml = await (await fetch(`${isolatedUrl}/mesa.html?mesa=1`)).text();
    const publicAppJs = await (await fetch(`${isolatedUrl}/app.js`)).text();
    assert.doesNotMatch(publicMesaHtml, new RegExp(mesaSecret));
    assert.doesNotMatch(publicMesaHtml, new RegExp(mesaOneToken));
    assert.doesNotMatch(publicAppJs, new RegExp(mesaSecret));
    assert.doesNotMatch(publicAppJs, new RegExp(mesaOneToken));

    const publicHeaders = { 'content-type': 'application/json', 'x-mesa-token': mesaOneToken };
    assert.equal((await fetch(`${isolatedUrl}/api/action`, {
      method: 'POST', headers: publicHeaders, body: JSON.stringify({ type: 'llamar_mozo', mesa: 1 }),
    })).status, 200);
    assert.equal((await fetch(`${isolatedUrl}/api/action`, {
      method: 'POST', headers: publicHeaders, body: JSON.stringify({ type: 'llamar_mozo', mesa: 2 }),
    })).status, 403);
    assert.equal((await fetch(`${isolatedUrl}/api/action`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'llamar_mozo', mesa: 1 }),
    })).status, 401);
    assert.equal((await getStateFrom(isolatedUrl, 1, mesaOneToken)).mesas[0].alertas.length, 1);
    assert.equal((await getStateFrom(isolatedUrl, 2, mesaTwoToken)).mesas[0].alertas.length, 0);

    const login = await fetch(`${isolatedUrl}/api/staff-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin }),
    });
    const { token: staffAccessToken } = await login.json();
    assert.equal((await fetch(`${isolatedUrl}/api/mesa-links`)).status, 401);
    const mesaLinksResponse = await fetch(`${isolatedUrl}/api/mesa-links`, {
      headers: { authorization: `Bearer ${staffAccessToken}` },
    });
    assert.equal(mesaLinksResponse.status, 200);
    const mesaLinks = await mesaLinksResponse.json();
    assert.equal(mesaLinks.secure, true);
    assert.equal(mesaLinks.mesas.length, 22);
    assert.equal(mesaLinks.mesas[0].path, `/mesa.html?mesa=1#token=${mesaOneToken}`);
    assert.doesNotMatch(JSON.stringify(mesaLinks), new RegExp(mesaSecret));
    const staffStream = await fetch(`${isolatedUrl}/api/staff-events`, {
      headers: { authorization: `Bearer ${staffAccessToken}` },
    });
    assert.equal(staffStream.status, 200);
    await staffStream.body.cancel();
    assert.equal((await fetch(`${isolatedUrl}/api/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${staffAccessToken}` },
      body: JSON.stringify({ type: 'reset_demo' }),
    })).status, 200);

    await stopServer(processHandle);
    stopped = true;
    assert.match(output, /"event":"mesa_identity_active"/);
    assert.doesNotMatch(output, new RegExp(mesaSecret));
    assert.doesNotMatch(output, new RegExp(mesaOneToken));
    assert.doesNotMatch(output, new RegExp(mesaTwoToken));
    assert.doesNotMatch(output, new RegExp(staffAccessToken));
  } finally {
    if (!stopped) await stopServer(processHandle);
  }
});

test('sin MESA_TOKEN_SECRET se mantiene el modo legacy con warning seguro', async () => {
  assert.equal((await action({ type: 'llamar_mozo', mesa: 1 })).status, 200);
  assert.deepEqual((await getState()).mesas.map(mesa => mesa.numero), [1]);
  assert.match(serverOutput, /"event":"mesa_identity_inactive"/);
  assert.doesNotMatch(serverOutput, /"event":"mesa_identity_active"/);
  await resetState();
});

test('stream staff rechaza tokens vencidos y revocados', async () => {
  const login = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin }),
  });
  const { token } = await login.json();
  const stream = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  await readSseEvent(reader);
  const logout = await fetch(`${baseUrl}/api/staff-logout`, {
    method: 'POST', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(logout.status, 200);
  const closed = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('el stream revocado no se cerró')), 1500)),
  ]);
  assert.equal(closed.done, true);
  assert.equal((await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${token}` } })).status, 401);
});

test('GET /healthz informa vida sin exponer estado interno', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  assert.deepEqual(await response.json(), { ok: true });
});

test('un error inesperado devuelve respuesta segura y requestId rastreable', async () => {
  const response = await fetch(`${baseUrl}/%E0%A4%A`);
  assert.equal(response.status, 500);
  const requestId = response.headers.get('x-request-id');
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'Error interno');
  assert.equal(body.requestId, requestId);
  assert.equal('stack' in body, false);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(serverOutput, new RegExp(`"event":"unexpected_request_error".*"requestId":"${requestId}"`));
});

test('rate limiting devuelve 429, ignora X-Forwarded-For no confiable y no filtra secretos en logs', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  const secretPin = '97531';
  const secretBody = 'NO_LOG_BODY_MARKER';
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      API_ACTION_RATE_LIMIT_MAX: '2',
      DATABASE_URL: '',
      PORT: String(port),
      RATE_LIMIT_WINDOW_MS: '60000',
      STAFF_LOGIN_RATE_LIMIT_MAX: '2',
      STAFF_PIN: secretPin,
      TRUSTED_PROXY_IPS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);
    let issuedToken = '';
    for (let index = 0; index < 2; index++) {
      const login = await fetch(`${isolatedUrl}/api/staff-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${index + 1}` },
        body: JSON.stringify({ pin: secretPin }),
      });
      assert.equal(login.status, 200);
      issuedToken = (await login.json()).token;
    }
    const limitedLogin = await fetch(`${isolatedUrl}/api/staff-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.99' },
      body: JSON.stringify({ pin: secretPin }),
    });
    assert.equal(limitedLogin.status, 429);
    assert.equal(limitedLogin.headers.get('retry-after'), '60');
    const limitedError = await limitedLogin.json();
    assert.match(limitedError.requestId, /^[a-f0-9-]{36}$/);
    assert.equal(limitedError.requestId, limitedLogin.headers.get('x-request-id'));
    assert.equal('stack' in limitedError, false);

    assert.equal((await postJson(isolatedUrl, { type: 'llamar_mozo', mesa: 1 }, '192.0.2.1')).status, 200);
    assert.equal((await postJson(isolatedUrl, { type: 'ayuda', mesa: 1, categoria: 'otro', mensaje: secretBody }, '192.0.2.2')).status, 200);
    assert.equal((await postJson(isolatedUrl, { type: 'llamar_mozo', mesa: 1 }, '192.0.2.3')).status, 429);
    const isolatedState = await getStateFrom(isolatedUrl);
    assert.equal(isolatedState.mesas[0].alertas.length, 2);

    await stopServer(processHandle);
    stopped = true;
    assert.doesNotMatch(output, new RegExp(secretPin));
    assert.doesNotMatch(output, new RegExp(issuedToken));
    assert.doesNotMatch(output, new RegExp(secretBody));
    assert.match(output, new RegExp(`"requestId":"${limitedError.requestId}".*"status":429`));
    assert.match(output, /"event":"server_started"/);
    assert.match(output, /"event":"request"/);
    assert.match(output, /"persistenceMode":"memory"/);
  } finally {
    if (!stopped) await stopServer(processHandle);
  }
});

test('una DATABASE_URL fallida no se filtra en los logs de arranque', async () => {
  const databasePort = await reservePort();
  const appPort = await reservePort();
  const databaseSecret = 'DB_SECRET_MARKER_741852';
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://usuario:${databaseSecret}@127.0.0.1:${databasePort}/rabieta?connect_timeout=1`,
      PORT: String(appPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      processHandle.kill('SIGKILL');
      reject(new Error(`El proceso no falló a tiempo.\n${output}`));
    }, 5000);
    processHandle.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  assert.notEqual(exitCode, 0);
  assert.match(output, /"event":"startup_error"/);
  assert.doesNotMatch(output, new RegExp(databaseSecret));
  assert.doesNotMatch(output, /postgresql:\/\//);
  assert.doesNotMatch(output, /"event":"server_started"/);
});

test('el token expira y deja de autorizar acciones internas', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  let isolatedOutput = '';
  const isolatedProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: '', PORT: String(port), STAFF_PIN: testPin, STAFF_TOKEN_TTL_MS: '500' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  isolatedProcess.stdout.on('data', chunk => { isolatedOutput += chunk; });
  isolatedProcess.stderr.on('data', chunk => { isolatedOutput += chunk; });
  try {
    await waitUntilReady(isolatedUrl, isolatedProcess, () => isolatedOutput);
    const login = await fetch(`${isolatedUrl}/api/staff-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin }),
    });
    const { token } = await login.json();
    const valid = await fetch(`${isolatedUrl}/api/action`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'reset_demo' }),
    });
    assert.equal(valid.status, 200);
    await new Promise(resolve => setTimeout(resolve, 650));
    const expiredStream = await fetch(`${isolatedUrl}/api/staff-events`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(expiredStream.status, 401);
    const expired = await fetch(`${isolatedUrl}/api/action`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'reset_demo' }),
    });
    assert.equal(expired.status, 401);
  } finally {
    await stopServer(isolatedProcess);
  }
});

test('Content-Type no JSON devuelve 415 y no modifica estado', async () => {
  await resetState();
  const before = (await getState()).mesas[0];
  const badAction = await fetch(`${baseUrl}/api/action`, {
    method: 'POST', headers: { 'content-type': 'text/plain' },
    body: JSON.stringify({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] }),
  });
  assert.equal(badAction.status, 415);
  assert.deepEqual((await getState()).mesas[0], before);

  const badLogin = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ pin: testPin }),
  });
  assert.equal(badLogin.status, 415);
  assert.equal((await badLogin.json()).token, undefined);
});

test('el servidor reconstruye productos y precios desde el menú', async () => {
  await resetState();
  const response = await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta', observacion: '<img src=x onerror=alert(1)>', nombre: 'Falso', precio: 1 }] });
  assert.equal(response.status, 200);
  const item = (await getState()).mesas[0].pedido.items[0];
  assert.ok(Number.isInteger(item.id));
  assert.equal(item.estado, 'enviado');
  assert.ok(Number.isFinite(item.enviadoTs));
  assert.deepEqual(
    { productoId: item.productoId, nombre: item.nombre, precio: item.precio, notas: item.notas },
    { productoId: 'hummus-rabieta', nombre: 'Hummus Rabieta', precio: 4600, notas: '<img src=x onerror=alert(1)>' }
  );

  const configured = await action({ type: 'pedido_nuevo', mesa: 2, items: [
    { productoId: 'tablita-quesos-fiambres', variante: 'Individual (sin bebida)' },
    { productoId: '2-empanadas-sintacc', opcion: 'carne' },
  ] });
  assert.equal(configured.status, 200);
  const configuredItems = (await getStateFrom(baseUrl, 2)).mesas[0].pedido.items;
  assert.equal(configuredItems[0].nombre, 'Tablita de Quesos y Fiambres — Individual (sin bebida)');
  assert.equal(configuredItems[0].precio, 5640);
  assert.equal(configuredItems[0].variante, 'Individual (sin bebida)');
  assert.equal(configuredItems[0].opcion, null);
  assert.equal(configuredItems[1].nombre, '2 Empanadas de carne o verdura (Sin TACC) (carne)');
  assert.equal(configuredItems[1].precio, 2100);
  assert.equal(configuredItems[1].variante, null);
  assert.equal(configuredItems[1].opcion, 'carne');
  const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(appSource, /Agregar última ronda al carrito/);
  assert.match(appSource, /Revisá tu carrito/);
  assert.match(appSource, /function quitarDelCarrito\(index\)/);
  assert.match(appSource, /variante:variante\?variante\.nombre:null, opcion:opcion\|\|null/);
  assert.match(appSource, /function cambiarCantidadCarrito\(index,delta\)/);
  assert.match(appSource, /flatMap\(item=>Array\.from\(\{length:cantidadLinea\(item\)\}/);
  assert.match(appSource, /Tu carrito sigue intacto/);
  assert.match(appSource, /Reintentar envío/);
  assert.match(appSource, /type:'pedido-enviado'/);
  assert.match(appSource, /async function confirmarLlamarMozo\(\)/);
  assert.match(appSource, /Reintentar llamado/);
  assert.match(appSource, /async function confirmarPedirCuenta\(\)/);
  assert.match(appSource, /Solo se quitarán del carrito cuando la cuenta sea solicitada con éxito/);
  assert.match(appSource, /type:'cuenta-enviada'/);
});

test('productos, variantes y opciones inválidas no modifican estado', async () => {
  await resetState();
  const invalid = [
    { type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'no-existe' }] },
    { type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'tablita-quesos-fiambres', variante: 'Inventada' }] },
    { type: 'pedido_nuevo', mesa: 1, items: [{ productoId: '2-empanadas-sintacc', opcion: 'pollo' }] },
  ];
  for (const body of invalid) assert.equal((await action(body)).status, 400);
  assert.equal((await getState()).mesas[0].pedido, null);
});

test('reintentar una solicitud de ayuda no duplica la alerta de salón', async () => {
  await resetState();
  const solicitud = { type: 'ayuda', mesa: 1, categoria: 'otro', mensaje: 'Falta una bebida', solicitudId: 'ayuda-retry-1' };
  assert.equal((await action(solicitud)).status, 200);
  assert.equal((await action(solicitud)).status, 200);
  const mesa = (await getState()).mesas[0];
  assert.equal(mesa.alertas.length, 1);
  assert.equal(mesa.alertas[0].solicitudId, solicitud.solicitudId);
  assert.equal((await action({ ...solicitud, solicitudId: 'espacio no valido' })).status, 400);
});

test('allowlist, mesa y estados inválidos dan 4xx sin mutar estado', async () => {
  await resetState();
  assert.equal((await action({ type: 'accion_inventada', mesa: 1 })).status, 400);
  assert.equal((await action({ type: 'llamar_mozo', mesa: 0 })).status, 400);
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, estado: 'hackeado' }, staffToken)).status, 400);
  assert.equal((await action({ type: 'pedido_estado', mesa: 1, estado: 'listo' }, staffToken)).status, 409);
  assert.equal((await getState()).mesas[0].pedido.estado, 'enviado');
});

test('JSON inválido da 400 y body mayor a 32 KB da 413', async () => {
  const malformed = await fetch(`${baseUrl}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(`${baseUrl}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'ayuda', mesa: 1, categoria: 'otro', mensaje: 'x'.repeat(33 * 1024) }) });
  assert.equal(oversized.status, 413);
});

test('los textos libres se escapan en renders con innerHTML', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const mesaSource = fs.readFileSync(path.join(root, 'public', 'mesa.html'), 'utf8');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const publicSource = fs.readdirSync(path.join(root, 'public'))
    .filter(name => fs.statSync(path.join(root, 'public', name)).isFile())
    .map(name => fs.readFileSync(path.join(root, 'public', name), 'utf8'))
    .join('\n');
  assert.match(source, /escapeHtml\(it\.notas\)/);
  assert.match(source, /escapeHtml\(a\.mensaje\)/);
  assert.doesNotMatch(source, /\$\{it\.notas\}/);
  assert.doesNotMatch(source, /\$\{a\.mensaje\}/);
  assert.doesNotMatch(source, /staff-events\?/);
  assert.match(source, /fetch\('\/api\/staff-events', \{headers:\{Authorization:'Bearer ' \+ STAFF_TOKEN\}\}\)/);
  assert.match(source, /headers\['X-Mesa-Token'\] = MESA_TOKEN/);
  assert.match(mesaSource, /new URLSearchParams\(location\.hash\.slice\(1\)\)/);
  assert.match(mesaSource, /sessionStorage\.setItem\(tokenStorageKey, fragmentToken\)/);
  assert.match(mesaSource, /'rabietaMesaToken:' \+ mesaN/);
  assert.match(mesaSource, /history\.replaceState\(null, '', location\.pathname \+ location\.search\)/);
  assert.doesNotMatch(source, /events\?mesa=.*MESA_TOKEN/);
  assert.doesNotMatch(publicSource, /MESA_TOKEN_SECRET/);
  assert.doesNotMatch(serverSource, /pathname === ['"]\/api\/mesa-token/);
  assert.match(serverSource, /crypto\.timingSafeEqual\(expected, supplied\)/);

  const inlineScript = [...mesaSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const sessionValues = new Map();
  let capturedToken = null;
  let cleanedUrl = null;
  const browserContext = {
    URLSearchParams,
    location: { search: '?mesa=1', hash: '#token=token-local-de-prueba', pathname: '/mesa.html' },
    history: { replaceState(_state, _title, url) { cleanedUrl = url; } },
    sessionStorage: {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
    },
    setMesaToken(token) { capturedToken = token; },
    document: { getElementById() { return { innerHTML: '' }; } },
    state: {},
    conectar() {},
    fetch() { return { then() { return this; } }; },
  };
  vm.runInNewContext(inlineScript, browserContext);
  assert.equal(capturedToken, 'token-local-de-prueba');
  assert.equal(sessionValues.get('rabietaMesaToken:1'), 'token-local-de-prueba');
  assert.equal(cleanedUrl, '/mesa.html?mesa=1');
  assert.doesNotMatch(cleanedUrl, /token|#/);
  const implementation = source.match(/function escapeHtml\(value\)\{[\s\S]*?\n\}/);
  assert.ok(implementation, 'debe existir el escape HTML usado por los renders');
  const malicious = '<img src=x onerror="globalThis.xss=true"> & \'ataque\'';
  const escaped = vm.runInNewContext(`${implementation[0]}; escapeHtml(payload)`, { payload: malicious });
  assert.equal(escaped, '&lt;img src=x onerror=&quot;globalThis.xss=true&quot;&gt; &amp; &#39;ataque&#39;');
  assert.doesNotMatch(escaped, /<img|onerror="/);

  const timeImplementation = source.match(/function timeAgoSec\(ts\)\{[^\n]+\}/);
  assert.ok(timeImplementation, 'debe existir el calculo de antiguedad operativa');
  const elapsedSeconds = vm.runInNewContext(`${timeImplementation[0]}; timeAgoSec(20)`, { state: { clockMs: 65 } });
  assert.equal(elapsedSeconds, 45);
});

test('3D y AR mantienen una foto útil y explican dispositivos incompatibles', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /id="fallback3d"/);
  assert.match(source, /onerror="modelo3dError\(\)"/);
  assert.match(source, /mv\.canActivateAR===false/);
  assert.match(source, /No se pudo abrir la cámara AR/);
  assert.match(source, /Ningún plato tiene todavía un modelo 3D real publicable/);
  assert.match(source, /GLB real de \$\{p\.nombre\}/);
  assert.match(source, /USDZ real de \$\{p\.nombre\}/);
  assert.match(source, /foto real de \$\{p\.nombre\}/);
  assert.match(source, /Prototipo 3D\/AR en desarrollo/);
  assert.doesNotMatch(source, /Platos con 3D real activado/);
});

test('cliente ve estado y tiempo realtime de cada ítem del pedido', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /class="customer-order-items"/);
  assert.match(source, /class="customer-order-meta"[\s\S]*itemElapsedLabel\(it\)/);
});

test('la sesión de personal se guarda localmente y sobrevive a un reload; vence de forma segura ante un 401', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const sessionBlock = source.match(/function setStaffToken\(token\)\{[\s\S]*?\nfunction staffLogout\(\)\{[\s\S]*?\r?\n\}\r?\n/);
  assert.ok(sessionBlock, 'debe existir el bloque de sesión de personal persistente');

  function makeContext(){
    const store = new Map();
    const fetchCalls = [];
    const endedCalls = [];
    const ctx = {
      STAFF_TOKEN: null, STAFF_ROLE: null, STAFF_ALLOWED_VIEWS: [],
      localStorage: {
        getItem(key){ return store.has(key) ? store.get(key) : null; },
        setItem(key,value){ store.set(key,String(value)); },
        removeItem(key){ store.delete(key); },
      },
      fetch(url,opts){ fetchCalls.push({url,opts}); return Promise.resolve({ok:true}); },
      window: {},
    };
    ctx.window.onStaffSessionEnded = (reason)=>endedCalls.push(reason);
    vm.createContext(ctx);
    vm.runInContext(sessionBlock[0], ctx);
    return { ctx, store, fetchCalls, endedCalls };
  }

  // Login normal: persist por defecto en localStorage.
  const a = makeContext();
  vm.runInContext("setStaffSession('tok-123','dueno',['dueno'])", a.ctx);
  assert.equal(a.ctx.STAFF_TOKEN, 'tok-123');
  const saved = JSON.parse(a.store.get('rabieta_staff_session_v1'));
  assert.deepEqual(saved, { token:'tok-123', role:'dueno', allowedViews:['dueno'] });

  // "Reload": un contexto nuevo pero con el mismo localStorage puede recuperar la sesión.
  const b = makeContext();
  b.store.set('rabieta_staff_session_v1', a.store.get('rabieta_staff_session_v1'));
  const recovered = vm.runInContext('loadStoredStaffSession()', b.ctx);
  assert.equal(JSON.stringify(recovered), JSON.stringify({ token:'tok-123', role:'dueno', allowedViews:['dueno'] }));

  // Resumir con persist=false no debe reescribir el storage.
  const c = makeContext();
  c.store.set('rabieta_staff_session_v1', JSON.stringify({token:'tok-999',role:'mozo',allowedViews:['mozo']}));
  vm.runInContext("setStaffSession('tok-999','mozo',['mozo'],false)", c.ctx);
  assert.equal(c.store.get('rabieta_staff_session_v1'), JSON.stringify({token:'tok-999',role:'mozo',allowedViews:['mozo']}));

  // Token vencido (401 del servidor): se limpia la sesión y se avisa a la UI para pedir el PIN de nuevo.
  const d = makeContext();
  vm.runInContext("setStaffSession('tok-viejo','mozo',['mozo'])", d.ctx);
  vm.runInContext('staffSessionExpired()', d.ctx);
  assert.equal(d.ctx.STAFF_TOKEN, null);
  assert.equal(d.store.has('rabieta_staff_session_v1'), false);
  assert.deepEqual(d.endedCalls, ['expired']);

  // Sin sesión activa, un 401 no debe disparar el aviso de vencimiento.
  const e = makeContext();
  vm.runInContext('staffSessionExpired()', e.ctx);
  assert.deepEqual(e.endedCalls, []);

  // Cierre de sesión manual: limpia local y avisa al servidor para invalidar el token.
  const f = makeContext();
  vm.runInContext("setStaffSession('tok-logout','encargado',['encargado'])", f.ctx);
  vm.runInContext('staffLogout()', f.ctx);
  assert.equal(f.ctx.STAFF_TOKEN, null);
  assert.equal(f.store.has('rabieta_staff_session_v1'), false);
  assert.deepEqual(f.endedCalls, ['logout']);
  assert.equal(f.fetchCalls.length, 1);
  assert.equal(f.fetchCalls[0].url, '/api/staff-logout');
  assert.equal(f.fetchCalls[0].opts.headers.Authorization, 'Bearer tok-logout');

  assert.match(source, /response\.status===401.*expirado=true/);
  assert.match(source, /if\(expirado\)\{[\s\S]*?hideConnStatus\(\);[\s\S]*?staffSessionExpired\(\);[\s\S]*?break;[\s\S]*?\}/);

  assert.match(source, /onclick="staffLogout\(\)"/);
  const staffHtml = fs.readFileSync(path.join(root, 'public', 'staff.html'), 'utf8');
  assert.match(staffHtml, /window\.onStaffSessionEnded = function\(reason\)\{/);
  assert.match(staffHtml, /const sesion = loadStoredStaffSession\(\);/);
});

test('cliente conserva confirmación visible cuando salón resuelve una solicitud', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /mesa\.alertas\.filter\(a=>a\.estado===['"]resuelto['"]\)/);
  assert.match(source, /class="resolved-request"[\s\S]*Resuelto/);
});

test('cliente confirma, conserva y reintenta solicitudes de ayuda', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /clienteAyudaDraft/);
  assert.match(source, /async function enviarAyuda\(id,mensaje='',reintento=false\)/);
  assert.match(source, /solicitudId:pendiente\.solicitudId/);
  assert.match(source, /Tu elección y mensaje siguen acá/);
  assert.match(source, /Reintentar solicitud/);
  assert.match(source, /type:'ayuda-enviada'/);
  assert.match(source, /Salón ya recibió tu aviso/);
});

test('cliente conserva variantes, opciones y observaciones durante actualizaciones realtime', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /clienteProductoDrafts:\{\}/);
  assert.match(source, /active\.closest\('\.review-card, \.ai-assistant, \.dish-detail, \.help-panel'\)/);
  assert.match(source, /function obtenerProductoDraft\(producto\)/);
  assert.match(source, /onchange="actualizarProductoDraft\('\$\{p\.id\}','variante',\$\{i\}\)"/);
  assert.match(source, /onchange="actualizarProductoDraft\('\$\{p\.id\}','opcion',\$\{i\}\)"/);
  assert.match(source, /value="\$\{escapeHtml\(draft\.observacion\)\}"/);
  assert.match(source, /const nota = draft\.observacion\.trim\(\)/);
  assert.match(source, /delete state\.clienteProductoDrafts\[id\]/);
  assert.doesNotMatch(source, /document\.querySelector\(`input\[name="var_/);
});

test('cliente entiende los cortes realtime y recibe confirmación al reconectar', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public', 'rabieta.css'), 'utf8');
  assert.match(source, /banner\.id='connBanner'/);
  assert.match(source, /aria-live','polite'/);
  assert.match(source, /Sin conexión con Rabieta/);
  assert.match(source, /Tu carrito y lo que estabas completando quedan guardados/);
  assert.match(source, /Conexión recuperada/);
  assert.match(source, /La pantalla volvió a estar al día/);
  assert.match(styles, /\.conn-banner\.offline/);
  assert.match(styles, /\.conn-banner\.recovered/);
});

test('cliente recupera el carrito de una recarga sin confiar en precios locales', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const mesaHtml = fs.readFileSync(path.join(root, 'public', 'mesa.html'), 'utf8');
  assert.match(source, /'rabietaCart:'\+state\.clienteMesa/);
  assert.match(source, /function recuperarCarritoLocal\(\)/);
  assert.match(source, /const producto=findProducto\(raw\.productoId\)/);
  assert.match(source, /precio=encontrada\.precio/);
  assert.match(source, /producto\.opciones\.includes\(raw\.opcion\)/);
  assert.match(source, /sessionStorage\.removeItem\(key\)/);
  assert.match(source, /Tu carrito sigue acá/);
  assert.match(mesaHtml, /recuperarCarritoLocal\(\)/);
});

test('el traspaso de ítems listos se confirma desde salón y no desde Cocina o Barra', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /function itemsListosParaEntregar\(mozo\)/);
  assert.match(source, /item\.estado==='listo'/);
  assert.match(source, /Confirmar entrega en mesa/);
  assert.match(source, /confirmarEntrega\(\$\{mesa\.numero\},\$\{item\.id\}\)/);
  assert.match(source, /Esperando retiro de salón/);
  assert.match(source, /statTile\('Esperando salón'/);
  assert.doesNotMatch(source, /it\.estado==='listo'\?`<button[^`]+avanzarItem/);
});

test('el panel de staff genera QR de mesa localmente y conserva un enlace utilizable como respaldo', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public', 'rabieta.css'), 'utf8');
  const staffHtml = fs.readFileSync(path.join(root, 'public', 'staff.html'), 'utf8');
  const qrLicense = fs.readFileSync(path.join(root, 'public', 'vendor', 'qrcode.LICENSE.txt'), 'utf8');
  assert.match(source, /fetch\('\/api\/mesa-links'/);
  assert.match(source, /code=qrcode\(0,'M'\)/);
  assert.match(source, /id:`mesa-qr-description-\$\{mesa\.numero\}`/);
  assert.match(source, /Copiar enlace/);
  assert.match(source, /target="_blank" rel="noopener"/);
  assert.match(source, /Imprimir todos los QR/);
  assert.match(source, /Impresión bloqueada sin identidad segura/);
  assert.match(source, /document\.body\.classList\.add\('printing-qrs'\)/);
  assert.match(source, /window\.addEventListener\('afterprint'/);
  assert.match(styles, /@media print/);
  assert.match(styles, /grid-template-columns:repeat\(3,1fr\)/);
  assert.match(staffHtml, /\/vendor\/qrcode\.js/);
  assert.doesNotMatch(staffHtml, /cdnjs|unpkg/);
  assert.match(qrLicense, /MIT License/);
  assert.doesNotMatch(source, /api\.qrserver|chart\.googleapis/);
});

test('el asistente ofrece consulta libre local, resultados accionables y declara su alcance', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const engine = fs.readFileSync(path.join(root, 'public', 'recommender.js'), 'utf8');
  const mesaHtml = fs.readFileSync(path.join(root, 'public', 'mesa.html'), 'utf8');
  assert.match(source, /function consultarAsistente\(event\)/);
  assert.match(source, /function agregarRecomendacion\(id\)/);
  assert.match(source, /Escribí como hablarías con el mozo/);
  assert.match(engine, /Number\.isFinite\(price\)/);
  assert.match(engine, /unsafeRestriction/);
  assert.match(source, /no envía datos a ningún servicio externo/);
  assert.match(engine, /Confirmá con el personal por contaminación cruzada/);
  assert.match(mesaHtml, /recommender\.js/);
  assert.doesNotMatch(source, /fetch\(['"]\/api\/recomend/);
});

test('dueño ve un embudo operativo vivo con foco sugerido', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /Embudo operativo ahora/);
  assert.match(source, /label:'Sin pedido'/);
  assert.match(source, /label:'En producción'/);
  assert.match(source, /label:'Esperando salón'/);
  assert.match(source, /label:'Cuenta abierta'/);
  assert.match(source, /label:'Pagadas'/);
  assert.match(source, /Foco sugerido/);
});

test('dueño ve un checklist honesto de preparación de Mercado Pago; sin credenciales todo aparece pendiente y solo Dueño lo recibe', async () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /Preparación de Mercado Pago/);
  assert.match(source, /Ningún pago real se procesa todavía/);

  const duenoLogin = await loginAs('dueno');
  const duenoMessage = await getStaffStateWithToken(duenoLogin.token);
  assert.deepEqual(duenoMessage.integraciones, {
    mercadoPago: { accessToken: false, publicKey: false, webhookSecret: false },
  });

  const encargadoLogin = await loginAs('encargado');
  const encargadoMessage = await getStaffStateWithToken(encargadoLogin.token);
  assert.equal(encargadoMessage.integraciones, undefined);
});

test('las credenciales de Mercado Pago solo se exponen como booleanos, nunca sus valores', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  const secretAccessToken = 'TEST-mp-access-' + crypto.randomBytes(8).toString('hex');
  const secretPublicKey = 'TEST-mp-public-' + crypto.randomBytes(8).toString('hex');
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env, DATABASE_URL: '', PORT: String(port), STAFF_PIN: testPin,
      MERCADOPAGO_ACCESS_TOKEN: secretAccessToken, MERCADOPAGO_PUBLIC_KEY: secretPublicKey,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);
    const login = await fetch(`${isolatedUrl}/api/staff-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin, role: 'dueno' }),
    });
    const { token } = await login.json();
    const response = await fetch(`${isolatedUrl}/api/staff-events`, { headers: { authorization: `Bearer ${token}` } });
    const reader = response.body.getReader();
    const event = await readSseEvent(reader);
    await reader.cancel();
    assert.deepEqual(event.message.integraciones, {
      mercadoPago: { accessToken: true, publicKey: true, webhookSecret: false },
    });
    const rawPayload = JSON.stringify(event.message);
    assert.doesNotMatch(rawPayload, new RegExp(secretAccessToken));
    assert.doesNotMatch(rawPayload, new RegExp(secretPublicKey));
    await stopServer(processHandle);
    stopped = true;
    assert.doesNotMatch(output, new RegExp(secretAccessToken));
    assert.doesNotMatch(output, new RegExp(secretPublicKey));
  } finally {
    if (!stopped) await stopServer(processHandle);
  }
});

test('el cliente distingue un QR/token de mesa inválido de un corte de conexión temporal', async () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /response\.status===401 \|\| response\.status===403/);
  assert.match(source, /state\.clienteAccesoInvalido = true;/);
  assert.match(source, /if\(state\.clienteAccesoInvalido\) return accesoInvalidoHtml\(\);/);
  assert.match(source, /No es un corte de conexión: reintentar solo no lo va a resolver\./);
  assert.match(source, /Pedile a un mozo que te ayude/);
  // Con el acceso marcado inválido, el bucle de reconexión debe frenar en vez
  // de reintentar para siempre con el mismo token roto.
  assert.match(source, /while\(state\.role==='cliente' && !state\.clienteAccesoInvalido\)\{/);

  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  const mesaSecret = crypto.randomBytes(32).toString('hex');
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: '', MESA_TOKEN_SECRET: mesaSecret, PORT: String(port), STAFF_PIN: testPin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);
    // Sin token: el cliente debe poder distinguirlo (401) de un 5xx transitorio.
    const sinToken = await fetch(`${isolatedUrl}/events?mesa=1`);
    assert.equal(sinToken.status, 401);
    // Token de otra mesa / adulterado: también es un rechazo explícito y permanente (403).
    const tokenMesaDos = tokenForMesa(mesaSecret, 2);
    const tokenEquivocado = await fetch(`${isolatedUrl}/events?mesa=1`, { headers: { 'x-mesa-token': tokenMesaDos } });
    assert.equal(tokenEquivocado.status, 403);
    // Token correcto: se conecta normalmente, sin ningún rechazo.
    const tokenMesaUno = tokenForMesa(mesaSecret, 1);
    const tokenCorrecto = await fetch(`${isolatedUrl}/events?mesa=1`, { headers: { 'x-mesa-token': tokenMesaUno } });
    assert.equal(tokenCorrecto.status, 200);
    await tokenCorrecto.body.cancel();
    await stopServer(processHandle);
    stopped = true;
  } finally {
    if (!stopped) await stopServer(processHandle);
  }
});

test('la IA de Rabieta es visible desde el splash y ofrece ejemplos accionables, sin dejar de declarar su alcance real', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /IA de Rabieta/);
  assert.match(source, /function abrirAsistenteDesdeSplash\(\)\{/);
  assert.match(source, /Preguntale a la IA de Rabieta qué pedir/);
  assert.match(source, /function probarEjemploAsistente\(query\)\{/);
  assert.match(source, /class="ai-examples"/);
  assert.match(source, /no inventa platos, precios ni disponibilidad/);
  assert.match(source, /no envía datos a ningún servicio externo/);
});

test('una sesión de personal vencida no muestra el banner contradictorio de "sin conexión, estamos intentando volver"', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /function hideConnStatus\(\)\{/);
  // El mismo bug que ya se corrigió para el acceso de mesa (401/403 no es un
  // corte transitorio) también aplicaba al login de personal: verificamos que
  // ambos caminos ocultan el banner de conexión antes de mostrar su propio
  // mensaje explícito, en vez de dejar los dos contradiciéndose en pantalla.
  const conectarMesaBody = source.match(/async function conectarMesa\(onFirstSnapshot\)\{[\s\S]*?\r?\n\}\r?\n/)[0];
  assert.match(conectarMesaBody, /hideConnStatus\(\);/);
  const conectarStaffBody = source.match(/async function conectarStaff\(onFirstSnapshot\)\{[\s\S]*?\r?\n  \}\r?\n\}/)[0];
  assert.match(conectarStaffBody, /hideConnStatus\(\);/);
  assert.match(conectarStaffBody, /if\(expirado\)\{[\s\S]*?hideConnStatus\(\);[\s\S]*?staffSessionExpired\(\);[\s\S]*?break;/);
});

test('sin credenciales de Mercado Pago, iniciar un pago real da un error claro y el sandbox interno sigue intacto', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 6, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 6 })).status, 200);
  const sinConfigurar = await action({ type: 'pago_mercadopago_iniciar', mesa: 6 });
  assert.equal(sinConfigurar.status, 409);
  assert.match((await sinConfigurar.json()).error, /no está configurado/);
  assert.equal((await getStaffState()).mesas.find(m => m.numero === 6).pago, null);
  // El sandbox interno de siempre no se ve afectado por la ausencia de configuración real.
  assert.equal((await action({ type: 'pago_sandbox_confirmar', mesa: 6, medio: 'mercado_pago' })).status, 200);
  await resetState();
});

test('checkout real de Mercado Pago: preferencia, webhook con firma válida, idempotencia y habilita reseña/liberar mesa', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  const webhookSecret = 'test-webhook-secret';
  let capturedExternalReference = null;
  const mock = await startMockMercadoPago({
    onPreference(body) {
      capturedExternalReference = body.external_reference;
      assert.deepEqual(body.items, [{ title: 'Hummus Rabieta', quantity: 1, unit_price: 4600, currency_id: 'ARS' }]);
      return { status: 201, body: { id: 'pref-123', init_point: 'https://mp.mock/init', sandbox_init_point: 'https://mp.mock/sandbox-init' } };
    },
    onPayment(paymentId) {
      assert.equal(paymentId, 'pay-999');
      return { status: 200, body: { status: 'approved', external_reference: capturedExternalReference } };
    },
  });
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env, DATABASE_URL: '', PORT: String(port), STAFF_PIN: testPin,
      MERCADOPAGO_ACCESS_TOKEN: 'TEST-mp-access-token', MERCADOPAGO_PUBLIC_KEY: 'TEST-mp-public-key',
      MERCADOPAGO_WEBHOOK_SECRET: webhookSecret, MERCADOPAGO_API_BASE: mock.url,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);
    async function isolatedAction(body, token) {
      const headers = { 'content-type': 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;
      return fetch(`${isolatedUrl}/api/action`, { method: 'POST', headers, body: JSON.stringify(body) });
    }
    async function isolatedStaffState(staffToken) {
      const response = await fetch(`${isolatedUrl}/api/staff-events`, { headers: { authorization: `Bearer ${staffToken}` } });
      const reader = response.body.getReader();
      const event = await readSseEvent(reader);
      await reader.cancel();
      return event.message;
    }
    const login = await fetch(`${isolatedUrl}/api/staff-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin, role: 'encargado' }),
    });
    const { token } = await login.json();

    assert.equal((await isolatedAction({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
    assert.equal((await isolatedAction({ type: 'pedir_cuenta', mesa: 1 })).status, 200);

    const iniciar = await isolatedAction({ type: 'pago_mercadopago_iniciar', mesa: 1 });
    assert.equal(iniciar.status, 200);
    assert.equal(mock.calls.preferences.length, 1);
    assert.ok(capturedExternalReference && capturedExternalReference.startsWith('rabieta-mesa1-'));

    let mesaUno = (await getStateFrom(isolatedUrl, 1)).mesas[0];
    assert.equal(mesaUno.pago.modo, 'mercadopago');
    assert.equal(mesaUno.pago.estado, 'pendiente');
    assert.equal(mesaUno.pago.checkoutUrl, 'https://mp.mock/sandbox-init');
    assert.equal(mesaUno.pago.total, 4600);

    // Con el pago pendiente, la mesa todavía no puede liberarse ni dejar reseña.
    assert.equal((await isolatedAction({ type: 'mesa_liberar', mesa: 1 }, token)).status, 409);
    assert.equal((await isolatedAction({ type: 'resena_enviar', mesa: 1, puntuacion: 5 })).status, 409);

    // Firma inválida: rechazada, sin tocar el estado.
    const badSignature = await fetch(`${isolatedUrl}/api/pagos/mercadopago-webhook?data.id=pay-999&type=payment`, {
      method: 'POST', headers: { 'x-signature': 'ts=1,v1=00', 'x-request-id': 'req-1' },
    });
    assert.equal(badSignature.status, 401);
    assert.equal((await getStateFrom(isolatedUrl, 1)).mesas[0].pago.estado, 'pendiente');

    // Webhook real con firma válida: confirma el pago.
    const headers = mercadoPagoWebhookHeaders(webhookSecret, 'pay-999');
    const webhook = await fetch(`${isolatedUrl}/api/pagos/mercadopago-webhook?data.id=pay-999&type=payment`, { method: 'POST', headers });
    assert.equal(webhook.status, 200);
    assert.equal(mock.calls.payments[0], 'pay-999');

    mesaUno = (await getStateFrom(isolatedUrl, 1)).mesas[0];
    assert.equal(mesaUno.pago.estado, 'confirmado');
    assert.equal(mesaUno.pago.modo, 'mercadopago');
    assert.equal(mesaUno.pago.referencia, 'pay-999');

    const duenoToken = (await (await fetch(`${isolatedUrl}/api/staff-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: testPin, role: 'dueno' }),
    })).json()).token;
    const duenoState = await isolatedStaffState(duenoToken);
    assert.equal(duenoState.state.analytics.pagosConfirmados, 1);
    assert.equal(duenoState.state.analytics.ventasDemo, 4600);

    // Reintento del mismo webhook (Mercado Pago reintenta ante cualquier duda): no debe duplicar analytics.
    const webhookOtraVez = await fetch(`${isolatedUrl}/api/pagos/mercadopago-webhook?data.id=pay-999&type=payment`, { method: 'POST', headers });
    assert.equal(webhookOtraVez.status, 200);
    const duenoStateOtraVez = await isolatedStaffState(duenoToken);
    assert.equal(duenoStateOtraVez.state.analytics.pagosConfirmados, 1);

    // Ahora sí se puede dejar reseña y liberar la mesa.
    assert.equal((await isolatedAction({ type: 'resena_enviar', mesa: 1, puntuacion: 5 })).status, 200);
    assert.equal((await isolatedAction({ type: 'mesa_liberar', mesa: 1 }, token)).status, 200);

    await stopServer(processHandle);
    stopped = true;
    assert.doesNotMatch(output, /TEST-mp-access-token/);
    assert.doesNotMatch(output, new RegExp(webhookSecret));
  } finally {
    if (!stopped) await stopServer(processHandle);
    await stopMockServer(mock.server);
  }
});

test('webhook de Mercado Pago sin MERCADOPAGO_WEBHOOK_SECRET configurado no existe funcionalmente', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: '', PORT: String(port), STAFF_PIN: testPin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);
    const response = await fetch(`${isolatedUrl}/api/pagos/mercadopago-webhook?data.id=1&type=payment`, {
      method: 'POST', headers: { 'x-signature': 'ts=1,v1=00', 'x-request-id': 'req-1' },
    });
    assert.equal(response.status, 404);
    await stopServer(processHandle);
    stopped = true;
  } finally {
    if (!stopped) await stopServer(processHandle);
  }
});

test('si la API de Mercado Pago falla al crear la preferencia, el error es honesto y no deja un pago fantasma', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  const mock = await startMockMercadoPago({ onPreference: () => ({ status: 500, body: { message: 'internal error' } }) });
  let output = '';
  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env, DATABASE_URL: '', PORT: String(port), STAFF_PIN: testPin,
      MERCADOPAGO_ACCESS_TOKEN: 'TEST-mp-access-token', MERCADOPAGO_PUBLIC_KEY: 'TEST-mp-public-key',
      MERCADOPAGO_API_BASE: mock.url,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', chunk => { output += chunk; });
  processHandle.stderr.on('data', chunk => { output += chunk; });
  let stopped = false;
  try {
    await waitUntilReady(isolatedUrl, processHandle, () => output);
    async function isolatedAction(body) {
      return fetch(`${isolatedUrl}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
    assert.equal((await isolatedAction({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
    assert.equal((await isolatedAction({ type: 'pedir_cuenta', mesa: 1 })).status, 200);
    const iniciar = await isolatedAction({ type: 'pago_mercadopago_iniciar', mesa: 1 });
    assert.equal(iniciar.status, 502);
    assert.equal((await getStateFrom(isolatedUrl, 1)).mesas[0].pago, null);
    // El sandbox interno sigue disponible aunque Mercado Pago haya fallado.
    assert.equal((await isolatedAction({ type: 'pago_sandbox_confirmar', mesa: 1, medio: 'tarjeta' })).status, 200);
    await stopServer(processHandle);
    stopped = true;
  } finally {
    if (!stopped) await stopServer(processHandle);
    await stopMockServer(mock.server);
  }
});

test('el modal de checkout se vuelve a pintar al cambiar de medio de pago (no queda cacheado con Tarjeta demo)', () => {
  // Bug real encontrado al verificar el checkout de Mercado Pago en el navegador:
  // renderModal() memoiza el modal por una "modalKey" para no perder el foco del
  // input en cada tick de reloj; el tipo 'checkout' no estaba incluido, así que
  // elegir "Mercado Pago" cambiaba el estado pero el DOM seguía mostrando
  // "Tarjeta demo" como activa. Sin esto, nadie podía usar el checkout real.
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /state\.modal\.type==='checkout'\s*\n\s*\?\s*':'\+state\.clientePagoMedio\+':'\+state\.clientePagoEnviando\+':'\+state\.clientePagoError/);
});

test('la IA de Rabieta recuerda las últimas preguntas y responde directo cuando se nombra un plato puntual', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const engine = fs.readFileSync(path.join(root, 'public', 'recommender.js'), 'utf8');
  assert.match(source, /function registrarRespuestaAsistente\(consulta, respuesta\)\{/);
  assert.match(source, /class="ai-history"/);
  assert.match(source, /Antes preguntaste/);
  assert.match(source, /clienteAsistenteHistorial\.length = Math\.min\(state\.clienteAsistenteHistorial\.length, 4\)/);
  assert.match(engine, /function lookupExacto\(menu, intent\)\{/);
  assert.match(engine, /Coincide exactamente con lo que preguntaste/);

  // Bug real encontrado verificando esto en el navegador: si el historial usa
  // el texto vivo del input en vez de la consulta "congelada" que generó la
  // respuesta, la segunda pregunta pisa el texto de la primera antes de
  // guardarla, y el historial queda con la consulta nueva pero el mensaje
  // viejo. Se ejecuta la función real (no una reimplementación) para
  // confirmar que no vuelve a pasar.
  const fnSource = source.match(/function registrarRespuestaAsistente\(consulta, respuesta\)\{[\s\S]*?\r?\n\}\r?\n/)[0];
  const ctx = { state: { clienteAsistenteHistorial: [], clienteAsistenteRespuesta: null, clienteAsistenteConsulta: '', clienteAsistenteConsultaMostrada: '' } };
  vm.createContext(ctx);
  vm.runInContext(fnSource, ctx);
  vm.runInContext("registrarRespuestaAsistente('Una pizza barata', {message:'Encontré 3 opciones de la carta con precio confirmado.'})", ctx);
  // El usuario empieza a escribir la segunda consulta (dispara oninput en cada tecla) antes de enviarla.
  ctx.state.clienteAsistenteConsulta = 'cuanto sale la burger rabieta';
  vm.runInContext("registrarRespuestaAsistente('cuanto sale la burger rabieta', {message:'Burger Rabieta — $3.400.'})", ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.state.clienteAsistenteHistorial)), [
    { consulta: 'Una pizza barata', message: 'Encontré 3 opciones de la carta con precio confirmado.' },
  ]);
});

test('detecta la IP de red real de la PC para armar la demo en casa, descartando localhost/APIPA y priorizando adaptadores no virtuales', () => {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnSource = source.match(/const NOMBRE_ADAPTADOR_VIRTUAL[\s\S]*?function detectarIpsLan\(\)\s*\{[\s\S]*?\r?\n\}\r?\n/)[0];

  function detectarConInterfaces(networkInterfaces) {
    const ctx = { os: { networkInterfaces: () => networkInterfaces } };
    vm.createContext(ctx);
    vm.runInContext(fnSource, ctx);
    return vm.runInContext('detectarIpsLan()', ctx);
  }

  // Caso real de esta máquina: Wi-Fi con IP hogareña, más ruido de APIPA/loopback que debe descartarse.
  // (comparación por JSON: el array vuelve de un contexto vm distinto, deepEqual lo trataría como de otra clase)
  assert.equal(JSON.stringify(detectarConInterfaces({
    'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.1.43' }],
    'Loopback Pseudo-Interface 1': [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    'Conexión de red Bluetooth': [{ family: 'IPv4', internal: false, address: '169.254.170.36' }],
  })), JSON.stringify(['192.168.1.43']));

  // Con Docker/VPN instalados, la IP de verdad (Wi-Fi) debe listarse primero.
  const conVirtuales = detectarConInterfaces({
    'vEthernet (Default Switch)': [{ family: 'IPv4', internal: false, address: '172.28.16.1' }],
    'VirtualBox Host-Only Network': [{ family: 'IPv4', internal: false, address: '192.168.56.1' }],
    'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.1.43' }],
  });
  assert.equal(conVirtuales[0], '192.168.1.43');
  assert.deepEqual(new Set(conVirtuales), new Set(['192.168.1.43', '172.28.16.1', '192.168.56.1']));

  // Sin ninguna red privada real (por ejemplo, recién arrancó sin wifi), no inventa nada.
  assert.equal(JSON.stringify(detectarConInterfaces({
    'Loopback Pseudo-Interface 1': [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
  })), '[]');
});

test('GET /api/network-info exige sesión de personal y devuelve las IPs de red para armar la demo en otros dispositivos', async () => {
  const sinToken = await fetch(`${baseUrl}/api/network-info`);
  assert.equal(sinToken.status, 401);
  const conToken = await fetch(`${baseUrl}/api/network-info`, { headers: { authorization: `Bearer ${staffToken}` } });
  assert.equal(conToken.status, 200);
  const payload = await conToken.json();
  assert.equal(payload.ok, true);
  assert.ok(Number.isInteger(payload.port));
  assert.ok(Array.isArray(payload.lanIps));
});

test('el panel de Encargado arma los QR con la IP de red en vez de "localhost" cuando hace falta, para que abran desde el celular', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(source, /function mesaOrigin\(\)\{/);
  assert.match(source, /function cargarInfoRed\(\)\{/);
  assert.match(source, /function lanBannerHtml\(\)\{/);
  assert.match(source, /function mesaAccessUrl\(path\)\{ return mesaOrigin\(\) \+ path; \}/);
  assert.match(source, /fetch\('\/api\/network-info'/);
});

test('un .glb/.usdz real dejado en public/models/ con el nombre del plato se usa solo, sin tocar código ni reiniciar', async () => {
  const modelsDir = path.join(root, 'public', 'models');
  const glbPath = path.join(modelsDir, 'burger-rabieta.glb');
  const usdzPath = path.join(modelsDir, 'burger-rabieta.usdz');
  assert.ok(fs.existsSync(path.join(modelsDir, 'LEEME.md')), 'debe existir la guía de convención de archivos');
  try {
    fs.writeFileSync(glbPath, 'contenido de prueba, no es un GLB real');
    const conGlb = await (await fetch(`${baseUrl}/api/menu`)).json();
    assert.equal(conGlb._modelos3d['burger-rabieta'].glb, true);
    assert.equal(conGlb._modelos3d['burger-rabieta'].usdz, undefined);
    // No inventa disponibilidad para otro plato que no tiene archivo.
    assert.equal(conGlb._modelos3d['burger-bacon'], undefined);

    fs.writeFileSync(usdzPath, 'contenido de prueba, no es un USDZ real');
    const conAmbos = await (await fetch(`${baseUrl}/api/menu`)).json();
    assert.equal(conAmbos._modelos3d['burger-rabieta'].glb, true);
    assert.equal(conAmbos._modelos3d['burger-rabieta'].usdz, true);
  } finally {
    fs.rmSync(glbPath, { force: true });
    fs.rmSync(usdzPath, { force: true });
  }
  // Vuelve a estar vacío: ningún plato tiene modelo real fuera de este test.
  const limpio = await (await fetch(`${baseUrl}/api/menu`)).json();
  assert.deepEqual(limpio._modelos3d, {});

  const clientSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(clientSource, /function modeloParaPlato\(id\)\{/);
  assert.match(clientSource, /if\(real && real\.glb\)\{/);
  assert.match(clientSource, /Modelo 3D real de Rabieta/);
  assert.match(clientSource, /ios-src="\$\{modelo\.usdz\}"/);
});

test('el panel de Dueño ve un feed de actividad en vivo, más reciente primero, con lo que realmente pasó en la sesión', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 7, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  assert.equal((await action({ type: 'llamar_mozo', mesa: 7 })).status, 200);
  assert.equal((await action({ type: 'pedir_cuenta', mesa: 7 })).status, 200);
  assert.equal((await action({ type: 'pago_sandbox_confirmar', mesa: 7, medio: 'tarjeta' })).status, 200);

  const actividad = (await getStaffState()).analytics.actividad;
  assert.equal(actividad.length, 4);
  // Más reciente primero: el pago (último en ocurrir) va arriba de todo.
  assert.match(actividad[0].texto, /Mesa 7 pagó \$4\.600 con tarjeta demo/);
  assert.equal(actividad[0].tipo, 'pago');
  assert.match(actividad[1].texto, /Mesa 7 pidió la cuenta/);
  assert.match(actividad[2].texto, /Mesa 7 llamó al mozo/);
  assert.match(actividad[3].texto, /Mesa 7 pidió 1 ítem/);
  actividad.forEach(item => assert.ok(Number.isFinite(item.ts)));

  await resetState();
  assert.deepEqual((await getStaffState()).analytics.actividad, []);

  const clientSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.match(clientSource, /function actividadRecienteHtml\(analytics\)\{/);
  assert.match(clientSource, /class="activity-feed"/);
});
