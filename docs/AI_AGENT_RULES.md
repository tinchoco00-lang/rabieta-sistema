# Reglas para agentes de IA

1. El codigo real es la fuente de verdad. Leerlo antes de documentar o cambiar comportamiento.
2. Nunca afirmar que algo funciona sin verificarlo.
3. Nunca declarar tests exitosos sin ejecutarlos y registrar el comando y resultado.
4. Preservar la UI actual de Rabieta; no redisenarla arbitrariamente.
5. Pedir aprobacion humana antes de tocar produccion, datos reales, precios, secretos, pagos, migraciones destructivas o cambios irreversibles.
6. No incluir secretos en codigo, commits, fixtures, logs ni documentacion.
7. Evitar complejidad innecesaria y preferir cambios pequenos, comprobables y reversibles.
8. No tratar 3D o AR como prioridad estrategica.
9. No afirmar que existen capacidades ausentes: hoy no hay multi-tenant, autenticacion real de API, base de datos activa en `main` ni pagos.
10. Revisar `git diff` y `git status` antes de terminar; no mezclar cambios ajenos ni borrar trabajo parcial valido.
