# Roadmap

Este documento separa el estado comprobado de posibles trabajos futuros. Nada de lo listado como pendiente debe comunicarse como implementado.

## Estado comprobado

- MVP Node.js con `pg` como unica dependencia de runtime.
- Menu cargado desde JSON.
- Estado en memoria por defecto, persistencia PostgreSQL opcional de continuidad y actualizaciones por SSE.
- PIN compartido para la interfaz de personal.
- Pruebas basicas de rutas HTTP y verificacion automatizada del repositorio.

El alcance de producto y la medicion del piloto estan definidos en `PRODUCT_VISION.md` y `PILOT_METRICS.md`. No convierten capacidades futuras en funcionalidades existentes.

## Fase 0 - Base de desarrollo seguro

- CI;
- tests;
- reglas para agentes;
- documentacion tecnica y de seguridad.

Esta fase establece controles de desarrollo. No resuelve los riesgos funcionales enumerados para fases posteriores.

## Fase 1 - Operacion segura de piloto

- evolucionar la persistencia transitoria JSONB hacia el modelo definitivo;
- autenticacion y autorizacion;
- validacion de pedidos y precios contra el menu;
- mitigacion de XSS;
- limites robustos de body;
- rate limiting;
- manejo de errores y observabilidad.
- procedimiento aprobado para QR por mesa y secretos, antes de activar identidad HMAC en un local;
- instrumentacion de timestamps operativos y una linea de base del piloto.

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
- tablero de las metricas definidas para el piloto.

## Fase 4 - Integraciones aprobadas

- integraciones con POS;
- Mercado Pago;
- confirmacion de pagos por webhook del proveedor;
- facturacion, cuando se haya evaluado el proveedor y el alcance regulatorio;
- otras integraciones que hayan sido evaluadas y aprobadas.

## Fase 5 - Crecimiento e innovacion validada

- CRM, fidelizacion y reputacion con consentimiento y una hipotesis medible;
- IA aplicada al producto usando solamente informacion verificada;
- automatizacion avanzada;
- 3D/AR o concierge IA de voz/video solo con razon comercial, seguridad y experimento medible verificados.

Las fases no tienen fechas comprometidas. Produccion, pagos, datos reales y decisiones irreversibles requieren aprobacion humana.
