# Decisiones registradas

## Base de calidad con herramientas nativas

- **Decision:** usar `node:test`, `assert`, `fetch` y procesos hijos provistos por Node.js para los tests.
- **Motivo:** Node.js 18 incluye las capacidades de prueba necesarias sin agregar frameworks.
- **Consecuencia:** las pruebas ejercitan el proceso real de `server.js`; la unica dependencia de runtime agregada es el cliente oficial `pg` para PostgreSQL.

## Persistencia transitoria del MVP

- **Decision:** guardar el estado completo en una unica fila JSONB de `rabieta_estado` cuando existe `DATABASE_URL`, y conservar el modo memoria cuando no existe.
- **Motivo:** recuperar mesas, pedidos y alertas tras reinicios con el cambio mas pequeno compatible con el MVP.
- **Consecuencia:** esta capa aporta continuidad, pero no es el esquema relacional definitivo del SaaS, no es multi-tenant y no resuelve multiples procesos escribiendo al mismo tiempo.

## Verificacion centralizada

- **Decision:** `npm run check` valida sintaxis JavaScript, todos los JSON del repositorio y luego ejecuta los tests.
- **Motivo:** ofrecer una unica comprobacion reproducible para trabajo local y CI.

## CI conservadora

- **Decision:** GitHub Actions usa Node.js 22 LTS, compatible con el requisito existente `>=18`, un servicio efimero PostgreSQL oficial y permisos de solo lectura sobre el contenido.
- **Motivo:** validar pushes y pull requests, incluida la recuperacion real del estado tras reiniciar, sin publicar ni desplegar.

## Direccion de producto y tecnologia

Estas son decisiones de direccion. No significan que las capacidades futuras ya esten implementadas.

- La perspectiva principal es la del dueno/empresario: cada capacidad debe justificar impacto economico, operativo, de control o de escalabilidad.
- Rabieta no busca ser solamente otro sistema QR; el foco es coordinar el flujo completo del salon y demostrar resultados en Rabieta Lomitas.
- Existe una direccion historica hacia un SaaS de precio fijo sin comision sobre ventas, pero no constituye una decision de precio aprobada.
- Se prioriza integrar con POS existentes antes que competir innecesariamente con ellos.
- SSE es la tecnologia de tiempo real utilizada actualmente.
- Se prioriza la simplicidad tecnica y se evita complejidad sin beneficio verificado.
- La UI actual debe preservarse salvo que exista una decision explicita de producto para cambiarla.
- El dueno confirmo que los platos llegan por partes; la operacion objetivo debe modelar preparacion y entrega por item, aunque el MVP actual todavia maneja un estado por pedido.
- 3D/AR e IA conversacional son lineas estrategicas de innovacion, condicionadas a una hipotesis empresarial medible y a no bloquear la operacion basica.
- Nunca se afirmara diferenciacion, impacto o novedad sin evidencia. El benchmark minimo cubre Argentina, Estados Unidos y China.
- Produccion, dinero y datos reales requieren aprobacion humana.

## Decisiones pendientes

Todavia no se decidio:

- usar un backend multi-tenant compartido o un deploy por restaurante;
- la arquitectura definitiva de persistencia y base de datos.
- el proveedor y el diseno de integracion de pagos locales, POS y facturacion.

Tambien siguen pendientes la politica de retencion de eventos y los criterios cuantitativos del piloto. No se inventaran metas sin linea de base.

Estas decisiones describen solamente la base actual. No implican que exista un modelo relacional definitivo, multi-tenant, autenticacion real, pagos ni capacidades avanzadas validadas.
