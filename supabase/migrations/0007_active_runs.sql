-- Der laufende Rundenzustand (PROJ-2, AC-36, AC-38, AC-40; design.md → Data Model)
--
-- Seit dem 2026-09-06 führt der Server die Runde: Er vergibt die Fragen, prüft
-- die Antworten, zählt die Serie und misst die Zeit. Dafür braucht er einen Ort,
-- an dem die Wahrheit über eine laufende Runde liegt.
--
-- Warum eine Tabelle und kein signiertes Token beim Browser: Ein Token lässt sich
-- zurückspielen — falsch antworten, aus dem Urteil die Lösung lernen, den alten
-- Stand erneut senden. Jede Abwehr dagegen braucht ohnehin eine serverseitige
-- Marke je Runde.

create table public.active_runs (
  -- Die Profil-ID ist der Primärschlüssel. Dadurch ist „höchstens eine laufende
  -- Runde je Spieler" (AC-36) eine Eigenschaft der Tabelle und keine Prüfung im
  -- Anwendungscode, die man vergessen kann — und sie deckt EC-9 (Doppelklick auf
  -- „Runde starten") und EC-15 (zweiter Tab) gleich mit ab.
  -- Die Kaskade ist der Löschweg aus AC-40: Verschwindet das Profil, verschwindet
  -- die laufende Runde mit, ohne dass Anwendungscode daran denken muss.
  profile_id uuid primary key references public.profiles (id) on delete cascade,

  -- Vom SERVER vergeben (bis zum 2026-09-06 kam es vom Browser). Wandert beim
  -- Rundenende in runs.round_id und ist dort eindeutig — das ist die Garantie
  -- hinter EC-4.
  round_id uuid not null unique default gen_random_uuid(),

  -- Jede Nummer, die in dieser Runde schon Lösung war (AC-5) oder verworfen wurde
  -- (EC-5, EC-6). Kein Antwortverlauf: Es steht nur drin, was nicht noch einmal
  -- gezogen werden darf, nicht was der Spieler geantwortet hat (AC-38).
  seen_ids smallint[] not null default '{}',

  streak smallint not null default 0,
  accumulated_ms integer not null default 0,

  -- Die aktuelle Frage. Alle vier Felder gemeinsam gesetzt oder gemeinsam leer;
  -- leer heißt „gerade ist keine Frage offen" (Fehlerzustand AC-16). Dann läuft
  -- auch kein Intervall, weshalb die Uhr im Fehlerzustand von selbst steht (AC-34).
  current_answer_id smallint,
  current_correct_index smallint,
  current_token uuid unique,
  current_issued_at timestamptz,

  -- Die bereits vorbereitete nächste Frage — ohne Zeitpunkt, denn sie zählt erst,
  -- wenn sie aktuell wird. Sie existiert, damit der Browser ihr Bild vorladen kann
  -- (AC-10), ohne etwas über sie zu erfahren (AC-32).
  prepared_answer_id smallint,
  prepared_correct_index smallint,
  prepared_token uuid unique,

  -- Grundlage der Frist aus AC-41. Wird bei jeder Änderung neu gesetzt.
  touched_at timestamptz not null default now(),

  constraint active_runs_streak_range check (streak >= 0 and streak <= 386),
  constraint active_runs_duration_non_negative check (accumulated_ms >= 0),
  constraint active_runs_seen_bounded check (
    array_length(seen_ids, 1) is null or array_length(seen_ids, 1) <= 386
  ),

  -- „Gemeinsam gesetzt oder gemeinsam leer" als Datenbankregel, nicht als
  -- Konvention: Eine halb gefüllte Frage wäre ein Zustand, den keine Funktion
  -- unten behandeln kann.
  constraint active_runs_current_complete check (
    num_nulls(current_answer_id, current_correct_index, current_token, current_issued_at) in (0, 4)
  ),
  constraint active_runs_prepared_complete check (
    num_nulls(prepared_answer_id, prepared_correct_index, prepared_token) in (0, 3)
  ),

  constraint active_runs_current_answer_range check (
    current_answer_id is null or current_answer_id between 1 and 386
  ),
  constraint active_runs_prepared_answer_range check (
    prepared_answer_id is null or prepared_answer_id between 1 and 386
  ),
  constraint active_runs_current_index_range check (
    current_correct_index is null or current_correct_index between 0 and 3
  ),
  constraint active_runs_prepared_index_range check (
    prepared_correct_index is null or prepared_correct_index between 0 and 3
  )
);

comment on table public.active_runs is
  'Zustand der laufenden Quiz-Runde. Kurzlebig: gelöscht am Rundenende (AC-39), nach 110 Minuten ohne Berührung (AC-41) und mit dem Profil (AC-40). Ausschließlich über die Funktionen aus 0009 erreichbar.';

-- Bewusst KEIN Index auf touched_at, obwohl der Aufräum-Lauf danach filtert: Die
-- Tabelle hat höchstens so viele Zeilen, wie gerade Spieler spielen, und jede
-- Antwort schreibt touched_at neu — ein Index würde bei jedem Zug gepflegt und
-- spart bei einem Sequential Scan über ein paar Dutzend Zeilen nichts ein.
-- Die Zugriffe der Spiellogik laufen ohnehin über den Primärschlüssel oder über
-- die eindeutigen Token-Spalten, die ihre Indizes mitbringen.

-- RLS an, **ohne jede Policy** — dasselbe Muster wie auth_throttle (0003), hier
-- aber aus einem schärferen Grund:
--
-- Die Zeile enthält die LÖSUNG der aktuellen Frage. Eine Policy „der Eigentümer
-- liest seine eigene Zeile" — der übliche Reflex — würde dem Spieler genau das
-- geben, was AC-32 ihm vorenthält: Mit dem öffentlichen Zugangsschlüssel und
-- seiner eigenen Sitzung könnte er die Antwort abfragen, bevor er klickt. AC-32
-- wäre auf der Datenebene gebrochen, während die Oberfläche sie brav einhält.
--
-- Ohne Policy kommt weder `anon` noch `authenticated` an eine einzige Zeile. Der
-- einzige Weg hinein sind die Funktionen aus 0009, ausführbar nur für service_role.
alter table public.active_runs enable row level security;

-- Zusätzlich die Tabellenrechte entziehen: RLS ohne Policy hält die Zeilen bereits
-- zurück, aber ohne Tabellenrecht scheitert der Zugriff schon eine Stufe früher —
-- und eine später versehentlich hinzugefügte Policy allein reicht dann nicht aus,
-- um die Lösung freizulegen.
revoke all on table public.active_runs from anon, authenticated;
