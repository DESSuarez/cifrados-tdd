# Manual de construcción · Cifrados TDD

Cómo está hecho el sistema. Actualízalo con cada cambio y agrega la entrada en la bitácora del final.

## Archivos
- `app/index.html`: toda la interfaz (HTML, CSS y JS sin framework, igual que la Bitácora TDD). Rutas por hash: `#libreria`, `#cancion/<id>`, `#cancion/<id>/set/<set>/<n>` (en vivo), `#sets`, `#set/<id>`, `#nueva`, `#editar/<id>`, `#senas`, `#ministerios`, `#amigos`, `#persona/<id>` (`#persona/yo` = mis tonos), `#ajustes`.
- `app/cifrado.js` (`window.CIF`): motor sin dependencias. Lee ChordPro (`leer`), pinta HTML (`aHTML`), transporta (`transportaAcorde`, `distancia`), Nashville (sobre el acorde ya transportado), notación latina, silabeo del español (`silabas`), ajuste de acordes a sílaba (`ajustarASilabas`), conversión de «acordes arriba» (`deAcordesArriba`), tono de SongbookPro (`tonoDeSbp`), detección de tono (`adivinaTono`) y orden de secciones (`ordenar`: si hay dos secciones con el mismo nombre, cada mención usa la suya en ciclo). Pruebas: `node test/cifrado.test.js`.
- `app/datos.js` (`window.DATOS`): datos locales primero. IndexedDB `cifrados-tdd` (versión 3) con una tienda por tabla, `_salida` (cambios por subir), `_meta` y `_audio` (pistas descargadas). Con Supabase: sube la bandeja, baja lo nuevo desde `ultima` (las tablas chicas `CHICAS` se bajan completas) y escucha `postgres_changes`. Gana el `actualizado` más reciente. `actualizado_por` solo en `CON_AUTOR` (canciones, sets, pistas). `canalVivo(set)` usa Realtime Broadcast para «Dirigir / Seguir».
- `app/senas.js`: `SENAS` (manual de señas) y `SENAS_FOTO` (foto oficial con recortes por seña).
- `app/sw.js`: service worker; guarda la app y las librerías de CDN para abrir sin internet. **Sube `VERSION` cuando cambie cualquier archivo** (va en `cifrados-v2`).
- `app/config.publico.js`: `CIFRADOS_CONFIG {supabaseUrl, supabaseAnonKey}`. Vacío = modo local.
- `supabase/schema.sql`: tablas `cif_*`, RLS, realtime y bucket `cif-tracks`. Idempotente; la sección «Versión 2» agrega `usuario`, `suscripcion_hasta`, `cif_sets.tipo`, `cif_solicitudes`, `cif_amistades`, `cif_suscrito()` y `cif_buscar_persona(q)`.

## Librería
Tres pestañas (`grupoDe`): **Tiempo de Dios** (autor contiene «Tiempo de Dios», `esTDD`; va primero), **Otras canciones** y **Litúrgicas** (etiqueta «Litúrgica» o título que empieza con «Misa», `esLiturgica`; agrupadas por momento con `momentoDe`). Filtros: artista, tono, ★ con mi tono, ♫ con pista y etiquetas (una canción puede tener varias; el filtro muestra las que tengan cualquiera de las elegidas). Las etiquetas se editan en el constructor (`etiquetasHTML`, sugerencias `ETIQUETAS_SUG`).

## Vista de canción
- Tono sin flecha nativa (`.tonobox select`, `appearance:none`).
- Notación única (`st.estilo.notacion`: `americano` | `latino` | `nashville`, `opNotacion()`); «Letra» es aparte (solo letra).
- Auto-desplazamiento con velocidad 1–20 ahí mismo (`nivelVel`, `cambiarVel`; también + y − en el teclado).
- **Barra de tonos arriba** (`.tonosbar`): Original, los tonos de mi ministerio, mis amigos y yo; los demás en «Otros». Tocar uno pone su tono y capo. «★ Este es mi tono» guarda en `cif_tonos` (queda en el perfil: `#persona/yo`). Admins: «Guardar para…».

