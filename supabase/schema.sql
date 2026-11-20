-- Cifrados Tiempo de Dios · esquema de Supabase
-- Se puede correr en el mismo proyecto de la Bitácora (todas las tablas llevan el prefijo cif_) o en uno nuevo.
-- Correr completo en SQL Editor. Es idempotente: se puede volver a correr.

create extension if not exists pgcrypto;

-- ---------- Personas ----------
create table if not exists cif_perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  artista boolean not null default false,      -- dirige / canta: puede guardar su tono
  voz text,                                    -- p. ej. "tenor", "soprano"
  superadmin boolean not null default false,   -- da de alta ministerios
  estilo jsonb not null default '{}'::jsonb,   -- preferencias de vista (tamaño, colores…)
  actualizado timestamptz not null default now()
);

-- ---------- Ministerios ----------
create table if not exists cif_ministerios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique default upper(substr(md5(random()::text), 1, 6)), -- para unirse
  color text not null default 'flame',
  creado_por uuid references auth.users,
  actualizado timestamptz not null default now()
);

create table if not exists cif_miembros (
  ministerio_id uuid references cif_ministerios on delete cascade,
  persona_id uuid references auth.users on delete cascade,
  rol text not null default 'musico' check (rol in ('admin','musico','lector')),
  instrumento text,
  actualizado timestamptz not null default now(),
  primary key (ministerio_id, persona_id)
);

-- ---------- Librería (compartida por todos) ----------
create table if not exists cif_canciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text not null default '',
  tono text not null default '',          -- tono en que está escrito el contenido
  bpm int,
  compas text,
  contenido text not null default '',     -- ChordPro
  orden text[] not null default '{}',     -- orden de secciones (repite sin copiar texto)
  etiquetas text[] not null default '{}',
  liga text,                              -- Spotify / YouTube
  notas text,
  ministerio_id uuid references cif_ministerios on delete set null, -- de dónde salió (no limita quién la ve)
  origen text,                            -- 'songbookpro', 'manual'…
  borrada boolean not null default false,
  creada_por uuid references auth.users default auth.uid(),
  actualizado_por uuid references auth.users,
  actualizado timestamptz not null default now()
);
create index if not exists cif_canciones_act on cif_canciones (actualizado);

-- Tono de cada artista por canción: uno por persona, lo ven todos
create table if not exists cif_tonos (
  cancion_id uuid references cif_canciones on delete cascade,
  persona_id uuid references auth.users on delete cascade,
  tono text not null,
  capo int not null default 0,
  nota text,
  actualizado timestamptz not null default now(),
  primary key (cancion_id, persona_id)
);
create index if not exists cif_tonos_act on cif_tonos (actualizado);

-- ---------- Sets por ministerio ----------
create table if not exists cif_sets (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references cif_ministerios on delete cascade,
  nombre text not null,
  fecha date,
  notas text,
  items jsonb not null default '[]'::jsonb,  -- [{id, cancion_id, tono, persona_id, nota}]
  borrada boolean not null default false,
  actualizado_por uuid references auth.users,
  actualizado timestamptz not null default now()
);
create index if not exists cif_sets_act on cif_sets (actualizado);

-- ---------- Pistas de audio ----------
create table if not exists cif_tracks (
  id uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references cif_canciones on delete cascade,
  nombre text not null,
  tipo text not null default 'pista',       -- pista, guia, click, stem
  tono text,                                -- tono en que viene grabado el audio
  ruta text not null,                       -- bucket cif-tracks
  tam bigint,
  subido_por uuid references auth.users default auth.uid(),
  actualizado_por uuid references auth.users,
  actualizado timestamptz not null default now()
);

-- ---------- Funciones de permisos ----------
create or replace function cif_super() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select superadmin from cif_perfiles where id = auth.uid()), false) $$;
create or replace function cif_rol(m uuid) returns text language sql stable security definer set search_path = public as $$
  select rol from cif_miembros where ministerio_id = m and persona_id = auth.uid() $$;
create or replace function cif_es_musico() returns boolean language sql stable security definer set search_path = public as $$
  select cif_super() or exists (select 1 from cif_miembros where persona_id = auth.uid() and rol in ('admin','musico')) $$;

-- Unirse con el código del ministerio (entra como lector; un admin lo sube a músico)
create or replace function cif_unirse(c text) returns uuid language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  select id into m from cif_ministerios where codigo = upper(trim(c));
  if m is null then raise exception 'Código no válido'; end if;
  insert into cif_miembros (ministerio_id, persona_id, rol) values (m, auth.uid(), 'lector') on conflict do nothing;
  return m;
