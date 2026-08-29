# Decisiones registradas

## Base de calidad sin dependencias externas

- **Decision:** usar `node:test`, `assert`, `fetch` y procesos hijos provistos por Node.js.
- **Motivo:** el proyecto ya funciona sin paquetes externos y Node.js 18 incluye las capacidades necesarias.
- **Consecuencia:** `npm test` no requiere instalar dependencias; las pruebas ejercitan el proceso real de `server.js`.

## Verificacion centralizada

- **Decision:** `npm run check` valida sintaxis JavaScript, todos los JSON del repositorio y luego ejecuta los tests.
- **Motivo:** ofrecer una unica comprobacion reproducible para trabajo local y CI.

## CI conservadora

- **Decision:** GitHub Actions usa Node.js 22 LTS, compatible con el requisito existente `>=18`, y permisos de solo lectura sobre el contenido.
- **Motivo:** validar pushes y pull requests sin publicar ni desplegar.

## Direccion de producto y tecnologia

Estas son decisiones de direccion. No significan que las capacidades futuras ya esten implementadas.

- Rabieta no busca ser solamente otro sistema QR; el foco es la coordinacion operativa del salon y del restaurante.
- El modelo SaaS futuro previsto es de precio fijo, sin comision sobre ventas.
- Se prioriza integrar con POS existentes antes que competir innecesariamente con ellos.
- SSE es la tecnologia de tiempo real utilizada actualmente.
- Se prioriza la simplicidad tecnica y se evita complejidad sin beneficio verificado.
- La UI actual debe preservarse salvo que exista una decision explicita de producto para cambiarla.
- 3D y AR no son una prioridad estrategica.
- Produccion, dinero y datos reales requieren aprobacion humana.

## Decisiones pendientes

Todavia no se decidio:

- usar un backend multi-tenant compartido o un deploy por restaurante;
- modelar el servicio de cada plato individualmente o gestionar el pedido como bloque;
- la arquitectura definitiva de persistencia y base de datos.

Estas decisiones describen solamente la base actual. No implican que exista base de datos, multi-tenant, autenticacion real, pagos, 3D o AR.
