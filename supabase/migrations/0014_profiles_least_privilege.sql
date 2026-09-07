-- BUG-131 — die Tabellenrechte auf `profiles` auf das Nötige zurückschneiden
-- (PROJ-1; gefunden im QA-Lauf zu PROJ-2 am 2026-09-07)
--
-- **Der Befund.** `profiles` gewährte `anon` und `authenticated` das volle
-- Programm — `arwdDxtm`, also INSERT, SELECT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER —, während die einzige Policy nur SELECT abdeckt.
-- Schreibende Zugriffe hielt damit **eine einzige** Schicht auf: die Row Level
-- Security.
--
-- Gemessen hat sie gehalten, in allen vier Verben: INSERT → 403 `42501`
-- („new row violates row-level security policy"), UPDATE und DELETE auf eigene
-- wie fremde Zeilen → 0 betroffene Zeilen, mit Kontrollmessung über
-- `service_role`, die belegt, dass die Aufrufform stimmt. Es gab also keinen
-- erreichbaren Angriff — was fehlte, war die **zweite** Schicht, die
-- `.claude/rules/security.md` verlangt: „Two independent checks, because sooner
-- or later one of them gets bypassed."
--
-- **Warum das trotzdem zählt.** Drei Gründe, in aufsteigender Schwere:
--   1. `TRUNCATE` unterliegt keiner RLS. Dieselbe Kante wie bei BUG-122, hier
--      zusätzlich zu allen anderen Rechten.
--   2. Eine später versehentlich hinzugefügte Policy hätte genügt, um zu öffnen.
--      Bei `active_runs` (0007) und seit BUG-122 auch bei `runs` (0013) bliebe
--      sie wirkungslos, weil das Tabellenrecht fehlt.
--   3. Der Trainername ist der eindeutige **öffentliche** Anzeigename (AC-2).
--      Ein Schreibweg darauf wäre Identitätsübernahme in der Rangliste.
--
-- **Wer `select` wirklich braucht — vor dem Schnitt geprüft:**
--   - `authenticated`: ja. `src/components/shell/site-header.tsx:27-32` liest den
--     eigenen Trainernamen über die **Sitzung des Nutzers**, begrenzt durch
--     `profiles_select_authenticated`.
--   - `anon`: nein. Die Verfügbarkeitsprüfung beim Registrieren läuft über
--     `is_trainer_name_taken` (0006) und der Anlege-Trigger über
--     `handle_new_user` (0001) — beide `security definer`, beide unabhängig von
--     Tabellenrechten.
revoke all on table public.profiles from anon, authenticated;

grant select on table public.profiles to authenticated;

comment on table public.profiles is
  'Trainerprofile. Lesen nur angemeldet (profiles_select_authenticated); geschrieben wird ausschliesslich vom Trigger handle_new_user (0001) — es gibt keinen Schreibweg ueber eine Nutzersitzung (BUG-131).';
