-- Die Regeln der Runde (PROJ-2, AC-33 bis AC-36, AC-39; EC-1, EC-2, EC-4, EC-12, EC-15)
--
-- Warum die Spielregel hier steht und nicht nur in der Server Action:
--
-- 1. `active_runs` ist für `anon` und `authenticated` unerreichbar (0007). Etwas
--    muss hineinreichen, und das ist `security definer` mit `service_role`-Recht —
--    dasselbe Muster wie 0003 (Drosselung) und 0006 (Trainername).
-- 2. Die Antwortprüfung ist ein Wettlauf: zwei Klicks, zwei Tabs, eine doppelt
--    gesendete Anfrage. Ein „lesen, entscheiden, schreiben" im Anwendungscode hat
--    zwischen Lesen und Schreiben eine Lücke. Hier ist es ein Schritt unter einer
--    Zeilensperre, und damit halten EC-1 und EC-15 auch unter Gleichzeitigkeit.
-- 3. Die Zeit misst dieselbe Uhr, die auch den Ausgabezeitpunkt gesetzt hat
--    (AC-34). Zwei Anwendungsserver mit leicht verschiedener Uhr könnten sonst
--    Messfehler in genau der Größenordnung des Tie-Breakers erzeugen.

-- ---------------------------------------------------------------------------
-- Auskunft über die laufende Runde — ohne die Lösung
-- ---------------------------------------------------------------------------
-- Der Aufrufer braucht die bereits gezogenen Nummern, um eine neue zu ziehen
-- (AC-5). Die Lösung gibt diese Funktion bewusst NICHT heraus: Sie wird nur dort
-- gebraucht, wo geurteilt wird, und das ist `submit_answer`.
create function public.get_round_snapshot(p_profile uuid)
returns table (
  round_id uuid,
  seen_ids smallint[],
  streak smallint,
  has_current boolean,
  has_prepared boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.round_id,
         a.seen_ids,
         a.streak,
         a.current_token is not null,
         a.prepared_token is not null
    from public.active_runs a
   where a.profile_id = p_profile;
$$;

-- ---------------------------------------------------------------------------
-- Runde starten — ersetzt eine vorhandene (AC-36, EC-9, EC-15)
-- ---------------------------------------------------------------------------
-- Die Token vergibt die Datenbank, nicht der Aufrufer: So kann kein Aufrufer ein
-- Token wählen, das er anderswo schon gesehen hat.
create function public.start_round(
  p_profile uuid,
  p_answer_id smallint,
  p_correct_index smallint,
  p_prepared_answer_id smallint,
  p_prepared_correct_index smallint,
  -- Nummern, die beim Ziehen verworfen wurden, weil ihnen der deutsche Name
  -- fehlte (EC-5) — sie duerfen nicht erneut gezogen werden.
  p_also_seen smallint[] default '{}'
)
returns table (round_id uuid, current_token uuid, prepared_token uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Eine laufende Runde wird verworfen und NICHT gespeichert. Das ist die
  -- Zusage aus AC-36; der Primärschlüssel allein würde den Einfügeversuch nur
  -- scheitern lassen, statt die alte Runde zu beenden.
  delete from public.active_runs a where a.profile_id = p_profile;

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
  returning a.round_id, a.current_token, a.prepared_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nächste Frage vorbereiten (AC-10, AC-32)
-- ---------------------------------------------------------------------------
-- `p_also_seen` nimmt die Nummern auf, die der Aufrufer beim Ziehen verworfen hat,
-- weil ihnen der deutsche Name fehlte (EC-5) — sie dürfen nicht erneut gezogen
-- werden, obwohl sie nie eine Frage geworden sind.
create function public.set_prepared_question(
  p_profile uuid,
  p_answer_id smallint,
  p_correct_index smallint,
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
  returning a.prepared_token into v_token;

  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vorbereitete Frage verwerfen (EC-6, EC-12)
-- ---------------------------------------------------------------------------
-- Rührt die AKTUELLE Frage nicht an. Das ist EC-12: Eine bereits angezeigte Frage
-- ist nicht verwerfbar, sonst wäre „Bild kaputt" ein Überspringen-Knopf für jedes
-- Pokémon, das der Spieler nicht erkennt. Die Nummer bleibt in `seen_ids`.
create function public.discard_prepared_question(p_profile uuid)
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
   where a.profile_id = p_profile;
$$;

-- ---------------------------------------------------------------------------
-- Vorbereitete Frage zur aktuellen machen (AC-10, AC-34, EC-12)
-- ---------------------------------------------------------------------------
-- Gebraucht, wenn der Spieler wartet: Nach einer richtigen Antwort ohne
-- vorbereitete Nachfolgerin steht die Runde ohne offene Frage da. Sobald der
-- Browser eine neue vorbereitet und ihr Bild geprüft hat, rückt sie hier nach.
--
-- **Warum das ein eigener Schritt ist und nicht Teil des Vorbereitens.** Eine
-- Frage, die direkt als „aktuell" entstünde, wäre nicht mehr verwerfbar —
-- `discard_prepared_question` rührt die aktuelle bewusst nicht an (EC-12).
-- Lädt ihr Bild nicht, säße die Runde fest: Der Server hielte eine Frage, die
-- der Spieler nie zu sehen bekommt. Deshalb entsteht jede Frage als
-- **vorbereitete** — dort ist sie verwerfbar — und wird erst aktuell, wenn ihr
-- Bild geladen ist. Der Ausgabezeitpunkt beginnt genau dann (AC-34).
--
-- Befördert wird nur, wenn gerade keine Frage offen ist. Ein Aufruf mit
-- laufender Frage kann eine angezeigte also nicht verdrängen.
create function public.promote_prepared_question(p_profile uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted uuid;
begin
  -- Ist dieses Token bereits die aktuelle Frage, ist nichts zu tun — und das ist
  -- der Normalfall: `submit_answer` befördert die vorbereitete Frage bereits
  -- selbst, wenn eine bereitliegt. Der Browser erfährt davon erst mit der
  -- Antwort und ruft hier trotzdem an, wenn seine Bildprüfung später fertig wird.
  -- Ohne diesen Zweig meldete die Funktion „nicht befördert", der Browser bliebe
  -- auf „Runde wird vorbereitet …" stehen und die Runde wäre tot (gefunden im
  -- E2E-Lauf am 2026-09-06, in allen drei Engines).
  if exists (
    select 1 from public.active_runs a
     where a.profile_id = p_profile and a.current_token = p_token
  ) then
    return true;
  end if;

  update public.active_runs a
     set current_answer_id = a.prepared_answer_id,
         current_correct_index = a.prepared_correct_index,
         current_token = a.prepared_token,
         current_issued_at = now(),
         prepared_answer_id = null,
         prepared_correct_index = null,
         prepared_token = null,
         touched_at = now()
   where a.profile_id = p_profile
     and a.current_token is null
     and a.prepared_token = p_token
  returning a.current_token into v_promoted;

  return v_promoted is not null;
end;
$$;
-- ---------------------------------------------------------------------------
-- Antwort prüfen — der Kern (AC-33, AC-34, AC-35, AC-39; EC-1, EC-2, EC-4, EC-15)
-- ---------------------------------------------------------------------------
create function public.submit_answer(
  p_profile uuid,
  p_token uuid,
  p_choice smallint
)
returns table (
  matched boolean,
  correct boolean,
  correct_index smallint,
  streak smallint,
  finished boolean,
  duration_ms integer,
  round_id uuid,
  next_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.active_runs;
  v_elapsed integer;
  v_correct boolean;
  v_streak smallint;
  v_total integer;
  v_finished boolean := false;
  v_next uuid;
begin
  -- Zeilensperre statt Lesen-dann-Schreiben. Kommt ein zweiter Aufruf mit
  -- demselben Token gleichzeitig herein, wartet er hier — und findet die Zeile
  -- danach nicht mehr, weil das Token unten geleert wurde. Genau das ist die
  -- Garantie hinter EC-1 (zweiter Klick) und EC-15 (verwaister Tab).
  select * into v_row
    from public.active_runs a
   where a.profile_id = p_profile
     and a.current_token = p_token
     for update;

  if not found then
    return query select false, false, null::smallint, null::smallint,
                        false, null::integer, null::uuid, null::uuid;
    return;
  end if;

  -- AC-34: gemessen wird von der Ausgabe der Frage bis zum Eingang der Antwort.
  v_elapsed := greatest(0, (extract(epoch from (now() - v_row.current_issued_at)) * 1000)::integer);
  v_total := v_row.accumulated_ms + v_elapsed;
  v_correct := (p_choice = v_row.current_correct_index);
  v_streak := case when v_correct then (v_row.streak + 1)::smallint else v_row.streak end;

  -- EC-2: „alle 386 richtig beantwortet" ist eine Aussage über die Serie, nicht
  -- über die Länge der Ausschlussliste — in der stehen auch verworfene Nummern.
  if not v_correct or v_streak >= 386 then
    v_finished := true;
  end if;

  if v_finished then
    -- AC-35: Das Ergebnis ist geschrieben, bevor der Aufrufer eine Antwort sieht.
    -- Beides in einer Transaktion: Scheitert das Einfügen, bleibt auch der
    -- Rundenzustand stehen — die eine erlaubte Ausnahme von AC-39 (EC-3).
    insert into public.runs (profile_id, streak, duration_ms, round_id)
    values (p_profile, v_streak, v_total, v_row.round_id)
    -- Konfliktziel über den Constraint statt über den Spaltennamen: `round_id` ist in
    -- dieser Funktion zugleich eine Ausgabespalte, und ein blanker Spaltenname wäre
    -- dort mehrdeutig (beim ersten Testlauf am 2026-09-06 sofort aufgeschlagen).
    on conflict on constraint runs_round_id_key do nothing;

    delete from public.active_runs a where a.profile_id = p_profile;
  elsif v_row.prepared_token is not null then
    -- Die vorbereitete Frage rückt nach und bekommt JETZT ihren Ausgabezeitpunkt.
    update public.active_runs a
       set streak = v_streak,
           accumulated_ms = v_total,
           current_answer_id = a.prepared_answer_id,
           current_correct_index = a.prepared_correct_index,
           current_token = a.prepared_token,
           current_issued_at = now(),
           prepared_answer_id = null,
           prepared_correct_index = null,
           prepared_token = null,
           touched_at = now()
     where a.profile_id = p_profile
    returning a.current_token into v_next;
  else
    -- Richtig geantwortet, aber es liegt keine vorbereitete Frage bereit: Die
    -- Runde läuft weiter, hat aber gerade keine offene Frage. Der Aufrufer zeigt
    -- die Fehlerkarte aus AC-16; die Uhr steht dabei von selbst, weil kein
    -- Intervall läuft.
    update public.active_runs a
       set streak = v_streak,
           accumulated_ms = v_total,
           current_answer_id = null,
           current_correct_index = null,
           current_token = null,
           current_issued_at = null,
           touched_at = now()
     where a.profile_id = p_profile;
  end if;

  return query select true,
                      v_correct,
                      v_row.current_correct_index,
                      v_streak,
                      v_finished,
                      case when v_finished then v_total else null::integer end,
                      v_row.round_id,
                      v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Runde beenden (AC-18, AC-35, AC-39, EC-4)
-- ---------------------------------------------------------------------------
-- Aus der Fehlerkarte heraus. Idempotent: Ein zweiter Aufruf findet keinen
-- Zustand mehr und meldet das, ohne eine zweite Zeile anzulegen — die
-- Eindeutigkeit von `runs.round_id` sichert denselben Fall zusätzlich ab.
create function public.finish_round(p_profile uuid)
returns table (round_id uuid, streak smallint, duration_ms integer, written boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.active_runs;
begin
  select * into v_row
    from public.active_runs a
   where a.profile_id = p_profile
     for update;

  if not found then
    return query select null::uuid, null::smallint, null::integer, false;
    return;
  end if;

  -- Eine offene Frage zählt nicht mit: Der Spieler hat sie nicht beantwortet,
  -- und die Wartezeit vor der Fehlerkarte ist keine Spielzeit (AC-16).
  insert into public.runs (profile_id, streak, duration_ms, round_id)
  values (p_profile, v_row.streak, v_row.accumulated_ms, v_row.round_id)
  -- Konfliktziel über den Constraint statt über den Spaltennamen: `round_id` ist in
    -- dieser Funktion zugleich eine Ausgabespalte, und ein blanker Spaltenname wäre
    -- dort mehrdeutig (beim ersten Testlauf am 2026-09-06 sofort aufgeschlagen).
    on conflict on constraint runs_round_id_key do nothing;

  delete from public.active_runs a where a.profile_id = p_profile;

  return query select v_row.round_id, v_row.streak, v_row.accumulated_ms, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Frage-Token zur Pokémon-Nummer auflösen (AC-20, AC-32)
-- ---------------------------------------------------------------------------
-- Nur für die laufende Runde dieses Nutzers, aktuelle oder vorbereitete Frage.
-- Ein fremdes, abgelaufenes oder erfundenes Token ergibt NULL, und die Route
-- antwortet darauf mit 404.
create function public.resolve_question_image(p_profile uuid, p_token uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select case
           when a.current_token = p_token then a.current_answer_id
           when a.prepared_token = p_token then a.prepared_answer_id
         end
    from public.active_runs a
   where a.profile_id = p_profile
     and (a.current_token = p_token or a.prepared_token = p_token);
$$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
-- Wie in 0003 und 0006: Keine dieser Funktionen darf aus dem Browser heraus
-- aufrufbar sein. `resolve_question_image` wäre sonst ein Werkzeug, um zu jedem
-- Token die Lösung nachzuschlagen — also genau das, was AC-32 verhindert.
revoke all on function public.get_round_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.start_round(uuid, smallint, smallint, smallint, smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.set_prepared_question(uuid, smallint, smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.discard_prepared_question(uuid) from public, anon, authenticated;
revoke all on function public.promote_prepared_question(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_answer(uuid, uuid, smallint) from public, anon, authenticated;
revoke all on function public.finish_round(uuid) from public, anon, authenticated;
revoke all on function public.resolve_question_image(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_round_snapshot(uuid) to service_role;
grant execute on function public.start_round(uuid, smallint, smallint, smallint, smallint, smallint[]) to service_role;
grant execute on function public.set_prepared_question(uuid, smallint, smallint, smallint[]) to service_role;
grant execute on function public.discard_prepared_question(uuid) to service_role;
grant execute on function public.promote_prepared_question(uuid, uuid) to service_role;
grant execute on function public.submit_answer(uuid, uuid, smallint) to service_role;
grant execute on function public.finish_round(uuid) to service_role;
grant execute on function public.resolve_question_image(uuid, uuid) to service_role;
