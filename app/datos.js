/* Datos: primero local (IndexedDB), luego la nube (Supabase).
   - Todo se lee y se escribe en el dispositivo, así la app funciona sin internet.
   - Cada cambio entra a una "bandeja de salida"; al haber conexión se sube y se borra de la bandeja.
   - Con conexión, Supabase Realtime avisa de los cambios del resto del ministerio y se guardan aquí al momento.
   - Conflictos: gana el cambio más reciente (`actualizado`).
   Sin config de Supabase la app corre en "modo local" (un solo dispositivo), útil para probar. */
(function () {
  "use strict";
  const TABLAS = ["cif_canciones", "cif_tonos", "cif_sets", "cif_tracks", "cif_ministerios", "cif_miembros", "cif_perfiles", "cif_solicitudes", "cif_amistades", "cif_anuncios", "cif_intercambios"];
  // tablas chicas: se bajan completas para notar las bajas
  const CHICAS = new Set(["cif_miembros", "cif_ministerios", "cif_perfiles", "cif_solicitudes", "cif_amistades", "cif_anuncios", "cif_intercambios"]);
  const CON_AUTOR = new Set(["cif_canciones", "cif_sets", "cif_tracks"]); // tienen columna actualizado_por
  const LLAVE = { cif_tonos: r => r.cancion_id + "|" + r.persona_id, cif_miembros: r => r.ministerio_id + "|" + r.persona_id };
  const llaveDe = (t, r) => (LLAVE[t] ? LLAVE[t](r) : r.id);
  const cfg = window.CIFRADOS_CONFIG || {};
  const nube = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = nube ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true } }) : null;
  // Modo RED: la app la sirve el servidor de red local (red/servidor.js) en la compu de quien dirige; no necesita internet.
  const red = !!cfg.red && !nube;
  const MODO = nube ? "nube" : red ? "red" : "local";

  // ---------- IndexedDB mínimo ----------
  let dbp;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open("cifrados-tdd", 5);
      r.onupgradeneeded = () => {
        const d = r.result;
        TABLAS.forEach(t => { if (!d.objectStoreNames.contains(t)) d.createObjectStore(t); });
        if (!d.objectStoreNames.contains("_salida")) d.createObjectStore("_salida", { autoIncrement: true });
        if (!d.objectStoreNames.contains("_meta")) d.createObjectStore("_meta");
        if (!d.objectStoreNames.contains("_audio")) d.createObjectStore("_audio");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, modo, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, modo), s = t.objectStore(store);
      let out;
      Promise.resolve(fn(s)).then(v => (out = v));
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const todos = store => tx(store, "readonly", s => req(s.getAll()));
  const meta = {
    get: k => tx("_meta", "readonly", s => req(s.get(k))),
    set: (k, v) => tx("_meta", "readwrite", s => s.put(v, k)),
  };

  // ---------- Memoria + avisos ----------
  const mem = {}; TABLAS.forEach(t => (mem[t] = new Map()));
  const oyentes = new Set();
  let avisoPend = null;
  function avisa(tabla) {
    clearTimeout(avisoPend);
    avisoPend = setTimeout(() => oyentes.forEach(f => { try { f(tabla); } catch (e) { console.error(e); } }), 30);
  }
  const estado = { enLinea: navigator.onLine, sincronizando: false, pendientes: 0, ultima: null, nube, modo: MODO, usuario: null, error: "", redOk: false, conectados: 0 };
  const oyEstado = new Set();
  const avisaEstado = () => oyEstado.forEach(f => f({ ...estado }));

  async function cargarLocal() {
    for (const t of TABLAS) {
      const filas = await todos(t);
      filas.forEach(r => mem[t].set(llaveDe(t, r), r));
    }
    estado.pendientes = (await todos("_salida")).length;
    estado.ultima = await meta.get("ultima");
  }

  /** Guarda localmente si es más nuevo que lo que hay. */
  async function aplicar(tabla, filas, borrar) {
    const nuevas = [];
    for (const r of filas) {
      const k = llaveDe(tabla, r), prev = mem[tabla].get(k);
      if (borrar) { mem[tabla].delete(k); nuevas.push([k, null]); continue; }
      if (prev && prev.actualizado && r.actualizado && prev.actualizado > r.actualizado) continue;
      mem[tabla].set(k, r); nuevas.push([k, r]);
    }
    if (!nuevas.length) return;
    await tx(tabla, "readwrite", s => nuevas.forEach(([k, r]) => (r ? s.put(r, k) : s.delete(k))));
    avisa(tabla);
  }

  const ahora = () => new Date().toISOString();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2));

  /** Escribe (local + bandeja de salida). */
  async function guardar(tabla, fila) {
    const r = { ...fila, actualizado: ahora() };
    if (!LLAVE[tabla] && !r.id) r.id = uuid();
    if (estado.usuario && CON_AUTOR.has(tabla)) r.actualizado_por = estado.usuario.id;
    await aplicar(tabla, [r]);
    await tx("_salida", "readwrite", s => s.add({ tabla, op: "upsert", fila: r }));
    estado.pendientes++; avisaEstado();
    subir();
    return r;
  }
  async function borrar(tabla, fila) {
    // las canciones y sets se marcan como borrados (así el borrado también viaja a los demás)
    if (tabla === "cif_canciones" || tabla === "cif_sets") return guardar(tabla, { ...fila, borrada: true });
    await aplicar(tabla, [fila], true);
    await tx("_salida", "readwrite", s => s.add({ tabla, op: "delete", fila }));
    estado.pendientes++; avisaEstado();
    subir();
  }

  // ---------- Sincronización ----------
  let subiendo = false;
  async function subir() {
    if (red) return subirRed();
    if (!nube || !estado.usuario || !navigator.onLine || subiendo) return;
    subiendo = true; estado.sincronizando = true; avisaEstado();
    try {
      const d = await db();
      const items = await new Promise((res, rej) => {
        const out = []; const c = d.transaction("_salida").objectStore("_salida").openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
        c.onerror = () => rej(c.error);
      });
      for (const [k, it] of items) {
        let error;
        if (it.op === "upsert") {
          const conflicto = it.tabla === "cif_tonos" ? "cancion_id,persona_id" : it.tabla === "cif_miembros" ? "ministerio_id,persona_id" : "id";
          ({ error } = await sb.from(it.tabla).upsert(it.fila, { onConflict: conflicto }));
        } else {
          let q = sb.from(it.tabla).delete();
          if (it.tabla === "cif_tonos") q = q.eq("cancion_id", it.fila.cancion_id).eq("persona_id", it.fila.persona_id);
          else if (it.tabla === "cif_miembros") q = q.eq("ministerio_id", it.fila.ministerio_id).eq("persona_id", it.fila.persona_id);
          else q = q.eq("id", it.fila.id);
          ({ error } = await q);
        }
        // Sin código = falló la red: se deja en la bandeja y se reintenta después.
        // Con código (permiso, llave foránea, columna, duplicado…) el servidor la rechazó: reintentar no sirve,
        // se descarta para que no atore la cola (antes un solo cambio malo dejaba "Subiendo N cambios…" para siempre).
        if (error && !error.code && !/permission|policy|violates|RLS/i.test(error.message)) throw error;
        if (error) { estado.error = ""; console.warn("La nube rechazó un cambio de " + it.tabla + ":", error.message); }
        await tx("_salida", "readwrite", s => s.delete(k));
        estado.pendientes = Math.max(0, estado.pendientes - 1);
      }
    } catch (e) { console.warn("subir", e); estado.error = "Sin conexión con la nube; se reintentará."; }
    subiendo = false; estado.sincronizando = false; avisaEstado();
  }

  async function bajar() {
    if (!nube || !estado.usuario || !navigator.onLine) return;
    estado.sincronizando = true; avisaEstado();
    try {
      const desde = (await meta.get("ultima")) || "1970-01-01T00:00:00Z";
      const inicio = ahora();
      for (const t of TABLAS) {
        let q = sb.from(t).select("*").limit(10000);
        if (!CHICAS.has(t)) q = q.gt("actualizado", desde);
        const { data, error } = await q;
        if (error) { console.warn(t, error.message); continue; }
        if (CHICAS.has(t)) {
          // tablas pequeñas: se reemplazan completas (así se notan las bajas)
          mem[t].clear(); await tx(t, "readwrite", s => s.clear());
        }
        await aplicar(t, data || []);
      }
      await meta.set("ultima", inicio); estado.ultima = inicio; estado.error = "";
    } catch (e) { console.warn("bajar", e); estado.error = "No se pudo bajar de la nube."; }
    estado.sincronizando = false; avisaEstado();
  }

  let canal;
  function escuchar() {
    if (!nube || canal) return;
    canal = sb.channel("cifrados");
    TABLAS.forEach(t => canal.on("postgres_changes", { event: "*", schema: "public", table: t }, p => {
      if (p.eventType === "DELETE") aplicar(t, [p.old], true); else aplicar(t, [p.new]);
    }));
    canal.subscribe();
  }

  // ---------- RED LOCAL (servidor en la compu de quien dirige) ----------
  const RED_PIN = "cifrados-red-pin", RED_YO = "cifrados-red-yo";
  const lsg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lss = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  async function fetchRed(ruta, opts = {}, base = location.origin, pin = lsg(RED_PIN)) {
    const r = await fetch(base + ruta, { ...opts, headers: { "Content-Type": "application/json", "x-pin": pin || "", ...(opts.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { const e = new Error(j.error || "PIN incorrecto."); e.pin = true; throw e; }
    if (!r.ok) throw new Error(j.error || "Error " + r.status);
    return j;
  }
  /** Baja todo lo del servidor de red (reemplaza la copia local de este dispositivo). */
  async function bajarRed() {
    try {
      const { tablas } = await fetchRed("/api/datos");
      for (const t of TABLAS) {
        mem[t].clear(); await tx(t, "readwrite", s => s.clear());
        await aplicar(t, tablas[t] || []);
      }
      estado.redOk = true; estado.error = "";
    } catch (e) { estado.redOk = false; estado.error = e.pin ? "PIN incorrecto" : "No encuentro el servidor de red."; if (e.pin) throw e; }
    avisaEstado();
  }
  let subiendoRed = false;
  async function subirRed() {
    if (!red || subiendoRed || !lsg(RED_PIN)) return;
    subiendoRed = true; estado.sincronizando = true; avisaEstado();
    try {
      const d = await db();
      const items = await new Promise((res, rej) => {
        const out = []; const c = d.transaction("_salida").objectStore("_salida").openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
        c.onerror = () => rej(c.error);
      });
      if (items.length) {
        await fetchRed("/api/guardar", { method: "POST", body: JSON.stringify({ cambios: items.map(([, it]) => it) }) });
        await tx("_salida", "readwrite", s => items.forEach(([k]) => s.delete(k)));
        estado.pendientes = Math.max(0, estado.pendientes - items.length);
      }
      estado.redOk = true;
    } catch (e) { estado.redOk = false; estado.error = "Sin conexión con el servidor de red; se reintentará."; }
    subiendoRed = false; estado.sincronizando = false; avisaEstado();
  }
  let ws = null, wsReintento = null;
  const vivosRed = new Map(); // setId → función
  function conectarWS() {
    if (!red || !lsg(RED_PIN) || (ws && ws.readyState <= 1)) return;
    try { ws = new WebSocket(location.origin.replace(/^http/, "ws") + "/ws?pin=" + encodeURIComponent(lsg(RED_PIN))); } catch (e) { return; }
    ws.onopen = () => { estado.redOk = true; estado.error = ""; avisaEstado(); subirRed().then(() => bajarRed()).catch(() => {}); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.tipo === "cambios") m.cambios.forEach(c => aplicar(c.tabla, [c.fila], c.op === "delete"));
      else if (m.tipo === "recarga") bajarRed().catch(() => {});
      else if (m.tipo === "conectados") { estado.conectados = m.n; avisaEstado(); }
      else if (m.tipo === "vivo" && vivosRed.has(m.set)) vivosRed.get(m.set)(m.payload);
    };
    ws.onclose = () => { estado.redOk = false; estado.conectados = 0; avisaEstado(); clearTimeout(wsReintento); wsReintento = setTimeout(conectarWS, 3000); };
    ws.onerror = () => {};
  }
  /** Entrar a la red con el PIN que muestra el servidor. */
  async function entrarRed(pin) {
    await fetchRed("/api/datos", {}, location.origin, pin); // valida el PIN
    lss(RED_PIN, pin); await bajarRed(); conectarWS();
  }
  /** En la red cada quien dice quién es (es una red de confianza; no hay contraseñas). */
  function elegirYo(id) { lss(RED_YO, id); estado.usuario = id ? { id, email: "" } : null; avisaEstado(); }
  const pinRed = () => lsg(RED_PIN);

  // Desde la app de la nube, en la MISMA compu donde corre el servidor (http://localhost:8787):
  /** Copia todo lo de este dispositivo al servidor de red, para usarlo sin internet. */
  async function enviarARed(base) {
    const tablas = Object.fromEntries(TABLAS.map(t => [t, [...mem[t].values()]]));
    return fetchRed("/api/cargar", { method: "POST", body: JSON.stringify({ tablas }) }, base, "");
  }
  /** Trae lo que cambió en la red (sets, tonos, canciones…) y lo sube a la nube. */
  async function traerDeRed(base) {
    const { tablas } = await fetchRed("/api/datos", {}, base, "");
    let n = 0;
    for (const t of TABLAS) for (const fila of tablas[t] || []) {
      const act = mem[t].get(llaveDe(t, fila));
      if (!act || (fila.actualizado || "") > (act.actualizado || "")) {
        await aplicar(t, [fila]);
        await tx("_salida", "readwrite", s => s.add({ tabla: t, op: "upsert", fila })); estado.pendientes++; n++;
      }
    }
    avisaEstado(); subir();
    return n;
  }

  // ---------- "Seguir al director": el líder del set marca la canción y a todos se les abre ----------
  const vivos = new Map();
  function canalVivo(setId, alRecibir) {
    if (red) {
      vivosRed.set(setId, alRecibir);
      return { enviar: payload => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ tipo: "vivo", set: setId, payload })); }, salir: () => vivosRed.delete(setId) };
    }
    if (!nube) return { enviar() {}, salir() {} };
    const ch = sb.channel("vivo-" + setId, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "pos" }, ({ payload }) => alRecibir(payload)).subscribe();
    vivos.set(setId, ch);
    return { enviar: payload => ch.send({ type: "broadcast", event: "pos", payload }), salir: () => { sb.removeChannel(ch); vivos.delete(setId); } };
  }

  async function sincronizar() { if (red) { await subirRed(); await bajarRed().catch(() => {}); conectarWS(); return; } await subir(); await bajar(); }
  window.addEventListener("online", () => { estado.enLinea = true; avisaEstado(); sincronizar(); });
  window.addEventListener("offline", () => { estado.enLinea = false; avisaEstado(); });

  // ---------- Sesión ----------
  async function iniciar() {
    // Si este navegador estuvo en modo local (o en otro proyecto de Supabase), esos datos no se suben:
    // sus ids no existen en la nube. Se borran y se empieza limpio con lo de la nube.
    const modo = nube ? "nube:" + cfg.supabaseUrl : red ? "red:" + location.origin : "local";
    const antes = (await meta.get("modo")) || ((await meta.get("yo")) ? "local" : null);
    if (antes && antes !== modo) {
      for (const t of TABLAS.concat(["_salida", "_meta"])) await tx(t, "readwrite", s => s.clear());
      estado.limpiado = antes; // la app avisa una vez
    }
    await meta.set("modo", modo);
    await cargarLocal();
    if (nube) {
      const { data } = await sb.auth.getSession();
      estado.usuario = data.session ? data.session.user : null;
      sb.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY") estado.ponerClave = "recovery"; const antes = estado.usuario; estado.usuario = s ? s.user : null; avisaEstado(); if (!antes && estado.usuario) { sincronizar(); escuchar(); } });
      if (estado.usuario) { escuchar(); sincronizar(); }
    } else if (red) {
      // red local: cada quien elige quién es; los datos vienen del servidor de la compu que dirige
      const id = lsg(RED_YO); estado.usuario = id ? { id, email: "" } : null;
      if (lsg(RED_PIN)) { await bajarRed().catch(() => {}); conectarWS(); }
    } else {
      // modo local: una persona fija en este dispositivo
      let yo = await meta.get("yo");
      if (!yo) { yo = { id: uuid(), email: "local" }; await meta.set("yo", yo); }
      estado.usuario = yo;
    }
    avisaEstado();
  }
  async function entrar(email, pass) { const { error } = await sb.auth.signInWithPassword({ email, password: pass }); if (error) throw error; }
  async function registrarse(email, pass, nombre) {
    const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error; return data;
  }
  async function recuperar(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; }
  async function salir() {
    if (nube) await sb.auth.signOut();
    if (red) { lss(RED_YO, null); lss(RED_PIN, null); }
    // borra lo local para que otra persona no vea datos ajenos en este dispositivo
    for (const t of TABLAS.concat(["_salida", "_meta"])) await tx(t, "readwrite", s => s.clear());
    location.reload();
  }
  /** Llama una Edge Function con mi sesión y devuelve su JSON (lanza el error en español que manda la función). */
  async function fn(nombre, body) {
    if (!nube) throw new Error("Esto necesita la nube: configura Supabase en config.publico.js.");
    if (!navigator.onLine) throw new Error("Sin conexión: inténtalo cuando haya internet.");
    const { data } = await sb.auth.getSession();
    let r;
    try {
      r = await fetch(`${cfg.supabaseUrl}/functions/v1/${nombre}`, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + (data.session ? data.session.access_token : cfg.supabaseAnonKey) },
        body: JSON.stringify(body || {}) });
    } catch (e) {
      // «Failed to fetch»: Supabase responde sin permisos de CORS cuando la función no existe o tiene «Verify JWT» prendido
      throw new Error(`La función «${nombre}» de Supabase no responde. Despliégala (Edge Functions → Deploy a new function → Via Editor, nombre «${nombre}») y apaga «Verify JWT» en sus detalles.`);
    }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && !j.error) throw new Error(`Falta desplegar la función «${nombre}» en Supabase.`);
    if (!r.ok || j.error) throw new Error(j.error || "Error " + r.status);
    return j;
  }
  async function nuevaClave(password, nombre) {
    const { error } = await sb.auth.updateUser({ password, ...(nombre ? { data: { nombre } } : {}) });
    if (error) throw error;
  }
  async function rpc(nombre, args) { if (!nube) throw new Error("Sin nube"); const { data, error } = await sb.rpc(nombre, args); if (error) throw error; await bajar(); return data; }

  // ---------- Audio (pistas) ----------
  async function subirAudio(ruta, archivo) {
    // guarda copia local para usarla sin internet
    await tx("_audio", "readwrite", s => s.put(archivo, ruta));
    if (nube) { const { error } = await sb.storage.from("cif-tracks").upload(ruta, archivo, { contentType: archivo.type || "audio/mpeg" }); if (error) throw error; }
  }
  async function audio(ruta) {
    const local = await tx("_audio", "readonly", s => req(s.get(ruta)));
    if (local) return local;
    if (!nube) return null;
    const { data, error } = await sb.storage.from("cif-tracks").download(ruta);
    if (error) throw error;
    await tx("_audio", "readwrite", s => s.put(data, ruta));
    return data;
  }
  async function borrarAudio(ruta) {
    await tx("_audio", "readwrite", s => s.delete(ruta));
    if (nube) await sb.storage.from("cif-tracks").remove([ruta]);
  }
  const audioLocal = ruta => tx("_audio", "readonly", s => req(s.getKey(ruta))).then(Boolean);

  window.DATOS = {
    iniciar, estado, mem, guardar, borrar, sincronizar, uuid, ahora,
    lista: t => [...mem[t].values()],
    uno: (t, id) => mem[t].get(id),
    alCambiar: f => oyentes.add(f),
    alEstado: f => (oyEstado.add(f), f({ ...estado })),
    entrar, registrarse, recuperar, salir, rpc, fn, nuevaClave, canalVivo,
    subirAudio, audio, borrarAudio, audioLocal,
    nube, sb, modo: MODO, red,
    entrarRed, elegirYo, pinRed, enviarARed, traerDeRed,
    aplicarLocal: aplicar,
  };
})();
