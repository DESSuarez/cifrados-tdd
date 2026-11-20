-- 012 · Sets compartidos entre ministerios
-- Un ministerio arma un set (p. ej. el cenáculo del martes) e invita a otros ministerios (ARIA, Surgit Iglessia…):
-- todos ven el mismo set en tiempo real, lo pueden editar sus músicos y admins, y ven las canciones del set
-- aunque no estén en su librería.
-- Correr completo en SQL Editor (se puede volver a correr).

alter table cif_sets add column if not exists invitados uuid[] not null default '{}';

-- ¿Estoy en el ministerio del set o en uno invitado? (con rol mínimo)
create or replace function cif_en_set(m uuid, inv uuid[], editar boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_super() or exists (
    select 1 from cif_miembros mi
    where mi.persona_id = auth.uid() and (mi.ministerio_id = m or mi.ministerio_id = any(coalesce(inv, '{}')))
      and (not editar or mi.rol in ('admin', 'musico'))) $$;
grant execute on function cif_en_set(uuid, uuid[], boolean) to authenticated;

drop policy if exists s_ver on cif_sets;
create policy s_ver on cif_sets for select to authenticated using (cif_en_set(ministerio_id, invitados));
drop policy if exists s_editar on cif_sets;
create policy s_editar on cif_sets for update to authenticated using (cif_en_set(ministerio_id, invitados, true));

-- Las canciones de un set que me compartieron se ven aunque no estén en mi librería (no aparecen en la librería, solo en el set)
create or replace function cif_cancion_en_mis_sets(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cif_sets s
    where not s.borrada and cif_en_set(s.ministerio_id, s.invitados)
      and s.items @> jsonb_build_array(jsonb_build_object('cancion_id', c::text))) $$;
grant execute on function cif_cancion_en_mis_sets(uuid) to authenticated;

drop policy if exists c_ver_set on cif_canciones;
create policy c_ver_set on cif_canciones for select to authenticated using (cif_cancion_en_mis_sets(id));
