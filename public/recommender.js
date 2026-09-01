(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.RabietaRecommender = api;
})(typeof window !== 'undefined' ? window : null, function(){
  'use strict';

  const STOP_WORDS = new Set([
    'algo','algun','alguna','con','comer','dame','de','del','el','en','hoy','la','las','lo','los',
    'me','para','pedir','por','que','quiero','recomendame','recomenda','un','una','unos','unas','y'
  ]);
  const CATEGORY_RULES = [
    {pattern:/\b(pizza|pizzas)\b/, ids:['pizzas'], label:'pizza'},
    {pattern:/\b(ensalada|ensaladas)\b/, ids:['mezcolanzas'], label:'ensalada'},
    {pattern:/\b(postre|postres|dulce)\b/, ids:['sobremesa'], label:'postre'},
    {pattern:/\b(hamburguesa|hamburguesas|burger)\b/, ids:['entrepanes'], label:'hamburguesa'},
    {pattern:/\b(picada|picadas|tabla|tablas)\b/, ids:['tablas-y-picadas'], label:'picada'},
    {pattern:/\b(trago|tragos|cocktail|coctel)\b/, ids:['tragos'], label:'trago'},
    {pattern:/\b(vino|vinos|malbec|chardonnay|espumante)\b/, ids:['vinos'], label:'vino'},
    {pattern:/\b(agua|gaseosa|limonada|jugo|sin alcohol)\b/, ids:['bebidas-sin-alcohol'], label:'bebida sin alcohol'},
  ];

  function normalize(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9$.\s]/g,' ');
  }
  function basePrice(product){
    if(Array.isArray(product.variantes) && product.variantes.length) return product.variantes[0].precio;
    return product.precio;
  }
  function products(menu){
    const output = [];
    (menu && menu.categorias || []).forEach(category => {
      (category.productos || []).forEach(product => output.push({...product, categoriaId:category.id, categoriaNombre:category.nombre}));
    });
    return output;
  }
  function parseBudget(text){
    const match = text.match(/(?:hasta|menos de|maximo|presupuesto(?: de)?|no pasar de)\s*\$?\s*([0-9][0-9.]*)/) || text.match(/\$\s*([0-9][0-9.]*)/);
    if(!match) return null;
    const amount = Number(match[1].replace(/\./g,''));
    return Number.isFinite(amount) && amount >= 100 ? amount : null;
  }
  function analyze(query){
    const text = normalize(query);
    const unsafeRestriction = /\b(alerg[a-z]*|vegano|vegana|vegetariano|vegetariana|sin carne|sin lactosa|sin mani|sin nuez|sin nueces|sin huevo)\b/.test(text);
    const sinTacc = /\b(sin tacc|celiac|sin gluten)\b/.test(text);
    const category = CATEGORY_RULES.find(rule=>rule.pattern.test(text)) || null;
    let profile = null;
    if(/\b(compartir|picad|entre varios|para dos|para 2)\b/.test(text)) profile = 'compartir';
    else if(/\b(contundente|hambre|llenador|llenadora|fuerte)\b/.test(text)) profile = 'contundente';
    else if(/\b(liviano|liviana|ligero|ligera|fresco|fresca)\b/.test(text)) profile = 'liviano';
    else if(/\b(postre|dulce)\b/.test(text)) profile = 'dulce';
    const cheap = /\b(barato|barata|economico|economica|mas barato|precio bajo)\b/.test(text);
    const surprise = /\b(sorprendeme|sorpresa|lo mejor|favorito|favorita|destacado|destacada)\b/.test(text);
    const removed = text.replace(/[0-9$]/g,' ').split(/\s+/).filter(Boolean);
    const ignored = new Set([
      'hasta','menos','maximo','presupuesto','pasar','barato','barata','economico','economica','compartir',
      'contundente','liviano','liviana','ligero','ligera','fresco','fresca','tacc','gluten','celiaco','celiaca',
      'sorprendeme','sorpresa','mejor','favorito','favorita','destacado','destacada'
    ]);
    const tokens = [...new Set(removed.filter(token=>token.length>2 && !STOP_WORDS.has(token) && !ignored.has(token)))];
    return {text, sinTacc, unsafeRestriction, category, profile, cheap, surprise, budget:parseBudget(text), tokens};
  }
  function profileScore(product, profile){
    const text = normalize(`${product.nombre} ${product.descripcion || ''}`);
    if(profile === 'compartir') return (product.para_compartir ? 14 : 0) + (['tablas-y-picadas','caliente','pizzas'].includes(product.categoriaId) ? 6 : 0);
    if(profile === 'contundente') return (['entrepanes','cocina-resistencia','pizzas'].includes(product.categoriaId) ? 9 : 0) + (/burger|milanesa|bife|bondiola|asado/.test(text) ? 5 : 0);
    if(profile === 'liviano') return (['mezcolanzas','sin-tacc'].includes(product.categoriaId) ? 10 : 0) + (/ensalada|rucula|vegetal|hummus/.test(text) ? 4 : 0);
    if(profile === 'dulce') return product.categoriaId === 'sobremesa' ? 15 : 0;
    return 0;
  }
  function recommendationReason(product, intent, matchedTokens){
    if(intent.sinTacc) return 'Está marcado Sin TACC en la carta.';
    if(intent.budget) return `Entra en tu tope de $${intent.budget.toLocaleString('es-AR')}.`;
    if(intent.category) return `Es una opción de ${intent.category.label} con precio confirmado.`;
    if(intent.profile === 'compartir') return 'La carta lo propone para compartir.';
    if(intent.profile === 'dulce') return 'Es una opción de sobremesa con precio confirmado.';
    if(intent.profile === 'liviano') return 'Coincide con una búsqueda más liviana.';
    if(intent.profile === 'contundente') return 'Coincide con una búsqueda contundente.';
    if(matchedTokens.length) return `Coincide con “${matchedTokens.slice(0,2).join('” y “')}”.`;
    return 'Es un destacado con precio confirmado.';
  }
  function recommend(menu, query, limit = 3){
    const intent = analyze(query);
    if(!intent.text.trim()) return {items:[], intent, message:'Contame qué te gustaría comer o cuánto querés gastar.', warning:''};
    if(intent.unsafeRestriction && !intent.sinTacc){
      return {items:[], intent, message:'No puedo validar esa restricción sólo con la carta. Llamá al personal para elegir con seguridad.', warning:'Las alergias y dietas requieren confirmación del equipo de Rabieta.'};
    }
    const candidates = products(menu).filter(product=>{
      const price = basePrice(product);
      if(!Number.isFinite(price)) return false;
      if(intent.budget && price > intent.budget) return false;
      if(intent.sinTacc && !(product.filtro_dietario || []).includes('sin_tacc')) return false;
      return true;
    }).map(product=>{
      const haystack = normalize(`${product.nombre} ${product.descripcion || ''} ${product.categoriaNombre || ''}`);
      const matchedTokens = intent.tokens.filter(token=>haystack.includes(token));
      let score = matchedTokens.length * 4 + profileScore(product, intent.profile);
      if(intent.category && intent.category.ids.includes(product.categoriaId)) score += 16;
      if(intent.sinTacc) score += 20;
      if(intent.surprise && product.candidato_destacado) score += 12;
      if(intent.cheap) score += Math.max(0, 8 - Math.floor(basePrice(product) / 1000));
      if(intent.budget) score += Math.max(0, 5 - Math.floor(basePrice(product) / Math.max(1,intent.budget/5)));
      return {product, score, matchedTokens};
    });
    const hasIntent = intent.sinTacc || intent.category || intent.profile || intent.cheap || intent.surprise || intent.budget || intent.tokens.length;
    const ranked = candidates.filter(item=>hasIntent && item.score > 0).sort((a,b)=>b.score-a.score || basePrice(a.product)-basePrice(b.product) || a.product.nombre.localeCompare(b.product.nombre,'es')).slice(0,limit);
    const items = ranked.map(item=>({product:item.product, reason:recommendationReason(item.product,intent,item.matchedTokens)}));
    const message = items.length
      ? `Encontré ${items.length} ${items.length === 1 ? 'opción' : 'opciones'} de la carta con precio confirmado.`
      : 'No encontré una coincidencia segura con precio confirmado. Probá pedir pizza, algo liviano, para compartir o indicar un presupuesto.';
    const warning = intent.sinTacc ? 'Según la carta marcada Sin TACC. Confirmá con el personal por contaminación cruzada.' : '';
    return {items, intent, message, warning};
  }

  return {analyze, basePrice, normalize, recommend};
});
