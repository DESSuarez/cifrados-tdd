-- 013 · Banco enlazado (siempre la versión más nueva), quién edita una canción, tonos que asigna el admin
--      y hora del servidor para que la sincronización entre celular y computadora no se pierda.
-- Correr completo en SQL Editor (se puede volver a correr).

-- 1) La hora de cada cambio la pone el servidor (antes la ponía el dispositivo: si su reloj iba adelantado
--    o atrasado, otros dispositivos se saltaban el cambio al sincronizar).
create or replace function cif_sello() returns trigger language plpgsql as $$
begin new.actualizado := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['cif_canciones','cif_tonos','cif_sets','cif_tracks','cif_ministerios','cif_miembros','cif_perfiles',
                           'cif_solicitudes','cif_amistades','cif_anuncios','cif_intercambios'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'actualizado') then
      execute format('drop trigger if exists %I on %I', t || '_sello', t);
      execute format('create trigger %I before insert or update on %I for each row execute function cif_sello()', t || '_sello', t);
    end if;
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- 2) ¿Quién edita una canción? Quien la subió, el admin del ministerio de donde salió, o los músicos y admins
--    del ministerio que es su artista (p. ej. KAYRÓS en «Nadie igual · KAYRÓS × Tiempo de Dios»). Y el desarrollador.
create or replace function cif_puede_editar(m uuid, creador uuid, aut text) returns boolean
language sql stable security definer set search_path = public as $$
  select cif_super()
      or creador = auth.uid()
      or (m is not null and cif_rol(m) = 'admin')
      or exists (
        select 1 from unnest(string_to_array(coalesce(aut, ''), ' × ')) a
        join cif_ministerios mi on cif_norm(mi.nombre) = cif_norm(a)
        join cif_miembros x on x.ministerio_id = mi.id and x.persona_id = auth.uid() and x.rol in ('admin', 'musico')) $$;
grant execute on function cif_puede_editar(uuid, uuid, text) to authenticated;

drop policy if exists c_editar on cif_canciones;
create policy c_editar on cif_canciones for update to authenticated
  using (cif_puede_editar(ministerio_id, creada_por, autor));

