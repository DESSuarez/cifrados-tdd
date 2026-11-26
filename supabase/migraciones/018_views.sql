-- Tabla de views: aperturas y tiempo por canción por persona.
-- La app trackea cuántas veces se abrió cada canción y cuánto tiempo se pasó leyéndola.
create table if not exists cif_views (
  cancion_id uuid not null references cif_canciones(id) on delete cascade,
  persona_id uuid not null references auth.users(id) on delete cascade,
  aperturas integer not null default 0,
  segundos integer not null default 0,
  actualizado timestamptz not null default now(),
  primary key (cancion_id, persona_id)
);

alter table cif_views enable row level security;

create policy "cif_views_select" on cif_views for select using (true);
create policy "cif_views_insert" on cif_views for insert with check (persona_id = auth.uid());
create policy "cif_views_update" on cif_views for update using (persona_id = auth.uid());

create index if not exists idx_views_cancion on cif_views(cancion_id);

grant select, insert, update on cif_views to authenticated;
