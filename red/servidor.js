#!/usr/bin/env node
/* Cifrados · Servidor de RED LOCAL (sin internet).
   Corre en la computadora de quien dirige. Todos los dispositivos conectados a la misma red
   (Wi-Fi de un router aunque no tenga internet, o cable) abren http://<IP-de-esta-compu>:8787
   y ven el mismo set, secciones, tonos y «Dirigir / Seguir» al instante.

   Uso:   node red/servidor.js            (Node 18 o más nuevo; sin instalar nada más)
   Opciones: --puerto=8787  --pin=1234  --app=../app  --datos=datos-red.json

   - Sirve la app (carpeta app/) y le dice que está en modo red.
   - Guarda una copia de los datos en red/datos-red.json (sobrevive si se reinicia).
   - Para entrar se pide el PIN que aparece al arrancar (la propia compu entra sin PIN).
   - La app de la nube abierta EN ESTA MISMA COMPU puede «Enviar a la Red» y «Traer de la Red» (localhost).
*/
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), os = require("os");

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")));
const PUERTO = +(args.puerto || 8787);
const APP = path.resolve(__dirname, args.app || "../app");
const ARCHIVO = path.resolve(__dirname, args.datos || "datos-red.json");
const PIN = String(args.pin || Math.floor(1000 + Math.random() * 9000));
const TABLAS = ["cif_canciones", "cif_tonos", "cif_sets", "cif_tracks", "cif_ministerios", "cif_miembros", "cif_perfiles", "cif_solicitudes", "cif_amistades", "cif_anuncios", "cif_intercambios"];
const LLAVE = { cif_tonos: r => r.cancion_id + "|" + r.persona_id, cif_miembros: r => r.ministerio_id + "|" + r.persona_id };
const llave = (t, r) => (LLAVE[t] ? LLAVE[t](r) : r.id);

// ---------- Datos (memoria + archivo) ----------
const datos = {}; TABLAS.forEach(t => (datos[t] = {}));
try { const j = JSON.parse(fs.readFileSync(ARCHIVO, "utf8")); TABLAS.forEach(t => { if (j[t]) datos[t] = j[t]; }); } catch (e) { /* primera vez */ }
let pend;
const persistir = () => { clearTimeout(pend); pend = setTimeout(() => fs.writeFile(ARCHIVO, JSON.stringify(datos), () => {}), 400); };
/** Gana el cambio más reciente (`actualizado`), igual que en la nube. */
function aplicar(tabla, fila, op) {
  if (!datos[tabla] || !fila) return false;
  const k = llave(tabla, fila); if (!k || String(k).includes("undefined")) return false;
  if (op === "delete") { if (!datos[tabla][k]) return false; delete datos[tabla][k]; return true; }
  const prev = datos[tabla][k];
  if (prev && prev.actualizado && fila.actualizado && prev.actualizado > fila.actualizado) return false;
  datos[tabla][k] = fila; return true;
}
const todo = () => Object.fromEntries(TABLAS.map(t => [t, Object.values(datos[t])]));

// ---------- WebSocket mínimo (solo texto) ----------
const clientes = new Set();
function enviarFrame(sock, texto, op = 1) {
  const pl = Buffer.isBuffer(texto) ? texto : Buffer.from(texto);
  let h;
  if (pl.length < 126) h = Buffer.from([0x80 | op, pl.length]);
  else if (pl.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(pl.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(pl.length), 2); }
  try { sock.write(Buffer.concat([h, pl])); } catch (e) { /* se fue */ }
}
function aTodos(msg, excepto) { const s = JSON.stringify(msg); clientes.forEach(c => c !== excepto && enviarFrame(c, s)); }
const avisarConectados = () => aTodos({ tipo: "conectados", n: clientes.size });
function leerFrames(sock, alTexto) {
  let buf = Buffer.alloc(0);
  sock.on("data", d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const op = buf[0] & 15, enmascarado = buf[1] & 128;
      let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const mOff = off; if (enmascarado) off += 4;
      if (buf.length < off + len) return;
      let pl = Buffer.from(buf.subarray(off, off + len));
      if (enmascarado) { const m = buf.subarray(mOff, mOff + 4); for (let i = 0; i < pl.length; i++) pl[i] ^= m[i % 4]; }
      buf = buf.subarray(off + len);
      if (op === 8) { sock.end(); return; }
      if (op === 9) { enviarFrame(sock, pl, 10); continue; }
      if (op === 1) alTexto(pl.toString("utf8"));
    }
  });
}

// ---------- Red: direcciones y nombre del Wi-Fi ----------
const ipsLocales = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
function nombreWifi() {
  // macOS: el nombre del Wi-Fi al que está conectada esta compu (si el sistema lo permite); si no, null
  if (process.platform !== "darwin") return null;
  try {
    const { execSync } = require("child_process");
    for (const dev of ["en0", "en1"]) {
      const s = execSync(`networksetup -getairportnetwork ${dev}`, { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] });
      const m = /Current Wi-Fi Network:\s*(.+)/.exec(s); if (m) return m[1].trim();
    }
  } catch (e) { /* sin Wi-Fi o sin permiso */ }
  return null;
}

