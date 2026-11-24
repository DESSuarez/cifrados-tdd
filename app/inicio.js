/* Página pública de CifraDios: inicio, planes y suscripción (pago SIMULADO, todavía sin Stripe ni ningún cobro).
   Rutas: #conoce (inicio), #planes (inicio en la sección de planes), #suscribir/<gratis|basico|pro> (registro y pago).
   Al terminar manda al login (#entrar) con el correo ya escrito.
   window.INICIO = { vista(r), enlazar(r) } — los usa render() en index.html. */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ss = { get(k, d) { try { const v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------- Planes: pesos mexicanos con IVA, por ministerio ----------
  const PLANES = [
    { id: "gratis", nombre: "Gratis", lema: "Para empezar a tocar", mes: 0, incluye: 1, extra: 0, color: "--sea",
      cosas: ["1 persona: tú y tus cifrados", "Tu librería personal (hasta 30 canciones)", "Banco de canciones de Tiempo de Dios", "Transponer, capo y notación: C D E · Do Re Mi · 1 4 5", "Solo letra y desplazamiento automático", "Guarda tu tono en cada canción", "1 set activo"] },
    { id: "basico", nombre: "Básico", lema: "Para tu ministerio", mes: 199, incluye: 10, extra: 19, color: "--flame", destacado: true,
      cosas: ["10 personas incluidas · +$19 por persona extra", "Todo lo de Gratis", "Canciones y sets ilimitados", "Sets litúrgicos por momentos de la misa", "Tu ministerio con integrantes y roles", "El tono de cada voz, a la mano", "PDF de tus sets (1 o 2 columnas, portada e índice)", "En vivo: quien dirige marca y todos lo siguen", "Voz principal y coros por sección"] },
    { id: "pro", nombre: "Pro", lema: "Para equipos que van con todo", mes: 349, incluye: 10, extra: 29, color: "--lav",
      cosas: ["10 personas incluidas · +$29 por persona extra", "Todo lo de Básico", "Pistas que cambian de tono y velocidad", "Sets compartidos con otros ministerios", "PDF con el logo y los colores de tu ministerio", "Importa SongbookPro, ChordPro y «acordes arriba»", "Red local: toquen sin internet en eventos", "Respaldo y exportación", "✨ Foto o PDF → cifrado: 100 páginas al mes (muy pronto)"] },
  ];
  const plan = id => PLANES.find(p => p.id === id) || PLANES[1];
  const mensual = (p, personas) => (p.mes === 0 ? 0 : p.mes + Math.max(0, (personas || p.incluye) - p.incluye) * p.extra);
  const precio = (p, anual, personas) => (anual ? mensual(p, personas) * 10 : mensual(p, personas));
  const dinero = n => "$" + n.toLocaleString("es-MX");

  const est = { anual: ss.get("ini-anual", false) };
  const flujo = () => ss.get("ini-flujo", { paso: 1, datos: {} });
  const ponFlujo = f => ss.set("ini-flujo", f);

  const LOGO = `<img src="app-favicon.png" width="34" height="34" alt="" class="i-logo">`;
  const nav = logueado => `<header class="i-nav"><a href="#conoce" class="i-marca">${LOGO}<span><b>CifraDios</b><small>Tiempo de Dios</small></span></a>
    <nav><a href="#planes" class="i-lnk">Planes</a>${logueado ? `<a href="#libreria" class="i-btn sm">Abrir la app →</a>` : `<a href="#entrar" class="i-btn sm ghost">Entrar</a>`}</nav></header>`;

  // ========== Demos interactivos: datos ==========
  const DEMO_SONGS = [
    { id: "d1", titulo: "Aquí Estoy", autor: "KAYRÓS", tono: "A", miTono: "G", grupo: "tdd",
      cp: "{c: Verso}\n[A]Tú eres el [D]principio y el final\n[A]Mi primer a[E]mor\n\n{c: Coro}\n[F#m]Aquí es[E]toy\n[D]Para ado[A]rarte\n[F#m]Aquí es[E]toy\n[D]Para ren[A]dirme" },
    { id: "d2", titulo: "Confiaré", autor: "Zamar", tono: "A", grupo: "tdd",
      cp: "{c: Coro}\n[A]En ti con[E]fiaré [F#m]siempre\n[D]Nada me [A]faltará\n\n{c: Verso}\n[A]Aunque camine [E]por el valle\n[F#m]De sombra, [D]no temeré" },
    { id: "d3", titulo: "Santo, santo", autor: "Surgit", tono: "D", grupo: "lit",
      cp: "{c: Santo}\n[D]Santo, [A]santo, [Bm]santo es el [G]Señor\n[D]Dios del [A]uni[D]verso\n\n{c: Hosanna}\n[G]Hosanna [D]en el [A]cielo\n[Bm]Bendito el [G]que [A]viene en [D]nombre del Señor" },
    { id: "d4", titulo: "Piedad, piedad", autor: "KAYRÓS", tono: "Em", grupo: "lit",
      cp: "{c: Piedad}\n[Em]Piedad, [Am]piedad\n[B7]Ten piedad de [Em]nosotros, Señor\n\n[Em]Piedad, [Am]piedad\n[B7]Ten piedad de [Em]nosotros" },
    { id: "d5", titulo: "Gloria a Dios", autor: "KAYRÓS", tono: "Bb", miTono: "G", grupo: "lit",
      cp: "{c: Gloria}\n[Bb]Gloria a [F]Dios en el [Gm]cielo\n[Eb]Y en la [Bb]tierra [F]paz\n[Gm]A los hombres que [Eb]ama el [F]Señor" },
    { id: "d6", titulo: "Jesús, yo creo", autor: "Tiempo de Dios", tono: "F", grupo: "tdd",
      cp: "{c: Coro}\n[F]Jesús, yo [Bb]creo\n[C]Creo en [Dm]ti\n[Bb]Creo que es[C]tás aquí en la [F]Eucaristía" },
    { id: "d7", titulo: "Ven Espíritu", autor: "Zamar", tono: "C", grupo: "tdd",
      cp: "{c: Coro}\n[C]Ven Espí[G]ritu [Am]Santo\n[F]Llena nuestros [C]corazones\n\n{c: Verso}\n[Am]Ven con tu [F]fuego\n[C]Enciende [G]todo en mí" },
    { id: "d8", titulo: "Aleluya", autor: "Surgit", tono: "C", grupo: "lit",
      cp: "{c: Aleluya}\n[C]Ale[G]lu[Am]ya, ale[F]luya\n[C]Ale[G]lu[C]ya" },
    { id: "d9", titulo: "Cordero de Dios", autor: "Tiempo de Dios", tono: "Am", grupo: "lit",
      cp: "{c: Cordero}\n[Am]Cordero de [Em]Dios\n[F]Que quitas el pe[G]cado\n[Am]Ten piedad de [E]nosotros" },
    { id: "d10", titulo: "Gracias, Señor", autor: "Zamar", tono: "G", grupo: "tdd",
      cp: "{c: Coro}\n[G]Gracias, [Em]Señor\n[C]Por tu a[D]mor\n[G]Gracias por [Em]todo\n[C]Lo que [D]das" },
    { id: "d11", titulo: "Envíame", autor: "KAYRÓS", tono: "E", grupo: "tdd",
      cp: "{c: Coro}\n[E]Envía[B]me, Se[C#m]ñor\n[A]A donde [E]tú quieras\n[B]Heme a[C#m]quí\n[A]Envía[B]me" },
    { id: "d12", titulo: "Alma misionera", autor: "Tiempo de Dios", tono: "D", grupo: "tdd",
      cp: "{c: Coro}\n[D]Señor, da[A]me tu [Bm]alma\n[G]Alma misio[A]nera\n[D]Dame tu [A]corazón\n[G]Corazón de [A]sal" },
  ];
  const DEMO_SET = [
    { momento: "ENTRADA", cancion: "d1", tonoSet: "G" },
    { momento: "PIEDAD", cancion: "d4" },
    { momento: "GLORIA", cancion: "d5" },
    { momento: "ACLAMACIÓN", cancion: "d8" },
    { momento: "OFERTORIO", cancion: "d2", tonoSet: "G" },
    { momento: "SANTO", cancion: "d3" },
    { momento: "CORDERO", cancion: "d9" },
    { momento: "COMUNIÓN", cancion: "d7" },
    { momento: "COMUNIÓN", cancion: "d6" },
    { momento: "COMUNIÓN", cancion: "d1" },
    { momento: "ACCIÓN DE GRACIAS", cancion: "d10" },
    { momento: "SALIDA", cancion: "d11" },
  ];
  const dSong = id => DEMO_SONGS.find(c => c.id === id);
  const demo = { vista: "lib", cancionId: null, oscuro: true, tab: "tdd", tonos: -2, setIdx: 0, pdfColor: "#7E5BD0" };

  // ========== Demos interactivos: renderizado ==========
  function demoPhoneHTML() {
    return demo.vista === "cancion" && demo.cancionId ? demoCancionHTML(demo.cancionId) : demoLibHTML();
  }
  function demoLibHTML() {
    const TABS = [["tdd", "Tiempo de Dios"], ["otras", "Otras"], ["lit", "Litúrgicas"]];
    const songs = DEMO_SONGS.filter(c => demo.tab === "otras" ? false : demo.tab === "lit" ? c.grupo === "lit" : c.grupo === "tdd");
    return `<div class="i-ps-band">
        <div class="i-ps-bandtop"><span class="i-ps-hamb">☰</span><b>La <em>librería</em></b><span class="i-ps-cmdk">⌘K</span></div>
        <div class="i-ps-sub">${songs.length} canciones</div>
        <div class="i-ps-tabs">${TABS.map(([k, l]) => `<span${k === demo.tab ? ' class="on"' : ""} data-demo-tab="${k}">${l}</span>`).join("")}</div>
      </div>
      <div class="i-ps-body">
        <div class="i-ps-q">🔍 Buscar por título, autor…</div>
        <div class="i-ps-songs">${songs.length ? songs.map(c => `<div class="i-ps-row" data-demo-song="${c.id}">
              <div><b>${esc(c.titulo)}</b><small>${esc(c.autor)}</small></div>
              <span class="i-ps-chip">${c.tono}</span>${c.miTono ? `<span class="i-ps-mio">★ ${c.miTono}</span>` : ""}
            </div>`).join("") : `<div class="i-ps-vacio">No hay canciones en esta pestaña</div>`}</div>
      </div>
      <div class="i-ps-mini"><small>▶ Aquí Estoy · A</small><div class="i-ps-prog"><span></span></div><small>2:14</small></div>`;
  }
  function demoCancionHTML(id) {
    const c = dSong(id);
    if (!c) return demoLibHTML();
    const html = window.CIF ? CIF.aHTML(c.cp) : esc(c.cp);
    return `<div class="i-ps-band">
        <div class="i-ps-bandtop"><span class="i-demo-back" data-demo-back>‹</span><b>${esc(c.titulo)}</b><span class="i-ps-chip" style="margin:0">${c.tono}</span></div>
        <div class="i-ps-sub">${esc(c.autor)}</div>
      </div>
      <div class="i-demo-scroll">${html}</div>`;
  }
  function demoTonosHTML(semis) {
    const c = dSong("d1");
    if (!c || !window.CIF) return "";
    const tonoFinal = CIF.transportaTono(c.tono, semis);
    const html = CIF.aHTML(c.cp, { semis, tonoFinal });
    const BT = [
      { l: "Original", t: c.tono, s: 0 },
      { l: "★ Mi tono", t: "G", s: CIF.distancia(c.tono, "G") },
      { l: "Daniela", t: "E", s: CIF.distancia(c.tono, "E") },
      { l: "Set", t: "D", s: CIF.distancia(c.tono, "D") },
    ];
    return `<div class="i-af-band"><b>${esc(c.titulo)}</b><small>${esc(c.autor)} · Original ${c.tono}</small></div>
      <div class="i-m-bar">${BT.map(b => `<span class="i-m-tone${b.s === semis ? " act" : ""}" data-demo-tonos="${b.s}">${b.l} <b>${b.t}</b></span>`).join("")}</div>
      <div class="i-af-body i-demo-scroll">${html}</div>`;
  }
  function demoSetHTML(idx) {
    let lastMom = "";
    return DEMO_SET.map((it, i) => {
      const c = dSong(it.cancion);
      if (!c) return "";
      const mom = it.momento !== lastMom ? `<div class="i-m-momento">${it.momento}</div>` : "";
      lastMom = it.momento;
      return `${mom}<div class="i-m-item${i === idx ? " on" : ""}" data-demo-set="${i}"><span>${i + 1}</span><div><b>${esc(c.titulo)}</b><small>${it.tonoSet || c.tono}</small></div></div>`;
    }).join("");
  }
  function updatePhone() {
    const el = document.getElementById("demoPhone");
    if (el) el.innerHTML = demoPhoneHTML();
  }

  // ========== Marcos de showcase ==========
  const appFrame = c => `<div class="i-app-frame"><div class="i-af-notch"></div><div class="i-af-screen">${c}</div></div>`;

  function mockPhoneHTML() {
    return `<div class="i-phone-wrap"><div class="i-phone" id="demoPhoneFrame">
      <div class="i-phone-notch"></div>
      <div class="i-phone-screen${demo.oscuro ? "" : " demo-light"}" id="demoPhone">${demoPhoneHTML()}</div>
    </div>
    <div class="i-phone-ctrls"><button class="i-dm-btn" id="demoTheme" title="Cambiar modo claro / oscuro">${demo.oscuro ? "☀️" : "🌙"}</button></div></div>`;
  }
  function mockTonosHTML() {
    return `<div class="i-app-frame"><div class="i-af-notch"></div><div class="i-af-screen${demo.oscuro ? "" : " demo-light"}" id="demoTonos">${demoTonosHTML(demo.tonos)}</div></div>`;
  }
  function mockSetHTML() {
    return `<div class="i-app-frame"><div class="i-af-notch"></div><div class="i-af-screen${demo.oscuro ? "" : " demo-light"}"><div class="i-af-band"><b>Misa dominical <span class="i-m-live">● En vivo</span></b></div>
      <div class="i-af-body" id="demoSetBody">${demoSetHTML(demo.setIdx)}</div></div></div>`;
  }
  function mockPdfHTML() {
    const C = [["#7E5BD0", "Lavanda"], ["#FF3D1A", "Flame"], ["#457A7F", "Deep sea"], ["#F2B33D", "Sol"], ["#D9558E", "Rosa"]];
    return `<div class="i-pdf-demo" id="demoPdf" style="--pdf-c:${demo.pdfColor}">
      <div class="i-pdf-colors">${C.map(([c, n]) => `<button class="i-pdf-dot${c === demo.pdfColor ? " on" : ""}" style="background:${c}" data-pdf-color="${c}" title="${n}"></button>`).join("")}</div>
      <div class="i-mock i-m-pdf"><div class="i-m-cover">
        <div class="i-m-logo">K</div><b>KAYRÓS</b><small>Set dominical · 24 nov 2026</small>
      </div><div class="i-m-page">
        <div class="i-m-sec">Verso</div>
        <div class="i-m-line"><i>A</i><i>D</i></div>
        <div class="i-m-letra">Tú eres el principio y el final</div>
        <div class="i-m-sec rosa">Coro</div>
        <div class="i-m-line"><i>F#m</i><i>E</i><i>A</i></div>
        <div class="i-m-letra">Aquí estoy, para adorarte</div>
      </div></div></div>`;
  }
  const mockSenas = appFrame(`<div class="i-af-band"><b>Manual de señas</b></div>
    <div class="i-af-body">
      <div class="i-m-sena"><span>☝️</span><div><b>Verso 1</b><small>Un dedo arriba</small></div></div>
      <div class="i-m-sena"><span>✌️</span><div><b>Verso 2</b><small>Dos dedos</small></div></div>
      <div class="i-m-sena"><span>✊</span><div><b>Coro</b><small>Puño cerrado</small></div></div>
      <div class="i-m-sena"><span>🖐️</span><div><b>Final</b><small>Palma abierta</small></div></div>
      <div class="i-m-sena"><span>🔄</span><div><b>Repetir</b><small>Dedo girando</small></div></div>
      <div class="i-m-sena"><span>⬆️</span><div><b>Subir tono</b><small>Pulgar arriba</small></div></div>
    </div>`);

  // ---------- Tarjetas y funciones extra ----------
  const FUNCIONES_EXTRA = [
    ["📶", "Funciona sin internet", "Tu música guardada en el celular. Toca aunque no haya señal."],
    ["🤝", "Banco del colectivo", "Canciones de Tiempo de Dios y del colectivo, siempre en su última versión."],
    ["🎵", "Pistas con cambio de tono", "Sube o baja el tono de la pista para que suene como tu voz."],
    ["✏️", "Importa lo que ya tienes", "ChordPro, SongbookPro o pega «acordes arriba» y se arma solo."],
    ["👁️", "Vista minimalista", "Solo los acordes y la letra, sin distracciones. Cada quien la elige."],
    ["🌙", "Modo oscuro", "Día, noche, retro y automático. Se ve bien en cualquier luz."],
  ];

  function tarjetaPlan(p) {
    const n = precio(p, est.anual);
    return `<article class="i-plan ${p.destacado ? "dest" : ""}" style="--pc:var(${p.color})">
      ${p.destacado ? `<span class="i-badge">El favorito de los ministerios</span>` : ""}
      <h3>${esc(p.nombre)}</h3><p class="i-lema">${esc(p.lema)}</p>
      <p class="i-precio"><b>${n === 0 ? "$0" : dinero(n)}</b><small>${n === 0 ? "para siempre" : est.anual ? "MXN al año" : "MXN al mes"}</small></p>
      ${p.mes && est.anual ? `<p class="i-ahorro">2 meses gratis: ahorras ${dinero(p.mes * 2)}</p>` : p.mes ? `<p class="i-ahorro gris">Por ministerio · ${p.incluye} personas</p>` : `<p class="i-ahorro gris">Sin tarjeta</p>`}
      <a href="#suscribir/${p.id}" class="i-btn ${p.destacado ? "" : "ghost"} full">${p.mes ? "Suscribirme" : "Empezar gratis"}</a>
      <ul>${p.cosas.map(c => `<li>${esc(c)}</li>`).join("")}</ul></article>`;
  }

  // ---------- Página de inicio (rediseño Apple-inspired con demos interactivos) ----------
  function vConoce(r, logueado) {
    return `<div class="inicio">${nav(logueado)}

      <section class="i-hero"><div class="i-wrap i-hero-cen">
        <div class="i-hero-txt">
          <span class="i-eyebrow">Música católica · Tiempo de Dios</span>
          <h1>Tus cifrados,<br><em>listos para alabar.</em></h1>
          <p class="i-hero-sub">La app para que tu ministerio toque cada canción en el tono correcto: acordes, letras y sets para la misa y el ensayo, sincronizados en el celular de todos.</p>
          <div class="i-ctas"><a href="#suscribir/gratis" class="i-btn lg">Empieza gratis</a><a href="#planes" class="i-btn ghost claro">Ver planes</a></div>
          <p class="i-mini">Sin tarjeta · Celular, tablet y computadora</p>
        </div>
        ${mockPhoneHTML()}
      </div></section>

      <div class="i-chips" aria-hidden="true"><div class="i-chips-row">
        ${[["🎚️","Tonos por artista"],["⛪","Sets litúrgicos"],["📡","En vivo"],["🎤","Voces"],["🖨️","PDF con tu marca"],["📶","Sin internet"],["🤝","Banco del colectivo"],["🤙","Señas"]].map(([ic,t])=>`<span class="i-chip">${ic} ${esc(t)}</span>`).join("")}
      </div></div>

      <section class="i-show reveal" style="--ac:var(--flame)"><div class="i-wrap i-show-in">
        <div class="i-show-txt">
          <span class="i-eyebrow" style="color:var(--ac)">Transporte y tonos</span>
          <h2>Cada quien en <em>su tono,</em> sin errores.</h2>
          <p>Sube o baja el tono y los acordes se acomodan solos. Cada voz guarda el suyo; al abrir un set, todos ven la canción en su tono.</p>
        </div>
        <div class="i-show-vis">${mockTonosHTML()}</div>
      </div></section>

      <section class="i-show reveal flip" id="secSets" style="--ac:var(--baby)"><div class="i-wrap i-show-in">
        <div class="i-show-txt">
          <span class="i-eyebrow" style="color:var(--ac)">Sets en vivo</span>
          <h2>Del ensayo a la misa, <em>todos juntos.</em></h2>
          <p>Arma el set por momentos litúrgicos. Quien dirige marca la canción y la sección, y en el celular de todos cambia al momento.</p>
        </div>
        <div class="i-show-vis">${mockSetHTML()}</div>
      </div></section>

      <section class="i-show reveal" id="secPdf" style="--ac:var(--lav)"><div class="i-wrap i-show-in">
        <div class="i-show-txt">
          <span class="i-eyebrow" style="color:var(--ac)">PDF con tu marca</span>
          <h2>Cancioneros <em>profesionales,</em> listos para imprimir.</h2>
          <p>Portada, índice y los colores de tu ministerio. Una o dos columnas, con la estructura que elijas para cada canción.</p>
        </div>
        <div class="i-show-vis">${mockPdfHTML()}</div>
      </div></section>

      <section class="i-show reveal flip" style="--ac:var(--sol)"><div class="i-wrap i-show-in">
        <div class="i-show-txt">
          <span class="i-eyebrow" style="color:var(--ac)">Señas para dirigir</span>
          <h2>Un lenguaje <em>sin palabras</em> para tu equipo.</h2>
          <p>Señas con las manos para indicar verso, coro, puente, repetir o terminar. Todos las aprenden en la app.</p>
        </div>
        <div class="i-show-vis">${mockSenas}</div>
      </div></section>

      <section class="i-sec reveal"><div class="i-wrap">
        <h2>Y mucho <em>más</em></h2>
        <div class="i-grid">${FUNCIONES_EXTRA.map(([ic, t, d]) => `<div class="i-feat"><span class="i-ic">${ic}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
      </div></section>

      <section class="i-sec alt reveal" id="planes"><div class="i-wrap">
        <h2>Elige tu <em>plan</em></h2><p class="i-sub">Precio por ministerio, no por persona: todo tu equipo entra.</p>
        <div class="i-periodo" role="radiogroup" aria-label="Periodo de pago"><button role="radio" aria-checked="${!est.anual}" class="${!est.anual ? "on" : ""}" data-periodo="mes">Mensual</button><button role="radio" aria-checked="${est.anual}" class="${est.anual ? "on" : ""}" data-periodo="anual">Anual <span>2 meses gratis</span></button></div>
        <div class="i-planes">${PLANES.map(tarjetaPlan).join("")}</div>
        <p class="i-nota">Pesos mexicanos con IVA incluido. ¿Son más de 10? Cada persona extra se suma a tu plan. Cambia de plan o cancela cuando quieras.</p>
      </div></section>

      <section class="i-sec reveal"><div class="i-wrap i-pasos">
        <h2>Así de <em>fácil</em></h2>
        <ol><li><b>Elige tu plan</b><span>Gratis para probar, Básico o Pro para todo tu ministerio.</span></li>
          <li><b>Crea tu cuenta</b><span>Te llega un correo para poner tu contraseña.</span></li>
          <li><b>Invita a tu equipo</b><span>Músicos y voces entran a los sets y guardan su tono.</span></li>
          <li><b>¡A tocar!</b><span>Del ensayo a la misa, todos en la misma página.</span></li></ol>
      </div></section>

      <section class="i-cierre reveal"><div class="i-wrap">
        <h2>Que la música lleve a <em>Dios.</em></h2>
        <p>Nosotros nos encargamos de que los acordes estén en orden.</p>
        <a href="#suscribir/basico" class="i-btn lg">Empezar con mi ministerio</a>
      </div></section>

      <footer class="i-pie"><div class="i-wrap">${LOGO}<span>CifraDios · hecho con ♥ por Tiempo de Dios</span><span class="sp"></span><a href="#entrar">Entrar</a></div></footer>
    </div>`;
  }

  // ---------- Suscripción: 1 Tu cuenta · 2 Pago · 3 ¡Listo! ----------
  function vSuscribir(r) {
    const p = plan(r.p[0]), f = flujo(), gratis = p.mes === 0;
    if (f.plan !== p.id) { f.plan = p.id; f.paso = f.paso === 3 ? 1 : f.paso; ponFlujo(f); }
    const d = f.datos || {}, personas = Math.max(p.incluye || 1, +d.personas || p.incluye || 1), extras = Math.max(0, personas - (p.incluye || 1));
    const total = precio(p, est.anual, personas);
    const pasos = gratis ? ["Tu cuenta", "¡Listo!"] : ["Tu cuenta", "Pago", "¡Listo!"];
    const actual = gratis && f.paso === 3 ? 2 : f.paso;
    const resumen = `<aside class="i-resumen" style="--pc:var(${p.color})">
      <span class="i-eyebrow">Tu plan</span><h3>CifraDios ${esc(p.nombre)}</h3><p class="i-lema">${esc(p.lema)}</p>
      ${gratis ? "" : `<div class="i-periodo mini" role="radiogroup"><button class="${!est.anual ? "on" : ""}" data-periodo="mes">Mensual</button><button class="${est.anual ? "on" : ""}" data-periodo="anual">Anual · 2 meses gratis</button></div>
        <div class="i-personas"><span>¿Cuántos son en tu ministerio?</span><div><button type="button" data-pers="-1" aria-label="Menos personas">−</button><b>${personas}</b><button type="button" data-pers="1" aria-label="Más personas">+</button></div></div>
        <div class="i-desglose"><span>Plan ${esc(p.nombre)} · ${p.incluye} personas</span><span>${dinero(p.mes)}/mes</span>${extras ? `<span>${extras} persona${extras === 1 ? "" : "s"} extra × ${dinero(p.extra)}</span><span>${dinero(extras * p.extra)}/mes</span>` : ""}${est.anual ? `<span>Anual: 12 meses por 10</span><span>× 10</span>` : ""}</div>`}
      <ul>${p.cosas.slice(0, 5).map(c => `<li>${esc(c)}</li>`).join("")}</ul>
      <div class="i-total"><span>Total ${gratis ? "" : est.anual ? "al año" : "al mes"}</span><b>${gratis ? "$0" : dinero(total) + " MXN"}</b></div>
      <a href="#planes" class="i-lnk">Cambiar de plan</a></aside>`;
    let cuerpo = "";
    if (f.paso === 1) cuerpo = `<form class="i-form" id="ipaso1">
        <h2>Crea tu cuenta</h2><p class="i-sub">Con estos datos armamos tu ministerio en CifraDios.</p>
        <label>Tu nombre<input name="nombre" value="${esc(d.nombre || "")}" autocomplete="name" required placeholder="Como te dicen en el ministerio"></label>
        <label>Correo<input name="correo" type="email" value="${esc(d.correo || "")}" autocomplete="email" required placeholder="tu@correo.com"></label>
        <label>Nombre de tu ministerio o coro<input name="ministerio" value="${esc(d.ministerio || "")}" autocomplete="organization" placeholder="Ej. Coro San José · Kairós…" ${gratis ? "" : "required"}></label>
        <label class="i-check"><input type="checkbox" name="acepto" ${d.acepto ? "checked" : ""} required> Acepto los términos y el aviso de privacidad</label>
        <button class="i-btn full">${gratis ? "Crear mi cuenta gratis" : "Continuar al pago →"}</button></form>`;
    else if (f.paso === 2) cuerpo = `<form class="i-form" id="ipaso2">
        <h2>Pago</h2><div class="i-demoaviso">🧪 <b>Modo demostración:</b> no se cobra nada y no se guardan datos de tarjeta. Los campos ya vienen llenos con datos de prueba.</div>
        <div class="i-metodos" role="radiogroup">${[["tarjeta", "💳 Tarjeta"], ["oxxo", "🏪 OXXO"], ["spei", "🏦 Transferencia"]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${(d.metodo || "tarjeta") === k}" class="${(d.metodo || "tarjeta") === k ? "on" : ""}" data-metodo="${k}">${l}</button>`).join("")}</div>
        ${(d.metodo || "tarjeta") === "tarjeta" ? `
          <label>Número de tarjeta<input value="4242 4242 4242 4242" readonly data-sinborrador></label>
          <div class="i-dos"><label>Vence<input value="12 / 30" readonly data-sinborrador></label><label>CVC<input value="123" readonly data-sinborrador></label></div>
          <label>Nombre en la tarjeta<input value="${esc(d.nombre || "")}" readonly data-sinborrador></label>`
        : (d.metodo === "oxxo") ? `<p class="i-sub">Al confirmar te daríamos una referencia para pagar en cualquier OXXO. Tu plan se activa en cuanto se acredita el pago (hasta 24 h).</p>`
        : `<p class="i-sub">Al confirmar te daríamos una CLABE para transferir desde tu banco. Se activa al instante con SPEI.</p>`}
        <button class="i-btn full" id="ipagar">${(d.metodo || "tarjeta") === "tarjeta" ? `Pagar ${dinero(total)} MXN` : "Confirmar"}</button>
        <button type="button" class="i-lnk" id="iatras">← Regresar a mis datos</button>
        <p class="i-mini">🔒 Pago seguro. Puedes cancelar cuando quieras.</p></form>`;
    else cuerpo = `<div class="i-listo">
        <div class="i-ok" aria-hidden="true">✓</div>
        <h2>${gratis ? "¡Tu cuenta está lista!" : `¡Bienvenido a CifraDios ${esc(p.nombre)}!`}</h2>
        <p class="i-sub">${gratis ? "" : `Recibimos tu pago de <b>${dinero(total)} MXN</b>. `}Te mandamos un correo a <b>${esc(d.correo || "tu correo")}</b> con una liga para crear tu contraseña.</p>
        <ol class="i-sigue"><li><b>Abre el correo de CifraDios</b> y toca «Crear mi contraseña».</li><li><b>Entra</b> con tu correo y tu nueva contraseña.</li><li><b>Invita a tu equipo</b> desde «Usuarios» y arma tu primer set.</li></ol>
        ${gratis ? "" : `<div class="i-recibo"><span>Plan ${esc(p.nombre)} · ${est.anual ? "anual" : "mensual"} · ${personas} personas</span><b>${dinero(total)} MXN</b><small>Folio de prueba ${esc(f.folio || "")}</small></div>`}
        <button class="i-btn full" id="ialogin">Ir a iniciar sesión →</button>
        <p class="i-mini">🧪 Demostración: no se creó ninguna cuenta ni se mandó correo.</p></div>`;
    return `<div class="inicio">${nav(false)}
      <section class="i-sec i-checkout"><div class="i-wrap">
        <ol class="i-progreso">${pasos.map((t, i) => `<li class="${i + 1 < actual ? "hecho" : i + 1 === actual ? "on" : ""}"><span>${i + 1 < actual ? "✓" : i + 1}</span>${t}</li>`).join("")}</ol>
        <div class="i-co">${cuerpo}${f.paso === 3 ? "" : resumen}</div>
      </div></section></div>`;
  }

  function vista(r, opt = {}) { return r.v === "suscribir" ? vSuscribir(r) : vConoce(r, opt.logueado); }

  function enlazar(r) {
    window.scrollTo(0, 0);
    if (r.v === "planes") { const pl = $("#planes"); if (pl) requestAnimationFrame(() => pl.scrollIntoView({ behavior: "smooth" })); }
    // scroll reveal (Apple-style)
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach(el => obs.observe(el));
    // Vanilla Tilt: el celular sigue el mouse (sutil)
    if (typeof VanillaTilt !== "undefined") {
      const phone = $(".i-phone");
      if (phone) VanillaTilt.init(phone, { max: 8, speed: 800, scale: 1.01, glare: true, "max-glare": 0.08, "glare-prerender": false });
    }

    // GSAP ScrollTrigger: scroll-lock en Sets en vivo
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      const setBody = $("#demoSetBody");
      const secSets = $("#secSets");
      if (setBody && secSets) {
        const range = () => Math.max(0, setBody.scrollHeight - setBody.clientHeight);
        ScrollTrigger.create({
          trigger: secSets,
          start: "center center",
          end: () => "+=" + (range() || 600),
          pin: true,
          scrub: 0.8,
          onUpdate: self => {
            const r = range();
            if (r > 0) {
              setBody.scrollTop = r * self.progress;
              const idx = Math.min(Math.floor(self.progress * DEMO_SET.length), DEMO_SET.length - 1);
              if (idx !== demo.setIdx) { demo.setIdx = idx; $$(".i-m-item", setBody).forEach((el, i) => el.classList.toggle("on", i === idx)); }
            }
          }
        });
      }
      // Colores del PDF cambian con el scroll
      const PDF_C = ["#7E5BD0", "#FF3D1A", "#457A7F", "#F2B33D", "#D9558E"];
      const secPdf = $("#secPdf");
      const demoPdf = $("#demoPdf");
      if (secPdf && demoPdf) {
        ScrollTrigger.create({
          trigger: secPdf,
          start: "top 60%",
          end: "bottom 40%",
          scrub: 0.6,
          onUpdate: self => {
            const idx = Math.min(Math.floor(self.progress * PDF_C.length), PDF_C.length - 1);
            const c = PDF_C[idx];
            if (c !== demo.pdfColor) {
              demo.pdfColor = c;
              demoPdf.style.setProperty("--pdf-c", c);
              demoPdf.querySelectorAll(".i-pdf-dot").forEach(d => d.classList.toggle("on", d.dataset.pdfColor === c));
            }
          }
        });
      }
    }

    $$("[data-periodo]").forEach(b => b.onclick = () => { est.anual = b.dataset.periodo === "anual"; ss.set("ini-anual", est.anual); const y = scrollY; window.render(); requestAnimationFrame(() => scrollTo(0, y)); });
    const f1 = $("#ipaso1");
    if (f1) f1.onsubmit = e => {
      e.preventDefault();
      const f = flujo(); f.datos = { ...f.datos, nombre: f1.nombre.value.trim(), correo: f1.correo.value.trim(), ministerio: f1.ministerio.value.trim(), acepto: f1.acepto.checked };
      f.paso = plan(r.p[0]).mes === 0 ? 3 : 2; ponFlujo(f); window.render();
    };
    $$("[data-pers]").forEach(b => b.onclick = () => { const f = flujo(), pl = plan(r.p[0]); f.datos = f.datos || {}; f.datos.personas = Math.min(200, Math.max(pl.incluye, (+f.datos.personas || pl.incluye) + +b.dataset.pers)); ponFlujo(f); window.render(); });
    $$("[data-metodo]").forEach(b => b.onclick = () => { const f = flujo(); f.datos.metodo = b.dataset.metodo; ponFlujo(f); window.render(); });
    const at = $("#iatras"); if (at) at.onclick = () => { const f = flujo(); f.paso = 1; ponFlujo(f); window.render(); };
    const f2 = $("#ipaso2");
    if (f2) f2.onsubmit = e => {
      e.preventDefault();
      const b = $("#ipagar"); b.disabled = true; b.innerHTML = `<span class="giro" aria-hidden="true"></span> Confirmando tu pago…`;
      setTimeout(() => { const f = flujo(); f.paso = 3; f.folio = "CD-" + Date.now().toString(36).toUpperCase().slice(-6); ponFlujo(f); window.render(); }, 1800);
    };
    const al = $("#ialogin");
    if (al) al.onclick = () => { const f = flujo(); try { localStorage.setItem("cifrados-correo-login", JSON.stringify(f.datos.correo || "")); } catch (e) {} ponFlujo({ paso: 1, datos: {} }); location.hash = "#entrar"; };

    // ========== Demos interactivos: eventos (delegación) ==========
    const root = $(".inicio");
    if (root) root.addEventListener("click", e => {
      // Celular: clic en canción
      const songRow = e.target.closest("[data-demo-song]");
      if (songRow) { demo.vista = "cancion"; demo.cancionId = songRow.dataset.demoSong; updatePhone(); return; }
      // Celular: regresar a la librería
      if (e.target.closest("[data-demo-back]")) { demo.vista = "lib"; demo.cancionId = null; updatePhone(); return; }
      // Celular: pestañas
      const tabBtn = e.target.closest("[data-demo-tab]");
      if (tabBtn) { demo.tab = tabBtn.dataset.demoTab; updatePhone(); return; }
      // Toggle día/noche
      if (e.target.closest("#demoTheme")) {
        demo.oscuro = !demo.oscuro;
        $$(".i-phone-screen, .i-af-screen").forEach(s => s.classList.toggle("demo-light", !demo.oscuro));
        const btn = $("#demoTheme");
        if (btn) btn.textContent = demo.oscuro ? "☀️" : "🌙";
        return;
      }
      // Transposición: cambiar tono
      const tonoBtn = e.target.closest("[data-demo-tonos]");
      if (tonoBtn) {
        demo.tonos = parseInt(tonoBtn.dataset.demoTonos);
        const screen = $("#demoTonos");
        if (screen) screen.innerHTML = demoTonosHTML(demo.tonos);
        return;
      }
      // Set: seleccionar canción
      const setItem = e.target.closest("[data-demo-set]");
      if (setItem) {
        demo.setIdx = parseInt(setItem.dataset.demoSet);
        const body = $("#demoSetBody");
        if (body) body.innerHTML = demoSetHTML(demo.setIdx);
        return;
      }
      // PDF: cambiar color
      const pdfDot = e.target.closest("[data-pdf-color]");
      if (pdfDot) {
        demo.pdfColor = pdfDot.dataset.pdfColor;
        const container = pdfDot.closest(".i-pdf-demo");
        if (container) {
          container.style.setProperty("--pdf-c", demo.pdfColor);
          container.querySelectorAll(".i-pdf-dot").forEach(d => d.classList.toggle("on", d.dataset.pdfColor === demo.pdfColor));
        }
        return;
      }
    });
  }

  window.INICIO = { vista, enlazar, PLANES };
})();
