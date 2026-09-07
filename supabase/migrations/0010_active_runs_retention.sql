-- Aufbewahrung des Rundenzustands (PROJ-2, AC-41; Art. 5(1)(e) DSGVO)
--
-- AC-41 sagt eine Frist zu: Wer eine Runde abbricht und nie zurückkommt, dessen
-- Rundenzustand ist nach spätestens zwei Stunden gelöscht.
--
-- Warum zeitgesteuert und nicht beim nächsten Rundenstart:
-- Aus PROJ-1 gelernt. `docs/privacy.md` muss beim verkehrsgetriebenen Abbau von
-- `auth_throttle` einräumen, dass er „keine feste Höchstfrist zusagt" — ein
-- Spieler, der nicht wiederkommt, erzeugt keinen Auslöser. Eine Frist, die nur
-- greift, wenn zufällig jemand vorbeikommt, ist keine Frist.
--
-- Warum alle 5 Minuten gegen 110 Minuten und nicht stündlich gegen 2 Stunden:
-- **Takt und Schwelle addieren sich.** Ein stündlicher Lauf gegen eine
-- 2-Stunden-Schwelle lässt eine Zeile bis zu drei Stunden liegen (zwei, bis sie
-- fällig wird, plus bis zu eine, bis der nächste Lauf sie sieht) — das hätte
-- AC-41 gebrochen. 5 + 110 Minuten ergibt schlimmstenfalls rund 1 Stunde
-- 55 Minuten, also innerhalb der Zusage, mit Luft für einen überlangen Lauf.
--
-- Die Kosten sind belanglos: ein Löschbefehl auf eine Tabelle mit höchstens so
-- vielen Zeilen, wie gerade Spieler spielen.

-- **Warum das hier eingepackt ist (BUG-124, QA-Lauf vom 2026-09-07).**
-- Vorher stand hier ein blankes `create extension if not exists pg_cron;`.
-- Verweigert das gehostete Projekt die Erweiterung — das Free Tier tut das, bis
-- sie im Dashboard eingeschaltet ist —, bricht damit die **ganze** Migration ab
-- und `supabase db push` scheitert hart. Nicht nur der Aufräum-Lauf fehlte dann,
-- sondern auch alles, was danach in dieser Datei steht, und die Migration gilt
-- als nicht gelaufen.
--
-- Bemerkenswert ist die Spannung zum eigenen Bauplan: `0005` hat den Weg über
-- `pg_cron` fünf Migrationen früher ausdrücklich vermieden, mit der Begründung,
-- er verlange „eine Erweiterung, die im gehosteten Projekt eigens eingeschaltet
-- werden muss — also eine weitere Aufgabe, die jemand von Hand erledigt und
-- vergessen kann. Genau daran ist BUG-36 gescheitert." Hier war sie unvermeidbar,
-- weil AC-41 eine Frist ohne Auslöser durch Verkehr verlangt — dann muss der
-- Fehlschlag aber wenigstens sichtbar und folgenlos für den Rest sein.
--
-- Das Ergebnis: Fehlt die Erweiterung, läuft die Migration durch und meldet eine
-- **Warnung**, die im Push-Protokoll steht. Die Absicherung bleiben T36 und T37
-- in `tasks.md` — die Erweiterung im Dashboard einschalten und prüfen, dass das
-- Projekt nicht wegen Inaktivität pausiert ist. Ohne sie ist AC-41 eine Zusage
-- ohne Mechanismus; das ist eine Deploy-Aufgabe, kein stiller Ausfall mehr.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception
    when others then
      raise warning 'pg_cron liess sich nicht anlegen (%): der Aufraeum-Lauf aus AC-41 wird uebersprungen. Erweiterung im Dashboard einschalten (T36), dann diese Migration erneut anwenden.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- `cron.schedule` legt bei gleichem Namen nicht doppelt an, sondern
    -- aktualisiert — ein erneuter Lauf dieser Migration ist damit gefahrlos.
    perform cron.schedule(
      'active-runs-retention',
      '*/5 * * * *',
      $q$ delete from public.active_runs where touched_at < now() - interval '110 minutes' $q$
    );
  else
    raise warning 'Aufraeum-Lauf active-runs-retention NICHT eingerichtet: pg_cron fehlt. AC-41 ist bis dahin nicht durchgesetzt.';
  end if;
end
$$;

comment on table public.active_runs is
  'Zustand der laufenden Quiz-Runde. Kurzlebig: gelöscht am Rundenende (AC-39), spätestens ~115 Minuten nach der letzten Berührung durch den Lauf active-runs-retention (AC-41) und mit dem Profil (AC-40). Ausschließlich über die Funktionen aus 0009 erreichbar.';
