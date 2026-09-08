-- Die Weltrangliste als Datenbankfunktion (PROJ-3, T1)
--
-- **Warum das eine Funktion ist und keine Abfrage aus der Anwendung.** Die
-- Lesepolicy auf `runs` (`runs_select_own`, 0002) lässt jeden Nutzer nur seine
-- eigenen Zeilen sehen — das ist die Zusage „schlechte Runden sind privat" aus
-- `docs/data-model.md`, und sie ist bewusst so. Eine Rangliste ist damit aus der
-- Sitzung eines Nutzers heraus gar nicht abfragbar. Diese Funktion ist die
-- einzige Öffnung, und sie ist **genau so breit wie die Anzeige**: ein Lauf je
-- Spieler, vier Werte, keine Konto-Kennung (AC-19, AC-20).
--
-- **Zum Parameter `p_profile` — die Stelle, an der man das hier falsch machen
-- kann.** `security definer` hebt RLS auf; ein angreiferkontrollierter Parameter
-- wäre deshalb ein Leck. Hier steuert `p_profile` ausschließlich, welche
-- **zusätzliche** Zeile herauskommt (die eigene, wenn sie nicht in der Top-5
-- steht) und welche Zeile `is_self` trägt. Mit einer fremden Kennung liesse sich
-- also der beste Lauf und der Rang eines Spielers ausserhalb der Top-5 erfahren.
-- Zwei Dinge halten das:
--   1. Die Funktion ist für `anon` und `authenticated` **nicht ausführbar**
--      (Rechte unten) — aus dem Browser gibt es keinen Aufrufweg.
--   2. Der einzige Aufrufer ist Servercode, der die Kennung aus `getUser()`
--      nimmt und **nie** aus einem Aufrufparameter (`src/lib/leaderboard/queries.ts`).
-- Dasselbe Muster wie bei den Rundenfunktionen aus 0009/0012/0013. Eine Prüfung
-- auf `auth.uid()` im Rumpf wäre hier **falsch**: Der Aufruf läuft über
-- `service_role`, dort ist `auth.uid()` leer, und die Funktion gäbe nie etwas
-- heraus.
--
-- **Die Sortierregel steht genau einmal da** und wird zweimal angewandt: einmal,
-- um je Spieler den besten Lauf zu wählen, und einmal, um die Bestläufe
-- durchzunummerieren. Genau das ist AC-4 — Liste und Platzierungsangabe können
-- nicht auseinanderlaufen, weil es keine zweite Nummerierung gibt.
--
-- Vier Stufen, die letzte ist die stille:
--   1. Serie absteigend                (AC-3)
--   2. Dauer aufsteigend               (AC-3)
--   3. Zeitpunkt aufsteigend           (AC-3, EC-1, EC-5 — der früher BEENDETE
--                                       Lauf steht oben; die Zeile entsteht beim
--                                       Rundenende, nicht beim Start)
--   4. Laufende Nummer aufsteigend     (EC-1) — nur für den Fall, dass selbst
--      der Zeitstempel zweier Runden gleich ist. Ohne sie ist die Ordnung nicht
--      total, und „die Reihenfolge springt zwischen zwei Aufrufen nicht" wäre
--      eine Hoffnung statt einer Zusage. Kostet nichts, weil `runs.id` ohnehin
--      fortlaufend vergeben wird.
--
-- `distinct on (profile_id)` mit derselben Reihenfolge bedient den vorhandenen
-- Index `runs_profile_best_idx (profile_id, streak desc, duration_ms asc)` aus
-- 0002 — es kommt **kein neuer Index dazu**.
--
-- **Gemessen am 2026-09-08 mit 100.000 Runden auf 4.008 Spieler** (der Plan der
-- vollständigen Abfrage, nicht nur eines Teilstücks):
--   Index Scan using runs_profile_best_idx  (rows=99900)
--     Presorted Key: profile_id, streak, duration_ms
--     -> Incremental Sort -> Unique (rows=4008)
--   Execution Time: 54 ms · die Funktion selbst dreimal: 46,7 / 45,6 / 46,0 ms
--
-- Was das heisst, genau gesagt — und **nicht** mehr, als dort steht: Der Index
-- liefert die Reihenfolge, es gibt also **keine Sortierung des gesamten
-- Bestands**, nur eine Nachsortierung innerhalb jeder Spieler-Gruppe (für die
-- Stufen 3 und 4). Der Scan wandert aber sehr wohl über **jede** gewertete
-- Zeile; die Kosten wachsen also mit der Zahl der Runden, nur mit einem kleinen
-- Faktor und ohne Sortier-Spitze. Herauskommt davon unabhängig eine Zeile je
-- Spieler — das ist EC-7, und bei 100k Runden sind es 46 ms gegen eine Zusage
-- von einer Sekunde.
create function public.leaderboard_page(p_profile uuid)
returns table (
  rank integer,
  trainer_name text,
  streak smallint,
  duration_ms integer,
  is_self boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    -- Ein Lauf je Spieler. `where streak >= 1` ist AC-5: Nullrunden bleiben
    -- gespeichert (PROJ-2 braucht sie für sein Erfolgskriterium), aber unter
    -- lauter Nullen entschiede der Tie-Breaker Zeit — die Rangliste sortierte
    -- dann, wer am schnellsten falsch geraten hat.
    select distinct on (r.profile_id)
           r.profile_id,
           r.streak,
           r.duration_ms,
           r.created_at,
           r.id
      from public.runs r
     where r.streak >= 1
     order by r.profile_id, r.streak desc, r.duration_ms asc, r.created_at asc, r.id asc
  ),
  ranked as (
    select b.profile_id,
           b.streak,
           b.duration_ms,
           -- Die eine Nummerierung. Lückenlos und eindeutig: `row_number()`,
           -- nicht `rank()` — geteilte Plätze gibt es hier nicht, weil die
           -- vierstufige Ordnung total ist.
           row_number() over (
             order by b.streak desc, b.duration_ms asc, b.created_at asc, b.id asc
           )::integer as position
      from best b
  )
  select rk.position,
         p.trainer_name,
         rk.streak,
         rk.duration_ms,
         -- Die eigene Zeile wird als Wahrheitswert markiert, nicht durch einen
         -- Kennungs-Vergleich im Browser. Genau deshalb ist AC-20 einhaltbar:
         -- Für einen Vergleich müsste die Konto-Kennung mitgeliefert werden.
         coalesce(rk.profile_id = p_profile, false) as is_self
    from ranked rk
    -- `join`, nicht `left join`: Eine Runde ohne Profil kann es nicht geben
    -- (Fremdschlüssel mit Kaskade, 0002). Wird ein Konto gelöscht, verschwinden
    -- seine Runden mit ihm und die darunterliegenden Spieler rücken auf — ohne
    -- Lücke und ohne dass hier etwas dafür getan werden müsste (AC-22, EC-4).
    join public.profiles p on p.id = rk.profile_id
   -- Die Top-5 plus die eigene Zeile, falls sie nicht ohnehin dabei ist.
   -- Steht der Aufrufer in der Top-5, kommt seine Zeile genau einmal (AC-8, EC-3).
   where rk.position <= 5 or rk.profile_id = p_profile
   order by rk.position;
$$;

comment on function public.leaderboard_page(uuid) is
  'Weltrangliste: Top-5 plus die eigene Zeile, falls Platz > 5. Ein Lauf je Spieler (bester, Serie >= 1), eine einzige Nummerierung fuer Liste und Platzierung (AC-4), keine Konto-Kennung im Ergebnis (AC-20). Nur fuer den Server aufrufbar.';

-- Rechte wie bei jeder Funktion dieses Projekts, die mehr darf als ihr Aufrufer
-- (0003, 0006, 0009, 0012, 0013): Aus dem Browser heraus **nicht** aufrufbar.
-- Waere sie fuer `authenticated` freigegeben, waere sie ein bequemes Werkzeug,
-- die Rangliste mit beliebigen Kennungen abzuklopfen — und der Schutz aus dem
-- Kopfkommentar oben haenge nur noch am Anwendungscode statt an der Datenbank.
revoke all on function public.leaderboard_page(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_page(uuid) to service_role;