## Sets
- `cif_sets.tipo`: `normal` o `liturgico`. La misa se arma por `MOMENTOS` (Entrada, Piedad, Gloria, Aleluya, Ofertorio, Santo, Cordero, Comunión, Salida); cada canción guarda `momento` y se inserta en orden litúrgico. `elegirCancion(momento)` propone primero las del momento.
- Estructura en bloques por canción del set (`item.estructura`, `bloquesDe`): arrastrar (pointer events, mouse y dedo), duplicar, quitar, agregar sección y «Como la canción». Se guarda en el set y llega a todos en tiempo real; la vista en vivo la usa como orden.

## Ministerios, amigos y suscripción
- Solo el desarrollador (`superadmin`) crea ministerios y pone `suscripcion_hasta`.
- Cualquiera pide entrar (`cif_solicitudes`); un admin del ministerio acepta (crea `cif_miembros` como músico) o rechaza. Ya no hay código de unión (`cif_unirse` se borró).
- Amigos (`cif_amistades`, pendiente → aceptada): se buscan por @usuario, nombre o correo exacto con la RPC `cif_buscar_persona` (no expone correos). Sus tonos salen en la barra de tonos y en `#persona/<id>`.
- Suscripción (`suscrito()` en la app, `cif_suscrito()` en SQL): exportar e importar (respaldo .json, .sbp, ChordPro) solo con un ministerio vigente. En SQL, dar de alta canciones también lo exige. El cobro todavía no existe: el desarrollador pone la fecha a mano.

## Cómo se pinta un acorde exactamente sobre su sílaba
Cada línea se parte en palabras (`.cw`, no se separan al hacer salto de línea) y cada palabra en pedazos (`.cp`) que empiezan donde hay acorde. Cada pedazo es una columna: arriba el acorde (`.ca-row`), abajo la letra (`.cly`). Así el borde izquierdo del acorde coincide con la primera letra de la sílaba (verificado: Δx = 0 px). Si el acorde es más ancho que la sílaba, empuja la letra en vez de encimarse.

## Permisos
- `superadmin` (en `cif_perfiles`): crea ministerios y activa suscripciones. El primero se pone a mano en SQL.
- Por ministerio (`cif_miembros.rol`): `admin` (acepta solicitudes, integrantes y roles), `musico` (edita librería y sets), `lector` (solo ve).
- Librería, tonos y pistas: los ven todas las cuentas. Sets: solo su ministerio. Amistades: solo las dos personas.

## Pistas
`Tone.GrainPlayer` (Tone.js 14.8.49 desde cdnjs, se carga al abrir la primera pista). `detune = semitonos × 100` cambia el tono sin cambiar la velocidad; `playbackRate` cambia la velocidad. Con «Seguir el tono de la canción», los semitonos = distancia entre el tono en que está grabada la pista y el tono que se está viendo. Las pistas viven en el bucket `cif-tracks` y las ve cualquier cuenta.

## Bitácora de cambios
- 2026-11-19 · Primera versión: librería, importador .sbp/.cho/.txt, vista con transporte/capo/Nashville/Do-Re-Mi, tonos por artista, sets por ministerio en tiempo real con Dirigir/Seguir, constructor por sílabas, pistas con cambio de tono, señas animadas, modo sin internet · todo el repo.
- 2026-11-19 · Versión 2: selector de tono sin flecha; notación única; velocidad del auto-desplazamiento en la barra; tonos arriba con ministerio y amigos; librería con pestañas TDD / otras / litúrgicas y filtros; etiquetas en el constructor; misa por momentos; estructura en bloques por set; solicitudes a ministerios; amigos y `#persona`; respaldo e importación con suscripción; arreglos: Nashville transportado y secciones repetidas · `index.html`, `cifrado.js`, `datos.js`, `schema.sql`, `sw.js`.
