# Metricas del piloto

## Regla

No declarar impacto sin linea de base, periodo, definicion y fuente. Rabieta Lomitas es el laboratorio para decidir si se mantiene, ajusta o descarta una funcion.

## Tablero minimo

| Metrica | Definicion | Fuente requerida |
| --- | --- | --- |
| Costo laboral por cubierto | costo laboral del turno / cubiertos del turno | planilla de turnos y ventas verificadas |
| Staff-hours cada 100 cubiertos | horas de personal / cubiertos * 100 | reloj/turnos y conteo de cubiertos |
| Pedidos por hora de personal | pedidos confirmados / horas de personal | registro de pedidos y turnos |
| Pedido a cocina | timestamp de confirmacion - timestamp de llegada a cocina | eventos de pedido |
| Tiempo total de mesa | liberacion/pago - apertura u ocupacion | eventos de mesa o medicion manual |
| Tiempo para pagar | pago confirmado - solicitud de cuenta | eventos de cuenta/pago |
| Revenue por asiento/hora | ventas netas / (asientos ocupados * horas) | ventas verificadas y ocupacion |
| Ticket promedio | ventas netas / cuentas cerradas | ventas verificadas |
| Upsell | items/adicionales objetivo por cuenta o ticket incremental vs linea de base | pedidos y diseno del experimento |
| Errores, anulaciones y refunds | conteo y monto por 100 pedidos | POS/pagos y motivo registrado |
| Perdidas/leakage | diferencia investigada entre pedido, cobro y entrega | conciliacion operativa |
| Recurrencia | clientes identificados que vuelven / clientes identificados | CRM consentido; no inferir sin identidad |
| Intervencion del dueño | minutos o incidencias que requieren al dueño por turno | bitacora del piloto |
| Uptime | tiempo disponible / tiempo planificado | monitoreo y registro de incidentes |

## Diseno de medicion

1. Registrar una linea de base comparable antes del cambio: mismo dia/hora o turnos equivalentes.
2. Instrumentar timestamps y motivo de excepciones antes de activar una funcion.
3. Separar pedidos iniciados por QR, por personal y mixtos; no atribuir causalidad sin comparacion.
4. Revisar semanalmente con el encargado: variacion, incidentes y comentario cualitativo del equipo.
5. Mantener datos agregados o anonimizados durante el piloto; el uso de datos reales de clientes requiere aprobacion y controles de seguridad.

## Instrumentacion pendiente

El MVP actual no guarda el historial necesario para calcular estas metricas de manera confiable. La siguiente implementacion de analytics debe ser aditiva, auditable y no destructiva; su modelo de datos requiere una decision de arquitectura antes de construirse.
