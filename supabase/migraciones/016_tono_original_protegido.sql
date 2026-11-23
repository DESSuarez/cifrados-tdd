-- 016 · El tono original de una canción solo lo cambia quien la subió (o el desarrollador).
-- Cada quien guarda su tono en cif_tonos y cada set el suyo en sus items; ninguno de los dos toca la canción.
create or replace function cif_tono_original() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tono is distinct from old.tono
     and auth.uid() is not null
     and not cif_super()
     and old.creada_por is distinct from auth.uid() then
    raise exception 'Solo quien subió «%» puede cambiar su tono original (%).', old.titulo, old.tono;
  end if;
  return new;
end $$;
drop trigger if exists cif_canciones_tono on cif_canciones;
create trigger cif_canciones_tono before update on cif_canciones
  for each row execute function cif_tono_original();