-- 3) Añadir del banco = enlazar la canción original a mi librería (compartida_con), no copiarla:
--    todos ven siempre la versión más nueva y solo su autor o artista la cambia.
create or replace function cif_agregar(ids uuid[], destino uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (cif_super() or cif_rol(destino) in ('admin', 'musico')) then raise exception 'Solo los músicos y admins de ese ministerio pueden añadir canciones.'; end if;
  update cif_canciones s set compartida_con = array_append(coalesce(s.compartida_con, '{}'), destino)
  where s.id = any(ids) and not s.borrada and coalesce(s.visibilidad, 'todos') = 'todos'
    and not (destino = any(coalesce(s.compartida_con, '{}')))
    and not exists (
      select 1 from cif_canciones d
      where not d.borrada and cif_norm(d.titulo) = cif_norm(s.titulo)
        and cif_lib_ve(destino, d.ministerio_id, d.compartida_con, d.autor, d.etiquetas, d.titulo));
  get diagnostics n = row_count;
  return n;
end $$;

-- Los intercambios también enlazan en lugar de copiar
create or replace function cif_copiar_lista(ids uuid[], destino uuid, de_donde text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update cif_canciones s set compartida_con = array_append(coalesce(s.compartida_con, '{}'), destino)
  where s.id = any(ids) and not s.borrada
    and not (destino = any(coalesce(s.compartida_con, '{}'))) and s.ministerio_id is distinct from destino
    and not exists (
      select 1 from cif_canciones d
      where not d.borrada and cif_norm(d.titulo) = cif_norm(s.titulo)
        and cif_lib_ve(destino, d.ministerio_id, d.compartida_con, d.autor, d.etiquetas, d.titulo));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function cif_copiar_lista(uuid[], uuid, text) from public, anon, authenticated;

-- Banco: una sola fila por canción (título + artistas), la versión más reciente
create or replace function cif_banco(q text default '', lim int default 300)
returns table (id uuid, titulo text, autor text, tono text, bpm int, etiquetas text[], ministerio_id uuid, ministerio text, copias int)
language sql stable security definer set search_path = public as $$
  select distinct on (cif_norm(c.titulo), cif_norm(c.autor))
         c.id, c.titulo, c.autor, c.tono, c.bpm, c.etiquetas, c.ministerio_id, m.nombre,
         (1 + coalesce(array_length(c.compartida_con, 1), 0))::int
  from cif_canciones c left join cif_ministerios m on m.id = c.ministerio_id
  where auth.uid() is not null and not c.borrada and coalesce(c.visibilidad, 'todos') = 'todos'
    and (coalesce(q, '') = '' or cif_norm(c.titulo || ' ' || c.autor) like '%' || cif_norm(q) || '%')
  order by cif_norm(c.titulo), cif_norm(c.autor), c.actualizado desc
  limit greatest(1, least(coalesce(lim, 300), 1000)) $$;

-- 4) Las copias que ya se hicieron (del banco o de intercambios) se juntan con su original:
--    se queda la versión más reciente, la librería de la copia pasa a ver la original y los sets, tonos y pistas
--    que apuntaban a la copia ahora apuntan a la original.
do $$ declare cp record; o record; begin
  for cp in select * from cif_canciones where not borrada and origen in ('banco', 'intercambio') order by actualizado loop
    select * into o from cif_canciones
      where not borrada and coalesce(origen, '') not in ('banco', 'intercambio') and id <> cp.id
        and cif_norm(titulo) = cif_norm(cp.titulo) and cif_norm(autor) = cif_norm(cp.autor)
      order by actualizado desc limit 1;
    if not found then continue; end if;
    -- si la copia es más nueva, su letra y acordes pasan a la original
    if cp.actualizado > o.actualizado then
      update cif_canciones set contenido = cp.contenido, tono = cp.tono, bpm = cp.bpm, compas = cp.compas, orden = cp.orden,
        etiquetas = cp.etiquetas, liga = cp.liga, notas = cp.notas where id = o.id;
    end if;
    if cp.ministerio_id is not null and cp.ministerio_id is distinct from o.ministerio_id then
      update cif_canciones set compartida_con = array_append(coalesce(compartida_con, '{}'), cp.ministerio_id)
        where id = o.id and not (cp.ministerio_id = any(coalesce(compartida_con, '{}')));
    end if;
    update cif_sets s set items = (
        select coalesce(jsonb_agg(case when x->>'cancion_id' = cp.id::text then jsonb_set(x, '{cancion_id}', to_jsonb(o.id::text)) else x end), '[]'::jsonb)
        from jsonb_array_elements(s.items) x)
      where s.items @> jsonb_build_array(jsonb_build_object('cancion_id', cp.id::text));
    insert into cif_tonos (cancion_id, persona_id, tono, capo)
      select o.id, t.persona_id, t.tono, t.capo from cif_tonos t where t.cancion_id = cp.id
      on conflict (cancion_id, persona_id) do nothing;
    update cif_tracks set cancion_id = o.id where cancion_id = cp.id;
    update cif_canciones set borrada = true where id = cp.id;
  end loop;
end $$;

-- 5) Tonos: cada quien guarda el suyo, y el admin de un ministerio puede asignárselo a sus integrantes
drop policy if exists t_propio on cif_tonos;
create policy t_propio on cif_tonos for all to authenticated
  using (persona_id = auth.uid() or cif_super() or exists (
    select 1 from cif_miembros a join cif_miembros b on b.ministerio_id = a.ministerio_id
    where a.persona_id = auth.uid() and a.rol = 'admin' and b.persona_id = cif_tonos.persona_id))
  with check (persona_id = auth.uid() or cif_super() or exists (
    select 1 from cif_miembros a join cif_miembros b on b.ministerio_id = a.ministerio_id
    where a.persona_id = auth.uid() and a.rol = 'admin' and b.persona_id = cif_tonos.persona_id));