end $$;

-- Perfil automático al registrarse
create or replace function cif_perfil_nuevo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into cif_perfiles (id, nombre) values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))) on conflict do nothing;
  return new;
end $$;
drop trigger if exists cif_perfil_nuevo on auth.users;
create trigger cif_perfil_nuevo after insert on auth.users for each row execute function cif_perfil_nuevo();
-- (para personas que ya existían)
insert into cif_perfiles (id, nombre) select id, coalesce(raw_user_meta_data->>'nombre', split_part(email, '@', 1)) from auth.users on conflict do nothing;

-- Nadie se vuelve superadmin solo
create or replace function cif_proteger_perfil() returns trigger language plpgsql as $$
begin
  if new.superadmin is distinct from old.superadmin and auth.uid() is not null and not cif_super() then new.superadmin := old.superadmin; end if;
  return new;
end $$;
drop trigger if exists cif_proteger_perfil on cif_perfiles;
create trigger cif_proteger_perfil before update on cif_perfiles for each row execute function cif_proteger_perfil();

-- ---------- RLS ----------
alter table cif_perfiles enable row level security;
alter table cif_ministerios enable row level security;
alter table cif_miembros enable row level security;
alter table cif_canciones enable row level security;
alter table cif_tonos enable row level security;
alter table cif_sets enable row level security;
alter table cif_tracks enable row level security;

drop policy if exists p_ver on cif_perfiles;      create policy p_ver on cif_perfiles for select to authenticated using (true);
drop policy if exists p_editar on cif_perfiles;   create policy p_editar on cif_perfiles for update to authenticated using (id = auth.uid() or cif_super());
drop policy if exists p_alta on cif_perfiles;     create policy p_alta on cif_perfiles for insert to authenticated with check (id = auth.uid());

drop policy if exists m_ver on cif_ministerios;   create policy m_ver on cif_ministerios for select to authenticated using (true);
drop policy if exists m_alta on cif_ministerios;  create policy m_alta on cif_ministerios for insert to authenticated with check (cif_super());
drop policy if exists m_editar on cif_ministerios; create policy m_editar on cif_ministerios for update to authenticated using (cif_super() or cif_rol(id) = 'admin');
drop policy if exists m_borrar on cif_ministerios; create policy m_borrar on cif_ministerios for delete to authenticated using (cif_super());

drop policy if exists mi_ver on cif_miembros;     create policy mi_ver on cif_miembros for select to authenticated using (true);
drop policy if exists mi_admin on cif_miembros;   create policy mi_admin on cif_miembros for all to authenticated
  using (cif_super() or cif_rol(ministerio_id) = 'admin') with check (cif_super() or cif_rol(ministerio_id) = 'admin');

-- Librería: la ven todas las personas con cuenta; la editan músicos y admins de cualquier ministerio
drop policy if exists c_ver on cif_canciones;     create policy c_ver on cif_canciones for select to authenticated using (true);
drop policy if exists c_alta on cif_canciones;    create policy c_alta on cif_canciones for insert to authenticated with check (cif_es_musico());
drop policy if exists c_editar on cif_canciones;  create policy c_editar on cif_canciones for update to authenticated using (cif_es_musico());

-- Tonos: cada artista guarda el suyo; los admins de algún ministerio pueden guardarlo por otras personas
drop policy if exists t_ver on cif_tonos;         create policy t_ver on cif_tonos for select to authenticated using (true);
drop policy if exists t_propio on cif_tonos;      create policy t_propio on cif_tonos for all to authenticated
  using (persona_id = auth.uid() or cif_super() or exists (select 1 from cif_miembros where persona_id = auth.uid() and rol = 'admin'))
  with check (persona_id = auth.uid() or cif_super() or exists (select 1 from cif_miembros where persona_id = auth.uid() and rol = 'admin'));

-- Sets: solo su ministerio; los lectores solo ven
drop policy if exists s_ver on cif_sets;          create policy s_ver on cif_sets for select to authenticated using (cif_super() or cif_rol(ministerio_id) is not null);
drop policy if exists s_alta on cif_sets;         create policy s_alta on cif_sets for insert to authenticated with check (cif_super() or cif_rol(ministerio_id) in ('admin','musico'));
drop policy if exists s_editar on cif_sets;       create policy s_editar on cif_sets for update to authenticated using (cif_super() or cif_rol(ministerio_id) in ('admin','musico'));

