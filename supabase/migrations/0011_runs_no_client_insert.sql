-- Die Einreiche-Schnittstelle für Rundenergebnisse schließen (PROJ-2, BUG-110)
--
-- **Der Befund.** AC-12 sagt seit dem Refine: „es existiert keine Schnittstelle,
-- über die ein Aufrufer ein fertiges Ergebnis einreichen könnte". Sie existierte
-- trotzdem — nur nicht dort, wo der Umbau hingesehen hat. Die Server Action
-- `saveRun` ist ersatzlos entfallen, aber die Insert-Policy aus 0002 blieb
-- stehen, und mit ihr der Weg über die Datenschnittstelle:
--
--   POST /rest/v1/runs   {"profile_id":"<eigene uid>","streak":386,"duration_ms":0,…}
--   -> HTTP 201 Created
--
-- Gemessen im QA-Lauf vom 2026-09-07: Serie 386 in 0 Millisekunden, mit dem
-- öffentlichen Zugangsschlüssel und einer gewöhnlichen Sitzung, 50 gefälschte
-- Runden in einer einzigen Anfrage. Genau der Angriff, gegen den die Runde
-- serverseitig autoritativ gemacht wurde.
--
-- **Warum das gefahrlos zu schließen ist.** Für den legitimen Ablauf ist die
-- Policy tot: Kein Anwendungscode schreibt `runs` über die Sitzung des Nutzers
-- (`src/lib/quiz/run-actions.ts` liest nur — Zeilen 64 und 103). Geschrieben wird
-- ausschließlich in `submit_answer` und `finish_round` (0009), und die laufen als
-- `security definer`, also mit den Rechten des Eigentümers — RLS gilt für sie
-- ohnehin nicht. Die Policy war ein Überbleibsel des abgelösten Entwurfs, in dem
-- der Browser das Ergebnis einreichte.
--
-- **Warum eine neue Datei und keine Änderung an 0002.** Produktion merkt sich,
-- welche Migration gelaufen ist. Eine bearbeitete Datei wird dort anhand ihres
-- Zeitstempels übersprungen, während `supabase db reset` lokal die neue Fassung
-- abspielt — beide laufen still auseinander (`docs/stacks/backend-supabase.md`).

drop policy "runs_insert_own" on public.runs;

-- Zweite, unabhängige Schranke: ohne Tabellenrecht scheitert ein Schreibversuch
-- schon eine Stufe vor der Policy-Prüfung. Eine später versehentlich wieder
-- hinzugefügte Insert-Policy allein genügt dann nicht, um die Lücke zu öffnen.
-- Dasselbe Muster wie bei `active_runs` (0007).
revoke insert, update, delete on table public.runs from anon, authenticated;

-- `select` bleibt ausdrücklich: Die persönliche Bestleistung (AC-8) und das
-- Nachlesen eines verlorengegangenen Ergebnisses (EC-3) laufen über die Sitzung
-- des Nutzers, und die Lesepolicy `runs_select_own` begrenzt sie auf eigene
-- Zeilen (AC-14). Nur der Schreibweg war zu viel.

comment on table public.runs is
  'Abgeschlossene Quiz-Runden. Lesen nur eigene Zeilen; geschrieben wird ausschließlich von submit_answer() und finish_round() (0009) — es gibt keinen Weg, ein fertiges Ergebnis einzureichen (AC-12, BUG-110).';
