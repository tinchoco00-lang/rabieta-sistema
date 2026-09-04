# Modelos 3D reales — convención exacta

Esta carpeta está vacía a propósito. Ni bien aparezca acá un archivo con el
nombre correcto, el sistema lo usa automáticamente para ese plato — no hace
falta tocar código ni reiniciar el servidor.

## Qué archivo poner y cómo nombrarlo

Por cada plato, el nombre de archivo tiene que ser exactamente el `id` de ese
producto en `menu-rabieta.json` (no el nombre visible):

- `<id-del-producto>.glb` — modelo para Android (Scene Viewer) y navegador.
- `<id-del-producto>.usdz` — mismo modelo para iPhone/iPad (Quick Look). Sin
  este archivo, un iPhone puede ver el modelo girar en pantalla pero no abrir
  la cámara AR.

Ejemplo real para "Burger Rabieta" (`id: burger-rabieta`):

```
public/models/burger-rabieta.glb
public/models/burger-rabieta.usdz
```

## Los 12 platos pendientes de escaneo real

```
papas-rabieta
burger-bacon
burger-rabieta
bife-chorizo
milanesa-ojo-bife
pastel-pastores
chicken-parmesan
pizza-rucula
pizza-six-cheese
pizza-asado
brownie
copa-helada-rabieta
```

Con solo el `.glb` de uno de estos platos ya deja de mostrarse el modelo
genérico para ese plato puntual; el `.usdz` se puede sumar después.

## Requisitos del archivo para que se vea bien

- **Escala real y verificada**: el modelo se muestra en tamaño real sobre la
  mesa vía AR. Si el escaneo no trae la escala correcta (1 unidad = 1 metro),
  el plato va a aparecer gigante o diminuto. Confirmar la escala contra una
  medida real del plato antes de subirlo.
- **Origen/pivote centrado en la base del plato**, para que se apoye bien
  sobre la mesa en AR en vez de flotar o hundirse.
- **Peso liviano para celular**: apuntar a algo cargable rápido en 4G (miles
  de triángulos, no millones; texturas comprimidas). Un escaneo por
  fotogrametría sin optimizar después normalmente pesa demasiado.
- Formato `.glb` binario (no `.gltf` + carpeta de texturas sueltas).

## Qué pasa mientras falte un archivo

El plato sigue usando el modelo genérico de demostración, rotulado siempre
como prototipo técnico — nunca se muestra como si fuera el modelo real de ese
plato. El panel de Dueño (`QR / Mesas` no, la pestaña **Dueño**) muestra en
vivo cuántos de los 12 platos ya tienen `.glb`/`.usdz` específicos acá.

## Cómo se rotula el primer modelo que llega (importante)

Apenas aparece un `.glb`/`.usdz` acá con el nombre correcto, el sistema lo usa
automáticamente — pero el texto que ve el cliente y el Dueño lo llama
**"modelo 3D específico de demostración"**, nunca "escaneo real del plato" ni
"modelo real de Rabieta". Esa distinción es a propósito: el primer modelo de
Burger Rabieta que se va a recibir es una representación creada para validar
la experiencia (cámara, AR, escala), no una fotogrametría del plato tal cual
sale de cocina. Recién cuando exista un escaneo/fotogrametría real del plato
served se puede empezar a llamarlo "modelo real" — y eso requiere además
actualizar el texto en `public/app.js` (`modeloParaPlato`, el badge y el
fineprint del modal 3D), no solo subir el archivo.

## Escala para Burger Rabieta — DEMO / POR CONFIRMAR

Todavía no medimos el plato real de Rabieta. Estos valores son solo una
referencia de arranque para que quien modele no parta de cero; **hay que
confirmarlos contra el plato servido antes de dar la escala por buena**:

- **Unidad**: 1 unidad del `.glb` = 1 metro (convención glTF estándar; así
  interpreta la escala `<model-viewer>`/ARKit/ARCore).
- **Orientación**: eje Y hacia arriba, burger apoyada sobre el plano XZ (de
  pie sobre su base, no de costado).
- **Origen/pivote**: centrado en X/Z y en Y=0 en la base del plato/tabla, no
  en el centro geométrico de la burger — así se apoya sobre la mesa en AR en
  vez de flotar o hundirse a mitad de altura.
- **Dimensiones aproximadas (DEMO, sin confirmar)**: diámetro ≈ 0.12–0.14 m,
  altura total (con el pan) ≈ 0.08–0.10 m. Son un punto de partida razonable
  para una hamburguesa de bodegón servida en plato, **no una medida oficial**.

Cuando se mida el plato real, reemplazar estos valores acá mismo y en
cualquier ficha de producción del modelo — no hace falta tocar código: la
escala vive dentro del `.glb`.