drop policy if exists k_ver on cif_tracks;        create policy k_ver on cif_tracks for select to authenticated using (true);
drop policy if exists k_alta on cif_tracks;       create policy k_alta on cif_tracks for insert to authenticated with check (cif_es_musico());
drop policy if exists k_editar on cif_tracks;     create policy k_editar on cif_tracks for update to authenticated using (cif_es_musico());
drop policy if exists k_borrar on cif_tracks;     create policy k_borrar on cif_tracks for delete to authenticated using (subido_por = auth.uid() or cif_super());

-- ---------- Tiempo real ----------
do $$ declare t text; begin
  foreach t in array array['cif_canciones','cif_tonos','cif_sets','cif_tracks','cif_ministerios','cif_miembros','cif_perfiles'] loop
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- ---------- Bucket de pistas (privado, máx. 50 MB) ----------
insert into storage.buckets (id, name, public, file_size_limit) values ('cif-tracks', 'cif-tracks', false, 52428800) on conflict (id) do nothing;
drop policy if exists cif_tracks_ver on storage.objects;
create policy cif_tracks_ver on storage.objects for select to authenticated using (bucket_id = 'cif-tracks');
drop policy if exists cif_tracks_subir on storage.objects;
create policy cif_tracks_subir on storage.objects for insert to authenticated with check (bucket_id = 'cif-tracks' and cif_es_musico());
drop policy if exists cif_tracks_borrar on storage.objects;
create policy cif_tracks_borrar on storage.objects for delete to authenticated using (bucket_id = 'cif-tracks' and (owner = auth.uid() or cif_super()));

-- =====================================================================
-- Versión 2: suscripción, solicitudes a ministerios, amigos, @usuario, sets litúrgicos
-- =====================================================================
alter table cif_perfiles add column if not exists usuario text;   -- @usuario único, minúsculas
create unique index if not exists cif_perfiles_usuario on cif_perfiles (lower(usuario)) where usuario is not null;
alter table cif_ministerios add column if not exists suscripcion_hasta date;  -- la pone el desarrollador
alter table cif_sets add column if not exists tipo text not null default 'normal' check (tipo in ('normal','liturgico'));
-- items de set: {id, cancion_id, tono, persona_id, nota, momento?, estructura?:[secciones]}

-- Ya no se entra con código: se pide y un admin acepta
drop function if exists cif_unirse(text);

create table if not exists cif_solicitudes (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references cif_ministerios on delete cascade,
  persona_id uuid not null references auth.users on delete cascade default auth.uid(),
  mensaje text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada')),
  actualizado timestamptz not null default now()
);
create unique index if not exists cif_solicitudes_una on cif_solicitudes (ministerio_id, persona_id) where estado = 'pendiente';

create table if not exists cif_amistades (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references auth.users on delete cascade default auth.uid(),
  para uuid not null references auth.users on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada')),
  actualizado timestamptz not null default now(),
  check (de <> para)
);
create unique index if not exists cif_amistades_par on cif_amistades (least(de, para), greatest(de, para));

-- ¿Tiene suscripción activa? (músico o admin de un ministerio con suscripción vigente)
create or replace function cif_suscrito() returns boolean language sql stable security definer set search_path = public as $$
  select cif_super() or exists (
    select 1 from cif_miembros mi join cif_ministerios m on m.id = mi.ministerio_id
    where mi.persona_id = auth.uid() and mi.rol in ('admin','musico') and m.suscripcion_hasta >= current_date) $$;

