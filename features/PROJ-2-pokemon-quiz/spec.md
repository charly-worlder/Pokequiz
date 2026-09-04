# PROJ-2: Pokémon-Quiz

## Dependencies
- Benötigt: PROJ-1 (Benutzerkonto & Login) — das Quiz ist nur angemeldet erreichbar, und jede gespeicherte Runde hängt an einem Profil
- Liefert an: PROJ-3 (Weltrangliste) — die `runs`-Einträge, aus denen die Rangliste berechnet wird
- Liefert an: PROJ-4 (Datenschutz & Kontolöschung) — die Fußzeile, in der die Rechts-Seiten verlinkt werden
- **Besitzt die App-Shell** (Kopfzeile, Seitenrahmen, Fußzeile, Wortmarke) laut `docs/app-shell.md`

## User Stories
- Als angemeldeter Pokémon-Fan möchte ich mit einem Klick eine Runde starten, damit ich ohne Erklärung sofort spiele.
- Als Spieler möchte ich ein Pokémon-Bild sehen und aus vier **deutschen** Namen den richtigen wählen, damit ich mein Wissen genau in den Namen teste, mit denen ich aufgewachsen bin.
- Als Spieler möchte ich meine Serie und meine Zeit während der Runde sehen, damit ich merke, wie weit ich komme.
- Als Spieler möchte ich nach einer falschen Antwort erfahren, wie das Pokémon wirklich heißt, damit ich beim nächsten Mal besser bin.
- Als Spieler möchte ich am Rundenende sehen, ob ich meinen eigenen Rekord geschlagen habe, und sofort eine neue Runde starten können.
- Als Spieler möchte ich, dass ein Aussetzer der externen Datenquelle meine laufende Serie nicht vernichtet.
- Als Teilnehmer der öffentlichen Rangliste möchte ich, dass erfundene Ergebnisse nicht gespeichert werden, damit die Rangliste etwas wert ist.

