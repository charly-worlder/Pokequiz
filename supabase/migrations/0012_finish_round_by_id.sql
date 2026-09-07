-- Das Rundenende an die Runde binden (PROJ-2, BUG-120; AC-18, AC-36, EC-15)
--
-- **Der Befund.** `finish_round(p_profile)` beendete, was gerade aktiv war —
-- ohne zu fragen, welche Runde der Aufrufer meint. Gemessen im QA-Nachlauf vom
-- 2026-09-07: Ein veralteter Tab, dessen Runde längst durch eine neue verdrängt
-- war (AC-36), beendete mit „Runde beenden" die **laufende** Runde des anderen
-- Tabs und bekam deren Ergebnis angezeigt.
--
-- Antworten waren dagegen immer schon token-geprüft — dort halten AC-36 und
-- EC-15. Das Rundenende war die einzige Stelle, an der der Server nicht wissen
-- wollte, wovon die Rede ist.
--
-- **Die Korrektur.** Der Aufrufer nennt die Runde, die er beenden will; passt sie
-- nicht zur laufenden, geschieht nichts. Der Browser kennt diese Kennung seit dem
-- Rundenstart ohnehin — sie verrät nichts über die Lösung und dient ihm bereits
-- dazu, ein verlorengegangenes Ergebnis nachzulesen (EC-3).
--
-- Die Signatur ändert sich, deshalb wird die alte Funktion entfernt und neu
-- angelegt statt ersetzt — `create or replace` kann keine Parameterliste ändern.

drop function public.finish_round(uuid);

create function public.finish_round(p_profile uuid, p_round_id uuid)
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
     -- Der Unterschied zu vorher: Die Runde muss die sein, die der Aufrufer meint.
     and a.round_id = p_round_id
     for update;

  if not found then
    return query select null::uuid, null::smallint, null::integer, false;
    return;
  end if;

  -- Eine offene Frage zählt nicht mit: Der Spieler hat sie nicht beantwortet,
  -- und die Wartezeit vor der Fehlerkarte ist keine Spielzeit (AC-16).
  insert into public.runs (profile_id, streak, duration_ms, round_id)
  values (p_profile, v_row.streak, v_row.accumulated_ms, v_row.round_id)
  on conflict on constraint runs_round_id_key do nothing;

  delete from public.active_runs a where a.profile_id = p_profile;

  return query select v_row.round_id, v_row.streak, v_row.accumulated_ms, true;
end;
$$;

revoke all on function public.finish_round(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finish_round(uuid, uuid) to service_role;

comment on function public.finish_round(uuid, uuid) is
  'Beendet genau die genannte Runde dieses Profils und schreibt ihr Ergebnis. Passt die Kennung nicht zur laufenden Runde, geschieht nichts (BUG-120).';