// ---------- HTTP ----------
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".jpg": "image/jpeg" };
const esLocal = req => /^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress || "");
const autorizado = (req, url) => esLocal(req) || req.headers["x-pin"] === PIN || url.searchParams.get("pin") === PIN;
function cabeceras(res, extra = {}) {
  // CORS + Private Network Access: la app de la nube (https) en esta misma compu puede hablar con localhost
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-pin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Cache-Control", "no-cache");
  Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
}
const json = (res, obj, code = 200) => { cabeceras(res, { "Content-Type": "application/json" }); res.writeHead(code); res.end(JSON.stringify(obj)); };
function cuerpo(req) {
  return new Promise((ok, mal) => { let s = ""; req.on("data", d => { s += d; if (s.length > 50e6) req.destroy(); }); req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { mal(e); } }); });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { cabeceras(res); res.writeHead(204); return res.end(); }
  try {
    if (url.pathname === "/config.publico.js") { cabeceras(res, { "Content-Type": TIPOS[".js"] }); res.writeHead(200); return res.end(`window.CIFRADOS_CONFIG = { red: true };`); }
    if (url.pathname === "/api/estado") return json(res, { app: "cifrados-red", equipo: os.hostname(), conectados: clientes.size, canciones: Object.keys(datos.cif_canciones).length, sets: Object.keys(datos.cif_sets).length });
    // Solo desde esta misma compu: datos para «Avisar a todos» (direcciones, PIN y nombre del Wi-Fi)
    if (url.pathname === "/api/info") {
      if (!esLocal(req)) return json(res, { error: "Solo desde la compu del servidor." }, 403);
      return json(res, { app: "cifrados-red", equipo: os.hostname(), puerto: PUERTO, pin: PIN, wifi: nombreWifi(), urls: ipsLocales().map(ip => `http://${ip}:${PUERTO}`) });
    }
    if (url.pathname.startsWith("/api/")) {
      if (!autorizado(req, url)) return json(res, { error: "PIN incorrecto." }, 401);
      if (url.pathname === "/api/datos" && req.method === "GET") return json(res, { tablas: todo() });
      if (url.pathname === "/api/guardar" && req.method === "POST") {
        const b = await cuerpo(req), aplicados = [];
        for (const c of b.cambios || []) if (aplicar(c.tabla, c.fila, c.op)) aplicados.push(c);
        if (aplicados.length) { persistir(); aTodos({ tipo: "cambios", cambios: aplicados }); }
        return json(res, { ok: true, aplicados: aplicados.length });
      }
      if (url.pathname === "/api/cargar" && req.method === "POST") {
        const b = await cuerpo(req); let n = 0;
        for (const t of TABLAS) for (const fila of (b.tablas && b.tablas[t]) || []) if (aplicar(t, fila)) n++;
        persistir(); aTodos({ tipo: "recarga" });
        console.log(`  ↓ Se cargaron ${n} registros desde la nube.`);
        return json(res, { ok: true, cargados: n });
      }
      return json(res, { error: "No existe." }, 404);
    }
    // archivos de la app (sin salirse de la carpeta)
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const archivo = path.resolve(APP, rel);
    if (!archivo.startsWith(APP)) { res.writeHead(403); return res.end(); }
    fs.readFile(archivo, (err, buf) => {
      if (err) { // rutas desconocidas → la app
        return fs.readFile(path.join(APP, "index.html"), (e2, b2) => { if (e2) { res.writeHead(404); return res.end("No encuentro la carpeta app/"); } cabeceras(res, { "Content-Type": TIPOS[".html"] }); res.writeHead(200); res.end(b2); });
      }
      cabeceras(res, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" }); res.writeHead(200); res.end(buf);
    });
  } catch (e) { json(res, { error: e.message }, 500); }
});

servidor.on("upgrade", (req, sock) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/ws" || !autorizado(req, url)) { sock.end("HTTP/1.1 401 Unauthorized\r\n\r\n"); return; }
  const acepta = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acepta + "\r\n\r\n");
  sock.setNoDelay(true);
  clientes.add(sock); avisarConectados();
  const fuera = () => { if (clientes.delete(sock)) avisarConectados(); };
  sock.on("close", fuera); sock.on("error", fuera);
  leerFrames(sock, texto => {
    let m; try { m = JSON.parse(texto); } catch (e) { return; }
    // «Dirigir / Seguir»: se reenvía tal cual a los demás
    if (m.tipo === "vivo") aTodos(m, sock);
  });
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  const ips = ipsLocales(), wifi = nombreWifi();
  console.log("\n  Cifrados · Red local lista\n");
  if (wifi) console.log(`  Wi-Fi: ${wifi}`);
  console.log("  Que todos se conecten a la MISMA red (Wi-Fi o cable; no necesita internet) y abran:");
  (ips.length ? ips : ["(sin red: conecta esta compu a un Wi-Fi o router)"]).forEach(ip => console.log(`     http://${ip}:${PUERTO}`));
  console.log(`\n  PIN para entrar: ${PIN}`);
  console.log(`  En esta compu: http://localhost:${PUERTO}  ·  datos en ${ARCHIVO}`);
  console.log(`  ${Object.keys(datos.cif_canciones).length} canciones y ${Object.keys(datos.cif_sets).length} sets guardados.  Ctrl+C para cerrar.`);
  console.log(`\n  Para avisarle a todos: abre cifrados.tiempodedios.mx en Chrome → Conexión → «⬆ Enviar mi copia» y «📣 Avisar a todos».\n`);
});
