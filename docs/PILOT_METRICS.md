# Metricas del piloto

## Regla principal

El piloto debe comparar una linea de base operativa de Rabieta Lomitas con periodos asistidos por el producto. No hay objetivos numericos aprobados. No se inventaran datos faltantes ni se mezclaran pedidos del sistema con ventas totales de caja.

Antes de medir se debe acordar con el local: definicion de cubierto, asiento disponible, apertura/cierre de mesa, turnos, anulaciones, cortesias, refunds, canal de venta y fuente oficial de ingresos.

## Metricas primarias

| Metrica | Definicion operativa | Fuente minima necesaria |
| --- | --- | --- |
| Costo laboral por cubierto | costo laboral imputable al turno / cubiertos servidos | reloj/turnos y costo laboral aprobado; cubiertos |
| Staff-hours cada 100 cubiertos | horas efectivas de personal / cubiertos x 100 | turnos y cubiertos |
| Pedidos por hora de personal | pedidos validos / horas efectivas de personal | eventos de pedido y turnos |
| Pedido a cocina/barra | mediana y percentiles desde confirmacion del cliente/personal hasta aceptacion en el sector | timestamps inmutables por item y sector |
| Tiempo total de mesa | cierre de mesa - apertura de mesa | eventos de mesa |
| Tiempo para pagar | pago confirmado - solicitud de cuenta; reportar tambien fallos | solicitud y webhook/confirmacion del proveedor |
| Revenue por asiento/hora | ingreso neto atribuible / horas-asiento disponibles u ocupadas, indicando cual | POS/facturacion conciliada, asientos y horarios |
| Ticket promedio | ingreso neto atribuible / cuentas cerradas | POS/facturacion conciliada |
| Upsell | cambio en items o margen incremental por exposicion elegible, con grupo/control o regla definida | exposicion, pedido, costo/margen y contexto |
| Errores/anulaciones/refunds | conteo y valor, separados por motivo y canal | auditoria de cambios y fuente financiera |
| Perdidas/leakage | diferencia explicable entre items servidos, cobrados, anulados e inventario | cocina, POS/pago, anulaciones e inventario |
| Recurrencia | clientes que regresan dentro de una ventana definida / clientes identificables elegibles | consentimiento e identidad/CRM |
| Intervencion del dueno | minutos y cantidad de excepciones que requieren al dueno por turno | registro simple de intervenciones y motivo |
| Uptime operativo | minutos en que el flujo critico estuvo disponible / minutos programados | health checks y pruebas sinteticas desde el local |

## Metricas de proteccion

Toda mejora debe vigilar tambien:

- abandono del flujo QR y necesidad de asistencia;
- pedidos duplicados o enviados a mesa/sector incorrectos;
- latencia y errores por endpoint/integracion;
- accesibilidad y alternativa para clientes sin dispositivo compatible;
- incidentes de seguridad, privacidad o pagos;
- satisfaccion del cliente y del personal sin sustituir las metricas operativas.

## Diseno de medicion

1. medir una linea de base comparable por franja, dia y volumen;
2. instrumentar eventos antes de cambiar el flujo;
3. desplegar de forma gradual y reversible;
4. distinguir mediana, percentiles y volumen de muestra;
5. anotar feriados, promociones, clima, dotacion y otros factores relevantes;
6. comparar periodos equivalentes y mostrar datos faltantes;
7. revisar semanalmente con dueno/encargado y registrar decisiones.

## Estado de instrumentacion

**VERIFICADO:** el MVP actual tiene un reloj de sesion, identidad, estado y timestamp de envio por item, ademas de timestamps de alertas. Esto permite observar entregas parciales durante la sesion, pero no constituye un historial auditable. El panel de dueno calcula importes de pedidos presentes en la sesion.

**PENDIENTE:** no existe un ledger historico de eventos, ruteo por sector confirmado, timestamps inmutables de cada transicion, apertura/cierre confiable de mesa, turnos, cubiertos, conciliacion con POS/pagos, costos, inventario, identidad de cliente ni medicion de uptime desde el local. Por lo tanto, hoy no se puede calcular de forma confiable la mayoria de las metricas anteriores.

La siguiente capa de instrumentacion debe conservar eventos crudos con reloj real, identificadores, actor/canal y motivo, y derivar metricas reproducibles. Su esquema definitivo y politica de retencion requieren una decision de arquitectura y privacidad antes de usar datos reales.