-- Buscar personas para agregar como amigo: por @usuario, correo exacto o nombre (sin exponer correos)
create or replace function cif_buscar_persona(q text) returns table (id uuid, nombre text, usuario text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.usuario from cif_perfiles p join auth.users u on u.id = p.id
  where auth.uid() is not null and p.id <> auth.uid() and length(trim(q)) >= 2 and (
    lower(p.usuario) = lower(trim(both '@' from trim(q))) or lower(u.email) = lower(trim(q)) or p.nombre ilike '%' || trim(q) || '%')
  limit 10 $$;

alter table cif_solicitudes enable row level security;
alter table cif_amistades enable row level security;

drop policy if exists so_ver on cif_solicitudes;     create policy so_ver on cif_solicitudes for select to authenticated
  using (persona_id = auth.uid() or cif_super() or cif_rol(ministerio_id) = 'admin');
drop policy if exists so_pedir on cif_solicitudes;   create policy so_pedir on cif_solicitudes for insert to authenticated
  with check (persona_id = auth.uid() and estado = 'pendiente');
drop policy if exists so_resolver on cif_solicitudes; create policy so_resolver on cif_solicitudes for update to authenticated
  using (cif_super() or cif_rol(ministerio_id) = 'admin');
drop policy if exists so_cancelar on cif_solicitudes; create policy so_cancelar on cif_solicitudes for delete to authenticated
  using (persona_id = auth.uid() or cif_super() or cif_rol(ministerio_id) = 'admin');

drop policy if exists am_ver on cif_amistades;       create policy am_ver on cif_amistades for select to authenticated using (de = auth.uid() or para = auth.uid());
drop policy if exists am_pedir on cif_amistades;     create policy am_pedir on cif_amistades for insert to authenticated with check (de = auth.uid() and estado = 'pendiente');
drop policy if exists am_aceptar on cif_amistades;   create policy am_aceptar on cif_amistades for update to authenticated using (para = auth.uid()) with check (para = auth.uid());
drop policy if exists am_quitar on cif_amistades;    create policy am_quitar on cif_amistades for delete to authenticated using (de = auth.uid() or para = auth.uid());

-- Alta de canciones (incluye importar): solo con suscripción activa
drop policy if exists c_alta on cif_canciones;    create policy c_alta on cif_canciones for insert to authenticated with check (cif_es_musico() and cif_suscrito());

do $$ declare t text; begin
  foreach t in array array['cif_solicitudes','cif_amistades'] loop
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- =====================================================================
-- Permisos de la API: en proyectos nuevos de Supabase las tablas creadas por SQL no se exponen solas.
-- Solo las personas con sesión (authenticated) usan las tablas; la RLS decide qué filas.
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on cif_perfiles, cif_ministerios, cif_miembros, cif_canciones, cif_tonos, cif_sets, cif_tracks, cif_solicitudes, cif_amistades to authenticated;
grant execute on function cif_super(), cif_rol(uuid), cif_es_musico(), cif_suscrito(), cif_buscar_persona(text) to authenticated;
revoke all on cif_perfiles, cif_ministerios, cif_miembros, cif_canciones, cif_tonos, cif_sets, cif_tracks, cif_solicitudes, cif_amistades from anon;
revoke execute on function cif_buscar_persona(text) from anon;

-- =====================================================================
-- Versión 3: solistas y canciones compartidas (= migraciones/002)
-- =====================================================================

-- Un ministerio puede ser un grupo o un solista (p. ej. ARIA de Ceci)
alter table cif_ministerios add column if not exists tipo text not null default 'ministerio';
do $$ begin
  alter table cif_ministerios add constraint cif_ministerios_tipo check (tipo in ('ministerio','solista'));
exception when duplicate_object then null; end $$;

-- Quién ve una canción: toda la librería, o solo su ministerio y los ministerios con los que se compartió
alter table cif_canciones add column if not exists visibilidad text not null default 'todos';
do $$ begin
  alter table cif_canciones add constraint cif_canciones_visibilidad check (visibilidad in ('todos','ministerio'));
exception when duplicate_object then null; end $$;
alter table cif_canciones add column if not exists compartida_con uuid[] not null default '{}';

create or replace function cif_ve_cancion(m uuid, comp uuid[], vis text) returns boolean
language sql stable security definer set search_path = public as $$
  select vis = 'todos' or cif_super() or exists (
    select 1 from cif_miembros where persona_id = auth.uid() and (ministerio_id = m or ministerio_id = any(comp))) $$;
grant execute on function cif_ve_cancion(uuid, uuid[], text) to authenticated;

drop policy if exists c_ver on cif_canciones;
create policy c_ver on cif_canciones for select to authenticated
  using (cif_ve_cancion(ministerio_id, compartida_con, visibilidad) or creada_por = auth.uid());
drop policy if exists c_editar on cif_canciones;
create policy c_editar on cif_canciones for update to authenticated
  using (cif_es_musico() and (cif_ve_cancion(ministerio_id, compartida_con, visibilidad) or creada_por = auth.uid()));

-- =====================================================================
-- Versión 4: avisos de red local (= migraciones/003)
-- =====================================================================

create table if not exists cif_anuncios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'red',
  ministerio_id uuid references cif_ministerios on delete cascade,  -- null = para todos los ministerios (solo desarrollador)
  datos jsonb not null default '{}'::jsonb,                         -- {urls:[], pin, wifi, equipo, nota}
  activo boolean not null default true,
  vence timestamptz,
  creado_por uuid references auth.users default auth.uid(),
  actualizado timestamptz not null default now()
);

