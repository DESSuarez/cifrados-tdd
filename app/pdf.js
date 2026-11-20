/* PDF de cifrados con el formato de Tiempo de Dios (mismo estilo que el reporte de la Bitácora):
   banda oscura arriba con puntos de color, etiqueta pequeña, título y subtítulo; secciones con barra redondeada de color;
   pie con «Generado el …» y número de página. Acordes exactamente sobre su sílaba, en 1 o 2 columnas.
   Usa jsPDF 2.5.1 (se carga al exportar) y el motor CIF.  window.PDF.exportar(opciones) */
(function () {
  "use strict";
  let jsP = null;
  function cargar() {
    if (window.jspdf) return Promise.resolve();
    if (!jsP) jsP = new Promise((ok, mal) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload = ok; s.onerror = () => { jsP = null; mal(new Error("No se pudo cargar el generador de PDF (necesita internet la primera vez).")); }; document.head.appendChild(s); });
    return jsP;
  }
  const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = parseInt(m ? m[1] : "1B1C1A", 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mezcla = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  // Las fuentes estándar del PDF solo traen Latin-1 (+ algunos signos): se cambia lo demás
  const EXTRA = "–—‘’“”•…€™‹›„";
  const san = s => String(s == null ? "" : s).replace(/♯/g, "#").replace(/♭/g, "b").replace(/∞/g, "inf").replace(/→/g, "->")
    .replace(/[^\u0000-ÿ]/g, ch => (EXTRA.includes(ch) ? ch : ""));
  // color por tipo de sección (mismos tonos que la app)
  const COLOR_SEC = { "--flame": "#FF3D1A", "--sol": "#E0A22E", "--sea": "#457A7F", "--lav": "#7E5BD0", "--baby-ink": "#2B7B8A", "--rosa": "#D9558E", "--muted": "#5E6766" };

  /** opciones: {canciones:[{c, tono, capo, orden, nota, momento}], titulo, subtitulo, marca:{nombre, etiqueta, oscuro, primario, secundario, logo},
                 cols:1|2, portada:bool, indice:bool, notacion:"americano"|"latino"|"nashville", soloLetra:bool, archivo} */
  async function exportar(op) {
    await cargar();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 50, PIE = 34, GUT = 26;
    const mk = Object.assign({ nombre: "Tiempo de Dios", etiqueta: "Cifrados", oscuro: "#1B1C1A", primario: "#FF3D1A", secundario: "#98D5E0", logo: null }, op.marca || {});
    const C_OSC = hex(mk.oscuro), C_PRI = hex(mk.primario), C_SEC = hex(mk.secundario), C_TXT = [27, 28, 26], C_MUT = [110, 118, 117];
    const cols = op.cols === 2 ? 2 : 1;
    const colW = (W - 2 * M - (cols - 1) * GUT) / cols;
    const T = cols === 2 ? 9.6 : 11.5;           // tamaño de letra
    const LH = T * 1.28, CH = T * 1.12;          // alto de renglón de letra y de acordes
    const notac = op.notacion || "americano";
    let logoOk = null;
    const kLogo = Math.min(1.5, Math.max(0.6, (+mk.tam || 100) / 100)); // tamaño del logo elegido en el perfil del ministerio
    if (mk.logo) { try { logoOk = { data: mk.logo, fmt: /^data:image\/png/.test(mk.logo) ? "PNG" : "JPEG" }; } catch (e) { logoOk = null; } }

    const fuente = (estilo, tam, color) => { doc.setFont("helvetica", estilo); doc.setFontSize(tam); doc.setTextColor(...(color || C_TXT)); };
    const ancho = (s, estilo, tam) => { doc.setFont("helvetica", estilo); doc.setFontSize(tam); return doc.getTextWidth(san(s)); };

    // ---------- banda de encabezado (como el reporte de la Bitácora) ----------
    function puntos(x, y) { [C_PRI, C_SEC, mezcla(C_OSC, [255, 255, 255], 0.45)].forEach((c, i) => { doc.setFillColor(...c); doc.circle(x + i * 13, y, 4.2, "F"); }); }
    function banda(etiqueta, titulo, subtitulo, alto) {
      doc.setFillColor(...C_OSC); doc.rect(0, 0, W, alto, "F");
      let x = M;
      if (logoOk) { const t = Math.round(30 * kLogo); try { doc.addImage(logoOk.data, logoOk.fmt, M, 33 - t / 2, t, t, undefined, "FAST"); x = M + t + 10; } catch (e) { logoOk = null; } }
      if (!logoOk) puntos(M + 4, 33);
      fuente("normal", 8.5, [201, 210, 209]); doc.text(san(etiqueta).toUpperCase(), logoOk ? x : M + 44, 36.5);
      fuente("bold", titulo.length > 34 ? 19 : 23, [255, 255, 255]);
      const tl = doc.splitTextToSize(san(titulo), W - 2 * M);
      doc.text(tl.slice(0, 2), M, 72);
      const yy = 72 + (Math.min(tl.length, 2) - 1) * 24;
      if (subtitulo) { fuente("normal", 10.5, C_SEC); doc.text(doc.splitTextToSize(san(subtitulo), W - 2 * M).slice(0, 2), M, yy + 19); }
      doc.setFillColor(...C_PRI); doc.rect(0, alto - 4, W, 4, "F");
      return alto;
    }
    function bandaChica(titulo) {
      doc.setFillColor(...C_OSC); doc.rect(0, 0, W, 34, "F");
      doc.setFillColor(...C_PRI); doc.rect(0, 31, W, 3, "F");
      fuente("bold", 10, [255, 255, 255]); doc.text(san(titulo), M, 21);
      fuente("normal", 8, [201, 210, 209]); doc.text(san(mk.nombre).toUpperCase() + " · " + san(mk.etiqueta).toUpperCase(), W - M, 21, { align: "right" });
      return 34;
    }

    // ---------- de ChordPro a renglones medidos ----------
    function verAcorde(p, semis, tonoFinal) {
      if (p.tipo === "ritmo" || p.tipo === "anot") return p.ac;
      const bem = CIF.usaBemoles(tonoFinal || ""), t = CIF.transportaAcorde(p.ac, semis, bem);
      return notac === "nashville" ? CIF.nashville(t, tonoFinal || "C") : notac === "latino" ? CIF.latina(t) : t;
    }
    /** Devuelve grupos (uno por sección) con renglones {alto, dibujar(x,y)} ya acomodados al ancho w. */
    function maquetar(c, semis, tonoFinal, orden, w) {
      const grupos = []; let g = null;
      const nuevo = nombre => { g = { nombre, filas: [] }; grupos.push(g); };
      for (const b of CIF.bloques(c.contenido || "", orden)) {
        if (b.t === "sec") { nuevo(b.nombre); continue; }
        if (!g) nuevo(null);
        if (b.t === "vacia") { g.filas.push({ alto: T * 0.5, dibujar() {} }); continue; }
        if (b.t === "nota") { const ls = (fuente("italic", T * 0.82), doc.splitTextToSize(san(b.tx), w)); ls.forEach(l => g.filas.push({ alto: T * 1.1, dibujar(x, y) { fuente("italic", T * 0.82, C_MUT); doc.text(l, x, y + T * 0.85); } })); continue; }
        if (b.t === "tab") { b.lineas.forEach(l => g.filas.push({ alto: T * 0.95, dibujar(x, y) { doc.setFont("courier", "normal"); doc.setFontSize(T * 0.78); doc.setTextColor(...C_TXT); doc.text(san(l), x, y + T * 0.75); } })); continue; }
        const conAc = b.partes.some(p => p.ac);
        if (op.soloLetra || !conAc) {
          const tx = b.partes.map(p => p.tx).join("").replace(/\s+/g, " ").trim();
          if (!tx) continue;
          fuente("normal", T); doc.splitTextToSize(san(tx), w).forEach(l => g.filas.push({ alto: LH, dibujar(x, y) { fuente("normal", T, C_TXT); doc.text(l, x, y + T * 0.95); } }));
          continue;
        }
        const soloAc = b.partes.every(p => !p.tx.trim());
        // piezas: cada parte se parte donde hay espacio; el acorde va con la primera pieza
        const palabras = []; let pal = [];
        b.partes.forEach(p => {
          const tr = (p.tx.match(/[^\s]*\s*/g) || []).filter(Boolean); if (!tr.length) tr.push("");
          tr.forEach((t, i) => { pal.push({ ac: i === 0 && p.ac ? verAcorde(p, semis, tonoFinal) : "", tipo: p.tipo, tx: t }); if (/\s$/.test(t) || soloAc) { palabras.push(pal); pal = []; } });
        });
        if (pal.length) palabras.push(pal);
        const anchoPieza = pz => { const tw = ancho(pz.tx, "normal", T); if (!pz.ac) return tw; const aw = ancho(pz.ac, pz.tipo === "ritmo" || pz.tipo === "anot" ? "normal" : "bold", T * 0.92) + T * 0.38; return Math.max(tw, aw); };
        // acomoda palabras en renglones del ancho w
        let renglon = [], xr = 0;
        const cerrar = () => { if (!renglon.length) return; const r = renglon; g.filas.push({ alto: (soloAc ? 0 : LH) + CH + T * 0.15, dibujar(x, y) {
          r.forEach(({ pz, dx }) => {
            if (pz.ac) { const leve = pz.tipo === "ritmo" || pz.tipo === "anot"; fuente(leve ? "normal" : "bold", T * 0.92, leve ? C_MUT : C_PRI); doc.text(san(pz.ac), x + dx, y + T * 0.9); }
            if (!soloAc && pz.tx) { fuente("normal", T, C_TXT); doc.text(san(pz.tx), x + dx, y + CH + T * 0.95); }
          }); } }); renglon = []; xr = 0; };
        palabras.forEach(pw => {
          const anchos = pw.map(anchoPieza), total = anchos.reduce((a, b2) => a + b2, 0) + (soloAc ? T * 0.6 : 0);
          if (xr > 0 && xr + total > w) cerrar();
          let dx = xr; pw.forEach((pz, i) => { renglon.push({ pz, dx }); dx += anchos[i]; });
          xr += total;
        });
        cerrar();
      }
      return grupos;
    }
    const altoGrupo = gr => (gr.nombre ? 22 : 0) + gr.filas.reduce((a, f) => a + f.alto, 0) + 8;
    function dibujarEncabezadoSec(nombre, x, y, w) {
      const col = hex(COLOR_SEC[CIF.colorSeccion(nombre)] || "#5E6766");
      doc.setFillColor(...col); doc.roundedRect(x, y, w, 17, 4, 4, "F");
      fuente("bold", 9, [255, 255, 255]); doc.text(san(nombre).toUpperCase(), x + 8, y + 11.8);
      return 22;
    }

    // ---------- canciones ----------
    const indice = []; // {titulo, autor, pagina, extra}
    let primeraPagina = true;
    const nuevaPagina = () => { if (primeraPagina) primeraPagina = false; else doc.addPage(); };
    // portada (cancionero / set)
    let paginasIndice = 0;
    if (op.portada) {
      nuevaPagina();
      doc.setFillColor(...C_OSC); doc.rect(0, 0, W, H * 0.46, "F");
      doc.setFillColor(...C_PRI); doc.rect(0, H * 0.46, W, 7, "F");
      const tp = Math.round(74 * kLogo), yp = logoOk ? 70 + tp + 28 : 128;
      if (logoOk) { try { doc.addImage(logoOk.data, logoOk.fmt, M, 70, tp, tp, undefined, "FAST"); } catch (e) { /* sin logo */ } } else puntos(M + 6, 96);
      fuente("normal", 10, [201, 210, 209]); doc.text(san(mk.nombre).toUpperCase() + " · " + san(mk.etiqueta).toUpperCase(), M, yp);
      fuente("bold", 34, [255, 255, 255]); doc.text(doc.splitTextToSize(san(op.titulo || "Cancionero"), W - 2 * M).slice(0, 2), M, yp + 44);
      if (op.subtitulo) { fuente("normal", 13, C_SEC); doc.text(doc.splitTextToSize(san(op.subtitulo), W - 2 * M).slice(0, 2), M, H * 0.46 - 40); }
      fuente("normal", 11, C_TXT); doc.text(`${op.canciones.length} canci${op.canciones.length === 1 ? "ón" : "ones"} · ${cols === 2 ? "dos columnas" : "una columna"}`, M, H * 0.46 + 46);
      if (op.indice) { paginasIndice = Math.max(1, Math.ceil(op.canciones.length / 18)); for (let i = 0; i < paginasIndice; i++) doc.addPage(); }
    }
    const top0 = M - 10;
    for (const it of op.canciones) {
      const c = it.c, original = c.tono || CIF.adivinaTono(c.contenido) || "C";
      const tono = it.tono || original, capo = it.capo || 0;
      const semis = CIF.distancia(original, tono) - capo, forma = CIF.transportaTono(tono, -capo);
      nuevaPagina();
      const pagIni = doc.internal.getNumberOfPages();
      const sub = [c.autor, `Tono ${tono}${capo ? " (capo " + capo + ", formas de " + forma + ")" : ""}`, c.bpm ? c.bpm + " bpm" : "", c.compas, it.momento, it.persona].filter(Boolean).join(" · ");
      const altoB = banda(`${mk.nombre} · ${mk.etiqueta}${it.momento ? " · " + it.momento : ""}`, c.titulo, sub, 118);
      indice.push({ titulo: c.titulo, autor: c.autor, pagina: pagIni, extra: [it.momento, tono].filter(Boolean).join(" · ") });
      let y = altoB + 18;
      if (it.nota) { fuente("italic", 9.5, C_MUT); doc.text(doc.splitTextToSize(san("Nota: " + it.nota), W - 2 * M), M, y + 4); y += 18; }
      const topCuerpo = y, bottom = H - M - PIE + 10;
      let col = 0, topCol = topCuerpo;
      const xCol = () => M + col * (colW + GUT);
      const sigColumna = () => {
        if (col < cols - 1) { col++; y = topCol; return; }
        doc.addPage(); const a = bandaChica(c.titulo + " (continúa)"); col = 0; topCol = a + 22; y = topCol;
      };
      const grupos = maquetar(c, semis, forma, it.orden, colW);
      for (const gr of grupos) {
        const h = altoGrupo(gr), cabe = bottom - topCol;
        if (y + h > bottom && h <= cabe && y > topCol) sigColumna(); // la sección entera pasa a la siguiente columna
        if (gr.nombre) { if (y + 40 > bottom) sigColumna(); y += dibujarEncabezadoSec(gr.nombre, xCol(), y, colW); }
        for (const f of gr.filas) { if (y + f.alto > bottom) sigColumna(); f.dibujar(xCol(), y); y += f.alto; }
        y += 8;
      }
    }
    // índice (después de saber en qué página empieza cada una)
    if (op.portada && op.indice && paginasIndice) {
      let p = 2, y = 0, n = 0;
      const cab = () => { doc.setPage(p); y = bandaChica("Índice") + 34; fuente("bold", 18, C_TXT); doc.text("Índice", M, y); y += 22; };
      cab();
      indice.forEach((e, i) => {
        if (n >= 18) { p++; n = 0; cab(); }
        fuente("bold", 11, C_TXT); doc.text(`${i + 1}. ${san(e.titulo)}`.slice(0, 70), M, y);
        fuente("normal", 9, C_MUT); doc.text(san([e.autor, e.extra].filter(Boolean).join(" · ")).slice(0, 80), M + 16, y + 12);
        fuente("bold", 11, C_PRI); doc.text(String(e.pagina), W - M, y, { align: "right" });
        doc.setDrawColor(221, 229, 229); doc.line(M, y + 21, W - M, y + 21);
        y += 34; n++;
      });
    }
    // pie en todas las páginas
    const total = doc.internal.getNumberOfPages();
    const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
    for (let i = 1; i <= total; i++) {
      doc.setPage(i); fuente("normal", 8.5, [150, 158, 157]);
      doc.text(san(`Generado el ${hoy} · ${mk.nombre} · Cifrados`), M, H - 24);
      doc.text(`${i} / ${total}`, W - M, H - 24, { align: "right" });
    }
    const nombre = (op.archivo || op.titulo || "cifrados").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase();
    if (op.devolver) return doc;
    doc.save(nombre + ".pdf");
    return total;
  }
  window.PDF = { exportar, cargar };
})();
