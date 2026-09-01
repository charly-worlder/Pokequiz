# PROJ-2 — Tech Design

## Component Structure

```
Wurzel-Layout (src/app/layout.tsx) — die App-Shell, gehört diesem Feature
+-- PageFrame                     Kopfzeile + Inhalt + Fußzeile, umschließt jede Route
    +-- SiteHeader                Server-Komponente, liest die Sitzung selbst (AC-21, AC-22)
    |   +-- Wordmark              Ball-Motiv in CSS + Schriftzug „Pokémon QUIZ"
    |   +-- angemeldet:   Button „Bestenliste" -> /leaderboard, UserChip
    |   |                 +-- UserChip: Initiale + Trainername, unter 640px nur Initiale (AC-24)
    |   |                     +-- „Abmelden" ruft PROJ-1s logoutAction auf
    |   +-- ausgeloggt:   Zeile „Deutsche Namen · Serie · Weltrangliste"
    +-- {children}                der jeweilige Screen
    +-- SiteFooter                auf jeder Seite, auch ausgeloggt (AC-23)

/ (Route „Spiel", nur angemeldet — Schutz durch PROJ-1s Proxy)
+-- page.tsx (Server-Komponente)  lädt die persönliche Bestleistung und reicht sie hinein
    +-- QuizScreen (Client-Komponente, hält den gesamten Rundenzustand)
        +-- StartView                              Zustand „bereit" (AC-1)
        |   +-- Ball-Motiv mit `float`, ein Satz zur Spielregel
        |   +-- persönliche Bestleistung, falls vorhanden
        |   +-- Primär-Button „Runde starten" (nach dem Klick gesperrt — EC-9)
        +-- QuestionView                           Zustand „Frage offen" / „aufgelöst"
        |   +-- StatusBar: StreakBadge + RoundClock (beide tabular-nums)
        |   +-- PokemonImage (next/image) mit Skelett in Bildgröße (AC-25)
        |   +-- AnswerOption x4    Zustände: unbeantwortet / richtig / falsch / nicht gewählt
        |   +-- „Weiter zum Ergebnis" erscheint erst nach der Auflösung (AC-6)
        +-- LoadErrorCard                          Zustand „Frage nicht ladbar"
        |   +-- innerhalb der Quiz-Karte, nie ganzseitig (AC-16)
        |   +-- „Erneut versuchen" (unbegrenzt) + „Runde beenden"
        +-- ResultView                             Zustand „beendet"
            +-- Serie gross, Zeit darunter (AC-7)
            +-- „Neue persönliche Bestleistung" mit `pop`, wenn geschlagen (AC-8)
            +-- Gewinner-Meldung statt Fehlermeldung, wenn der Pool leer ist (EC-2)
            +-- Hinweis „noch nicht gespeichert" + erneuter Versuch, falls das Speichern scheitert (EC-3)
            +-- Primär „Nochmal spielen", sekundär „Zur Bestenliste"
```

**Der Rundenzustand ist eine Zustandsmaschine** in `QuizScreen`. Die Zustände und die erlaubten Übergänge:

```
bereit --"Runde starten"--> lädt --Frage da--> offen
lädt --nach 5s + einem stillen Versuch fehlgeschlagen--> fehler
offen --richtig--> lädt/offen (nächste Frage, meist schon vorgeladen)
offen --falsch--> aufgelöst --Klick--> beendet
offen --Pool leer--> beendet (Gewinner-Meldung)
fehler --"Erneut versuchen" erfolgreich--> offen
fehler --"Runde beenden"--> beendet
beendet --"Nochmal spielen"--> bereit
```

Kein Übergang führt aus `beendet` zurück in `offen` — eine beendete Runde ist unveränderlich, so wie ihre Zeile in der Datenbank.

## Data Model

### Neue Tabelle: `runs`

