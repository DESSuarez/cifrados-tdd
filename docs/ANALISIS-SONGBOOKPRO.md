# Análisis de la exportación de SongbookPro

Archivo revisado: `Exportacion SongbookPro.sbp` (19 nov 2026). Es un ZIP con `dataFile.txt` (versión `1.0` + JSON) y `dataFile.hash`.
Trae **157 canciones**, **0 sets** y **0 carpetas**.

## Qué funciona (y se conservó)

| De SongbookPro | En Cifrados TDD |
|---|---|
| Formato **ChordPro** (`[G]` dentro de la letra, `{c: Coro}`) | Mismo formato: importa y exporta sin pérdidas |
| Marcas `[-]`, `[/]`, `[|]` de ritmo y `[*x2]` de anotación | Se respetan: no se transportan y se ven en gris |
| Transporte por semitonos, capo | Igual, más bemoles o sostenidos según el tono destino |
| Tono como número (`key`: 0 = A … 11 = Ab, +12 = menor) | Se convierte a nombre (`D`, `Em`…) al importar |
| Secciones con color | Colores de la marca TDD por tipo de sección |

## Qué no funciona tan chido (y cómo se resolvió)

1. **Acordes a media sílaba.** En **150 de 157** canciones hay acordes que caen dentro de la sílaba: `q[G]uitas`, `volunt[D]ad`, `t[Bm]odo`. En pantalla el acorde queda corrido una o dos letras.
   → Al importar, cada acorde se mueve al **inicio de su sílaba** (silabeo del español: `[G]quitas`, `volun[D]tad`, `[Bm]todo`). El constructor solo deja poner acordes tocando una sílaba, así ya no puede pasar.
2. **El tono de cada persona escrito a mano en la letra:** `Tono Willy: A | Tono Caro, Karla: G`. No se puede buscar ni aplicar, y cada quien lo reescribe.
   → Tabla `cif_tonos`: cada artista guarda su tono (y capo) por canción con un botón. Se sincroniza para todos y al elegir quién dirige en un set se pone su tono solo.
3. **Canciones duplicadas por versión o tono** (`Aquí Estoy` ×3, `Cristo Reina` ×2, `Rey de Poder` ×2…). Con el tono por persona ya no hace falta duplicar.
4. **BPM dentro de la letra** (`BPM: 142`) aunque existe el campo `TempoInt` (solo 8 canciones lo usan). → Se extrae a `bpm` y la línea sale de la letra.
5. **Coros copiados completos** (`Coro`, `Coro 2`, …) porque `SectionOrder` está vacío en las 157. → «Orden de secciones»: se escribe una vez y se repite en el orden que se canta.
6. **Alineación con espacios** (`[Bm]   [-]  [G]`): depende de la fuente y se rompe en el celular. → Cada acorde va pegado a su sílaba en un bloque que no se separa; las líneas se acomodan solas al ancho.
7. **`KeyShift` por dispositivo** (75 canciones con transporte guardado solo en ese iPad): nadie más lo ve. → El tono se guarda por persona en la nube.
8. **Carpetas, etiquetas y sets vacíos** en la exportación: no hay organización compartida. → Sets por ministerio en tiempo real y etiquetas en la canción.
9. **Copiar texto de sitios con acordes arriba** obliga a reescribir. → Al pegar en el constructor se convierte solo a ChordPro y se ajusta a la sílaba.
10. **Pistas:** `LinkedAudio` está vacío en todas. → Pistas en la nube por canción, con cambio de tono sin cambiar la velocidad y caché sin internet.

## Datos curiosos de la librería
- Tonos más usados: D (30), G (28), C (23), E (18), A (15).
- 18 canciones usan capo; 1 tiene liga de Spotify.
- 557 marcas `[-]`, 169 `[/]`, 67 `[|]` y 38 `[*x2]`.
