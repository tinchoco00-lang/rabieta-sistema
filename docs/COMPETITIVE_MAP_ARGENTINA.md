# Mapa competitivo

## Alcance y metodo

Revision de fuentes oficiales realizada el 31 de agosto de 2026. Este mapa no prueba participacion de mercado, calidad real ni resultados economicos. Las funciones pueden cambiar y deben volver a verificarse antes de una decision de inversion o posicionamiento.

Nunca se debe afirmar que Rabieta es unico o primero sin una investigacion especifica y evidencia suficiente.

## Argentina

| Oferta | Evidencia publicada | Lectura para Rabieta |
| --- | --- | --- |
| Fudo | Publica POS, pedidos, KDS, ventas/gastos/stock, integracion con Mercado Pago, API y una Carta QR que puede emitir un QR por mesa para que el comensal comande. Fuentes: [sitio de Fudo](https://fu.do/es-ar/) y [guia de Carta QR](https://soporte.fu.do/es/articles/11732204-introduccion-a-la-carta-qr). | QR por mesa, pedido, cocina, pagos y gestion ya existen en una oferta local. Competir solo con una carta QR no alcanza. |
| MaxiRest + Waitry | MaxiRest publica gestion, inteligencia de negocio, monitoreo remoto, modo offline y capacidades multi-local. Su documentacion de salon describe pedidos del comensal por QR con Waitry; Waitry documenta sincronizacion de productos, mesas y pedidos con MaxiRest. Fuentes: [MaxiRest](https://maxirest.com.ar/?no_redirect=true), [integraciones de salon](https://ayuda.maxirest.com/es_ES/integraciones/%C2%BFcuales-son-las-integraciones-de-salon) e [integracion Waitry/MaxiRest](https://help.waitry.net/es/article/como-integrar-maxirest-con-waitry-1ubtlo0/). | La interoperabilidad con un POS instalado es un camino probado. Hay que evaluar operacion offline, reconciliacion de cuentas y soporte, no solo la pantalla del cliente. |
| FudX | Publica QR unico por mesa, pedido sin app, envio a cocina y vistas para comensal, mozo, cocina, delivery y dueno. Tambien declara que la facturacion oficial sigue en integracion. Fuente: [sitio de FudX](https://www.fudx.com.ar/). | Un producto argentino reciente comunica una vision muy cercana. Rabieta debe diferenciarse mediante resultados medidos en el piloto, confiabilidad e integraciones, no por una lista de funciones. |

### Hipotesis de oportunidad en Argentina

No estan validadas todavia:

- hacer de las metricas de productividad y revenue por asiento/hora una parte nativa del flujo, no un reporte decorativo;
- reducir pasos y doble carga entre mesa, personal, cocina/barra, pago y POS;
- ofrecer degradacion segura cuando fallen red, proveedor o integracion;
- demostrar retorno con una linea de base real de Rabieta Lomitas;
- mantener una experiencia hibrida para clientes que no quieran usar QR.

## Estados Unidos

Toast documenta QR por mesa, pedidos adicionales sobre una misma cuenta, envio a cocina, pago, split, fidelizacion y convivencia entre pedidos iniciados por personal y por cliente. GoTab publica pedido y pago por QR/NFC sin descarga, sincronizado con KDS. Fuentes: [Toast Mobile Order & Pay](https://support.toasttab.com/en/article/Mobile-Order-and-Pay-Overview) y [GoTab Mobile Ordering and Payment](https://gotab.com/products/mobile-ordering-payment).

Patron relevante: el valor se vende como un sistema integrado de operacion, pagos y datos. Las afirmaciones de mejora que publican los proveedores no deben trasladarse a Rabieta; solamente sirven para formular hipotesis a medir.

## China

La solucion oficial de Alipay para restaurantes describe escaneo de QR, carta, pedido y pago dentro de su ecosistema. Yum China documenta pedidos mediante mini programs de WeChat y pagos moviles integrados. Fuentes: [Alipay Smart Restaurants](https://iopenhome.alipay.com/docs/ac/restaurant/restaurantintroduction) e [informe de Yum China](https://ir.yumchina.com/system/files-encrypted/nasdaq_kms/assets/2023/04/01/4-23-17/HKEX-EPS_20230331_10665200_0.pdf).

Patron relevante: el restaurante puede vivir dentro de super-apps con identidad y pago ya adoptados. En Argentina la estrategia debe adaptarse a proveedores, habitos, conectividad y regulacion locales; no copiar interfaces fuera de contexto.

## Protocolo antes de construir una funcion grande

1. definir el resultado empresarial y la metrica;
2. verificar al menos competidores de Argentina, Estados Unidos y China;
3. registrar como resuelven el flujo completo, incluidos excepciones y soporte;
4. separar hechos publicados, inferencias e hipotesis;
5. probar la opcion mas pequena y reversible en Rabieta;
6. continuar solo si el piloto muestra valor o aprendizaje suficiente.
