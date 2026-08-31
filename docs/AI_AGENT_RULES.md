# Reglas para agentes de IA

## Principios

1. El codigo real es la fuente de verdad y tiene prioridad sobre documentacion vieja. Leerlo antes de documentar o cambiar comportamiento.
2. Nunca inventar features, resultados ni el estado del proyecto.
3. Distinguir explicitamente entre **VERIFICADO**, **INFERENCIA**, **RECOMENDACION** y **PENDIENTE**.
4. Nunca afirmar que algo funciona sin verificarlo.
5. Nunca declarar tests exitosos sin ejecutarlos y registrar el comando y resultado.
6. Preferir soluciones simples, cambios pequenos, comprobables y reversibles.
7. Preservar la UI existente salvo que exista una decision explicita para cambiarla; no redisenarla arbitrariamente.
8. No incluir secretos en codigo, commits, fixtures, logs ni documentacion.
9. Evaluar cada capacidad desde el dueno: ingresos/margen, costos, horas, errores/perdidas, tiempo, control, ticket, rotacion, revenue por asiento/hora, recurrencia o escalabilidad.
10. 3D/AR e IA conversacional son lineas estrategicas condicionadas; nunca deben bloquear una operacion solida ni avanzar sin una hipotesis empresarial medible.
11. No afirmar que existen capacidades ausentes: hoy no hay multi-tenant, autenticacion real por usuarios/roles, base de datos obligatoria, historial auditable, metricas confiables del piloto ni pagos.
12. Antes de invertir trabajo considerable, verificar competidores de Argentina, Estados Unidos y China y separar hechos, inferencias e hipotesis.
13. No trasladar resultados o cifras promocionales de terceros a Rabieta. Solamente el piloto puede demostrar impacto propio.
14. Revisar `git diff` y `git status` antes de terminar; no mezclar cambios ajenos ni borrar trabajo parcial valido.

## Acciones automaticas permitidas

Dentro del alcance asignado y trabajando en branches, los agentes pueden automaticamente:

- leer e investigar;
- planificar;
- programar;
- escribir y ejecutar tests;
- corregir errores;
- refactorizar de forma segura;
- documentar;
- crear commits;
- crear pull requests;
- revisar codigo.

## Acciones que requieren aprobacion humana

- cambios o accesos a produccion;
- uso de datos reales;
- acceso, creacion o divulgacion de secretos;
- pagos, dinero o movimientos financieros;
- cambios de precios;
- migraciones destructivas;
- cambios de arquitectura fundamental;
- cambios importantes de producto o UI;
- contratos o asuntos legales;
- acciones irreversibles.
