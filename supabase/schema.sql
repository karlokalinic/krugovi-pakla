create table if not exists public.inferno_projects (
  id text primary key,
  circles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.inferno_projects enable row level security;

revoke all on table public.inferno_projects from anon, authenticated;

-- Ni čitanje ni pisanje nisu izloženi klijentskim ulogama jer jedan JSON red može
-- sadržavati i neobjavljene autorske krugove. Next.js poslužitelj filtrira javni prikaz.
-- API koristi SUPABASE_SERVICE_ROLE_KEY isključivo na poslužitelju i zaobilazi RLS.
