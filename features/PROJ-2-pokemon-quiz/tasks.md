# PROJ-2 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Dies ist der geordnete, nachvollziehbare Bauplan — die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: Die Dateien der Aufgabe sind disjunkt zu jeder anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also in einen eigenen Subagenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe verweist auf die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette AC → Task → Test.
> Besitzer: `/tasks` erzeugt diese Datei; `/build` hakt die Kästchen ab.

**Keine `[user]`-Aufgaben.** `design.md` → Settings the user makes ist leer: Dieses Feature braucht keine Einstellung in einem Anbieter-Dashboard.

## Level 1 — Datenschicht

<!-- Fundament. Läuft zuerst, weil alles Weitere auf dem Datenvertrag aufsetzt. -->

- [x] T1  Migration `runs`: Tabelle (Profil-Verweis mit Löschkaskade, Serie, Dauer, Runden-Kennzeichen, Zeitstempel), Grenzwerte als Datenbankregeln (Serie 0–386, Dauer ≥ 0, Dauer ≥ 500 × Serie), eindeutiges Runden-Kennzeichen, RLS (lesen nur eigene, anlegen nur für sich selbst, kein Ändern/Löschen), zusammengesetzter Index über Profil + Serie absteigend + Dauer aufsteigend  · files: supabase/migrations/0002_runs.sql  · → AC-11, AC-12, AC-14, AC-26, AC-27, EC-4

## Level 2 — Server-Bausteine

<!-- Drei voneinander unabhängige Bausteine, drei verschiedene Dateien → alle [P]. -->

- [x] T2 [P]  PokeAPI-Anbindung: deutschen Namen über `/pokemon-species/{id}` holen, **mit ausdrücklich erzwungenem Zwischenspeicher (30 Tage)** — das Standardverhalten cached nicht, siehe `design.md`; Bildadresse aus der Pokémon-Nummer bilden ~~und bei fehlendem Bild über `/pokemon/{id}` die offizielle Adresse nachschlagen~~ (**der Nachschlage-Teil ist am 2026-09-04 durch T18 zurückgenommen worden — siehe EC-11**); 5-Sekunden-Zeitgrenze mit genau einem stillen Wiederholungsversuch  · files: src/lib/pokeapi/client.ts  · → AC-15, AC-28, AC-31, EC-5, EC-8, EC-11
- [x] T3 [P]  Prüfschema für Rundenergebnisse: Serie ganzzahlig 0–386, Dauer ganzzahlig ≥ 0, Dauer ≥ 500 × Serie, Runden-Kennzeichen als UUID  · files: src/lib/validation/quiz.ts  · → AC-12
- [x] T4 [P]  Bild-Auslieferung und Beobachtbarkeit konfigurieren: Bild-Host für die Sprites freischalten (damit der Browser nur die eigene Domain anfragt), Zwischenspeicher-Dauer für optimierte Bilder setzen, `fetch`-Protokollierung für den Entwicklungsmodus aktivieren (macht Cache-Treffer für `/qa` überhaupt sichtbar, siehe Prüfhinweise unten)  · files: next.config.ts  · → AC-20, AC-28, AC-31

## Level 3 — Server Actions

<!-- Setzen auf Level 2 auf. Zwei verschiedene Dateien → beide [P]. -->

- [x] T5 [P]  Server Action „nächste Frage": nimmt die Liste der bereits gezeigten Nummern entgegen, zieht eine neue Lösung plus drei verschiedene falsche Optionen aus 1–386, holt alle vier deutschen Namen, mischt die Reihenfolge, verwirft ein Pokémon ohne deutschen Namen serverseitig und zieht neu, meldet „Pool leer" wenn alle 386 verbraucht sind, weist Aufrufe ohne gültige Sitzung ab  · files: src/lib/quiz/question-action.ts  · → AC-3, AC-5, AC-15, EC-2, EC-5, EC-6, EC-7, EC-11
- [x] T6 [P]  Server Action „Runde speichern" (prüft serverseitig gegen das Schema aus T3, schreibt immer für das Profil aus der Sitzung, zweite Einreichung desselben Runden-Kennzeichens erzeugt keine zweite Zeile und meldet trotzdem Erfolg) plus Lesefunktion für die persönliche Bestleistung  · files: src/lib/quiz/run-actions.ts  · → AC-8, AC-11, AC-12, AC-14, AC-27, EC-3, EC-4, EC-7

