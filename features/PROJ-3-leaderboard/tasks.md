# PROJ-3 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Der geordnete, nachvollziehbare Bauplan — die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: Die Dateien dieser Aufgabe sind disjunkt zu jeder anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also in einen eigenen Unteragenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Innerhalb einer Ebene läuft parallel, was `[P]` trägt. Jede Aufgabe verweist auf die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur der Nutzer vornehmen kann. **PROJ-3 hat keine** — `design.md` → „Settings the user makes" ist leer.
> Der Status lebt ausschließlich in `features/INDEX.md`.

## Level 1 — Datenschicht

<!-- Fundament. Eine Migration, alles andere hängt daran. -->

- [x] T1  Migration `0015_leaderboard.sql`: die Ranglisten-Funktion. Wählt pro Profil den besten Lauf aus allen Runden mit **Serie ≥ 1**, nummeriert diese Bestläufe nach **einer** vierstufigen Regel durch (Serie absteigend · Dauer aufsteigend · Zeitpunkt aufsteigend · laufende Rundennummer aufsteigend) und gibt die Plätze 1–5 heraus, dazu die Zeile des Aufrufers, falls dessen Platz größer als 5 ist. Ausgabe je Zeile: Platz, Trainername, Serie, Dauer und ein Wahrheitswert „ist der Aufrufer" — **keine Konto-Kennung, kein Zeitstempel**. `security definer` mit festem `search_path`; `revoke all` von `public`, `anon` und `authenticated`, `grant execute` nur für `service_role` — dasselbe Muster wie `0003`, `0006`, `0009` und `0013`  · files: supabase/migrations/0015_leaderboard.sql  · → AC-2, AC-3, AC-4, AC-5, AC-6, AC-19, AC-20, AC-21, AC-22, EC-1, EC-4, EC-5, EC-7

## Level 2 — Serverseitige Bausteine

<!-- Setzt T1 voraus. Drei disjunkte Dateimengen; keine importiert eine andere. -->

- [x] T2 [P]  Datenzugriff: Sitzung über den Auth-Server prüfen, die Funktion aus T1 über den Administrationszugang aufrufen, das Ergebnis **oder einen Fehlerzustand als Rückgabewert** liefern — nichts werfen, damit die Seite entscheiden kann, welcher Teil ausgetauscht wird (EC-6). Kein Zwischenspeichern in irgendeiner Form. Zieht dabei den überholten Kommentar in `admin.ts` nach: Er behauptet, der Zugang diene „ausschließlich" dem Fehlversuchszähler — seit den Rundenfunktionen aus `0009` stimmt das nicht mehr  · files: src/lib/leaderboard/queries.ts, src/lib/leaderboard/queries.test.ts, src/lib/supabase/admin.ts  · → AC-11, AC-13, AC-19, AC-20, EC-6, EC-8
- [x] T3 [P]  Formatierung: Dauer als `mm:ss,s` — Minuten und Sekunden zweistellig, ein Zehntel nach dem **Komma**, gerundet auf das nächste Zehntel. Dazu der Abstand zur Top-5 als `Platz − 5`. Eigene Datei, **die Formatierung von PROJ-2 wird nicht angefasst**  · files: src/lib/leaderboard/format.ts, src/lib/leaderboard/format.test.ts  · → AC-1, AC-7, EC-2
- [x] T4 [P]  Schutz- und Regeltests gegen die Migration, jeder gegen den wiederhergestellten Fehler rot geprüft. **Zugriff:** Die Funktion ist mit einer gewöhnlichen Nutzersitzung und dem öffentlichen Schlüssel **nicht** aufrufbar · die Runden eines anderen Spielers bleiben über die Tabelle unlesbar. **Regeln,** mit Server-Rechten gegen gesäte Daten geprüft: pro Spieler genau eine Zeile, auch bei dreihundert Runden · Serie 0 erscheint nie · Reihenfolge über zwei Aufrufe identisch, auch bei gleicher Serie und gleicher Dauer · bei komplettem Gleichstand steht der früher **beendete** Lauf oben · weniger als fünf gewertete Spieler ergeben genau so viele Zeilen. Steht hier statt am Ende, weil offen gebliebene Rechte in PROJ-2 zweimal erst spät auffielen (BUG-110, BUG-122) — direkt hinter der Migration ist der billigste Fundort  · files: tests/PROJ-3-leaderboard-db-guard.spec.ts  · → AC-2, AC-3, AC-5, AC-6, AC-19, EC-1, EC-5, EC-7