```
Jede beendete Runde hat:
- Eindeutige ID              fortlaufende Ganzzahl, Primärschlüssel
- Gehört zu                  genau einem Profil (Verweis auf profiles.id);
                             wird das Profil gelöscht, verschwindet die Runde mit (AC-26)
- Serie                      kleine Ganzzahl, Pflichtfeld, 0 bis 386 einschliesslich (AC-12)
- Dauer in Millisekunden     Ganzzahl, Pflichtfeld, mindestens 0 und mindestens
                             500 x Serie (AC-12)
- Runden-Kennzeichen         UUID, Pflichtfeld, projektweit eindeutig — vom Browser beim
                             Rundenstart erzeugt, macht das Speichern wiederholbar (EC-4)
- Erstellt am                Zeitstempel, automatisch gesetzt

Besitz: gehört dem Profil, das die Runde gespielt hat.

Zugriff:
- Lesen:    ausschliesslich die eigenen Runden. Kein angemeldeter Nutzer kann die Runden
            eines anderen abfragen — auch nicht direkt an der Oberfläche vorbei.
- Anlegen:  angemeldete Nutzer, und nur für das eigene Profil (AC-14).
- Ändern / Löschen: niemand. Eine Runde ist unveränderlich; gelöscht wird sie nur
            mittelbar, wenn das Profil verschwindet.

Aufbewahrung: bis zur Kontolöschung. Der Löschmechanismus selbst ist PROJ-4; die
Datenbank ist hier so gebaut, dass er nichts vergessen kann.

Bewusst nicht gespeichert: keine IP-Adresse, kein Frage- oder Antwortverlauf, keine
Geräte- oder Browserdaten (AC-27).
```

**Zugriffs-Entscheidung, die vom app-weiten Datenmodell abweicht.** `docs/data-model.md` beschrieb `runs` bisher als „von allen angemeldeten Nutzern lesbar (das ist die Rangliste)". Genau das würde aber der Zusage widersprechen, die im selben Dokument steht: *„Schlechte Runden sind privat."* Wäre die Tabelle für alle lesbar, könnte jeder Angemeldete die vollständige Rundenhistorie jedes anderen Spielers abfragen — die Rangliste zeigt zwar nur den besten Lauf, die Datenbank gäbe aber alles heraus. Deshalb: **Lesen nur eigene Runden.** Die Weltrangliste in PROJ-3 liest nicht direkt aus der Tabelle, sondern durch eine dafür gebaute Datenbankfunktion, die ausschliesslich den besten Lauf pro Spieler zurückgibt. `docs/data-model.md` ist entsprechend aktualisiert.

### Index

