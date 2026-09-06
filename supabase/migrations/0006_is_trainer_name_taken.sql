-- Exakte Auskunft, ob ein Trainername vergeben ist (PROJ-1, BUG-74).
--
-- Warum es diese Funktion gibt und nicht einfach eine Abfrage aus der App:
--
-- 1. **Richtigkeit.** Die App fragte vorher mit PostgREST `ilike`. In einem
--    LIKE-Muster ist `_` ein Platzhalter für genau ein Zeichen — und `_` ist in
--    Trainernamen ausdrücklich erlaubt (`profiles_trainer_name_format`, 0001).
--    `'AshX1' ilike 'Ash_1'` ist wahr, obwohl `Ash_1` frei ist. Die App traf damit
--    eine andere Entscheidung als der Trigger, der `lower() = lower()` vergleicht.
--    Hier steht jetzt derselbe Vergleich wie im Trigger, Zeichen für Zeichen.
--
-- 2. **Kosten.** `ilike` kann den Funktionsindex `profiles_trainer_name_lower_key`
--    nicht benutzen und läuft als Seq Scan — im QA-Lauf gemessen: 0,72 ms gegen
--    0,03 ms, Faktor ~23 bei 1340 Zeilen, linear wachsend mit der Nutzerzahl.
--    Weil die Abfrage auf dem Fehlerpfad der Registrierung sitzt, war sie damit
--    ein Verstärker: 25 Anfragen erzeugten 22 Full Scans und legten dabei kein
--    einziges Konto an, hinterließen also keine Spur. `lower(trainer_name) = ...`
--    trifft den Index exakt.
--
-- `security definer` plus fixiertes `search_path`, wie bei den Drosselungs-
-- Funktionen aus 0003: `profiles` ist für `anon` nicht lesbar (RLS ohne
-- Schreib-Policies), und die Registrierung hat zum Zeitpunkt der Nachfrage noch
-- keine Sitzung. Die Funktion gibt ausschließlich einen Boolean heraus — genau
-- die Auskunft, die AC-2 dem Nutzer ohnehin gibt.
create function public.is_trainer_name_taken(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where lower(trainer_name) = lower(p_name)
  );
$$;

comment on function public.is_trainer_name_taken(text) is
  'Ist dieser Trainername vergeben? Derselbe Vergleich wie im Signup-Trigger, damit App und Datenbank nicht auseinanderlaufen (BUG-74).';

-- Nur für den Server. Wäre die Funktion für `anon` ausführbar, wäre sie ein
-- bequemes Werkzeug, um die Trainernamenliste abzuklopfen, ohne je ein Konto
-- anzulegen — dieselbe Überlegung wie bei den Zählerfunktionen in 0003.
revoke all on function public.is_trainer_name_taken(text) from public, anon, authenticated;
grant execute on function public.is_trainer_name_taken(text) to service_role;
