-- BUG-56: Die Zählertabelle wächst unbegrenzt und speichert E-Mail-Adressen unbefristet.
--
-- Befund aus dem QA-Nachlauf vom 2026-09-05: `public.auth_throttle` hatte 1433
-- Zeilen, die älteste vom selben Tag früh morgens — **nichts löschte je etwas.**
-- `clear_auth_attempts` wird ausschließlich für den Konto-Schlüssel nach einem
-- erfolgreichen Login gerufen; einen Aufräum-Job gab es weder in der Datenbank
-- noch in der Anwendung.
--
-- Der Index `auth_throttle_window_idx` trägt seit `0003` den Kommentar „Für das
-- Aufräumen alter Fenster". Das Aufräumen, für das er da ist, gab es nicht —
-- dasselbe Muster wie BUG-36: eine Zusage im Kommentar, kein Code dahinter.
--
-- **Die datenschutzrechtliche Hälfte wiegt schwerer als die Größe.** Der
-- Konto-Schlüssel lautet `login:account:<e-mail-adresse>`. Die Tabelle war damit
-- ein unbefristeter Speicher der Adressen aller, die sich je vertippt haben — in
-- einem Projekt unter der DSGVO, dessen Datenmodell ausdrücklich festhält, die
-- E-Mail bleibe beim Auth-System. Und die Kontolöschung aus PROJ-4 hätte diese
-- Zeilen nicht mitgenommen: Sie hängen an keinem Fremdschlüssel.
--
-- Zwei Mechanismen, weil ein einzelner die Lücke nicht schließt:
--   1. laufendes Aufräumen abgelaufener Fenster (unten, `prune_auth_throttle`)
--   2. sofortiges Vergessen bei Kontolöschung (Trigger am Ende dieser Datei)

/*
  Räumt abgelaufene Zählerfenster weg — begrenzt, damit der Anmelde-Pfad nicht
  an der Aufräumarbeit hängt.

  **Die Grenze von einer Stunde** liegt bewusst über dem längsten Fenster
  (`credentialsPerAccount`: 15 Minuten). Eine Zeile, deren Fenster länger als
  eine Stunde zurückliegt, kann keine Entscheidung mehr beeinflussen: Der
  nächste Versuch auf denselben Schlüssel beginnt ohnehin bei 1 zu zählen
  (`0003`). Sie ist also reiner Rest.

  **`for update skip locked`** ist kein Zierrat: Ohne es warten zwei
  gleichzeitige Anmeldungen aufeinander, weil beide dieselben alten Zeilen zu
  löschen versuchen. Mit ihm nimmt jede, was gerade frei ist, und keine blockiert
  die andere — die Drosselung darf durch ihr eigenes Aufräumen nicht langsamer
  werden.

  **`ctid`** statt `key`, weil die Unterabfrage damit ohne zweiten Index-Zugriff
  auf genau die gefundenen Zeilen zeigt.
*/
create or replace function public.prune_auth_throttle(p_max_rows integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.auth_throttle t
   where t.ctid in (
     select c.ctid
       from public.auth_throttle c
      where c.window_started_at < now() - interval '1 hour'
      order by c.window_started_at
      limit p_max_rows
      for update skip locked
   );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

/*
  Zählt einen Versuch und meldet, ob er noch erlaubt ist — unverändert gegenüber
  `0003`, bis auf das Aufräumen am Ende.

  **Warum das Aufräumen hier sitzt und nicht in einem Zeitplan:** Ein
  `pg_cron`-Job wäre der Lehrbuchweg, verlangt aber eine Erweiterung, die im
  gehosteten Projekt eigens eingeschaltet werden muss — also eine weitere
  Aufgabe, die jemand von Hand erledigt und vergessen kann. Genau daran ist
  BUG-36 gescheitert. Hier läuft das Aufräumen mit dem Pfad, der die Zeilen
  erzeugt: Wer zählt, räumt auch auf.

  **Der Preis, benannt:** Die Aufbewahrung hängt damit am Verkehr. Meldet sich
  wochenlang niemand an, bleiben alte Zeilen liegen — dann ruht allerdings auch
  die Anwendung. Für den Fall, dass jemand *jetzt* vergessen werden will, gibt es
  den Trigger unten, der nicht auf Verkehr wartet. `pg_cron` bleibt der
  dokumentierte Ausbauweg, falls die Tabelle je unter Dauerlast steht.

  **Ein Fehler beim Aufräumen darf keine Anmeldung verhindern.** Deshalb der
  eigene Ausnahmeblock: Die Zählung ist die Aufgabe dieser Funktion, das
  Aufräumen ihre Nebenbeschäftigung. Ohne den Block würde ein Sperrkonflikt beim
  Löschen einen Login scheitern lassen — und weil die Drosselung bewusst
  fail-closed ist, hieße das: niemand kommt mehr hinein.
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

  -- Nebenbeschäftigung, streng nach der Zählung und ohne Einfluss auf sie.
  begin
    perform public.prune_auth_throttle();
  exception when others then
    null;
  end;

  return v_attempts <= p_limit;
end;
$$;

/*
  Vergisst die Zähler eines Kontos, sobald das Konto gelöscht wird.

  Ohne diesen Trigger überlebte die E-Mail-Adresse ihre eigene Kontolöschung: Die
  Zeilen hängen an keinem Fremdschlüssel, die Kaskade aus `0001`/`0002` erreicht
  sie also nicht. Für PROJ-4 („Datenschutz & Kontolöschung") wäre das eine
  Löschung gewesen, die etwas zurücklässt.

  Gelöscht werden **alle** Scopes derselben Adresse (`login:`, `register:`,
  `password-reset:`); der Schlüssel wird kleingeschrieben gebildet
  (`throttle.ts` → `accountKey`), deshalb hier `lower(...)`.

  **Die IP-Schlüssel bleiben ausdrücklich stehen.** Sie gehören keinem Konto,
  sondern einer Verbindung — sie mitzulöschen hieße, dass ein Angreifer seine
  eigene Bremse löst, indem er ein Wegwerf-Konto anlegt und wieder löscht. Das
  ist BUG-39 in neuer Verkleidung, und sie fällt hier nicht noch einmal an.
*/
create or replace function public.forget_auth_throttle_for_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.email is not null then
    delete from public.auth_throttle
     where key in (
       'login:account:' || lower(old.email),
       'register:account:' || lower(old.email),
       'password-reset:account:' || lower(old.email)
     );
  end if;

  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.forget_auth_throttle_for_user();

-- Wie die Funktionen aus `0003` und `0004`: nicht für den Browser. Wer selbst
-- aufräumen dürfte, könnte den Zähler eines anderen leeren.
revoke all on function public.prune_auth_throttle(integer) from public, anon, authenticated;
grant execute on function public.prune_auth_throttle(integer) to service_role;

comment on table public.auth_throttle is
  'Fehlversuchszaehler fuer die Zugangsdaten-Pfade. Ausschliesslich ueber register_auth_attempt() erreichbar. '
  'Abgelaufene Fenster werden laufend von prune_auth_throttle() entfernt (Grenze: 1 Stunde); '
  'Konto-Schluessel verschwinden ausserdem sofort mit dem Konto (Trigger on_auth_user_deleted).';
