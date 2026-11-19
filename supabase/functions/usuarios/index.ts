// Edge Function "usuarios": administración de cuentas de Cifrados desde la app.
// Usa la service_role key que Supabase inyecta como variable de entorno: nunca llega al navegador.
// Desplegar con Verify JWT apagado (la función revisa la sesión ella misma).
//
// Quién puede qué:
//   desarrollador (cif_perfiles.superadmin): todo
//   admin de un ministerio: invitar y reenviar a personas de SU ministerio
//   cualquiera con sesión: avisar de su propia solicitud
//
// Acciones (POST JSON):
//   {accion:"listar"}                                                → todas las cuentas con correo y estado (desarrollador)
//   {accion:"invitar", email, nombre, ministerio_id?, rol?, redirectTo} → manda invitación; si ya tiene cuenta, solo lo agrega al ministerio
//   {accion:"crear", email, nombre, password, ministerio_id?, rol?}    → crea la cuenta con contraseña, sin correo (desarrollador)
//   {accion:"reenviar", id, redirectTo}                               → invitación otra vez, o liga para cambiar contraseña si ya entró
//   {accion:"quitar", id}                                             → borra la cuenta (desarrollador)
//   {accion:"aviso_solicitud", solicitud_id}                          → correo a los admins del ministerio
//   {accion:"aviso_respuesta", solicitud_id}                          → correo a quien pidió entrar (aceptada / rechazada)
//
// Secretos para los avisos (Edge Functions → Secrets): SMTP_USER, SMTP_PASS. Opcionales: SMTP_HOST, SMTP_PORT, APP_URL.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.14";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["admin", "musico", "lector"];
const APP = Deno.env.get("APP_URL") || "https://cifrados.tiempodedios.mx";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const correoValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "Tu sesión expiró. Vuelve a entrar." }, 401);

  const { data: yo } = await admin.from("cif_perfiles").select("superadmin,nombre").eq("id", user.id).single();
  const soyDev = !!yo?.superadmin;
  const soyAdminDe = async (m?: string) => {
    if (!m) return false;
    const { data } = await admin.from("cif_miembros").select("rol").eq("ministerio_id", m).eq("persona_id", user.id).maybeSingle();
    return data?.rol === "admin";
  };
  const todos = async () => {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    return data.users;
  };
  const body = await req.json().catch(() => ({}));
  const redirectTo = typeof body.redirectTo === "string" && body.redirectTo.startsWith("https://") ? body.redirectTo : APP;

  try {
    if (body.accion === "listar") {
      if (!soyDev) return json({ error: "Solo el desarrollador ve todas las cuentas." }, 403);
      return json({ usuarios: (await todos()).map((u) => ({ id: u.id, email: u.email, invitado: u.invited_at || null, confirmado: !!(u.email_confirmed_at || u.confirmed_at), ultimo: u.last_sign_in_at || null, creado: u.created_at })) });
    }

    if (body.accion === "invitar" || body.accion === "crear") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!correoValido(email)) return json({ error: "El correo no parece válido." }, 400);
      const nombre = String(body.nombre || "").trim().slice(0, 60) || email.split("@")[0];
      const ministerio = body.ministerio_id ? String(body.ministerio_id) : null;
      const rol = ROLES.includes(body.rol) ? body.rol : "musico";
      if (!soyDev && !(await soyAdminDe(ministerio || undefined))) return json({ error: "Solo el desarrollador o un admin del ministerio puede invitar." }, 403);
      if (!soyDev && rol === "admin") return json({ error: "Solo el desarrollador nombra admins al invitar. Invítalo como músico y luego cámbiale el rol." }, 403);
      if (body.accion === "crear" && !soyDev) return json({ error: "Solo el desarrollador crea cuentas con contraseña." }, 403);

      let id: string;
      const ya = (await todos()).find((u) => (u.email || "").toLowerCase() === email);
      if (ya) {
        // ya tiene cuenta: no se manda otra invitación, solo se agrega al ministerio
        if (!ministerio) return json({ error: "Ese correo ya tiene cuenta." }, 400);
        id = ya.id;
      } else if (body.accion === "crear") {
        const password = String(body.password || "");
        if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } });
        if (error) return json({ error: "No se pudo crear: " + error.message }, 400);
        id = data.user.id;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { nombre }, redirectTo });
        if (error) return json({ error: /rate limit/i.test(error.message) ? "Supabase llegó a su límite de correos por hora. Configura el SMTP propio o crea la cuenta con contraseña." : "No se pudo invitar: " + error.message }, 400);
        id = data.user.id;
      }
      // el trigger cif_perfil_nuevo ya creó el perfil; se asegura el nombre
      if (!ya) await admin.from("cif_perfiles").upsert({ id, nombre });
      if (ministerio) {
        const { error } = await admin.from("cif_miembros").upsert({ ministerio_id: ministerio, persona_id: id, rol }, { onConflict: "ministerio_id,persona_id" });
        if (error) return json({ error: "La cuenta quedó, pero no se pudo agregar al ministerio: " + error.message }, 500);
      }
      return json({ ok: true, id, existia: !!ya });
    }

    if (body.accion === "reenviar") {
      const u = (await todos()).find((x) => x.id === body.id);
      if (!u || !u.email) return json({ error: "No encontré esa cuenta." }, 404);
      if (!soyDev) {
        // un admin solo puede reenviar a personas de sus ministerios
        const { data: mis } = await admin.from("cif_miembros").select("ministerio_id").eq("persona_id", user.id).eq("rol", "admin");
        const { data: suyos } = await admin.from("cif_miembros").select("ministerio_id").eq("persona_id", u.id);
        const comunes = (suyos || []).some((s) => (mis || []).some((m) => m.ministerio_id === s.ministerio_id));
        if (!comunes) return json({ error: "Esa persona no está en un ministerio que tú administres." }, 403);
      }
      const { error } = u.last_sign_in_at
        ? await admin.auth.resetPasswordForEmail(u.email, { redirectTo })
        : await admin.auth.admin.inviteUserByEmail(u.email, { redirectTo });
      if (error) return json({ error: "No se pudo enviar: " + error.message }, 400);
      return json({ ok: true, tipo: u.last_sign_in_at ? "recuperar" : "invitacion" });
    }

    if (body.accion === "quitar") {
      if (!soyDev) return json({ error: "Solo el desarrollador borra cuentas." }, 403);
      const id = String(body.id || "");
      if (!id) return json({ error: "Falta la persona." }, 400);
      if (id === user.id) return json({ error: "No puedes borrar tu propia cuenta." }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: "No se pudo borrar: " + error.message }, 500);
      return json({ ok: true });
    }

    if (body.accion === "aviso_solicitud" || body.accion === "aviso_respuesta") {
      const { data: s } = await admin.from("cif_solicitudes").select("*").eq("id", body.solicitud_id).single();
      if (!s) return json({ error: "No encontré la solicitud." }, 404);
      const { data: m } = await admin.from("cif_ministerios").select("nombre").eq("id", s.ministerio_id).single();
      const { data: p } = await admin.from("cif_perfiles").select("nombre").eq("id", s.persona_id).single();
      const usuarios = await todos();
      const correoDe = (id: string) => usuarios.find((u) => u.id === id)?.email;
      let para: string[] = [], asunto = "", titulo = "", texto = "", boton = "";
      if (body.accion === "aviso_solicitud") {
        if (s.persona_id !== user.id && !soyDev) return json({ error: "Solo quien pidió entrar avisa de su solicitud." }, 403);
        const { data: admins } = await admin.from("cif_miembros").select("persona_id").eq("ministerio_id", s.ministerio_id).eq("rol", "admin");
        para = (admins || []).map((a) => correoDe(a.persona_id)).filter(Boolean) as string[];
        asunto = `${p?.nombre || "Alguien"} quiere entrar a ${m?.nombre} · Cifrados`;
        titulo = "Nueva solicitud para tu ministerio";
        texto = `<b>${esc(p?.nombre || "Alguien")}</b> pidió unirse a <b>${esc(m?.nombre || "")}</b>.${s.mensaje ? `<br><br>«${esc(s.mensaje)}»` : ""}<br><br>Acepta o rechaza en Ministerios.`;
        boton = "Revisar solicitud";
      } else {
        if (!soyDev && !(await soyAdminDe(s.ministerio_id))) return json({ error: "Solo un admin del ministerio responde." }, 403);
        para = [correoDe(s.persona_id)].filter(Boolean) as string[];
        const ok = s.estado === "aceptada";
        asunto = ok ? `Ya eres parte de ${m?.nombre} · Cifrados` : `Tu solicitud a ${m?.nombre} · Cifrados`;
        titulo = ok ? `¡Bienvenido a ${m?.nombre}!` : "Sobre tu solicitud";
        texto = ok ? `Un admin aceptó tu solicitud. Ya ves los sets de <b>${esc(m?.nombre || "")}</b> y puedes guardar tus tonos para el equipo.` : `Por ahora no se aceptó tu solicitud a <b>${esc(m?.nombre || "")}</b>. Si crees que es un error, habla con tu líder.`;
        boton = "Abrir Cifrados";
      }
      if (!para.length) return json({ ok: true, enviados: 0, nota: "No hay a quién avisar." });
      const smtpUser = Deno.env.get("SMTP_USER"), smtpPass = Deno.env.get("SMTP_PASS");
      if (!smtpUser || !smtpPass) return json({ ok: true, enviados: 0, nota: "Faltan los secretos SMTP_USER y SMTP_PASS: no se mandó correo." });
      const puerto = Number(Deno.env.get("SMTP_PORT") || 465);
      const smtp = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com", port: puerto, secure: puerto === 465, auth: { user: smtpUser, pass: smtpPass } });
      await smtp.sendMail({ from: `Cifrados Tiempo de Dios <${smtpUser}>`, to: para.join(","), subject: asunto, html: plantilla(titulo, texto, boton, APP + "/#ministerios") });
      return json({ ok: true, enviados: para.length });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || String(e) }, 500);
  }
});

function plantilla(titulo: string, texto: string, boton: string, liga: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#F4F7F7;font-family:Arial,Helvetica,sans-serif;color:#1B1C1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DDE5E5">
<tr><td style="background:#1B1C1A;padding:28px 32px 24px;border-bottom:6px solid #FF3D1A">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A3ADAC;font-weight:bold">Tiempo de Dios · Cifrados</div>
<div style="font-size:24px;line-height:1.2;font-weight:900;color:#FFFFFF;margin-top:6px">${esc(titulo)}</div></td></tr>
<tr><td style="padding:28px 32px 8px;font-size:15px;line-height:1.6"><p style="margin:0">${texto}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td style="background:#FF3D1A;border-radius:10px">
<a href="${liga}" style="display:inline-block;padding:14px 26px;color:#FFFFFF;font-weight:bold;font-size:15px;text-decoration:none">${esc(boton)}</a></td></tr></table></td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #DDE5E5;font-size:12px;color:#5E6766">Cifrados · Tiempo de Dios · <a href="${APP}" style="color:#5E6766">${APP.replace("https://", "")}</a></td></tr>
</table></td></tr></table></body></html>`;
}