Ein einziger zusammengesetzter Index über `(Profil, Serie absteigend, Dauer aufsteigend)`. Er bedient drei Dinge gleichzeitig: die persönliche Bestleistung in AC-8, das Löschen der Runden beim Entfernen eines Profils (AC-26) und später die Ranglisten-Abfrage von PROJ-3 („bester Lauf pro Spieler"). Ein separater Index auf die Profil-Spalte ist damit überflüssig.

### Unverändert

`profiles` und `auth.users` bleiben, wie PROJ-1 sie angelegt hat. Dieses Feature ändert dort nichts und legt keine Pokémon-Entität an — Bilder und Namen bleiben externe Daten mit einem verwerfbaren Zwischenspeicher davor.

## Behaviors & Access

```
Nächste Frage holen (Server Action, nur angemeldet)
- Bekommt: die Liste der in dieser Runde bereits gezeigten Pokémon-Nummern
- Zieht eine noch nicht gezeigte Nummer aus 1–386 als Lösung, dazu drei weitere
  Nummern als falsche Optionen — alle vier voneinander verschieden (AC-3, AC-5)
- Holt für alle vier den deutschen Namen von der PokeAPI und mischt die Reihenfolge
- Liefert zurück: Nummer und Bildadresse des gesuchten Pokémon, die vier Namen,
  und welcher davon der richtige ist
- Fehlt für ein gezogenes Pokémon der deutsche Name, wird es verworfen und ein
  anderes gezogen — serverseitig, ohne dass der Browser davon erfährt (EC-5)
- Sind alle 386 Nummern verbraucht, meldet die Aktion „Pool leer" statt einer Frage (EC-2)
- Gibt nach 5 Sekunden ohne vollständige Antwort auf; genau ein stiller Wiederholungs-
  versuch, danach die Rückmeldung „nicht ladbar" (AC-15, AC-16, EC-8)
- Abgelehnt, wenn: keine gültige Sitzung besteht (EC-7)

Rundenergebnis speichern (Server Action, nur angemeldet)
- Bekommt: Serie, Dauer in Millisekunden, Runden-Kennzeichen
- Serverseitig geprüft, bevor irgendetwas geschrieben wird (AC-12):
  Serie ganzzahlig 0–386 · Dauer ganzzahlig >= 0 · Dauer >= 500 x Serie
- Schreibt die Zeile immer für das Profil aus der Sitzung, nie für ein übergebenes
  Profil (AC-14)
- Kommt dasselbe Runden-Kennzeichen ein zweites Mal an, entsteht keine zweite Zeile;
  die Aktion meldet trotzdem Erfolg (EC-4)
- Abgelehnt, wenn: keine gültige Sitzung (EC-7) · die Prüfung scheitert (AC-12)

Persönliche Bestleistung lesen (Server-Komponente, nur angemeldet)
- Liefert den besten eigenen Lauf: höchste Serie, bei Gleichstand kürzeste Zeit
- Liest ausschliesslich eigene Runden — die Zugriffsregel der Datenbank lässt nichts
  anderes zu (AC-8)

Bilder ausliefern (Bild-Optimierung des Frameworks, keine eigene Route)
- Der Browser fragt ausschliesslich die eigene Domain an; der Server holt das Bild
  vom CDN und liefert es verkleinert und umgewandelt aus (AC-20)

Bildadresse beschaffen — vierstufige Leiter, jede Stufe nur bei Fehlschlag der vorigen
- Die Prüfung läuft im Vorladen der nächsten Frage (AC-10), also unsichtbar, während
  der Spieler noch die aktuelle Frage beantwortet. Eine Frage gilt erst als vorgeladen,
  wenn ihr Bild geladen ist — dadurch startet die Uhr nie über einem kaputten Bild
  (AC-2 knüpft den Uhrenstart ohnehin an das sichtbare Bild)
  1. Adresse aus der Pokémon-Nummer gebildet. Normalfall, keine Zusatzanfrage
  2. Antwortet die nicht mit einem Bild: `/pokemon/{id}` wird abgefragt und die dort
     hinterlegte offizielle Adresse verwendet. Kostet eine Anfrage, nur im Fehlerfall,
     und danach liegt auch sie im Zwischenspeicher. Der Spieler merkt nichts
  3. Liefert auch die kein Bild: Die Frage wird verworfen und eine neue gezogen (EC-6).
     Das ist der Fall „einzelnes Pokémon kaputt"
  4. Drei verworfene Fragen hintereinander: Das ist kein einzelnes kaputtes Pokémon mehr,
     sondern eine gebrochene Quelle. Die Runde geht in den Fehlerzustand aus AC-16 —
     Fehlerkarte in der Quiz-Karte, Uhr steht, Serie bleibt, „Erneut versuchen" und
     „Runde beenden". Ohne diese Grenze würde EC-6 endlos Fragen durchdrehen und wie
     ein Hänger aussehen statt wie ein Fehler
- **Kein Platzhalterbild.** Ein Quiz, das nach dem Bild fragt, kann keine Frage mit einem
  Ersatzbild stellen — die Frage wäre unbeantwortbar. Deshalb wird verworfen, nicht ersetzt

Rechts-Links in der Fusszeile
- Die Fussleiste führt eine Liste der vorhandenen Rechts-Seiten. Sie ist derzeit leer,
  weil PROJ-4 die Seiten noch nicht gebaut hat — die Fussleiste rendert dann keinen Link
  statt eines toten (AC-23). PROJ-4 trägt die Seiten dort ein.
```

**Sämtlicher Verkehr zur PokeAPI läuft über den Server, nicht nur der für Bilder.** AC-20 verlangt das ausdrücklich nur für Bilder; würde der Browser die Namen selbst holen, ginge seine IP-Adresse trotzdem an einen Nicht-EU-Dienst. Beides serverseitig zu holen ist derselbe Aufwand und schliesst die Lücke.

## Dependencies

**Keine neuen Pakete.** Alles, was dieses Feature braucht, ist bereits installiert:

- `next/image` (Teil von `next`) — liefert die Bilder über die eigene Domain aus und bringt den serverseitigen Bild-Zwischenspeicher mit (AC-20, AC-31)
- `zod` (vorhanden) — serverseitige Prüfung der Rundenergebnisse an der Server-Action-Grenze (AC-12)
- `@supabase/ssr` (vorhanden) — Sitzung und Datenbankzugriff in Server Actions und Server-Komponenten
- shadcn/ui `Button`, `Card`, `Skeleton`, `Avatar`, `Badge` (vorhanden) — keine neue UI-Komponente nötig

## Settings the user makes

**Keine.** Dieses Feature braucht keine Einstellung in einem Anbieter-Dashboard — Zwischenspeicher und Bild-Auslieferung werden in `next.config.ts` konfiguriert und sind damit ganz normale Aufgaben für `/build`.

Ein Hinweis fürs spätere `/deploy`, keine Aufgabe: Die serverseitige Bild-Optimierung wird auf manchen Hosting-Tarifen nach optimierten Bildern abgerechnet. Bei einem Pool von 386 Pokémon und einer Bildgrösse ist die Obergrenze 386 optimierte Bilder insgesamt — nicht pro Nutzer. Das bleibt in jedem kostenlosen Tarif unauffällig.

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| Bild-Auslieferung über `next/image` mit freigeschaltetem Bild-Host statt einer selbst gebauten Proxy-Route | Erfüllt AC-20 durch Konfiguration statt durch Code: Der Browser fragt nur `/_next/image?…` auf unserer eigenen Domain an, der Server holt vom CDN. Bringt den serverseitigen Bild-Zwischenspeicher gleich mit (AC-31) und verkleinert die Bilder obendrein — die Originale sind rund 110 KB grosse PNGs, geprüft an den Nummern 25 und 386 | Eigene Route, die das Bild durchreicht | Wir sind an die Zwischenspeicher-Regeln des Frameworks gebunden (Ablauf einstellbar, gezieltes Verwerfen einzelner Bilder nicht vorgesehen). Für Pokémon-Bilder, die sich praktisch nie ändern, ist das ohne Bedeutung | 2026-09-01 |
| Bildadresse wird aus der Pokémon-Nummer gebildet — als **schneller Weg mit Rückfallebene**, nicht als einzige Quelle | Halbiert die Anfragen an die PokeAPI: pro Frage vier Namensabfragen statt vier Namens- **und** vier Detailabfragen. Die Detailantwort ist mit über 100 KB die grösste des ganzen Dienstes und enthält fast nur Daten, die wir nie anzeigen. Das ist genau die „Anfragehäufigkeit gering halten"-Bitte der Fair-Use-Policy, und es hilft AC-2 (Start unter 3 Sekunden). **Der ganze Pool wurde am 2026-09-01 vollständig geprüft, nicht stichprobenartig: 386/386 Bilder über die gebildete Adresse erreichbar, 386/386 deutsche Namen vorhanden.** Es gibt also keine Nummer, die dauerhaft aus dem Pool ausgeschlossen werden müsste — wäre eine gefunden worden, würde sie hier stehen | Ausschliesslich `/pokemon/{id}` abfragen und die Adresse daraus lesen — der offiziell dokumentierte Weg | **Bewusst akzeptiertes Risiko: Wir hängen an einem Adressmuster, das die PokeAPI nirgends als Schnittstelle zusagt.** Ändert sie die Ablage ihrer Bilder, schlägt das nicht bei einem Pokémon fehl, sondern bei allen gleichzeitig und ohne Vorwarnung. Tragfähig ist die Entscheidung nur wegen der Rückfallebene: Stufe 2 der Leiter (siehe Behaviors & Access) holt die offizielle Adresse aus `/pokemon/{id}`, sobald die gebildete kein Bild liefert. Der schlimmste Fall ist damit nicht „alle Bilder kaputt", sondern „eine Zusatzanfrage pro Pokémon" — also exakt der Zustand, den die Alternative von vornherein hätte. Das Risiko ist Mehrverbrauch, kein Ausfall | 2026-09-01 |
| Nach drei hintereinander verworfenen Fragen wird auf den Fehlerzustand aus AC-16 umgeschaltet (jetzt als EC-10 in `spec.md`) | EC-6 verwirft ein nicht ladbares Bild und zieht ein neues — richtig für ein einzelnes kaputtes Pokémon, aber ohne Grenze wird daraus bei einem grossflächigen Ausfall eine Endlosschleife, die für den Spieler wie ein Hänger aussieht statt wie ein Fehler. Drei kosten unter einer Sekunde, weil ein fehlendes Bild sofort antwortet; der langsame Fall ist bereits durch AC-15 gedeckelt. Da der Pool vollständig geprüft ist, federt die Zahl keine bekannte Lücke ab, sondern spätere Änderungen an der Bildablage | Zwei statt drei; oder unbegrenzt neu ziehen | Bei einer sehr schlechten Verbindung kann die Fehlerkarte etwas früher erscheinen als nötig — sie ist mit „Erneut versuchen" aber folgenlos | 2026-09-01 |
| Namensabfragen werden ausdrücklich zwischengespeichert (30 Tage), nicht dem Standardverhalten überlassen | **In der eingesetzten Framework-Version werden externe Abfragen standardmässig nicht zwischengespeichert** — geprüft in der mitgelieferten Dokumentation von Version 16.3.3. Eine beiläufig geschriebene Abfrage erfüllt AC-31 also nicht, und man sieht ihr das nicht an. Deutsche Namen ändern sich praktisch nie, 30 Tage sind unbedenklich | Auf ein Standardverhalten vertrauen, das es nicht mehr gibt | Ein nachträglich in der PokeAPI korrigierter Name erscheint bis zu 30 Tage später bei uns | 2026-09-01 |
| Kein Zwischenspeicher-Schlüssel enthält eine Nutzerkennung | Der Namensspeicher wird über die Adresse der Anfrage angesprochen, der Bildspeicher über Adresse und Bildgrösse. In keinem der beiden kommt der Nutzer vor — damit kann aus dem Zwischenspeicher grundsätzlich keine Historie „wer hat wann was gesehen" entstehen (AC-28), und beide wirken spielerübergreifend, wie AC-31 es verlangt | Pro Sitzung zwischenspeichern | Keiner — die nutzerlose Variante ist zugleich die datensparsamere und die wirksamere | 2026-09-01 |
| Fragen werden vollständig serverseitig zusammengestellt; der Browser schickt nur die Liste der schon gezeigten Nummern | Ein Roundtrip pro Frage statt mehrerer. Fehlt ein deutscher Name (EC-5), zieht der Server intern neu, ohne dass der Browser eine zweite Runde dreht. Ausserdem bleibt so aller Verkehr zur PokeAPI serverseitig, was über AC-20 hinaus auch die Namensabfragen abdeckt | Browser zieht die Nummern selbst und fragt nur die Namen nach | Der Server muss die Ausschlussliste bei jeder Frage entgegennehmen. Bei höchstens 386 Zahlen ist das unerheblich | 2026-09-01 |
| Der Browser erfährt, welche Antwort richtig ist | AC-4 und AC-6 verlangen die sofortige farbliche Rückmeldung ohne Wartezeit, und `docs/design-system.md` macht die Antwort-Zustände zum „zentralen Moment des Produkts". Eine Serverabfrage pro Antwort würde jeder Antwort spürbare Verzögerung geben | Jede Antwort serverseitig auswerten | **Damit ist die Plausibilitätsprüfung eine Formprüfung, keine Wahrheitsprüfung**: Wer die Browser-Konsole benutzt, kann ein formal mögliches Ergebnis erfinden (höchstens Serie 386 in mindestens 193 Sekunden). Das ist genau der Rest-Missbrauch, den `spec.md` bewusst akzeptiert — hier ausdrücklich benannt, damit niemand die Prüfung für mehr hält, als sie ist | 2026-09-01 |
| Doppeltes Speichern wird durch ein vom Browser erzeugtes Runden-Kennzeichen verhindert, das in der Datenbank eindeutig sein muss | Die Datenbank selbst weist die zweite Zeile ab — unabhängig davon, ob der zweite Versuch aus einem Doppelklick, dem Wiederholungsversuch aus EC-3 oder einer doppelt gesendeten Anfrage stammt. Anwendungscode, der vorher nachschaut, hätte zwischen Nachschauen und Schreiben eine Lücke (EC-4) | Vor dem Schreiben prüfen, ob schon eine gleiche Zeile existiert | Eine zusätzliche Spalte, die fachlich nichts bedeutet. Sie ist der Preis für eine Garantie, die auch unter gleichzeitigen Anfragen hält | 2026-09-01 |
| Die Grenzen aus AC-12 stehen zusätzlich als Regeln in der Datenbank, nicht nur in der Server Action | Zwei unabhängige Prüfungen, wie es `.claude/rules/security.md` verlangt. Fällt die Prüfung in der Anwendung durch einen späteren Umbau weg, weist die Datenbank ein unmögliches Ergebnis weiterhin ab | Nur in der Server Action prüfen | Eine Änderung der Grenzen (etwa der 0,5-Sekunden-Wert aus den Open Questions) braucht dann eine Datenbank-Änderung, nicht nur eine Codezeile | 2026-09-01 |
| Runden sind nur für den eigenen Besitzer lesbar; die Rangliste bekommt in PROJ-3 eine eigene Datenbankfunktion | Setzt die Zusage „schlechte Runden sind privat" aus `docs/data-model.md` tatsächlich durch. Eine für alle lesbare Tabelle würde jedem Angemeldeten die vollständige Historie jedes Spielers offenlegen, auch wenn die Oberfläche nur den besten Lauf zeigt | Lesen für alle Angemeldeten freigeben, wie ursprünglich im Datenmodell skizziert | PROJ-3 kann die Tabelle nicht direkt abfragen und braucht die Funktion. Das ist Mehraufwand dort — aber der richtige Ort dafür | 2026-09-01 |
| Die Uhr läuft im Browser und wird beim Rundenende mitgeschickt | Die Uhr muss flüssig weiterlaufen und bei einem Ausfall stehenbleiben (AC-16) — beides ist Anzeigeverhalten. Eine serverseitige Zeitmessung wäre nur dann echt überprüfbar, wenn auch jede Antwort über den Server liefe, was oben bewusst verworfen wurde | Start- und Endzeitpunkt serverseitig festhalten | Die Zeit ist manipulierbar, im selben Rahmen wie die Serie. Die untere Schranke aus AC-12 begrenzt den Unsinn | 2026-09-01 |
| Kopfzeile und Fussleiste sitzen im Wurzel-Layout, nicht in den einzelnen Seiten | AC-21 bis AC-23 verlangen denselben Rahmen auf jeder Route, angemeldet wie ausgeloggt. Im Wurzel-Layout ist das eine Stelle statt vier, und PROJ-3 und PROJ-4 erben ihn, ohne etwas zu tun | Jede Seite rendert ihren Rahmen selbst | Das Wurzel-Layout liest die Sitzung und ist damit auf jeder Route dynamisch. Durch PROJ-1s Routenschutz ist ohnehin keine Route statisch | 2026-09-01 |

## Open Questions

- [ ] Der Bild-Zwischenspeicher des Frameworks liegt beim Hoster und überlebt ein neues Deploy je nach Anbieter nicht. Nach dem ersten `/deploy` einmal prüfen, ob nach einer Neuveröffentlichung die ersten Fragen spürbar langsamer sind — falls ja, ist die Ablaufzeit der richtige Hebel, nicht der Aufbau.
- [ ] AC-31 ist auf Anfragen zur PokeAPI hin gebaut, nicht auf Datenmengen. Sollte die Bild-Optimierung auf dem gewählten Tarif doch abgerechnet werden, ist das bei `/deploy` zu prüfen — die Obergrenze von 386 Bildern insgesamt steht oben.
