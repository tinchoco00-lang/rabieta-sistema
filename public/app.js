/* =========================================================
   RABIETA — cliente real, conectado por WebSocket al servidor
   (server.js). Esta es la MISMA lógica de vistas del prototipo
   original, pero ahora el "estado" no vive en la memoria del
   navegador: lo manda el servidor, y todas las acciones del
   usuario (pedir, llamar al mozo, marcar listo, etc.) se
   mandan al servidor en vez de mutar datos locales. Por eso
   dos celulares distintos ven lo mismo en vivo.
   ========================================================= */

/* ================= ÍCONOS (línea fina, sin emojis) =================
   Rabieta es un bar con onda, no una vidriera de juguetería: nada de
   emojis de colores. Un solo set de íconos de línea, en el color de
   texto de cada lugar (currentColor), tamaño 1em. */
const ICONS = {
  ring:      '<circle cx="12" cy="12" r="7"/>',
  bell:      '<path d="M12 4a5 5 0 0 0-5 5v3.2L5 16h14l-2-3.8V9a5 5 0 0 0-5-5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  receipt:   '<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5Z"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="12" x2="15.5" y2="12"/>',
  help:      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20"/><line x1="4" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20" y2="12"/>',
  flame:     '<path d="M12 3c1 2.5-3 4-3 8a3 3 0 0 0 6 0c0-1-.5-1.8-1-2 .8 2.6-1 4.3-2 4.3-2.2 0-4.3-1.8-4.3-4.8C7.7 5.3 10.2 4 12 3Z"/>',
  user:      '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  briefcase: '<rect x="4" y="8" width="16" height="11" rx="1.5"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="4" y1="13" x2="20" y2="13"/>',
  chart:     '<line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="7"/><line x1="19" y1="20" x2="19" y2="15"/>',
  wheat:     '<path d="M12 4v16"/><path d="M12 7c2 0 3 .9 3 1.9s-1 1.9-3 1.9"/><path d="M12 7c-2 0-3 .9-3 1.9s1 1.9 3 1.9"/><path d="M12 10.8c2 0 3 .9 3 1.9s-1 1.9-3 1.9"/><path d="M12 10.8c-2 0-3 .9-3 1.9s1 1.9 3 1.9"/>',
  cube:      '<path d="M12 3.2 19.5 7.5v9L12 20.8 4.5 16.5v-9Z"/><path d="M4.7 7.6 12 12l7.3-4.4"/><line x1="12" y1="12" x2="12" y2="20.8"/>',
  plate:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.3"/>',
  lock:      '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sound:     '<path d="M4 9.2v5.6h3.6l4.9 3.7V5.5l-4.9 3.7Z"/><path d="M15.8 9.3a4 4 0 0 1 0 5.4"/><path d="M18.3 7a7.5 7.5 0 0 1 0 10"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="1.5"/><rect x="9" y="2.3" width="6" height="3" rx="1"/><line x1="8" y1="10.2" x2="16" y2="10.2"/><line x1="8" y1="14.2" x2="16" y2="14.2"/>',
  refresh:   '<path d="M4 12a8 8 0 0 1 14-5"/><polyline points="18 3 18 8 13 8"/><path d="M20 12a8 8 0 0 1-14 5"/><polyline points="6 21 6 16 11 16"/>',
  warning:   '<path d="M12 4 21 19H3Z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none"/>',
  checkring: '<circle cx="12" cy="12" r="8"/><polyline points="8.3 12.2 10.8 14.7 15.8 9.2"/>',
};
function ic(name, cls){ return `<svg class="i-ic${cls?' '+cls:''}" viewBox="0 0 24 24">${ICONS[name]||''}</svg>`; }

const PEDIDO_ESTADOS = ['enviado','preparando','listo','entregado'];
const PEDIDO_LABELS = {enviado:'Recibido', preparando:'En preparación', listo:'Listo', entregado:'Entregado'};
const MOZOS = ['Martín','Sofía','Lucas'];
const HELP_CATEGORIAS = [
  {id:'no_llego',  label:'No llegó mi pedido',        prioridad:'urgente'},
  {id:'incorrecto',label:'Mi pedido está incorrecto',  prioridad:'urgente'},
  {id:'falta',     label:'Falta algo',                 prioridad:'importante'},
  {id:'mozo',      label:'Necesito al mozo',            prioridad:'normal'},
  {id:'cambiar',   label:'Quiero cambiar algo',         prioridad:'importante'},
  {id:'cuenta',    label:'Quiero pedir la cuenta',      prioridad:'importante'},
];
const KEYWORDS_URGENTE = ['no llegó','no llego','frío','fria','crudo','cruda','alerg','mal estado','equivocado','equivocada'];
const KEYWORDS_IMPORTANTE = ['falta','cambiar','sin ','error','cuenta'];
function clasificarTextoLibre(t){
  t = t.toLowerCase();
  if (KEYWORDS_URGENTE.some(k=>t.includes(k))) return 'urgente';
  if (KEYWORDS_IMPORTANTE.some(k=>t.includes(k))) return 'importante';
  return 'normal';
}

