# PROJ-2 — Tech Design

> Der technische Entwurf (das WIE). Zwei Leser: der Produktverantwortliche, der ihn abnimmt, und `/build`, das dagegen baut. Kein Code — aber genau genug, dass niemand raten muss.
> Der Vertrag (das WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`. Der Status lebt ausschließlich in `features/INDEX.md`.
>
> **Neu entworfen am 2026-09-06** nach `/refine PROJ-2` (serverseitig geführte Runde, AC-32 bis AC-41). Der abgelöste Entwurf vom 2026-09-01 steht vollständig unter „Historie" am Ende — er wird nicht gelöscht, weil `qa-report.md` und `features/INDEX.md` auf seine Befunde verweisen.

## Component Structure

```
Wurzel-Layout (src/app/layout.tsx) — die App-Shell, gehört diesem Feature
+-- PageFrame                     Kopfzeile + Inhalt + Fußzeile, umschließt jede Route
    +-- SiteHeader                unverändert (AC-21, AC-22, AC-24)
    +-- {children}
    +-- SiteFooter                unverändert (AC-23)

/ (Route „Spiel", nur angemeldet)
+-- page.tsx (Server-Komponente)  lädt die persönliche Bestleistung und reicht sie hinein
    +-- QuizScreen (Client-Komponente — hält ab jetzt NUR NOCH ANZEIGE-Zustand)
        +-- StartView                              Zustand „bereit" (AC-1)
        +-- QuestionView                           Zustände „offen" / „wartet" / „aufgelöst"
        |   +-- StatusBar: StreakBadge (zeigt den vom Server gemeldeten Stand)
        |   |               + RoundClock (reine Anzeigeuhr, siehe unten)
        |   +-- PokemonImage  → /api/question/{token}/image   (AC-20, AC-32)
        |   +-- AnswerOption x4  — Färbung erst, wenn das Urteil des Servers da ist
        |   +-- „Weiter zum Ergebnis" nach der Auflösung (AC-6)
        +-- NextQuestionPreloader                  unsichtbar; lädt das Bild der
        |                                          vorbereiteten Frage (AC-10)
        +-- LoadErrorCard                          Fehlerzustand (AC-16, EC-10)
        +-- ResultView                             Ergebnis (AC-7, AC-8, EC-2, EC-3)
```

**Was sich gegenüber dem alten Aufbau ändert:** `QuizScreen` besaß bisher die Wahrheit — Serie, Uhr, Lösung. Ab jetzt besitzt er nur noch die **Darstellung**. Serie, Zeit und richtige Antwort kommen mit jeder Serverantwort mit; der Browser hält sie, um sie anzuzeigen, nicht um sie zu berechnen.

**Zustandsmaschine der Anzeige** — ein Zustand ist neu (`wartet`):

```
bereit --„Runde starten"--> lädt --Frage + Bild da--> offen
offen --Klick auf eine Option--> wartet
wartet --Urteil „richtig"--> offen        (nächste Frage lag vorgeladen bereit)
wartet --Urteil „richtig", keine nächste Frage--> fehler
wartet --Urteil „falsch"--> aufgelöst --Klick--> beendet
wartet --Urteil „Pool leer"--> beendet    (Gewinner-Meldung, EC-2)
lädt   --nichts ladbar--> fehler
fehler --„Erneut versuchen" erfolgreich--> offen
fehler --„Runde beenden"--> beendet
beendet --„Nochmal spielen"--> lädt       (direkt in die neue Runde, AC-9)
```

`wartet` dauert einen Roundtrip zum eigenen Server — keine PokeAPI-Anfrage, die Lösung liegt im Rundenzustand. In diesem Zustand ist die geklickte Option optisch gedrückt, aber **noch nicht gefärbt**: Die Farbe ist die Antwort des Servers, nicht eine Vermutung des Browsers.

**Die angezeigte Uhr ist Anzeige, nicht Messung** (AC-2, AC-34). Sie läuft lokal weiter, damit sie flüssig aussieht, und hält an, wenn keine Frage offen ist. Auf dem Ergebnis-Screen steht die **servergemessene** Zeit — die beiden dürfen um die Netzlatenz auseinanderliegen (EC-13), und der Ergebnis-Screen zeigt die maßgebliche.

## Data Model

### Neue Tabelle: `active_runs` — der laufende Rundenzustand

```
Jede laufende Runde hat:
- Gehört zu / Primärschlüssel   die Profil-ID (Verweis auf profiles.id).
                                Profil-ID IST der Primärschlüssel — dadurch ist
                                „höchstens eine laufende Runde je Spieler" (AC-36)
                                eine Eigenschaft der Tabelle und keine Prüfung im
                                Code, die man vergessen kann.
                                Wird das Profil geloescht, verschwindet die Zeile
                                mit (AC-40, ON DELETE CASCADE).
- Runden-Kennzeichen            UUID, Pflicht, eindeutig. Vom SERVER erzeugt
                                (frueher vom Browser). Wandert beim Rundenende in
                                die runs-Zeile und macht das Schreiben
                                wiederholbar (EC-3, EC-4).
- Gezogene Nummern              Liste kleiner Ganzzahlen, Pflicht, hoechstens 386
                                Eintraege, jeder Wert 1..386. Enthaelt jede Nummer,
                                die in dieser Runde schon Loesung war (AC-5) oder
                                verworfen wurde (EC-5, EC-6).
- Serienstand                   kleine Ganzzahl, Pflicht, 0..386, Start 0.
- Aufsummierte Zeit             Ganzzahl in Millisekunden, Pflicht, >= 0, Start 0.
                                Waechst bei jeder angenommenen Antwort um das
                                gemessene Intervall (AC-34).
- Aktuelle Frage (vier Felder, immer gemeinsam gesetzt oder gemeinsam leer):
    Loesung                     kleine Ganzzahl 1..386
    Richtige Position           kleine Ganzzahl 0..3 — welche der vier Optionen
    Frage-Token                 UUID, eindeutig — die einzige Kennung, die der
                                Browser von dieser Frage kennt (AC-32)
    Ausgabezeitpunkt            Zeitstempel — Startpunkt der Messung (AC-34)
                                Alle vier leer = gerade ist keine Frage offen
                                (Fehlerzustand AC-16; die Uhr steht dann von
                                selbst, weil kein Intervall laeuft).
- Vorbereitete naechste Frage (drei Felder, gemeinsam gesetzt oder gemeinsam leer):
    Loesung, Richtige Position, Frage-Token — wie oben, aber OHNE Zeitpunkt:
    Sie zaehlt erst, wenn sie aktuell wird. Sie existiert, damit der Browser ihr
    Bild vorladen kann, ohne etwas zu erfahren (AC-10, AC-32).
- Zuletzt beruehrt              Zeitstempel, bei jeder Aenderung neu gesetzt.
                                Grundlage der 2-Stunden-Frist (AC-41).

Besitz: gehoert dem Spieler, dessen Profil-ID der Primaerschluessel ist.

Zugriff — der wichtigste Punkt dieses Entwurfs:
- Row Level Security ist eingeschaltet und es gibt KEINE EINZIGE POLICY.
  Damit ist die Tabelle ueber die oeffentliche Datenschnittstelle fuer niemanden
  les- oder schreibbar — auch nicht fuer ihren eigenen Besitzer.
- Erreichbar ist sie ausschliesslich ueber Datenbankfunktionen mit erhoehten
  Rechten, die nur `service_role` ausfuehren darf; der Server ruft sie mit dem
  vorhandenen Administrationszugang (src/lib/supabase/admin.ts).
- Grund: Die Zeile enthaelt die Loesung. Duerfte der Spieler „nur seine eigene"
  Zeile lesen, koennte er mit dem oeffentlichen Zugangsschluessel und seiner
  eigenen Sitzung die Antwort abfragen, bevor er klickt — AC-32 waere auf der
  Datenebene gebrochen, waehrend die Anwendung sie brav verschweigt.
  Dasselbe Muster nutzt bereits `auth_throttle` (Migration 0003).

Aufbewahrung: drei unabhaengige Loeschwege — Rundenende (AC-39), 2 Stunden ohne
Beruehrung (AC-41), Profilloeschung (AC-40). Kein vierter Weg noetig, keiner der
drei haengt am Verkehr anderer Spieler.
```

### Änderungen an `runs`

```
- Spalte `client_round_id` heisst kuenftig `round_id`. Der Name war eine Aussage
  ueber die Herkunft („vom Client erzeugt") und die stimmt nicht mehr. Eindeutig
  bleibt sie — das ist weiterhin die Garantie hinter EC-4.
- Der Constraint `runs_duration_plausible` (Dauer >= Serie x 500 ms) FAELLT.
  AC-12 hat ihn abgeschafft, weil AC-34 ihn abloest: Er wuerde jetzt nur noch
  eine echt gespielte, schnelle Runde abweisen. Die beiden anderen Constraints
  (Serie 0..386, Dauer >= 0) bleiben als zweite, unabhaengige Schranke.
- Sonst unveraendert: Besitz, Index, Policies (AC-14 bleibt zweifach abgesichert).
```

### Unverändert

`profiles` und `auth.users` bleiben, wie PROJ-1 sie angelegt hat. Es entsteht weiterhin keine Pokémon-Entität — Bilder und Namen bleiben externe Daten mit einem verwerfbaren Zwischenspeicher davor (AC-31, AC-37).

## Behaviors & Access

Alle Vorgänge verlangen eine gültige Sitzung; ohne sie werden sie abgewiesen und der Browser landet auf `/login` (EC-7). Die Profil-ID stammt **immer** aus der Sitzung, nie aus einem Aufrufparameter (AC-14).

```
Runde starten (Server Action)
- Legt den Rundenzustand fuer dieses Profil an und ERSETZT einen vorhandenen.
  Die alte Runde ist damit weg und wurde nicht gespeichert (AC-36, EC-9, EC-15).
- Zieht die erste Frage: eine Loesung aus 1..386, drei verschiedene Distraktoren,
  holt die vier deutschen Namen, mischt sie (AC-3), erzeugt ein Frage-Token,
  setzt den Ausgabezeitpunkt.
- Bereitet ausserdem gleich die zweite Frage vor (ohne Zeitpunkt).
- Gibt zurueck: die vier Optionen und das Frage-Token der ersten Frage, dazu
  Optionen und Token der vorbereiteten zweiten. NICHT die Pokemon-Nummer und
  NICHT, welche Option richtig ist (AC-32).
- Fehlt fuer ein gezogenes Pokemon der deutsche Name, zieht der Server intern
  neu, ohne dass der Browser davon erfaehrt (EC-5).
- Sind alle 386 verbraucht: „Pool leer" (EC-2).

Antwort abgeben (Server Action) — der Kern
- Bekommt: das Frage-Token und die gewaehlte Position (0..3). Sonst nichts.
- Die Datenbank fuehrt in EINEM Schritt aus:
    * findet die Zeile dieses Profils, DEREN aktuelles Token genau das
      uebergebene ist. Passt es nicht, ist die Antwort wirkungslos — das ist
      zugleich die Garantie fuer EC-1 (zweiter Klick) und EC-15 (zweiter Tab).
    * misst das Intervall Ausgabezeitpunkt -> jetzt und addiert es auf die
      Summe (AC-34). Gemessen wird mit der Uhr der Datenbank, nicht mit der
      des Anwendungsservers — eine Uhr statt zweier.
    * vergleicht Position mit der gespeicherten richtigen Position (AC-33).
    * richtig: Serie + 1; die vorbereitete Frage rueckt nach und bekommt JETZT
      ihren Ausgabezeitpunkt; die aktuelle Frage wird geleert.
    * falsch oder Pool leer: schreibt die runs-Zeile aus Serie und Zeitsumme
      des Zustands (AC-11, AC-35) und meldet das Ergebnis zurueck.
- Gibt zurueck: richtig/falsch, die richtige Position (jetzt darf der Browser
  sie erfahren — AC-6), den neuen Serienstand, und bei Rundenende Serie, Zeit
  und ob es eine persoenliche Bestleistung ist (AC-8).
- Abgelehnt, wenn: keine Sitzung (EC-7) · Token passt nicht (EC-1, EC-15) ·
  Position ausserhalb 0..3 (Pruefung an der Grenze, wie ueberall).

Vorbereitete Frage ersetzen (Server Action)
- Der Browser meldet: „das Bild der vorbereiteten Frage laedt nicht" (EC-6).
- Der Server verwirft die vorbereitete Frage, merkt ihre Nummer als gezogen vor
  und bereitet eine neue vor. Die AKTUELLE Frage wird dabei nie angefasst —
  das ist die Umsetzung von EC-12 (kein Ueberspringen).
- Nach drei Ersetzungen in Folge ohne Erfolg meldet der Server „nicht ladbar",
  und der Browser zeigt die Fehlerkarte (EC-10, AC-16).

Vorbereitete Frage zur aktuellen machen (Server Action)
- Gebraucht, wenn der Spieler wartet: Nach einer richtigen Antwort lag keine
  vorbereitete Frage bereit, der Zustand hat also gerade keine offene Frage.
  Sobald der Browser eine neue vorbereitet und ihr Bild geprueft hat, rueckt sie
  nach — und **erst dann** beginnt ihr Ausgabezeitpunkt (AC-34).
- Befoerdert nur, wenn keine Frage offen ist: Eine angezeigte laesst sich damit
  nicht verdraengen. Idempotent, weil `submit_answer` bereits selbst befoerdert,
  wenn eine vorbereitete bereitlag.
- Der Grund, warum das ein eigener Schritt ist und keine Abkuerzung beim
  Vorbereiten: Eine Frage, die sofort als aktuelle entstuende, waere nach EC-12
  nicht mehr verwerfbar — laedt ihr Bild nicht, saesse die Runde fest.

Runde beenden (Server Action)
- Aus der Fehlerkarte heraus (AC-18): schreibt die runs-Zeile aus dem Zustand
  und loescht ihn. Idempotent — ein zweiter Aufruf meldet dasselbe Ergebnis
  und legt keine zweite Zeile an (EC-4).

Bild ausliefern (Route Handler, GET /api/question/{token}/image)
- Loest das Token ueber eine Datenbankfunktion zur Pokemon-Nummer auf, und zwar
  nur, wenn das Token zur laufenden Runde DIESES Nutzers gehoert — aktuelle
  oder vorbereitete Frage. Sonst 404.
- Holt das Sprite und reicht die Bytes durch. Der Browser sieht ausschliesslich
  die eigene Domain (AC-20), die Pokemon-Nummer taucht in keiner Adresse auf
  (AC-32).
- Antwort traegt `Cache-Control: private, max-age=3600, immutable`, damit das
  vorgeladene Bild beim Anzeigen ein Treffer im Browser-Cache ist und nicht
  zweimal uebertragen wird.
- Serverseitig wird das Sprite ueber SEINE CDN-Adresse zwischengespeichert,
  also ueber die Pokemon-Nummer — nicht ueber das wechselnde Token (AC-37).
  Dafuer dient derselbe Mechanismus, den die Namensabfragen schon nutzen.

Persoenliche Bestleistung lesen (Server-Komponente)
- Unveraendert: bester eigener Lauf, hoechste Serie, bei Gleichstand kuerzeste
  Zeit; liest ausschliesslich eigene Runden (AC-8).
```

**Was der Browser über eine Frage weiß:** vier Namen, ein Token, und nach seiner Antwort das Urteil. Nicht die Nummer, nicht die Lösung, nicht den Zusammenhang zwischen Token und Nummer.

## Dependencies

**Keine neuen Pakete.** Alles Nötige ist vorhanden:

- `@supabase/ssr` — Sitzung und Datenbankzugriff (bereits im Einsatz)
- der vorhandene Administrationszugang `src/lib/supabase/admin.ts` und `SUPABASE_SERVICE_ROLE_KEY` — bereits für die Anmelde-Drosselung in Gebrauch und in `.env.local.example` dokumentiert. **Keine neue Umgebungsvariable.**
- `zod` — Prüfung von Token und gewählter Position an der Grenze
- shadcn/ui `Button`, `Card`, `Skeleton`, `Avatar`, `Badge` — unverändert
- **Nicht mehr benutzt:** `next/image` für das Quizbild (Begründung in den Technical Decisions). Für alle anderen Bilder bleibt es.

## Settings the user makes

| Setting | Where | Value | Why | → AC |
| --- | --- | --- | --- | --- |
| `pg_cron` einschalten | Supabase → Database → Extensions → `pg_cron` | eingeschaltet | Ohne die Erweiterung läuft der Aufräum-Lauf nicht, und die Frist aus AC-41 wäre eine Absichtserklärung statt einer Zusage | AC-41 |
| Prüfen, dass das Projekt nicht wegen Inaktivität pausiert ist | Supabase → Project Settings | Projekt aktiv | Ein pausiertes Projekt führt keine zeitgesteuerten Läufe aus; Supabase pausiert ein Free-Tier-Projekt nach einer Woche ohne Nutzung. Praktisch harmlos — wer nicht spielt, hinterlässt auch keinen Rundenzustand —, aber es gehört benannt statt angenommen | AC-41 |

**Zur ersten Zeile:** `/build` schaltet die Erweiterung per Migration ein. Nur falls das gehostete Projekt das dem Migrationslauf verweigert, wird daraus eine Handarbeit im Dashboard — deshalb steht sie hier. `/deploy` prüft gegen das echte Projekt, ob die Erweiterung vorhanden und der Job eingerichtet ist, und zwar unabhängig davon, welcher der beiden Wege ihn angelegt hat.

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| **Der Rundenzustand liegt in einer Tabelle, nicht in einem signierten Token beim Client** | Ein Token laesst sich zurueckspielen: falsch antworten, aus dem Urteil die Loesung lernen, den alten Stand erneut senden. Jede Abwehr dagegen braucht eine serverseitige Marke je Runde — dann kann man auch gleich den Zustand dort halten | Verschluesseltes, signiertes Zustands-Token beim Browser | Eine Tabelle mehr, drei Loeschwege statt keinem. Dafuer ist die Runde nicht zurueckspielbar | 2026-09-06 |
| **`active_runs` bekommt keine einzige RLS-Policy; Zugriff nur ueber Funktionen mit erhoehten Rechten, ausfuehrbar allein fuer `service_role`** | Die Zeile enthaelt die Loesung. Eine „nur der Eigentuemer liest seine Zeile"-Policy — der uebliche und hier falsche Reflex — gibt dem Spieler die Antwort, bevor er klickt: Der oeffentliche Zugangsschluessel plus seine eigene Sitzung genuegen. Dann waere AC-32 auf der Datenebene gebrochen, waehrend die Oberflaeche sie einhaelt. Das Projekt hat dieses Muster schon (`auth_throttle`, 0003; `is_trainer_name_taken`, 0006) | Eigentuemer-Policy wie bei `runs`; oder Spaltenrechte, die nur die Loesung verbergen | Die Spielzuege laufen ueber Datenbankfunktionen statt ueber Abfragen im Anwendungscode. Das ist mehr SQL — und zugleich der Ort, an dem die Regeln nicht durch einen spaeteren Umbau der Server Action verlorengehen | 2026-09-06 |
| **Die Profil-ID ist der Primaerschluessel von `active_runs`** | Macht „hoechstens eine laufende Runde je Spieler" (AC-36) zu einer Eigenschaft der Tabelle statt zu einer Pruefung, die man vergessen kann. Deckt damit EC-9 (Doppelklick) und EC-15 (zweiter Tab) mit ab, ohne eigene Logik | Eigener Schluessel plus eindeutiger Index auf die Profil-ID | Die Runden-ID ist nicht der Schluessel, sondern ein eindeutiges Nebenfeld. Fuer die Zugriffe hier ohne Bedeutung | 2026-09-06 |
| **Antwort pruefen = eine bedingte Aenderung auf das Frage-Token, in einem Schritt in der Datenbank** | Nennt die Garantie hinter drei Edge Cases auf einmal: Nur der erste Aufruf mit dem passenden Token findet die Zeile, weil derselbe Schritt das Token leert — jeder zweite Klick (EC-1) und jeder Aufruf aus einem verwaisten Tab (EC-15) laeuft ins Leere. Ein Pruefen-dann-Schreiben im Anwendungscode haette dazwischen eine Luecke | Lesen, im Server Action entscheiden, dann schreiben | Die Spielregel steht in einer Datenbankfunktion und nicht neben dem Rest der Spiellogik. Dafuer haelt sie auch unter gleichzeitigen Anfragen | 2026-09-06 |
| **Die Zeit misst die Datenbank (`jetzt` minus Ausgabezeitpunkt), nicht der Anwendungsserver** | Beide Enden des Intervalls kommen damit von derselben Uhr. Bei zwei Servern mit leicht verschiedener Zeit waeren Messfehler moeglich, die genau in der Groessenordnung des Tie-Breakers liegen | Zeitstempel in Node bilden | Die Messung ist an die Datenbank gebunden; sie ist ohnehin an jedem Schritt beteiligt | 2026-09-06 |
| **Die naechste Frage wird im Zustand vorbereitet, damit ihr Bild vorgeladen werden kann** | AC-10 verlangt die naechste Frage ohne sichtbaren Ladezustand, und mit verdeckter Adresse (AC-32) verraet das Vorladen nichts. Der Preis sind drei Felder mehr in der Zeile | Naechste Frage erst mit dem Urteil ausliefern | AC-10 waere gebrochen: nach jeder richtigen Antwort ein Skelett, waehrend das Bild laedt. **Nebenwirkung: Die Aufzaehlung in AC-38 kennt diese drei Felder noch nicht** — siehe Open Questions | 2026-09-06 |
| **Das Quizbild kommt aus einem eigenen Route Handler, roh, ohne die Bild-Optimierung des Frameworks** | Der Optimierer speichert nach Quell-Adresse zwischen. Die ist jetzt pro Frage verschieden, der Zwischenspeicher liefe also immer daneben — und auf manchen Tarifen wird je einmaliger Quell-Adresse abgerechnet, womit aus der bisherigen Obergrenze „386 Bilder insgesamt" eine je Frage wuerde. Die Wiederverwendung sichert stattdessen der serverseitige Zwischenspeicher auf die CDN-Adresse, also auf die Pokemon-Nummer (AC-37) | Bild-Optimierung mit eigenem Lader auf die Token-Adresse | Das Bild geht als PNG mit rund 110 KB an den Browser statt als verkleinertes WebP mit etwa 30 KB. Auf dem kritischen Pfad liegt nur die erste Frage einer Runde (AC-2), alle weiteren sind vorgeladen. Wenn AC-2 messbar leidet, ist der Hebel eine serverseitige Verkleinerung — siehe Open Questions | 2026-09-06 |
| **Die Bildantwort traegt `private, max-age=3600, immutable`** | Das vorgeladene Bild soll beim Anzeigen aus dem Browser-Cache kommen, nicht ein zweites Mal durch die Leitung. `private`, weil die Adresse an eine Sitzung gebunden ist und in keinem gemeinsamen Zwischenspeicher landen darf | Ohne Cache-Header ausliefern | Das Bild bleibt bis zu einer Stunde im Browser, obwohl das Token serverseitig schon tot ist. Harmlos: Der Spieler hat genau dieses Bild ohnehin gesehen | 2026-09-06 |
| **Die Byte-Laenge des Bildes bleibt ein Erkennungsmerkmal — bewusst nicht kaschiert** | Jedes Sprite hat eine eigene Groesse; wer die 386 Bilder besitzt, kann daran die Nummer erraten, ohne das Bild anzusehen. Das setzt aber genau dieselbe Vorarbeit voraus wie EC-14 (Bilderkennung) und macht den Angriff nicht billiger. Auffuellen auf eine Einheitsgroesse wuerde jede Frage verteuern und nur einen bereits akzeptierten Weg verschliessen | Alle Bilder auf gleiche Laenge auffuellen | Ein Seitenkanal bleibt offen — derselbe, den EC-14 bereits benennt und traegt | 2026-09-06 |
| **Der Aufraeum-Lauf ist ein zeitgesteuerter Datenbank-Job (pg_cron, alle 5 Minuten, Schwelle 110 Minuten), kein Aufraeumen beim naechsten Rundenstart** | Aus PROJ-1 gelernt: Beim verkehrsgetriebenen Abbau von `auth_throttle` muss `docs/privacy.md` einraeumen, dass er „keine feste Hoechstfrist zusagt". Ein Spieler, der nie zurueckkommt, erzeugt keinen Ausloeser. AC-41 verspricht eine Frist, also braucht es etwas, das ohne Verkehr laeuft. **Takt und Schwelle muessen zusammen unter zwei Stunden bleiben** — das ist der Punkt, an dem die erste Fassung dieses Entwurfs falsch war: Ein stuendlicher Takt gegen eine 2-Stunden-Schwelle laesst eine Zeile bis zu **drei** Stunden liegen (zwei bis sie faellig wird, bis zu eine weitere bis der naechste Lauf sie sieht) und haette AC-41 gebrochen. Gewaehlt: **alle 5 Minuten loeschen, was laenger als 110 Minuten unberuehrt ist** — schlimmster Fall rund 1 Stunde 55 Minuten, also innerhalb der Zusage, mit etwas Luft fuer einen ueberlangen Lauf. Der Lauf ist ein Loeschbefehl auf eine Tabelle mit hoechstens so vielen Zeilen wie gerade Spieler spielen; 288 Ausfuehrungen am Tag sind dafuer belanglos | Stuendlich mit 2-Stunden-Schwelle (verletzt AC-41); oder stuendlich mit 60-Minuten-Schwelle (haelt die Zusage, wirft aber eine pausierte Runde schon nach einer Stunde weg) | Ein Spieler, der eine Runde offen liegen laesst und nach mehr als 110 Minuten weiterklickt, findet sie geloescht vor. Das ist derselbe Fall, den AC-19 ohnehin beschreibt — die Runde ist dann verloren, nicht falsch gewertet | 2026-09-06 |
| **`runs.client_round_id` wird zu `runs.round_id`, und `runs_duration_plausible` faellt** | Der alte Name behauptet eine Herkunft, die nicht mehr stimmt (der Server vergibt das Kennzeichen). Der Constraint setzt die 0,5-Sekunden-Regel durch, die AC-12 abgeschafft hat — er wuerde jetzt nur noch echte schnelle Runden abweisen | Namen lassen, Constraint lassen | Eine Migration, die eine Spalte umbenennt und einen Constraint entfernt. Da noch nichts in Produktion laeuft, ist das folgenlos | 2026-09-06 |
| **Der Browser bekommt die richtige Position erst mit dem Urteil** | AC-4 und AC-6 verlangen die farbliche Rueckmeldung am Ort der Handlung; sie kommt jetzt einen Roundtrip spaeter. Kein PokeAPI-Aufruf noetig, die Loesung liegt im Zustand — der Weg ist so kurz, wie er sein kann | Loesung vorab mitschicken wie bisher | Die Faerbung folgt der Netzlatenz statt sofort zu erscheinen. Der geklickte Zustand wird deshalb sofort dargestellt, damit der Klick nicht ins Leere zu gehen scheint | 2026-09-06 |
| **Die Kopfzeile muss ab 320 px ohne Überlauf tragen — der Entwurf hat das nie zugesichert und tut es nicht** (AC-24 neu gefasst, AC-43, EC-16) | Der Entwurf ging von **zwei** Elementen rechts aus (Nutzer-Chip, „Abmelden") und hielt in `docs/app-shell.md` fest: „Bei zwei Bereichen passt beides in die Kopfzeile." Mit dem Bestenlisten-Zugang aus AC-21 sind es **drei**, und dann trägt die Zeile nicht mehr. **Am 2026-09-08 beim Bau von PROJ-3 gemessen** (Chromium-Mobilemulation, angemeldet): Die Kopfzeile braucht ab da konstant **375 px**. Bei 320 px war „Abmelden" zu 39 % sichtbar (35 von 90 px), bei 344 px zu 31 px abgeschnitten, bei 360 px zu 15 px; ab 375 px unauffällig. **Erschwerend:** Die Seite ließ sich nicht waagerecht scrollen — `scrollLeft` blieb 0, per Skript wie per Wischgeste. Der abgeschnittene Teil war also nicht erreichbar, nur der sichtbare Streifen war antippbar (nachgeprüft: Tipp auf x=310 meldete ab). Nicht betroffen: die Kernschleife (vier Antwortoptionen bei 320 px auf x 18…302) und die Ranglisten-Karte | Die Untergrenze auf 360 px oder 375 px legen und den Anschnitt tragen — verworfen, Begründung im Decision Log von `spec.md` | Der Fix gehört in die Kopfzeile und damit in dieses Feature, obwohl der Befund beim Bau von PROJ-3 entstand. **Auf `main` existiert der Überlauf noch nicht** — dort steht `LEADERBOARD_PAGE_EXISTS` auf `false`; er entsteht mit dem Merge von PROJ-3. Der Fix muss deshalb vor oder mit diesem Merge landen, sonst geht ein bekannter Mangel live | 2026-09-08 |
| **Die Wortmarke reduziert sich unter 400 px auf das Ball-Motiv; die beiden Knöpfe behalten ihre Beschriftung** (AC-21, AC-24) | **Das Budget lässt nichts anderes zu, nachgerechnet statt geschätzt.** Bei 320 px braucht die Kopfzeile 375 px, es fehlen also 55 px. Reines Enger-Setzen bringt sie nicht auf: Seitenpolsterung 18 → 10 px (−16), Abstände 12/8/8 → 8/6/6 (−8), beide Knöpfe `px-3` → `px-2` (−16), Beschriftungen 14 → 13 px (−12) — zusammen **52 px**, drei zu wenig und ohne jede Reserve für ein längeres Wort oder ein viertes Element. Die Wortmarke auf den Ball zu reduzieren bringt allein **75 px**. Sie ist außerdem das richtige Opfer: Ein Markenschriftzug trägt keine Handlung, und die Zielgruppe schließt laut `docs/PRD.md` Kinder ein, für die ein unbeschrifteter Knopf teurer wäre als eine fehlende Wortmarke. Es ist zudem **dieselbe Reduktionslogik, die die Shell schon benutzt** (Chip → Initiale unter 640 px), also kein neues Muster. Das Ball-Motiv steht ohnehin allein in den Leerzuständen | „Bestenliste" unter 400 px als reiner Symbol-Knopf (Pokal; `lucide-react` liegt im Projekt): spart 56 px, passt exakt ohne Reserve und käme ohne Vertragsänderung aus — verworfen, weil ein unbeschrifteter Knopf ausgerechnet die Zielgruppe trifft, die am wenigsten rät. Zweizeilige Kopfzeile unter 400 px: reduziert nichts, lässt die klebende Leiste aber von 64 auf ~104 px wachsen und frisst senkrechten Platz genau dort, wo Bild und vier Optionen ohnehin am knappsten sind | Der Markenschriftzug fehlt auf den schmalsten Geräten. **Nebenbei behoben:** Er bricht dort heute auf zwei Zeilen um (gemessen 110×51 px in einer 64 px hohen Leiste) — das sah niemand als Fehler, war aber einer | 2026-09-08 |

## Der Umbau der Kopfzeile — was genau zu bauen ist

_Nur dieser eine Bereich ist neu; der Rest des Entwurfs oben gilt unverändert._

**Die Zielgröße.** Bei 320 px Fensterbreite muss der Inhalt der Kopfzeile in 320 px passen, ohne dass die Seite waagerecht scrollt (AC-43). Heute braucht er 375 px.

**Drei Stufen, von breit nach schmal** — jede Stufe gilt zusätzlich zu den vorherigen:

| ab | was gilt |
|---|---|
| 640 px und breiter | unverändert wie heute: volle Wortmarke, Chip mit Initiale **und** Trainername, beide Knöpfe voll beschriftet |
| unter 640 px | der Nutzer-Chip zeigt nur noch die Initiale (**besteht bereits**) |
| unter 400 px | die Wortmarke zeigt nur noch das Ball-Motiv; der Schriftzug „Pokémon QUIZ" entfällt. Zusätzlich greifen die engeren Maße unten |

**Die engeren Maße unter 400 px** — sie sind der Puffer, nicht die Hauptmaßnahme:

- Seitenpolsterung der Kopfzeile: von 18 px auf 10 px je Seite. **Nur die Kopfzeile**, nicht der Inhaltsbereich — dessen `clamp(18px, 4vw, 44px)` bleibt, sonst kleben Ranglisten-Karte und Quizbild am Rand.
- Abstand Wortmarke ↔ Bedienleiste: 12 px auf 8 px.
- Abstände innerhalb der Bedienleiste: 8 px auf 6 px.
- Waagerechte Polsterung beider Knöpfe: 12 px auf 8 px je Seite.

**Zwei Grenzen, die dabei nicht unterschritten werden:**

- **Höhe der Knöpfe mindestens 36 px** (der heutige Wert). Die Sparmaßnahmen wirken ausschließlich waagerecht — eine flachere Trefferfläche wäre auf einem Touchgerät die falsche Ersparnis.
- **Schriftgröße der Beschriftungen mindestens 13 px.** Darunter beginnt das Lesbarkeitsproblem, das `docs/design-system.md` bei Sekundärtext ausdrücklich benennt.

**Was das Ball-Motiv leisten muss, wenn es allein steht:** Es bleibt der Link auf die Startseite und behält seine unsichtbare Beschriftung für Screenreader („Pokémon Quiz — Startseite"), die heute schon am Link hängt. Für einen Nutzer mit Screenreader ändert sich also nichts.

**Der Fehlerfall, der dabei nicht entstehen darf:** Die Reduktionsstufen dürfen nicht an die Länge des Trainernamens gekoppelt werden. Unter 640 px zeigt der Chip ohnehin nur die Initiale, die Breite der Kopfzeile ist damit **unabhängig vom Namen** — und genau das macht die Zusage aus AC-43 überhaupt prüfbar. Ein Aufbau, der den Namen unter 640 px wieder einblendet, bricht sie für lange Namen und hält sie für kurze; ein solcher Fehler fällt im Test mit „Ash" nie auf.

## Open Questions

- [ ] **AC-38 zaehlt den Rundenzustand abschliessend auf und kennt die vorbereitete naechste Frage noch nicht** (drei Felder: Loesung, richtige Position, Token) sowie das Feld „zuletzt beruehrt", an dem AC-41 haengt. Beides folgt zwingend aus AC-10 und AC-41, ist also kein Zusatz, sondern eine Luecke im Wortlaut. **Vor `/build` per `/refine PROJ-2` nachziehen** — sonst baut `/build` etwas, das der Vertrag nicht deckt, und `/qa` faellt darueber.
- [ ] Ob das gehostete Projekt `create extension pg_cron` aus einer Migration heraus zulaesst, ist erst am echten Projekt zu sehen. Faellt es durch, greift die Dashboard-Zeile aus „Settings the user makes".
- [ ] Ob die 110 KB des rohen PNG die 3-Sekunden-Zusage aus AC-2 gefaehrden, ist eine Messung wert, sobald die erste Runde laeuft. Hebel waere eine serverseitige Verkleinerung im Route Handler; sie kostet Rechenzeit je Pokemon einmalig und liesse sich neben den Zwischenspeicher legen.

## Notizen aus dem Bau (2026-09-06)

Fünf Abweichungen bzw. Präzisierungen gegenüber dem genehmigten Entwurf, alle innerhalb seiner Zusagen.

**1. Eine siebte Datenbankfunktion: `promote_prepared_question`.** Der Entwurf nannte sechs. Beim Bau zeigte sich, dass „vorbereitete Frage" und „aktuelle Frage" einen eigenen Übergang brauchen: Wartet der Spieler (nach einer richtigen Antwort lag nichts bereit), muss die nachgezogene Frage aktuell werden — und zwar **erst, wenn ihr Bild geladen ist**, weil dort der Ausgabezeitpunkt und damit die Messung beginnt (AC-34). Der naheliegende Weg, sie gleich als aktuelle entstehen zu lassen, wurde verworfen: Eine aktuelle Frage ist nach EC-12 nicht mehr verwerfbar, und lädt ihr Bild nicht, säße die Runde fest. Jede Frage entsteht deshalb als vorbereitete — dort ist sie verwerfbar — und wird separat befördert. Die Funktion ist **idempotent**: Hat `submit_answer` bereits befördert, meldet sie Erfolg statt Fehlschlag.

**2. Ein eigenes Modul fürs Ziehen: `src/lib/quiz/draw-question.ts`.** Es gibt die Lösung zurück und darf deshalb nie ein Endpunkt sein; in einer Server-Action-Datei wäre jeder Export einer. Der Wächter über die Server Actions hat das beim ersten Lauf bestätigt — er hat sogar den bloßen *Kommentar* mit der Direktive angemahnt, was richtig war und den Kommentar gekostet hat, nicht die Regel.

**3. `load-error-card.tsx` bekam eine optionale Meldung.** Die Fehlerkarte trug bisher nur den Ausfall der Datenquelle (AC-16); für EC-15 („die Runde lief anderswo weiter") braucht sie einen zweiten Text. Die Datei stand in keiner Aufgabe — die Änderung ist klein und berührt keine andere.

**4. Zwei Wettläufe im Anzeige-Zustand, beide von den E2E-Journeys gefunden, beide dieselbe Klasse wie BUG-33 im abgelösten Aufbau.** `advance` läuft aus einem `setTimeout` und las Reserve und aktuelle Frage aus einer veralteten Closure; einmal zog es dadurch eine überflüssige Frage nach, die der Server nie zur aktuellen machte, und die Runde blieb auf „Runde wird vorbereitet …" stehen (11 von 57 E2E-Tests rot). Behoben mit Refs, die neben dem State gesetzt werden — `currentRef`, `reserveRef`, `probingRef`. **Kein Test der Unit-Ebene hat das gesehen**, weil dort keine echten Bilder laden; erst die drei Engines haben es aufgedeckt.

**5. Zwei falsch-grüne Tests, gefunden durch die Rot-Gegenprobe zu T48.** Sie sind der Grund, warum die Gegenprobe verlangt war:
- *„Ohne Sitzung kein Bild"* blieb grün, als die Sitzungsprüfung aus der Bild-Route entfernt wurde — der Proxy leitet unangemeldete Aufrufe schon vorher um. Der E2E-Test belegt also „ein Fremder bekommt kein Bild", nicht „die Route prüft selbst". Letzteres hält jetzt ausdrücklich der Unit-Test der Route fest, und der Umfang steht als Kommentar im E2E-Test.
- *„Ein erfundenes Frage-Token liefert kein Bild"* blieb grün, weil das verwendete Token gar kein wohlgeformtes UUID war und schon am Schema scheiterte — die Token-Prüfung wurde nie erreicht. Mit einer formal gültigen, fremden UUID ist der Test rot, sobald die Prüfung fällt.

### Verifikation

- `npm test` **239/239**, `npm run lint` **0 Probleme**, `npm run build` **Exit 0**
- `npx playwright test` **57/57** in drei Engines (Chromium, Firefox, Mobile Safari)
- Die Funktionen aus Migration `0009` zusätzlich direkt in SQL durchgespielt (Start, Auflösen, richtig, falsch, Token-Wiederverwendung, Verwerfen, Beenden, zweites Beenden, Aufräum-Lauf) — dabei fiel ein mehrdeutiges `on conflict (round_id)` auf, bevor eine Zeile Anwendungscode existierte
- Rot-Gegenprobe je T48-Test einzeln: Client schickt Serie mit → rot · Zustand wird nicht gelöscht → rot · Bildadresse zurück auf das CDN → rot · Lösung zu jedem Token → rot · Antwort ohne Token-Prüfung → rot · Sitzungsprüfung der Route entfernt → **grün, siehe Punkt 5**


---

## Notizen aus dem Fix-Lauf (2026-09-07)

Drei Befunde des ersten unabhängigen QA-Laufs, behoben. Der erste ist der wichtige.

**BUG-110 — die Lücke lag nicht im Neuen, sondern im Alten, das stehenblieb.** Der Umbau hat die Server Action `saveRun` ersatzlos entfernt und damit die Einreiche-Schnittstelle geschlossen, die AC-12 verbietet. Übersehen wurde, dass dieselbe Schnittstelle noch ein zweites Mal existierte: als Insert-Policy auf `runs` aus Migration `0002`, geschrieben für den Entwurf, in dem der Browser das Ergebnis einreichte. Über PostgREST war sie mit dem öffentlichen Schlüssel und einer gewöhnlichen Sitzung bedienbar — Serie 386 in 0 ms, HTTP 201.

Die Lehre steht schon in der Historie dieses Features: Bei BUG-22 überlebte eine `remotePatterns`-Freigabe den Code, für den sie angelegt worden war. Hier war es eine Policy. **Wer einen Schreibweg entfernt, muss die Rechte mitentfernen, die ihn erlaubt haben** — der Code verschwindet aus dem Diff, die Berechtigung nicht.

Warum es keiner der eigenen Prüfungen auffiel: Sie befragen die Anwendung durch ihre eigene Oberfläche. `tests/PROJ-2-round-authority.spec.ts` belegte, dass der **Browser** kein Ergebnis schickt — der Angriff redet gar nicht mit dem Browser. Der neue Test setzt deshalb ausdrücklich an der Datenschnittstelle an.

**BUG-111 — die erste Frage war nie durch die Sonde gegangen.** `ImageProbe` prüft die *vorbereitete* Frage; die erste einer Runde wird direkt angezeigt. Ihr Bild hatte weder `onError` noch Zeitgrenze, ein Ausfall blieb also als Skelettfläche stehen — ohne zweiten Versuch, ohne Fehlerkarte, mit vier klickbaren Optionen zu einem unsichtbaren Bild. `PokemonImage` trägt die Frist jetzt selbst; die Frage wird dabei **nicht** ersetzt, sonst wäre aus einem Bildfehler ein Überspringen-Knopf geworden (EC-12).

**BUG-114 — „Pool leer" war ein stiller Rückweg.** Der Client behandelte die Meldung als „nichts weiter vorzubereiten" und kehrte kommentarlos zurück; wartete der Spieler gerade, blieb der Bildschirm auf „Runde wird vorbereitet …" stehen und die Runde verfiel nach 110 Minuten. Jetzt endet sie und wird gewertet. Die Gewinner-Meldung hängt weiterhin an der Serie und nicht am leeren Vorrat — `seen_ids` enthält auch verworfene Nummern, das war schon BUG-17/BUG-23.

### Verifikation

- `npm test` **242/242**, `npm run lint` **0**, `npm run build` **Exit 0**, `npx playwright test` **60/60** in drei Engines
- Rot-Gegenprobe je Fix: Policy wiederhergestellt → E2E rot · `onFailed` abgeklemmt → beide Unit-Tests rot · Rundenende bei leerem Vorrat entfernt → Unit-Test rot; nach Rücknahme jeweils wieder grün
- Schreibweg direkt gemessen: `POST /rest/v1/runs` → **403 permission denied**, Lesen weiterhin **200**

## Notizen aus dem zweiten Fix-Lauf (2026-09-07)

**BUG-119 — ein Fix, der das Problem nur verschoben hat.** Der erste Anlauf gegen BUG-114 beseitigte den sichtbaren Hänger, indem der **Browser** die Runde beendete. Der Nachlauf hat gezeigt, warum das zu wenig war: AC-35 nennt „weil der Pool erschöpft ist" ausdrücklich als eine der drei Endbedingungen, bei denen **der Server** schreibt, bevor er antwortet. Blieb der Aufruf des Browsers aus, war das Ergebnis wie vorher verloren. Die Wertung sitzt jetzt in `prepareNext` — aber nur, wenn dort keine Frage mehr offensteht, sonst würde eine laufende Frage unter dem Spieler weggewertet.

Die Lehre daraus ist die gleiche wie bei BUG-110, nur andersherum: Dort blieb eine alte Berechtigung stehen, hier blieb eine Zuständigkeit beim Falschen. **Ein Fix, der das Symptom im Client beseitigt, während der Vertrag den Server nennt, ist kein Fix.**

**BUG-120 — der Fix hat einen bestehenden Konstruktionsfehler freigelegt.** `finish_round(p_profile)` beendete, was gerade aktiv war. Antworten waren immer schon token-geprüft; das Rundenende war die einzige Stelle, an der der Server nicht wissen wollte, wovon die Rede ist. Aufgefallen ist das erst, als der BUG-111-Fix einen veralteten Tab überhaupt erst in die Fehlerkarte brachte — dort steht „Runde beenden". Die Funktion nimmt jetzt die Runden-Kennung entgegen (Migration `0012`); passt sie nicht, geschieht nichts.

**BUG-113 — der Text musste sich der Wahrheit beugen, nicht umgekehrt.** Die Karte behauptete „die Uhr steht so lange still". Das gilt für die **angezeigte** Uhr immer, für die **gewertete** Zeit aber nur, wenn serverseitig keine Frage offensteht. Die Karte unterscheidet die beiden Fälle jetzt.

Die naheliegende Alternative — die Serveruhr beim Bildfehler anhalten — wurde **verworfen**: Sie wäre vom Client auslösbar und damit freie Bedenkzeit auf dem Tie-Breaker. Genau dieser Weg ist beim Entwurf schon einmal ausgeschlossen worden (siehe die Begründung zu EC-12); ihn hier wieder zu öffnen, hätte einen Anzeigefehler gegen eine Manipulationsmöglichkeit getauscht.

**Zur Lesart von AC-16.** Das Kriterium sagt „die Uhr steht still". Gemeint ist die **angezeigte** Uhr — AC-2 nennt sie ausdrücklich „Anzeige" und verweist für die Wertung auf AC-34. Unter dieser Lesart ist AC-16 erfüllt, und BUG-113 war ein Textfehler. Läse man „die Uhr" als die gewertete Zeit, wäre es keine Code-, sondern eine Vertragsfrage und gehörte in ein `/refine`.

### Verifikation

- `npm test` **247/247**, `npm run lint` **0**, `npm run build` **Exit 0**, `npx playwright test` **66/66** in drei Engines
- Rot-Gegenprobe je Fix: `finish_round` ohne Kennung → E2E rot · Server wertet nicht mehr → E2E rot · Karte behauptet wieder immer die stehende Uhr → Unit-Test rot; nach Rücknahme jeweils grün
- Die beiden neuen E2E-Tests stellen ihren Zustand **direkt** her, nicht über die Oberfläche — der erschöpfte Vorrat wäre sonst erst nach rund 380 Fragen erreichbar


## Notizen aus dem dritten Fix-Lauf (2026-09-07)

Vier Befunde, drei davon Nachzügler bereits gezogener Lehren. Deshalb liegen sie in **einer** Migration (`0013`): Es ist dieselbe Frage, dreimal nicht zu Ende beantwortet.

**BUG-122 — eine Berechtigung, die man beim Aufräumen übersieht.** `0011` hat den Einreichweg für Rundenergebnisse geschlossen und dabei `insert, update, delete` entzogen — aber nicht `truncate`. Und TRUNCATE unterliegt **keiner** Row Level Security: Wäre es erreichbar, löschte ein Aufruf die Runden aller Spieler. Erreichbar war es nicht, PostgREST kennt kein solches Verb. Trotzdem ist es dieselbe Klasse wie BUG-110 und BUG-22 davor: **Wer einen Schreibweg entfernt, muss die Rechte mitentfernen — alle, nicht die drei, an die man beim Schreiben gerade denkt.** `revoke all` und dann gezielt `grant select` zurück ist die Form, die das erzwingt; `0007` machte es bei `active_runs` von Anfang an so.

**BUG-123 — zwei Anweisungen, die eine hätten sein müssen.** `start_round` löschte und fügte getrennt ein. Zwei gleichzeitige Starts sehen die Löschung der jeweils anderen nicht; der unterlegene lief in `duplicate key … active_runs_pkey`. Für den Spieler war das keine Fehlermeldung, sondern eine Sackgasse: Der Client macht daraus `unavailable`, landet in der Fehlerkarte **ohne** Runden-Kennung, „Erneut versuchen" führt zurück in dieselbe Karte, „Runde beenden" in die Fremdrunden-Meldung. Nur Neuladen half. Aus einem Tab verhinderte ein Riegel im Client das — aus zwei Tabs nicht, und genau die nennt EC-9.

`on conflict (profile_id) do update` macht daraus einen Schritt. Der Aktualisierungszweig setzt durchgehend `excluded.*`, **einschließlich der Spalten, die in der Einfügeliste gar nicht auftauchen** (`round_id`, `streak`, `accumulated_ms`, `touched_at` — sie kämen aus ihren Spaltenvorgaben). Damit ist der Zweig per Konstruktion identisch mit einem frischen Einfügen, statt von Hand nachgebaut: Eine stehengebliebene `streak` wäre der Fehler, den man hier macht, und er wäre in der Rangliste gelandet.

**BUG-130 — der Fix von `0012`, zu Ende geführt.** BUG-120 hatte gezeigt, dass das Rundenende nicht wusste, welche Runde gemeint ist. `0012` hat das für `finish_round` behoben — und nur dafür. `set_prepared_question` und `discard_prepared_question` banden sich weiterhin allein an das Profil, und die Server Actions darüber nahmen **überhaupt kein Argument**: Ein veralteter Tab konnte seine Runde gar nicht nennen, also war er von einem aktuellen nicht unterscheidbar.

Gemessen: Runde A durch Runde B verdrängt, dann der Aufruf aus Tab A → die vorbereitete Frage der **laufenden** Runde B ausgetauscht (151 → 300), ihr Token gewechselt, ihr Ziehungsvorrat um drei Nummern kürzer. Der spielende Tab hatte das Bild des alten Tokens vorgeladen; das war wertlos, die nächste Frage kam mit sichtbarem Ladezustand statt vorgeladen (AC-10). Und im Randfall „Vorrat erschöpft, keine Frage offen" beendete Tab A die laufende Runde B samt Wertung — weil `finishRound` dort die serverseitig abgeleitete `snapshot.roundId` bekam, die zwangsläufig immer passte.

Der Riegel sitzt jetzt an drei Stellen, und das ist kein Übermaß, sondern die Aufgabenteilung: die **Datenbank** prüft `and a.round_id = p_round_id` (die Autorität), `prepareNext` prüft vor allem, was den Zustand verändert (damit nichts halb geschieht), und `replacePreparedQuestionAction` prüft **vor** dem Verwerfen — sonst hätte der veraltete Tab die vorbereitete Frage der laufenden Runde bereits gelöscht, bevor `prepareNext` ihn abweist. Im `pool-empty`-Zweig geht bewusst die Kennung des **Aufrufers** an `finish_round`, nicht die aus dem Schnappschuss: Die serverseitig abgeleitete käme immer durch, und die Prüfung in `0012` hätte an dieser Stelle nichts mehr zu tun.

Neu im Vertrag der Action ist der Status `stale` — dieselbe Antwort, die eine Antwort aus einem verwaisten Tab seit jeher bekommt. Der Client zeigt darauf die EC-15-Meldung.

**BUG-124 — die einzige Migration, die rückwirkend geändert wurde.** `0010` hatte ein blankes `create extension if not exists pg_cron`. Verweigert das gehostete Projekt die Erweiterung, bricht damit die **ganze** Migration ab und `supabase db push` scheitert hart. Ein Nachtrag in einer späteren Migration hilft nicht: `0010` läuft zuerst.

Die Änderung an einer bereits gelaufenen Datei ist hier zulässig und nur hier — **kein Feature steht auf `Deployed`**, die Datei hat die Maschine nie verlassen. Sie ist jetzt in einen `do`-Block gefasst, der den Fehlschlag zu einer Warnung macht und den Aufräum-Lauf überspringt, statt alles abzubrechen. Die Absicherung bleiben **T36** und **T37**; ohne sie ist AC-41 eine Zusage ohne Mechanismus — aber als sichtbare Deploy-Aufgabe, nicht als stiller Ausfall.

Bemerkenswert bleibt die Spannung zum eigenen Bauplan: `0005` hat den Weg über `pg_cron` fünf Migrationen früher ausdrücklich vermieden, mit derselben Begründung, an der er hier fast gescheitert wäre.

### Verifikation

- `npm test` **260/260** (23 Dateien), `npm run lint` **Exit 0**, `npm run build` **Exit 0** (6 Routen), `npx playwright test` **72/72** in drei Engines
- `supabase db reset` über **0001–0013** zweimal vollständig durchgelaufen — das ist zugleich der Nachweis für den `0010`-Fix
- Wirkung gemessen: `runs` trägt für `authenticated` nur noch `r` (SELECT), `anon` gar nichts · fünf gleichzeitige Rundenstarts → **alle fünf erfolgreich**, genau eine Zeile, `streak` und `accumulated_ms` auf 0 (vorher 2 von 3 mit HTTP 500) · Aufruf mit fremder Runden-Kennung → `discard` wirkungslos, `set` gibt `null`, Runde B **Feld für Feld unverändert**
- **Kontrollmessungen**, damit das Abweisen kein kaputter Aufruf ist: dieselben Aufrufe mit der **eigenen** Kennung wirken unverändert (neues Token, `seen_ids` wächst)
- **Rot-Gegenprobe je Fix**, einzeln eingebaut und zurückgenommen: Riegel in `prepareNext` entfernt → **2 Unit-Tests rot** · Riegel in `replacePreparedQuestionAction` entfernt → **1 Unit-Test rot** · `start_round` zurück auf Löschen-dann-Einfügen → **E2E rot** in Zeile 330 · `set_prepared_question` ohne Runden-Prüfung → **E2E rot** in Zeile 276. Nach Rücknahme jeweils wieder grün
### Nachtrag am selben Tag — BUG-131 und ein Wächter für die Rechte

**BUG-131 — dieselbe Fehlerklasse eine Tabelle weiter.** `profiles` gewährte `anon` und `authenticated` **alle** Rechte (`arwdDxtm`), während die einzige Policy nur SELECT abdeckt: Schreibzugriffe hielt allein die Row Level Security. Sie hielt auch, in allen vier Verben gemessen — es fehlte die zweite Schicht, nicht die erste. `0014` schneidet die Rechte auf `select` für `authenticated` zurück; `anon` bekommt nichts.

**Vor dem Schnitt geprüft, wer `select` wirklich braucht:** Die Kopfzeile liest den eigenen Trainernamen über die **Nutzersitzung** (`site-header.tsx:27-32`) — die bleibt. Die Verfügbarkeitsprüfung beim Registrieren (`is_trainer_name_taken`, `0006`) und der Anlege-Trigger (`handle_new_user`, `0001`) sind beide `security definer` und von Tabellenrechten unabhängig. Nach dem Schnitt gegengemessen: Registrierung legt das Profil weiterhin an, der Lesepfad liefert den Trainernamen, und der Schreibversuch scheitert jetzt **eine Stufe früher** — `permission denied for table profiles` statt einer RLS-Verletzung.

**Die Lücke aus der ersten Fassung dieser Notiz ist damit zu.** Dort stand, die Tabellenrechte selbst pinne kein Test, weil der Rechtestand über PostgREST nicht abfragbar ist. Das war zu kurz gedacht: **Die beiden Schichten sind am Wortlaut der Abweisung unterscheidbar** — fehlt das Tabellenrecht, sagt Postgres `permission denied for table`; greift nur die Policy, sagt es `violates row-level security policy`. `PROJ-2-round-authority.spec.ts` prüft deshalb jetzt die **Meldung**, nicht den Statuscode, für vier Schreibversuche auf `profiles` und `runs`. Rot-Gegenprobe: weite Rechte wiederhergestellt → der Test wird rot und nennt genau den Unterschied (`Received: "new row violates row-level security policy"`), obwohl der Schreibversuch weiterhin mit 403 abgewiesen wird. Ein wiederhergestelltes `grant` wäre ohne diesen Wächter unbemerkt geblieben.

Damit sind BUG-122 und BUG-131 nicht nur behoben, sondern gegen einen künftigen Umbau gesichert — anders als die unter BUG-101/BUG-118 beschriebenen Grenzwerte.

**Verifikation nach dem Nachtrag:** `npm test` **260/260**, `npm run lint` **Exit 0**, `npm run build` **Exit 0**, `npx playwright test` **75/75** in drei Engines; `supabase db reset` über **0001–0014**.


## Notizen aus dem vierten Fix-Lauf (2026-09-07)

Vier Befunde, **eine** Ursache: Der Client kannte für drei Zustände, die der Server korrekt behandelt, keinen Weg nach vorn. Der Umbau auf die serverseitig geführte Runde hat die Autorität sauber verschoben — die Oberfläche ist an drei Stellen nicht mitgegangen.

**BUG-133 — die Frage-Ansicht kennt nur den Weg über die falsche Antwort.** `ResultView` erscheint ausschließlich bei `phase === 'finished'`, gesetzt allein von `showResult`. Der Zweig, der eine Runde per **richtiger** Antwort beendet, rief `showResult` nicht auf; „Weiter zum Ergebnis" wiederum erscheint nur bei einer falschen Antwort (`answeredWrong`). Wer alle 386 richtig hatte, blieb auf der Frage stehen — mit dem Ergebnis längst in der Datenbank. Nebenwirkung: Die Gewinner-Meldung war auf dem vorgesehenen Weg **unerreichbar**. Jetzt geht eine richtige, beendende Antwort nach `CORRECT_FEEDBACK_MS` ins Ergebnis; die falsche behält ihre stehende Auflösung (AC-6).

**BUG-134 / BUG-135 — die Fehlerkarte war für einen Fall gebaut und für drei benutzt.** Sie hieß immer „Die nächste Frage lädt gerade nicht" und bot immer dieselben zwei Knöpfe an. Bei einem gescheiterten **Start** gab es keine Runde: „Erneut versuchen" rief `prepareNextQuestionAction('')`, was der Server zu Recht mit `stale` beantwortete — die Karte lief in sich selbst zurück. Nach der EC-15-Meldung stand „Starte eine neue Runde", ohne dass es dafür einen Knopf gab. Beides nur mit Neuladen verlassbar.

Die Karte kennt jetzt drei Sorten und leitet daraus Überschrift **und** Ausweg ab: `question` (fortsetzbar, zwei Knöpfe), `no-round` (nur „Erneut versuchen", das wirklich startet — nichts zu beenden), `stale-round` (nur „Neue Runde starten"). **BUG-121** fällt damit ab: Die Überschrift unterscheidet endlich die angezeigte von der nächsten Frage, so wie der Text darunter es schon tat.

**Ein Lint-Fund unterwegs:** Die Sorte aus `roundIdRef` beim Rendern abzuleiten, war ein Ref-Zugriff im Render (`react-hooks/refs`). Ersetzt durch `hasRound` als State.

### Verifikation

- `npm test` **263/263** (23 Dateien), `npm run lint` **Exit 0**, `npm run build` **Exit 0**, `npx playwright test` **75/75** in drei Engines
- **Rot-Gegenprobe je Fix**, einzeln eingebaut und zurückgenommen: Übergang zum Ergebnis entfernt → BUG-133-Test rot · Neustart bei fehlender Runde entfernt → BUG-134-Test rot · „Neue Runde starten" entfernt → BUG-135-Test rot. Nach Rücknahme jeweils grün
- Zwei bestehende Tests mussten die neue Überschrift übernehmen — sie standen im Block „das Bild der **angezeigten** Frage", also genau dem Fall, dessen Titel BUG-121 als falsch gemeldet hatte
- Der BUG-133-Test prüft die **Gewinner-Meldung** („Alle Pokémon geschafft … Mehr geht nicht"), nicht bloß den Ergebnis-Screen: Sie war der Teil, der nachweislich unerreichbar war

## Historie — der abgelöste Entwurf (2026-09-01 bis 2026-09-05)

> Alles ab hier beschreibt den **clientseitig geführten** Entwurf, den `/refine PROJ-2` am 2026-09-06 abgelöst hat. Er bleibt vollständig stehen, weil `qa-report.md` und `features/INDEX.md` auf seine Befunde und Bug-Nummern verweisen — und weil die Begründungen zeigen, welche Überlegung damals wozu geführt hat.
>
> **Nicht danach bauen.** Was hier über Rundenzustand im Browser, `correctIndex`, das Einreichen fertiger Ergebnisse an `saveRun` oder die aus der Nummer gebildete Bildadresse steht, gilt nicht mehr. Was weiter gilt: die App-Shell (Kopfzeile, Fußzeile, Seitenrahmen), das Verwerfen nicht ladbarer Bilder, der Umgang mit der PokeAPI und die Notizen zum Wächter über die Server Actions.



### Component Structure

```
Wurzel-Layout (src/app/layout.tsx) — die App-Shell, gehört diesem Feature
+-- PageFrame                     Kopfzeile + Inhalt + Fußzeile, umschließt jede Route
    +-- SiteHeader                Server-Komponente, liest die Sitzung selbst (AC-21, AC-22)
    |   +-- Wordmark              Ball-Motiv in CSS + Schriftzug „Pokémon QUIZ"
    |   +-- angemeldet:   UserChip; Button „Bestenliste" -> /leaderboard nur,
    |   |                 wenn die Seite existiert (AC-21, siehe LEADERBOARD_PAGE_EXISTS)
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
            +-- Primär „Nochmal spielen"; sekundär „Zur Bestenliste" nur,
                wenn die Seite existiert (AC-7, siehe LEADERBOARD_PAGE_EXISTS)
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
beendet --"Nochmal spielen"--> lädt   (direkt in die neue Runde, AC-9)
```

Kein Übergang führt aus `beendet` zurück in `offen` — eine beendete Runde ist unveränderlich, so wie ihre Zeile in der Datenbank.

**Korrigiert am 2026-09-04 (BUG-10).** Dieser Entwurf schrieb ursprünglich `beendet --"Nochmal spielen"--> bereit`, also zurück auf den Startbildschirm. Der Code folgte dem Design, und das Design widersprach dem Vertrag: AC-9 sagt „dann **startet eine neue Runde**", nicht „dann sieht der Nutzer wieder den Startknopf". Aufgefallen ist das erst im QA-Lauf vom 2026-09-04 — vier Wochen lang stand ein Übergang im Design, den niemand gegen die Spec gelesen hatte. Aufgelöst zugunsten des Vertrags, weil das PRD-Erfolgskriterium „mindestens die Hälfte startet direkt eine zweite Runde" jeden zusätzlichen Klick teuer macht.

### Data Model

#### Neue Tabelle: `runs`

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

#### Index

Ein einziger zusammengesetzter Index über `(Profil, Serie absteigend, Dauer aufsteigend)`. Er bedient drei Dinge gleichzeitig: die persönliche Bestleistung in AC-8, das Löschen der Runden beim Entfernen eines Profils (AC-26) und später die Ranglisten-Abfrage von PROJ-3 („bester Lauf pro Spieler"). Ein separater Index auf die Profil-Spalte ist damit überflüssig.

#### Unverändert

`profiles` und `auth.users` bleiben, wie PROJ-1 sie angelegt hat. Dieses Feature ändert dort nichts und legt keine Pokémon-Entität an — Bilder und Namen bleiben externe Daten mit einem verwerfbaren Zwischenspeicher davor.

### Behaviors & Access

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

Bildadresse beschaffen — dreistufige Leiter, jede Stufe nur bei Fehlschlag der vorigen

> **Geändert am 2026-09-04 (BUG-16).** Ursprünglich stand hier eine **vierstufige** Leiter,
> deren Stufe 2 die offizielle Adresse über `/pokemon/{id}` nachschlug. Diese Stufe ist
> ersatzlos entfallen: Gemessen wurde, dass die offizielle Adresse für den ganzen Pool
> zeichengleich mit der konstruierten ist, sie konnte also nie ein anderes Ergebnis
> liefern. Siehe Technical Decisions und `spec.md` → EC-11.

- Die Prüfung läuft im Vorladen der nächsten Frage (AC-10), also unsichtbar, während
  der Spieler noch die aktuelle Frage beantwortet. Eine Frage gilt erst als vorgeladen,
  wenn ihr Bild geladen ist — dadurch startet die Uhr nie über einem kaputten Bild
  (AC-2 knüpft den Uhrenstart ohnehin an das sichtbare Bild)
  1. Adresse aus der Pokémon-Nummer gebildet. Normalfall, keine Zusatzanfrage
  2. Antwortet die nicht mit einem Bild: Die Frage wird verworfen und eine neue gezogen
     (EC-6). Das ist der Fall „einzelnes Pokémon kaputt"
  3. Drei verworfene Fragen hintereinander: Das ist kein einzelnes kaputtes Pokémon mehr,
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

### Dependencies

**Keine neuen Pakete.** Alles, was dieses Feature braucht, ist bereits installiert:

- `next/image` (Teil von `next`) — liefert die Bilder über die eigene Domain aus und bringt den serverseitigen Bild-Zwischenspeicher mit (AC-20, AC-31)
- `zod` (vorhanden) — serverseitige Prüfung der Rundenergebnisse an der Server-Action-Grenze (AC-12)
- `@supabase/ssr` (vorhanden) — Sitzung und Datenbankzugriff in Server Actions und Server-Komponenten
- shadcn/ui `Button`, `Card`, `Skeleton`, `Avatar`, `Badge` (vorhanden) — keine neue UI-Komponente nötig

### Settings the user makes

**Keine.** Dieses Feature braucht keine Einstellung in einem Anbieter-Dashboard — Zwischenspeicher und Bild-Auslieferung werden in `next.config.ts` konfiguriert und sind damit ganz normale Aufgaben für `/build`.

Ein Hinweis fürs spätere `/deploy`, keine Aufgabe: Die serverseitige Bild-Optimierung wird auf manchen Hosting-Tarifen nach optimierten Bildern abgerechnet. Bei einem Pool von 386 Pokémon und einer Bildgrösse ist die Obergrenze 386 optimierte Bilder insgesamt — nicht pro Nutzer. Das bleibt in jedem kostenlosen Tarif unauffällig.

### Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| Bild-Auslieferung über `next/image` mit freigeschaltetem Bild-Host statt einer selbst gebauten Proxy-Route | Erfüllt AC-20 durch Konfiguration statt durch Code: Der Browser fragt nur `/_next/image?…` auf unserer eigenen Domain an, der Server holt vom CDN. Bringt den serverseitigen Bild-Zwischenspeicher gleich mit (AC-31) und verkleinert die Bilder obendrein — die Originale sind rund 110 KB grosse PNGs, geprüft an den Nummern 25 und 386 | Eigene Route, die das Bild durchreicht | Wir sind an die Zwischenspeicher-Regeln des Frameworks gebunden (Ablauf einstellbar, gezieltes Verwerfen einzelner Bilder nicht vorgesehen). Für Pokémon-Bilder, die sich praktisch nie ändern, ist das ohne Bedeutung | 2026-09-01 |
| ⚠️ **Überholt am 2026-09-04, siehe die vorletzte Zeile dieser Tabelle.** Bildadresse wird aus der Pokémon-Nummer gebildet — als **schneller Weg mit Rückfallebene**, nicht als einzige Quelle | Halbiert die Anfragen an die PokeAPI: pro Frage vier Namensabfragen statt vier Namens- **und** vier Detailabfragen. Die Detailantwort ist mit über 100 KB die grösste des ganzen Dienstes und enthält fast nur Daten, die wir nie anzeigen. Das ist genau die „Anfragehäufigkeit gering halten"-Bitte der Fair-Use-Policy, und es hilft AC-2 (Start unter 3 Sekunden). **Der ganze Pool wurde am 2026-09-01 vollständig geprüft, nicht stichprobenartig: 386/386 Bilder über die gebildete Adresse erreichbar, 386/386 deutsche Namen vorhanden.** Es gibt also keine Nummer, die dauerhaft aus dem Pool ausgeschlossen werden müsste — wäre eine gefunden worden, würde sie hier stehen | Ausschliesslich `/pokemon/{id}` abfragen und die Adresse daraus lesen — der offiziell dokumentierte Weg | **Bewusst akzeptiertes Risiko: Wir hängen an einem Adressmuster, das die PokeAPI nirgends als Schnittstelle zusagt.** Ändert sie die Ablage ihrer Bilder, schlägt das nicht bei einem Pokémon fehl, sondern bei allen gleichzeitig und ohne Vorwarnung. Tragfähig ist die Entscheidung nur wegen der Rückfallebene: Stufe 2 der Leiter (siehe Behaviors & Access) holt die offizielle Adresse aus `/pokemon/{id}`, sobald die gebildete kein Bild liefert. Der schlimmste Fall ist damit nicht „alle Bilder kaputt", sondern „eine Zusatzanfrage pro Pokémon" — also exakt der Zustand, den die Alternative von vornherein hätte. Das Risiko ist Mehrverbrauch, kein Ausfall | 2026-09-01 |
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
| **Die Rückfallebene der Bildadresse entfällt; die Leiter ist dreistufig.** Löst die oben markierte Entscheidung vom 2026-09-01 ab | Die Begründung von damals lautete, der schlimmste Fall sei „eine Zusatzanfrage pro Pokémon, nicht alle Bilder kaputt". **Diese Garantie hat der Code nie gehabt**: Gemessen am 2026-09-04 ist `sprites.other.official-artwork.front_default` für den Pool 1–386 zeichengleich mit `SPRITE_BASE/{id}.png` — die Nachschlage-Anfrage konnte nie eine andere Adresse liefern. Sie wurde gestellt (über 100 KB je Antwort) und ihr Ergebnis verworfen, bis zu dreimal vor jeder Fehlerkarte. Bis zum Fix von BUG-8 war das nicht einmal sichtbar, weil dieselbe Adresse erneut zu setzen die Runde stillstehen ließ | Die Anfrage als Versicherung gegen eine künftige Änderung der PokeAPI-Bildablage behalten und nur EC-11 ehrlicher formulieren | **Wir geben eine Absicherung auf, die es nie gab.** Ändert die PokeAPI ihre Bildablage, fällt jede Frage in EC-6 und nach drei Verwürfen in EC-10 — die Fehlerkarte mit „Erneut versuchen" und „Runde beenden". Der Ausfall wäre also sichtbar und benannt, nicht still. Dafür entfällt bei jedem Bildausfall echter Verkehr, der gegen die Fair-Use-Zusage arbeitete, um die dieses Feature sich sonst ausdrücklich bemüht | 2026-09-04 |
| **Das Vorladen des Bildes bekommt eine eigene Zeitgrenze: 5 Sekunden, ein stiller zweiter Versuch, dann Verwurf** | `onLoad` und `onError` decken ein Bild ab, das ankommt, und eines, das abgelehnt wird — aber keines, das **gar nicht antwortet**. Genau das war BUG-15: Die Runde saß dann für immer auf „Runde wird vorbereitet …", ohne Fehlerkarte und ohne Ausweg, und die Serie war beim Neuladen verloren. AC-15 verspricht die Frist ausdrücklich („nach 5 Sekunden nicht vollständig ladbar"), und ein Bild ist Teil der Frage — `design.md` sagt selbst: „Eine Frage gilt erst als vorgeladen, wenn ihr Bild geladen ist." Die Frist spiegelt daher `withTimeoutAndOneRetry` der Serverseite, damit eine langsame Runde **ein** Budget hat statt zweier | Sofort verwerfen ohne zweiten Versuch; oder die Frist in `quiz-screen` statt in der Sonde führen | Ein hängendes Bild kostet jetzt bis zu 10 Sekunden, und bis zur Fehlerkarte im schlimmsten Fall drei davon. Das ist der seltene Hänge-Fall; der häufige (404) antwortet weiterhin sofort. Der zweite Versuch läuft über den React-`key` und **nicht** über die Adresse — ein Cache-Buster in der URL hätte AC-31 und AC-20 gebrochen | 2026-09-04 |
| **Der Proxy leitet Server-Action-POSTs nicht um; die Sitzungsprüfung sitzt in der Action** | Next.js kodiert das `redirect()` einer Server Action **in-band** — Status 200 plus `x-action-redirect` —, ausdrücklich damit der Browser keiner 307 auf eine Anmeldeseite folgt (`action-handler.ts`). Eine gewöhnliche Weiterleitung auf einen Action-POST ist für den Handler deshalb ein Protokollbruch; der Client wirft „An unexpected response was received from the server". Genau das machte den `unauthenticated`-Zweig **unerreichbar** (BUG-9): Wem mitten in der Runde die Sitzung ablief, der sah einen Ergebnis-Screen, der Erfolg vortäuschte. Der Zweig existierte und war getestet — der Proxy ließ ihn nie laufen. Next.js' eigene Anleitung sagt dazu: „any Server Actions called from components must perform their own authorization checks" | Den Fehlertext der Framework-Meldung im Client auswerten und daraus auf „abgemeldet" schließen | **Wir tauschen eine Schranke davor gegen eine Schranke darin.** Ein Action-POST ohne Sitzung erreicht jetzt die Action; sie prüft selbst, und die Datenbank prüft über RLS ein zweites Mal. Damit das nicht bei der fünften Action still verfällt, erzwingt `server-actions.guard.test.ts` die Prüfung für **jede** Action. Nebenwirkung: Ein Action-Kennzeichen einer *fremden* Route ergibt ohne Sitzung HTTP 500 statt 307 — nachgemessen tut es das **mit** Sitzung genauso, ist also vorbestehendes Framework-Verhalten und kein neues Loch. Die Alternative hinge an einer Zeichenkette in einer Fehlermeldung und bräche bei jedem Next-Update still | 2026-09-04 |

### Open Questions

- [ ] Der Bild-Zwischenspeicher des Frameworks liegt beim Hoster und überlebt ein neues Deploy je nach Anbieter nicht. Nach dem ersten `/deploy` einmal prüfen, ob nach einer Neuveröffentlichung die ersten Fragen spürbar langsamer sind — falls ja, ist die Ablaufzeit der richtige Hebel, nicht der Aufbau.
- [ ] AC-31 ist auf Anfragen zur PokeAPI hin gebaut, nicht auf Datenmengen. Sollte die Bild-Optimierung auf dem gewählten Tarif doch abgerechnet werden, ist das bei `/deploy` zu prüfen — die Obergrenze von 386 Bildern insgesamt steht oben.

---

### Notizen aus dem Build (2026-09-01)

Drei Abweichungen bzw. Präzisierungen gegenüber dem Entwurf, alle innerhalb des genehmigten Designs:

**Die Bildadresse wird nicht serverseitig geprüft.** Der Entwurf ließ offen, wo Stufe 1 der Leiter validiert wird. Serverseitig hätte es eine Anfrage pro Frage im Normalfall gekostet und das Bild doppelt geladen (einmal zur Prüfung, einmal durch die Bild-Optimierung). Stattdessen lädt eine unsichtbare Vorlade-Komponente das Bild **über dieselbe Bild-Optimierung** wie die sichtbare Anzeige — dadurch ist der Wechsel ein Cache-Treffer, ein kaputtes Bild fällt vor der Anzeige auf, und es geht weiterhin keine Anfrage aus dem Browser an das CDN (AC-20). Das rohe CDN direkt vorzuladen wäre einfacher gewesen und hätte AC-20 gebrochen.

**`server-only` wurde nicht ergänzt.** Der Entwurf sagt „keine neuen Pakete"; der PokeAPI-Client trägt deshalb einen Kommentar zur Importgrenze statt der Paket-Absicherung.

**Die Zeit des beendeten Laufs liegt in einem State, nicht nur im Ref.** Das Ergebnis würde sonst während des Renderns aus einem Ref lesen, was die React-Regeln des Projekts (ESLint) zu Recht verbieten.

#### Was im Build verifiziert wurde

| Prüfung | Ergebnis |
|---|---|
| RLS und Grenzwerte über PostgREST, zwei echte Konten | 12/12 — fremde Runden nicht lesbar, fremdes Profil nicht beschreibbar, doppeltes Runden-Kennzeichen abgelehnt, Ändern und Löschen abgelehnt |
| Rundenablauf im Browser (Registrierung → Runde → Ergebnis → neue Runde) | 19/19 |
| Responsivität 1440 / 768 / 375 px, ausgeloggter Zustand, Tastaturfokus | 15/15 — kein horizontales Scrollen, kein Burger-Menü, Chip reduziert sich unter 640 px |
| **AC-31 im Server-Action-Kontext** | belegt: wiederholte Namensabfrage als `cache hit` in 0 ms im Server-Log — nicht nur in einem Route Handler |
| AC-20 hart geprüft | keine einzige Browser-Anfrage an einen fremden Host während einer ganzen Runde |
| `npm run build`, `npm run lint`, `npm test` | grün; 25 bestehende Tests weiterhin bestanden |

**Ein Bug wurde dabei gefunden und behoben:** Das Vorladen aus AC-10 feuerte nie — nach der ersten Frage füllte nichts die Reserve, jede Frage hätte einen Ladezustand gezeigt. Sichtbar wurde das erst im Server-Log (nur ein `getNextQuestion`-Aufruf pro Runde statt mehrerer), nicht in der Oberfläche. Nach der Korrektur: 8 Aufrufe.

#### Nachtrag (2026-09-01, nach Review)

**`server-only` wurde doch ergänzt — als bewusste, abgesprochene Ausnahme von „keine neuen Pakete".** Der ursprüngliche Kommentar zur Importgrenze erzwang nichts: Ein versehentlicher Client-Import des PokeAPI-Clients hätte die Abfragen in den Browser verlagert und AC-31 und AC-20 lautlos gebrochen — genau die Fehlerklasse, gegen die dieses Feature sonst überall absichert. Verifiziert durch einen absichtlich eingebauten Client-Import: Der Build bricht mit „'server-only' cannot be imported from a Client Component module" ab.

**Regressionstest für das Vorladen (`quiz-screen.test.tsx`).** Der Bug war in der Oberfläche unsichtbar und nur im Server-Log erkennbar; eine einmalige Beobachtung sichert nichts für die Zukunft. Zwei Tests: dass nach der ersten sichtbaren Frage sofort eine zweite geladen wird, und dass eine richtige Antwort die vorgeladene Frage ohne Ladezustand zeigt. **Beide wurden rot geprüft**, indem ausschließlich die eine wiederhergestellte Bug-Zeile entfernt wurde (die fünf anderen `fetchQuestion`-Aufrufe blieben intakt) — sie fangen also genau diesen Fehler und nicht irgendeinen.

Damit weicht dieses Feature bewusst von der Konvention ab, dass Tests ausschließlich `/qa` schreibt: Für einen Bug, der beim Anschauen nicht auffällt, gehört der Test zum Fix.

---

### Notizen aus dem Fix-Lauf (2026-09-04)

Vier Befunde aus dem QA-Lauf vom selben Tag behoben: BUG-10 (AC-9), BUG-7 (EC-3), BUG-8 (EC-6) und BUG-13 (AC-31). Alle vier innerhalb des genehmigten Designs; die einzige Design-Änderung ist der oben korrigierte Übergang.

**Der Transport-Fänger liegt jetzt feature-neutral in `src/lib/actions/run-action.ts`.** PROJ-1 hatte denselben Fehlertyp am 2026-09-01 gefunden und mit `src/lib/auth/run-action.ts` behoben — in einem *Feature*-Ordner. PROJ-2 baute ihn deshalb ein zweites Mal ein (BUG-7): Ein `await saveRun(...)` ohne `try/catch` ließ bei einem Verbindungsabbruch alle folgenden Zeilen aus, `saveState` blieb auf `'saving'`, und der Ergebnis-Screen sah aus wie ein gespeichertes Ergebnis. Die Fehler-UI aus EC-3 existierte und war unerreichbar. Der generische Kern `runClientAction(call, fallback)` deckt jetzt beide Features ab; `runAuthAction` ist sein Auth-Zuschnitt und bleibt in Verhalten und Tests unverändert. Im Quiz gehen `saveRun` und `getNextQuestion` hindurch. (`repairImageUrl` stand hier ebenfalls, bis die Rückfallebene am 2026-09-04 entfiel — siehe EC-11.)

**Eine unveränderte Bildadresse ist keine Reparatur (BUG-8).** Der Entwurf beschreibt die Rückfallebene als „offizielle Adresse über `/pokemon/{id}` nachschlagen" — und übersah, dass diese Adresse im Normalfall **genau die konstruierte ist**. `repairImageUrl` gab sie zurück, `setProbing` setzte denselben `src`, `ImageProbe`s `key` blieb gleich, der Browser lud nicht neu, `onError` feuerte kein zweites Mal — und die Runde hing dauerhaft auf „Runde wird vorbereitet …", ohne Meldung und ohne Ausweg. Betroffen war real **jeder Ausfall des Sprite-CDN**, also genau der Fall, für den EC-6 geschrieben wurde. Der Fix ist eine Zeile: Nur eine *abweichende* Adresse gilt als Reparatur, sonst greift der Verwurf aus EC-6. Damit werden EC-10 und EC-11 überhaupt erst erreichbar — beide Unit-Tests waren vorher grün, weil sie die Funktion direkt aufriefen und eine abweichende Adresse mockten.

**Die Verwurfsgrenze gilt jetzt auch beim Vorladen (BUG-13).** Sie hing an `!hasCurrentRef.current`, griff also nur, wenn der Spieler auf die Frage wartete. Fiel die Bildquelle aus, *während* er noch antwortete, zog das Vorladen endlos neue Fragen nach — je vier Namensabfragen an die PokeAPI, ohne Backoff. Das widersprach der eigenen Begründung im Decision Log („der Nutzer klickt selbst, es entsteht also keine automatische Last gegen die Fair-Use-Policy") und war nur deshalb nicht sichtbar, weil BUG-8 die Schleife vorher zum Stillstand brachte. Die Grenze stoppt das Nachziehen jetzt in beiden Fällen; die Fehlerkarte zeigt sie weiterhin nur dem, der wartet. Bleibt das Vorladen an der Grenze stehen und der Spieler kommt später dort an, führt `advance` direkt in den Fehlerzustand — das ist EC-10, nur zeitversetzt.

**Vier Abnahmetests, alle rot geprüft.** In `quiz-screen.error-states.test.tsx`, plus `src/lib/actions/run-action.test.ts` für den generischen Kern. Jeder wurde einzeln gegen den wiederhergestellten Fehler gefahren und fiel dort:

| Test | ohne den Fix |
|---|---|
| EC-3 / BUG-7 | rot — kein Hinweis, kein „Erneut speichern" |
| EC-6 / BUG-8 | rot — eine Frage, eine Adresse, keine zweite Anfrage |
| AC-31 / BUG-13 | rot — zweistellig viele `getNextQuestion`-Aufrufe |
| AC-9 / BUG-10 | rot — „Runde starten" steht wieder da |

**Eine Lehre aus dem BUG-8-Test, die über diesen Fix hinausgeht.** Der erste Entwurf des Tests feuerte `error` in einer Schleife auf alle Bilder — und war **auch gegen den kaputten Code grün**. Genau das Von-Hand-Feuern ist nämlich das, was der Browser nicht tut: Der Fehler *besteht* darin, dass kein zweites Ereignis kommt. Ein Test, der das fehlende Ereignis selbst nachliefert, prüft den Fehler weg. Der jetzige Test feuert genau einmal und verlangt, dass die Runde von sich aus weitergeht.

**Nicht behoben, bewusst:** BUG-9 (Medium, EC-7) teilt die Wurzel mit BUG-7, braucht aber eine eigene Entscheidung — der Proxy fängt den Server-Action-POST ab und antwortet mit HTML, was sich von einem gewöhnlichen Verbindungsabbruch nicht zuverlässig unterscheiden lässt. Mit dem Fänger sieht der Spieler jetzt immerhin „konnte noch nicht gespeichert werden" statt eines Ergebnis-Screens, der Erfolg vortäuscht; die von EC-7 zugesagte Weiterleitung auf `/login` bleibt offen. Ebenfalls offen: BUG-11 (Low, AC-25) und BUG-12 (Low).

---

### Notiz zur E2E-Instabilität (2026-09-04) — eine korrigierte Fehlzuschreibung

`npm run test:e2e` war bei der Standard-Worker-Zahl (16 auf dieser Maschine) reproduzierbar rot, 5 bis 6 von 24. Die erste Erklärung lautete: Ursache ist BUG-15, das hängende Bild ohne Zeitgrenze. **Das war falsch, und es ist lehrreich, warum.**

Das Symptom passte perfekt — die Seite stand auf „Runde wird vorbereitet …", genau dem Bild, das BUG-15 beschreibt. Nach dem Einbau der Zeitgrenze blieben aber **6 von 24 rot**. Erst das Nachmessen zeigte die Kette:

1. Playwright gibt bei einer Erwartung nach **5 Sekunden** auf. Die App hat nach AC-15 **zehn** (5 s plus stiller Versuch). Der Test war ungeduldiger als der Vertrag — er hätte den Fix gar nicht sehen können.
2. Mit 20 Sekunden Geduld blieben **4 rot**, und zwar an einer *anderen* Stelle: bei einer bereits offenen Frage mit vier Optionen. Das ist AC-2s 3-Sekunden-Budget, das unter 16-facher Last auf **einem** Dev-Server nicht zu halten ist.
3. Auch der Mail-Ablauf von PROJ-1 wurde in derselben Konstellation instabil — ein Feature, das mit Bildern nichts zu tun hat.

Es war also **Kontention im Messaufbau**, kein Produktfehler. Bestätigt durch die Gegenprobe: Derselbe Flake trat in derselben Rate schon **vor** den Fixes vom 2026-09-04 auf (gegen `4709193` gemessen). Konsequenz: Die Worker-Zahl ist in `playwright.config.ts` auf 4 gedeckelt; damit läuft die Suite reproduzierbar 24/24.

**Was daran hängenbleibt:** Ein passendes Symptom ist noch keine Ursache. BUG-15 war echt und ist behoben — aber er war nicht *dieser* Fehler, und die beiden zu verwechseln hätte bedeutet, den Flake für erledigt zu halten und das Gate weiter für vertrauenswürdig zu nehmen, obwohl es die Maschine misst statt die App.

---

### Was der Wächter über die Server Actions leistet — und was nicht (Stand 2026-09-05)

Mit BUG-9 ist die Sitzungsprüfung von der Schranke *davor* (Proxy) zur Schranke *darin* (Action) gewandert. Das ist das vom Framework vorgesehene Muster, es hat aber eine offensichtliche Schwäche: Es hält nur, solange jede Action daran denkt. `src/lib/actions/server-actions.guard.ts` ist der Versuch, das maschinell abzusichern.

**Dieser Abschnitt ist zweimal umgeschrieben worden, weil er zweimal mehr versprochen hat, als der Code hielt** (BUG-20, dann BUG-32). Deshalb steht hier jetzt die Grenze zuerst.

#### Was er zuverlässig leistet

- **Er findet jede Server Action.** Ein QA-Verifizierer hat am 2026-09-05 alle in `node_modules/next/dist/docs/` dokumentierten Formen durchprobiert — Datei-Direktive, Inline-`'use server'` im Funktionsrumpf, Pfeilfunktion, Objekt-Methode, anonymer Default-Export, Currying, `export { inner as doThing }`, HOF-Umhüllung, `async function*`, `'use client'` davor. **Keine wurde übersehen.**
- **Was er nicht analysieren kann, lässt er nicht durch.** Re-Exporte und destrukturierte Exporte fallen als „nicht analysierbar" durch, statt stillschweigend übersprungen zu werden.
- **Er kann nicht still grün werden.** Der Gegenzeuge verlangt, dass jede Datei, die `use server` erwähnt, mindestens eine Action liefert, und hält Mindestzahlen für Actions und Dateien. Bricht die Erkennung, wird der Test rot statt leer — das war die Lücke, an der die erste Fassung scheiterte.

#### Was er ausdrücklich **nicht** leistet

**Er prüft, ob ein Aufruf namens `getUser` im Rumpf steht — nicht, ob eine Sitzung wirksam geprüft wird.** Folgende Attrappen kommen durch, alle am 2026-09-05 gemessen:

| Form | Urteil des Wächters |
|---|---|
| Eigene lokale `function getUser() { return { id: 'anyone' } }` | grün |
| `if (false) { await supabase.auth.getUser() }` | grün |
| Aufruf hinter einem Feld, das der Aufrufer nie setzt | grün |
| Ein Callback mit dem Aufruf, der nie ausgeführt wird | grün |
| `await supabase.auth.getUser()`, dessen Ergebnis niemand auswertet | grün |

**Das bleibt so.** Ein Prüfer, der entscheidet, ob das Ergebnis eines Aufrufs den Ablauf tatsächlich steuert, ist eine Datenflussanalyse — er bräuchte Typinformationen, Erreichbarkeitsanalyse und eine Vorstellung davon, was „den Ablauf steuern" heißt. Der dritte Anlauf auf dieselbe Zusicherung würde denselben Fehler zum dritten Mal machen: einen Prüfer bauen, der etwas Schwächeres misst, als sein Name behauptet, und dem man deshalb zu Unrecht vertraut.

**Weitere benannte Grenzen:**

- **`PUBLIC_ACTIONS` befreit nach Namen, nicht nach Datei** (BUG-34). Eine neue Action, die irgendwo in `src/` `loginAction` heißt, ist automatisch befreit. Die „Begründungspflicht" ist eine Längenprüfung.
- **Er sieht nur `.ts`/`.tsx` unterhalb `src/`.** Eine Action in `.js`/`.mjs` oder außerhalb wäre für Erkennung **und** Gegenzeugen gleichzeitig unsichtbar.
- **Er läuft jetzt vor jedem Commit, der Code enthält** (BUG-36, behoben am 2026-09-05). Die frühere Begründung an dieser Stelle — „läuft in `npm test`, also in der Prüfung, die vor jedem Commit ohnehin fährt" — war zum Zeitpunkt des Schreibens **unbelegt**: Es gab kein `.husky/`, kein `.github/workflows/` und keinen Hook. Seit `.githooks/pre-commit` stimmt sie, und zwar nachprüfbar: Der Hook wird über `core.hooksPath` aktiviert (gesetzt vom `prepare`-Skript, überlebt also einen frischen Klon) und fährt `npm test`, sobald `src/`, `tests/`, `supabase/`, `package.json` oder eine Konfigurationsdatei im Commit liegt. **Die Grenze bleibt benannt:** `git commit --no-verify` umgeht ihn, und das ist Absicht — ein Wächter ohne Notausgang wird ausgebaut statt benutzt.

#### Was daraus folgt — die Aufgabenteilung

**Der Wächter beantwortet eine Frage: „Gibt es eine Server Action, an die beim Schreiben niemand gedacht hat?"** Das ist die Frage, die im Alltag schiefgeht — eine neue Action, geschrieben unter Zeitdruck, ohne den Gedanken an die Sitzung. Dagegen hilft er zuverlässig, und dafür ist er gebaut.

**Ob die vorhandene Prüfung etwas taugt, bleibt Sache des Code-Reviews.** Das ist keine Ausrede, sondern die ehrliche Grenze: Eine Attrappe wie `if (false) { getUser() }` entsteht nicht aus Vergesslichkeit, sondern nur absichtlich oder durch einen groben Fehler — und beides fällt einem Menschen auf, der den Diff liest. `.claude/rules/security.md` verlangt für Änderungen am Authentifizierungsfluss ohnehin ausdrückliche Zustimmung; genau dort sitzt diese Verantwortung.

**Für den Review heißt das konkret:** Bei jeder neuen oder geänderten Server Action nicht prüfen, *ob* `getUser` vorkommt — das tut der Wächter —, sondern **ob sein Ergebnis den Ablauf beendet**, also ob auf einen fehlenden Nutzer wirklich ein früher Rücksprung folgt.

**Und deshalb steht in `src/proxy.ts` kein Satz mehr, der sich auf den Wächter verlässt.** Der Kommentar dort behauptete, der Wächter halte die Sitzungsprüfung davon ab, „still zu verfallen". Das tut er nur für den Fall der vergessenen Action, nicht für den der unwirksamen Prüfung.

## Notizen aus dem Bau von Level 9 (2026-09-08)

**Der Fix wirkt, gemessen mit lokal umgelegtem Schalter** (nicht committet, danach zurückgedreht), angemeldet, Trainername mit vollen 20 Zeichen:

| Breite | vorher (Befund) | nachher |
| --- | --- | --- |
| 320 px | Kopfzeile braucht 375, „Abmelden" endet bei 375 → 55 px außerhalb | Kopfzeile 320/320, „Abmelden" endet bei **310**, Seite scrollt nicht |
| 360 px | 15 px außerhalb | endet bei 350, kein Überlauf |
| 375 px | gerade eben | endet bei 365, kein Überlauf |

Knopfhöhe bleibt in allen Stufen **36 px**, die Schrift unter 400 px **13 px** — beide Untergrenzen aus dem Entwurf gehalten.

**Zwei Dinge, die der Bau zutage gefördert hat:**

1. **Ein Off-by-one im Haltepunkt.** `max-[399px]:` erzeugt in Tailwind v4 `width < 399px` — bei genau 399 px stand der Schriftzug also noch da, obwohl der Vertrag „unter 400 px" sagt. Aufgefallen ist es nur, weil die Messreihe 399 **und** 400 enthielt; mit den runden Werten 320/360/375/440 wäre es durchgerutscht. Korrigiert auf `max-[400px]:`, danach nachgemessen: 399 aus, 400 an.
2. **Der Schriftzug bricht zwischen 400 und unter 440 px weiterhin auf zwei Zeilen um** (Wortmarke 51 statt 28 px hoch, gemessen bei 400/401/420; bei 440 wieder 28). Das ist **kein** Überlauf und verletzt kein Kriterium — AC-43 gilt ab 320 px und ist erfüllt. Es ist auch nicht neu: Vor dem Fix begann dasselbe Umbrechen schon bei 320 px. Der Fix hat das Band also verkleinert, nicht erzeugt. Bewusst nicht mitbehoben, weil dafür der Haltepunkt auf ~440 px steigen müsste — das wäre eine Vertragsänderung, keine Umsetzung.

**Zum Test (T59).** Er prüft **jedes** Bedienelement der Kopfzeile statt namentlich „Abmelden", damit er auf diesem Branch wahr ist und beim Merge von PROJ-3 von selbst greift. Die Höhen-Untergrenze gilt dabei ausdrücklich nicht für den Wortmarken-Link: Der ist mit dem Ball-Motiv 28 px hoch, war das vorher schon, und ihn hier einzubeziehen hieße den Umfang des Fixes still zu erweitern.

**Rot-Gegenprobe, mit eingeschaltetem Schalter geführt** — anders wäre sie wertlos gewesen, weil die Kopfzeile ohne den dritten Eintrag ohnehin passt:

- Schalter an, Fix drin → **7/7 grün**
- Schalter an, Wortmarken-Reduktion entfernt → **2 rot**, mit der richtigen Diagnose: „die Seite ist 334 px breit bei 320 px sichtbar — sie scrollt waagerecht (AC-43)" und „bei 399 px darf kein Schriftzug stehen"
- zurückgedreht → wieder **7/7 grün**

Dass dabei nur der 320-px-Fall fällt und 360/375 halten, ist der Beleg dafür, dass die engeren Maße ihren Teil des Budgets tatsächlich tragen.

**Eine Stolperfalle im Testaufbau, für die nächste Person:** `uniqueTrainer` hängt Zeitstempel und Zufallsanteil an das Präfix und kürzt auf 20 Zeichen. Ein zu langes Präfix schneidet damit den eindeutigen Teil weg — beim ersten Anlauf wollten alle drei parallelen Tests denselben Namen registrieren, und der Fehlschlag sah aus wie ein Zeitproblem („waitForURL timeout"), nicht wie ein vergebener Name.
