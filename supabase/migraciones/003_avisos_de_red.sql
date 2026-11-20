-- 003 · Avisos de red local
-- Quien dirige prende la red (node red/servidor.js) y desde la app manda a su ministerio la dirección, el PIN y el Wi-Fi.
-- A cada integrante le aparece una ventana con esos datos para copiar y conectarse.
-- Correr completo en SQL Editor (se puede volver a correr). También está al final de schema.sql.

create table if not exists cif_anuncios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'red',
  ministerio_id uuid references cif_ministerios on delete cascade,  -- null = para todos los ministerios (solo desarrollador)
  datos jsonb not null default '{}'::jsonb,                         -- {urls:[], pin, wifi, equipo, nota}
  activo boolean not null default true,
  vence timestamptz,
  creado_por uuid references auth.users default auth.uid(),
  actualizado timestamptz not null default now()
);

alter table cif_anuncios enable row level security;
drop policy if exists an_ver on cif_anuncios;
create policy an_ver on cif_anuncios for select to authenticated
  using (ministerio_id is null or cif_super() or cif_rol(ministerio_id) is not null);
drop policy if exists an_alta on cif_anuncios;
create policy an_alta on cif_anuncios for insert to authenticated
  with check (cif_super() or (ministerio_id is not null and cif_rol(ministerio_id) = 'admin'));
drop policy if exists an_editar on cif_anuncios;
create policy an_editar on cif_anuncios for update to authenticated
  using (cif_super() or (ministerio_id is not null and cif_rol(ministerio_id) = 'admin'));
drop policy if exists an_borrar on cif_anuncios;
create policy an_borrar on cif_anuncios for delete to authenticated
  using (cif_super() or (ministerio_id is not null and cif_rol(ministerio_id) = 'admin'));

grant select, insert, update, delete on cif_anuncios to authenticated;
revoke all on cif_anuncios from anon;

do $$ begin
  alter publication supabase_realtime add table cif_anuncios;
exception when duplicate_object then null; end $$;
