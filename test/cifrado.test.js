// Pruebas del motor: node test/cifrado.test.js
const C = require("../app/cifrado.js");
let fallas = 0;
const igual = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fallas++; console.log("✗", msg, "\n   esperado:", b, "\n   obtenido:", a); } else console.log("✓", msg); };

// Sílabas
const casos = { quitas: "qui-tas", corazón: "co-ra-zón", voluntad: "vo-lun-tad", perdona: "per-do-na", estoy: "es-toy", instante: "ins-tan-te",
  cuidado: "cui-da-do", poeta: "po-e-ta", día: "dí-a", aleluya: "a-le-lu-ya", guerra: "gue-rra", pueblo: "pue-blo", siempre: "siem-pre",
  abrazo: "a-bra-zo", Jesús: "Je-sús", hoy: "hoy", Espíritu: "Es-pí-ri-tu", llamaste: "lla-mas-te", obstáculo: "obs-tá-cu-lo", trono: "tro-no",
  ahora: "a-ho-ra", acércame: "a-cér-ca-me", Dios: "Dios", rey: "rey", reyes: "re-yes", aguijón: "a-gui-jón", construir: "cons-truir" };
for (const [w, s] of Object.entries(casos)) igual(C.silabas(w).join("-"), s, "sílabas " + w);

// Ajuste a sílaba
igual(C.ajustarLinea("A veces [Bm]das y a veces q[G]uitas, tu volunt[D]ad puede dol[A]er"),
  "A veces [Bm]das y a veces [G]quitas, tu volun[D]tad puede do[A]ler", "ajuste línea 1");
igual(C.ajustarLinea("¿Cómo es que t[Bm]odo sigue ob[G]rando"), "¿Cómo es que [Bm]todo sigue o[G]brando", "ajuste línea 2");
igual(C.ajustarLinea("Yo[D/F#] se, no hay"), "Yo[D/F#] se, no hay", "acorde al final de palabra no se mueve");
igual(C.ajustarLinea("[Bm]   [-]  [G]"), "[Bm]   [-]  [G]", "línea de solo acordes");

// Tonos
igual(C.tonoDeSbp(5), "D", "sbp 5 = D");
igual(C.tonoDeSbp(22), "Em", "sbp 22 = Em");
igual(C.tonoDeSbp(15), "Am", "sbp 15 = Am");
igual(C.tonoDeSbp(6), "Eb", "sbp 6 = Eb");
igual(C.distancia("D", "Bb"), 4 - 8 + 0 === 0 ? 0 : -4, "D → Bb = −4");
igual(C.transportaAcorde("A/C#", 1, true), "Bb/D", "transporta con bemoles");
igual(C.transportaAcorde("F#m7", -2, false), "Em7", "transporta menor 7");
igual(C.nashville("A/C#", "D"), "5/7", "nashville");
igual(C.esAcorde("Asus"), true, "Asus es acorde");
igual(C.esAcorde("Aaa"), false, "Aaa no es acorde");

// Acordes arriba
igual(C.deAcordesArriba("G       D\nPerfume a tus pies"), "[G]Perfume [D]a tus pies", "acordes arriba");
igual(C.deAcordesArriba("  G       Am\nTraigo mi perfume"), "[G]Traigo mi [Am]perfume", "acordes arriba: el acorde se pega al inicio de su sílaba");
igual(C.deAcordesArriba("G        D\nPerfume a tus pies"), "[G]Perfume a [D]tus pies", "acorde sobre espacio va a la palabra siguiente");
igual(C.adivinaTono("[Bm]das [G]quitas [D]bien [A]doler [D]fin"), "D", "adivina tono D");

// Nashville con transporte: G D A Bm en D, vistos en E → 4 1 5 6m
igual([...C.aHTML("[G]a [D]b [A]c [Bm]d",{semis:2,tonoFinal:"E",nashville:true}).matchAll(/class="ck">([^<]+)/g)].map(m=>m[1]), ["4","1","5","6m"], "nashville transportado");

// Orden con secciones repetidas
const sec = h => [...h.matchAll(/class="csn"[^>]*>([^<]+)/g)].map(m=>m[1]);
igual(sec(C.aHTML("{c: Coro}\nA\n{c: Verso}\nB\n{c: Coro}\nC",{orden:["Coro","Verso","Coro","Coro"]})), ["Coro","Verso","Coro","Coro"], "orden con dos coros");
igual((C.aHTML("{c: Coro}\nA\n{c: Coro}\nC",{orden:["Coro","Coro"]}).match(/>C</g)||[]).length, 1, "el 2.º coro usa su propia letra");

console.log(fallas ? `\n${fallas} fallas` : "\nTodo bien");
process.exit(fallas ? 1 : 0);
