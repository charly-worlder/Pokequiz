-- BUG-54: Der IP-Zähler zählt nur noch Fehlversuche, nicht jeden Versuch.
--
-- Ausgangslage: `register_auth_attempt()` zählt **vor** der Passwortprüfung
-- hoch, ein erfolgreicher Login verbrauchte also Budget. Seit dem Fix für BUG-39
-- wird davon nichts mehr zurückgegeben — gemessen im QA-Nachlauf vom
-- 2026-09-05: Acht verschiedene Spieler mit **richtigem** Passwort hinter einer
-- geteilten Adresse (Haushalt, Schul-NAT, Mobilfunk-CGNAT) → fünf kommen
-- hinein, drei sehen „Zu viele Versuche von dieser Verbindung".
--
-- Warum die Erstattung und nicht „vorher prüfen, hinterher zählen": Das Zählen
-- und das Prüfen stecken bewusst in **einem** Statement (0003), damit gleichzeitige
-- Anfragen sich nicht überholen — nachgemessen mit 10 parallelen Versuchen bei
-- Limit 5. Ein getrenntes „erst lesen, dann schreiben" würde genau diese Lücke
-- wieder aufreißen: Ein Angreifer feuert 100 Anfragen gleichzeitig, alle sehen
-- den Zähler auf 0 und kommen durch. Deshalb bleibt es beim atomaren Hochzählen;
-- ein geglückter Login gibt **seinen eigenen** Versuch zurück, mehr nicht.
--
-- Was das für den Angreifer ändert: nichts. Wer 4 Fehlversuche macht, sich dann
-- selbst anmeldet und weiterrät, hat weiterhin genau die erlaubte Zahl an
-- **Fehl**versuchen pro Fenster — der eigene Login bringt ihm keinen einzigen
-- zusätzlichen Rateversuch ein. Genau das war BUG-39, und es bleibt geschlossen.
--
-- **Nur für den Login-Pfad.** Registrierung und Passwort-Reset erstatten
-- ausdrücklich **nicht**: Dort ist die begrenzte Sache die Handlung selbst
-- (Konten anlegen, Mails verschicken), nicht das Raten. Würden erfolgreiche
-- Registrierungen erstattet, wäre die Massenanlage von Konten unbegrenzt — siehe
-- BUG-47.

/*
  Gibt genau einen Versuch auf einem Zählerschlüssel zurück.

  `greatest(..., 0)` ist kein Zierrat: Läuft das Fenster zwischen dem Hochzählen
  und der Erstattung ab, beginnt `register_auth_attempt` bei 1 zu zählen, und die
  Erstattung träfe ein Fenster, zu dem dieser Versuch nie gehört hat. Ohne die
  Untergrenze entstünde daraus ein negativer Zähler — also stilles Freibudget für
  den nächsten Angreifer auf derselben Adresse.

  Kein `insert`: Gibt es die Zeile nicht, ist auch nichts zu erstatten.
*/
create or replace function public.refund_auth_attempt(p_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.auth_throttle
     set attempts = greatest(attempts - 1, 0)
   where key = p_key;
end;
$$;

-- Wie die beiden Funktionen aus 0003: nicht für den Browser. Könnte ein Client
-- selbst erstatten, wäre die Drosselung mit ein paar Aufrufen abschaltbar.
revoke all on function public.refund_auth_attempt(text) from public, anon, authenticated;
grant execute on function public.refund_auth_attempt(text) to service_role;
