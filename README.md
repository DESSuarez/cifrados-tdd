# Cifrados · Tiempo de Dios

Librería de cifrados para todos los ministerios: transporte, tono por artista, sets en tiempo real, pistas con cambio de tono, constructor por sílabas y manual de señas. Funciona sin internet.

## Poner en marcha
1. **Supabase:** corre `supabase/schema.sql` en SQL Editor (puede ser el mismo proyecto de la Bitácora: todo lleva prefijo `cif_`). Luego, con tu correo:
   ```sql
   update cif_perfiles set superadmin = true where id = (select id from auth.users where email = 'tu-correo@tiempodedios.mx');
   ```
2. **Config:** llena `app/config.publico.js` con la URL y la anon key.
3. **Hostinger:** conecta el repo (igual que la Bitácora). El `.htaccess` sirve solo `app/`.
4. Entra, crea el ministerio (p. ej. Kairós) y ponle «Suscripción hasta» en Ministerios. Importa tu `.sbp` desde Librería → Importar. Los integrantes crean su cuenta, piden entrar al ministerio y un admin los acepta.

## Probar local
```bash
cd app && python3 -m http.server 8000
```
Pruebas del motor: `node test/cifrado.test.js`.
