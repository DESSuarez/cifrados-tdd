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
    <nav><a href="#planes" class="i-lnk">Planes</a><button class="i-dm-btn" id="demoTheme" title="Modo claro / oscuro">${demo.oscuro ? "☀️" : "🌙"}</button>${logueado ? `<a href="#libreria" class="i-btn sm">Abrir la app →</a>` : `<a href="#entrar" class="i-btn sm ghost">Entrar</a>`}</nav></header>`;

  // ========== Demos interactivos: datos ==========
  const DEMO_SONGS = [
    { id: "d1", titulo: "Nadie Igual (Misericordia)", autor: "KAYRÓS", tono: "B", miTono: "G", grupo: "tdd",
      cp: "{c: Verso}\n[B9]Misericordia, [B9/F#]misericordia\n¿Dónde te en[B9/G#]cuentran los que pre[B/E]guntan por ti?\n\n[B9]Misericordia, [B9/F#]misericordia\nMi alma te es[B9/G#]pera, tu has hecho [B/E]tanto por mi\n\n{c: Precoro}\nAl[B9]tísimo, ven a salvarnos\nAl[B9/F#]tísimo, cuento contigo\nAl[B9/G#]tísimo, ven con tu amor y [B/E]verdad\n\n{c: Coro}\nY [B9]álzate Dios, sobre los cielos\nY en [F#]toda la tierra, tu gloria, tu [G#m]gloria, des[E]cienda\n\nÁl[B9]zate Dios, ven a tu pueblo\nSe[F#]ñor manifiesta tu gloria, tu [G#m]gloria\nQue todos vean que no [E]hay nadie igual\nNo hay nadie igual, [B9]que Tú" },
    { id: "d2", titulo: "En Ti Confío", autor: "Surgit Iglessia", tono: "F", grupo: "tdd",
      cp: "{c: Verso}\n[F]En este encuentro [Bb9]santo\n[F]Muéstrame qué de[Bb9]cir\n[F]Abre Señor mis la[Dm]bios\n[Bb9]Y mi voz cantará para [C]Tí\n\n{c: Coro}\n[Bb9]Revélame el [F]misterio de tu co[C]razón\n[Bb9]Renuévame por [F]dentro dame di[C]rección\n[Bb9]Enséñame en se[C]creto tu sabidu[Dm]ría\nSáciame,[C]Señor, mi alma necesi[Bb9]ta de tu agua [C]viva" },
    { id: "d3", titulo: "Poderoso Nombre", autor: "Zamar Adoración", tono: "E", grupo: "tdd",
      cp: "{c: Verso}\n[A]    Preparo mi al[C#m]ma\n[A]    Sé que en este mo[C#m]mento provee[B]rás\n[A]    Libero mis car[C#m]gas\n[A]    Como en el pa[C#m]sado actua[B]rás\n\n{c: Precoro}\nPor fe [A]\nA[E]briste el mar y el pueblo fue salva[B]do\nPor fe [A]\nA[E]quellos tres danzaron en el fuego[B]\n\n{c: Coro}\nCosas gran[A]des sucede[E]rán\nSi pro[C#m]clamo y bendigo tu nom[B]bre\nJe[A]sús, Je[E]sús, de [C#m]ti yo quiero [B]más" },
    { id: "d4", titulo: "Salmo 145", autor: "ANAWIM", tono: "E", grupo: "lit",
      cp: "{c: Verso}\n[A]Te ala[E]baré a [B]Ti que eres Rey\n[A]Digno [E]serás de[B] alabar\n[A]Día [E]tras día [B]te bendeciré\n[A]Grande [E]eres Tú[B], insondable tu amor\n\n{c: Coro}\n[C#m]Tú eres bueno\n[A]Tú eres fiel\n[E]Y glorioso\n[B]Cantaré de tu victoria\n\n[C#m]Eres digno\n[A]De alabar\n[E]Oh, Señor\n[B]Tú eres Santo, Santo, Santo" },
    { id: "d5", titulo: "Poderoso", autor: "Kayrós", tono: "G", miTono: "E", grupo: "tdd",
      cp: "{c: Verso}\nEn tu pre[C]sencia, quiero ren[D]dirme\nEn tu pre[Em]sencia, puedo ser [Bm]libre\nEn tu pre[C]sencia, quiero en[D]tregarme\nEn tu pre[Em]sencia, humilde ala[Bm]barte\n\n{c: Pre-Coro}\n[C]  Por tu gracia encon[D]tré [-]la[Em] verdad\n[Bm]  Tu gran[C]deza me salva[D]rá\n\n{c: Coro}\nPode[C]roso, pode[G]roso, pode[Em]roso mi [D]Dios\nPode[C]roso, pode[G]roso, pode[Em]roso mi [D]Dios" },
    { id: "d6", titulo: "Quién Contra Mí", autor: "Surgit Iglessia", tono: "Db", grupo: "tdd",
      cp: "{c: Verso}\nQuién eres [Db9]Tú\nQue to[Gb]maste mi lugar\nEn esa [Db9]cruz\nQue qui[Gb]siste liberar\nMi esclavi[Ebm]tud\n\n{c: Coro}\nPero [Gb]Tú  [Db9]   nunca mi[Bbm]raste mi debili[Ab]dad\nSiempre [Gb]Tú  [Db9]   me das la [Bbm]mano para cami[Ab]nar\nsin miedo\n\n[Gb]   Disipa [Db9]mi temor,[Bbm]   sé Tú mi [Ab]fortaleza\n[Gb]   gobierna a[Db9]quí en mi cora[Ab]zón" },
    { id: "d7", titulo: "En Tu Nombre Sáname", autor: "KAYRÓS × ZAMAR × ANAWÍM", tono: "F#", grupo: "tdd",
      cp: "{c: Estrofa}\n[C#]Mira la sed de mi alma[G#m]    [D#m]\nY lo que hay en mi interior\nCon una sola palabra\nRevela mi condición\n\n{c: Precoro}\n[B]Levantas muertos\n[C#]Llueves en desiertos\n¿Podrás también hacerlo en mí?\n\n{c: Coro}\n[D#m]Ven manifiesta[B] tu [F#]poder     [C#]\n[D#m]Dile a mi cuer[B]po [F#]que tú eres[C#] rey\n[D#m]Dile a mi his[B]toria [F#]que has [C#]sido fiel\n[B]Jesús en tu nombre, sáname       [C#]" },
    { id: "d8", titulo: "Confiaré", autor: "ZAMAR", tono: "G", grupo: "tdd",
      cp: "{c: Verso}\nLa [Em]duda terminó, [C]sé que has vencido\nSolo espe[G]raré nunca me has fa[Dsus4]llado\nHe [Em]visto tu poder, anhelo tus promesas\nSolo es[G]peraré\nMi mundo habrás [Dsus4]cambiado\n\n{c: Coro}\nConfia[Em]ré, confia[C]ré en tu voluntad\nPermane[G]ciendo anclado a tu ver[Dsus4]dad\n\n{c: Puente}\nSé lo que ha[Em]rás en mí\nSé lo que ha[C]rás en mí\nAbre los [G]cielos\nDescanso en [Dsus4]ellos" },
    { id: "d9", titulo: "Dios Del Presente", autor: "ARIA", tono: "D", grupo: "tdd",
      cp: "{c: Verso}\n[D]Eres el Dios del pre[F#m]sente\nme pides que [Bm]suelte\ny confíe en [G]tí\n[D]nada sale de tus [F#m]manos\nconoces mis [Bm]pasos\ny cuidas de [G]mí\n\n{c: Coro}\n[D]Hija de mi [F#m]corazón\nya no [Bm]temas, aquí es[G]toy\n[D]hija de mis [F#m]sueños\nno tengas [Bm]miedo, aquí es[G]toy" },
    { id: "d10", titulo: "Te Entrego Todo", autor: "Aria", tono: "C", grupo: "tdd",
      cp: "{c: Verso}\n[C]He buscado tanto noche y [Am]día\nLa [C]Paz que solo encuentro en la ora[Am]ción\nHa[C]yo en tu presencia mi ale[Am]gría\nHay[C] tanta ternura en ti Je[G]sús\n\n{c: Coro}\nLo entregas [F]todo, no te guardas [C]nada\nEs tu de[F]seo, que me sepa a[C]mada" },
    { id: "d11", titulo: "Todo Por Mí", autor: "Alex Patrón", tono: "E", grupo: "tdd",
      cp: "{c: Verso}\nEn todas par[Eadd9]tes\nbusqué sin ce[B]sar\na quien me [C#m]ame\ny me pueda [Bsus4/F#]sanar\nde tanta sole[A]dad\ny se quiera que[B]dar\n\n{c: Coro}\n[E]No hay amor que pueda comparar\ncon [C#m]todo lo que tú me quieres dar\nme [A]amas tanto que quisiste [B]dar\ntodo por [A]mí\n[B]    todo por [Eadd9]mí" },
    { id: "d12", titulo: "Vine A Adorarte", autor: "Misa", tono: "D", grupo: "lit",
      cp: "{c: Verso}\n[D]Tú eres la [A]luz\nQue bri[Em]llo en las ti[Gadd9]nieblas\n[D]Abrió mis [A]ojos pude [Gadd9]ver\n\n[D]Mi cora[A]zón ado[Em]ra Tu hermo[Gadd9]sura\nEspe[D]ranza de mi [A]vida eres [Gadd9]Tú\n\n{c: Coro}\nVine a ado[D]rarte\nVine a pos[A]trarme\nVine a de[Bm]cir que eres mi[Gadd9] Dios\nSolo tú eres [D]grande\nSolo tu eres [A/C#]digno\neres asom[Bm]broso para[Gadd9] mi" },
    { id: "d13", titulo: "Piedad", autor: "Surgit", tono: "Em", grupo: "lit",
      cp: "{c: Parte 1}\nSe[Em]ñor, ten pie[Am]dad de no[Em]so[B7]o[Em]tros\nSe[Em]ñor, ten pie[Am]dad de no[Em]so[B7]o[Em]tros\n\n{c: Parte 2}\n[G]Cristo, ten pie[Am]dad de no[Em]so[B7]o[Em]tros\n[G]Cristo, ten pie[Am]dad de no[Em]so[B7]o[Em]tros" },
    { id: "d14", titulo: "Gloria Al Señor", autor: "KAYRÓS", tono: "D", grupo: "lit",
      cp: "{c: Verso}\n[G]Señor Dios del uni[D]verso\n[A]No hay nadie como Tú[Bm] [A]\nTú eres [G]fuerte [D]y leal\n[A]Tú calmas toda tem[Bm]pes[-]tad\n\n{c: Coro}\n[G]Glo[D]ria, [A]gloria al Se[Bm]ñor[A]\n[G]Siempre haz es[D]tado a mi fa[A]vor\nTu [G]mano es mi fir[D]meza\nTu [A]brazo mi va[Bm]lor\nPor [G]eso canto ¡[D]Gloria al Se[A]ñor!" },
    { id: "d15", titulo: "Aleluya (Celta)", autor: "Música Litúrgica", tono: "A", grupo: "lit",
      cp: "{c: Cancion}\n[A]Aale lu [E]ya [D]Aale [E]lu ya\n[A]Aale lu [E]ya [D]Aale [E]lu ya" },
    { id: "d16", titulo: "Te Entrego", autor: "Misa", tono: "D", grupo: "lit",
      cp: "{c: Verso}\n[D]Haz lo que quieras con[G]migo\n[Bm]Haz lo que quieras de [A]mí\n[Em]Hoy yo te ofrezco mi [Bm]vida\n[G]Hoy yo me rindo ante [A]Ti\n\n{c: Coro}\nTe en[D]trego\nTodo lo que [Em]soy, todo [F#m]lo que [Bm]tengo\nTodo lo que [A]quiero y todo [D]lo que [G]sueño\nA [Em]Ti Señor Je[A]sús" },
    { id: "d17", titulo: "Santo (Luna)", autor: "Misa", tono: "Am", grupo: "lit",
      cp: "[A7]Saaanto[Dm]oo [G]saaantoo[C]o\n[Am]Santo es el Se[Dm]ñor, Dios del [E]u[E7]niver[Am]so\n\n[A7]Lleeenos estaa[Dm]an, el [G]cielo y la [C]tierra\n[Am]De tu [Dm]gloria, [E]ho[E7]saaan[Am]naaa\n\n[A7]Hooosan[Dm]naaa, [G]hooosanna[C]aa\n[Am]hooosanna[Dm]aa [E]En [E7]el [Am]cielo" },
    { id: "d18", titulo: "Cordero", autor: "Tradicional", tono: "C", grupo: "lit",
      cp: "[C]Cooordero de [Am]Dios\nque [Dm]quitas el pe[G]cado del [C]mundo\nTen pie[Am]dad de no[F]sotros\n[G]ten pie[C]dad\n\n[C]Cooordero de [Am]Dios\nque [Dm]quitas el pe[G]cado del [C]mundo\n[Am]Daaanos la [F]paz\n[G]dános[C]la" },
    { id: "d19", titulo: "Eucaristía", autor: "Kairy Márquez", tono: "G", grupo: "lit",
      cp: "{c: Verso}\nA[G]hí en la Eucaris[D/F#]tía\nEs[Am]tá tu presencia Se[D]ñor\nA[G]hí en la Eucaris[D/F#]tía\nEs[Am]tá la prueba de que [C]Tú vives [D]Cristo\n\n{c: Coro}\nTu [G]cuer[-]po[D/F#], Tu [-][Em]sangre\n[D]Me da [C]vida Se[Am]ñor\nMe da [C]vida[D]" },
    { id: "d20", titulo: "Gloria (Salida)", autor: "Misa", tono: "C", grupo: "lit",
      cp: "{c: Coro}\n[C]Gloria[G/B] al Se[Am]ñor\nque [G]reina en el [C]cielo[C7]\n[F]Y en la tierra [C]paz\na los [G]hombres que ama [C]él\n\n{c: Verso}\n[C]Señor te [G/B]ala - [C]bamos\n[F]Señor te bende[C]ci[C7]mos\n[F]Todos te ado[C]ramos\n[G]Gracias por tu [C]gloria" },
    { id: "d21", titulo: "Madre Presente", autor: "Flávio Vitor Jr.", tono: "Db", grupo: "lit",
      cp: "{c: Verso}\n[Db]Un bello [Bbm]manto azul\nEstá so[Gb]bre mí\nY mi [Ebm]casa cubier[Db]ta está\nLa [Bbm]madre de Dios\nElla [Gb]cuida de mí\nElla[Ebm7] intercede\n\n{c: Coro}\nMadre pre[Ab]sente\nEl hijo siempre a[Gb]tiende\nY yo soy depen[Ab]diente\nDe ese abrazo de A[Bbm7]mor" },
  ];
  const DEMO_SET = [
    { momento: "ENTRADA", cancion: "d12", tonoSet: "D" },
    { momento: "PIEDAD", cancion: "d13", tonoSet: "Em" },
    { momento: "GLORIA", cancion: "d14", tonoSet: "D" },
    { momento: "ACLAMACIÓN", cancion: "d15", tonoSet: "A" },
    { momento: "OFERTORIO", cancion: "d16", tonoSet: "D" },
    { momento: "SANTO", cancion: "d17", tonoSet: "Am" },
    { momento: "CORDERO", cancion: "d18", tonoSet: "C" },
    { momento: "COMUNIÓN", cancion: "d19", tonoSet: "G" },
    { momento: "SALIDA", cancion: "d20", tonoSet: "C" },
    { momento: "MARIANO", cancion: "d21", tonoSet: "Db" },
  ];
  const dSong = id => DEMO_SONGS.find(c => c.id === id);
  const demo = { vista: "lib", cancionId: null, oscuro: true, tab: "tdd", tonos: 0, notacion: "americano", setIdx: 0, setCancion: null, pdfColor: "#7E5BD0" };

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
  function demoTonosHTML(semis, notacion) {
    const c = dSong("d1");
    if (!c || !window.CIF) return "";
    const tonoFinal = CIF.transportaTono(c.tono, semis);
    const opNot = notacion === "latino" ? { latina: true } : notacion === "nashville" ? { nashville: true, tonoFinal } : {};
    const html = CIF.aHTML(c.cp, { semis, tonoFinal, ...opNot });
    const BT = [
      { l: "Original", t: c.tono, s: 0 },
      { l: "★ Mi tono", t: "G", s: CIF.distancia(c.tono, "G") },
      { l: "Daniela", t: "E", s: CIF.distancia(c.tono, "E") },
      { l: "Set", t: "A", s: CIF.distancia(c.tono, "A") },
    ];
    const NOTS = [["americano", "A D G"], ["latino", "La Re Sol"], ["nashville", "1 4 5"]];
    return `<div class="i-af-band"><b>${esc(c.titulo)}</b><small>${esc(c.autor)} · Original ${c.tono}</small></div>
      <div class="i-m-bar">${BT.map(b => `<span class="i-m-tone${b.s === semis ? " act" : ""}" data-demo-tonos="${b.s}">${b.l} <b>${b.t}</b></span>`).join("")}</div>
      <div class="i-m-bar i-m-notbar">${NOTS.map(([k, ej]) => `<span class="i-m-tone i-m-not${k === notacion ? " act" : ""}" data-demo-not="${k}">${ej}</span>`).join("")}</div>
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
    </div></div>`;
  }
  function mockTonosHTML() {
    return `<div class="i-app-frame"><div class="i-af-notch"></div><div class="i-af-screen${demo.oscuro ? "" : " demo-light"}" id="demoTonos">${demoTonosHTML(demo.tonos, demo.notacion)}</div></div>`;
  }
  function demoSetCancionHTML(idx) {
    const it = DEMO_SET[idx];
    if (!it) return "";
    const c = dSong(it.cancion);
    if (!c || !window.CIF) return "";
    const tono = it.tonoSet || c.tono;
    const semis = CIF.distancia(c.tono, tono);
    const html = CIF.aHTML(c.cp, { semis, tonoFinal: tono });
    return `<div class="i-af-band"><div style="display:flex;align-items:center;gap:6px"><span class="i-demo-back" data-demo-setback style="cursor:pointer">‹</span><b>${esc(c.titulo)}</b><span class="i-ps-chip" style="margin:0;font-size:10px">${tono}</span></div>
      <small>${esc(c.autor)} · ${it.momento}</small></div>
      <div class="i-af-body i-demo-scroll">${html}</div>`;
  }
  function mockSetHTML() {
    const inner = demo.setCancion !== null ? demoSetCancionHTML(demo.setCancion) : `<div class="i-af-band"><b>Misa dominical <span class="i-m-live">● En vivo</span></b></div>
      <div class="i-af-body" id="demoSetBody">${demoSetHTML(demo.setIdx)}</div>`;
    return `<div class="i-app-frame"><div class="i-af-notch"></div><div class="i-af-screen${demo.oscuro ? "" : " demo-light"}" id="demoSetScreen">${inner}</div></div>`;
  }
  function mockPdfHTML() {
    const C = [
      ["#7E5BD0", "Lavanda"], ["#FF3D1A", "Flame"], ["#457A7F", "Deep sea"], ["#F2B33D", "Sol"], ["#D9558E", "Rosa"],
      ["#2B7B8A", "Teal"], ["#8B4513", "Madera"], ["#4A90D9", "Cielo"], ["#E85D75", "Coral"], ["#2ECC71", "Menta"],
      ["#9B59B6", "Uva"], ["#E67E22", "Naranja"], ["#1ABC9C", "Turquesa"], ["#C0392B", "Vino"], ["#34495E", "Noche"],
      ["#F39C12", "Oro"], ["#16A085", "Jade"], ["#8E44AD", "Morado"], ["#D35400", "Ladrillo"], ["#2980B9", "Azul"],
    ];
    return `<div class="i-pdf-demo" id="demoPdf" style="--pdf-c:${demo.pdfColor}">
      <div class="i-pdf-colors">${C.map(([c, n]) => `<button class="i-pdf-dot${c === demo.pdfColor ? " on" : ""}" style="background:${c}" data-pdf-color="${c}" title="${n}"></button>`).join("")}</div>
      <div class="i-mock i-m-pdf i-m-pdf-lg"><div class="i-m-cover">
        <div class="i-m-logo">K</div><b>KAYRÓS</b><small>Set dominical · 24 nov 2026</small>
      </div><div class="i-m-page">
        <div class="i-m-sec">Verso</div>
        <div class="i-m-line"><i>A</i><i>D</i></div>
        <div class="i-m-letra">Tú eres el principio y el final</div>
        <div class="i-m-line"><i>A</i><i>E</i></div>
        <div class="i-m-letra">Mi primer amor</div>
        <div class="i-m-sec rosa">Coro</div>
        <div class="i-m-line"><i>F#m</i><i>E</i></div>
        <div class="i-m-letra">Aquí estoy</div>
        <div class="i-m-line"><i>D</i><i>A</i></div>
        <div class="i-m-letra">Para adorarte</div>
        <div class="i-m-line"><i>F#m</i><i>E</i></div>
        <div class="i-m-letra">Aquí estoy</div>
        <div class="i-m-line"><i>D</i><i>A</i></div>
        <div class="i-m-letra">Para rendirme</div>
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
    // GSAP ScrollTrigger: scroll-lock en Sets en vivo
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      const setBody = $("#demoSetBody");
      const secSets = $("#secSets");
      if (setBody && secSets) {
        const range = () => Math.max(0, setBody.scrollHeight - setBody.clientHeight);
        ScrollTrigger.create({
          trigger: secSets,
          start: "top 30%",
          end: () => "+=" + Math.max(500, DEMO_SET.length * 60),
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1.2,
          invalidateOnRefresh: true,
          onUpdate: self => {
            if (demo.setCancion !== null) return;
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
      const PDF_C = ["#7E5BD0", "#FF3D1A", "#457A7F", "#F2B33D", "#D9558E", "#2B7B8A", "#8B4513", "#4A90D9", "#E85D75", "#2ECC71", "#9B59B6", "#E67E22", "#1ABC9C", "#C0392B", "#34495E", "#F39C12", "#16A085", "#8E44AD", "#D35400", "#2980B9"];
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
      // Toggle día/noche (sitio completo + mockups)
      if (e.target.closest("#demoTheme")) {
        demo.oscuro = !demo.oscuro;
        root.classList.toggle("site-light", !demo.oscuro);
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
        if (screen) screen.innerHTML = demoTonosHTML(demo.tonos, demo.notacion);
        return;
      }
      // Transposición: cambiar notación
      const notBtn = e.target.closest("[data-demo-not]");
      if (notBtn) {
        demo.notacion = notBtn.dataset.demoNot;
        const screen = $("#demoTonos");
        if (screen) screen.innerHTML = demoTonosHTML(demo.tonos, demo.notacion);
        return;
      }
      // Set: clic en canción → abrir vista
      const setItem = e.target.closest("[data-demo-set]");
      if (setItem) {
        const idx = parseInt(setItem.dataset.demoSet);
        demo.setIdx = idx;
        demo.setCancion = idx;
        const screen = $("#demoSetScreen");
        if (screen) screen.innerHTML = demoSetCancionHTML(idx);
        return;
      }
      // Set: regresar a la lista
      if (e.target.closest("[data-demo-setback]")) {
        demo.setCancion = null;
        const screen = $("#demoSetScreen");
        if (screen) { screen.innerHTML = `<div class="i-af-band"><b>Misa dominical <span class="i-m-live">● En vivo</span></b></div><div class="i-af-body" id="demoSetBody">${demoSetHTML(demo.setIdx)}</div>`; }
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
