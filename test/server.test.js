'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { after, before, test } = require('node:test');

const root = path.resolve(__dirname, '..');
const testPin = '7391';
let baseUrl;
let serverProcess;
let serverOutput = '';

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitUntilReady(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`El servidor termino antes de iniciar.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${url}/api/menu`);
      if (response.ok) return;
    } catch (_) {
      // El proceso todavia puede estar iniciando.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`El servidor no inicio dentro de ${timeoutMs} ms.\n${serverOutput}`);
}

function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return Promise.resolve();

  return new Promise(resolve => {
    const forceStop = setTimeout(() => {
      if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
    }, 2000);
    forceStop.unref();
    serverProcess.once('exit', () => {
      clearTimeout(forceStop);
      resolve();
    });
    serverProcess.kill('SIGTERM');
  });
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), STAFF_PIN: testPin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk; });
  await waitUntilReady(baseUrl);
});

after(async () => {
  await stopServer();
});

test('GET /api/menu devuelve el menu JSON', async () => {
  const response = await fetch(`${baseUrl}/api/menu`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/json/);
  const menu = await response.json();
  assert.ok(menu && typeof menu === 'object');
  assert.ok(menu._meta, 'el menu debe conservar sus metadatos');
});

test('GET /mesa.html?mesa=1 sirve la interfaz de mesa', async () => {
  const response = await fetch(`${baseUrl}/mesa.html?mesa=1`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/html/);
  assert.match(await response.text(), /<!doctype html>/i);
});

test('POST /api/staff-login acepta el PIN correcto', async () => {
  const response = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: testPin }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('POST /api/staff-login rechaza un PIN incorrecto', async () => {
  const response = await fetch(`${baseUrl}/api/staff-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: 'incorrecto' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: false });
});
