-- PROJ-4, BUG-4-1 (High, QA-Lauf 1 vom 2026-09-09): Die E-Mail-Adresse überlebte
-- die Kontolöschung in `auth.audit_log_entries` — darunter in einer Zeile, die
-- **der Löschvorgang selbst schreibt**:
--
--   {"action":"user_deleted","traits":{"user_email":"…","user_id":"…"}}
--
-- Das bricht AC-17 („an **keiner** Stelle der Datenbank noch ein Personenbezug")
-- und AC-22 („**kein** Protokolleintrag, der E-Mail-Adresse oder Trainernamen
-- enthält") im Wortlaut — bei einem Feature, dessen Zweck das Löschen ist. Zwei
-- unabhängige QA-Bahnen haben es gefunden.
--
-- **Es ist dieselbe Fehlerklasse wie `0017`, eine Ebene höher.** Dort war eine
-- Aufzählung von Schlüsselnamen unvollständig; hier war eine Aufzählung von
-- **Orten** unvollständig: Der Entwurf hatte für AC-17 ausschließlich
-- `public.auth_throttle` untersucht und das `auth`-Schema nicht angesehen.

/*
  Vergisst die Protokollzeilen eines Kontos, sobald das Konto gelöscht wird.

  ── Warum ein `after delete`-Trigger die Löschzeile überhaupt erreicht ──

  Nicht selbstverständlich, deshalb vor dem Bau gemessen: Eine Sonde auf
  `after delete on auth.users` sah zum Triggerzeitpunkt bereits **alle drei**
  Zeilen des Kontos, einschließlich `user_deleted`. GoTrue schreibt den
  Protokolleintrag also **vor** dem eigentlichen DELETE, in derselben
  Transaktion. Ein `after`-Trigger räumt damit auch die Spur des Löschvorgangs
  selbst ab.

  ── Warum zusätzlich über die Adresse verglichen wird ──

  Zwei Vergleiche gelten der **Kennung**: das laufende Konto als Handelnder
  (`actor_id`) und als Betroffener, wenn `service_role` gehandelt hat (dann steht
  die Kennung in `traits`, etwa bei `user_signedup` über die Admin-Schnittstelle
  und bei `user_deleted`). Gegen den Bestand gemessen trägt **jede** Zeile eine
  `actor_id`, und es gibt **keine** Zeile mit einer Adresse, der beide
  Kennungsfelder fehlen — für den laufenden Betrieb genügen diese zwei also.

  **Die beiden Vergleiche über die Adresse sind trotzdem drin, und ihre
  Begründung ist eine andere, als beim Bau zuerst dastand.** Der erste Anlauf
  behauptete hier, ein Prädikat nur über die Kennung lasse „64 Zeilen stehen",
  wenn jemand sich mit derselben Adresse neu registriert. Die Rot-Gegenprobe hat
  das widerlegt: Mit diesem Trigger räumt **jede** Löschung ihre eigenen Zeilen
  ab, ein früheres Konto derselben Adresse kann also gar keine Spur mehr
  hinterlassen. Die 64 gemessenen Zeilen waren **Altbestand** aus der Zeit vor
  dieser Migration.

  Was die Adressvergleiche wirklich leisten, ist deshalb enger und ehrlicher:

  1. **Sie räumen genau diesen Altbestand ab**, sobald die betroffene Adresse
     noch einmal registriert und gelöscht wird — Zeilen also, die kein
     Kennungsvergleich je erreichen würde, weil ihr Konto längst weg ist.
  2. **Sie halten die Zusage auch dann, wenn eine künftige GoTrue-Fassung eine
     Zeile ohne Kennung schreibt.** AC-22 spricht von der Adresse, nicht von der
     Kennung; danach zu suchen ist näher am Vertrag.

  Beides ist unten von einem eigenen Test gepinnt (`tests/PROJ-4-deletion-cascade.spec.ts`
  → „Altbestand ohne passende Kennung"), der ohne diese zwei Vergleiche rot wird.

  ── Warum ausschließlich exakte Vergleiche, nie `like` ──

  Dieselbe Falle wie in `0017`: `_` und `%` sind in E-Mail-Adressen erlaubt und
  in `like` Platzhalter. Ein Mustervergleich auf `%<adresse>%` würde außerdem
  `xa@b.de` treffen, wenn `a@b.de` gelöscht wird — also die Protokollzeilen eines
  **fremden** Kontos. Alle vier Vergleiche unten sind Gleichheit.

  Über die Adresse zu löschen ist unbedenklich: Adressen sind in `auth.users`
  eindeutig, ein anderes **lebendes** Konto kann dieselbe nicht führen.

  ── Was das kostet, ausgeschrieben ──

  1. **Die Protokollhistorie des Kontos ist danach weg**, auch die Zeile „dieses
     Konto wurde gelöscht". Das ist der Preis dafür, dass AC-22 im Wortlaut
     stimmt: Ein Eintrag, der die Löschung dokumentiert, dokumentiert sie mit der
     Adresse. Wer beides will, braucht eine anonymisierte Fassung — das wäre eine
     Vertragsänderung, kein Bugfix.
  2. **Kein Index auf den Prädikatsfeldern**, also ein Durchlauf der Tabelle je
     Kontolöschung. Bei einer Löschung pro Konto und Lebenszeit ist das
     folgenlos. **Die Tabelle wächst allerdings unbegrenzt** (622 Zeilen nach
     wenigen Entwicklungstagen) und hat keinen Aufräum-Lauf — ein eigener Punkt,
     der zu `pg_cron` gehört, nicht hierher.
  3. **Kein Ausnahmeblock, bewusst.** Scheitert das Aufräumen, scheitert die
     ganze Löschung und der Nutzer sieht die Meldung aus EC-3 („technisch, nicht
     wegen deines Passworts. Dein Konto ist unverändert."). Das ist die richtige
     Richtung: Eine Löschung, die den Personenbezug zurücklässt, wäre eine
     gebrochene Zusage, die niemand bemerkt. **Vor dem Deploy zu prüfen**, dass
     `postgres` auch im gehosteten Projekt `DELETE` auf dieser Tabelle hat —
     lokal ist es belegt (`information_schema.role_table_grants`).

  `security definer` mit festem `search_path`: Die Funktion läuft mit den Rechten
  ihres Eigentümers (`postgres`), denn der Löschvorgang selbst läuft als
  `supabase_auth_admin`. Auf die Tabelle zeigt kein Fremdschlüssel (geprüft), das
  Löschen bricht also nichts.
*/
create or replace function public.forget_audit_log_for_user()
returns trigger
language plpgsql
security definer
set search_path = auth, pg_temp
as $$
begin
  delete from auth.audit_log_entries
   where
     -- Das laufende Konto: als Handelnder …
     payload ->> 'actor_id' = old.id::text
     -- … und als Betroffener, wenn `service_role` gehandelt hat
     -- (`user_signedup` über die Admin-Schnittstelle, `user_deleted`).
     or payload -> 'traits' ->> 'user_id' = old.id::text
     -- Frühere Konten derselben Adresse — siehe Kommentar oben.
     or (old.email is not null and lower(payload ->> 'actor_username') = lower(old.email))
     or (old.email is not null and lower(payload -> 'traits' ->> 'user_email') = lower(old.email));

  return old;
end;
$$;

comment on function public.forget_audit_log_for_user() is
  'Loescht bei Kontoloeschung alle Protokollzeilen des Kontos aus auth.audit_log_entries '
  '- ueber die Kennung UND ueber die Adresse, damit auch die Historie frueherer Konten '
  'derselben Adresse verschwindet (PROJ-4, AC-17 und AC-22; BUG-4-1).';

-- Eigener Trigger neben `on_auth_user_deleted` aus `0005`, nicht in dessen
-- Funktion hineingebaut: Der eine raeumt eine eigene Tabelle auf, der andere
-- greift in ein fremdes Schema. Getrennt zu halten macht im Fehlerfall sofort
-- sichtbar, welcher der beiden es war.
drop trigger if exists on_auth_user_deleted_audit on auth.users;
create trigger on_auth_user_deleted_audit
  after delete on auth.users
  for each row execute function public.forget_audit_log_for_user();