// UN solo modelo 3D real verificado (glTF de Khronos, dominio público) que
// usamos como GENÉRICO en TODOS los platos, mientras no exista el escaneo
// real de cada plato de Rabieta. Esto SÍ es 3D real: se gira, se acerca, y
// con el botón de cámara abre AR de verdad en Android. Lo que no es real
// todavía es que sea la foto exacta del plato — por eso siempre el mismo
// modelo genérico (la palta), para que no parezca un error random.
const MODELOS_3D_GENERICOS = [
  { url:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb', nombre:'palta (modelo genérico)' },
];

let MENU_DATA = null;
let CANDIDATOS_3D = new Set();
let MESAS_TOTAL = 0;
let liveReady = false; // true mientras el stream en vivo (SSE) está conectado
let knownAlertIds = null; // null = todavía no llegó el primer snapshot

let state = {
  clockMs:0, mesas:[],
  // ui local, no viene del servidor:
  role:null, clienteMesa:null, clienteCat:null, clienteFiltroSinTacc:false,
  clienteCart:[], clienteExpand:null, clienteHelpOpen:false,
  mozoActivo:MOZOS[0], modal:null,
};

function money(n){ return n===null || n===undefined ? 'A confirmar' : '$'+n.toLocaleString('es-AR'); }
function timeAgoSec(ts){ return Math.max(0, Math.floor((state.clockMs - ts)/1000)); }
function fmtSec(s){ const m=Math.floor(s/60), r=s%60; return (m>0? m+'m ':'')+r+'s'; }
function findMesa(n){ return state.mesas.find(m=>m.numero===n); }
function findProducto(id){ for(const c of MENU_DATA.categorias) for(const p of c.productos) if(p.id===id) return p; }
function todosLosProductos(){ const out=[]; MENU_DATA.categorias.forEach(c=>c.productos.forEach(p=>out.push({...p,categoriaId:c.id}))); return out; }
function precioBase(p){ if(p.variantes && p.variantes.length) return p.variantes[0].precio; return p.precio; }
function mesaBusy(m){ return !!m.pedido; }
function estadoPedidoLabel(m){ return m.pedido ? PEDIDO_LABELS[m.pedido.estado] : 'Libre'; }
function alertasAbiertas(m){ return m.alertas.filter(a=>a.estado!=='resuelto'); }
function prioridadMax(alertas){
  if(alertas.some(a=>a.prioridad==='urgente')) return 'urgente';
  if(alertas.some(a=>a.prioridad==='importante')) return 'importante';
  if(alertas.length) return 'normal';
  return null;
}
function todasAlertasAbiertas(){
  let out=[];
  state.mesas.forEach(m=> alertasAbiertas(m).forEach(a=> out.push({mesa:m, alerta:a})));
  const orden={urgente:0,importante:1,normal:2};
  out.sort((a,b)=> (orden[a.alerta.prioridad]-orden[b.alerta.prioridad]) || (a.alerta.creadoTs-b.alerta.creadoTs));
  return out;
}

/* ================= CONEXIÓN EN VIVO (Server-Sent Events) =================
   No usamos WebSocket para evitar depender de paquetes externos en el
   servidor — SSE funciona con http puro y el navegador reconecta solo. */
function conectar(onFirstSnapshot){
  const es = new EventSource('/events');
  es.onerror = ()=>{ liveReady=false; setConnPill(false); }; // EventSource reintenta la conexión solo
  es.onmessage = (ev)=>{
    let msg; try{ msg = JSON.parse(ev.data); }catch(e){ return; }
    if(msg.type==='estado'){
      if(!liveReady){ liveReady=true; setConnPill(true); }
      MESAS_TOTAL = msg.mesasTotal || MESAS_TOTAL;
      state.clockMs = msg.state.clockMs;
      state.mesas = msg.state.mesas;
      detectarNuevasAlertas();
      if(onFirstSnapshot){ onFirstSnapshot(); onFirstSnapshot=null; }
      render();
    }
  };
}
function send(obj){
  fetch('/api/action', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj)}).catch(()=>{});
}
function setConnPill(on){
  let el = document.getElementById('connPill');
  if(!el){ el=document.createElement('div'); el.id='connPill'; el.className='conn-pill'; document.body.appendChild(el); }
  el.className = 'conn-pill ' + (on?'on':'off');
  el.textContent = on ? '● en vivo' : '● sin conexión…';
}

