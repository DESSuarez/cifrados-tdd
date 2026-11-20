-- 006 · Un solo desarrollador
-- Nadie puede volverse (ni volver a otro) desarrollador desde la app, ni siquiera el propio desarrollador.
-- Solo se cambia aquí, en SQL Editor, con:
--   update cif_perfiles set superadmin = true where id = (select id from auth.users where email = '…');
-- Correr completo en SQL Editor (se puede volver a correr).

create or replace function cif_proteger_perfil() returns trigger language plpgsql as $$
begin
  -- auth.uid() es null solo en SQL Editor / service role: desde la app siempre se conserva el valor anterior
  if new.superadmin is distinct from old.superadmin and auth.uid() is not null then new.superadmin := old.superadmin; end if;
  return new;
end $$;

-- y al crear un perfil desde la app nunca nace como desarrollador
create or replace function cif_proteger_perfil_alta() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.superadmin := false; end if;
  return new;
end $$;
drop trigger if exists cif_proteger_perfil_alta on cif_perfiles;
create trigger cif_proteger_perfil_alta before insert on cif_perfiles for each row execute function cif_proteger_perfil_alta();
