-- 002 · Solistas y canciones compartidas entre ministerios
-- Correr completo en SQL Editor (se puede volver a correr). También está al final de schema.sql.

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
