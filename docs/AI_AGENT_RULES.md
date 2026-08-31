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
9. Tratar 3D/AR e IA conversacional como innovacion estrategica, pero nunca dejar que bloqueen una operacion de restaurante solida ni afirmar valor sin evidencia.
10. No afirmar que existen capacidades ausentes: hoy no hay multi-tenant, autenticacion real de API, base de datos activa en `main` ni pagos.
11. Revisar `git diff` y `git status` antes de terminar; no mezclar cambios ajenos ni borrar trabajo parcial valido.

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
