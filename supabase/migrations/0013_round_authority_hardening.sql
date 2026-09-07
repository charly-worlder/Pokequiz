-- Drei Befunde des dritten QA-Laufs (PROJ-2, 2026-09-07):
-- BUG-122 (Tabellenrechte auf `runs`), BUG-123 (gleichzeitige Rundenstarts),
-- BUG-130 (Vorbereiten und Verwerfen kennen ihre Runde nicht).
--
-- Alle drei sind Nachzügler bereits gezogener Lehren, deshalb liegen sie in einer
-- Datei: Es ist dieselbe Frage, dreimal nicht zu Ende beantwortet.

-- ---------------------------------------------------------------------------
-- BUG-122 — die Rechte auf `runs` vollständig entziehen
-- ---------------------------------------------------------------------------
-- `0011` hat den Schreibweg geschlossen, aber nur `insert, update, delete`
-- entzogen. Übrig blieben SELECT (gewollt), REFERENCES, TRIGGER und vor allem
-- **TRUNCATE** — und TRUNCATE unterliegt **keiner** Row Level Security. Wäre es
-- erreichbar, löschte ein einziger Aufruf die Runden aller Spieler; die Rangliste
-- wäre weg. Über PostgREST gibt es dafür heute kein Verb, der Befund war also
-- nicht ausnutzbar — aber `0007` macht bei `active_runs` vor, wie es richtig
-- geht, und genau dieses Muster fehlte hier.
--
-- Die Lehre ist dieselbe wie bei BUG-110, nur eine Stufe später: Wer einen
-- Schreibweg entfernt, muss die Rechte mitentfernen — und zwar alle, nicht die
-- drei, an die man beim Schreiben gerade denkt.
revoke all on table public.runs from anon, authenticated;

-- SELECT kommt bewusst zurück: Die persönliche Bestleistung (AC-8) und das
-- Nachlesen eines verlorengegangenen Ergebnisses (EC-3) laufen über die Sitzung
-- des Nutzers. Die Lesepolicy `runs_select_own` begrenzt das auf eigene Zeilen
-- (AC-14). `anon` braucht auf `runs` nichts.
grant select on table public.runs to authenticated;

