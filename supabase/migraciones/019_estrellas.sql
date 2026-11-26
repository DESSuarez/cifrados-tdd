-- Tabla de estrellas: favoritos por usuario.
-- Cada persona puede dar una estrella a cada canción (toggle).
create table if not exists cif_estrellas (
  cancion_id uuid not null references cif_canciones(id) on delete cascade,
  persona_id uuid not null references auth.users(id) on delete cascade,
  actualizado timestamptz not null default now(),
  primary key (cancion_id, persona_id)
);

alter table cif_estrellas enable row level security;

create policy "cif_estrellas_select" on cif_estrellas for select using (true);
create policy "cif_estrellas_insert" on cif_estrellas for insert with check (persona_id = auth.uid());
create policy "cif_estrellas_delete" on cif_estrellas for delete using (persona_id = auth.uid());

create index if not exists idx_estrellas_cancion on cif_estrellas(cancion_id);

grant select, insert, delete on cif_estrellas to authenticated;
