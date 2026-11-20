-- 014 · Cualquier usuario sube canciones al banco + «Canciones que ha subido» en el perfil
-- Antes, crear una canción exigía ser músico de un ministerio CON suscripción vigente: si no, la nube la rechazaba,
-- se quedaba solo en el dispositivo de quien la subió y nunca llegaba al banco (le pasó a Álvaro).
-- La suscripción sigue siendo solo para exportar e importar respaldos.
-- Correr completo en SQL Editor (se puede volver a correr).

-- 1) Subir canciones: cualquier usuario con sesión, a su nombre; si la pone en un ministerio, debe ser músico o admin de él
drop policy if exists c_alta on cif_canciones;
create policy c_alta on cif_canciones for insert to authenticated
  with check (
    cif_super()
    or (coalesce(creada_por, auth.uid()) = auth.uid()
        and (ministerio_id is null or cif_rol(ministerio_id) in ('admin', 'musico'))));

-- 2) Canciones que subió una persona (las del banco y las que tú ya puedes ver), para su perfil
create or replace function cif_subidas(p uuid)
returns table (id uuid, titulo text, autor text, tono text, etiquetas text[], ministerio_id uuid, ministerio text, actualizado timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.titulo, c.autor, c.tono, c.etiquetas, c.ministerio_id, m.nombre, c.actualizado
  from cif_canciones c left join cif_ministerios m on m.id = c.ministerio_id
  where auth.uid() is not null and c.creada_por = p and not c.borrada
    and (coalesce(c.visibilidad, 'todos') = 'todos' or cif_ve(c.ministerio_id, c.compartida_con, c.autor, c.etiquetas, c.titulo))
  order by c.actualizado desc
  limit 500 $$;
grant execute on function cif_subidas(uuid) to authenticated;
revoke execute on function cif_subidas(uuid) from anon;
