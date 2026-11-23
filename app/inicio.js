/* Página pública de CifraDios: inicio, planes y suscripción (pago SIMULADO, todavía sin Stripe ni ningún cobro).
   Rutas: #conoce (inicio), #planes (inicio en la sección de planes), #suscribir/<gratis|basico|pro> (registro y pago).
   Al terminar manda al login (#entrar) con el correo ya escrito.
   window.INICIO = { vista(r), enlazar(r) } — los usa render() en index.html. */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ss = { get(k, d) { try { const v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------- Planes: pesos mexicanos con IVA, por ministerio ----------
  // incluye = personas incluidas; extra = costo mensual por cada persona adicional. Anual = 10 meses (2 gratis).
  // De dónde salen los números: docs/PRECIOS.md
  const PLANES = [
    { id: "gratis", nombre: "Gratis", lema: "Para empezar a tocar", mes: 0, incluye: 1, extra: 0, color: "--sea",
      cosas: ["1 persona: tú y tus cifrados", "Tu librería personal (hasta 30 canciones)", "Banco de canciones de Tiempo de Dios", "Transponer, capo y notación: C D E · Do Re Mi · 1 4 5", "Solo letra y desplazamiento automático", "Guarda tu tono en cada canción", "1 set activo"] },
    { id: "basico", nombre: "Básico", lema: "Para tu ministerio", mes: 199, incluye: 10, extra: 19, color: "--flame", destacado: true,
      cosas: ["10 personas incluidas · +$19 por persona extra", "Todo lo de Gratis", "Canciones y sets ilimitados", "Sets litúrgicos por momentos de la misa", "Tu ministerio con integrantes y roles", "El tono de cada voz, a la mano", "PDF de tus sets (1 o 2 columnas, portada e índice)", "En vivo: quien dirige marca y todos lo siguen", "Voz principal y coros por sección"] },
    { id: "pro", nombre: "Pro", lema: "Para equipos que van con todo", mes: 349, incluye: 10, extra: 29, color: "--lav",
      cosas: ["10 personas incluidas · +$29 por persona extra", "Todo lo de Básico", "Pistas que cambian de tono y velocidad", "Sets compartidos con otros ministerios", "PDF con el logo y los colores de tu ministerio", "Importa SongbookPro, ChordPro y «acordes arriba»", "Red local: toquen sin internet en eventos", "Respaldo y exportación", "✨ Foto o PDF → cifrado: 100 páginas al mes (muy pronto)"] },
  ];
  const plan = id => PLANES.find(p => p.id === id) || PLANES[1];
  // mensual = base + personas extra; anual = 10 meses (2 gratis)
  const mensual = (p, personas) => (p.mes === 0 ? 0 : p.mes + Math.max(0, (personas || p.incluye) - p.incluye) * p.extra);
  const precio = (p, anual, personas) => (anual ? mensual(p, personas) * 10 : mensual(p, personas));
  const dinero = n => "$" + n.toLocaleString("es-MX");

  const est = { anual: ss.get("ini-anual", false) };
  const flujo = () => ss.get("ini-flujo", { paso: 1, datos: {} });
  const ponFlujo = f => ss.set("ini-flujo", f);

  const LOGO = `<img src="app-favicon.png" width="34" height="34" alt="" class="i-logo">`;
  const nav = logueado => `<header class="i-nav"><a href="#conoce" class="i-marca">${LOGO}<span><b>CifraDios</b><small>Tiempo de Dios</small></span></a>
    <nav><a href="#planes" class="i-lnk">Planes</a>${logueado ? `<a href="#libreria" class="i-btn sm">Abrir la app →</a>` : `<a href="#entrar" class="i-btn sm ghost">Entrar</a>`}</nav></header>`;

  // tarjeta de muestra con acordes sobre la letra
  const muestra = `<div class="i-demo" aria-hidden="true">
      <div class="i-demo-top"><span class="i-pill">Tono <b>G</b> → <b>A</b></span><span class="i-pill">Capo 2</span><span class="i-pill on">▼ Auto</span></div>
      <div class="i-demo-sec">Coro</div>
      <div class="i-ln"><span><i>A</i>Tu bondad </span><span><i>E/G#</i>nunca me aban</span><span><i>F#m</i>dona</span></div>
      <div class="i-ln"><span><i>D</i>Tu verdad </span><span><i>A</i>siempre me ha cui</span><span><i>E</i>dado</span></div>
      <div class="i-demo-sec rosa">Puente</div>
      <div class="i-ln"><span><i>F#m</i>Santo, </span><span><i>D</i>santo es el </span><span><i>A</i>Señor</span></div>
      <div class="i-demo-voz">🎤 Ale · coros: Memo, Ceci</div>
    </div>`;

  const FUNCIONES = [
    ["🎚️", "Transpón en un toque", "Sube o baja el tono y los acordes se acomodan solos. Con capo, en letras o en números."],
    ["⛪", "Sets para la misa", "Arma el set por momentos: Entrada, Ofertorio, Comunión… y llévalo al ensayo."],
    ["📡", "En vivo, todos juntos", "Quien dirige marca la canción y la sección, y en el celular de todos cambia al momento."],
    ["🎤", "El tono de cada voz", "Cada quien guarda su tono; al elegir voz principal, el set se pone en el suyo."],
    ["🖨️", "PDF con tu marca", "Cancioneros con portada, índice y los colores de tu ministerio. Listos para imprimir."],
    ["🤝", "Banco del colectivo", "Canciones de Tiempo de Dios y de los ministerios del colectivo, siempre en su última versión."],
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

  function vConoce(r, logueado) {
    return `<div class="inicio">${nav(logueado)}
      <section class="i-hero"><div class="i-wrap i-hero-in">
        <div class="i-hero-txt">
          <span class="i-eyebrow">Música católica · Tiempo de Dios</span>
          <h1>Tus cifrados, <em>listos para alabar.</em></h1>
          <p>La app para que tu ministerio toque cada canción en el tono correcto: acordes, letras y sets para la misa y el ensayo, sincronizados en el celular de todos.</p>
          <div class="i-ctas"><a href="#suscribir/gratis" class="i-btn">Empieza gratis</a><a href="#planes" class="i-btn ghost claro">Ver planes</a></div>
          <p class="i-mini">Sin tarjeta para el plan gratis · Funciona en celular, tablet y computadora</p>
        </div>${muestra}</div></section>
      <section class="i-sec"><div class="i-wrap">
        <h2>Todo lo que tu ministerio necesita <em>para tocar</em></h2>
        <div class="i-grid">${FUNCIONES.map(([ic, t, d]) => `<div class="i-feat"><span class="i-ic">${ic}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
      </div></section>
      <section class="i-sec alt" id="planes"><div class="i-wrap">
        <h2>Elige tu <em>plan</em></h2><p class="i-sub">Precio por ministerio, no por persona: todo tu equipo entra.</p>
        <div class="i-periodo" role="radiogroup" aria-label="Periodo de pago"><button role="radio" aria-checked="${!est.anual}" class="${!est.anual ? "on" : ""}" data-periodo="mes">Mensual</button><button role="radio" aria-checked="${est.anual}" class="${est.anual ? "on" : ""}" data-periodo="anual">Anual <span>2 meses gratis</span></button></div>
        <div class="i-planes">${PLANES.map(tarjetaPlan).join("")}</div>
        <p class="i-nota">Pesos mexicanos con IVA incluido. ¿Son más de 10? Cada persona extra se suma a tu plan. Cambia de plan o cancela cuando quieras.</p>
      </div></section>
      <section class="i-sec"><div class="i-wrap i-pasos">
        <h2>Así de <em>fácil</em></h2>
        <ol><li><b>Elige tu plan</b><span>Gratis para probar, Básico o Pro para todo tu ministerio.</span></li>
          <li><b>Crea tu cuenta</b><span>Te llega un correo para poner tu contraseña.</span></li>
          <li><b>Invita a tu equipo</b><span>Músicos y voces entran a los sets y guardan su tono.</span></li>
          <li><b>¡A tocar!</b><span>Del ensayo a la misa, todos en la misma página.</span></li></ol>
      </div></section>
      <section class="i-cierre"><div class="i-wrap"><h2>Que la música lleve a <em>Dios.</em></h2><p>Nosotros nos encargamos de que los acordes estén en orden.</p><a href="#suscribir/basico" class="i-btn">Empezar con mi ministerio</a></div></section>
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
    if (r.v === "planes") { const pl = $("#planes"); if (pl) requestAnimationFrame(() => pl.scrollIntoView()); }
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
  }

  window.INICIO = { vista, enlazar, PLANES };
})();
