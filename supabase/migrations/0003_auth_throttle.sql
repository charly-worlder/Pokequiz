-- Drosselung der Zugangsdaten-Pfade (PROJ-2, BUG-29/30/31; .claude/rules/security.md)
--
-- Warum in der Datenbank und nicht im Speicher des Servers: Ein Zähler im
-- Prozessspeicher überlebt kein Deploy, gilt nicht über mehrere Instanzen und ist
-- damit genau dann wirkungslos, wenn es darauf ankommt.
--
-- Warum nicht am Pfad: Next.js bindet eine Server Action nicht an die Route, auf
-- der sie definiert wurde. `loginAction` läuft unter `/`, unter `/privacy` und —
-- weil der Proxy-Matcher Bild-Endungen ausnimmt — unter jedem `*.png`. Eine
-- Schranke davor ist deshalb umgehbar; die Drosselung sitzt in der Action selbst.

create table public.auth_throttle (
  -- Der Zählerschlüssel, z. B. `login:ip:1.2.3.4` oder `login:account:a@b.de`.
  -- Vom Server gebildet, nie vom Client übergeben.
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);

comment on table public.auth_throttle is
  'Fehlversuchszähler für die Zugangsdaten-Pfade. Ausschließlich über register_auth_attempt() erreichbar.';

-- Für das Aufräumen alter Fenster.
create index auth_throttle_window_idx on public.auth_throttle (window_started_at);

-- RLS an, **ohne jede Policy**: Damit kommt weder `anon` noch `authenticated` an
-- die Tabelle heran — weder lesend noch schreibend. Der einzige Weg hinein ist
-- die Funktion unten, und die ist nur für `service_role` ausführbar.
alter table public.auth_throttle enable row level security;

/*
  Zählt einen Versuch und meldet, ob er noch erlaubt ist.

  Ein einziges Statement, damit zwei gleichzeitige Anfragen sich nicht gegenseitig
  überholen: Das `on conflict do update` sperrt die Zeile, und `returning` liefert
  den Stand **nach** der Erhöhung. Ein Zählen in zwei Schritten (lesen, dann
  schreiben) hätte genau dazwischen die Lücke, die ein Angreifer mit parallelen
  Anfragen ausnutzt.

  `security definer` plus fixiertes `search_path`: Die Funktion arbeitet mit den
  Rechten ihres Eigentümers und darf deshalb nicht über einen untergeschobenen
  Suchpfad auf fremde Objekte gelenkt werden.
*/
create or replace function public.register_auth_attempt(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
begin
  insert into public.auth_throttle as t (key, window_started_at, attempts)
  values (p_key, now(), 1)
  on conflict (key) do update
    set
      -- Fenster abgelaufen? Dann von vorn zählen, sonst weiterzählen.
      attempts = case
        when t.window_started_at < now() - make_interval(secs => p_window_seconds)
          then 1
        else t.attempts + 1
      end,
      window_started_at = case
        when t.window_started_at < now() - make_interval(secs => p_window_seconds)
          then now()
        else t.window_started_at
      end
  returning t.attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

/*
  Setzt den Zähler zurück — nach einer *erfolgreichen* Anmeldung.

  Ohne das würde ein Nutzer, der sich viermal vertippt und beim fünften Mal
  richtig liegt, den Rest des Fensters mit einem fast vollen Zähler herumlaufen.
  Fehlversuche sind das, was gedrosselt gehört, nicht der geglückte Login.
*/
create or replace function public.clear_auth_attempts(p_keys text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.auth_throttle where key = any(p_keys);
end;
$$;

-- Beide Funktionen sind **nicht** für den Browser da. Ein Client, der sie selbst
-- aufrufen könnte, hätte eine Aussperr-Waffe: fünf Aufrufe mit fremder Adresse,
-- und der Betroffene kommt nicht mehr an sein Konto. Nur der Server darf zählen.
revoke all on function public.register_auth_attempt(text, integer, integer) from public, anon, authenticated;
revoke all on function public.clear_auth_attempts(text[]) from public, anon, authenticated;
grant execute on function public.register_auth_attempt(text, integer, integer) to service_role;
grant execute on function public.clear_auth_attempts(text[]) to service_role;
