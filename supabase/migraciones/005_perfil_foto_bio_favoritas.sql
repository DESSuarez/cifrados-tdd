-- 005 · Perfil: foto pequeña, descripción y canciones favoritas
-- La foto se guarda ya recortada y comprimida (≈10 KB, 192 px) dentro del perfil: no necesita bucket.
-- Correr completo en SQL Editor (se puede volver a correr).

alter table cif_perfiles add column if not exists foto text;                          -- data:image/jpeg;base64,…
alter table cif_perfiles add column if not exists bio text;                           -- máx. 280 caracteres
alter table cif_perfiles add column if not exists favoritas uuid[] not null default '{}'; -- hasta 5 canciones

do $$ begin
  alter table cif_perfiles add constraint cif_perfiles_foto_tam check (foto is null or length(foto) < 200000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table cif_perfiles add constraint cif_perfiles_bio_tam check (bio is null or length(bio) <= 280);
exception when duplicate_object then null; end $$;
