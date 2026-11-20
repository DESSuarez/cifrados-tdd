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

-- Primer superadmin (cambia el correo y corre esta línea):
-- update cif_perfiles set superadmin = true where id = (select id from auth.users where email = 'tu-correo@tiempodedios.mx');