## Level 4 — UI-Bausteine

<!-- Reine Darstellung, keine Zustandslogik. Drei disjunkte Dateimengen → alle [P]. -->

- [x] T7 [P]  App-Shell: Wortmarke (Ball-Motiv in CSS gezeichnet, kein offizielles Logo), Kopfzeile mit beiden Auth-Zuständen und Nutzer-Chip (unter 640 px nur die Initiale), Fußzeile, die nur Links zu bereits existierenden Rechts-Seiten zeigt, Seitenrahmen, alles im Wurzel-Layout verdrahtet. Dabei bewahren, nicht neu bauen: Schriften bleiben selbst ausgeliefert, es kommt keine Tracking-Ressource hinzu  · files: src/components/shell/wordmark.tsx, src/components/shell/site-header.tsx, src/components/shell/site-footer.tsx, src/components/shell/page-frame.tsx, src/app/layout.tsx  · → AC-21, AC-22, AC-23, AC-24, AC-29, AC-30
- [x] T8 [P]  Quiz-Ansichten ohne Zustandslogik: Antwortoption mit vier Zuständen (unbeantwortet, richtig, falsch, nicht gewählt), Statusleiste mit Serie und Uhr in gleichbreiten Ziffern, Pokémon-Bild mit Skelettfläche in Bildgröße, Startansicht, Ergebnisansicht (Serie, Zeit, Bestleistungs-Hinweis, Gewinner-Meldung bei leerem Pool, Hinweis auf fehlgeschlagenes Speichern), Fehlerkarte innerhalb der Quiz-Karte, Frageansicht  · files: src/components/quiz/answer-option.tsx, src/components/quiz/status-bar.tsx, src/components/quiz/pokemon-image.tsx, src/components/quiz/start-view.tsx, src/components/quiz/result-view.tsx, src/components/quiz/load-error-card.tsx, src/components/quiz/question-view.tsx  · → AC-1, AC-6, AC-7, AC-8, AC-16, AC-25
- [x] T9 [P]  Bewegung und Zugänglichkeit: Keyframes `in`, `pop`, `nudge`, `float`, durchgehende Beachtung von `prefers-reduced-motion` (Zustandswechsel bleiben, Bewegung entfällt), sichtbare Fokus-Ringe auf allen interaktiven Elementen  · files: src/app/globals.css  · → AC-4, AC-6, AC-8, AC-25

## Level 5 — Zusammenbau

<!-- Eine Aufgabe: Zustandsmaschine und Seite hängen zu eng zusammen, um sie ohne gemeinsame Datei zu trennen. -->

- [x] T10  Zustandsmaschine und Startseite verdrahten:
  - Zustände bereit → lädt → offen → aufgelöst → beendet, dazu der Fehlerzustand; aus `beendet` führt kein Weg zurück nach `offen`
  - Uhr startet erst, wenn das erste Bild sichtbar ist, läuft danach durch und steht still, solange die Fehlerkarte zu sehen ist
  - Vorladen der nächsten Frage **einschließlich ihres Bildes**, während die aktuelle noch beantwortet wird
  - Verwurfsgrenze: nach drei hintereinander verworfenen Fragen in den Fehlerzustand wechseln statt weiter zu ziehen
  - Doppelklick-Schutz auf „Runde starten" und auf die Antwortoptionen
  - Warnung vor dem Verlassen, sobald die Serie mindestens 1 beträgt
  - Speichern des Ergebnisses am Rundenende, mit Wiederholungsmöglichkeit bei Fehlschlag
  - **Abgelaufene Sitzung während der Runde: Weiterleitung auf `/login`; die Runde wird verworfen und keinem fremden Konto zugeordnet (EC-7)**
  - Startseite als Server-Komponente: lädt die persönliche Bestleistung und reicht sie hinein

  · files: src/components/quiz/quiz-screen.tsx, src/app/page.tsx  · → AC-2, AC-4, AC-6, AC-9, AC-10, AC-13, AC-17, AC-18, AC-19, EC-1, EC-7, EC-9, EC-10

<!-- T11 nachgetragen am 2026-09-03 durch /refine PROJ-2. Anlass: BUG-23 aus dem
     QA-Lauf zu PROJ-1 — der Bestenlisten-Zugang in der Kopfzeile führt auf eine 404. -->