alter table cif_anuncios enable row level security;
drop policy if exists an_ver on cif_anuncios;
create policy an_ver on cif_anuncios for select to authenticated
  using (ministerio_id is null or cif_super() or cif_rol(ministerio_id) is not null);
drop policy if exists an_alta on cif_anuncios;
create policy an_alta on cif_anuncios for insert to authenticated
  with check (cif_super() or (ministerio_id is not null and cif_rol(ministerio_id) = 'admin'));
drop policy if exists an_editar on cif_anuncios;
create policy an_editar on cif_anuncios for update to authenticated
  using (cif_super() or (ministerio_id is not null and cif_rol(ministerio_id) = 'admin'));
drop policy if exists an_borrar on cif_anuncios;
create policy an_borrar on cif_anuncios for delete to authenticated
  using (cif_super() or (ministerio_id is not null and cif_rol(ministerio_id) = 'admin'));

grant select, insert, update, delete on cif_anuncios to authenticated;
revoke all on cif_anuncios from anon;

do $$ begin
  alter publication supabase_realtime add table cif_anuncios;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Versión 5: permisos de service_role para la función usuarios (= migraciones/004)
-- =====================================================================

grant usage on schema public to service_role;
grant select, insert, update, delete on cif_perfiles, cif_ministerios, cif_miembros, cif_canciones, cif_tonos, cif_sets, cif_tracks, cif_solicitudes, cif_amistades, cif_anuncios to service_role;
grant execute on all functions in schema public to service_role;

-- =====================================================================
-- Versión 6: foto, descripción y favoritas en el perfil (= migraciones/005)
-- =====================================================================

alter table cif_perfiles add column if not exists foto text;                          -- data:image/jpeg;base64,…
alter table cif_perfiles add column if not exists bio text;                           -- máx. 280 caracteres
alter table cif_perfiles add column if not exists favoritas uuid[] not null default '{}'; -- hasta 5 canciones