## Out of Scope
- **Anzeige der Weltrangliste** — gehört zu PROJ-3. Dieses Feature liefert nur die gespeicherten Runden und den Link dorthin.
- **Platzierungsanzeige im Ergebnis** („Platz 7 weltweit") — bewusst nicht, siehe Decision Log. Der Vergleich mit anderen bleibt vollständig bei PROJ-3.
- **Generationen-Auswahl, Schwierigkeitsstufen, Kategorien, Filter** — laut PRD bewusst später.
- **Freitext-Eingabe des Namens** — laut PRD Nicht-Ziel.
- **Pro-Antwort-Timer / Zeitdruck** — laut PRD Nicht-Ziel. Nur die Gesamtzeit wird gemessen, und nur als Tie-Breaker.
- **Silhouette oder Bildverfremdung** — laut PRD Nicht-Ziel, das Pokémon wird regulär gezeigt.
- **Fortsetzen einer unterbrochenen Runde** — bewusst nicht, siehe Decision Log.
- **Inhalte der Seiten `/privacy` und `/imprint`** — gehören zu PROJ-4. PROJ-2 baut nur die Fußzeile, in der sie später erscheinen.
- **Serverseitig autoritative Rundenlogik** — bewusst nicht im MVP, siehe Decision Log.
- **Eigene Pokémon-Tabelle und Vorab-Download des ganzen Pools** — ausgeschlossen: Es entsteht keine `pokemon`-Entität im Datenmodell und keine Kopie des Datenbestands auf Vorrat. Das ist **nicht** dasselbe wie „kein Cache": Die Fair-Use-Policy verlangt ausdrücklich, bereits abgerufene Ressourcen zwischenzuspeichern (siehe AC-31).

## Acceptance Criteria

### Spielablauf

- [ ] **AC-1** — Angenommen ein angemeldeter Nutzer öffnet `/`, wenn die Seite geladen ist, dann sieht er den Startbildschirm mit der Wortmarke, einem Satz zur Spielregel, „Runde starten" als Primär-Aktion und — sofern er schon gespielt hat — seiner bisherigen persönlichen Bestleistung (Serie und Zeit).
- [ ] **AC-2** — Angenommen ein Nutzer ist auf dem Startbildschirm, wenn er „Runde starten" klickt, dann erscheint die erste Frage (Pokémon-Bild plus vier deutsche Namensoptionen) in unter 3 Sekunden, und die Rundenuhr startet in dem Moment, in dem das Bild sichtbar ist — nicht beim Klick.
- [ ] **AC-3** — Angenommen eine Frage wird angezeigt, wenn der Nutzer die vier Optionen liest, dann ist genau eine der offizielle deutsche Name des gezeigten Pokémon und die drei anderen sind zufällig gezogene, voneinander und von der Lösung verschiedene Pokémon aus dem Pool Nr. 1–386; die Reihenfolge der vier Optionen ist zufällig gemischt.
- [ ] **AC-4** — Angenommen eine Frage ist offen, wenn der Nutzer die richtige Option wählt, dann färbt sie sich grün, der Serien-Zähler erhöht sich um 1 und die nächste Frage wird gezeigt, ohne dass die Uhr anhält.
- [ ] **AC-5** — Angenommen eine Runde läuft, wenn weitere Fragen gezogen werden, dann erscheint kein Pokémon innerhalb derselben Runde ein zweites Mal als gesuchtes Pokémon.
- [ ] **AC-6** — Angenommen eine Frage ist offen, wenn der Nutzer eine falsche Option wählt, dann färbt sich die gewählte Option rot und rüttelt (`nudge`), die richtige Option färbt sich gleichzeitig grün, die Uhr stoppt, und die Auflösung bleibt stehen, bis der Nutzer selbst zum Ergebnis weiterklickt.
- [ ] **AC-7** — Angenommen eine Runde ist beendet, wenn der Nutzer zum Ergebnis weiterklickt, dann sieht er die erreichte Serie, die benötigte Zeit und „Nochmal spielen" als Primär-Aktion; „Zur Bestenliste" erscheint als sekundäre Aktion **genau dann, wenn die Ranglisten-Seite existiert**, und bis dahin gar nicht statt als toter Link (dieselbe Regel wie AC-21 für die Kopfzeile und AC-23 für die Fußzeile).
- [ ] **AC-8** — Angenommen die beendete Runde ist besser als alle bisherigen Runden desselben Nutzers (höhere Serie, oder gleiche Serie bei kürzerer Zeit), wenn der Ergebnis-Screen erscheint, dann wird sie als neue persönliche Bestleistung ausgewiesen und mit der `pop`-Animation hervorgehoben.
- [ ] **AC-9** — Angenommen der Nutzer ist auf dem Ergebnis-Screen, wenn er „Nochmal spielen" klickt, dann startet eine neue Runde mit Serie 0, zurückgesetzter Uhr und einem neu gezogenen, unabhängigen Fragen-Pool.
- [ ] **AC-10** — Angenommen eine Frage wird gerade beantwortet, wenn die nächste Frage an der Reihe ist, dann ist sie bereits im Hintergrund geladen und erscheint ohne sichtbaren Ladezustand.

### Speicherung und Schutz des Ergebnisses

- [ ] **AC-11** — Angenommen eine Runde ist beendet, wenn der Ergebnis-Screen erscheint, dann wurde das Ergebnis (Serie, Zeit, Zeitpunkt) automatisch als neue Zeile gespeichert — ohne Zutun des Nutzers und auch dann, wenn die Serie 0 beträgt.
- [ ] **AC-12** — Angenommen ein Rundenergebnis wird zum Speichern eingereicht, wenn der Server es prüft, dann nimmt er es nur an, falls es rechnerisch möglich ist: Serie zwischen 0 und 386, Zeit nicht negativ, und mindestens 0,5 Sekunden pro beantworteter Frage; andernfalls wird es abgelehnt und nicht gespeichert.
- [ ] **AC-13** — Angenommen ein Nutzer ist nicht angemeldet, wenn er `/` aufruft, dann wird er auf `/login` weitergeleitet und kann keine Runde starten.
- [ ] **AC-14** — Angenommen ein Nutzer ist angemeldet, wenn Rundenergebnisse gespeichert werden, dann kann er ausschließlich Runden für sein eigenes Konto schreiben — auch bei direktem Zugriff unter Umgehung der Oberfläche.

### Fehlerverhalten der externen Datenquelle

- [ ] **AC-15** — Angenommen eine Frage ist nach 5 Sekunden nicht vollständig ladbar, wenn dieser Zustand eintritt, dann wird einmal automatisch und für den Nutzer unsichtbar neu geladen.
- [ ] **AC-16** — Angenommen auch der automatische zweite Versuch scheitert, wenn der Fehler feststeht, dann erscheint **innerhalb der Quiz-Karte** (nie ganzseitig) ein Fehlerhinweis mit den Aktionen „Erneut versuchen" und „Runde beenden"; die erreichte Serie bleibt unverändert und die Uhr steht still, solange dieser Hinweis sichtbar ist.
- [ ] **AC-17** — Angenommen der Fehlerhinweis ist sichtbar, wenn der Nutzer „Erneut versuchen" klickt und die Frage diesmal lädt, dann läuft die Runde mit unveränderter Serie und weiterlaufender Uhr genau dort weiter — beliebig oft wiederholbar.
- [ ] **AC-18** — Angenommen der Fehlerhinweis ist sichtbar, wenn der Nutzer „Runde beenden" klickt, dann wird die Runde mit der bis dahin erreichten Serie und der gestoppten Zeit normal gewertet, gespeichert und der Ergebnis-Screen gezeigt.
- [ ] **AC-19** — Angenommen eine Runde mit mindestens einer richtigen Antwort läuft, wenn der Nutzer die Seite neu lädt oder den Tab schließen will, dann warnt der Browser ihn vorher; verlässt er die Seite trotzdem, ist die Runde verloren und wird nicht gespeichert.

### Bild-Auslieferung

- [ ] **AC-20** — Angenommen eine Frage wird angezeigt, wenn der Browser das Pokémon-Bild lädt, dann stellt er die Anfrage ausschließlich an die eigene Domain der Anwendung; es geht keine Anfrage aus dem Browser an ein Nicht-EU-CDN.

### App-Rahmen (Shell)

- [ ] **AC-21** — Angenommen ein Nutzer ist angemeldet, wenn er eine beliebige Seite der App öffnet, dann sieht er dieselbe Kopfzeile mit der Wortmarke (Ball-Motiv plus „Pokémon QUIZ"), dem Nutzer-Chip mit Initiale und Trainername, aus dem heraus er sich abmelden kann, und dem Zugang zur Bestenliste — Letzterer **genau dann, wenn die Ranglisten-Seite existiert**, und bis dahin gar nicht statt als toter Link (dieselbe Regel wie in AC-23 für die Fußzeile).
- [ ] **AC-22** — Angenommen ein Nutzer ist nicht angemeldet, wenn er `/login` oder `/reset-password` öffnet, dann zeigt dieselbe Kopfzeile rechts statt des Nutzer-Chips die Zeile „Deutsche Namen · Serie · Weltrangliste".
- [ ] **AC-23** — Angenommen eine beliebige Seite der App wird geöffnet — angemeldet oder nicht —, wenn sie geladen ist, dann trägt sie dieselbe schlanke Fußzeile; sie zeigt einen Rechts-Link nur, wenn die zugehörige Seite bereits existiert, und bleibt bis dahin ohne toten Link.
- [ ] **AC-24** — Angenommen ein Nutzer öffnet die App auf einem Bildschirm unter 768 px, wenn er die Kopfzeile sieht, dann gibt es kein Burger-Menü, sondern beide Elemente bleiben sichtbar; unter 640 px reduziert sich der Nutzer-Chip auf die Initiale.
- [ ] **AC-25** — Angenommen ein Bereich der Seite lädt noch, wenn der Nutzer darauf wartet, dann sieht er eine Skelettfläche in der Größe des erwarteten Inhalts mit sanftem Puls — nie einen alleinstehenden Spinner —, sodass das Layout beim Eintreffen des Bildes nicht springt.

### Umgang mit der externen Datenquelle

- [ ] **AC-31** — Angenommen ein Pokémon wurde schon einmal abgerufen (Bild oder deutscher Name), wenn es innerhalb desselben Zeitraums erneut als Lösung oder als Antwortoption vorkommt — bei demselben oder einem anderen Spieler —, dann wird es aus dem Zwischenspeicher bedient und **nicht** erneut bei der PokeAPI angefragt.

### Datenschutz

_Diese Kriterien stammen aus der Prüfung mit `/dsgvo PROJ-2`, nicht aus dem Interview. Der Artikel dahinter nennt die Pflicht, aus der sie folgen._

- [ ] **AC-26** — Angenommen ein Profil wird gelöscht, wenn die Löschung ausgeführt wird, dann verschwinden alle Runden dieses Profils mit — es bleiben keine verwaisten Rundenzeilen zurück (Art. 17, Art. 5(1)(e) DSGVO; den auslösenden Ablauf baut PROJ-4).
- [ ] **AC-27** — Angenommen eine Runde wird gespeichert, wenn die Zeile geschrieben wird, dann enthält sie ausschließlich Serie, Zeit, Zeitpunkt und die Zuordnung zum Profil — keine IP-Adresse, keinen Frage- oder Antwortverlauf, keine Geräte- oder Browserdaten (Art. 5(1)(c) DSGVO).
- [ ] **AC-28** — Angenommen ein Spieler spielt eine Runde, wenn die Bilder über den eigenen Server ausgeliefert werden, dann legt die Anwendung darüber keine eigene nutzerbezogene Aufzeichnung an; es wird nicht gespeichert, welcher Nutzer wann welches Pokémon gesehen hat (Art. 5(1)(c) DSGVO).
- [ ] **AC-29** — Angenommen ein Nutzer öffnet eine beliebige Seite der App, wenn sie geladen ist, dann werden ausschließlich die für den Betrieb erforderlichen Cookies gesetzt und keine Analyse-, Werbe- oder Tracking-Ressourcen geladen — deshalb erscheint kein Einwilligungsbanner (§ 25 TDDDG).
- [ ] **AC-30** — Angenommen eine beliebige Seite der App wird geladen, wenn der Browser die Schriften anfordert, dann kommen sie von der eigenen Domain; es geht keine Anfrage an Google-Server oder ein anderes Schriften-CDN (Art. 44 ff. DSGVO).

## Edge Cases

- **EC-1** — Angenommen eine Frage ist offen, wenn der Nutzer zwei Optionen so schnell hintereinander anklickt, dass beide Klicks eintreffen, dann zählt ausschließlich der erste; der zweite bleibt wirkungslos.
- **EC-2** — Angenommen ein Nutzer beantwortet alle 386 Pokémon des Pools richtig, wenn der Pool erschöpft ist, dann endet die Runde automatisch mit einer Gewinner-Meldung, die Zeit wird gestoppt und das Ergebnis normal gewertet und gespeichert.
- **EC-3** — Angenommen eine Runde ist beendet, wenn das Speichern des Ergebnisses fehlschlägt (Netzwerk- oder Serverfehler), dann sieht der Nutzer sein Ergebnis trotzdem, dazu einen Hinweis, dass es noch nicht gespeichert werden konnte, und eine Möglichkeit, das Speichern erneut auszulösen.
- **EC-4** — Angenommen dasselbe Rundenergebnis wird zweimal eingereicht (Doppelklick, automatischer Wiederholungsversuch, doppelt gesendete Anfrage), wenn beide Einreichungen ankommen, dann entsteht trotzdem nur **eine** Zeile in der Datenbank.
- **EC-5** — Angenommen die PokeAPI liefert für ein gezogenes Pokémon keinen deutschen Namen, wenn die Frage zusammengestellt wird, dann wird dieses Pokémon nicht verwendet und ein anderes gezogen; dem Nutzer wird niemals ein englischer Name als Option gezeigt.
- **EC-6** — Angenommen das Bild eines Pokémon ist nicht abrufbar, während die Namen vorliegen, wenn die Frage zusammengestellt wird, dann wird die Frage verworfen und eine neue geladen; das zählt nicht als falsche Antwort und beendet die Runde nicht.
- **EC-7** — Angenommen die Sitzung des Nutzers ist abgelaufen oder er hat sich in einem anderen Tab abgemeldet, während seine Runde läuft, wenn das Ergebnis gespeichert werden soll, dann wird er auf `/login` geleitet und die Runde geht verloren — sie wird keinem fremden Konto zugeordnet.
- **EC-8** — Angenommen die PokeAPI antwortet mit einem Rate-Limit oder einem Serverfehler statt gar nicht, wenn dieser Fall eintritt, dann wird er wie ein Ausfall behandelt (AC-15 bis AC-18) und nicht als leere Frage angezeigt.
- **EC-9** — Angenommen ein Nutzer klickt auf dem Startbildschirm mehrfach schnell auf „Runde starten", wenn mehrere Klicks eintreffen, dann startet trotzdem genau eine Runde.
- **EC-10** — Angenommen drei Fragen hintereinander werden nach EC-6 verworfen, weil kein Bild ladbar ist, wenn die dritte verworfen wird, dann zieht die Runde keine weitere Frage mehr, sondern geht in den Fehlerzustand aus AC-16 über (Fehlerhinweis in der Quiz-Karte, Uhr steht, Serie bleibt, „Erneut versuchen" und „Runde beenden").
- **EC-11** — Angenommen die aus der Pokémon-Nummer gebildete Bildadresse liefert kein Bild, wenn die Frage vorbereitet wird, dann wird die offizielle Bildadresse über die PokeAPI nachgeschlagen und verwendet; erst wenn auch das kein Bild ergibt, greift EC-6. Der Spieler bemerkt diesen Umweg nicht — weder als Wartezeit noch als übersprungene Frage.

## Technical Requirements
- **Startzeit:** unter 3 Sekunden vom Klick auf „Runde starten" bis zum ersten sichtbaren Pokémon (Erfolgskriterium aus `docs/PRD.md`)
- **Datenquelle:** PokeAPI (kein API-Key). Abgefragt wird ausschließlich für die vier in einer Frage gezeigten Pokémon, nie der Pool auf Vorrat. Die Fair-Use-Policy der PokeAPI kennt seit 2018 kein Rate-Limit mehr und bittet stattdessen um zwei Dinge: bereits abgerufene Ressourcen zwischenspeichern und die Anfragehäufigkeit gering halten (AC-31)
- **Bild-Weiterleitung und Cache hängen zusammen:** Weil die Sprites über den eigenen Server laufen (AC-20), entfällt der HTTP-Cache des Browsers als Puffer gegenüber dem CDN. Ohne serverseitigen Zwischenspeicher holt der Server dasselbe Bild bei jeder Frage jedes Spielers erneut
- **Zugriff:** nur angemeldet; Schreibrechte auf Runden zusätzlich auf Datenbankebene auf den Eigentümer beschränkt, nicht nur in der Anwendung (`.claude/rules/security.md`)
- **Zahlen-Darstellung:** alle sich live ändernden Zahlen (Uhr, Serie, Zeit) mit `font-variant-numeric: tabular-nums`, damit das Layout nicht springt
- **Rückmeldung** erfolgt am Ort der Handlung (Farbe, `pop`, `nudge`) — dieses Produkt hat keine Toasts (`docs/app-shell.md`)
- **Marken:** keine offiziellen Pokémon-Logos, -Schriftzüge oder -Grafiken; das Ball-Motiv wird in CSS gezeichnet (`docs/design-system.md`)

## Open Questions
- [ ] Die Mindestzeit von 0,5 Sekunden pro Frage in AC-12 ist geschätzt. Nach den ersten echten Runden prüfen, ob sie schnelle Spieler fälschlich blockiert — und gegebenenfalls per `/refine` anpassen.
- [ ] Wo der Zwischenspeicher aus AC-31 liegt und wie lange er hält, entscheidet `/architecture`. Zu klären ist dort auch, ob Bilder und Namen dieselbe Gültigkeitsdauer bekommen — deutsche Namen ändern sich praktisch nie, Sprites gelegentlich — und wie sich das mit AC-28 verträgt (der Zwischenspeicher darf keine nutzerbezogene Historie werden).
- [ ] Die Aufbewahrungsfrist der Zugriffslogs des Hosters ist offen, bis der Anbieter bei `/deploy` feststeht. Durch die Bild-Weiterleitung (AC-20) fallen dort pro Spieler deutlich mehr Anfragen an als bei einer gewöhnlichen Seite — die Frist gehört danach in `docs/privacy.md`.
- [x] „Zur Bestenliste" (AC-7) zeigt bis zur Fertigstellung von PROJ-3 auf eine Seite, die es noch nicht gibt → **ausgeblendet, bis PROJ-3 sie baut** (2026-09-04); die zweite der beiden hier vorgeschlagenen Optionen. Lehrreich ist der Weg dorthin: Diese Notiz stand seit dem 2026-09-01 unbearbeitet da. Aufgefallen ist das Problem erst drei Tage später im QA-Lauf zu PROJ-1 — und auch dort nicht am Ergebnis-Screen, sondern an der Kopfzeile (BUG-23). Eine Open Question ohne Termin und ohne Besitzer wird nicht dadurch erledigt, dass sie aufgeschrieben ist.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Fragen-Pool ist Generation 1–3 (Nr. 1–386) | Deckt die Kindheit von zwei Fan-Generationen ab. Größer als Gen 1 allein, aber noch nicht so groß, dass fast jede Frage geraten werden muss. „Pool erschöpft" wird damit praktisch unerreichbar, bleibt aber definiert (EC-2). | 2026-09-01 |
| Auflösung bleibt stehen, der Spieler klickt selbst zum Ergebnis | Der deutsche Name ist der Kern des Produkts — ein Countdown, der die Auflösung wegreißt, nimmt genau den Moment weg, für den das Quiz existiert. | 2026-09-01 |
| Drei zufällige Distraktoren aus dem ganzen Pool, keine Ähnlichkeitslogik | Ähnliche Namen zu bevorzugen bräuchte Wissen über den ganzen Pool, also eine gepflegte Liste oder Vorab-Caching — beides ist im PRD ausgeschlossen. Gelegentlich leichte Fragen halten lange Serien möglich. | 2026-09-01 |
| Jede beendete Runde wird gespeichert, auch Serie 0 | Das Erfolgskriterium „startet jemand nach einem Lauf eine zweite Runde?" ist nur messbar, wenn die schlechten Läufe mitzählen. Auf der Rangliste erscheinen sie ohnehin nie, weil dort pro Spieler nur der beste Lauf zählt. | 2026-09-01 |
| Uhr startet erst mit dem ersten sichtbaren Pokémon | Die Zeit ist der Tie-Breaker der Rangliste. Anfangs-Ladezeit ist nichts, worauf der Spieler Einfluss hat — sie darf sein Ergebnis nicht verschlechtern. | 2026-09-01 |
| Uhr pausiert während eines API-Ausfalls, die Serie bleibt erhalten | Ein Ausfall beim Anbieter darf weder die Serie noch das Ranglisten-Ergebnis kosten. Der Fehlerzustand ist ein sichtbarer, seltener Sonderfall — eine stehende Uhr wirkt dort nicht kaputt, sondern richtig. | 2026-09-01 |
| Wiederholungsversuche nach einem Ausfall sind unbegrenzt | Der Nutzer klickt selbst, es entsteht also keine automatische Last gegen die Fair-Use-Policy. Eine harte Grenze würde einen Spieler mit Serie 40 in eine Sackgasse zwingen; „Runde beenden" ist der jederzeit verfügbare zweite Ausweg. | 2026-09-01 |
| Keine Platzierungsanzeige im Ergebnis, nur persönliche Bestleistung | Der eigene Rekord ist der stärkste Anreiz für die zweite Runde und braucht nur die eigenen Runden. Der Vergleich mit anderen bleibt vollständig bei PROJ-3, sonst gehört Ranglisten-Logik zwei Features. | 2026-09-01 |
| Bilder werden über die eigene Domain ausgeliefert | Vermeidet eine Drittlandübermittlung der IP-Adresse bei jeder einzelnen Frage und damit sowohl ein Einwilligungsbanner als auch einen Transfermechanismus. Ein Einwilligungsbanner widerspräche „ohne Erklärung sofort loslegen" aus dem PRD; das Publikum schließt absehbar Minderjährige ein. | 2026-09-01 |
| Serverseitige Plausibilitätsprüfung statt serverseitig autoritativer Runde | Eine vollständig serverseitige Runde wäre der einzige dichte Schutz, macht aber jede Antwort zu einem Server-Roundtrip und widerspricht dem flüssigen Spielgefühl. Für ein Fan-Quiz ohne Preise ist der Rest-Missbrauch bewusst akzeptiert. | 2026-09-01 |
| Laufende Runden sind nicht wiederherstellbar, aber der Spieler wird gewarnt | Ein wiederherstellbarer Zustand wäre ein manipulierbarer Zustand und widerspricht `docs/app-shell.md`. Die Verlassen-Warnung rettet den versehentlichen Reload, ohne eine Wiederherstellung vorzutäuschen. | 2026-09-01 |
| Nach drei verworfenen Fragen in Folge wird die Runde in den Fehlerzustand versetzt statt weiter Fragen zu ziehen (EC-10) | Ein verworfenes Bild ist ein einzelnes kaputtes Pokémon; drei hintereinander auf verschieden gezogenen Nummern sind eine gebrochene Quelle. Ohne Grenze dreht die Runde endlos durch und sieht für den Spieler wie ein Hänger aus statt wie ein Fehler. Drei kosten unter einer Sekunde, weil ein fehlendes Bild sofort antwortet — der langsame Fall ist bereits durch das 5-Sekunden-Timeout aus AC-15 gedeckelt. Alle 386 Bilder und deutschen Namen wurden am 2026-09-01 vollständig geprüft (keine Lücke), der Puffer federt daher keine bekannte Lücke ab, sondern spätere Änderungen an der Bildablage | 2026-09-01 |
| Bereits abgerufene Pokémon werden zwischengespeichert, der Pool aber nie auf Vorrat geladen | Die Fair-Use-Policy der PokeAPI bittet ausdrücklich um beides: zwischenspeichern, was man abgerufen hat, und die Anfragehäufigkeit gering halten. Die Bild-Weiterleitung über den eigenen Server (AC-20) nimmt dem CDN den Browser-Cache als Puffer — ohne eigenen Zwischenspeicher wächst unsere Last auf die API mit jedem Spieler linear. | 2026-09-01 |
| Die App-Shell wird in PROJ-2 gebaut, die Fußzeilen-Links erscheinen erst mit PROJ-4 | `docs/app-shell.md` weist den Rahmen PROJ-2 zu. Ein Link auf eine noch nicht existierende Seite wäre ein toter Link im Produktivbetrieb; erscheint er erst mit der Zielseite, muss PROJ-4 den Rahmen nicht erneut anfassen. | 2026-09-01 |
| Die Regel gilt an **allen drei** Stellen, an denen dieses Feature auf eine fremde Seite zeigt: Fußzeile (AC-23), Kopfzeile (AC-21) und Ergebnis-Screen (AC-7) | Der Ergebnis-Screen war die dritte und letzte Fundstelle. Dass es drei Anläufe brauchte, um dieselbe Regel dreimal anzuwenden, liegt an der Form, in der sie festgehalten war: als Fließtext in `docs/app-shell.md` und als Open Question — beides gut lesbar, aber von nichts erzwungen. Deshalb steht die Bedingung ab jetzt in **jedem** der drei ACs ausdrücklich drin, und ein Schalter im Code trägt sie an einer Stelle für alle | 2026-09-04 |
| Die Regel „Link erst, wenn die Zielseite existiert" gilt auch für die **Kopfzeile**, nicht nur für die Fußzeile (AC-21) | Aufgedeckt als BUG-23 im QA-Lauf zu PROJ-1: Der Zugang zur Bestenliste zeigt auf `/leaderboard`, das es nicht gibt (PROJ-3 ist `Planned`) — jeder angemeldete Nutzer landet dort auf einer 404. Die Fußzeile befolgt die Regel seit dem 2026-09-01 mit einer leeren `LEGAL_PAGES`-Liste; für die Kopfzeile wurde derselbe Gedanke nie angewandt, obwohl es dieselbe Situation ist. PROJ-3 schaltet den Zugang frei, wenn es die Seite baut | 2026-09-03 |