function detectarNuevasAlertas(){
  const idsAhora = new Set();
  state.mesas.forEach(m=> m.alertas.forEach(a=> idsAhora.add(a.id)));
  if(knownAlertIds===null){ knownAlertIds = idsAhora; return; } // primer snapshot: no suena
  let hayNueva = false;
  idsAhora.forEach(id=>{ if(!knownAlertIds.has(id)) hayNueva = true; });
  knownAlertIds = idsAhora;
  if(hayNueva && state.role && state.role!=='cliente') alertaFisica();
}

/* ================= AVISO FÍSICO (sonido + vibración + flash) ================= */
let audioCtx = null;
function unlockAudio(){
  try{
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    g.gain.value=0.0001; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.01);
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate(80);
}
function beep(times){
  if(!audioCtx) return;
  let t = audioCtx.currentTime;
  for(let i=0;i<times;i++){
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.55,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.28);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t+0.3);
    t += 0.38;
  }
}
function alertaFisica(){
  beep(3);
  if(navigator.vibrate) navigator.vibrate([250,120,250,120,250]);
  document.body.classList.add('alerta-flash');
  setTimeout(()=>document.body.classList.remove('alerta-flash'), 4200);
  const original = document.title;
  let n=0;
  const iv = setInterval(()=>{
    document.title = (document.title===original) ? '🔔 ¡Atención en una mesa!' : original;
    n++; if(n>8){ clearInterval(iv); document.title=original; }
  }, 500);
}

/* ================= RENDER ================= */
function render(){
  const clockEl = document.getElementById('clockDemo');
  if(clockEl) clockEl.textContent = String(Math.floor(state.clockMs/60)).padStart(2,'0')+':'+String(state.clockMs%60).padStart(2,'0');
  const app = document.getElementById('app');
  if(!app) return;
  if(state.role==='cliente') app.innerHTML = viewCliente();
  else if(state.role==='cocina') app.innerHTML = viewCocina();
  else if(state.role==='mozo') app.innerHTML = viewMozo();
  else if(state.role==='encargado') app.innerHTML = viewEncargado();
  else if(state.role==='dueno') app.innerHTML = viewDueno();
  renderStaffNav();
  renderModal();
}

function renderStaffNav(){
  const nav = document.getElementById('staffNav');
  if(!nav) return;
  const roles = [
    {id:'mozo',label:'Mozo',icon:'user'},
    {id:'cocina',label:'Cocina (KDS)',icon:'flame'},
    {id:'encargado',label:'Encargado',icon:'briefcase'},
    {id:'dueno',label:'Dueño',icon:'chart'},
  ];
  const n = todasAlertasAbiertas().length;
  nav.innerHTML = roles.map(r=>`<button class="${state.role===r.id?'active':''}" onclick="setRole('${r.id}')">
    <span>${ic(r.icon)}</span><span>${r.label}</span><span class="dot ${n>0?'show':''}"></span></button>`).join('');
}
function setRole(id){ state.role=id; render(); }

