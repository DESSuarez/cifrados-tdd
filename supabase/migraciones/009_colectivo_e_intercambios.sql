-- 009 · Colectivo Tiempo de Dios e intercambio de canciones entre ministerios
--
-- Quién ve una canción (cif_min_ve):
--   · Si «Tiempo de Dios» es uno de sus artistas → la ven TODOS los ministerios.
--   · Si es del colectivo (su ministerio es del colectivo, o no tiene ministerio) y está abierta («todos») → la ven los ministerios del colectivo.
--   · Si es de un ministerio de fuera del colectivo → solo ese ministerio y aquellos con los que se compartió.
-- Intercambios: un ministerio le «envía» a otro las canciones que el otro no tiene, o «intercambian» en los dos sentidos.
--   El admin del ministerio que recibe acepta; la copia la hace cif_transferir() del lado del servidor.
-- Correr completo en SQL Editor (se puede volver a correr).

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
