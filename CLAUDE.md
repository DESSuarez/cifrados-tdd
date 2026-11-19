# CLAUDE.md · Cifrados Tiempo de Dios

Todo en español: interfaz, textos, commits y comentarios. Hermana de la Bitácora TDD (`../bitacora-tdd`): **mismo diseño, colores y tipografías** (Night, Flame, Baby blue, Deep sea green, Sol, Lavanda, Rosa; Archivo e IBM Plex Mono). No inventes colores.

**Manual:** `docs/MANUAL.md`. Actualízalo con cada cambio (sección + entrada en la bitácora). El análisis de SongbookPro está en `docs/ANALISIS-SONGBOOKPRO.md`.

## Propósito
Librería de cifrados compartida por todos los ministerios de Tiempo de Dios: transporte sin errores, tono guardado por artista, sets por ministerio en tiempo real, pistas con cambio de tono, constructor sencillo con acordes exactos sobre la sílaba, manual de señas y funcionamiento sin internet.

## Reglas
- Sin build: HTML/CSS/JS plano, librerías por CDN con versión fija (supabase-js 2.45.4, Tone.js 14.8.49, JSZip 3.10.1).
- Formato de canción: ChordPro (compatible con SongbookPro).
- Toda escritura pasa por `DATOS.guardar/borrar` (local + bandeja de salida). Nunca escribir directo a Supabase desde la UI.
- Cambios a `cifrado.js` → correr `node test/cifrado.test.js`.
- Cambios a cualquier archivo de `app/` → subir `VERSION` en `app/sw.js`.

## Probar
`cd app && python3 -m http.server 8000`. Sin `config.publico.js` lleno corre en modo local (IndexedDB).

## Despliegue (pendiente)
Hostinger con `.htaccess` que sirve solo `app/` (igual que la Bitácora). Sugerido: `cifrados.tiempodedios.mx`. Después: Capacitor para Mac y iPhone con el mismo código.