-- ---------------------------------------------------------------------------
-- BUG-123 — Rundenstart als ein Schritt statt als Löschen-dann-Einfügen
-- ---------------------------------------------------------------------------
-- Der bisherige Aufbau war `delete` gefolgt von `insert`. Zwei gleichzeitige
-- Starts sehen die Löschung der jeweils anderen nicht, beide fügen ein, und der
-- zweite läuft in `duplicate key value violates unique constraint
-- "active_runs_pkey"` — gemessen: 3 gleichzeitige Aufrufe, 1× HTTP 200,
-- 2× HTTP 500.
--
-- Für den Spieler war das keine Fehlermeldung, sondern eine Sackgasse: Der
-- Client macht aus dem Fehler `unavailable`, landet in der Fehlerkarte **ohne**
-- Runden-Kennung, „Erneut versuchen" führt zurück in dieselbe Karte und „Runde
-- beenden" in die Fremdrunden-Meldung. Nur Neuladen half.
--
-- Aus einem Tab verhinderte der `starting`-Riegel im Client das; aus zwei Tabs
-- oder zwei Geräten nicht — und genau die nennt EC-9 („Zusammen mit AC-36 gilt
-- das auch über mehrere Tabs und Geräte hinweg").
--
-- `on conflict (profile_id) do update` macht daraus **eine** Anweisung. Der
-- unterlegene Aufruf wartet auf die Zeilensperre und überschreibt danach; es
-- bleibt bei genau einer laufenden Runde (AC-36), und keiner der beiden bekommt
-- einen Fehler. Die verdrängte Runde wird weiterhin nicht gespeichert.
--
-- Warum durchgehend `excluded.*`: Das ist genau die Zeile, die ein Einfügen
-- angelegt hätte — **einschließlich der Spaltenvorgaben**, die in der
-- Spaltenliste gar nicht auftauchen (`round_id`, `streak`, `accumulated_ms`,
-- `touched_at`). Damit ist der Aktualisierungszweig per Konstruktion identisch
-- mit einem frischen Einfügen, statt ihn von Hand nachzubauen und dabei eine
-- Spalte zu vergessen — eine zurückgebliebene `streak` wäre der Fehler, den man
-- hier macht.
create or replace function public.start_round(
  p_profile uuid,
  p_answer_id smallint,
  p_correct_index smallint,
  p_prepared_answer_id smallint,
  p_prepared_correct_index smallint,
  p_also_seen smallint[] default '{}'
)
returns table (round_id uuid, current_token uuid, prepared_token uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.active_runs as a (
    profile_id,
    seen_ids,
    current_answer_id, current_correct_index, current_token, current_issued_at,
    prepared_answer_id, prepared_correct_index, prepared_token
  )
  values (
    p_profile,
    array[p_answer_id, p_prepared_answer_id] || p_also_seen,
    p_answer_id, p_correct_index, gen_random_uuid(), now(),
    p_prepared_answer_id, p_prepared_correct_index, gen_random_uuid()
  )
  on conflict (profile_id) do update
     set round_id = excluded.round_id,
         seen_ids = excluded.seen_ids,
         streak = excluded.streak,
         accumulated_ms = excluded.accumulated_ms,
         current_answer_id = excluded.current_answer_id,
         current_correct_index = excluded.current_correct_index,
         current_token = excluded.current_token,
         current_issued_at = excluded.current_issued_at,
         prepared_answer_id = excluded.prepared_answer_id,
         prepared_correct_index = excluded.prepared_correct_index,
         prepared_token = excluded.prepared_token,
         touched_at = excluded.touched_at
  returning a.round_id, a.current_token, a.prepared_token;
end;
$$;

comment on function public.start_round(uuid, smallint, smallint, smallint, smallint, smallint[]) is
  'Startet eine Runde und ersetzt eine laufende in einem Schritt (AC-36, EC-9). Gleichzeitige Aufrufe kollidieren nicht mehr (BUG-123).';

-- ---------------------------------------------------------------------------
-- BUG-130 — Vorbereiten und Verwerfen an die Runde binden
-- ---------------------------------------------------------------------------
-- Dieselbe Klasse wie BUG-120, die dessen Fix in `0012` überlebt hat: Dort wurde
-- die Runden-Kennung nur bei `finish_round` nachgezogen. `set_prepared_question`
-- und `discard_prepared_question` banden sich weiterhin allein an das Profil —
-- und die zugehörigen Server Actions nahmen **überhaupt kein Argument**, ein
-- veralteter Tab konnte seine Runde also gar nicht nennen.
--
-- Gemessen am 2026-09-07: Runde A durch Runde B verdrängt, dann der Aufruf aus
-- Tab A → die vorbereitete Frage der **laufenden** Runde B war ausgetauscht
-- (151 → 300), ihr Token gewechselt, ihr Ziehungsvorrat um drei Nummern kürzer.
-- Der spielende Tab hatte das Bild des alten Tokens vorgeladen; das war damit
-- wertlos und die nächste Frage kam mit sichtbarem Ladezustand statt vorgeladen
-- (AC-10).
--
-- Die Signatur ändert sich, deshalb entfernen und neu anlegen statt ersetzen —
-- `create or replace` kann keine Parameterliste ändern (dieselbe Stelle wie in
-- `0012`).
drop function public.set_prepared_question(uuid, smallint, smallint, smallint[]);

create function public.set_prepared_question(
  p_profile uuid,
  p_round_id uuid,
  p_answer_id smallint,
  p_correct_index smallint,
  -- Nummern, die beim Ziehen verworfen wurden, weil ihnen der deutsche Name
  -- fehlte (EC-5) — sie dürfen nicht erneut gezogen werden.
  p_also_seen smallint[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  update public.active_runs a
     set prepared_answer_id = p_answer_id,
         prepared_correct_index = p_correct_index,
         prepared_token = gen_random_uuid(),
         seen_ids = a.seen_ids || p_also_seen || p_answer_id,
         touched_at = now()
   where a.profile_id = p_profile
     -- Der Unterschied zu vorher: Die Runde muss die sein, die der Aufrufer meint.
     and a.round_id = p_round_id
  returning a.prepared_token into v_token;

  return v_token;
end;
$$;

drop function public.discard_prepared_question(uuid);

-- Rührt die AKTUELLE Frage nicht an. Das ist EC-12: Eine bereits angezeigte Frage
-- ist nicht verwerfbar, sonst wäre „Bild kaputt" ein Überspringen-Knopf für jedes
-- Pokémon, das der Spieler nicht erkennt. Die Nummer bleibt in `seen_ids`.
create function public.discard_prepared_question(p_profile uuid, p_round_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.active_runs a
     set prepared_answer_id = null,
         prepared_correct_index = null,
         prepared_token = null,
         touched_at = now()
   where a.profile_id = p_profile
     and a.round_id = p_round_id;
$$;

comment on function public.set_prepared_question(uuid, uuid, smallint, smallint, smallint[]) is
  'Bereitet die nächste Frage GENAU der genannten Runde vor. Passt die Kennung nicht, geschieht nichts und es kommt kein Token zurück (BUG-130).';

comment on function public.discard_prepared_question(uuid, uuid) is
  'Verwirft die vorbereitete Frage GENAU der genannten Runde; die aktuelle bleibt unangetastet (EC-12, BUG-130).';

-- ---------------------------------------------------------------------------
-- Rechte für die beiden neuen Signaturen
-- ---------------------------------------------------------------------------
-- Wie in 0009 und 0012: aus dem Browser heraus darf keine dieser Funktionen
-- aufrufbar sein. Die alten Signaturen sind mit `drop function` verschwunden und
-- nehmen ihre Rechte mit; die neuen brauchen den Entzug erneut.
revoke all on function public.set_prepared_question(uuid, uuid, smallint, smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.discard_prepared_question(uuid, uuid) from public, anon, authenticated;

grant execute on function public.set_prepared_question(uuid, uuid, smallint, smallint, smallint[]) to service_role;
grant execute on function public.discard_prepared_question(uuid, uuid) to service_role;
