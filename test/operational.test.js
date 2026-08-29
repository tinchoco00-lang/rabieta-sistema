'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createClientIpResolver, createRateLimiters } = require('../operational');

function request(remoteAddress, forwardedFor) {
  return { socket: { remoteAddress }, headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {} };
}

test('X-Forwarded-For se ignora salvo que el proxy inmediato sea confiable', () => {
  const directResolver = createClientIpResolver({ trustedProxyIps: '' });
  assert.equal(directResolver(request('::ffff:127.0.0.1', '203.0.113.10')), '127.0.0.1');

  const proxyResolver = createClientIpResolver({ trustedProxyIps: '127.0.0.1,10.0.0.2' });
  assert.equal(proxyResolver(request('::ffff:127.0.0.1', '198.51.100.5, 10.0.0.2')), '198.51.100.5');
  assert.equal(proxyResolver(request('::ffff:127.0.0.1', 'valor-invalido')), '127.0.0.1');
});

test('los límites se configuran por entorno y se reinician por ventana', () => {
  const limiters = createRateLimiters({
    RATE_LIMIT_WINDOW_MS: '1000', STAFF_LOGIN_RATE_LIMIT_MAX: '2', API_ACTION_RATE_LIMIT_MAX: '3',
  });
  assert.equal(limiters.login.check('login:ip', 100).allowed, true);
  assert.equal(limiters.login.check('login:ip', 200).allowed, true);
  assert.equal(limiters.login.check('login:ip', 300).allowed, false);
  assert.equal(limiters.login.check('login:ip', 1100).allowed, true);

  assert.equal(limiters.action.check('action:ip', 100).allowed, true);
  assert.equal(limiters.action.check('action:ip', 200).allowed, true);
  assert.equal(limiters.action.check('action:ip', 300).allowed, true);
  assert.equal(limiters.action.check('action:ip', 400).allowed, false);
});

test('un proxy explícitamente confiable separa clientes sin aceptar IPs falsificadas a la derecha', () => {
  const resolver = createClientIpResolver({ trustedProxyIps: '127.0.0.1,10.0.0.2' });
  const limiters = createRateLimiters({
    RATE_LIMIT_WINDOW_MS: '1000', STAFF_LOGIN_RATE_LIMIT_MAX: '1', API_ACTION_RATE_LIMIT_MAX: '1',
  });
  const firstClient = resolver(request('127.0.0.1', '203.0.113.1, 10.0.0.2'));
  const secondClient = resolver(request('127.0.0.1', '203.0.113.2, 10.0.0.2'));
  assert.equal(limiters.login.check(`login:${firstClient}`, 100).allowed, true);
  assert.equal(limiters.login.check(`login:${firstClient}`, 200).allowed, false);
  assert.equal(limiters.login.check(`login:${secondClient}`, 200).allowed, true);

  const spoofedLeft = resolver(request('127.0.0.1', '192.0.2.99, 203.0.113.1, 10.0.0.2'));
  assert.equal(spoofedLeft, '203.0.113.1');
});
