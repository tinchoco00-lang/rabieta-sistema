# Vision de producto

## Proposito

Rabieta construye un sistema operativo para restaurantes que sea viable en Argentina y pueda escalar desde Rabieta Lomitas hacia multiples restaurantes y sucursales.

La perspectiva principal es la del dueno o empresario. Una capacidad entra al producto solamente si puede justificar al menos uno de estos resultados:

- aumentar ingresos, margen, ticket promedio, rotacion o revenue por asiento/hora;
- reducir costos, horas humanas, errores, perdidas, fraude o dependencia de personas;
- ahorrar tiempo al dueno o encargado y aumentar control o visibilidad;
- aumentar recurrencia, reputacion o la capacidad de abrir y controlar sucursales.

Ser moderna no es una justificacion suficiente.

## Laboratorio y secuencia

Rabieta Lomitas es el primer piloto real. El orden de trabajo es:

1. lograr una operacion de salon robusta;
2. medir una linea de base y el efecto del producto;
3. demostrar valor empresarial verificable;
4. estandarizar configuracion, seguridad y soporte;
5. escalar a otros restaurantes y sucursales.

No se comunicara una mejora como resultado hasta medirla en el piloto. Las cifras promocionales de terceros son hipotesis de mercado, no resultados de Rabieta.

## Experiencia objetivo

La direccion de producto, por etapas, incluye:

- un QR con identidad unica por mesa;
- una carta movil rapida, atractiva y accesible;
- pedido directo del cliente y adicionales sin esperar al mozo;
- distribucion automatica a cocina, barra o el sector correcto;
- estados reales en tiempo real y excepciones visibles para el personal;
- solicitud de cuenta y pago desde la mesa;
- confirmacion automatica de pagos mediante proveedor y webhooks;
- integraciones con medios de pago argentinos, POS y facturacion;
- analytics operativos y financieros para duenos y encargados;
- automatizacion, CRM, fidelizacion, resenas y crecimiento medible;
- una carta visual avanzada cuando mejore conversion o reduzca incertidumbre.

El servicio debe admitir un modelo hibrido: el cliente puede autogestionarse y el personal puede intervenir, agregar items o asistir sin crear dos cuentas incompatibles.

## Estado actual verificado

El codigo actual es un MVP de un restaurante y un proceso Node.js. Tiene carta desde JSON, acciones de mesa, vistas de personal, SSE, validacion de productos y precios, protecciones operativas basicas y persistencia opcional de continuidad en PostgreSQL.

Todavia no tiene operacion por item o sector, historial auditable, metricas de piloto, usuarios y roles reales, multi-tenant, pagos, facturacion, POS ni CRM. El panel de dueno resume solamente el estado de la sesion actual; no representa ventas fiscales ni caja.

## Innovacion avanzada

3D/AR y un concierge conversacional de IA son lineas estrategicas, no prerrequisitos del piloto.

Un experimento 3D/AR debe tener una hipotesis medible, por ejemplo mayor conversion o ticket en platos seleccionados, y no puede degradar velocidad ni accesibilidad de la carta.

Un concierge de voz o video solo puede avanzar cuando:

- usa exclusivamente informacion verificada de carta, disponibilidad, alergenos y politicas;
- no inventa ingredientes, precios, tiempos ni promesas;
- permite confirmacion explicita antes de enviar un pedido;
- tiene salida clara a asistencia humana;
- demuestra impacto frente a su costo y riesgo.

## Criterio de priorizacion

Cada iniciativa debe registrar: problema operativo, usuario responsable, metrica primaria, linea de base, cambio esperado como hipotesis, costo/riesgo, instrumentacion y criterio para continuar o revertir.

Ante dos tareas seguras, se prioriza la que acerca antes a un piloto medible y reduce mayor riesgo operativo. Produccion sensible, dinero real, secretos, datos reales, precios, migraciones destructivas, arquitectura fundamental, decisiones importantes de producto/UI, asuntos legales y acciones irreversibles requieren aprobacion del fundador.
