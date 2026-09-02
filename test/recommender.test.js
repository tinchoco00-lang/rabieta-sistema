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

test('nombrar un plato puntual responde directo con sus datos reales, sin inventar nada fuera de la carta', () => {
  const burger = recommend(menu, 'cuanto sale la burger rabieta');
  assert.equal(burger.items.length, 1);
  assert.equal(burger.items[0].product.id, 'burger-rabieta');
  const producto = menu.categorias.flatMap(c => c.productos).find(p => p.id === 'burger-rabieta');
  assert.match(burger.message, new RegExp(`\\$${producto.precio.toLocaleString('es-AR')}`));
  assert.match(burger.message, new RegExp(producto.descripcion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // La categoría genérica ("burger" -> hamburguesas) no debe ganarle a un
  // nombre de plato puntual y sin ambigüedad.
  assert.notEqual(burger.message, 'Encontré 1 opción de la carta con precio confirmado.');
});

test('un plato puntual mencionado junto con un presupuesto sigue el camino normal de varias opciones, no el atajo directo', () => {
  const conPresupuesto = recommend(menu, 'burger rabieta por menos de $2000');
  // Burger Rabieta sale $3.400 (supera el presupuesto): con presupuesto activo
  // seguimos el flujo normal de candidatos dentro de precio, no la respuesta
  // directa sobre un plato que en este caso ni siquiera entraría.
  assert.doesNotMatch(conPresupuesto.message, /Blend de carnes/);
  assert.match(conPresupuesto.message, /^Encontré/);
});

test('un nombre de plato ambiguo (coincide con más de un producto) no dispara la respuesta directa', () => {
  const ambiguo = recommend(menu, 'bastones de mozzarella o la pizza mozzarella, cual me recomendás');
  assert.ok(ambiguo.items.length > 1, 'con una coincidencia ambigua debe seguir el flujo normal de varias opciones');
});

test('"barato" sin categoría explícita sugiere comida, no agua o gaseosa solo por ser lo más barato del local', () => {
  const result = recommend(menu, 'estoy con poca plata, tenes algo barato');
  const FOOD = new Set(['tablas-y-picadas','caliente','sin-tacc','entrepanes','mezcolanzas','cocina-resistencia','pizzas','promo-maridaje','sobremesa']);
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every(({product})=>FOOD.has(product.categoriaId)), 'todos los resultados deben ser comida, no bebidas/merchandising');

  // Si la consulta sí pide una bebida barata, el sesgo hacia comida no debe
  // tapar lo que realmente se preguntó.
  const bebida = recommend(menu, 'una gaseosa barata');
  assert.ok(bebida.items.length > 0);
  assert.ok(bebida.items.every(({product})=>product.categoriaId === 'bebidas-sin-alcohol'));
});
