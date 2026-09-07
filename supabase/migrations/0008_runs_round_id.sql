-- `runs` an die serverseitig geführte Runde angleichen (PROJ-2, AC-12, EC-4)
--
-- Zwei Änderungen, beide Folge von `/refine PROJ-2` am 2026-09-06.

-- 1. Der Name behauptete eine Herkunft, die nicht mehr stimmt: Das Runden-
--    Kennzeichen erzeugte bis zum 2026-09-06 der Browser, jetzt der Server
--    (active_runs.round_id, Migration 0007). Eindeutig bleibt es — das ist
--    weiterhin die Garantie hinter EC-4.
alter table public.runs rename column client_round_id to round_id;
alter table public.runs rename constraint runs_client_round_id_key to runs_round_id_key;

-- 2. Der Constraint setzte die Regel „mindestens 0,5 Sekunden pro beantworteter
--    Frage" durch. Sie war eine Plausibilitätsprüfung **gemeldeter** Werte und
--    ist mit AC-12 entfallen, weil AC-34 sie ablöst: Der Server misst die Zeit
--    jetzt selbst, von der Ausgabe jeder Frage bis zum Eingang der Antwort.
--
--    Bliebe der Constraint stehen, könnte er nichts mehr aufdecken — er würde nur
--    noch eine echt gespielte, schnelle Runde abweisen und einen Spieler für sein
--    Können bestrafen.
alter table public.runs drop constraint runs_duration_plausible;

-- Die beiden anderen Grenzen bleiben ausdrücklich bestehen: Sie sind die zweite,
-- unabhängige Schranke aus .claude/rules/security.md und kosten nichts.
--   runs_streak_range        (Serie 0–386)
--   runs_duration_non_negative (Dauer >= 0)

comment on column public.runs.round_id is
  'Vom Server vergebenes Runden-Kennzeichen (active_runs.round_id). Eindeutig, damit ein zweimal ausgelöstes Rundenende keine zweite Zeile erzeugt (EC-4).';
