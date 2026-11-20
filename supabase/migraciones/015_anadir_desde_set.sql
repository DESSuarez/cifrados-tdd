-- 015 · Añadir a mi librería una canción que otro ministerio trajo a un set compartido
-- En un set compartido, cada ministerio invitado agrega canciones de su propia librería (aunque no estén en el banco).
-- Los demás ministerios del set ya las ven dentro del set (migración 012); con esto las pueden enlazar a su librería.
-- Correr completo en SQL Editor (se puede volver a correr).

create or replace function cif_agregar_de_set(c uuid, destino uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (cif_super() or cif_rol(destino) in ('admin', 'musico')) then raise exception 'Solo los músicos y admins de ese ministerio pueden añadir canciones.'; end if;
  if not (cif_super() or cif_cancion_en_mis_sets(c) or exists (
      select 1 from cif_canciones s where s.id = c and coalesce(s.visibilidad, 'todos') = 'todos')) then
    raise exception 'Esa canción no está en un set tuyo ni en el banco.';
  end if;
  update cif_canciones s set compartida_con = array_append(coalesce(s.compartida_con, '{}'), destino)
  where s.id = c and not s.borrada and s.ministerio_id is distinct from destino
    and not (destino = any(coalesce(s.compartida_con, '{}')));
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function cif_agregar_de_set(uuid, uuid) to authenticated;
revoke execute on function cif_agregar_de_set(uuid, uuid) from anon;
