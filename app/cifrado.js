/* Motor de cifrados (sin dependencias). Lo usan la app (window.CIF) y las pruebas en Node (module.exports).
   Formato de las canciones: ChordPro, igual que SongbookPro, para poder importar y exportar sin pérdidas:
     {c: Coro}            sección
     A veces [Bm]das      acorde justo antes de la sílaba donde suena
     [-] [/] [|]          marcas de ritmo (no se transportan)
     [*x2]                anotación encima de la letra (no se transporta); [*Bm] es un acorde con acento
     {sot} … {eot}        tablatura o texto en monoespaciado
*/
(function (root) {
  "use strict";

  // ---------- Notas y tonos ----------
  const SOST = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const BEM = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // Tonos que se escriben con bemoles (mayores y menores)
  const TONOS_BEMOL = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);
  // Nombre "bonito" de cada tono: cómo se escribe normalmente
  const MAYORES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const MENORES = ["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
  const TONOS = MAYORES.concat(MENORES);

  function notaIdx(n) {
    if (!n) return -1;
    const b = IDX[n[0].toUpperCase()];
    if (b === undefined) return -1;
    let i = b;
    for (const a of n.slice(1)) { if (a === "#" || a === "♯") i++; else if (a === "b" || a === "♭") i--; }
    return (i + 12) % 12;
  }
  /** "Bbm" → {idx:10, menor:true} */
  function tonoInfo(t) {
    const m = /^([A-G][#b♯♭]?)(m?)$/.exec(String(t || "").trim());
    if (!m) return null;
    return { idx: notaIdx(m[1]), menor: !!m[2] };
  }
  function nombreTono(idx, menor) { return (menor ? MENORES : MAYORES)[((idx % 12) + 12) % 12]; }
  function transportaTono(t, semis) {
    const i = tonoInfo(t);
    return i ? nombreTono(i.idx + semis, i.menor) : t;
  }
  /** Semitonos para ir del tono a al tono b (−5…+6, el camino más corto). */
  function distancia(a, b) {
    const x = tonoInfo(a), y = tonoInfo(b);
    if (!x || !y) return 0;
    let d = ((y.idx - x.idx) % 12 + 12) % 12;
    if (d > 6) d -= 12;
    return d;
  }
  function usaBemoles(tono) { return TONOS_BEMOL.has(tono); }

  /** SongbookPro guarda el tono como número: 0 = A … 11 = Ab; +12 = menor relativo. */
  function tonoDeSbp(k) {
    if (typeof k !== "number" || k < 0) return "";
    const mayor = (9 + (k % 12)) % 12; // 0 → A (9 en base C)
    return k >= 12 ? nombreTono(mayor - 3, true) : nombreTono(mayor, false);
  }

  // ---------- Acordes ----------
  const RE_ACORDE = /^([A-G][#b♯♭]?)([^/\s]*)(?:\/([A-G][#b♯♭]?))?$/;
  const RITMO = new Set(["-", "/", "//", "|", "||", "%", "x"]);

  function esAcorde(s) {
    const m = RE_ACORDE.exec(s);
    if (!m) return false;
    // la "calidad" solo puede traer cosas de acorde: m, maj, sus, add, dim, aug, números, (), +, -, º, ø, #, b
    return /^(m|maj|min|M|sus|add|dim|aug|no|omit|alt|[0-9]|[()+\-º°øΔ#b♯♭,])*$/i.test(m[2]);
  }
  function transportaNota(n, semis, bemoles) {
    const i = notaIdx(n);
    if (i < 0) return n;
    const j = ((i + semis) % 12 + 12) % 12;
    return (bemoles ? BEM : SOST)[j];
  }
  function transportaAcorde(ac, semis, bemoles) {
    const m = RE_ACORDE.exec(ac);
    if (!m) return ac;
    let s = transportaNota(m[1], semis, bemoles) + m[2];
    if (m[3]) s += "/" + transportaNota(m[3], semis, bemoles);
    return s;
  }
  // Números (Nashville): grado del acorde respecto al tono
  const GRADOS = ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"];
  function nashville(ac, tono) {
    const t = tonoInfo(tono), m = RE_ACORDE.exec(ac);
    if (!t || !m) return ac;
    const base = t.menor ? (t.idx + 3) % 12 : t.idx; // en menor se cuenta desde el relativo mayor
    const g = n => GRADOS[((notaIdx(n) - base) % 12 + 12) % 12];
    let s = g(m[1]) + m[2];
    if (m[3]) s += "/" + g(m[3]);
    return s;
  }

  // Notación latina (Do, Re, Mi…) solo para mostrar
  const LAT = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
  function latina(ac) {
    const m = RE_ACORDE.exec(ac);
    if (!m) return ac;
    const n = x => LAT[x[0]] + x.slice(1);
    return n(m[1]) + m[2] + (m[3] ? "/" + n(m[3]) : "");
  }

  /** Acordes del tono, para la paleta del constructor. */
  function acordesDelTono(tono) {
    const t = tonoInfo(tono) || { idx: 0, menor: false };
    const b = usaBemoles(tono);
    const n = s => (b ? BEM : SOST)[((t.idx + s) % 12 + 12) % 12];
    if (t.menor) return [n(0) + "m", n(2) + "dim", n(3), n(5) + "m", n(7) + "m", n(7), n(8), n(10)];
    return [n(0), n(2) + "m", n(4) + "m", n(5), n(7), n(9) + "m", n(10), n(7) + "/" + n(11), n(0) + "/" + n(4), n(5) + "/" + n(9), n(2), n(4), n(7) + "sus4", n(0) + "sus2"];
  }

  // ---------- Sílabas en español ----------
  const VOC = "aeiouáéíóúüàèìòùAEIOUÁÉÍÓÚÜÀÈÌÒÙ";
  const FUERTE = "aeoáéíóúAEOÁÉÍÓÚàèòìùÀÈÒÌÙ"; // í y ú acentuadas rompen el diptongo
  const INSEP = new Set(["pl", "bl", "fl", "cl", "gl", "kl", "pr", "br", "fr", "cr", "gr", "kr", "tr", "dr", "tl"]);
  const esVoc = c => VOC.includes(c);
  const esLetra = c => /\p{L}/u.test(c);

  /** Parte una palabra en sílabas. "quitas" → ["qui","tas"], "corazón" → ["co","ra","zón"]. */
  function silabas(palabra) {
    const w = palabra;
    if (!w) return [];
    // 1) unidades: dígrafos ch, ll, rr; qu/gu antes de e/i cuentan como consonante
    const U = [];
    for (let i = 0; i < w.length;) {
      const c = w[i], l = c.toLowerCase(), d = w.substr(i, 2).toLowerCase();
      if (!esLetra(c)) { U.push({ s: c, v: false, x: true }); i++; continue; }
      if (d === "ch" || d === "ll" || d === "rr") { U.push({ s: w.substr(i, 2), v: false }); i += 2; continue; }
      if ((l === "q" || l === "g") && (w[i + 1] || "").toLowerCase() === "u" && "eiéí".includes((w[i + 2] || "").toLowerCase())) {
        U.push({ s: w.substr(i, 2), v: false }); i += 2; continue;
      }
      if (l === "y") { // vocal si no le sigue vocal (rey, hoy, y)
        const sig = w[i + 1];
        U.push({ s: c, v: !(sig && esVoc(sig)), f: false }); i++; continue;
      }
      U.push({ s: c, v: esVoc(c), f: FUERTE.includes(c) }); i++;
    }
    // 2) núcleos: vocales seguidas forman uno, salvo dos fuertes (hiato)
    const nucleos = []; // [inicio, fin] en índices de U
    for (let i = 0; i < U.length; i++) {
      if (!U[i].v) continue;
      let j = i;
      while (j + 1 < U.length && U[j + 1].v && !(U[j].f && U[j + 1].f)) j++;
      nucleos.push([i, j]);
      i = j;
    }
    if (nucleos.length < 2) return [w];
    // 3) dónde cortar entre dos núcleos según las consonantes de en medio
    const cortes = [];
    for (let k = 0; k < nucleos.length - 1; k++) {
      const a = nucleos[k][1] + 1, b = nucleos[k + 1][0]; // consonantes en [a, b)
      const cons = U.slice(a, b);
      const n = cons.length;
      let c;
      const par = (x, y) => INSEP.has((cons[x].s + cons[y].s).toLowerCase());
      if (n === 0) c = a;
      else if (n === 1) c = a;
      else if (n === 2) c = par(0, 1) ? a : a + 1;
      else if (n === 3) c = par(1, 2) ? a + 1 : a + 2;
      else c = par(n - 2, n - 1) ? b - 2 : b - 1;
      cortes.push(c);
    }
    const out = [];
    let ini = 0;
    for (const c of cortes) { out.push(U.slice(ini, c).map(u => u.s).join("")); ini = c; }
    out.push(U.slice(ini).map(u => u.s).join(""));
    return out.filter(Boolean);
  }
  /** Posiciones (en caracteres) donde empieza cada sílaba de la palabra. */
  function iniciosSilaba(palabra) {
    const r = [];
    let p = 0;
    for (const s of silabas(palabra)) { r.push(p); p += s.length; }
    return r;
  }

  // ---------- Leer ChordPro ----------
  /** Convierte el texto en bloques: {t:"sec",nombre} {t:"lin",partes:[{ac,tx,tipo}]} {t:"vacia"} {t:"tab",lineas} {t:"nota",tx} */
  function leer(texto) {
    const out = [];
    const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
    let tab = null;
    for (const raw of lineas) {
      const lin = raw.replace(/\s+$/, "");
      const dir = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i.exec(lin);
      if (tab) {
        if (dir && /^(eot|end_of_tab)$/i.test(dir[1])) { out.push({ t: "tab", lineas: tab }); tab = null; }
        else tab.push(raw);
        continue;
      }
      if (dir) {
        const d = dir[1].toLowerCase(), v = dir[2] || "";
        if (d === "c" || d === "comment" || d === "ci" || d === "cb" || d === "section" || d === "soc" || d === "sov" || d === "sob") {
          const nombre = v || ({ soc: "Coro", sov: "Verso", sob: "Puente" }[d] || "");
          if (nombre) out.push({ t: "sec", nombre });
        } else if (d === "sot" || d === "start_of_tab") tab = [];
        else if (d === "t" || d === "title" || d === "st" || d === "subtitle" || d === "eoc" || d === "eov" || d === "eob") { /* metadatos: se ignoran aquí */ }
        else out.push({ t: "nota", tx: v || d });
        continue;
      }
      if (!lin.trim()) { out.push({ t: "vacia" }); continue; }
      out.push({ t: "lin", partes: partesDeLinea(lin) });
    }
    if (tab) out.push({ t: "tab", lineas: tab });
    // quita vacías repetidas
    return out.filter((b, i, a) => !(b.t === "vacia" && (i === 0 || a[i - 1].t === "vacia" || a[i - 1].t === "sec")));
  }
  function tipoMarca(s) {
    if (RITMO.has(s)) return "ritmo";
    if (s[0] === "*") { const r = s.slice(1); return esAcorde(r) ? "acento" : "anot"; }
    return esAcorde(s) ? "acorde" : "anot";
  }
  function partesDeLinea(lin) {
    const partes = [];
    const re = /\[([^\]]*)\]/g;
    let m, ult = 0, pend = null;
    while ((m = re.exec(lin))) {
      const tx = lin.slice(ult, m.index);
      if (pend || tx) partes.push({ ...(pend || { ac: "", tipo: "" }), tx });
      const s = m[1].trim();
      const tipo = tipoMarca(s);
      pend = { ac: tipo === "acento" || (tipo === "anot" && s[0] === "*") ? s.slice(1) : s, tipo };
      ult = re.lastIndex;
    }
    const resto = lin.slice(ult);
    if (pend || resto) partes.push({ ...(pend || { ac: "", tipo: "" }), tx: resto });
    return partes;
  }

  // ---------- Pegar acordes a la sílaba ----------
  /** Mueve cada acorde que cae a media sílaba al inicio de esa sílaba: "q[G]uitas" → "[G]quitas", "volunt[D]ad" → "volun[D]tad". */
  function ajustarASilabas(texto) {
    return String(texto || "").split("\n").map(ajustarLinea).join("\n");
  }
  function ajustarLinea(lin) {
    if (!/\[[^\]]+\][\p{L}]/u.test(lin) || /^\s*\{/.test(lin)) return lin;
    // separa letra pura y posiciones de los acordes
    let letra = "";
    const marcas = []; // {pos, s}
    const re = /\[([^\]]*)\]/g;
    let m, ult = 0;
    while ((m = re.exec(lin))) { letra += lin.slice(ult, m.index); marcas.push({ pos: letra.length, s: m[0] }); ult = re.lastIndex; }
    letra += lin.slice(ult);
    for (const mk of marcas) {
      const p = mk.pos;
      if (!esLetra(letra[p] || "") || !esLetra(letra[p - 1] || "")) continue; // no está dentro de una palabra
      let a = p, b = p;
      while (a > 0 && esLetra(letra[a - 1])) a--;
      while (b < letra.length && esLetra(letra[b])) b++;
      const palabra = letra.slice(a, b), rel = p - a;
      const ini = iniciosSilaba(palabra).filter(x => x <= rel).pop();
      mk.pos = a + (ini || 0);
    }
    let out = "", q = 0;
    marcas.forEach(mk => { out += letra.slice(q, mk.pos) + mk.s; q = mk.pos; });
    return out + letra.slice(q);
  }

  // ---------- Acordes arriba → ChordPro ----------
  /** Una línea es "de acordes" si casi todo lo que trae son acordes. */
  function esLineaAcordes(l) {
    const t = l.trim().split(/\s+/).filter(Boolean);
    if (!t.length) return false;
    const ok = t.filter(x => esAcorde(x.replace(/[()]/g, "")) || RITMO.has(x) || /^x\d$/i.test(x)).length;
    return ok / t.length >= 0.75;
  }
  /** Convierte el formato de páginas como LaCuerda (acordes en la línea de arriba) a ChordPro y pega cada acorde a su sílaba. */
  function deAcordesArriba(texto) {
    const L = String(texto || "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
    const out = [];
    const secRe = /^\s*\[?\s*(intro|verso|estrofa|pre-?coro|post-?coro|postcoro|coro|puente|instrumental|interludio|final|outro|tag|solo|precoro|bridge|chorus|verse)\b[^\]]*\]?\s*:?\s*$/i;
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      if (secRe.test(l)) { out.push("{c: " + l.trim().replace(/^\[|\]$|:$/g, "").trim() + "}"); continue; }
      if (esLineaAcordes(l)) {
        const sig = L[i + 1];
        const pos = [];
        const re = /\S+/g; let m;
        while ((m = re.exec(l))) pos.push({ p: m.index, s: m[0] });
        if (sig !== undefined && sig.trim() && !esLineaAcordes(sig) && !secRe.test(sig)) {
          let letra = sig.padEnd(Math.max(sig.length, (pos.length ? pos[pos.length - 1].p : 0)));
          // si el acorde cae en un espacio, se pega al inicio de la palabra siguiente
          pos.forEach(x => { if (/\s/.test(letra[x.p] || "") ) { let k = x.p; while (k < letra.length && /\s/.test(letra[k])) k++; if (k < letra.length) x.p = k; } });
          let res = "", q = 0;
          pos.forEach(x => { res += letra.slice(q, x.p) + "[" + x.s + "]"; q = x.p; });
          out.push(ajustarLinea((res + letra.slice(q)).replace(/\s+$/, "")));
          i++;
        } else {
          out.push(pos.map(x => "[" + x.s + "]").join("  "));
        }
        continue;
      }
      out.push(l);
    }
    return out.join("\n");
  }

  // ---------- Pintar en HTML ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /** Opciones: {semis, tonoFinal, nashville, soloLetra, orden:[nombres de sección]} */
  function aHTML(texto, op = {}) {
    const semis = op.semis || 0;
    const bem = usaBemoles(op.tonoFinal || "");
    const ver = ac => op.nashville ? nashville(transportaAcorde(ac, semis, bem), op.tonoFinal || "C") : op.latina ? latina(transportaAcorde(ac, semis, bem)) : transportaAcorde(ac, semis, bem);
    let bloques = leer(texto);
    if (op.orden && op.orden.length) bloques = ordenar(bloques, op.orden);
    let h = "", abierta = false;
    const cierra = () => { if (abierta) { h += "</section>"; abierta = false; } };
    for (const b of bloques) {
      if (b.t === "sec") {
        cierra();
        h += `<section class="csec" data-sec="${esc(b.nombre)}"><h3 class="csn" style="--sc:var(${colorSeccion(b.nombre)})">${esc(b.nombre)}</h3>`;
        abierta = true;
        continue;
      }
      if (!abierta) { h += `<section class="csec">`; abierta = true; }
      if (b.t === "vacia") { h += `<div class="cvac"></div>`; continue; }
      if (b.t === "nota") { h += `<p class="cnota">${esc(b.tx)}</p>`; continue; }
      if (b.t === "tab") { h += `<pre class="ctab">${esc(b.lineas.join("\n"))}</pre>`; continue; }
      const conAc = b.partes.some(p => p.ac);
      const soloAc = b.partes.every(p => !p.tx.trim());
      if (op.soloLetra) {
        const tx = b.partes.map(p => p.tx).join("").replace(/\s+/g, " ").trim();
        if (tx) h += `<div class="cl">${esc(tx)}</div>`;
        continue;
      }
      if (!conAc) { h += `<div class="cl">${esc(b.partes.map(p => p.tx).join(""))}</div>`; continue; }
      if (soloAc) {
        h += `<div class="cl cl-ac">` + b.partes.map(p => marca(p, ver, true)).join("") + `</div>`;
        continue;
      }
      h += `<div class="cl cl-con">${palabrasHTML(b.partes, ver)}</div>`;
    }
    cierra();
    return h;
  }
  function marca(p, ver, suelta) {
    if (!p.ac) return "";
    const cls = p.tipo === "ritmo" ? "ck cr" : p.tipo === "anot" ? "ck ca" : p.tipo === "acento" ? "ck cx" : "ck";
    const tx = p.tipo === "acorde" || p.tipo === "acento" ? ver(p.ac) : p.ac;
    return `<b class="${cls}${suelta ? " cs" : ""}">${esc(tx)}</b>`;
  }
  /** Cada palabra va en un bloque que no se parte; cada pedazo con acorde lleva el acorde justo encima. */
  function palabrasHTML(partes, ver) {
    // trocea en pedazos que terminan en espacio
    const piezas = [];
    partes.forEach(p => {
      const tr = p.tx.match(/[^\s]*\s*|$/g).filter((x, i, a) => x !== "" || (i === 0 && a.length <= 2));
      if (!tr.length) tr.push("");
      tr.forEach((t, i) => piezas.push({ ac: i === 0 ? p : null, tx: t }));
    });
    let h = "", palabra = "";
    const flush = () => { if (palabra) { h += `<span class="cw">${palabra}</span>`; palabra = ""; } };
    piezas.forEach(pz => {
      const ac = pz.ac && pz.ac.ac ? marca(pz.ac, ver) : "";
      const tx = pz.tx === "" ? " " : esc(pz.tx);
      palabra += `<span class="cp"><span class="ca-row">${ac || "​"}</span><span class="cly">${tx}</span></span>`;
      if (/\s$/.test(pz.tx) || pz.tx === "") flush();
    });
    flush();
    return h;
  }
  const COLORES_SEC = [[/coro|chorus/i, "--flame"], [/pre/i, "--sol"], [/verso|estrofa|verse/i, "--sea"], [/puente|bridge/i, "--lav"], [/intro|outro|final|instrumental|interludio|solo/i, "--baby-ink"], [/tag|vamp/i, "--rosa"]];
  function colorSeccion(n) {
    if (/post/i.test(n) && /coro/i.test(n)) return "--rosa";
    const pre = /pre/i.test(n) && /coro/i.test(n);
    if (pre) return "--sol";
    for (const [re, c] of COLORES_SEC) if (re.test(n)) return c;
    return "--muted";
  }
  /** Lista de secciones en orden de aparición. */
  function secciones(texto) {
    return leer(texto).filter(b => b.t === "sec").map(b => b.nombre);
  }
  /** Reacomoda según el orden pedido (repite secciones sin copiar el texto). */
  function ordenar(bloques, orden) {
    // cada aparición de una sección es un bloque aparte; si dos se llaman igual (dos «Coro»),
    // la 1.ª mención en el orden usa la 1.ª, la 2.ª usa la 2.ª, y luego se repiten en ciclo
    const map = new Map(); let cur = null; const pre = [];
    bloques.forEach(b => {
      if (b.t === "sec") { const k = b.nombre.toLowerCase(); if (!map.has(k)) map.set(k, []); cur = [b]; map.get(k).push(cur); }
      else if (cur) cur.push(b); else pre.push(b);
    });
    const out = pre.slice(), uso = new Map();
    orden.forEach(n => {
      const k = n.toLowerCase(), occ = map.get(k); if (!occ) return;
      const u = uso.get(k) || 0; uso.set(k, u + 1);
      out.push(...occ[u % occ.length]);
    });
    return out.length > pre.length ? out : bloques;
  }

  /** Detecta el tono por los acordes (primero y último pesan más). */
  function adivinaTono(texto) {
    const acs = [];
    leer(texto).forEach(b => b.t === "lin" && b.partes.forEach(p => (p.tipo === "acorde" || p.tipo === "acento") && acs.push(p.ac)));
    if (!acs.length) return "";
    let mejor = "", pts = -1;
    for (const t of TONOS) {
      const dia = acordesDelTono(t).slice(0, t.endsWith("m") ? 8 : 6).map(a => RE_ACORDE.exec(a)).map(m => notaIdx(m[1]) + (/^m(?!aj)/.test(m[2]) ? "m" : ""));
      let p = 0;
      acs.forEach((a, i) => {
        const m = RE_ACORDE.exec(a); if (!m) return;
        const k = notaIdx(m[1]) + (/^m(?!aj)/.test(m[2]) ? "m" : "");
        if (dia.includes(k)) p += (i === 0 || i === acs.length - 1) ? 3 : 1;
        if (k === dia[0]) p += 1;
      });
      if (p > pts) { pts = p; mejor = t; }
    }
    return mejor;
  }

  const CIF = { SOST, BEM, TONOS, MAYORES, MENORES, notaIdx, tonoInfo, nombreTono, transportaTono, distancia, usaBemoles, tonoDeSbp,
    esAcorde, transportaAcorde, nashville, latina, acordesDelTono, silabas, iniciosSilaba, leer, ajustarASilabas, ajustarLinea,
    esLineaAcordes, deAcordesArriba, aHTML, secciones, colorSeccion, adivinaTono, esc,
    /** Bloques ya en el orden pedido (lo usa el PDF). */
    bloques: (texto, orden) => (orden && orden.length ? ordenar(leer(texto), orden) : leer(texto)) };
  if (typeof module !== "undefined" && module.exports) module.exports = CIF; else root.CIF = CIF;
})(typeof window !== "undefined" ? window : globalThis);