- [x] T12  Ergebnis-Screen: „Zur Bestenliste" erscheint nur, wenn `/leaderboard` existiert. Den Schalter dabei aus `site-header.tsx` in ein gemeinsames Modul ziehen, das beide Stellen importieren — PROJ-3 legt dann **einen** Schalter um statt zwei, und keiner kann vergessen werden  · files: src/lib/site-pages.ts, src/components/shell/site-header.tsx, src/components/quiz/result-view.tsx  · → AC-7, AC-21
- [x] T11  Kopfzeile: Der Zugang zur Bestenliste erscheint nur, wenn `/leaderboard` existiert — bis dahin gar nicht statt als toter Link. Nach demselben Muster wie `LEGAL_PAGES` in `site-footer.tsx`, damit PROJ-3 eine erkennbare Stelle zum Freischalten hat  · files: src/components/shell/site-header.tsx  · → AC-21

## Level 6 — Fixes aus dem QA-Lauf vom 2026-09-04

<!-- Nachgetragen am 2026-09-04. Anlass: der vollständige Sweep in qa-report.md
     (2 High, 3 Medium, 2 Low). T13-T15 decken die vom Nutzer beauftragten
     Befunde ab; BUG-9, BUG-11 und BUG-12 bleiben bewusst offen, siehe unten.
     T14 und T15 fassen BUG-7/BUG-8/BUG-13 zusammen, weil BUG-13 vom Hänger aus
     BUG-8 verdeckt wurde: einzeln behoben tauscht man einen Hänger gegen eine
     Anfrageschleife. -->

- [x] T13  „Nochmal spielen" startet unmittelbar eine neue Runde, statt auf den Startbildschirm zurückzuführen (BUG-10). Der Widerspruch lag im `design.md`, nicht nur im Code — der Übergang `beendet → bereit` wird dort zu `beendet → lädt` korrigiert  · files: src/components/quiz/quiz-screen.tsx, features/PROJ-2-pokemon-quiz/design.md  · → AC-9
- [x] T14  Transport-Fänger für den Quiz-Pfad (BUG-7): den generischen Kern aus PROJ-1s `run-action.ts` nach `src/lib/actions/` ziehen, `runAuthAction` als Auth-Zuschnitt darauf setzen und `saveRun` sowie `getNextQuestion` hindurchführen (`repairImageUrl` stand hier ebenfalls, bis T18 die Rückfallebene entfernte). Ein abgerissener Aufruf erreicht damit die Fehler-UI aus EC-3, statt den Ergebnis-Screen auf „gespeichert" stehenzulassen  · files: src/lib/actions/run-action.ts, src/lib/auth/run-action.ts, src/components/quiz/quiz-screen.tsx  · → EC-3
- [x] T15  Bildausfall beendet die Runde nicht mehr als Hänger (BUG-8) und zieht nicht mehr endlos nach (BUG-13): ~~Eine unveränderte Reparaturadresse gilt nicht als Reparatur, sondern führt in den Verwurf aus EC-6~~ (**mit T18 gegenstandslos: Es gibt keine Reparaturadresse mehr**); die Verwurfsgrenze aus EC-10 stoppt das Nachziehen auch beim Vorladen, nicht nur wenn der Spieler wartet  · files: src/components/quiz/quiz-screen.tsx  · → AC-31, EC-6, EC-10, EC-11
- [x] T16  Abnahmetests zu T13-T15, jeder einzeln gegen den wiederhergestellten Fehler rot geprüft  · files: src/components/quiz/quiz-screen.error-states.test.tsx, src/lib/actions/run-action.test.ts  · → AC-9, AC-31, EC-3, EC-6

**Bewusst nicht Teil dieser Lieferung** (aus demselben QA-Lauf, vom Nutzer nicht beauftragt):

