-- 010 · Las canciones de los ministerios del colectivo cuentan como de Tiempo de Dios
-- Antes había que poner «Tiempo de Dios» como artista. Ahora una canción es «de Tiempo de Dios» si uno de sus artistas
-- es Tiempo de Dios o un ministerio del colectivo (KAYRÓS, ZAMAR…): sale en la pestaña Tiempo de Dios y la ven todos.
-- Los artistas van en «autor» separados por « × ».
-- Correr completo en SQL Editor (se puede volver a correr).

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

-- ---------------------------------------------------------------------
-- OPCIONAL · Quitar «Tiempo de Dios» de los artistas donde ya no hace falta
-- (canciones que también tienen como artista a un ministerio del colectivo).
-- 1) Primero revisa cuáles cambiarían:
--
-- select titulo, autor,
--        array_to_string(array(select a from unnest(string_to_array(autor, ' × ')) a where cif_norm(a) <> 'tiempo de dios'), ' × ') as queda
-- from cif_canciones
-- where not borrada and autor like '% × %'
--   and exists (select 1 from unnest(string_to_array(autor, ' × ')) a where cif_norm(a) = 'tiempo de dios')
--   and exists (select 1 from unnest(string_to_array(autor, ' × ')) a join cif_ministerios m on m.colectivo and cif_norm(m.nombre) = cif_norm(a));
--
-- 2) Si se ve bien, quita los guiones «--» de este update y córrelo:
--
-- update cif_canciones
-- set autor = array_to_string(array(select a from unnest(string_to_array(autor, ' × ')) a where cif_norm(a) <> 'tiempo de dios'), ' × '),
--     actualizado = now()
-- where not borrada and autor like '% × %'
--   and exists (select 1 from unnest(string_to_array(autor, ' × ')) a where cif_norm(a) = 'tiempo de dios')
--   and exists (select 1 from unnest(string_to_array(autor, ' × ')) a join cif_ministerios m on m.colectivo and cif_norm(m.nombre) = cif_norm(a));
