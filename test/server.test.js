'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
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
  const response = await fetch(`${baseUrl}/api/staff-events`, { headers: { authorization: `Bearer ${staffToken}` } });
  const reader = response.body.getReader();
  const event = await readSseEvent(reader);
  await reader.cancel();
  return event.message.state;
}

function tokenForMesa(secret, mesa) {
  return crypto.createHmac('sha256', secret).update(`mesa:${mesa}`).digest('hex');
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
  staffToken = result.token;
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

test('cada avance de cocina conserva una marca de tiempo auditable por ítem', async () => {
  await resetState();
  assert.equal((await action({ type: 'pedido_nuevo', mesa: 1, items: [{ productoId: 'hummus-rabieta' }] })).status, 200);
  let item = (await getState()).mesas[0].pedido.items[0];
  assert.deepEqual(item.estadoTs, { enviado: item.enviadoTs });

  assert.equal((await action({ type: 'pedido_estado', mesa: 1, itemId: item.id, estado: 'preparando' }, staffToken)).status, 200);
  item = (await getState()).mesas[0].pedido.items[0];
  assert.equal(item.estadoTs.enviado, item.enviadoTs);
  assert.equal(item.estadoTs.preparando, (await getState()).clockMs);

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
    modo: 'demo', estado: 'confirmado', total: 7700, confirmadoTs: mesa.pago.confirmadoTs,
  });
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
  assert.equal(configuredItems[1].nombre, '2 Empanadas de carne o verdura (Sin TACC) (carne)');
  assert.equal(configuredItems[1].precio, 2100);
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
});
