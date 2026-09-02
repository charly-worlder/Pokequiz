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

- [x] T2 [P]  PokeAPI-Anbindung: deutschen Namen über `/pokemon-species/{id}` holen, **mit ausdrücklich erzwungenem Zwischenspeicher (30 Tage)** — das Standardverhalten cached nicht, siehe `design.md`; Bildadresse aus der Pokémon-Nummer bilden und bei fehlendem Bild über `/pokemon/{id}` die offizielle Adresse nachschlagen; 5-Sekunden-Zeitgrenze mit genau einem stillen Wiederholungsversuch  · files: src/lib/pokeapi/client.ts  · → AC-15, AC-28, AC-31, EC-5, EC-8, EC-11
- [x] T3 [P]  Prüfschema für Rundenergebnisse: Serie ganzzahlig 0–386, Dauer ganzzahlig ≥ 0, Dauer ≥ 500 × Serie, Runden-Kennzeichen als UUID  · files: src/lib/validation/quiz.ts  · → AC-12
- [x] T4 [P]  Bild-Auslieferung und Beobachtbarkeit konfigurieren: Bild-Host für die Sprites freischalten (damit der Browser nur die eigene Domain anfragt), Zwischenspeicher-Dauer für optimierte Bilder setzen, `fetch`-Protokollierung für den Entwicklungsmodus aktivieren (macht Cache-Treffer für `/qa` überhaupt sichtbar, siehe Prüfhinweise unten)  · files: next.config.ts  · → AC-20, AC-28, AC-31

## Level 3 — Server Actions

<!-- Setzen auf Level 2 auf. Zwei verschiedene Dateien → beide [P]. -->

- [x] T5 [P]  Server Action „nächste Frage": nimmt die Liste der bereits gezeigten Nummern entgegen, zieht eine neue Lösung plus drei verschiedene falsche Optionen aus 1–386, holt alle vier deutschen Namen, mischt die Reihenfolge, verwirft ein Pokémon ohne deutschen Namen oder ohne Bild serverseitig und zieht neu, meldet „Pool leer" wenn alle 386 verbraucht sind, weist Aufrufe ohne gültige Sitzung ab  · files: src/lib/quiz/question-action.ts  · → AC-3, AC-5, AC-15, EC-2, EC-5, EC-6, EC-7, EC-11
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

**EC-11 (Rückfallebene der Bildadresse) — vollständig als Unit-Test.**

Anders als AC-31 ist das unsere eigene Logik und damit ohne Laufzeit-Trick prüfbar: `fetch` so stubben, dass die aus der Nummer gebildete Adresse kein Bild liefert und `/pokemon/{id}` eine gültige Antwort — dann prüfen, dass die offizielle Adresse herauskommt und der Umweg genau einmal gegangen wird. Ein zweiter Fall, in dem auch das fehlschlägt, muss zum Verwerfen der Frage führen (EC-6).

## Parallelization

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Server-Bausteine (L2) → Server Actions (L3) → UI-Bausteine (L4) → Zusammenbau (L5).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Ebene nennen nie denselben Pfad unter `files:`. Geprüft: L2 (drei Dateien), L3 (zwei Dateien) und L4 (drei Dateimengen) sind jeweils überschneidungsfrei.
- **T10 ist bewusst eine einzige Aufgabe.** Zustandsmaschine und Startseite teilen sich zwangsläufig Zustand und Schnittstelle; eine Aufteilung hätte zwei Agenten auf dieselbe Datei gesetzt und damit die Disjunktheitsregel verletzt, ohne Zeit zu sparen.
- **Tests schreibt `/qa`, nicht `/build`** (`CLAUDE.md` → Key Conventions). Deshalb steht hier keine Test-Aufgabe — die Methode für die beiden unsichtbaren Kriterien ist oben hinterlegt.