## Level 3 — Anzeige-Bausteine

<!-- Fünf disjunkte Dateien, keine importiert eine andere. Die breiteste Stufe des Plans. -->

- [x] T5 [P]  Ranglisten-Zeile: Raster aus vier Feldern — Platz, Trainername, Serie, Zeit. Platz, Serie und Zeit mit **festen Breiten** und `tabular-nums`, damit die Spalten bündig stehen; **nur der Name gibt nach** und kürzt mit Auslassungspunkten statt umzubrechen, vollständiger Name als Titel-Attribut. Kein horizontales Scrollen unter 640 px. Gold (`--accent`) für Platz 1; die eigene Zeile hervorgehoben mit „Du"-Marker in Akzenttext  · files: src/components/leaderboard/leaderboard-row.tsx  · → AC-1, AC-8, AC-10, AC-18, EC-9
- [x] T6 [P]  Abgesetzte eigene Zeile: „Platz N — noch X bis Top 5", sichtbar vom Listenblock getrennt (Abstand plus Trennlinie), damit sie nicht wie Platz 6 der Liste aussieht. Hervorhebung **identisch** zu der in der Liste  · files: src/components/leaderboard/own-rank-row.tsx  · → AC-7, AC-10, EC-2
- [x] T7 [P]  Leerzustand: gedämpftes Ball-Motiv, **ein** Satz, darunter „Runde starten" als Primär-Button. Der Satz muss die Aussage von AC-9 tragen (mindestens eine Frage richtig beantworten, um in die Wertung zu kommen) — er ist zugleich der Leerzustand aus AC-17 und der Hinweis aus AC-9, nicht zwei gestapelte Meldungen  · files: src/components/leaderboard/leaderboard-empty.tsx  · → AC-9, AC-14, AC-17
- [x] T8 [P]  Fehlerkarte **innerhalb** der Karte, nie ganzseitig, mit „Erneut versuchen" — lädt die Serverseite neu, unbegrenzt oft. Der einzige clientseitige Baustein dieses Features, und genau deshalb  · files: src/components/leaderboard/leaderboard-error-card.tsx  · → EC-6
- [x] T9 [P]  Skelett: fünf Zeilen in **exakter** Zeilenhöhe plus eine abgesetzte sechste, mit sanftem Puls. Kein alleinstehender Spinner — Regel der App-Shell  · files: src/components/leaderboard/leaderboard-skeleton.tsx  · → AC-16

## Level 4 — Zusammensetzen

<!-- Setzt Level 3 voraus. Zwei disjunkte Dateien; T11 braucht nur das Skelett aus T9, nicht die Karte. -->

- [x] T10 [P]  Die Karte: wählt anhand des Abfrageergebnisses genau **einen** Zustand — Liste, Leerzustand oder Fehlerkarte. Innerhalb der Liste: eigene Zeile hervorgehoben, wenn Platz ≤ 5 (dann **keine** Zusatzzeile), sonst die abgesetzte Zeile darunter; ohne gewerteten Lauf der Hinweis aus AC-9. Darunter der Datenschutz-Satz in gedämpfter Schrift: welche Daten für andere angemeldete Spieler sichtbar sind **und** dass nur der beste Lauf erscheint. **Kein Abo, kein Polling, kein Intervall, kein automatischer Neuaufbau**  · files: src/components/leaderboard/leaderboard-card.tsx  · → AC-6, AC-8, AC-9, AC-12, AC-24, EC-3
- [x] T11 [P]  Ladezustand der Route auf Basis des Skeletts aus T9  · files: src/app/leaderboard/loading.tsx  · → AC-16

## Level 5 — Die Seite

<!-- Läuft allein: T12 importiert die Karte aus T10. Eine Schranke ist hier ehrlicher als eine abgesprochene Schnittstelle zwischen zwei parallelen Agenten. -->

- [x] T12  Server Component `/leaderboard`: **eigene** Sitzungsprüfung vor jeder Datenabfrage (die zweite, unabhängige Schranke neben dem Routen-Schutz in `src/proxy.ts`), Seitentitel im Inhaltsbereich statt in der Kopfzeile, „Runde starten" als Primär-Aktion mit Ziel `/`, `robots`-Metadaten „nicht indexieren, Links nicht verfolgen". Die App-Shell wird unverändert übernommen — **keine zweite Kopfzeile, keine eigene Navigation**. Ausdrücklich verboten auf dieser Route: `use cache`, `unstable_cache`, `revalidate`, `force-static`  · files: src/app/leaderboard/page.tsx  · → AC-11, AC-12, AC-13, AC-14, AC-15, AC-23, EC-8