- **BUG-9** (Medium, EC-7) — abgelaufene Sitzung: keine Weiterleitung auf `/login`. Teilt die Wurzel mit BUG-7 und ist durch T14 gemildert (der Spieler sieht jetzt „konnte noch nicht gespeichert werden" statt eines Erfolgs, der keiner ist), aber nicht erfüllt. Braucht eine eigene Entscheidung: Der Proxy fängt den Server-Action-POST ab und antwortet mit HTML — das von einem gewöhnlichen Verbindungsabbruch zu unterscheiden, geht nur über Merkmale der Antwort, und das gehört entschieden, nicht nebenbei eingebaut
- **BUG-11** (Low, AC-25) — keine Skelettfläche beim Rundenstart
- **BUG-12** (Low) — `getNextQuestion` validiert seine Eingabe nicht (kein Zod-Schema wie `saveRun`)

## Level 7 — Fixes aus dem QA-Lauf vom 2026-09-04 (zweiter des Tages)

- [x] T17  E2E-Suite auf das neue AC-9-Verhalten nachziehen (BUG-14). `PROJ-2-personal-best.spec.ts` prüft jetzt **positiv**, dass nach „Nochmal spielen" von selbst eine offene Frage erscheint; die Bestleistung wird über `/` geprüft, so wie AC-1 sie festmacht. `PROJ-2-quiz-round.spec.ts` tauscht nur das Vehikel (`goto('/')` statt Knopf), die Aussage zu AC-11 bleibt unverändert  · files: tests/PROJ-2-personal-best.spec.ts, tests/PROJ-2-quiz-round.spec.ts  · → AC-1, AC-8, AC-9, AC-11

- [x] T18  Rückfallebene der Bildadresse ersatzlos entfernen (BUG-16, nach `/refine` auf EC-11): `repairImageUrl` (Server Action) und `resolveOfficialImageUrl` (PokeAPI-Client) samt ihrer Tests gestrichen, Reparaturzweig und `repairedRef` aus der Zustandsmaschine entfernt. Ein nicht ladbares Bild führt jetzt unmittelbar zu EC-6, drei in Folge zu EC-10. Nebenwirkung: eine Server Action weniger an der Angriffsfläche  · files: src/lib/pokeapi/client.ts, src/lib/quiz/question-action.ts, src/components/quiz/quiz-screen.tsx, src/lib/pokeapi/client.test.ts, src/lib/quiz/question-action.test.ts, src/components/quiz/quiz-screen.error-states.test.tsx, src/components/quiz/quiz-screen.test.tsx  · → EC-6, EC-10, EC-11, AC-31

- [x] T19  Zeitgrenze für das Vorladen des Bildes (BUG-15): `ImageProbe` gibt nach 5 Sekunden auf, lädt genau einmal still neu (AC-15) und meldet dann den Fehlschlag, sodass EC-6 greift. Der zweite Versuch läuft über den React-`key`, nicht über die Adresse — sonst bräche er den Zwischenspeicher (AC-31) und die Auslieferung über die eigene Domain (AC-20)  · files: src/components/quiz/pokemon-image.tsx, src/components/quiz/quiz-screen.error-states.test.tsx  · → AC-15, AC-16, EC-6
- [x] T20  Worker-Zahl der E2E-Suite deckeln  · files: playwright.config.ts  · → kein AC (Messaufbau)

- [x] T21  Eingabevalidierung an beiden ungeschützten Server Actions (BUG-12) und damit zugleich BUG-17s ausnutzbare Hälfte: `seenIdsSchema` (Array von Pool-Nummern, längenbegrenzt) für `getNextQuestion`, `z.uuid().optional()` für `getPersonalBest`. **Vertragsänderung:** Die Ausschlussliste wird jetzt **abgewiesen** statt gesäubert — die alte Nachsicht war die Lücke  · files: src/lib/validation/quiz.ts, src/lib/quiz/question-action.ts, src/lib/quiz/run-actions.ts, src/lib/quiz/question-action.test.ts, src/lib/quiz/run-actions.test.ts  · → AC-5, EC-2
- [x] T22  Gewinner-Prüfung zählt die Serie statt der Ausschlussliste (BUG-17, Client-Hälfte): Verworfene Fragen stehen in `seenIdsRef`, sind aber keine richtigen Antworten. EC-2 fragt nach „alle 386 richtig beantwortet", und genau das ist die Serie  · files: src/components/quiz/quiz-screen.tsx  · → EC-2

- [x] T23  Abgelaufene Sitzung führt wieder auf `/login` (BUG-9, EC-7): Der Proxy leitet **Server-Action-POSTs** nicht mehr um. Next.js kodiert das `redirect()` einer Action in-band (Status 200 plus `x-action-redirect`), gerade damit der Browser keiner 307 folgt — eine gewöhnliche Weiterleitung darauf ist für den Action-Handler ein Protokollbruch, und der `unauthenticated`-Zweig der Actions war dadurch **unerreichbar**. Vom Nutzer ausdrücklich genehmigt (Auth-Fluss, `.claude/rules/security.md`)  · files: src/proxy.ts, src/proxy.test.ts  · → EC-7
- [x] T24  Wächter über alle Server Actions: findet per TypeScript-AST **jede** aus einer `'use server'`-Datei exportierte Funktion und verlangt entweder eine Sitzungsprüfung oder einen begründeten Eintrag in `PUBLIC_ACTIONS`. Macht die Zusicherung aus T23 strukturell statt einmalig  · files: src/lib/actions/server-actions.guard.test.ts  · → EC-7, AC-13, AC-14

## Level 8 — Fixes aus dem QA-Lauf vom 2026-09-05

- [x] T25  Der Wächter über die Server Actions hält jetzt, was er verspricht (BUG-20): Die Erkennungslogik zieht in ein eigenes Modul `server-actions.guard.ts`, erfasst Inline-`'use server'` in jedem Funktionsrumpf, lehnt Re-Exporte und destrukturierte Exporte als nicht analysierbar **ab** statt sie zu überspringen, erfasst anonyme Default-Exporte und entscheidet die Sitzungsprüfung am **AST** statt am Text. Dazu ein Selbsttest, der jede der fünf Lücken einzeln festnagelt  · files: src/lib/actions/server-actions.guard.ts, src/lib/actions/server-actions.guard.test.ts, src/lib/actions/server-actions.guard.self.test.ts  · → EC-7, AC-13, AC-14
- [x] T26  Die Proxy-Ausnahme für Server-Action-POSTs ist auf die Pfade eingegrenzt, die sie brauchen — derzeit nur `/` (BUG-21). PROJ-1s Credential-Actions laufen damit nicht mehr unter jedem Pfad, und eine pfadbasierte Abwehr beim Deploy lässt sich nicht mehr umgehen  · files: src/proxy.ts, src/proxy.test.ts  · → AC-13, EC-7
- [x] T27  Totes `remotePattern` aus dem gestrichenen EC-11 entfernt (BUG-22). Live geprüft: Sprite → 200, `sprites/items/master-ball.png` → 400  · files: next.config.ts  · → AC-20
- [x] T28  „Pool leer" ist nicht mehr gleichbedeutend mit „alle geschafft" (BUG-23, die zweite Hälfte von BUG-17): Die Gewinner-Meldung hängt auch auf dem Serverpfad an der Serie  · files: src/components/quiz/quiz-screen.tsx, src/components/quiz/quiz-screen.error-states.test.tsx  · → EC-2
- [x] T29  Doku-Drift beseitigt (BUG-28): T2 und T5 beschrieben weiterhin die von T18 zurückgenommene Rückfallebene; `design.md` nannte `repairImageUrl` im Präsens  · files: features/PROJ-2-pokemon-quiz/tasks.md, features/PROJ-2-pokemon-quiz/design.md  · → EC-11

**Bewusst nicht behoben:** BUG-19 (High) ist **keine PROJ-2-Änderung** — die Entscheidung des Nutzers vom 2026-09-05 lautet, die Rangliste auf verifizierte Konten zu stützen; das ist als harte Voraussetzung in `features/PROJ-3-leaderboard/spec.md` (Technical Requirements + Decision Log + Open Question zum Mechanismus) hinterlegt. Ebenfalls offen: BUG-11 (Low, AC-25), BUG-24 bis BUG-27 (Low) und die Deploy-Punkte BUG-18 und Security-Header.

**Nicht durch einen Test abgesichert:** T22. Ein Abnahmetest bräuchte 386 richtige Antworten oder ein gemocktes `POOL_SIZE` in einer eigenen Testdatei; der Aufwand steht in keinem Verhältnis zu einem Low-Befund auf einem Pfad, den der QA-Lauf selbst als „praktisch nur von Hand erreichbar" eingestuft hat. Die **ausnutzbare** Hälfte von BUG-17 — erzwungenes „Pool leer" über Nummern außerhalb des Pools — ist in T21 abgedeckt und rot geprüft. Hier steht bewusst, was geprüft ist und was nur gelesen.

**Zur E2E-Instabilität — die erste Erklärung war falsch.** Im QA-Lauf und beim Fix von BUG-14 stand hier, die Ursache sei **BUG-15**. Das hat sich beim Nachmessen nicht gehalten:

- Mit der Zeitgrenze aus T19 blieben bei 16 Workern **weiterhin 6 von 24 rot**.
- Playwright gibt bei einer Erwartung nach **5 Sekunden** auf, die App hat nach AC-15 aber zehn (5 s plus stiller Versuch) — der Test war also ungeduldiger als der Vertrag.
- Mit 20 Sekunden Geduld blieben **4 rot**, und zwar an einer *anderen* Stelle: bei einer bereits offenen Frage. Das ist AC-2s 3-Sekunden-Budget, das unter 16-facher Last auf **einem** Dev-Server nicht zu halten ist. Auch der Mail-Ablauf von PROJ-1 wurde instabil.

Es ist also **Kontention im Messaufbau, kein Produktfehler** — passend dazu trat derselbe Flake schon vor den Fixes auf (gegen `4709193` gemessen: ebenfalls 5 von 24 rot). Deshalb T20: Bei 4 Workern läuft `npm run test:e2e` reproduzierbar 24/24, dreimal in Folge bestätigt. Das deckt BUG-15 auch nicht zu — der hat mit T19 seinen eigenen, rot geprüften Abnahmetest auf Unit-Ebene.

## Level 9 — Fixes aus dem QA-Lauf vom 2026-09-05 (zweiter)

- [x] T30  Off-by-one auf dem Pfad „Pool leer" behoben (BUG-33): `answer` plant `advance` aus dem Render **vor** `setStreak`, das eingefangene `fetchQuestion` hielt die alte Serie in seiner Closure. Ein `streakRef` wird neben `setStreak` gesetzt und ist zum Zeitpunkt des Timeouts aktuell; `streak` fällt dadurch aus den Abhängigkeiten von `fetchQuestion`, dessen Identität über eine ganze Runde stabil bleibt — das war die eigentliche Ursache, nicht die eine Zeile  · files: src/components/quiz/quiz-screen.tsx, src/components/quiz/quiz-screen.error-states.test.tsx  · → EC-2, AC-11
- [x] T31  Die Zusage über den Wächter auf das gestutzt, was er wirklich leistet (BUG-32, BUG-34, BUG-35, BUG-36 — **bewusst nicht durch Erweiterung**): `design.md` führt Können **und** Grenzen samt Messung auf, benennt die Aufgabenteilung mit dem Code-Review und sagt, worauf ein Review bei einer neuen Action konkret achten muss. Die Kommentare in `proxy.ts` und `server-actions.guard.ts`, die sich auf die zu große Zusage stützten, sind korrigiert — inklusive der Fehlermeldung, die ein Entwickler zu lesen bekommt  · files: features/PROJ-2-pokemon-quiz/design.md, src/proxy.ts, src/lib/actions/server-actions.guard.ts, src/lib/actions/server-actions.guard.test.ts  · → EC-7
- [x] T32  Doku-Drift nachgezogen, die T29 ausgelassen hatte (BUG-38): T14 und T15 beschrieben `repairImageUrl` und den Reparaturzweig weiter im Präsens  · files: features/PROJ-2-pokemon-quiz/tasks.md  · → EC-11

**Warum der Wächter nicht weiter aufgebohrt wird.** Ein Prüfer, der entscheidet, ob das Ergebnis von `getUser` den Ablauf tatsächlich steuert, wäre eine Datenflussanalyse. Der dritte Anlauf auf dieselbe Zusicherung würde denselben Fehler zum dritten Mal machen: einen Prüfer bauen, der etwas Schwächeres misst als sein Name behauptet — und dem man deshalb zu Unrecht vertraut. Entscheidung des Nutzers am 2026-09-05.

**Offen und ausdrücklich benannt:** BUG-29, BUG-30 und BUG-31 (Zugangsdaten-Pfad, Proxy-Matcher, öffentliche Pfade) werden **zusammen** als Drosselung an den Credential-Actions gelöst — unabhängig vom Pfad. Entscheidung des Nutzers am 2026-09-05; der Mechanismus ist noch zu wählen.

## Backlog — bewusst offen

Nicht Teil dieser Lieferung, aber festgehalten, damit es nicht nur im Chat steht. Diese Punkte haben **kein Acceptance Criterion**; sie werden erst dann Aufgaben, wenn jemand sie ausdrücklich in die Spec holt (`/refine PROJ-2`).

- [ ] **B1  Drosselung der Server Actions** (aus `qa-report.md` → BUG-2, Severity Low, am 2026-09-02 bewusst zurückgestellt)
  `getNextQuestion` und `saveRun` haben keine Begrenzung; ein angemeldeter Nutzer kann sie in einer Schleife aufrufen.
  **Warum es jetzt vertretbar ist:** Wiederholte Pokémon kommen aus dem Zwischenspeicher und erzeugen keine Last bei der PokeAPI (AC-31); `saveRun` kann ausschließlich eigene Zeilen anlegen und ist durch AC-12 begrenzt. Es gibt keinen Zugangsdaten-Pfad in diesem Feature.
  **Wann es akut wird:** wenn die App öffentlich erreichbar ist. Über immer neue Nummern lassen sich weiterhin echte Anfragen an die PokeAPI auslösen — das arbeitet gegen deren Fair-Use-Bitte, um die dieses Feature sich sonst ausdrücklich bemüht.
  **Nächster Schritt, wenn es angegangen wird:** vor dem öffentlichen Start neu bewerten; der Mechanismus steht in `docs/production/rate-limiting.md` und im Framework-Pack. Kein `[user]`-Task — es wäre Anwendungscode.

## Prüfhinweise für `/qa`

Zwei Kriterien sind **unsichtbar, wenn sie fehlen** — bei allen anderen fällt der Fehler beim Anschauen auf. Sie brauchen deshalb eine bestimmte Methode, nicht nur Aufmerksamkeit:

**AC-31 (Zwischenspeicher) — zwei Ebenen, weil eine nicht reicht.**

Der Zwischenspeicher gehört nicht unserem Code, sondern der `fetch`-Umhüllung des Frameworks. **Außerhalb des laufenden Next-Servers, also in Vitest, sind die Zwischenspeicher-Optionen wirkungslos.** Ein Unit-Test, der den Client zweimal aufruft und Anfragen zählt, sieht deshalb auch bei völlig korrektem Code zwei Anfragen — er widerlegt nichts und verleitet dazu, eine überflüssige eigene Memoisierung einzubauen, damit er grün wird. Stattdessen:

1. **Unit-Test prüft die Anweisung:** `fetch` stubben, den Client einmal aufrufen, prüfen, dass er mit erzwungenem Zwischenspeicher und 30-Tage-Gültigkeit aufgerufen wurde. Das fängt den eigentlichen Fehlerfall — ein blank geschriebenes `fetch` — deterministisch ab.
2. **Laufzeit-Beobachtung beweist die Wirkung:** Die in T4 aktivierte `fetch`-Protokollierung schreibt jeden Aufruf mitsamt Cache-Status ins Terminal. `npm run dev` starten, eine Runde spielen, und prüfen, dass ein zum zweiten Mal vorkommendes Pokémon als Treffer erscheint und nicht als frische Anfrage. Das ist die einzige Stelle, an der der Zwischenspeicher überhaupt sichtbar wird.

**~~EC-11 (Rückfallebene der Bildadresse)~~ — hinfällig seit dem 2026-09-04.**

Die Rückfallebene ist ersatzlos entfallen (T18, `spec.md` → EC-11). An ihre Stelle tritt ein Hinweis, der über dieses Feature hinaus gilt:

**EC-6 (kaputtes Bild) — das Fehlerereignis genau *einmal* auslösen.**

Der Verwurf hängt am `onError` eines `<img>`. Ein Test, der das Ereignis in einer Schleife von Hand nachfeuert, prüft den interessanten Fall weg: Genau das tut der Browser nämlich nicht. Der ursprüngliche Abnahmetest zu BUG-8 war deshalb **auch gegen den kaputten Code grün** und musste umgeschrieben werden. Einmal feuern, dann verlangen, dass die Runde von selbst weiterzieht.

## Parallelization

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Server-Bausteine (L2) → Server Actions (L3) → UI-Bausteine (L4) → Zusammenbau (L5).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Ebene nennen nie denselben Pfad unter `files:`. Geprüft: L2 (drei Dateien), L3 (zwei Dateien) und L4 (drei Dateimengen) sind jeweils überschneidungsfrei.
- **T10 ist bewusst eine einzige Aufgabe.** Zustandsmaschine und Startseite teilen sich zwangsläufig Zustand und Schnittstelle; eine Aufteilung hätte zwei Agenten auf dieselbe Datei gesetzt und damit die Disjunktheitsregel verletzt, ohne Zeit zu sparen.
- **Tests schreibt `/qa`, nicht `/build`** (`CLAUDE.md` → Key Conventions). Deshalb steht hier keine Test-Aufgabe — die Methode für die beiden unsichtbaren Kriterien ist oben hinterlegt.
