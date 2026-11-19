# Cifrados · Tiempo de Dios

Librería de cifrados para todos los ministerios: transporte, tono por artista, sets en tiempo real, pistas con cambio de tono, constructor por sílabas y manual de señas. Funciona sin internet.

Producción: https://cifrados.tiempodedios.mx · Supabase: proyecto propio `cifrados-tdd` (separado de la Bitácora para no mezclar cuentas).

## Poner en marcha
1. **Esquema:** corre `supabase/schema.sql` completo en **SQL Editor** (se puede volver a correr). Luego, con tu correo:
   ```sql
   update cif_perfiles set superadmin = true where id = (select id from auth.users where email = 'tu-correo@tiempodedios.mx');
   ```
2. **Config:** llena `app/config.publico.js` con la URL y la clave **anon public** (Project Settings → API Keys). Nunca la `service_role`.
3. **Hostinger:** se despliega solo con GitHub Actions por FTP (`.github/workflows/desplegar.yml`) en cada push a `main`. Secretos del repo: `FTP_SERVIDOR`, `FTP_USUARIO`, `FTP_CONTRASENA`.
4. **URL del sitio en Supabase:** Authentication → **URL Configuration** → Site URL `https://cifrados.tiempodedios.mx` y agrégalo también en **Redirect URLs**. Sin esto, las ligas de los correos llevan a `localhost`.
5. Entra, crea el ministerio (p. ej. Kairós) y ponle «Suscripción hasta» en Ministerios. Importa tu `.sbp` desde Librería → Importar.

## Panel de usuarios (función `usuarios`)
El desarrollador administra todas las cuentas en **Usuarios** (invitar, crear con contraseña, reenviar, borrar, hacer desarrollador, asignar ministerios). Los admins de cada ministerio invitan por correo desde **Ministerios**.

Despliégala una vez (y otra cada que cambie `supabase/functions/usuarios/index.ts`):
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Nómbrala exactamente `usuarios`.
3. Borra el código de ejemplo, pega todo `supabase/functions/usuarios/index.ts` y toca **Deploy**.
4. En la función → **Details** → apaga **Verify JWT** (la función revisa la sesión ella misma) y guarda.

Las cuentas dadas de alta a mano en **Authentication → Users → Add user** también funcionan: el trigger `cif_perfil_nuevo` les crea su perfil y aparecen en el panel. Agrégalas a su ministerio desde **Usuarios**.

## Correos (SMTP de Hostinger)
El correo integrado de Supabase solo manda unos pocos por hora: para invitaciones y recuperar contraseña hay que poner el SMTP propio.
1. **Hostinger → Correos:** crea el buzón `cifrados@tiempodedios.mx` (o usa `bitacora@tiempodedios.mx`).
2. **Supabase → Authentication → Emails → SMTP Settings:** activa *Enable custom SMTP*.
   - Sender email: `cifrados@tiempodedios.mx` · Sender name: `Cifrados Tiempo de Dios`
   - Host: `smtp.hostinger.com` · Port: `465` · Username: el correo completo · Password: la del buzón
3. **Authentication → Rate Limits:** sube «emails sent per hour» a ~30.
4. **Plantillas:** copia las de `supabase/correos/` (ver su README).
5. **Avisos de ministerios** (alguien pidió entrar, solicitud aceptada/rechazada): Edge Functions → **Secrets** → agrega `SMTP_USER` (el correo) y `SMTP_PASS` (su contraseña). Sin estos secretos todo funciona, solo no se mandan esos avisos.

## Probar local
```bash
cd app && python3 -m http.server 8000
```
Sin clave en `config.publico.js` corre en modo local (un solo navegador, sin cuentas). Pruebas del motor: `node test/cifrado.test.js`.