## Level 6 — Freischaltung und Absicherung

<!-- Setzt die fertige Seite voraus: vorher schaltete T13 auf eine 404 frei und T14 prüfte gegen eine. Zwei disjunkte Dateien. -->

- [x] T13 [P]  `LEADERBOARD_PAGE_EXISTS` auf `true`. Das schaltet den Bestenlisten-Zugang in der Kopfzeile (PROJ-2, AC-21) **und** die Aktion „Zur Bestenliste" im Ergebnis-Screen (PROJ-2, AC-7) gemeinsam frei — es gibt bewusst nur diesen einen Schalter, weil die Regel „Link erst, wenn die Zielseite existiert" in diesem Projekt schon dreimal an verschiedenen Stellen verletzt wurde  · files: src/lib/site-pages.ts  · → AC-15
- [x] T14 [P]  Schutztests auf Seitenebene, jeder gegen den wiederhergestellten Fehler rot geprüft: die ausgelieferte Antwort enthält **keine** Konto-Kennung und keine E-Mail-Adresse fremder Spieler · ein nicht angemeldeter Aufruf von `/leaderboard` liefert **keine** Trainernamen, sondern die Umleitung auf `/login` · die Seite trägt die Anweisung, nicht indexiert zu werden · eine abgelaufene Sitzung führt auf `/login` statt auf eine halb geladene Liste  · files: tests/PROJ-3-leaderboard-page-guard.spec.ts  · → AC-13, AC-20, AC-23, EC-8

## Parallelization

- **Ebenen sind Schranken.** Eine Ebene beginnt erst, wenn die vorherige vollständig integriert und gegen ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Server (L2) → Bausteine (L3) → Zusammenbau (L4) → Seite (L5) → Freischaltung (L6).
- **`[P]` verlangt disjunkte Dateien.** Geprüft: In keiner Ebene teilen sich zwei `[P]`-Aufgaben einen Pfad. Die breiteste Stufe ist Level 3 mit fünf gleichzeitigen Aufgaben.
- **T10 und T12 stehen bewusst in getrennten Ebenen,** obwohl ihre Dateien disjunkt wären: T12 importiert die Karte aus T10. Eine Schranke ist verlässlicher als eine abgesprochene Schnittstelle zwischen zwei parallel laufenden Agenten.
- **Keine `[user]`-Aufgaben.** PROJ-3 prüft keine Zugangsdaten, verschickt keine E-Mail und braucht keine Einstellung in einem fremden Dashboard. Die beiden Deploy-Blocker, die diese Seite mitbetreffen (Security-Header BUG-12, `X-Forwarded-Host` BUG-18), stehen in `features/INDEX.md` und gehören nicht in diesen Bauplan.

## Prüfhinweise für `/qa`