/* ================= MODAL 3D — REAL, no mock ================= */
function modeloParaPlato(id){
  const lista = [...CANDIDATOS_3D];
  const idx = lista.indexOf(id);
  return MODELOS_3D_GENERICOS[(idx<0?0:idx) % MODELOS_3D_GENERICOS.length];
}
function renderModal(){
  const root = document.getElementById('modalRoot');
  if(!root) return;
  if(!state.modal){ root.innerHTML=''; return; }
  if(state.modal.type==='3d'){
    const modelo = modeloParaPlato(state.modal.id);
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal modal-3d" onclick="event.stopPropagation()">
        <div class="stage3d-real">
          <model-viewer id="mv3d" src="${modelo.url}" camera-controls auto-rotate auto-rotate-delay="300"
            ar ar-modes="scene-viewer webxr quick-look" shadow-intensity="1" exposure="1"
            style="width:100%;height:100%;background:transparent;"></model-viewer>
        </div>
        <div class="body3d">
          <span class="badge-preview">3D real · modelo genérico, todavía no es el escaneo del plato</span>
          <h3>${state.modal.nombre}</h3>
          <p>Activá la cámara, enfocá tu mesa, y el plato aparece ahí arriba en tamaño real — como si ya te lo hubieran servido. También podés arrastrar acá abajo para girarlo sin cámara.</p>
          <button class="btn callout block" onclick="activarAR()">${ic('cube')} Ver en mi mesa con la cámara</button>
          <p class="ar-fineprint">Funciona con cámara en Android (Chrome). En iPhone y en la compu se ve girando en pantalla por ahora. Lo único pendiente de verdad es reemplazar este modelo genérico — ${modelo.nombre} — por el escaneo 3D real de <b>${state.modal.nombre}</b> — eso es un paso de producción aparte.</p>
          <button class="btn dark block" onclick="closeModal()">Cerrar</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='confirm-mozo'){
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('bell')}</div>
        <h3>¿Llamar al mozo?</h3>
        <p>Se le va a avisar al mozo que la <b>Mesa ${state.clienteMesa}</b> necesita atención. Confirmá solo si de verdad lo necesitás, así no camina de mesa en mesa por un toque sin querer.</p>
        <div style="display:flex;gap:10px;">
          <button class="btn ghost" style="flex:1;" onclick="closeModal()">Cancelar</button>
          <button class="btn callout" style="flex:1;" onclick="confirmarLlamarMozo()">Sí, llamar</button>
        </div>
      </div></div>`;
  } else if(state.modal.type==='mozo-enviado'){
    root.innerHTML = `<div class="modal-bg" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="icon">${ic('checkring')}</div>
        <h3>Aviso enviado</h3>
        <p>Tu llamado fue recibido. Un mozo se va a acercar a la <b>Mesa ${state.clienteMesa}</b> en breve.</p>
        <button class="btn primary block" onclick="closeModal()">Entendido</button>
      </div></div>`;
  }
}
function openModal3d(id, nombre){ state.modal = {type:'3d', id, nombre}; render(); }
function closeModal(e){ state.modal=null; render(); }
function activarAR(){
  const mv = document.getElementById('mv3d');
  if(mv && mv.activateAR) mv.activateAR();
}

/* ---------------- CLIENTE ---------------- */
function platosDestacadosData(){ return [...CANDIDATOS_3D].map(id=>findProducto(id)).filter(Boolean); }
function banner3dHtml(){
  const platos = platosDestacadosData();
  if(!platos.length) return '';
  return `<div class="banner3d">
    <div class="head"><div class="ico">${ic('cube')}</div>
      <div class="txt"><strong>Mirá tu plato en 3D antes de pedir</strong><span>Tocá cualquiera de estos ${platos.length} platos — un solo toque</span></div></div>
    <div class="tiles3d">
      ${platos.map(p=>`<button onclick="openModal3d('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">
        <span class="em">${ic('plate')}</span><span class="nm">${p.nombre}</span><span class="cta">Ver en 3D</span></button>`).join('')}
    </div></div>`;
}

function viewCliente(){
  const mesa = findMesa(state.clienteMesa);
  if(!mesa) return `<div class="empty">Este link no tiene una mesa válida asignada.</div>`;
  let productos = MENU_DATA.categorias.find(c=>c.id===state.clienteCat).productos;
  if(state.clienteFiltroSinTacc) productos = productos.filter(p=>p.filtro_dietario && p.filtro_dietario.includes('sin_tacc'));

  let pedidoStatusHtml = '';
  if(mesa.pedido){
    const idx = PEDIDO_ESTADOS.indexOf(mesa.pedido.estado);
    pedidoStatusHtml = `<div class="card">
      <div style="font-weight:800;font-size:13.5px;margin-bottom:4px;">Tu pedido</div>
      <div class="status-stepper">${PEDIDO_ESTADOS.map((s,i)=>`
        <div class="step ${i<idx?'done':i===idx?'current':''}"><div class="bar"></div>
          <div class="circle">${i<idx?'✓':i+1}</div><div class="lbl">${PEDIDO_LABELS[s]}</div></div>`).join('')}
      </div>
      <ul style="font-size:13px;margin:0;padding-left:18px;color:var(--ink-2);">
        ${mesa.pedido.items.map(it=>`<li>${it.nombre}${it.notas?` — "${it.notas}"`:''}</li>`).join('')}
      </ul></div>`;
  }
  const openAlerts = alertasAbiertas(mesa);
  const alertHtml = openAlerts.length ? `<div class="card" style="border-color:var(--warning);">
    <div style="font-weight:800;font-size:13px;margin-bottom:6px;">Tus solicitudes activas</div>
    ${openAlerts.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;">
      <span>${a.label}${a.mensaje?': "'+a.mensaje+'"':''}</span>
      <span class="pill ${a.estado==='atencion'?'importante':a.prioridad}">${a.estado==='atencion'?'En atención':'Enviado'}</span></div>`).join('')}
    </div>` : '';

  const cartTotal = state.clienteCart.reduce((s,it)=> s + (it.precio||0), 0);
  const cartPendientes = state.clienteCart.filter(it=>it.precio===null).length;

  return `
    <h1 class="view-title">CARTA</h1>
    <p class="view-sub">Carta real de Rabieta Lomitas. Los precios marcados "a confirmar" todavía no están validados con el local.</p>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
      <span class="badge-mesa">MESA ${mesa.numero}</span>
    </div>
    ${banner3dHtml()}
    ${pedidoStatusHtml}${alertHtml}

    <div class="filter-chips">
      <button class="${state.clienteFiltroSinTacc?'active':''}" onclick="toggleFiltroSinTacc()">${ic('wheat')} Sin TACC</button>
    </div>
    <div class="cat-tabs">
      ${MENU_DATA.categorias.map(c=>`<button class="${c.id===state.clienteCat?'active':''}" onclick="setCat('${c.id}')">${c.nombre}</button>`).join('')}
    </div>
    <div class="dish-list">
      ${productos.length ? productos.map(p=>dishCardHtml(p)).join('') : '<div class="empty">Ningún producto de esta categoría es apto Sin TACC.</div>'}
    </div>
    <div class="action-row">
      <button class="btn callout" onclick="llamarMozo()">${ic('bell')} Llamar al mozo</button>
      <button class="btn dark" onclick="pedirCuenta()">${ic('receipt')} Pedir la cuenta</button>
      <button class="btn critical" onclick="toggleHelp()">${ic('help')} Necesito ayuda</button>
    </div>
    ${state.clienteHelpOpen ? helpPanelHtml() : ''}
    ${state.clienteCart.length ? `<div class="cart-bar">
      <div><div class="cart-total">${money(cartTotal)}${cartPendientes?' + '+cartPendientes+' a confirmar':''}</div>
      <div class="cart-info">${state.clienteCart.length} ítem(s) en el carrito</div></div>
      <button class="btn primary" onclick="enviarPedido()">Enviar pedido a cocina →</button></div>` : ''}
  `;
}

function dishCardHtml(p){
  const expanded = state.clienteExpand===p.id;
  const esCombo = p.tipo==='combo';
  const precio = precioBase(p);
  const esDestacado = CANDIDATOS_3D.has(p.id);
  const cuerpo = `
    <div class="row1"><strong>${p.nombre}</strong>
      ${precio===null && !p.variantes ? '<span class="price pending">A confirmar</span>' : `<span class="price">${p.variantes?'desde '+money(precio):money(precio)}</span>`}
    </div>
    ${p.descripcion ? `<div class="desc">${p.descripcion}</div>` : ''}
    <div class="tags">
      ${esDestacado?'<span class="tag destacado">★ Plato destacado</span>':''}
      ${p.filtro_dietario&&p.filtro_dietario.includes('sin_tacc')?`<span class="tag celiaco">${ic('wheat')} Sin TACC</span>`:''}
      ${esCombo?'<span class="tag">Combo plato + bebida</span>':''}
      ${p.para_compartir?'<span class="tag">Para compartir</span>':''}
    </div>
    ${esDestacado?`<button class="btn-3d" onclick="openModal3d('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">${ic('cube')} Ver en 3D</button>`:''}
    ${expanded ? dishDetailHtml(p) : `<div style="margin-top:8px;"><button class="btn dark sm" onclick="toggleDish('${p.id}')">Agregar al pedido</button></div>`}
  `;
  if(p.imagen){
    return `<div class="dish"><div class="dish-row">
      <img class="dish-thumb" src="${p.imagen}" alt="${p.nombre}">
      <div class="dish-body">${cuerpo}</div>
    </div></div>`;
  }
  return `<div class="dish">${cuerpo}</div>`;
}
function dishDetailHtml(p){
  let variantePicker = '';
  if(p.variantes){
    variantePicker = `<div class="opt-label">Elegí versión</div>` + p.variantes.map((v,i)=>`
      <div class="opt-row"><label><input type="radio" name="var_${p.id}" value="${i}" ${i===0?'checked':''}> ${v.nombre} — ${money(v.precio)}</label></div>`).join('');
  }
  let opcionPicker = '';
  if(p.opciones){
    opcionPicker = `<div class="opt-label">Elegí una opción</div>` + p.opciones.map((o,i)=>`
      <div class="opt-row"><label><input type="radio" name="op_${p.id}" value="${o}" ${i===0?'checked':''}> ${o}</label></div>`).join('');
  }
  return `<div class="dish-detail">
    ${variantePicker}${opcionPicker}
    <input type="text" class="nota" id="nota_${p.id}" placeholder="Observación para cocina (ej: sin cebolla)…">
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button class="btn primary sm" onclick="agregarAlCarrito('${p.id}')">Agregar</button>
      <button class="btn ghost sm" onclick="toggleDish(null)">Cerrar</button>
    </div></div>`;
}

function setCat(c){ state.clienteCat=c; state.clienteExpand=null; render(); }
function toggleFiltroSinTacc(){ state.clienteFiltroSinTacc=!state.clienteFiltroSinTacc; render(); }
function toggleDish(id){ state.clienteExpand = state.clienteExpand===id?null:id; render(); }
function toggleHelp(){ state.clienteHelpOpen=!state.clienteHelpOpen; render(); }

function agregarAlCarrito(id){
  const p = findProducto(id);
  let nombre = p.nombre, precio = precioBase(p);
  if(p.variantes){
    const idx = parseInt((document.querySelector(`input[name="var_${id}"]:checked`)||{}).value || 0, 10);
    nombre += ' — ' + p.variantes[idx].nombre; precio = p.variantes[idx].precio;
  }
  if(p.opciones){
    const op = (document.querySelector(`input[name="op_${id}"]:checked`)||{}).value;
    if(op) nombre += ' (' + op + ')';
  }
  const nota = (document.getElementById('nota_'+id)||{}).value || '';
  state.clienteCart.push({nombre, precio, notas:nota});
  state.clienteExpand = null;
  render();
}
function enviarPedido(){
  if(!state.clienteCart.length) return;
  send({type:'pedido_nuevo', mesa:state.clienteMesa, items:state.clienteCart});
  state.clienteCart = [];
  render();
}
function llamarMozo(){ state.modal = {type:'confirm-mozo'}; render(); }
function confirmarLlamarMozo(){
  send({type:'llamar_mozo', mesa:state.clienteMesa});
  state.modal = {type:'mozo-enviado'};
  render();
  setTimeout(()=>{ if(state.modal && state.modal.type==='mozo-enviado'){ state.modal=null; render(); } }, 4500);
}
function pedirCuenta(){ send({type:'pedir_cuenta', mesa:state.clienteMesa}); }
function enviarAyuda(id,label,prioridad){ send({type:'ayuda', mesa:state.clienteMesa, categoria:id, label, prioridad}); state.clienteHelpOpen=false; render(); }
function enviarAyudaLibre(){
  const val = (document.getElementById('freeHelp')||{}).value || '';
  if(!val.trim()) return;
  send({type:'ayuda', mesa:state.clienteMesa, categoria:'otro', label:'Reclamo', prioridad:clasificarTextoLibre(val), mensaje:val.trim()});
  state.clienteHelpOpen=false; render();
}
function helpPanelHtml(){
  return `<div class="card" style="margin-top:14px;">
    <div style="font-weight:800;font-size:13.5px;margin-bottom:10px;">¿En qué te podemos ayudar?</div>
    <div class="help-cats">${HELP_CATEGORIAS.map(h=>`<button onclick="enviarAyuda('${h.id}','${h.label}','${h.prioridad}')">${h.label}</button>`).join('')}</div>
    <div style="font-size:12px;color:var(--ink-muted);margin-bottom:6px;">O contanos con tus palabras:</div>
    <input type="text" class="nota" id="freeHelp" placeholder='Ej: "Pedí sin cebolla y vino con cebolla"'>
    <div style="margin-top:8px;display:flex;gap:8px;">
      <button class="btn critical sm" onclick="enviarAyudaLibre()">Enviar</button>
      <button class="btn ghost sm" onclick="toggleHelp()">Cancelar</button>
    </div></div>`;
}

/* ---------------- COCINA ---------------- */
function viewCocina(){
  const activos = state.mesas.filter(m=>m.pedido && m.pedido.estado!=='entregado');
  return `<h1 class="view-title">COCINA</h1><p class="view-sub">KDS — comandas en vivo, sin papel.</p>
    <div class="kds-grid">${activos.length ? activos.map(m=>ticketHtml(m)).join('') : '<div class="empty">No hay comandas activas.</div>'}</div>`;
}
function ticketHtml(m){
  const edad = timeAgoSec(m.pedido.enviadoTs);
  const late = m.pedido.estado==='preparando' && edad>240;
  return `<div class="ticket ${late?'late':''}">
    <div class="head"><span class="mesa">MESA ${m.numero}</span>
      <span class="pill ${m.pedido.estado==='enviado'?'importante':m.pedido.estado==='preparando'?'normal':'libre'}">${PEDIDO_LABELS[m.pedido.estado]}</span></div>
    <div class="timer">hace ${fmtSec(edad)}</div>
    <ul>${m.pedido.items.map(it=>`<li>${it.nombre}${it.notas?` <span class="item-mod">— "${it.notas}"</span>`:''}</li>`).join('')}</ul>
    <div style="display:flex;gap:6px;">
      ${m.pedido.estado==='enviado'?`<button class="btn primary sm block" onclick="avanzarPedido(${m.numero})">Empezar a preparar</button>`:''}
      ${m.pedido.estado==='preparando'?`<button class="btn good sm block" onclick="avanzarPedido(${m.numero})">Marcar listo</button>`:''}
      ${m.pedido.estado==='listo'?`<button class="btn dark sm block" onclick="avanzarPedido(${m.numero})">Entregado en mesa</button>`:''}
    </div></div>`;
}
function avanzarPedido(n){
  const m=findMesa(n); const i=PEDIDO_ESTADOS.indexOf(m.pedido.estado);
  if(i<PEDIDO_ESTADOS.length-1) send({type:'pedido_estado', mesa:n, estado:PEDIDO_ESTADOS[i+1]});
}

/* ---------------- MOZO ---------------- */
function viewMozo(){
  const misMesas = state.mesas.filter(m=>m.mozo===state.mozoActivo && (m.ocupada || alertasAbiertas(m).length));
  const misAlertas = todasAlertasAbiertas().filter(x=>x.mesa.mozo===state.mozoActivo);
  return `<h1 class="view-title">MOZO</h1>
    <p class="view-sub">Sos: <select onchange="cambiarMozo(this.value)">${MOZOS.map(m=>`<option ${m===state.mozoActivo?'selected':''}>${m}</option>`).join('')}</select></p>
    <div class="section-h">${ic('bell')} Tus alertas (${misAlertas.length})</div>
    ${misAlertas.length ? misAlertas.map(({mesa,alerta})=>alertRowHtml(mesa,alerta,true)).join('') : '<div class="empty">Sin alertas pendientes.</div>'}
    <div class="section-h">Tus mesas</div>
    <div class="mesa-grid">${misMesas.length ? misMesas.map(m=>mesaTileHtml(m)).join('') : '<div class="empty">Sin mesas activas.</div>'}</div>`;
}
function cambiarMozo(v){ state.mozoActivo=v; render(); }
function mesaTileHtml(m){
  const prio = prioridadMax(alertasAbiertas(m));
  return `<div class="mesa-tile ${prio?'alerta-'+prio:''}"><div class="num">Mesa ${m.numero}</div>
    <div class="estado">${m.pedido?estadoPedidoLabel(m):'Sentados'}${m.cuentaPedida?' · cuenta':''}</div>
    ${alertasAbiertas(m).length?`<span class="pill ${prio}">${alertasAbiertas(m).length} alerta(s)</span>`:`<span class="pill ocupada">OK</span>`}</div>`;
}
function alertRowHtml(mesa,a,acciones){
  const edad = timeAgoSec(a.creadoTs);
  return `<div class="alert-row ${a.escalado?'escalado':''}">
    <div><div class="msg">Mesa ${mesa.numero} — ${a.label}${a.mensaje?`: "${a.mensaje}"`:''}</div>
    <div class="meta"><span class="pill ${a.prioridad}">${a.prioridad.toUpperCase()}</span> hace ${fmtSec(edad)} ${a.escalado?` · ${ic('warning')} ESCALADO`:''} ${a.estado==='atencion'?' · en atención':''}</div></div>
    ${acciones?`<div class="actions">${a.estado==='recibido'?`<button class="btn dark sm" onclick="marcarAtencion(${a.id})">En atención</button>`:''}
      <button class="btn good sm" onclick="resolverAlerta(${a.id})">Resolver</button></div>`:''}</div>`;
}
function marcarAtencion(ai){ send({type:'alerta_atender', alertaId:ai}); }
function resolverAlerta(ai){ send({type:'alerta_resolver', alertaId:ai}); }

/* ---------------- ENCARGADO ---------------- */
function viewEncargado(){
  const todas = todasAlertasAbiertas();
  const escaladas = todas.filter(x=>x.alerta.escalado);
  return `<h1 class="view-title">ENCARGADO</h1><p class="view-sub">Centro de control del salón — ${MESAS_TOTAL} mesas (placeholder, confirmar número real con el local).</p>
    ${escaladas.length ? `<div class="card" style="border-color:var(--critical);margin-bottom:16px;">
      <div style="font-weight:800;color:#ff9797;font-size:13px;margin-bottom:8px;">${ic('warning')} ${escaladas.length} alerta(s) escalada(s)</div>
      ${escaladas.map(({mesa,alerta})=>alertRowHtml(mesa,alerta,true)).join('')}</div>` : ''}
    <div class="section-h">Plano de salón</div>
    <div class="mesa-grid">${state.mesas.map(m=>{
      const prio=prioridadMax(alertasAbiertas(m));
      return `<div class="mesa-tile ${prio?'alerta-'+prio:''}"><div class="num">Mesa ${m.numero}</div>
        <div class="estado">${m.ocupada?(m.pedido?estadoPedidoLabel(m):'Sentados'):'Libre'} · ${m.mozo}</div>
        ${alertasAbiertas(m).length?`<span class="pill ${prio}">${alertasAbiertas(m).length} alerta(s)</span>`:`<span class="pill ${m.ocupada?'ocupada':'libre'}">${m.ocupada?'Ocupada':'Libre'}</span>`}</div>`;
    }).join('')}</div>
    <div class="section-h">Cola de alertas</div>
    ${todas.length ? todas.map(({mesa,alerta})=>alertRowHtml(mesa,alerta,true)).join('') : `<div class="empty">${ic('checkring')} No hay alertas abiertas.</div>`}
    <div class="section-h">Administración</div>
    <button class="btn ghost sm" onclick="resetTodo()">${ic('refresh')} Reiniciar todo (afecta a todos los dispositivos conectados)</button>`;
}
function resetTodo(){
  if(confirm('Esto reinicia el estado para TODOS los dispositivos conectados ahora mismo (mesas, pedidos, alertas). ¿Confirmás?')) send({type:'reset_demo'});
}

/* ---------------- DUEÑO ---------------- */
function viewDueno(){
  const mesasOcupadas = state.mesas.filter(m=>m.ocupada).length;
  const alertasN = todasAlertasAbiertas().length;
  const urgentes = todasAlertasAbiertas().filter(x=>x.alerta.prioridad==='urgente').length;
  const ventasDemo = state.mesas.reduce((s,m)=> s + (m.pedido? m.pedido.items.reduce((a,it)=>a+(it.precio||0),0):0), 0);
  const productosPendientes = todosLosProductos().filter(p=>precioBase(p)===null).length;
  return `<h1 class="view-title">DUEÑO</h1>
    <p class="view-sub">Panel de negocio. ${productosPendientes} productos todavía sin precio confirmado — se excluyen del cálculo de ventas.</p>
    <div class="mock-banner">${ic('clipboard')} Este dashboard usa datos reales de la carta y pedidos reales de esta sesión — pero no hay caja/POS conectado, así que "ventas" es sólo lo pedido desde este sistema hoy.</div>
    <div class="grid cols-4">
      ${statTile('Ventas (hoy, este sistema)', money(ventasDemo), 'pedidos por esta app', null)}
      ${statTile('Mesas ocupadas', mesasOcupadas+' / '+MESAS_TOTAL, null, null)}
      ${statTile('Alertas activas', String(alertasN), urgentes>0?urgentes+' urgente(s)':'todo tranquilo', urgentes>0?'downAlert':null)}
      ${statTile('Precios a confirmar', String(productosPendientes), 'productos', null)}
    </div>
    <div class="section-h">Platos con 3D real activado</div>
    <div class="grid cols-3">
      ${[...CANDIDATOS_3D].map(id=>{ const p=findProducto(id); return `<div class="insight"><span>★ ${p.nombre}</span></div>`; }).join('')}
    </div>`;
}
function statTile(label,value,delta,deltaClass){
  return `<div class="stat-tile"><div class="label">${label}</div>
    <div class="value ${deltaClass==='downAlert'?'alert':''}">${value}</div>
    ${delta?`<div class="delta ${deltaClass==='up'?'up':deltaClass==='downAlert'?'down':''}">${delta}</div>`:''}</div>`;
}
