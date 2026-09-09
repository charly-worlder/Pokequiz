-- PROJ-4, T1 (AC-17): Die Kontolöschung muss **jeden** Zählerschlüssel mitnehmen,
-- der die E-Mail-Adresse trägt — nicht nur die drei, die 2026-09-05 zufällig
-- existierten.
--
-- **Befund.** `forget_auth_throttle_for_user()` aus `0005` zählt drei Schlüssel
-- buchstäblich auf: `login:`, `register:`, `password-reset:`. PROJ-4 führt einen
-- vierten Scope ein (`account-delete`, spec.md AC-15). Er stünde nicht in der
-- Liste — und die Folge wäre grotesk: Wer sein Konto löscht und dabei einmal das
-- Passwort falsch eingibt, hinterlässt eine Zeile mit seiner E-Mail-Adresse im
-- Klartext, **erzeugt vom Löschvorgang selbst**. Das bricht AC-17 im Wortlaut.
--
-- Das ist genau der Fehler, den `0005` behoben hat, eine Ebene höher: Dort
-- überlebte die Adresse die Löschung, weil die Zeilen an keinem Fremdschlüssel
-- hängen. Hier überlebte sie, weil eine Aufzählung nicht mitgewachsen ist.
--
-- **Deshalb keine vierte Zeile in der Liste, sondern das Ende der Liste.** Der
-- Trigger vergleicht künftig die **Endung** des Schlüssels. Jeder künftige Scope
-- ist damit automatisch erfasst, ohne dass jemand hier nachträgt — eine
-- Aufzählung ist eine Falle, die genau einmal zuschnappt und danach unbemerkt
-- bleibt.

/*
  Vergisst die Zähler eines Kontos, sobald das Konto gelöscht wird.

  **Warum `right(...)` und ausdrücklich kein `like '%' || ...`.** Der naheliegende
  Mustervergleich wäre hier ein Sicherheitsfehler: In `like` sind `_` und `%`
  Platzhalter, und beide sind in E-Mail-Adressen **erlaubt**. Der Schlüssel zu
  `a_b@example.de` würde als Muster auch auf `axb@example.de` passen. Wer sich mit
  einer Adresse voller Unterstriche registriert und sein Konto sofort wieder
  löscht, könnte damit die Fehlversuchszähler **fremder** Konten leeren — also
  genau die Bremse lösen, die einen anderen Nutzer vor dem Durchprobieren
  schützt. `right()` vergleicht Zeichen für Zeichen und kennt keine Platzhalter.

  **Die IP-Schlüssel bleiben unverändert stehen.** Sie gehören einer Verbindung,
  nicht einem Konto. Sie mitzulöschen hieße, dass ein Angreifer seine eigene
  Bremse löst, indem er ein Wegwerf-Konto anlegt und wieder löscht — das war
  BUG-39, und die Warnung davor steht seit `0005` im Kommentar. Sie gilt hier
  weiter: Die Endung `:account:` ist genau die Grenze zwischen beiden Sorten.

  Unverändert gegenüber `0005`: `security definer` mit festem `search_path`, und
  der Trigger feuert **nach** dem Löschen in derselben Transaktion. Wirft er,
  rollt die gesamte Löschung zurück (spec.md EC-3) — das ist gewollt: Lieber gar
  nicht gelöscht als halb.
*/
create or replace function public.forget_auth_throttle_for_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_suffix text;
begin
  if old.email is not null then
    -- `throttle.ts` → `accountKey` bildet den Schlüssel kleingeschrieben.
    v_suffix := ':account:' || lower(old.email);

    delete from public.auth_throttle
     where right(key, length(v_suffix)) = v_suffix;
  end if;

  return old;
end;
$$;

comment on function public.forget_auth_throttle_for_user() is
  'Loescht bei Kontoloeschung alle Zaehlerzeilen, deren Schluessel auf ":account:<adresse>" endet '
  '- jeder Scope, auch kuenftige (PROJ-4, AC-17). IP-Schluessel bleiben stehen (BUG-39).';
