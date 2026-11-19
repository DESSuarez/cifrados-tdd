/* Manual de señas para dirigir (una sola fuente para que todo el equipo use las mismas).
   Cada seña: {id, nombre, cuando, como, mano (emoji provisional), letra (marca grande), mov (animación), sec (color de sección)}
   mov: pulso · subir · bajar · girar · arco · cortar · toque · contar · lado · quieto
   Cuando llegue la fotografía oficial: pon el archivo en app/senas/ y llena SENAS_FOTO.
   Cada seña puede usar un recorte de la foto ({x,y,w,h} en % de la imagen) y la app la anima con el mismo movimiento. */
window.SENAS = [
  { id: "verso", nombre: "Verso", letra: "V", mano: "✌️", mov: "contar", sec: "--sea",
    cuando: "Para entrar a un verso.", como: "Muestra cuántos dedos = número de verso (1, 2, 3) frente al pecho, a la altura del hombro." },
  { id: "precoro", nombre: "Pre-coro", letra: "PC", mano: "👉", mov: "subir", sec: "--sol",
    cuando: "Antes del coro, para empezar a crecer.", como: "Índice apuntando al frente y súbelo en diagonal, como una rampa." },
  { id: "coro", nombre: "Coro", letra: "C", mano: "🤏", mov: "pulso", sec: "--flame",
    cuando: "Para ir al coro.", como: "Mano en forma de «C» a la altura de la cara. Marca dos veces." },
  { id: "puente", nombre: "Puente", letra: "P", mano: "🖐️", mov: "arco", sec: "--lav",
    cuando: "Para ir al puente.", como: "Mano plana, palma hacia abajo, dibuja un arco de izquierda a derecha (un puente)." },
  { id: "instrumental", nombre: "Instrumental", letra: "I", mano: "🎹", mov: "lado", sec: "--baby-ink",
    cuando: "Para un interludio o solo instrumental.", como: "Dedos como tocando teclas al aire, de lado a lado." },
  { id: "tag", nombre: "Tag (repetir la última frase)", letra: "T", mano: "🤙", mov: "girar", sec: "--rosa",
    cuando: "Repetir solo la última línea.", como: "Mano en «teléfono» girando junto a la oreja." },
  { id: "repetir", nombre: "Repetir", letra: "×2", mano: "☝️", mov: "girar", sec: "--muted",
    cuando: "Repetir la sección en la que estamos.", como: "Índice hacia arriba dibujando círculos. Con dedos extra: cuántas veces." },
  { id: "inicio", nombre: "Desde arriba", letra: "↑", mano: "☝️", mov: "toque", sec: "--muted",
    cuando: "Volver al inicio de la canción.", como: "Toca la parte de arriba de tu cabeza con el índice." },
  { id: "subir", nombre: "Subir intensidad", letra: "+", mano: "🫴", mov: "subir", sec: "--flame",
    cuando: "Que todos crezcan (más fuerte, más lleno).", como: "Palma hacia arriba, sube lento. Qué tan alto = cuánto crecer." },
  { id: "bajar", nombre: "Bajar intensidad", letra: "−", mano: "🫳", mov: "bajar", sec: "--sea",
    cuando: "Bajar volumen y energía.", como: "Palma hacia abajo, baja lento, como calmando." },
  { id: "voces", nombre: "Solo voces", letra: "🎤", mano: "👄", mov: "pulso", sec: "--sol",
    cuando: "A capella: la banda se detiene y cantan las voces.", como: "Señala tu boca con dos dedos y luego abre la mano hacia la congregación." },
  { id: "modula", nombre: "Subir de tono", letra: "♯", mano: "👍", mov: "subir", sec: "--lav",
    cuando: "Modulación: el siguiente coro medio tono o un tono arriba.", como: "Pulgar arriba y súbelo. Un dedo extra = un tono completo." },
  { id: "ultima", nombre: "Última vez", letra: "1", mano: "✊", mov: "pulso", sec: "--rosa",
    cuando: "Esta es la última vez de la sección.", como: "Puño cerrado arriba de la cabeza." },
  { id: "final", nombre: "Final / cortar", letra: "■", mano: "✋", mov: "cortar", sec: "--flame",
    cuando: "Terminar todos juntos.", como: "Mano abierta arriba y ciérrala en puño de golpe en el último tiempo." },
  { id: "vamp", nombre: "Mantener (vamp)", letra: "∞", mano: "✋", mov: "quieto", sec: "--baby-ink",
    cuando: "Quedarse en el mismo acorde o progresión hasta nueva seña.", como: "Mano abierta quieta al frente, palma hacia el equipo." },
];

/* Foto oficial de señas. Ejemplo:
   window.SENAS_FOTO = { src: "senas/senas.jpg", regiones: { coro: {x:0, y:0, w:33, h:50}, verso: {x:33, y:0, w:33, h:50} } }; */
window.SENAS_FOTO = null;
