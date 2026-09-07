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

create extension if not exists pg_cron;

select cron.schedule(
  'active-runs-retention',
  '*/5 * * * *',
  $$ delete from public.active_runs where touched_at < now() - interval '110 minutes' $$
);

comment on table public.active_runs is
  'Zustand der laufenden Quiz-Runde. Kurzlebig: gelöscht am Rundenende (AC-39), spätestens ~115 Minuten nach der letzten Berührung durch den Lauf active-runs-retention (AC-41) und mit dem Profil (AC-40). Ausschließlich über die Funktionen aus 0009 erreichbar.';
