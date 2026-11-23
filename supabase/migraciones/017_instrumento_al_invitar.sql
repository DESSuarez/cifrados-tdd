-- 017 · Instrumento o función al dar de alta.
-- Al invitar o crear una cuenta se puede marcar qué hace la persona (Batería, Percusión, Voz principal…).
-- Se guarda en cif_perfiles.voz (la misma lista «¿Qué haces en el ministerio?» del perfil), sumando a lo que ya tenía.
-- Lo puede hacer el desarrollador o un admin de algún ministerio donde esté esa persona.
create or replace function cif_poner_roles(p uuid, v text) returns text
language plpgsql security definer set search_path = public as $$
declare
  actual text;
  lista text[];
begin
  if not (cif_super() or exists (
    select 1 from cif_miembros mm where mm.persona_id = p and cif_rol(mm.ministerio_id) = 'admin'
  )) then
    raise exception 'Solo el desarrollador o un admin de su ministerio marca su instrumento.';
  end if;
  select voz into actual from cif_perfiles where id = p;
  select array_agg(distinct x order by x) into lista
  from (
    select trim(x) as x from regexp_split_to_table(coalesce(actual, '') || ',' || coalesce(v, ''), '\s*[,;·]\s*') as x
  ) t where x <> '';
  update cif_perfiles set voz = array_to_string(lista, ', ') where id = p;
  return array_to_string(lista, ', ');
end $$;
grant execute on function cif_poner_roles(uuid, text) to authenticated;
