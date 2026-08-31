# Vision de producto

## Proposito

Rabieta construye un sistema operativo para restaurantes que ayude al dueno a vender mejor, operar con menos friccion y controlar una o muchas sucursales. Rabieta Lomitas es el piloto: una capacidad solo pasa a escala si demuestra valor operativo o economico alli.

## Resultado buscado

El flujo objetivo es: un QR unico identifica la mesa; el cliente explora una carta movil rapida, hace pedidos y adicionales; el pedido llega automaticamente al sector correcto; el equipo opera por estados; el cliente solicita la cuenta y, cuando exista una integracion aprobada, paga desde la mesa con confirmacion del proveedor. El dueño puede ver la operacion y sus metricas sin depender de relatos manuales.

No es una promesa de que todos esos componentes ya existan. El estado real se registra en `docs/ROADMAP.md` y en el codigo.

## Criterio de priorizacion

Cada funcion debe mejorar o proteger al menos una de estas variables: ingresos o margen, costo, horas humanas, errores/perdidas/fraude, tiempo y control del encargado, ticket promedio, rotacion, revenue por asiento/hora, recurrencia/reputacion o capacidad de abrir y controlar sucursales. Si no impacta una de ellas, debe documentar una justificacion concreta antes de construirse.

## Principios de producto

- La hospitalidad sigue siendo opcional y asistida: el QR elimina esperas, no obliga al cliente a resolver una experiencia confusa.
- La carta, precios y disponibilidad deben tener una fuente de verdad verificable.
- Pedidos, pagos y estados deben ser trazables; nunca se debe inferir un pago real sin confirmacion del proveedor.
- Primero una operacion solida de salon, cocina y cobro; luego automatizacion avanzada.
- La IA conversacional y los platos 3D/AR son lineas de innovacion estrategica. Solo se activan si informacion verificada y una hipotesis medible justifican su costo y no bloquean el flujo operativo base.
- La integracion con POS y facturacion se evaluara para complementar lo que el local ya usa, no para reemplazarlo sin motivo empresarial.

## Limites actuales verificados

Hoy existe un MVP de carta, pedidos, alertas y estado en tiempo real. No hay pagos, POS, facturacion, CRM, fidelizacion, usuarios individuales, roles, multi-tenancy ni analytics historicos implementados. Consultar `docs/ARCHITECTURE.md` y `docs/SECURITY.md` para los limites tecnicos.