do $$ begin
  alter table cif_perfiles add constraint cif_perfiles_foto_tam check (foto is null or length(foto) < 200000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table cif_perfiles add constraint cif_perfiles_bio_tam check (bio is null or length(bio) <= 280);
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Versión 7: un solo desarrollador (= migraciones/006)
-- =====================================================================

create or replace function cif_proteger_perfil() returns trigger language plpgsql as $$
begin
  -- auth.uid() es null solo en SQL Editor / service role: desde la app siempre se conserva el valor anterior
  if new.superadmin is distinct from old.superadmin and auth.uid() is not null then new.superadmin := old.superadmin; end if;
  return new;
end $$;

-- y al crear un perfil desde la app nunca nace como desarrollador
create or replace function cif_proteger_perfil_alta() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.superadmin := false; end if;
  return new;
end $$;
drop trigger if exists cif_proteger_perfil_alta on cif_perfiles;
create trigger cif_proteger_perfil_alta before insert on cif_perfiles for each row execute function cif_proteger_perfil_alta();

-- =====================================================================
-- Versión 8: perfil y marca del ministerio (= migraciones/007)
-- =====================================================================

alter table cif_ministerios add column if not exists logo text;              -- data:image/png;base64,… (≈20–60 KB)
alter table cif_ministerios add column if not exists color_oscuro text;      -- banda de arriba (#1B1C1A)
alter table cif_ministerios add column if not exists color_primario text;    -- acordes y barras (#FF3D1A)
alter table cif_ministerios add column if not exists color_secundario text;  -- subtítulos (#98D5E0)
alter table cif_ministerios add column if not exists descripcion text;

do $$ begin
  alter table cif_ministerios add constraint cif_ministerios_logo_tam check (logo is null or length(logo) < 400000);
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Versión 9: portada del perfil (= migraciones/008)
-- =====================================================================

alter table cif_perfiles add column if not exists portada text;  -- data:image/jpeg;base64,…#y=0…100

do $$ begin
  alter table cif_perfiles add constraint cif_perfiles_portada_tam check (portada is null or length(portada) < 600000);
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Versión 10: colectivo Tiempo de Dios e intercambios (= migraciones/009)
-- =====================================================================

-- 1) Ministerios del colectivo
alter table cif_ministerios add column if not exists colectivo boolean not null default false;

create or replace function cif_norm(t text) returns text language sql immutable as $$
  select lower(trim(regexp_replace(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '\s+', ' ', 'g'))) $$;

-- Los que ya son del colectivo (el desarrollador marca los demás en la app: Ministerios → el ministerio → «Parte del colectivo»)
update cif_ministerios set colectivo = true
  where cif_norm(nombre) in ('kayros', 'kairos', 'zamar', 'surgit iglessia', 'surgit iglesia') and not colectivo;

-- 2) ¿El ministerio x ve esta canción?
create or replace function cif_min_ve(x uuid, m uuid, comp uuid[], vis text, aut text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_norm(aut) like '%tiempo de dios%'
      or m = x
      or x = any(coalesce(comp, '{}'))
      or (coalesce(vis, 'todos') = 'todos'
          and exists (select 1 from cif_ministerios where id = x and colectivo)
          and (m is null or exists (select 1 from cif_ministerios where id = m and colectivo))) $$;

-- ¿La persona que entró ve esta canción? (alguno de sus ministerios la ve; o es del desarrollador; o la creó ella)
create or replace function cif_ve_cancion(m uuid, comp uuid[], vis text, aut text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_super()
      or cif_norm(aut) like '%tiempo de dios%'
      or exists (select 1 from cif_miembros mi where mi.persona_id = auth.uid() and cif_min_ve(mi.ministerio_id, m, comp, vis, aut)) $$;
grant execute on function cif_min_ve(uuid, uuid, uuid[], text, text), cif_ve_cancion(uuid, uuid[], text, text) to authenticated;

drop policy if exists c_ver on cif_canciones;
create policy c_ver on cif_canciones for select to authenticated
  using (cif_ve_cancion(ministerio_id, compartida_con, visibilidad, autor) or creada_por = auth.uid());
drop policy if exists c_editar on cif_canciones;
create policy c_editar on cif_canciones for update to authenticated
  using (cif_es_musico() and (cif_ve_cancion(ministerio_id, compartida_con, visibilidad, autor) or creada_por = auth.uid()));

-- 3) Envíos e intercambios
create table if not exists cif_intercambios (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references cif_ministerios on delete cascade,     -- quien propone
  para uuid not null references cif_ministerios on delete cascade,   -- quien recibe y acepta
  tipo text not null default 'envio' check (tipo in ('envio', 'intercambio')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado', 'cancelado')),
  mensaje text,
  resultado jsonb,                                                   -- {a_para: n, a_de: n}
  creado_por uuid references auth.users default auth.uid(),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

alter table cif_intercambios enable row level security;
drop policy if exists ix_ver on cif_intercambios;
create policy ix_ver on cif_intercambios for select to authenticated
  using (cif_super() or cif_rol(de) is not null or cif_rol(para) is not null);
drop policy if exists ix_alta on cif_intercambios;
create policy ix_alta on cif_intercambios for insert to authenticated
  with check (de <> para and (cif_super() or cif_rol(de) = 'admin'));
drop policy if exists ix_editar on cif_intercambios;
create policy ix_editar on cif_intercambios for update to authenticated
  using (cif_super() or cif_rol(de) = 'admin' or cif_rol(para) = 'admin');
drop policy if exists ix_borrar on cif_intercambios;
create policy ix_borrar on cif_intercambios for delete to authenticated
  using (cif_super() or cif_rol(de) = 'admin');
grant select, insert, update, delete on cif_intercambios to authenticated;
grant select, insert, update, delete on cif_intercambios to service_role;
revoke all on cif_intercambios from anon;
do $$ begin
  alter publication supabase_realtime add table cif_intercambios;
exception when duplicate_object then null; end $$;

-- Copia a «destino» las canciones que «origen» ve y «destino» no tiene (mismo título, sin acentos ni mayúsculas).
-- Las copias quedan como canciones de «destino» (solo su ministerio) y se pueden editar sin tocar las de «origen».
create or replace function cif_copiar_canciones(origen uuid, destino uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into cif_canciones (titulo, autor, tono, bpm, compas, contenido, orden, etiquetas, liga, notas, ministerio_id, origen, visibilidad, compartida_con, creada_por)
  select distinct on (cif_norm(s.titulo)) s.titulo, s.autor, s.tono, s.bpm, s.compas, s.contenido, s.orden, s.etiquetas, s.liga, s.notas,
         destino, 'intercambio', 'ministerio', '{}', auth.uid()
  from cif_canciones s
  where not s.borrada
    and cif_min_ve(origen, s.ministerio_id, s.compartida_con, s.visibilidad, s.autor)
    and not exists (
      select 1 from cif_canciones d
      where not d.borrada and cif_norm(d.titulo) = cif_norm(s.titulo)
        and cif_min_ve(destino, d.ministerio_id, d.compartida_con, d.visibilidad, d.autor))
  order by cif_norm(s.titulo), s.actualizado desc;
  get diagnostics n = row_count;
  return n;
end $$;

-- Acepta un envío o intercambio pendiente (solo el admin del ministerio que recibe, o el desarrollador)
create or replace function cif_transferir(i uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x cif_intercambios; a int := 0; b int := 0; r jsonb;
begin
  select * into x from cif_intercambios where id = i for update;
  if not found then raise exception 'No encontré ese envío.'; end if;
  if x.estado <> 'pendiente' then raise exception 'Ese envío ya se resolvió.'; end if;
  if not (cif_super() or cif_rol(x.para) = 'admin') then raise exception 'Solo un admin del ministerio que recibe puede aceptarlo.'; end if;
  a := cif_copiar_canciones(x.de, x.para);
  if x.tipo = 'intercambio' then b := cif_copiar_canciones(x.para, x.de); end if;
  r := jsonb_build_object('a_para', a, 'a_de', b);
  update cif_intercambios set estado = 'aceptado', resultado = r, actualizado = now() where id = i;
  return r;
end $$;

revoke execute on function cif_copiar_canciones(uuid, uuid) from public, anon, authenticated;
grant execute on function cif_transferir(uuid) to authenticated;

-- =====================================================================
-- Versión 11: canciones de los ministerios del colectivo = de Tiempo de Dios (= migraciones/010)
-- =====================================================================

create or replace function cif_es_tdd(aut text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_norm(aut) like '%tiempo de dios%'
      or exists (
        select 1 from unnest(string_to_array(coalesce(aut, ''), ' × ')) a
        join cif_ministerios m on m.colectivo and cif_norm(m.nombre) = cif_norm(a)) $$;

create or replace function cif_min_ve(x uuid, m uuid, comp uuid[], vis text, aut text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_es_tdd(aut)
      or m = x
      or x = any(coalesce(comp, '{}'))
      or (coalesce(vis, 'todos') = 'todos'
          and exists (select 1 from cif_ministerios where id = x and colectivo)
          and (m is null or exists (select 1 from cif_ministerios where id = m and colectivo))) $$;

create or replace function cif_ve_cancion(m uuid, comp uuid[], vis text, aut text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_super()
      or cif_es_tdd(aut)
      or exists (select 1 from cif_miembros mi where mi.persona_id = auth.uid() and cif_min_ve(mi.ministerio_id, m, comp, vis, aut)) $$;

grant execute on function cif_es_tdd(text) to authenticated;

-- =====================================================================
-- Versión 12: una librería por ministerio + banco de canciones (= migraciones/011)
-- =====================================================================

-- 1) Las canciones sin ministerio son de KAYRÓS (la librería con la que se empezó)
update cif_canciones set actualizado = now(), ministerio_id = (select id from cif_ministerios where cif_norm(nombre) in ('kayros', 'kairos') order by nombre limit 1)
where ministerio_id is null and exists (select 1 from cif_ministerios where cif_norm(nombre) in ('kayros', 'kairos'));

-- 2) Reglas
create or replace function cif_es_liturgica(etq text[], tit text) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(coalesce(etq, '{}')) e where cif_norm(e) like 'liturg%') or cif_norm(tit) ~ '^misa\M' $$;

create or replace function cif_lib_ve(x uuid, m uuid, comp uuid[], aut text, etq text[], tit text) returns boolean
language sql stable security definer set search_path = public as $$
  select m = x
      or x = any(coalesce(comp, '{}'))
      or cif_es_tdd(aut)
      or (cif_es_liturgica(etq, tit) and exists (select 1 from cif_ministerios where id = x and colectivo)) $$;

create or replace function cif_ve(m uuid, comp uuid[], aut text, etq text[], tit text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_super()
      or cif_es_tdd(aut)
      or exists (select 1 from cif_miembros mi where mi.persona_id = auth.uid() and cif_lib_ve(mi.ministerio_id, m, comp, aut, etq, tit)) $$;
grant execute on function cif_es_liturgica(text[], text), cif_lib_ve(uuid, uuid, uuid[], text, text[], text), cif_ve(uuid, uuid[], text, text[], text) to authenticated;

drop policy if exists c_ver on cif_canciones;
create policy c_ver on cif_canciones for select to authenticated
  using (cif_ve(ministerio_id, compartida_con, autor, etiquetas, titulo) or creada_por = auth.uid());
drop policy if exists c_editar on cif_canciones;
create policy c_editar on cif_canciones for update to authenticated
  using (cif_es_musico() and (cif_ve(ministerio_id, compartida_con, autor, etiquetas, titulo) or creada_por = auth.uid()));

-- 3) Copiar canciones a una librería (sin repetir títulos que ya tenga). Lo usan los intercambios y el banco.
create or replace function cif_copiar_lista(ids uuid[], destino uuid, de_donde text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into cif_canciones (titulo, autor, tono, bpm, compas, contenido, orden, etiquetas, liga, notas, ministerio_id, origen, visibilidad, compartida_con, creada_por)
  select distinct on (cif_norm(s.titulo)) s.titulo, s.autor, s.tono, s.bpm, s.compas, s.contenido, s.orden, s.etiquetas, s.liga, s.notas,
         destino, de_donde, 'todos', '{}', auth.uid()
  from cif_canciones s
  where s.id = any(ids) and not s.borrada
    and not exists (
      select 1 from cif_canciones d
      where not d.borrada and cif_norm(d.titulo) = cif_norm(s.titulo)
        and cif_lib_ve(destino, d.ministerio_id, d.compartida_con, d.autor, d.etiquetas, d.titulo))
  order by cif_norm(s.titulo), s.actualizado desc;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function cif_copiar_canciones(origen uuid, destino uuid) returns int
language sql security definer set search_path = public as $$
  -- $1 = origen, $2 = destino (por número: «origen» también es una columna de cif_canciones)
  select cif_copiar_lista(array(
    select s.id from cif_canciones s where not s.borrada
      and cif_lib_ve($1, s.ministerio_id, s.compartida_con, s.autor, s.etiquetas, s.titulo)), $2, 'intercambio') $$;
revoke execute on function cif_copiar_lista(uuid[], uuid, text), cif_copiar_canciones(uuid, uuid) from public, anon, authenticated;

-- 4) Banco: buscar en todas las canciones abiertas (solo título, artistas y datos; la letra se copia al añadir)
create or replace function cif_banco(q text default '', lim int default 300)
returns table (id uuid, titulo text, autor text, tono text, bpm int, etiquetas text[], ministerio_id uuid, ministerio text, copias int)
language sql stable security definer set search_path = public as $$
  select distinct on (cif_norm(c.titulo), cif_norm(c.autor))
         c.id, c.titulo, c.autor, c.tono, c.bpm, c.etiquetas, c.ministerio_id, m.nombre,
         (count(*) over (partition by cif_norm(c.titulo), cif_norm(c.autor)))::int
  from cif_canciones c left join cif_ministerios m on m.id = c.ministerio_id
  where auth.uid() is not null and not c.borrada and coalesce(c.visibilidad, 'todos') = 'todos'
    and (coalesce(q, '') = '' or cif_norm(c.titulo || ' ' || c.autor) like '%' || cif_norm(q) || '%')
  order by cif_norm(c.titulo), cif_norm(c.autor), c.actualizado desc
  limit greatest(1, least(coalesce(lim, 300), 1000)) $$;

-- Añadir canciones del banco a la librería de un ministerio (músicos y admins de ese ministerio, o el desarrollador)
create or replace function cif_agregar(ids uuid[], destino uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not (cif_super() or cif_rol(destino) in ('admin', 'musico')) then raise exception 'Solo los músicos y admins de ese ministerio pueden añadir canciones.'; end if;
  return cif_copiar_lista(array(select id from cif_canciones where id = any(ids) and coalesce(visibilidad, 'todos') = 'todos'), destino, 'banco');
end $$;
grant execute on function cif_banco(text, int), cif_agregar(uuid[], uuid) to authenticated;
revoke execute on function cif_banco(text, int), cif_agregar(uuid[], uuid) from anon;

-- Primer superadmin (cambia el correo y corre esta línea):
-- update cif_perfiles set superadmin = true where id = (select id from auth.users where email = 'tu-correo@tiempodedios.mx');