- **Der positive Zweig von PROJ-2s AC-7 und AC-21 ist nie geprüft worden.** Beide Kriterien sind bedingt formuliert („genau dann, wenn die Ranglisten-Seite existiert"), und alle bisherigen QA-Läufe haben ausschließlich den negativen Zweig belegt — mit `LEADERBOARD_PAGE_EXISTS=false` ausdrücklich als Beweis (`PROJ-2/qa-report.md:1946`, `:2289`, `:2320`). Das letzte Mal, dass „Bestenliste" tatsächlich in der Kopfzeile stand (`:66`, `:311`), war es der tote Link aus BUG-23. **T13 aktiviert damit einen Zustand, den noch nie jemand in funktionierender Form gesehen hat.** Kein Vertragsbruch — PROJ-2 bleibt `Approved`, sein Wortlaut deckt beide Seiten —, aber eine echte Prüflücke: Der Zugang in der Kopfzeile und die Aktion im Ergebnis-Screen müssen im QA-Lauf zu PROJ-3 als **vorhanden und funktionierend** belegt werden, nicht nur als vorhanden.
- **Darstellung und Responsive-Verhalten braucht einen Browser.** AC-16, AC-18 und EC-9 (Skelettzeilen, kein horizontales Scrollen unter 640 px, Kürzung eines 20-Zeichen-Namens) sind über Quelltext nicht belastbar zu belegen. Dieselbe Lücke, die bei PROJ-2 über fünf Läufe offen blieb — dort steht sie als „Die größte Lücke ist keine Bug-Nummer" in `features/INDEX.md`. Einplanen: `/e2e-tests` nach `/qa`.
- **AC-11 ist ein Negativ-Nachweis.** „Es wird keine zwischengespeicherte Fassung ausgeliefert" ist nur zu belegen, indem eine gerade beendete Runde sofort in der Liste erscheint — nicht dadurch, dass keine Cache-Anweisung im Code steht.

## Notizen aus dem Bau (2026-09-08)

Zwei Abweichungen vom Plan, beide beim Bauen entstanden und beide belegt:

- **Eine Datei mehr als geplant: `src/app/leaderboard/page.test.tsx`** (zu T12).
  Grund: Die Gegenprobe zu T14 hat gezeigt, dass der E2E-Test die **zweite**
  Schranke gar nicht prüfen kann. Entfernt man die Umleitung in `page.tsx`,
  bleibt er grün — weil `src/proxy.ts` die ausgeloggte Anfrage schon vorher
  abfängt. `design.md` und `.claude/rules/security.md` sagen aber zwei
  unabhängige Prüfungen zu. Dieser Unit-Test pinnt die zweite ohne Proxy;
  mit derselben Mutation ist er rot (`expected "vi.fn()" to be called with
  arguments: [ '/login' ]`) und nach der Rücknahme wieder grün.
- **T4 prüft die Sortierung als Invariante, nicht an absoluten Plätzen.**
  Die Suite läuft parallel in drei Engines gegen **eine** Datenbank, in die die
  PROJ-2-Journeys gleichzeitig Runden schreiben; „Alpha steht auf Platz 1" misst
  darin die Nachbartests. Die vierstufige Regel gegen einen kontrollierten
  Bestand ist stattdessen beim Bau in SQL nachgewiesen worden — 100.000 Runden
  auf 4.008 Spieler, Beleg im Kopf von `0015_leaderboard.sql` und in
  `design.md` → Technical Decisions.

**Ebenfalls beim Bau korrigiert:** Der Leerzustand trägt laut AC-17 selbst einen
„Runde starten"-Button. Der zusätzliche Seiten-Button aus AC-14 hätte daneben
zwei identische Primär-Aktionen ergeben; er entfällt deshalb genau in diesem
einen Zustand (`page.tsx` → `cardCarriesTheAction`).

### Befund aus dem Bau, der PROJ-2 gehört (nicht hier behoben)

**Unter 375 px scrollt jede angemeldete Seite waagerecht, seit T13 den
Bestenlisten-Zugang freigeschaltet hat.** Gemessen am 2026-09-08 gegen den
laufenden Dev-Server, angemeldet, Trainername `HdrCheck2` (8 Zeichen, also kein
Extremfall):

| Fensterbreite | Kopfzeile braucht | Seite scrollt waagerecht |
| --- | --- | --- |
| 320 px | 375 px | **ja** |
| 344 px | 375 px | **ja** |
| 360 px | 375 px | **ja** |
| 375 px | 375 px | nein |
| 390 px | 390 px | nein |
| 414 px | 414 px | nein |

Gegenprobe mit zurückgedrehtem Schalter: Kopfzeile 320 bei 320 — **vorher passte
sie exakt**. Der Zugang ist also die Ursache, nicht ein vorhandener Fehler, der
jetzt erst auffällt.

**Warum das hier nicht behoben wird.** Die Ursache liegt in
`src/components/shell/site-header.tsx`, und der Rahmen gehört laut
`docs/app-shell.md` → Besitzendes Feature zu **PROJ-2**. Dort steht außerdem die
Annahme, die der Befund widerlegt: „Bei zwei Bereichen passt beides in die
Kopfzeile — der Nutzer-Chip reduziert sich unter `sm` auf die Initiale." Die
Reduktion greift bereits und reicht trotzdem nicht. Das ist eine Änderung am
Verhalten der Shell und gehört deshalb in ein **`/refine PROJ-2`**, nicht in das
`design.md` dieses Features.

**Kein AC von PROJ-3 ist davon verletzt:** AC-18 betrifft die Ranglisten-Zeile,
und die hält (bei 375 / 768 / 1440 px kein waagerechtes Scrollen, 20-Zeichen-Name
gekürzt statt umgebrochen, gemessen). Der Befund trifft die Shell auf **jeder**
Route, auch der Spielseite.
