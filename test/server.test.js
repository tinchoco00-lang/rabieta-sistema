'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
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

async function getState() {
  const response = await fetch(`${baseUrl}/events`);
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

async function resetState() {
  assert.equal((await action({ type: 'reset_demo' }, staffToken)).status, 200);
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root, env: { ...process.env, PORT: String(port), STAFF_PIN: testPin }, stdio: ['ignore', 'pipe', 'pipe'],
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

test('el token expira y deja de autorizar acciones internas', async () => {
  const port = await reservePort();
  const isolatedUrl = `http://127.0.0.1:${port}`;
  let isolatedOutput = '';
  const isolatedProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), STAFF_PIN: testPin, STAFF_TOKEN_TTL_MS: '500' },
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
  assert.deepEqual(item, { productoId: 'hummus-rabieta', nombre: 'Hummus Rabieta', precio: 4600, notas: '<img src=x onerror=alert(1)>' });

  const configured = await action({ type: 'pedido_nuevo', mesa: 2, items: [
    { productoId: 'tablita-quesos-fiambres', variante: 'Individual (sin bebida)' },
    { productoId: '2-empanadas-sintacc', opcion: 'carne' },
  ] });
  assert.equal(configured.status, 200);
  const configuredItems = (await getState()).mesas[1].pedido.items;
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
  assert.match(source, /escapeHtml\(it\.notas\)/);
  assert.match(source, /escapeHtml\(a\.mensaje\)/);
  assert.doesNotMatch(source, /\$\{it\.notas\}/);
  assert.doesNotMatch(source, /\$\{a\.mensaje\}/);
  const implementation = source.match(/function escapeHtml\(value\)\{[\s\S]*?\n\}/);
  assert.ok(implementation, 'debe existir el escape HTML usado por los renders');
  const malicious = '<img src=x onerror="globalThis.xss=true"> & \'ataque\'';
  const escaped = vm.runInNewContext(`${implementation[0]}; escapeHtml(payload)`, { payload: malicious });
  assert.equal(escaped, '&lt;img src=x onerror=&quot;globalThis.xss=true&quot;&gt; &amp; &#39;ataque&#39;');
  assert.doesNotMatch(escaped, /<img|onerror="/);
});
