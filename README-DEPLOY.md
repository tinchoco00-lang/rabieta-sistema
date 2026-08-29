# Rabieta — sistema real de mesa (MVP funcional)

Esto ya NO es una demo simulada: si dos celulares distintos entran a este sistema
al mismo tiempo, se ven en vivo el uno al otro. Un cliente pide, la cocina lo ve
al instante; un cliente llama al mozo, el mozo suena/vibra al instante.

## Qué es cada cosa

- `server.js` — el programa que corre 24 hs. Coordina el estado real de las 22
  mesas (placeholder — falta confirmar el número real) y avisa a todos los
  celulares conectados cuando algo cambia.
- `persistence.js` — la capa de continuidad. Sin `DATABASE_URL` mantiene el
  estado en memoria; con `DATABASE_URL` usa PostgreSQL mediante el paquete
  oficial `pg`, crea la tabla necesaria y recupera el estado al iniciar.
- `package.json` y `package-lock.json` — declaran y fijan las dependencias. La
  única dependencia directa actual es `pg`.
- `public/mesa.html` — lo que ve el CLIENTE. Se abre con `tuservidor.com/mesa.html?mesa=5`
  — el número al final es el número de mesa. En producción, cada mesa tiene
  pegado un QR que ya apunta a su propio número (eso lo generamos después,
  es trivial, es texto).
- `public/staff.html` — lo que ve el PERSONAL (mozo, cocina, encargado, dueño).
  Pide un PIN (por ahora `1234`, lo cambiás con la variable `STAFF_PIN`, ver abajo).
- `menu-rabieta.json` — la carta real de Rabieta, la misma que ya venías usando.

## Persistencia y limitaciones honestas del MVP

Si `DATABASE_URL` no está definida, Rabieta funciona completamente en memoria,
como antes: si el proceso se reinicia, vuelve a mesas vacías. Si `DATABASE_URL`
está definida, usa PostgreSQL, crea automáticamente `rabieta_estado`, guarda el
estado completo como JSONB y recupera mesas, pedidos y alertas al reiniciar.

Cuando PostgreSQL está configurado pero no responde, Rabieta muestra el error y
no finge que funciona usando memoria silenciosamente. Nunca hay que escribir una
URL real de base de datos dentro del repositorio: `DATABASE_URL` se configura en
el entorno autorizado donde se ejecute el sistema.

Esta fila JSONB es una capa transitoria de continuidad para el MVP. No es el
esquema relacional definitivo del futuro SaaS, no es multi-tenant y todavía no
aporta historial ni auditoría.

El PIN compartido de personal genera un token temporal en memoria para autorizar
las acciones internas. Esos tokens no se guardan en PostgreSQL y dejan de ser
válidos al reiniciar el proceso. Todavía no existen usuarios individuales,
sesiones persistentes ni autorización real por roles.

## Cómo ponerlo en internet — paso a paso, sin usar la terminal

Vamos a usar **Render** (gratis para empezar). Necesita que el código esté en
**GitHub** primero — los dos pasos son sin instalar nada, todo desde el navegador.

### Paso 1 — Subir el código a GitHub (una sola vez)

1. Andá a [github.com](https://github.com) y creá una cuenta gratis (si no tenés).
2. Arriba a la derecha, tocá el `+` → **New repository**.
3. Ponele de nombre `rabieta-sistema`, dejalo en **Public**, y tocá **Create repository**.
4. En la página que se abre, buscá el link que dice **uploading an existing file**
   (o el botón **Add file → Upload files**).
5. Arrastrá TODOS los archivos y carpetas de esta entrega (`server.js`,
   `persistence.js`, `package.json`, `package-lock.json`, `menu-rabieta.json`,
   la carpeta `public` completa) a esa página. GitHub sube carpetas enteras sin
   problema si las arrastrás.
6. Abajo, tocá **Commit changes** (podés dejar el mensaje que viene puesto).

Listo — el código ya está "en internet" en un repositorio, aunque todavía no
está corriendo para nadie.

### Paso 2 — Desplegarlo en Render (donde va a vivir 24 hs)

1. Andá a [render.com](https://render.com) y creá una cuenta gratis (podés
   entrar directo con la cuenta de GitHub que acabás de crear — más fácil).
2. Tocá **New +** → **Web Service**.
3. Elegí **Build and deploy from a Git repository** y conectá el repositorio
   `rabieta-sistema` que subiste en el Paso 1.
4. Render va a detectar que es Node.js solo. Dejá:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. (Opcional pero recomendado) En **Environment Variables**, agregá una:
   - Key: `STAFF_PIN` — Value: el PIN que quieras usar de verdad (4 a 8 números).
6. Tocá **Create Web Service** y esperá 2-3 minutos.
7. Cuando termine, Render te da una URL como `https://rabieta-sistema.onrender.com`
   — ESA es tu sistema real, ya anda para cualquiera con ese link.

### Paso 3 — Probarlo con dos celulares (antes de mostrárselo al dueño)

- Celular 1: `https://tu-url.onrender.com/mesa.html?mesa=1`
- Celular 2: `https://tu-url.onrender.com/staff.html` → PIN → "Activar sonido y
  vibración" → pestaña Mozo.
- Desde el celular 1, tocá "Llamar al mozo". El celular 2 tiene que sonar y
  vibrar al toque. Si eso funciona, está listo para mostrar.

### Nota sobre el plan gratis de Render

El plan free "duerme" el servidor después de 15 minutos sin uso, y tarda unos
30-50 segundos en despertar la primera vez que alguien entra después de eso.
Para la demo con el dueño, entrá vos primero un minuto antes para que ya esté
despierto. Si esto pasa a ser el sistema real del día a día, ahí conviene pasar
al plan pago de Render (unos USD 7/mes) para que nunca se duerma.

## Qué sigue después de este MVP

1. Confirmar con el dueño los 21 precios pendientes y la cantidad real de mesas
   (hoy usa 22 como placeholder).
2. Reemplazar los 2 modelos 3D genéricos por el escaneo real de los 5 platos
   destacados (servicio de escaneo/fotogrametría — costo y tiempo aparte).
3. Login real de personal (usuario + contraseña por persona, no un PIN compartido).
4. Diseñar el esquema relacional definitivo del SaaS, con historial y auditoría,
   reemplazando cuando corresponda la persistencia JSONB transitoria.
5. QR impresos por mesa apuntando a `/mesa.html?mesa=N` de cada una.
