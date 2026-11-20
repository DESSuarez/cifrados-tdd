-- 007 · Perfil y marca del ministerio (logo, colores y descripción para la app y los PDF)
-- Lo edita el admin del ministerio o el desarrollador (la política m_editar ya lo permite).
-- Correr completo en SQL Editor (se puede volver a correr).

alter table cif_ministerios add column if not exists logo text;              -- data:image/png;base64,… (≈20–60 KB)
alter table cif_ministerios add column if not exists color_oscuro text;      -- banda de arriba (#1B1C1A)
alter table cif_ministerios add column if not exists color_primario text;    -- acordes y barras (#FF3D1A)
alter table cif_ministerios add column if not exists color_secundario text;  -- subtítulos (#98D5E0)
alter table cif_ministerios add column if not exists descripcion text;

do $$ begin
  alter table cif_ministerios add constraint cif_ministerios_logo_tam check (logo is null or length(logo) < 400000);
exception when duplicate_object then null; end $$;
