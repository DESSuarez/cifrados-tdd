-- 004 · Permisos para la función «usuarios» (service_role)
-- En proyectos nuevos de Supabase las tablas creadas por SQL no dan permisos ni a service_role.
-- Sin esto la función no puede leer cif_perfiles, no reconoce al desarrollador y responde
-- «Solo el desarrollador ve todas las cuentas». Correr completo en SQL Editor (se puede volver a correr).

grant usage on schema public to service_role;
grant select, insert, update, delete on cif_perfiles, cif_ministerios, cif_miembros, cif_canciones, cif_tonos, cif_sets, cif_tracks, cif_solicitudes, cif_amistades, cif_anuncios to service_role;
grant execute on all functions in schema public to service_role;
