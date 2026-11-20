-- 011 · Una librería por ministerio + banco de canciones
--
-- La librería de cada ministerio (cif_lib_ve) tiene:
--   · sus canciones (ministerio_id) y las que le compartieron (compartida_con);
--   · las de Tiempo de Dios (Tiempo de Dios o un ministerio del colectivo como artista) → todos los ministerios;
--   · las litúrgicas (etiqueta «Litúrgica» o título que empieza con «Misa») → los ministerios del colectivo.
-- Ya no se comparte entre el colectivo todo lo demás («Otras canciones»): cada quien tiene las suyas.
-- Banco de canciones: todas las canciones abiertas (visibilidad 'todos') de todos los ministerios, para buscar por título
-- y «Añadir» una copia a la librería propia (cif_banco, cif_agregar). Las de visibilidad 'ministerio' no salen en el banco.
-- Las canciones que hoy no tienen ministerio pasan a la librería de KAYRÓS.
-- Correr completo en SQL Editor (se puede volver a correr).

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
