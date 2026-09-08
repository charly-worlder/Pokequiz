-- N1 — die Profil-Tabelle gibt jeder Sitzung nur noch die eigene Zeile heraus
-- (gefunden im QA-Lauf zu PROJ-3 am 2026-09-08, Medium)
--
-- **Der Befund.** `profiles_select_authenticated ... using (true)` (0001) gab
-- jedem angemeldeten Nutzer **alle Spalten aller Zeilen** frei. Gemessen mit
-- einem gewöhnlichen Nutzer-JWT und dem öffentlichen Schlüssel:
--
--   GET /rest/v1/profiles?select=*
--   -> 200, 1024 Zeilen: {"id":"c7bcd701-…","trainer_name":"Alpha","created_at":…}
--
-- Zum selben Zeitpunkt standen **234** Spieler in der Wertung. Die übrigen rund
-- 790 Konten waren über die Rangliste nicht sichtbar und über diese Abfrage
-- schon — mitsamt ihrer Auth-Kennung und ihrem Anlegedatum.
--
-- **Warum das zählt, obwohl kein AC im Wortlaut bricht.** AC-19 und AC-20 sind
-- eingehalten: Fremde Rundenhistorien bleiben unzugänglich, und die
-- Ranglisten-Zeilen enthalten nachweislich keine Kennung. Aber die Begründung,
-- mit der PROJ-3 → `design.md` seine Konstruktion rechtfertigt, war damit hinfällig:
-- „Die eigene Zeile wird als Wahrheitswert markiert … genau deshalb ist AC-20
-- einhaltbar: Für einen Vergleich müsste die Konto-Kennung mitgeliefert werden."
-- Sie musste nicht mitgeliefert werden — sie war eine Anfrage später ohnehin da.
-- Das ist ein Datensparsamkeits-Befund (Art. 5(1)(c) DSGVO) an genau der
-- Datenschicht, die PROJ-3 erstmals für Fremddaten öffnet.
--
-- **Warum die Verengung gefahrlos ist — vor dem Schnitt geprüft.** Genau **eine**
-- Stelle im Anwendungscode liest `profiles` über eine Nutzersitzung:
-- `src/components/shell/site-header.tsx:29` holt `trainer_name` für die eigene
-- Zeile (`.eq('id', user.id)`). Alles andere läuft an RLS vorbei, weil es
-- `security definer` ist und damit ohnehin nicht von diesen Rechten abhängt:
--   - `leaderboard_page` (0015) verbindet `profiles`, um Trainernamen für die
--     Rangliste zu liefern — genau die kontrollierte Öffnung, die es geben soll.
--   - `is_trainer_name_taken` (0006) beantwortet die Verfügbarkeitsfrage beim
--     Registrieren, bevor es überhaupt eine Sitzung gibt.
--   - `handle_new_user` (0001) legt die Zeile an.
--
-- **Der Kommentar in 0001 nannte den Grund, der nicht mehr gilt:** „Every
-- logged-in user can read every trainer name — this is the data behind the world
-- leaderboard (PROJ-3)." Die Rangliste liest seit 0015 **nicht** über die
-- Nutzersitzung, sondern über die Funktion. Die Freigabe hat ihren Zweck
-- überlebt — dieselbe Klasse wie BUG-22 und BUG-110, wo eine Erlaubnis stehen
-- blieb, nachdem der Weg, für den sie gedacht war, verschwunden war.

-- ---------------------------------------------------------------------------
-- Erste Schicht: die Zeilen
-- ---------------------------------------------------------------------------
-- `auth.uid()` in einer Unterabfrage, damit es einmal je Anweisung ausgewertet
-- wird statt einmal je Zeile (supabase-postgres-best-practices →
-- security-rls-performance). Dasselbe Muster wie in `runs_select_own` (0002).
drop policy "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Zweite Schicht: die Spalten
-- ---------------------------------------------------------------------------
-- `.claude/rules/security.md` verlangt zwei unabhängige Prüfungen. Die Policy
-- oben begrenzt die Zeilen; das Spaltenrecht begrenzt, was selbst in der eigenen
-- Zeile herausgegeben wird.
--
-- `id` muss dabei lesbar bleiben, obwohl die Kopfzeile es nicht anzeigt: Es steht
-- in der `where`-Bedingung, und ein Spaltenrecht gilt in Postgres für **jede**
-- Erwähnung einer Spalte, nicht nur für die Ausgabeliste. Ohne `id` schlüge die
-- Abfrage der Kopfzeile fehl.
--
-- `created_at` bleibt draußen: Es wird nirgends im Anwendungscode gelesen
-- (geprüft), und was niemand braucht, gehört nicht herausgegeben.
revoke select on table public.profiles from authenticated;
grant select (id, trainer_name) on table public.profiles to authenticated;

comment on table public.profiles is
  'Trainerprofile. Eine Sitzung liest ausschliesslich die eigene Zeile und daraus nur id und trainer_name (0016). Fremde Trainernamen gibt es nur ueber leaderboard_page (0015) — die kontrollierte Oeffnung fuer die Rangliste. Geschrieben wird ausschliesslich vom Trigger handle_new_user (0001).';
