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

Estas decisiones describen solamente la base actual. No implican que exista base de datos, multi-tenant, autenticacion real, pagos, 3D o AR.
