'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const menu = require('../menu-rabieta.json');
const { recommend } = require('../public/recommender');

test('la consulta libre combina ocasión y presupuesto sin ofrecer precios pendientes', () => {
  const result = recommend(menu, 'Quiero algo para compartir por menos de $4.000');
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every(({product})=>Number.isFinite(product.precio) || Number.isFinite(product.variantes?.[0]?.precio)));
  assert.ok(result.items.every(({product})=>(product.precio ?? product.variantes[0].precio) <= 4000));
  assert.ok(result.items.some(({product})=>product.para_compartir));
});

test('Sin TACC usa exclusivamente el atributo confirmado y conserva la advertencia', () => {
  const result = recommend(menu, 'Soy celíaca, quiero algo Sin TACC hasta $3.000');
  assert.equal(result.items.length, 1);
  assert.ok(result.items.every(({product})=>product.filtro_dietario.includes('sin_tacc')));
  assert.ok(result.items.every(({product})=>product.precio <= 3000));
  assert.match(result.warning, /contaminación cruzada/);
});

test('las búsquedas por tipo e ingrediente devuelven coincidencias explicables', () => {
  const pizzas = recommend(menu, 'una pizza barata');
  assert.equal(pizzas.items.length, 3);
  assert.ok(pizzas.items.every(({product})=>product.categoriaId === 'pizzas'));
  const chocolate = recommend(menu, 'quiero un postre con chocolate');
  assert.ok(chocolate.items.some(({product})=>/brownie|chocotorta/i.test(product.nombre)));
  assert.ok(chocolate.items.every(item=>item.reason.length > 10));
});

test('no inventa seguridad alimentaria para restricciones no estructuradas', () => {
  const result = recommend(menu, 'Necesito algo vegano porque tengo alergia a los lácteos');
  assert.equal(result.items.length, 0);
  assert.match(result.message, /No puedo validar/);
  assert.match(result.warning, /requieren confirmación/);
});
