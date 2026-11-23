# Precios de CifraDios: estudio y punto de equilibrio

Investigación del 23 de noviembre de 2026. Los precios de la página pública (`app/inicio.js`, `PLANES`) salen de aquí.

## 1. Lo que cobra la competencia (USD)

| App | Precio | Cómo cobra | Usuarios |
|---|---|---|---|
| Worship Online | $37 (5 usuarios) · $59 (10) · $89 (20) al mes · 25 % menos anual | Por equipo, en escalones | 5 / 10 / 20 / 35 |
| Loop Community Prime | $9.99 (20 usuarios) · $19.99 (40) · $29.99 (60) al mes | Por equipo | 20 a 100 |
| WorshipTools | Gratis (10 usuarios) · Pro $19 al mes (30) · Pro Plus $29–39 (sin límite) | Por iglesia | 10 / 30 / sin límite |
| MultiTracks Rehearse | Desde $34.99 al mes, 5 personas | Por equipo | 5+ |
| OnSong | $3.99–5.99 al mes por persona; grupos $360–600 al año | Por persona o grupo | — |
| Planning Center Services | Gratis hasta 5; de pago ~$14–99 al mes (sin confirmar) | Por tamaño de iglesia | 25 a 400 |
| Ultimate Guitar Pro | $29.99 al año | Por persona | 1 |
| Cifra Club Pro | R$ 99 al año en Brasil; $19.99 al año en EE. UU. | Por persona | 1 |
| Canto App (católica) | $30 al año | Por persona | 1 |

No encontramos ninguna app católica en español que cobre por ministerio ni que tenga modo en vivo. Ese es el hueco de CifraDios.

## 2. Precios que proponemos (MXN, IVA incluido, por ministerio)

| Plan | Mensual | Anual (2 meses gratis) | Incluye | Persona extra |
|---|---|---|---|---|
| **Gratis** | $0 | — | 1 persona, 30 canciones, 1 set | — |
| **Básico** | **$199** (~$11 USD) | **$1,990** | 10 personas | **+$19 al mes** |
| **Pro** | **$349** (~$19 USD) | **$3,490** | 10 personas + 100 páginas al mes de foto/PDF → cifrado | **+$29 al mes** |

Por qué estos precios:
- **Básico a $199** cuesta lo mismo que WorshipTools Pro ($19 USD) pero con 10 personas. Es mucho menos que Worship Online por 10 personas ($59 USD). Para una parroquia es menos de $20 por persona al mes.
- **Pro a $349** se justifica por lo que nadie más tiene en español: misa por momentos, modo en vivo, PDF con la marca del ministerio, pistas y la IA. Sigue por debajo de las opciones gringas para equipos.
- **Asientos:** 10 personas cubren a la mayoría de los coros. Las personas extra se cobran baratas para que no se queden fuera las voces.
- **Anual con 2 meses gratis:** se paga una sola comisión al año y hay menos bajas. Además funciona mejor con OXXO o transferencia, que no se cobran solos cada mes.

## 3. Costos

**Fijos al mes (supuesto: 1 USD = 18.5 MXN)**

| Concepto | MXN al mes |
|---|---|
| Supabase Pro ($25 USD; 100 mil usuarios activos, 8 GB de base de datos, 100 GB de archivos) | ~$465 |
| Hostinger (hosting y correo) | ~$100 |
| Dominio y extras | ~$35 |
| Colchón (herramientas, picos de uso) | ~$300 |
| **Total** | **~$900** |

**Variables, por cobro**
- Stripe México: 3.6 % + $3 por tarjeta nacional, más 0.7 % de Billing (suscripciones), más IVA sobre la comisión. En un plan de $199 eso es unos $13.4 (~6.7 %).
- IA de foto/PDF → cifrado: ~$0.0007 USD por página con Claude Haiku y ~$0.014 con Claude Sonnet. Aun con 100 páginas al mes en Sonnet, son unos $26 MXN por ministerio Pro.

**Lo que queda por ministerio al mes** (después de IVA, comisión e IA)

| Plan | Pago mensual | Pago anual (por mes) |
|---|---|---|
| Básico | ~$158 | ~$134 |
| Pro | ~$254 | ~$210 |
| Persona extra | ~$15 (Básico) / ~$23 (Pro) | — |

## 4. ¿Cuántos ministerios para que sea rentable?

- **Para cubrir los servidores (~$900 al mes): 6 ministerios Básico o 4 Pro.**
- **Para pagar además ~$15,000 al mes de desarrollo y soporte**, con 60 % Básico y 40 % Pro y la mitad pagando anual (~$180 por ministerio al mes): **unos 90 ministerios de pago.**
- En apps como esta, normalmente entre 3 y 5 % de las cuentas gratis acaban pagando. Para llegar a 90 de pago harían falta unas **1,800 a 3,000 cuentas gratis**, o venta directa a parroquias, diócesis y colectivos (por ejemplo, un descuento por volumen al colectivo Tiempo de Dios).
- No se incluye el ISR (si se factura como persona física en RESICO es 1–2.5 % de lo cobrado) ni la publicidad.

## 5. Pendiente de confirmar

- Las tarifas exactas de OXXO y SPEI en Stripe, y la opción de Conekta.
- El precio actual de Planning Center, SongSelect y los planes de grupo de SongbookPro.
- Cuánto están dispuestos a pagar los ministerios en México: conviene preguntarles a 10–15 coordinadores antes de lanzar, por ejemplo con un precio de fundador de $149 el primer año.

Fuentes: worshiponline.com/pricing, loopcommunity.com, worshiptools.com, helpcenter.multitracks.com, onsongapp.com, App Store (Ultimate Guitar, Cifra Club), aciprensa.com (Canto App), stripe.com/mx/pricing, supabase.com/pricing, hostinger.com/mx y la documentación de precios de Anthropic.
