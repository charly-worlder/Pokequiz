# PROJ-3: Weltrangliste

## Dependencies
- Benötigt: PROJ-1 (Benutzerkonto & Login) — der Trainername ist der Anzeigename in der Liste, und die Seite ist nur angemeldet erreichbar
- Benötigt: PROJ-2 (Pokémon-Quiz) — die gespeicherten `runs`-Zeilen sind die einzige Datenquelle der Rangliste. Ebenso die App-Shell (Kopfzeile mit „Bestenliste"-Zugang, Fußzeile) und die Ergebnis-Aktion „Zur Bestenliste"
- Liefert an: PROJ-4 (Datenschutz & Kontolöschung) — die Rangliste ist der Ort, an dem eine Kontolöschung für andere Nutzer sichtbar wird

## User Stories
- Als angemeldeter Spieler möchte ich die fünf besten Läufe aller Spieler sehen, damit ich weiß, worauf ich es überhaupt abgesehen habe.
- Als Spieler außerhalb der Top-5 möchte ich meine eigene Platzierung und den Abstand zur Top-5 sehen, damit ich ein erreichbares Ziel habe statt einer Liste von Fremden.
- Als Spieler, der gerade eine Rekordrunde beendet hat, möchte ich mich sofort in der Liste wiederfinden, damit ich sehe, dass der Lauf gezählt hat.
- Als Spieler möchte ich direkt von der Rangliste aus die nächste Runde starten, ohne den Weg zurück suchen zu müssen.
- Als neuer Spieler ohne gewerteten Lauf möchte ich verstehen, was ich tun muss, um überhaupt in die Wertung zu kommen.
- Als Teilnehmer der Rangliste möchte ich, dass andere Spieler ausschließlich meinen besten Lauf sehen und nicht meine gesamte Spielhistorie.

## Out of Scope
- **Saisons, Zeitfilter, Tabs („Diesen Monat")** — bewusst nicht im MVP, siehe Decision Log. Kandidat für ein eigenes Feature, sobald echte Nutzung da ist.
- **Mehr als fünf Plätze, Blättern, Suche nach einem Spieler** — die Liste ist genau fünf Zeilen plus die eigene Zeile.
- **Profile anderer Spieler, Freunde, Folgen, Spieler anklicken** — es gibt keinen Weg von der Rangliste zu einer Person.
- **Nullrunden in der Wertung** — siehe Decision Log. PROJ-2 speichert sie weiter, sie ranken nur nicht.
- **Live-Aktualisierung** (Echtzeit-Abo, Polling, „Aktualisieren"-Button) — siehe Decision Log; Echtzeit-Wettbewerb ist im PRD ein Nicht-Ziel.
- **Verlauf der eigenen Platzierung** („letzte Woche Platz 12") — würde einen eigenen Speicher brauchen, den es bewusst nicht gibt.
- **Datum eines Laufs in der Zeile** — der Zeitpunkt wird ausschließlich als Tie-Breaker benutzt, nicht angezeigt.
- **Eine erneute „Neue Bestleistung!"-Meldung** — die zeigt bereits der Ergebnis-Screen aus PROJ-2 (AC-8).
- **Inhalte der Seiten `/privacy` und `/imprint`** sowie die **Auslösung der Kontolöschung** — gehören zu PROJ-4.

## Acceptance Criteria

### Rangliste und Reihenfolge

- [ ] **AC-1** — Angenommen ein angemeldeter Nutzer öffnet `/leaderboard`, wenn die Seite geladen ist, dann sieht er die fünf besten Läufe aller Spieler als Liste, jede Zeile mit Platz, Trainername, erreichter Serie und benötigter Zeit im Format `mm:ss,s`.
- [ ] **AC-2** — Angenommen ein Spieler hat mehrere Läufe gespielt, wenn die Rangliste aufgebaut wird, dann erscheint von ihm ausschließlich sein bester Lauf; zwei Zeilen desselben Spielers kann es nicht geben.
- [ ] **AC-3** — Angenommen mehrere Läufe werden verglichen, wenn die Reihenfolge bestimmt wird, dann gilt: Serie absteigend, bei gleicher Serie Zeit aufsteigend, und bei gleicher Serie **und** gleicher Zeit steht der früher erreichte Lauf oben.
- [ ] **AC-4** — Angenommen die Top-5 und die eigene Platzierung werden angezeigt, wenn beide ermittelt werden, dann liegt ihnen genau **eine** Sortierregel zugrunde (die aus AC-3) — Liste und Platzierungsangabe können nicht auseinanderlaufen.
- [ ] **AC-5** — Angenommen ein Lauf hat die Serie 0, wenn die Rangliste aufgebaut wird, dann wird er nicht gewertet; in die Wertung kommen ausschließlich Läufe mit Serie ≥ 1.
- [ ] **AC-6** — Angenommen es gibt weniger als fünf Spieler mit einem gewerteten Lauf, wenn die Rangliste angezeigt wird, dann zeigt sie genau so viele Zeilen, wie es gewertete Spieler gibt — keine Platzhalterzeilen und keine Testdaten.

### Die eigene Platzierung

- [ ] **AC-7** — Angenommen ein Spieler hat einen gewerteten Lauf, steht damit aber nicht in der Top-5, wenn er die Rangliste öffnet, dann sieht er unterhalb der Liste eine optisch abgesetzte Zeile mit seinem eigenen besten Lauf und der Angabe „Platz N — noch X bis Top 5", wobei X der Abstand zu Platz 5 ist.
- [ ] **AC-8** — Angenommen ein Spieler steht selbst in der Top-5, wenn er die Rangliste öffnet, dann ist seine Zeile innerhalb der Liste hervorgehoben und die zusätzliche Zeile aus AC-7 entfällt.
- [ ] **AC-9** — Angenommen ein Spieler hat noch keinen gewerteten Lauf, wenn er die Rangliste öffnet, dann steht anstelle einer Platzierung der Hinweis, dass er mindestens eine Frage richtig beantworten muss, um in die Wertung zu kommen, zusammen mit der Aktion „Runde starten".
- [ ] **AC-10** — Angenommen ein Spieler ist in der Wertung, wenn er die Rangliste ansieht, dann ist seine eigene Zeile immer visuell hervorgehoben — gleichgültig, ob sie in der Top-5 oder in der Zeile darunter steht.

### Aktualität

- [ ] **AC-11** — Angenommen ein Spieler hat gerade eine Runde beendet und öffnet die Rangliste, wenn die Seite geladen wird, dann spiegelt sie den Stand im Moment der Anfrage und enthält auch einen wenige Sekunden alten Lauf; es wird keine zwischengespeicherte Fassung ausgeliefert.
- [ ] **AC-12** — Angenommen ein Spieler hat die Rangliste geöffnet, wenn in derselben Zeit andere Spieler Runden beenden, dann ändert sich die angezeigte Liste nicht von selbst — es gibt kein Live-Abo, kein Polling und keinen automatischen Neuaufbau.

### Zugang, Aktionen und Rahmen

- [ ] **AC-13** — Angenommen ein Nutzer ist nicht angemeldet, wenn er `/leaderboard` aufruft, dann wird er auf `/login` weitergeleitet und bekommt keine Ranglisten-Inhalte zu sehen.
- [ ] **AC-14** — Angenommen ein Spieler ist auf der Rangliste, wenn er sie gelesen hat, dann steht „Runde starten" als Primär-Aktion auf der Seite — unabhängig davon, ob er aus einer Runde kam oder die Seite direkt aufgerufen hat.
- [ ] **AC-15** — Angenommen die Rangliste wird geöffnet, wenn die Seite steht, dann benutzt sie unverändert die App-Shell aus PROJ-2 (dieselbe Kopfzeile, derselbe Seitenrahmen, dieselbe Fußzeile); es entsteht keine zweite Navigation und keine eigene Kopfzeilen-Variante.
- [ ] **AC-16** — Angenommen die Rangliste lädt noch, wenn der Nutzer wartet, dann sieht er Skelettzeilen in der Höhe der erwarteten Zeilen — nie einen alleinstehenden Spinner —, sodass das Layout beim Eintreffen der Daten nicht springt.
- [ ] **AC-17** — Angenommen noch kein einziger Spieler hat einen gewerteten Lauf, wenn die Rangliste geöffnet wird, dann erscheint der Leerzustand aus `docs/app-shell.md` (gedämpftes Ball-Motiv, ein Satz, „Runde starten" als Primär-Button) statt einer leeren Tabelle.
- [ ] **AC-18** — Angenommen ein Spieler öffnet die Rangliste auf einem Bildschirm unter 640 px, wenn er eine Zeile liest, dann bleiben Platz, Trainername, Serie und Zeit ohne horizontales Scrollen sichtbar; ein zu langer Trainername wird gekürzt, statt die Zeile umzubrechen.

### Datenschutz

_Diese Kriterien stammen aus der Prüfung mit `/dsgvo PROJ-3`, nicht aus dem Interview. Der Artikel dahinter nennt die Pflicht, aus der sie folgen. PROJ-3 ist das erste Feature, das personenbezogene Daten **anderen Nutzern** offenlegt — bis hierher sah jeder nur seine eigenen._

- [ ] **AC-19** — Angenommen die Rangliste wird ermittelt, wenn die Daten die Datenbank verlassen, dann gibt die Abfrage pro Spieler ausschließlich dessen besten Lauf heraus (Trainername, Serie, Zeit) — die Rundenhistorie eines anderen Spielers ist auch dann nicht abrufbar, wenn die Oberfläche umgangen und direkt auf die Schnittstelle zugegriffen wird (Art. 5(1)(c), Art. 25 DSGVO).
- [ ] **AC-20** — Angenommen die Ranglistenzeilen erreichen den Browser, wenn sie dort ankommen, dann enthalten sie keine Konto-Kennung fremder Spieler und keine E-Mail-Adresse — nur die vier angezeigten Werte (Art. 5(1)(c) DSGVO).
- [ ] **AC-21** — Angenommen die Rangliste wird angezeigt, wenn sie berechnet wird, dann legt sie dafür nichts Eigenes an: keine Ranglisten-Tabelle, keinen Schnappschuss, keinen Aufruf- oder Platzierungsverlauf (Art. 5(1)(c), Art. 5(1)(e) DSGVO).
- [ ] **AC-22** — Angenommen ein Konto wurde gelöscht, wenn die Rangliste danach aufgerufen wird, dann erscheint dieser Spieler nicht mehr und die darunterliegenden Spieler rücken auf; es existiert keine Kopie der Rangliste, die ihn weiter zeigt (Art. 17 DSGVO).
- [ ] **AC-23** — Angenommen eine Suchmaschine oder ein nicht angemeldeter Besucher ruft `/leaderboard` auf, wenn die Anfrage bearbeitet wird, dann werden keine Trainernamen ausgeliefert und die Seite wird nicht in den Suchindex aufgenommen (Art. 25 DSGVO).
- [ ] **AC-24** — Angenommen ein Spieler sieht die Rangliste, wenn er die Seite liest, dann steht dort in einem Satz, welche seiner Daten hier für andere angemeldete Spieler sichtbar sind und dass ausschließlich sein bester Lauf erscheint (Art. 13 DSGVO).

## Edge Cases

- **EC-1** — Angenommen zwei Spieler haben dieselbe Serie und dieselbe Zeit auf die Millisekunde genau, wenn die Rangliste mehrfach aufgerufen wird, dann steht der früher erreichte Lauf jedes Mal oben — die Reihenfolge springt zwischen zwei Aufrufen nicht.
- **EC-2** — Angenommen ein Spieler steht auf Platz 6, wenn er die Rangliste öffnet, dann lautet seine Zeile „Platz 6 — noch 1 bis Top 5".
- **EC-3** — Angenommen es gibt höchstens fünf gewertete Spieler und der Nutzer ist einer davon, wenn er die Rangliste öffnet, dann steht er in der Liste und es erscheint keine „noch X bis Top 5"-Zeile.
- **EC-4** — Angenommen ein Konto wird gelöscht, während ein anderer Spieler die Rangliste geöffnet hat, wenn dieser die Seite neu lädt, dann sieht er die neue Reihenfolge ohne Fehlermeldung und ohne leere Zeile an der Stelle des gelöschten Spielers.
- **EC-5** — Angenommen ein Spieler beendet eine Runde, die seinen bisherigen besten Lauf exakt einstellt (gleiche Serie, gleiche Zeit), wenn die Rangliste aufgebaut wird, dann erscheint weiterhin nur eine Zeile von ihm, und zwar mit dem früher erreichten Lauf.
- **EC-6** — Angenommen die Ranglisten-Abfrage schlägt fehl (Netzwerk- oder Datenbankfehler), wenn der Fehler feststeht, dann erscheint der Hinweis **innerhalb der Karte** mit einer „Erneut versuchen"-Aktion — nie ganzseitig; Kopf- und Fußzeile bleiben stehen.
- **EC-7** — Angenommen ein Spieler hat sehr viele Läufe gespielt (mehrere hundert), wenn die Rangliste berechnet wird, dann erscheint davon nur sein bester Lauf und die Seite wird dadurch nicht langsamer.
- **EC-8** — Angenommen die Sitzung eines Nutzers läuft ab, während er die Rangliste geöffnet hat, wenn er die Seite neu lädt oder eine Aktion auslöst, dann wird er auf `/login` geleitet; es erscheint keine halb geladene Liste mit fremden Trainernamen.
- **EC-9** — Angenommen ein Trainername schöpft die erlaubten 20 Zeichen voll aus, wenn seine Zeile auf einem schmalen Bildschirm dargestellt wird, dann wird der Name gekürzt angezeigt, während Platz, Serie und Zeit vollständig sichtbar bleiben.

## Technical Requirements
- **Ladezeit:** Die Rangliste steht in unter 1 Sekunde nach dem Aufruf.
- **Datenquelle:** ausschließlich die `runs`-Zeilen aus PROJ-2 und der Trainername aus PROJ-1. Es entsteht keine neue Entität (`docs/data-model.md`: „Die Rangliste ist eine Abfrage, keine Tabelle").
- **Zugriffsweg:** Die Rangliste kann `runs` nicht direkt lesen — die Zugriffsregel dort erlaubt jedem Nutzer nur seine eigenen Zeilen. Sie bezieht ihre Daten über eine eigens dafür gebaute Datenbankfunktion, die pro Spieler ausschließlich den besten Lauf herausgibt (festgelegt in PROJ-2 → `design.md`; der Index `runs_profile_best_idx` existiert bereits dafür).
- **Zugriff:** nur angemeldet; die Beschränkung greift auch bei direktem Aufruf der Schnittstelle, nicht nur in der Oberfläche (`.claude/rules/security.md`).
- **Zahlen-Darstellung:** Platz, Serie und Zeit mit `font-variant-numeric: tabular-nums`, damit die Spalten in der Liste bündig stehen.
- **Rückmeldung** erfolgt am Ort der Handlung — dieses Produkt hat keine Toasts (`docs/app-shell.md`).
- **Die Rangliste wertet ausschließlich Läufe verifizierter Konten.** Harte Voraussetzung für `/architecture`, entschieden am 2026-09-05 — Begründung im Decision Log. Wie ein Konto als verifiziert gilt, entwirft `/architecture`; die Entscheidung, **dass** die Wertung daran hängt, steht fest und ist keine Option mehr.

## Open Questions
- [ ] **Wie gilt ein Konto als verifiziert?** Die Richtung steht (siehe Technical Requirements und Decision Log), der Mechanismus nicht. Zu klären in `/architecture`: E-Mail-Bestätigung — die es bewusst nicht gibt, siehe `docs/PRD.md` — oder ein Mindestalter des Kontos, oder eine Mindestzahl gespielter Runden, oder eine Kombination. **Die Wahl hängt am SMTP-Blocker aus `docs/PRD.md`:** Ohne eigenen Absender ist eine E-Mail-Bestätigung nicht zustellbar, ein rein zeit- oder verhaltensbasiertes Kriterium dagegen sofort baubar.
- [ ] **Einfrier-Risiko der ewigen Rangliste:** Nach einigen Monaten steht oben eine Spitze, die kein Neuzugang mehr erreicht. Sobald echte Nutzung da ist, prüfen, ob eine Monatsrangliste als eigenes Feature nachgezogen wird (siehe Decision Log).
- [ ] **Der Registrierungs-Hinweis fehlt.** PROJ-1 sagt beim Anlegen des Kontos nicht, dass der Trainername für andere Spieler sichtbar und dauerhaft unveränderlich ist — bis PROJ-3 wurde er nirgends angezeigt, ab jetzt schon. Vor dem öffentlichen Start per `/refine PROJ-1` ergänzen oder bewusst verwerfen (aus `/dsgvo PROJ-3`).
- [ ] **Sollte der Trainername (mindestens einmalig) änderbar sein?** Ein Kind, das seinen echten Namen eingetragen hat, kann ihn derzeit nur durch Löschen des gesamten Kontos aus der Rangliste bekommen. Frage an einen Anwalt, siehe `docs/privacy.md` → „Für einen Anwalt".
- [ ] **„noch X bis Top 5" bei sehr großen Rängen:** Ab welcher Platzierung motiviert die Formulierung nicht mehr, und wäre dort ein näherer Ankerwert (z. B. „noch X bis Top 100") besser? Erst mit echten Nutzerzahlen beantwortbar.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Die eigene Platzierung wird als „Platz N — noch X bis Top 5" gezeigt, ohne Gesamtspielerzahl | Der Nenner („von 312") beantwortet eine Frage, die der Spieler nicht gestellt hat, und wirkt bei kleiner Nutzerbasis entmutigend statt motivierend. Der Abstand zur Top-5 ist die eigentliche Absicht und lässt sich allein aus dem eigenen Rang berechnen. | 2026-09-03 |
| Bei komplettem Gleichstand (Serie und Zeit identisch) gewinnt der früher erreichte Lauf | Ohne dritte Stufe ist die Reihenfolge nicht eindeutig und die Platzierung springt zwischen zwei Seitenaufrufen — auffällig genau für den Spieler, der seinen Rang verfolgt. Der Zeitpunkt kollidiert nie, und „wer zuerst da war" empfindet niemand als unfair. | 2026-09-03 |
| Kein Datum in der Ranglisten-Zeile | Trägt nichts zum Wettbewerb bei und macht die Zeile auf schmalen Bildschirmen eng. Als Tie-Breaker ist der Zeitpunkt trotzdem im Einsatz, nur unsichtbar. | 2026-09-03 |
| Eine einzige Sortierregel erzeugt Liste **und** eigene Platzierung | Zwei getrennte Berechnungen laufen bei einem Gleichstand auseinander — die Liste zeigt „Platz 4", die Zeile darunter behauptet „Platz 5". Ein Fehler, der erst im Betrieb auffällt und dann Vertrauen in die ganze Rangliste kostet. | 2026-09-03 |
| Momentaufnahme bei jedem Aufruf, kein Live-Abo und kein Zwischenspeicher | Eine Liste, die sich unter dem Finger des Lesers umsortiert, ist unangenehm, und Echtzeit-Wettbewerb ist im PRD ein Nicht-Ziel. Zwischengespeichert ausgeliefert wäre sie dagegen schlimmer: Der Spieler sähe nach seiner Rekordrunde eine Liste ohne sich selbst und hielte das für einen Speicherfehler. | 2026-09-03 |
| „Runde starten" ist Primär-Aktion auf der Rangliste | Das wichtigste Erfolgskriterium des PRD ist die zweite Runde. Die Rangliste beantwortet „wo stehe ich" — die einzige sinnvolle Antwort des Spielers darauf muss unter der Liste stehen, nicht zwei Klicks entfernt. | 2026-09-03 |
| Keine erneute „Neue Bestleistung!"-Meldung auf der Rangliste | Der Ergebnis-Screen aus PROJ-2 (AC-8) hat sie bereits gezeigt; eine Wiederholung macht aus einer Auszeichnung eine Formalie. Die Hervorhebung der eigenen Zeile reicht, damit das Auge sie findet. | 2026-09-03 |
| Nur Läufe mit Serie ≥ 1 kommen in die Wertung | Unter lauter Nullen entscheidet der Tie-Breaker Zeit — die Rangliste würde also sortieren, wer am schnellsten falsch geraten hat, und wer sofort klickt stünde über dem, der nachgedacht hat. An PROJ-2 ändert das nichts: Nullrunden werden weiter gespeichert, damit „startet jemand eine zweite Runde?" messbar bleibt. | 2026-09-03 |
| Für das MVP nur die ewige Rangliste, keine Saisons | Bei null Spielern zu Beginn zerteilt eine Wochen- oder Monatsliste ein ohnehin dünnes Feld — „Platz 2 diese Woche" bei drei Teilnehmern entwertet die Auszeichnung schneller als eine eingefrorene Spitze. Außerdem verdoppelt jede Zeitachse Oberfläche und Abfrage. Das Einfrier-Risiko wird stattdessen durch die persönliche Zeile „noch X bis Top 5" abgefedert und als Open Question geführt. | 2026-09-03 |
| Kein Weg von der Rangliste zu einer Person (kein Profil, kein Klick auf einen Spieler) | Die Rangliste soll Wettbewerb sichtbar machen, nicht Menschen auffindbar. Das Publikum schließt absehbar Minderjährige ein; ein anklickbarer Trainername wäre der erste Schritt zu einem sozialen Netz, das dieses Produkt nicht sein will. | 2026-09-03 |
| **Die Rangliste wertet ausschließlich Läufe verifizierter Konten** | Aus dem QA-Lauf zu PROJ-2 vom 2026-09-05 (BUG-19, High). Gemessen: Ein einziger Aufruf von `saveRun` erzeugt einen perfekten Bestwert (Serie 386) ohne eine einzige beantwortete Frage, und Konten dafür lassen sich unbegrenzt und ohne CAPTCHA anlegen. **Jedes Stück davon ist einzeln eine bewusst getroffene Entscheidung** — PROJ-2 verzichtet absichtlich auf eine serverseitig autoritative Runde, und PROJ-1 verzichtet absichtlich auf E-Mail-Bestätigung —, **die Kombination war es nicht.** Zusammen machen sie den Wettbewerbsmechanismus mit einem Skript wertlos, und PROJ-3 erbt das ungefiltert: Das PRD-Erfolgskriterium „Die Weltrangliste füllt sich mit echten Einträgen statt Testdaten" hängt genau an diesen Zeilen. Ausdrücklich **gegen** die beiden Alternativen entschieden: CAPTCHA bei der Registrierung (verschiebt die Hürde, hebt sie nicht — und widerspricht „ohne Erklärung sofort loslegen" aus dem PRD) und Drosselung von `saveRun` (bremst die Rate, nicht die Fälschung: Ein Skript darf sich Zeit lassen). Die Wertung an das Konto zu binden trifft die Ursache, weil ein gefälschter Lauf ohne wertbares Konto folgenlos bleibt. **Der Preis ist benannt:** Neue Spieler erscheinen nicht sofort in der Rangliste, und der Verifikationsweg muss ohne E-Mail auskommen, solange der SMTP-Blocker aus `docs/PRD.md` steht | 2026-09-05 |
