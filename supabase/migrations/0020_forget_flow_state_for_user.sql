-- PROJ-4, AC-17 (QA-Lauf 2 vom 2026-09-09): Nach der Kontolöschung blieb in
-- `auth.flow_state` eine Zeile mit der **Kennung** des gelöschten Kontos stehen —
-- bei jedem Spieler, der je einen Passwort-Reset angefordert hat. Gemessen: von
-- 31 gelöschten Testkonten hinterließen genau die 2 eine Spur, die einen
-- Recovery-Vorgang hatten.
--
-- **Die Ursache ist die inzwischen dritte Ausprägung derselben Sache:**
-- `auth.flow_state` hängt an **keinem Fremdschlüssel** auf `auth.users` und wird
-- von keinem Trigger angefasst — exakt die Bauart, die `design.md` für
-- `public.auth_throttle` schon einmal beschrieben hatte. Die zweite Tabelle
-- derselben Art wurde nie gesucht.
--
-- **Warum das gebaut und nicht als Grenze dokumentiert wird** (Entscheidung vom
-- 2026-09-10): Das Betriebsprotokoll des Auth-Dienstes ist außerhalb der
-- Reichweite dieser Anwendung und deshalb als EC-14 benannt. Diese Tabelle ist
-- es nicht — sie liegt in derselben Datenbank und kostet denselben Dreizeiler
-- wie `0019`. Etwas im Vertrag aufzugeben, das drei Zeilen kostet, wäre die
-- falsche Richtung. AC-17 bleibt damit ein Allsatz über die ganze Datenbank.

/*
  Vergisst offene Vorgänge eines Kontos, sobald das Konto gelöscht wird.

  **Was hier steht und was nicht.** Die Zeile enthält weder Adresse noch
  Trainername — nur die Konto-Kennung, den Zeitpunkt der Anforderung und einen
  PKCE-Code. Der Code ist nach der Löschung wertlos: Er lässt sich gegen ein
  Konto einlösen, das es nicht mehr gibt. Was bleibt, ist die Verknüpfung
  „dieses Konto hat am … einen Reset angefordert" — ein Personenbezug im Sinne
  von Art. 17, auch ohne Klartext-Adresse.

  **Warum der Vergleich hier über die Kennung geht und nicht über die Adresse**
  (anders als in `0019`): Die Tabelle führt gar keine Adresse. `user_id` ist die
  einzige Verbindung zum Konto, und sie ist eine echte Fremdschlüssel-Beziehung
  in allem außer der Deklaration.

  **Kein Ausnahmeblock**, aus demselben Grund wie in `0019`: Scheitert das
  Aufräumen, scheitert die ganze Löschung, und der Nutzer sieht die Meldung aus
  EC-3. Lieber gar nicht gelöscht als mit einem Rest.

  `security definer` mit festem `search_path`, weil der Löschvorgang selbst als
  `supabase_auth_admin` läuft und die Tabelle `supabase_auth_admin` gehört.
*/
create or replace function public.forget_flow_state_for_user()
returns trigger
language plpgsql
security definer
set search_path = auth, pg_temp
as $$
begin
  delete from auth.flow_state where user_id = old.id;
  return old;
end;
$$;

comment on function public.forget_flow_state_for_user() is
  'Loescht bei Kontoloeschung die offenen PKCE-Vorgaenge des Kontos aus auth.flow_state '
  '(PROJ-4, AC-17). Die Tabelle haengt an keinem Fremdschluessel, die Kaskade erreicht sie nicht.';

-- Nicht fuer den Browser. `0019` hatte dieses `revoke` vergessen — im QA-Lauf 2
-- von zwei Bahnen unabhaengig bemerkt (BUG-4-22). Hier von Anfang an dabei, und
-- fuer `0019` unten nachgeholt.
revoke all on function public.forget_flow_state_for_user() from public, anon, authenticated;
revoke all on function public.forget_audit_log_for_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted_flow_state on auth.users;
create trigger on_auth_user_deleted_flow_state
  after delete on auth.users
  for each row execute function public.forget_flow_state_for_user();
