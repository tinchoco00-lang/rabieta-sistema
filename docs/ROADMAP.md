# Roadmap orientado al piloto

Este documento separa el estado comprobado de posibles trabajos futuros. Nada pendiente debe comunicarse como implementado. La prioridad es demostrar valor empresarial en Rabieta Lomitas antes de escalar o invertir en capacidades avanzadas.

## Estado comprobado

- MVP Node.js con `pg` como unica dependencia de runtime.
- Menu cargado desde JSON.
- Estado en memoria por defecto, persistencia PostgreSQL opcional de continuidad en una fila JSONB y actualizaciones por SSE.
- PIN compartido para la interfaz de personal.
- Identidad HMAC opcional por mesa; sin `MESA_TOKEN_SECRET` permanece un modo legacy no autenticado.
- Validacion de pedidos contra la carta, protecciones operativas basicas, tests y CI.
- Los estados de cocina avanzan solamente mediante una accion autenticada del personal; no existe avance automatico de demo.
- Preparacion y entrega avanzan por item; el resumen del pedido no oculta que quedan items mas atrasados.
- Solicitud, confirmacion de pago demo y liberacion de mesa son pasos separados; el modo demo no mueve dinero ni simula una confirmacion externa.

## Fase 0 - Base de desarrollo seguro

- CI, tests y controles reproducibles;
- reglas para agentes;
- documentacion tecnica, de producto y seguridad.

Esta fase establece controles de desarrollo. No resuelve los riesgos funcionales de las fases posteriores.

## Fase 1 - Piloto operativo seguro

- confirmar mesas, sectores, carta, precios, modificadores y flujo real del local;
- confirmar el ruteo real de cada producto a cocina, barra u otro sector e incorporarlo sin inferirlo de categorias comerciales;
- autenticacion y autorizacion adecuadas al piloto;
- generar, rotar y distribuir QR por mesa de forma operativa;
- definir degradacion segura ante caidas de red o persistencia;
- observabilidad y runbook del turno.

## Fase 2 - Instrumentacion y prueba de valor

- ledger auditable de eventos con timestamps reales;
- apertura/cierre de mesa, cubiertos y motivos de excepcion;
- linea de base y metricas definidas en `PILOT_METRICS.md`;
- dashboard del dueno basado en datos conciliados, con calidad y alcance visibles;
- experimento controlado en Rabieta Lomitas y decision de continuar o revertir.

## Fase 3 - Integraciones locales

- integracion evaluada con el POS elegido;
- solicitud de cuenta y pagos argentinos en ambiente de prueba;
- confirmacion por webhooks, idempotencia y conciliacion;
- facturacion e inventario solamente mediante integraciones aprobadas.

Pagos reales, credenciales, produccion, datos reales y asuntos legales requieren aprobacion del fundador.

## Fase 4 - Modelo relacional y multi-tenant

- restaurantes y sucursales;
- staff y roles;
- mesas, pedidos, items, sectores y alertas;
- aislamiento, auditoria e historial.

La arquitectura multi-tenant y de persistencia definitiva sigue pendiente de decision. Debe basarse en lo aprendido en el piloto y facilitar multiples sucursales.

## Fase 5 - Control y crecimiento

- analytics operativos y financieros;
- CRM, fidelizacion, resenas y recurrencia medible;
- control remoto y automatizacion multi-sucursal.

## Fase 6 - Capacidades avanzadas condicionadas

- concierge de IA con informacion verificada, confirmacion y salida humana;
- automatizacion avanzada;
- 3D/AR solamente mediante experimentos con una razon comercial y metrica verificables.

Las fases no tienen fechas comprometidas. Produccion, pagos, datos reales, arquitectura fundamental y decisiones irreversibles requieren aprobacion humana.
