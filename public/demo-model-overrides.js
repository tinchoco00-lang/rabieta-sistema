/* Demo 3D food approximations for Rabieta.
   IMPORTANT: these are visual category approximations, NOT scanned Rabieta dishes.
   Real files in /public/models/<id>.glb always take precedence. */
(function () {
  const DEMOS_3D_RABIETA = {
    'papas-rabieta':       { url:'/models-demo/papas-rabieta.glb',       nombre:'papas con cheddar y toppings (aproximación visual)' },
    'burger-bacon':        { url:'/models-demo/burger-bacon.glb',        nombre:'hamburguesa doble con bacon (aproximación visual)' },
    'burger-rabieta':      { url:'/models-demo/burger-rabieta.glb',      nombre:'hamburguesa doble con vegetales (aproximación visual)' },
    'bife-chorizo':        { url:'/models-demo/bife-chorizo.glb',        nombre:'bife con guarnición (aproximación visual)' },
    'milanesa-ojo-bife':   { url:'/models-demo/milanesa-ojo-bife.glb',   nombre:'milanesa con guarnición (aproximación visual)' },
    'pastel-pastores':     { url:'/models-demo/pastel-pastores.glb',     nombre:'pastel gratinado (aproximación visual)' },
    'chicken-parmesan':    { url:'/models-demo/chicken-parmesan.glb',    nombre:'pollo/milanesa a la parmesana (aproximación visual)' },
    'pizza-rucula':        { url:'/models-demo/pizza-rucula.glb',        nombre:'pizza con rúcula (aproximación visual)' },
    'pizza-six-cheese':    { url:'/models-demo/pizza-six-cheese.glb',    nombre:'pizza de quesos (aproximación visual)' },
    'pizza-asado':         { url:'/models-demo/pizza-asado.glb',         nombre:'pizza con carne (aproximación visual)' },
    'brownie':             { url:'/models-demo/brownie.glb',             nombre:'brownie con helado (aproximación visual)' },
    'copa-helada-rabieta': { url:'/models-demo/copa-helada-rabieta.glb', nombre:'copa helada (aproximación visual)' }
  };

  const modeloParaPlatoOriginal = modeloParaPlato;
  modeloParaPlato = function(id) {
    const real = modelosRealesDisponibles()[id];
    if (real && real.glb) return modeloParaPlatoOriginal(id);
    const demo = DEMOS_3D_RABIETA[id];
    if (demo) return { url: demo.url, usdz: null, esReal: false, nombre: demo.nombre };
    return modeloParaPlatoOriginal(id);
  };
})();
