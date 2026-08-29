# Roadmap

Este documento separa el estado comprobado de posibles trabajos futuros. Nada de lo listado como pendiente debe comunicarse como implementado.

## Estado comprobado

- MVP Node.js con `pg` como unica dependencia de runtime.
- Menu cargado desde JSON.
- Estado en memoria por defecto, persistencia PostgreSQL opcional de continuidad y actualizaciones por SSE.
- PIN compartido para la interfaz de personal.
- Pruebas basicas de rutas HTTP y verificacion automatizada del repositorio.

## Fase 0 - Base de desarrollo seguro

- CI;
- tests;
- reglas para agentes;
- documentacion tecnica y de seguridad.

Esta fase establece controles de desarrollo. No resuelve los riesgos funcionales enumerados para fases posteriores.

## Fase 1 - Seguridad y operacion basica

- evolucionar la persistencia transitoria JSONB hacia el modelo definitivo;
- autenticacion y autorizacion;
- validacion de pedidos y precios contra el menu;
- mitigacion de XSS;
- limites robustos de body;
- rate limiting;
- manejo de errores y observabilidad.

## Fase 2 - Modelo relacional y multi-tenant

- restaurantes;
- sucursales;
- staff;
- mesas;
- pedidos;
- items;
- alertas.

La arquitectura multi-tenant y de persistencia sigue pendiente de decision.

## Fase 3 - Control e informacion operativa

- roles;
- auditoria;
- historial y analytics.

## Fase 4 - Integraciones aprobadas

- integraciones con POS;
- Mercado Pago;
- otras integraciones que hayan sido evaluadas y aprobadas.

## Fase 5 - Capacidades avanzadas

- IA aplicada al producto;
- automatizacion avanzada;
- 3D real unicamente si existe una razon comercial verificada.

Las fases no tienen fechas comprometidas. Produccion, pagos, datos reales y decisiones irreversibles requieren aprobacion humana.
