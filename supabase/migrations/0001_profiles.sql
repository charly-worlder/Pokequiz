-- profiles: one row per auth account, created automatically at signup (PROJ-1).
-- The trigger below runs in the same transaction as the auth.users insert, so a
-- duplicate or invalid trainer_name aborts the whole registration (spec.md EC-1).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  trainer_name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_trainer_name_format check (trainer_name ~ '^[A-Za-z0-9_]{3,20}$')
);

-- Uniqueness is case-insensitive: "Ash" and "ash" collide (spec.md AC-2).
create unique index profiles_trainer_name_lower_key on public.profiles (lower(trainer_name));

alter table public.profiles enable row level security;

-- Every logged-in user can read every trainer name — this is the data behind the
-- world leaderboard (PROJ-3). Logged-out visitors see none (no policy for anon).
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- No insert/update/delete policies for anon or authenticated: the trainer name is
-- immutable after signup (spec.md, Product Decisions) and the only writer is the
-- trigger below, which runs as SECURITY DEFINER and therefore bypasses RLS.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_trainer_name text := new.raw_user_meta_data ->> 'trainer_name';
begin
  if exists (
    select 1 from public.profiles where lower(trainer_name) = lower(new_trainer_name)
  ) then
    raise exception 'trainer_name_taken';
  end if;

  insert into public.profiles (id, trainer_name) values (new.id, new_trainer_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
