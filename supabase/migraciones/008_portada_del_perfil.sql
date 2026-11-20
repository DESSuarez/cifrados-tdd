-- 008 · Portada del perfil (como la carta de presentación de la Bitácora)
-- La imagen se guarda ya comprimida (JPEG ≤1200 px, ≈150 KB) dentro del perfil; la posición vertical va al final como «#y=0…100».
-- Solo la cambia la persona dueña (la política de cif_perfiles ya lo limita).
-- Correr completo en SQL Editor (se puede volver a correr).

alter table cif_perfiles add column if not exists portada text;

do $$ begin
  alter table cif_perfiles add constraint cif_perfiles_portada_tam check (portada is null or length(portada) < 600000);
exception when duplicate_object then null; end $$;
