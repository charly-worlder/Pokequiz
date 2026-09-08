# PROJ-2 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Der geordnete, nachvollziehbare Bauplan — die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: Die Dateien dieser Aufgabe sind disjunkt zu jeder anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also in einen eigenen Unteragenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Innerhalb einer Ebene läuft parallel, was `[P]` trägt. Jede Aufgabe verweist auf die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur der Nutzer vornehmen kann: `where:` statt `files:`, nie `[P]`, wird vom Nutzer abgehakt — `/build` reicht sie weiter, `/deploy` liefert nicht aus, solange eine offen ist.
> Der Status lebt ausschließlich in `features/INDEX.md`.
>
> **Neu erstellt am 2026-09-06** nach `/architecture PROJ-2` (serverseitig geführte Runde). Der abgelöste Bauplan T1–T31 steht vollständig unter „Historie" am Ende; **die Nummerierung läuft deshalb bei T32 weiter**, damit die Verweise in `qa-report.md` und in den Bug-Notizen eindeutig bleiben.

## Level 1 — Datenschicht

<!-- Fundament. Beide Migrationen sind voneinander unabhängig und berühren verschiedene Dateien. -->

- [x] T32 [P]  Migration `active_runs`: Profil-ID als Primärschlüssel mit Löschkaskade (macht „höchstens eine laufende Runde je Spieler" zur Eigenschaft der Tabelle), Runden-Kennzeichen eindeutig, gezogene Nummern, Serienstand, aufsummierte Zeit, die vier Felder der aktuellen Frage, die drei Felder der vorbereiteten nächsten Frage, Zeitpunkt der letzten Berührung; Wertebereiche als Datenbankregeln; **RLS eingeschaltet und bewusst ohne jede Policy**, mit der Begründung als Kommentar — die Zeile enthält die Lösung, eine Eigentümer-Policy würde AC-32 auf der Datenebene brechen  · files: supabase/migrations/0007_active_runs.sql  · → AC-36, AC-38, AC-40
- [x] T33 [P]  Migration `runs` nachziehen: `client_round_id` heißt `round_id` (der Server vergibt es jetzt), Constraint `runs_duration_plausible` entfällt — AC-12 hat die 0,5-Sekunden-Regel abgeschafft, weil AC-34 sie ablöst. Die übrigen Grenzen und alle Policies bleiben  · files: supabase/migrations/0008_runs_round_id.sql  · → AC-12, EC-4

## Level 2 — Regeln in der Datenbank

<!-- Setzt Level 1 voraus. Die beiden Migrationen sind untereinander unabhängig. Die [user]-Aufgaben stehen hier, weil der Aufräum-Lauf aus T35 sie braucht. -->

- [x] T34 [P]  Migration mit den Funktionen der Runde, alle `security definer` mit festem `search_path`, `revoke` von `public`/`anon`/`authenticated`, `grant execute` nur für `service_role` (Muster wie `0003` und `0006`): Runde starten und eine vorhandene dabei ersetzen · vorbereitete Frage setzen · **Antwort prüfen als bedingte Änderung auf das Frage-Token** — in einem Schritt Intervall messen und aufsummieren, mit der gespeicherten richtigen Position vergleichen, Serie erhöhen, die vorbereitete Frage nachrücken lassen und ihren Ausgabezeitpunkt setzen · vorbereitete Frage ersetzen, ohne die aktuelle anzufassen · Runde beenden, `runs`-Zeile aus dem Zustand schreiben und den Zustand löschen · Frage-Token zur Pokémon-Nummer auflösen, nur für die eigene laufende Runde · **vorbereitete Frage zur aktuellen machen** (beim Bau am 2026-09-06 als siebte hinzugekommen, siehe `design.md` → Notizen aus dem Bau)  · files: supabase/migrations/0009_round_functions.sql  · → AC-33, AC-34, AC-35, AC-36, AC-39, EC-1, EC-2, EC-4, EC-12, EC-15
- [x] T35 [P]  Migration Aufbewahrung: `pg_cron` einschalten und einen Lauf **alle 5 Minuten** einrichten, der alles löscht, was länger als **110 Minuten** unberührt ist. Takt und Schwelle zusammen bleiben damit unter den zwei Stunden aus AC-41 — ein stündlicher Takt gegen eine 2-Stunden-Schwelle ergäbe bis zu drei Stunden Verweildauer  · files: supabase/migrations/0010_active_runs_retention.sql  · → AC-41
- [ ] T36 [user]  Supabase: `pg_cron` einschalten — **nur nötig, falls das gehostete Projekt es der Migration aus T35 verweigert**  · where: Dashboard → Database → Extensions → `pg_cron` · Wert: eingeschaltet  · → AC-41
- [ ] T37 [user]  Supabase: prüfen, dass das Projekt nicht wegen Inaktivität pausiert ist — ein pausiertes Projekt führt keine zeitgesteuerten Läufe aus  · where: Dashboard → Project Settings · Wert: Projekt aktiv  · → AC-41

## Level 3 — Server-Bausteine

<!-- Drei disjunkte Dateien, keine importiert eine andere. -->

- [x] T38 [P]  Prüfschemata umbauen: Frage-Token als UUID, gewählte Position als ganze Zahl 0–3. `seenIdsSchema` und `MIN_MS_PER_ANSWER` entfallen ersatzlos — der Browser schickt weder eine Ausschlussliste noch ein Ergebnis, es gibt also nichts mehr zu plausibilisieren  · files: src/lib/validation/quiz.ts, src/lib/validation/quiz.test.ts  · → AC-12, AC-33
- [x] T39 [P]  Zugang zum Rundenzustand: dünne Schicht über die Funktionen aus T34, ausschließlich über den vorhandenen Administrationszugang (`src/lib/supabase/admin.ts`). Die Profil-ID stammt immer aus der Sitzung und wird nie aus einem Aufrufparameter übernommen  · files: src/lib/quiz/round-state.ts, src/lib/quiz/round-state.test.ts  · → AC-14, AC-33, AC-34, AC-35, AC-36, AC-39
- [x] T40 [P]  PokeAPI-Client erweitern: Sprite-Bytes serverseitig holen und über die CDN-Adresse — also über die Pokémon-Nummer — zwischenspeichern, mit derselben ausdrücklich erzwungenen Zwischenspeicherung wie die Namen. `spriteUrlFor` wird modulintern, damit die Adresse nicht versehentlich wieder nach außen gerät  · files: src/lib/pokeapi/client.ts, src/lib/pokeapi/client.test.ts  · → AC-31, AC-37

## Level 4 — Server-Schnittstellen

<!-- Setzt Level 3 voraus. Drei disjunkte Dateimengen. -->

- [x] T41 [P]  Server Actions neu schneiden: Runde starten (zieht erste und vorbereitete Frage, liefert nur Optionen und Token) · Antwort abgeben (Token + Position, liefert Urteil, richtige Position, Serienstand, bei Rundenende Ergebnis und Bestleistungs-Hinweis) · vorbereitete Frage ersetzen · Runde beenden. **`saveRun` entfällt ersatzlos** — es gibt keine Schnittstelle mehr, die ein fertiges Ergebnis entgegennimmt; `getPersonalBest` bleibt unverändert  · files: src/lib/quiz/question-action.ts, src/lib/quiz/question-action.test.ts, src/lib/quiz/run-actions.ts, src/lib/quiz/run-actions.test.ts  · → AC-2, AC-3, AC-5, AC-8, AC-11, AC-12, AC-14, AC-18, AC-33, AC-35, EC-2, EC-3, EC-5, EC-7, EC-9
- [x] T42 [P]  Bild-Route `/api/question/[token]/image`: löst das Token über T34 zur Nummer auf, aber nur für die laufende Runde dieses Nutzers — sonst 404. Holt die Bytes über T40 und reicht sie durch, mit `Cache-Control: private, max-age=3600, immutable`, damit das vorgeladene Bild beim Anzeigen ein Treffer im Browser-Cache ist  · files: src/app/api/question/[token]/image/route.ts, src/app/api/question/[token]/image/route.test.ts  · → AC-20, AC-28, AC-32, AC-37
- [x] T43 [P]  `remotePatterns` für den Sprite-Host aus der Framework-Konfiguration entfernen. Ohne das bleibt die alte, nummernsichtbare Bildadresse über die Bild-Optimierung bedienbar — AC-32 wäre über einen zweiten, unbewachten Weg umgehbar  · files: next.config.ts  · → AC-20, AC-32

## Level 5 — Oberfläche

<!-- T44 legt die Schnittstellen der drei anderen fest und läuft deshalb allein, obwohl seine Dateien disjunkt wären. -->

- [x] T44  QuizScreen auf reine Anzeige umbauen: neuer Zustand „wartet" zwischen Klick und Urteil, Serie und Zeit kommen vom Server, die angezeigte Uhr ist nur noch Anzeige, Vorladen der vorbereiteten Frage über deren Token, Fehlerpfade auf die Ersetzen-Aktion aus T41. Die Verwurfsgrenze aus EC-10 zählt weiterhin, und eine bereits **angezeigte** Frage wird nicht mehr ersetzt (EC-12)  · files: src/components/quiz/quiz-screen.tsx, src/components/quiz/quiz-screen.test.tsx, src/components/quiz/quiz-screen.error-states.test.tsx, src/components/quiz/quiz-screen.wrong-answer.test.tsx  · → AC-4, AC-6, AC-9, AC-10, AC-16, AC-17, AC-19, EC-1, EC-6, EC-10, EC-12, EC-15
- [x] T45 [P]  Frageansicht und Antwortoption: gedrückter Zwischenzustand während „wartet" (der Klick darf nicht ins Leere zu gehen scheinen), Färbung erst nach dem Urteil des Servers — nie aus einer im Browser bekannten Lösung  · files: src/components/quiz/question-view.tsx, src/components/quiz/answer-option.tsx  · → AC-4, AC-6
- [x] T46 [P]  Pokémon-Bild und Vorlade-Sonde auf die Token-Adresse umstellen, ohne die Bild-Optimierung des Frameworks; Skelettfläche in Bildgröße und die 5-Sekunden-Grenze mit genau einem stillen zweiten Versuch bleiben  · files: src/components/quiz/pokemon-image.tsx  · → AC-15, AC-20, AC-25, AC-32, EC-6
- [x] T47 [P]  Ergebnisansicht: zeigt die **servergemessene** Zeit, nicht den Stand der Anzeigeuhr; der erneute Versuch nach einem fehlgeschlagenen Speichern läuft über „Runde beenden" und schreibt aus dem Rundenzustand  · files: src/components/quiz/result-view.tsx  · → AC-7, AC-8, EC-3

## Level 6 — Absicherung

- [x] T48  Manipulations-Tests, jeder gegen den wiederhergestellten Fehler rot geprüft: Es gibt keinen Weg mehr, ein fertiges Ergebnis einzureichen · ein fremdes, abgelaufenes oder erfundenes Frage-Token wird abgewiesen · der zweite Klick auf dieselbe Frage bleibt wirkungslos · eine Antwort aus einem verwaisten zweiten Tab wird abgewiesen · weder Bildadresse noch ausgeliefertes Markup verraten die Pokémon-Nummer oder die richtige Option · eine Antwort ohne Sitzung führt auf `/login`  · files: tests/PROJ-2-round-authority.spec.ts  · → AC-12, AC-14, AC-32, AC-33, EC-1, EC-7, EC-15
- [x] T49 [P]  Bestehende E2E-Suite auf den neuen Ablauf nachziehen: Antworten warten jetzt auf das Urteil des Servers, das Quizbild kommt von der eigenen Route. Dabei bleibt die Aussage jedes Tests gleich — nur das Vehikel ändert sich  · files: tests/PROJ-2-quiz-round.spec.ts, tests/PROJ-2-personal-best.spec.ts, tests/PROJ-2-access-guard.spec.ts, tests/PROJ-2-no-third-party.spec.ts  · → AC-1, AC-8, AC-9, AC-11, AC-13, AC-20, AC-29, AC-30

## Level 7 — Fixes aus dem QA-Lauf vom 2026-09-07

<!-- Drei Befunde aus dem ersten unabhängigen Prüflauf. Die Nummern sind die des qa-report.md. -->

- [x] T50  **BUG-110 (Critical): die Einreiche-Schnittstelle schließen.** Die Insert-Policy `runs_insert_own` aus `0002` stammt aus dem abgelösten Entwurf und blieb beim Umbau stehen — ein angemeldeter Nutzer schrieb damit über die Datenschnittstelle beliebige Ergebnisse (Serie 386 in 0 ms, HTTP 201). Vorwärts korrigiert in einer **neuen** Migration, weil eine bereits ausgelieferte niemals bearbeitet wird; zusätzlich die Tabellenrechte entzogen, `select` bleibt (AC-8 und EC-3 lesen darüber)  · files: supabase/migrations/0011_runs_no_client_insert.sql  · → AC-12, AC-11
- [x] T51  **BUG-111 (Medium): die angezeigte Frage bekommt einen Fehlerpfad.** Die Bildprüfung lief nur über die *vorbereitete* Frage; die erste Frage einer Runde wird direkt angezeigt und hatte weder `onError` noch Zeitgrenze. `PokemonImage` bekommt beides — 5 Sekunden, genau ein stiller zweiter Versuch, danach die Fehlerkarte. Die Frage wird dabei **nicht** ersetzt (EC-12); „Erneut versuchen" fordert dasselbe Bild neu an  · files: src/components/quiz/pokemon-image.tsx, src/components/quiz/question-view.tsx, src/components/quiz/quiz-screen.tsx  · → AC-15, AC-16, AC-17
- [x] T52  **BUG-114 (Medium): erschöpfter Ziehungsvorrat beendet die Runde.** „Pool leer" wurde stumm verschluckt, der Bildschirm blieb auf „Runde wird vorbereitet …" stehen und das Ergebnis ging verloren. Wartet der Spieler, wird die Runde jetzt gewertet und gespeichert; die Gewinner-Meldung hängt weiterhin an der Serie, nicht am leeren Vorrat  · files: src/components/quiz/quiz-screen.tsx  · → EC-2
- [x] T53  Abnahmetests zu T50–T52, jeder einzeln gegen den wiederhergestellten Fehler rot geprüft. **T50 setzt bewusst von außen an** — direkt an der Datenschnittstelle, nicht über die Oberfläche: Genau diese Perspektive fehlte der Suite, und ohne sie war der Befund unsichtbar  · files: tests/PROJ-2-round-authority.spec.ts, src/components/quiz/quiz-screen.error-states.test.tsx  · → AC-12, AC-15, AC-16, AC-17, EC-2, EC-12

## Level 8 — Fixes aus dem QA-Nachlauf vom 2026-09-07

- [x] T54  **BUG-119 (Medium, bricht AC-35): das Rundenende bei erschöpftem Vorrat gehört auf den Server.** Der Fix für BUG-114 hatte die Wertung an einen zusätzlichen Aufruf des Browsers gehängt; blieb der aus, war das Ergebnis verloren. `prepareNext` beendet die Runde jetzt selbst — aber nur, wenn keine Frage mehr offensteht — und gibt das Ergebnis mit der „Pool leer"-Antwort zurück  · files: src/lib/quiz/question-action.ts, src/lib/quiz/personal-best.ts, src/lib/quiz/run-actions.ts, src/components/quiz/quiz-screen.tsx  · → AC-35, EC-2
- [x] T55  **BUG-120 (Medium): das Rundenende nennt die Runde.** `finish_round` beendete, was gerade aktiv war — ein veralteter Tab beendete damit die laufende Runde eines anderen und bekam dessen Ergebnis. Neue Migration mit Runden-Kennung im Parameter; `endRoundAction` reicht sie durch und weist einen Aufruf ohne brauchbare Kennung ab  · files: supabase/migrations/0012_finish_round_by_id.sql, src/lib/quiz/round-state.ts, src/lib/quiz/run-actions.ts, src/components/quiz/quiz-screen.tsx  · → AC-18, AC-36, EC-15
- [x] T56  **BUG-113 (Medium): die Fehlerkarte sagt jetzt, was gilt.** Sie behauptete in beiden Fällen „die Uhr steht so lange still". Wahr ist das nur, wenn serverseitig keine Frage offensteht; beim Bildausfall der **angezeigten** Frage läuft die gewertete Zeit weiter. Die Karte unterscheidet die beiden Fälle  · files: src/components/quiz/load-error-card.tsx, src/components/quiz/quiz-screen.tsx  · → AC-16, AC-34
- [x] T57  Abnahmetests zu T54–T56, jeder einzeln rot geprüft. **Die beiden E2E-Tests stellen ihren Zustand direkt her** statt ihn zu erspielen: zwei Runden nacheinander für den veralteten Tab, und eine Ausschlussliste mit allen 386 Nummern für den erschöpften Vorrat — über die Oberfläche wäre Letzteres erst nach rund 380 Fragen erreichbar  · files: tests/PROJ-2-round-authority.spec.ts, src/components/quiz/quiz-screen.error-states.test.tsx, src/lib/quiz/question-action.test.ts, src/lib/quiz/run-actions.test.ts, src/lib/quiz/round-state.test.ts  · → AC-16, AC-18, AC-34, AC-35, AC-36, EC-2, EC-15

## Level 9 — Die Kopfzeile bis 320 px (aus `/refine` + `/architecture` vom 2026-09-08)

<!-- Zwei Aufgaben, keine davon [P]: T59 prüft, was T58 baut. Anlass sind AC-43/EC-16
     und das neu gefasste AC-24 — die Kopfzeile trägt mit dem Bestenlisten-Zugang aus
     PROJ-3 drei Bedienelemente statt zwei und passte damit unter 375 px nicht mehr. -->

- [ ] T58  **Die Kopfzeile trägt drei Bedienelemente bis hinunter zu 320 px.** Zwei Reduktionsstufen: unter 640 px zeigt der Nutzer-Chip nur die Initiale (**besteht bereits**), unter 400 px schrumpft die **Wortmarke** auf das reine Ball-Motiv — der Schriftzug „Pokémon QUIZ" entfällt dort. Dazu die engeren Maße unter 400 px als Puffer: Seitenpolsterung der Kopfzeile 18 → 10 px (**nur die Kopfzeile**, der Inhaltsbereich behält sein `clamp(18px,4vw,44px)`), Abstand Wortmarke ↔ Bedienleiste 12 → 8 px, Abstände in der Bedienleiste 8 → 6 px, waagerechte Polsterung beider Knöpfe 12 → 8 px. **Zwei Untergrenzen, die nicht unterschritten werden:** Knopfhöhe ≥ 36 px (gespart wird ausschließlich waagerecht) und Schriftgröße ≥ 13 px. Das Ball-Motiv bleibt der Link auf die Startseite und behält seine unsichtbare Beschriftung für Screenreader. **Die Reduktionsstufen dürfen nicht an die Länge des Trainernamens hängen** — unter 640 px zeigt der Chip ohnehin nur die Initiale, und genau das macht AC-43 prüfbar; ein Aufbau, der den Namen dort wieder einblendet, hält die Zusage für „Ash" und bricht sie für 20 Zeichen  · files: src/components/shell/site-header.tsx, src/components/shell/wordmark.tsx  · → AC-21, AC-24, AC-43, EC-16
- [ ] T59  **E2E-Nachweis bei 320 / 360 / 375 px**, angemeldet **und** ausgeloggt, auf `/` und `/login`: keine Seite scrollt waagerecht · **jedes** Bedienelement der Kopfzeile liegt vollständig im sichtbaren Bereich · unter 400 px steht kein Schriftzug in der Kopfzeile, ab 400 px wieder. Jede Zusage gegen den wiederhergestellten Fehler rot geprüft  · files: tests/PROJ-2-header-narrow.spec.ts  · → AC-24, AC-43, EC-16

### Prüfhinweise zu Level 9 — ohne die ist der Fix nur geschrieben, nicht belegt

**Auf `main` ist die Bedingung für diesen Fix gar nicht hergestellt.** Dort steht `LEADERBOARD_PAGE_EXISTS` auf `false` (`src/lib/site-pages.ts`), die Kopfzeile trägt also nur **zwei** Bedienelemente, passt bei 320 px und macht jeden Test trivial grün. Daraus folgen drei Dinge:

1. **T58 gilt erst als belegt, wenn mit lokal umgelegtem Schalter gemessen wurde** — auf `true` setzen, bei 320 px messen, zurücksetzen, **nicht committen**. Genau der Aufbau, mit dem der Befund am 2026-09-08 entstanden ist. Ohne diese Messung ist die Aufgabe geschrieben und nicht geprüft.
2. **T59 ist elementzahl-unabhängig formuliert** („jedes Bedienelement der Kopfzeile"), damit der Test heute wahr ist und beim Merge von PROJ-3 **von selbst** Zähne bekommt, statt nachträglich angepasst werden zu müssen.
3. **Der abschließende Beweis steht erst nach dem Merge von PROJ-3 an:** drei Elemente bei 320 px im echten Zusammenspiel. Bis dahin ist er nicht führbar — das ist keine Nachlässigkeit, sondern eine Folge davon, dass Ursache und Fix auf verschiedenen Branches liegen. Gehört in den QA-Lauf nach dem Merge.

**Die Ausgangsmessung, gegen die zu vergleichen ist** (2026-09-08, Chromium-Mobilemulation, angemeldet, mit umgelegtem Schalter): Die Kopfzeile braucht konstant **375 px**; „Abmelden" ist bei 320 px zu 39 % sichtbar, bei 344 px um 31 px abgeschnitten, bei 360 px um 15 px, ab 375 px unauffällig. `scrollLeft` blieb dabei 0 — der abgeschnittene Teil war durch Scrollen **nicht** erreichbar.

## Parallelization

- **Ebenen sind Schranken.** Eine Ebene beginnt erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Datenbankregeln (L2) → Server-Bausteine (L3) → Schnittstellen (L4) → Oberfläche (L5) → Absicherung (L6).
- **`[P]` verlangt disjunkte Dateien.** Keine zwei `[P]`-Aufgaben derselben Ebene nennen denselben Pfad unter `files:` — geprüft für L1 (2 Aufgaben), L2 (2), L3 (3), L4 (3), L5 (3 neben T44), L6 (1 neben T48).
- **T44 trägt bewusst kein `[P]`.** Seine Dateien wären disjunkt, aber er legt die Schnittstellen von T45–T47 fest; parallel gebaut, würden die vier aneinander vorbeireden.
- **`[user]`-Aufgaben sind nie parallel und werden nie gebaut.** Sie stehen in der Ebene, deren Code auf ihnen aufsetzt; `/build` reicht sie weiter und macht ohne sie weiter, das Kästchen bleibt offen, bis der Nutzer es abhakt.

## AC-Abdeckung

Jede AC und jede gültige EC ist zugeordnet. „Unverändert" heißt: bereits gebaut (Aufgaben T1–T31 in der Historie), von diesem Umbau nicht berührt und durch **T49** dagegen abgesichert.

| Kriterium | Aufgaben |
| --- | --- |
| AC-1 | T44, T49 (Ansicht unverändert) |
| AC-2 | T41, T44 |
| AC-3 | T41 |
| AC-4 | T44, T45 |
| AC-5 | T34, T41 |
| AC-6 | T44, T45 |
| AC-7 | T47 |
| AC-8 | T41, T47 |
| AC-9 | T44 |
| AC-10 | T44, T46 |
| AC-11 | T34, T41 |
| AC-12 | T33, T38, T41, T48 |
| AC-13 | unverändert (Routenschutz aus PROJ-1), T49 |
| AC-14 | T39, T41, T48 |
| AC-15 | T40, T46 |
| AC-16, AC-17 | T44 |
| AC-18 | T34, T41, T44 |
| AC-19 | T44 |
| AC-20 | T42, T43, T46, T49 |
| AC-21 – AC-25 | unverändert (App-Shell), T49 · **AC-21 und AC-24 zusätzlich T58, T59** (Reduktionsstufen der Kopfzeile, 2026-09-08) |
| AC-26, AC-27 | unverändert (`runs` aus Migration `0002`); T33 nur für die Umbenennung |
| AC-28 | T32, T42 |
| AC-29, AC-30 | unverändert, T49 |
| AC-31 | T40 |
| AC-32 | T41, T42, T43, T46, T48 |
| AC-33 | T34, T38, T39, T41, T48 |
| AC-34 | T34, T39 |
| AC-35 | T34, T41 |
| AC-36 | T32, T34 |
| AC-37 | T40, T42 |
| AC-38 | T32 |
| AC-39 | T34 |
| AC-40 | T32 |
| AC-41 | T35, T36, T37 |
| AC-42 | T32 (Aufzählung in AC-38 ergänzt, keine eigene Aufgabe) |
| AC-43 | T58, T59 |
| EC-1 | T34, T44, T48 |
| EC-2 | T34, T41 |
| EC-3 | T41, T47 |
| EC-4 | T33, T34 |
| EC-5 | T41 |
| EC-6 | T44, T46 |
| EC-7 | T41, T48 |
| EC-8 | unverändert (T40 erbt das Verhalten) |
| EC-9 | T41 |
| EC-10 | T44 |
| EC-11 | entfallen am 2026-09-04 |
| EC-12 | T34, T44 |
| EC-13, EC-14 | **keine Bauaufgabe** — bewusst akzeptierte Restrisiken, im Vertrag benannt und in `design.md` begründet |
| EC-15 | T34, T44, T48 |
| EC-16 | T58, T59 |

---

## Historie — der abgelöste Bauplan (T1–T31, 2026-09-01 bis 2026-09-05)

> Der Bauplan des **clientseitig geführten** Entwurfs, abgelöst am 2026-09-06. Er bleibt vollständig stehen, weil `qa-report.md` und die Bug-Notizen auf seine T-Nummern verweisen — deshalb beginnt der neue Plan oben bei T32 statt wieder bei T1.
>
> Abgehakte Kästchen hier bedeuten „damals gebaut", nicht „gilt weiter". Was tatsächlich weiterlebt: die App-Shell (T7), die Quiz-Ansichten als Bausteine (T8), Bewegung und Zugänglichkeit (T9), der Wächter über die Server Actions (T24, T25) und der Routenschutz (T23, T26).



> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Dies ist der geordnete, nachvollziehbare Bauplan — die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: Die Dateien der Aufgabe sind disjunkt zu jeder anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also in einen eigenen Subagenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe verweist auf die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette AC → Task → Test.
> Besitzer: `/tasks` erzeugt diese Datei; `/build` hakt die Kästchen ab.

**Keine `[user]`-Aufgaben.** `design.md` → Settings the user makes ist leer: Dieses Feature braucht keine Einstellung in einem Anbieter-Dashboard.

### Level 1 — Datenschicht

<!-- Fundament. Läuft zuerst, weil alles Weitere auf dem Datenvertrag aufsetzt. -->

- [x] T1  Migration `runs`: Tabelle (Profil-Verweis mit Löschkaskade, Serie, Dauer, Runden-Kennzeichen, Zeitstempel), Grenzwerte als Datenbankregeln (Serie 0–386, Dauer ≥ 0, Dauer ≥ 500 × Serie), eindeutiges Runden-Kennzeichen, RLS (lesen nur eigene, anlegen nur für sich selbst, kein Ändern/Löschen), zusammengesetzter Index über Profil + Serie absteigend + Dauer aufsteigend  · files: supabase/migrations/0002_runs.sql  · → AC-11, AC-12, AC-14, AC-26, AC-27, EC-4

### Level 2 — Server-Bausteine

<!-- Drei voneinander unabhängige Bausteine, drei verschiedene Dateien → alle [P]. -->

- [x] T2 [P]  PokeAPI-Anbindung: deutschen Namen über `/pokemon-species/{id}` holen, **mit ausdrücklich erzwungenem Zwischenspeicher (30 Tage)** — das Standardverhalten cached nicht, siehe `design.md`; Bildadresse aus der Pokémon-Nummer bilden ~~und bei fehlendem Bild über `/pokemon/{id}` die offizielle Adresse nachschlagen~~ (**der Nachschlage-Teil ist am 2026-09-04 durch T18 zurückgenommen worden — siehe EC-11**); 5-Sekunden-Zeitgrenze mit genau einem stillen Wiederholungsversuch  · files: src/lib/pokeapi/client.ts  · → AC-15, AC-28, AC-31, EC-5, EC-8, EC-11
- [x] T3 [P]  Prüfschema für Rundenergebnisse: Serie ganzzahlig 0–386, Dauer ganzzahlig ≥ 0, Dauer ≥ 500 × Serie, Runden-Kennzeichen als UUID  · files: src/lib/validation/quiz.ts  · → AC-12
- [x] T4 [P]  Bild-Auslieferung und Beobachtbarkeit konfigurieren: Bild-Host für die Sprites freischalten (damit der Browser nur die eigene Domain anfragt), Zwischenspeicher-Dauer für optimierte Bilder setzen, `fetch`-Protokollierung für den Entwicklungsmodus aktivieren (macht Cache-Treffer für `/qa` überhaupt sichtbar, siehe Prüfhinweise unten)  · files: next.config.ts  · → AC-20, AC-28, AC-31

### Level 3 — Server Actions

<!-- Setzen auf Level 2 auf. Zwei verschiedene Dateien → beide [P]. -->

- [x] T5 [P]  Server Action „nächste Frage": nimmt die Liste der bereits gezeigten Nummern entgegen, zieht eine neue Lösung plus drei verschiedene falsche Optionen aus 1–386, holt alle vier deutschen Namen, mischt die Reihenfolge, verwirft ein Pokémon ohne deutschen Namen serverseitig und zieht neu, meldet „Pool leer" wenn alle 386 verbraucht sind, weist Aufrufe ohne gültige Sitzung ab  · files: src/lib/quiz/question-action.ts  · → AC-3, AC-5, AC-15, EC-2, EC-5, EC-6, EC-7, EC-11
- [x] T6 [P]  Server Action „Runde speichern" (prüft serverseitig gegen das Schema aus T3, schreibt immer für das Profil aus der Sitzung, zweite Einreichung desselben Runden-Kennzeichens erzeugt keine zweite Zeile und meldet trotzdem Erfolg) plus Lesefunktion für die persönliche Bestleistung  · files: src/lib/quiz/run-actions.ts  · → AC-8, AC-11, AC-12, AC-14, AC-27, EC-3, EC-4, EC-7

### Level 4 — UI-Bausteine

<!-- Reine Darstellung, keine Zustandslogik. Drei disjunkte Dateimengen → alle [P]. -->

- [x] T7 [P]  App-Shell: Wortmarke (Ball-Motiv in CSS gezeichnet, kein offizielles Logo), Kopfzeile mit beiden Auth-Zuständen und Nutzer-Chip (unter 640 px nur die Initiale), Fußzeile, die nur Links zu bereits existierenden Rechts-Seiten zeigt, Seitenrahmen, alles im Wurzel-Layout verdrahtet. Dabei bewahren, nicht neu bauen: Schriften bleiben selbst ausgeliefert, es kommt keine Tracking-Ressource hinzu  · files: src/components/shell/wordmark.tsx, src/components/shell/site-header.tsx, src/components/shell/site-footer.tsx, src/components/shell/page-frame.tsx, src/app/layout.tsx  · → AC-21, AC-22, AC-23, AC-24, AC-29, AC-30
- [x] T8 [P]  Quiz-Ansichten ohne Zustandslogik: Antwortoption mit vier Zuständen (unbeantwortet, richtig, falsch, nicht gewählt), Statusleiste mit Serie und Uhr in gleichbreiten Ziffern, Pokémon-Bild mit Skelettfläche in Bildgröße, Startansicht, Ergebnisansicht (Serie, Zeit, Bestleistungs-Hinweis, Gewinner-Meldung bei leerem Pool, Hinweis auf fehlgeschlagenes Speichern), Fehlerkarte innerhalb der Quiz-Karte, Frageansicht  · files: src/components/quiz/answer-option.tsx, src/components/quiz/status-bar.tsx, src/components/quiz/pokemon-image.tsx, src/components/quiz/start-view.tsx, src/components/quiz/result-view.tsx, src/components/quiz/load-error-card.tsx, src/components/quiz/question-view.tsx  · → AC-1, AC-6, AC-7, AC-8, AC-16, AC-25
- [x] T9 [P]  Bewegung und Zugänglichkeit: Keyframes `in`, `pop`, `nudge`, `float`, durchgehende Beachtung von `prefers-reduced-motion` (Zustandswechsel bleiben, Bewegung entfällt), sichtbare Fokus-Ringe auf allen interaktiven Elementen  · files: src/app/globals.css  · → AC-4, AC-6, AC-8, AC-25

### Level 5 — Zusammenbau

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

### Level 6 — Fixes aus dem QA-Lauf vom 2026-09-04

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

### Level 7 — Fixes aus dem QA-Lauf vom 2026-09-04 (zweiter des Tages)

- [x] T17  E2E-Suite auf das neue AC-9-Verhalten nachziehen (BUG-14). `PROJ-2-personal-best.spec.ts` prüft jetzt **positiv**, dass nach „Nochmal spielen" von selbst eine offene Frage erscheint; die Bestleistung wird über `/` geprüft, so wie AC-1 sie festmacht. `PROJ-2-quiz-round.spec.ts` tauscht nur das Vehikel (`goto('/')` statt Knopf), die Aussage zu AC-11 bleibt unverändert  · files: tests/PROJ-2-personal-best.spec.ts, tests/PROJ-2-quiz-round.spec.ts  · → AC-1, AC-8, AC-9, AC-11

- [x] T18  Rückfallebene der Bildadresse ersatzlos entfernen (BUG-16, nach `/refine` auf EC-11): `repairImageUrl` (Server Action) und `resolveOfficialImageUrl` (PokeAPI-Client) samt ihrer Tests gestrichen, Reparaturzweig und `repairedRef` aus der Zustandsmaschine entfernt. Ein nicht ladbares Bild führt jetzt unmittelbar zu EC-6, drei in Folge zu EC-10. Nebenwirkung: eine Server Action weniger an der Angriffsfläche  · files: src/lib/pokeapi/client.ts, src/lib/quiz/question-action.ts, src/components/quiz/quiz-screen.tsx, src/lib/pokeapi/client.test.ts, src/lib/quiz/question-action.test.ts, src/components/quiz/quiz-screen.error-states.test.tsx, src/components/quiz/quiz-screen.test.tsx  · → EC-6, EC-10, EC-11, AC-31

- [x] T19  Zeitgrenze für das Vorladen des Bildes (BUG-15): `ImageProbe` gibt nach 5 Sekunden auf, lädt genau einmal still neu (AC-15) und meldet dann den Fehlschlag, sodass EC-6 greift. Der zweite Versuch läuft über den React-`key`, nicht über die Adresse — sonst bräche er den Zwischenspeicher (AC-31) und die Auslieferung über die eigene Domain (AC-20)  · files: src/components/quiz/pokemon-image.tsx, src/components/quiz/quiz-screen.error-states.test.tsx  · → AC-15, AC-16, EC-6
- [x] T20  Worker-Zahl der E2E-Suite deckeln  · files: playwright.config.ts  · → kein AC (Messaufbau)

- [x] T21  Eingabevalidierung an beiden ungeschützten Server Actions (BUG-12) und damit zugleich BUG-17s ausnutzbare Hälfte: `seenIdsSchema` (Array von Pool-Nummern, längenbegrenzt) für `getNextQuestion`, `z.uuid().optional()` für `getPersonalBest`. **Vertragsänderung:** Die Ausschlussliste wird jetzt **abgewiesen** statt gesäubert — die alte Nachsicht war die Lücke  · files: src/lib/validation/quiz.ts, src/lib/quiz/question-action.ts, src/lib/quiz/run-actions.ts, src/lib/quiz/question-action.test.ts, src/lib/quiz/run-actions.test.ts  · → AC-5, EC-2
- [x] T22  Gewinner-Prüfung zählt die Serie statt der Ausschlussliste (BUG-17, Client-Hälfte): Verworfene Fragen stehen in `seenIdsRef`, sind aber keine richtigen Antworten. EC-2 fragt nach „alle 386 richtig beantwortet", und genau das ist die Serie  · files: src/components/quiz/quiz-screen.tsx  · → EC-2

- [x] T23  Abgelaufene Sitzung führt wieder auf `/login` (BUG-9, EC-7): Der Proxy leitet **Server-Action-POSTs** nicht mehr um. Next.js kodiert das `redirect()` einer Action in-band (Status 200 plus `x-action-redirect`), gerade damit der Browser keiner 307 folgt — eine gewöhnliche Weiterleitung darauf ist für den Action-Handler ein Protokollbruch, und der `unauthenticated`-Zweig der Actions war dadurch **unerreichbar**. Vom Nutzer ausdrücklich genehmigt (Auth-Fluss, `.claude/rules/security.md`)  · files: src/proxy.ts, src/proxy.test.ts  · → EC-7
- [x] T24  Wächter über alle Server Actions: findet per TypeScript-AST **jede** aus einer `'use server'`-Datei exportierte Funktion und verlangt entweder eine Sitzungsprüfung oder einen begründeten Eintrag in `PUBLIC_ACTIONS`. Macht die Zusicherung aus T23 strukturell statt einmalig  · files: src/lib/actions/server-actions.guard.test.ts  · → EC-7, AC-13, AC-14

### Level 8 — Fixes aus dem QA-Lauf vom 2026-09-05

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

### Level 9 — Fixes aus dem QA-Lauf vom 2026-09-05 (zweiter)

- [x] T30  Off-by-one auf dem Pfad „Pool leer" behoben (BUG-33): `answer` plant `advance` aus dem Render **vor** `setStreak`, das eingefangene `fetchQuestion` hielt die alte Serie in seiner Closure. Ein `streakRef` wird neben `setStreak` gesetzt und ist zum Zeitpunkt des Timeouts aktuell; `streak` fällt dadurch aus den Abhängigkeiten von `fetchQuestion`, dessen Identität über eine ganze Runde stabil bleibt — das war die eigentliche Ursache, nicht die eine Zeile  · files: src/components/quiz/quiz-screen.tsx, src/components/quiz/quiz-screen.error-states.test.tsx  · → EC-2, AC-11
- [x] T31  Die Zusage über den Wächter auf das gestutzt, was er wirklich leistet (BUG-32, BUG-34, BUG-35, BUG-36 — **bewusst nicht durch Erweiterung**): `design.md` führt Können **und** Grenzen samt Messung auf, benennt die Aufgabenteilung mit dem Code-Review und sagt, worauf ein Review bei einer neuen Action konkret achten muss. Die Kommentare in `proxy.ts` und `server-actions.guard.ts`, die sich auf die zu große Zusage stützten, sind korrigiert — inklusive der Fehlermeldung, die ein Entwickler zu lesen bekommt  · files: features/PROJ-2-pokemon-quiz/design.md, src/proxy.ts, src/lib/actions/server-actions.guard.ts, src/lib/actions/server-actions.guard.test.ts  · → EC-7
- [x] T32  Doku-Drift nachgezogen, die T29 ausgelassen hatte (BUG-38): T14 und T15 beschrieben `repairImageUrl` und den Reparaturzweig weiter im Präsens  · files: features/PROJ-2-pokemon-quiz/tasks.md  · → EC-11

**Warum der Wächter nicht weiter aufgebohrt wird.** Ein Prüfer, der entscheidet, ob das Ergebnis von `getUser` den Ablauf tatsächlich steuert, wäre eine Datenflussanalyse. Der dritte Anlauf auf dieselbe Zusicherung würde denselben Fehler zum dritten Mal machen: einen Prüfer bauen, der etwas Schwächeres misst als sein Name behauptet — und dem man deshalb zu Unrecht vertraut. Entscheidung des Nutzers am 2026-09-05.

- [x] T33  Drosselung der Zugangsdaten-Pfade (BUG-29, BUG-30, BUG-31 in einem Zug): Zähler in Postgres, aufgerufen **aus den Actions** statt aus dem Proxy — eine Schranke am Pfad ist bei Server Actions umgehbar. Zwei Zähler (IP und Konto), Grenzwerte aus `docs/production/rate-limiting.md`, Zurücksetzen nach erfolgreicher Anmeldung. Die Zählfunktionen sind nur für `service_role` ausführbar, sonst wäre die Drosselung eine Aussperr-Waffe  · files: supabase/migrations/0003_auth_throttle.sql, src/lib/supabase/admin.ts, src/lib/auth/throttle.ts, src/lib/auth/actions.ts, src/lib/auth/throttle.test.ts, .env.local.example  · → PROJ-1 AC-8, EC-4

- [x] **T34 [user]  `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` eingetragen** (2026-09-05). Belegt, nicht bloß behauptet: Ohne den Schlüssel wirft `createAdminClient()`, die Anmeldung verweigert den Dienst und **jeder** E2E-Lauf wäre rot. Der Lauf ist grün, und `PROJ-1-throttle.spec.ts` weist zusätzlich nach, dass der Zähler in Postgres wirklich zählt — beides geht nur mit gültigem Schlüssel.

- [x] T35  **E2E-Messaufbau von der Drosselung entkoppelt.** Der erste Lauf nach T33 war **8 von 24 rot** — alle mit „Zu viele Versuche von dieser Verbindung" auf dem Registrierungsformular. Das war die Drosselung bei der Arbeit, kein Produktfehler: 24 Tests aus drei Browser-Projekten registrieren aus derselben Quelle, das Limit sind 5 Anfragen je Minute und IP. `tests/fixtures.ts` gibt jedem Test über `x-forwarded-for` eine eigene Adresse aus dem Dokumentationsbereich `2001:db8::/32` (RFC 3849), Kontexte, die eine Spec selbst aufmacht, bekommen sie ausdrücklich mit  · files: tests/fixtures.ts, tests/PROJ-1-password-reset.spec.ts, tests/PROJ-2-access-guard.spec.ts, tests/PROJ-2-no-third-party.spec.ts, tests/PROJ-2-personal-best.spec.ts, tests/PROJ-2-quiz-round.spec.ts  · → PROJ-1 AC-8

- [x] T36  **Wächter über die Drosselung selbst** — sonst hätte T35 sie bloß unsichtbar gemacht. `PROJ-1-throttle.spec.ts` macht von **einer** Adresse aus die Grenze voll: Versuche 1–5 kommen bis zur Passwortprüfung durch, der sechste wird abgewiesen, und die Absage tritt **an die Stelle** der Zugangsdaten-Prüfung. Geprüft wird bei den ersten fünf die *Abwesenheit* der Drosselmeldung — die Meldung über falsche Zugangsdaten steht ab dem ersten Versuch da und wäre danach ein Treffer, der nichts aussagt. Das ist der Nachweis, den die Unit-Tests nicht führen können: dass der Zähler **auf dem Weg durch die echte Server Action** überhaupt erreicht wird — der Kern von BUG-30 und BUG-31  · files: tests/PROJ-1-throttle.spec.ts  · → PROJ-1 AC-8, EC-4

- [x] T37  **Pre-Commit-Wächter gebaut (schließt BUG-36).** `.githooks/pre-commit`, aktiviert über `core.hooksPath` aus dem `prepare`-Skript — im Repository liegend und damit einen frischen Klon überlebend, anders als alles unter `.git/hooks/`. Er (1) blockt vorgemerkte echte Umgebungsdateien (`.env`, `.env.*`; `*.example` ausgenommen), (2) blockt Schlüssel-Muster im vorgemerkten Inhalt (JWT, `sb_secret_…`, `sbp_…`, private Schlüsselblöcke) und (3) fährt `npm test`, sobald Code im Commit liegt. **Die Fundstelle wird nie ausgegeben** — sie wäre der Schlüssel. Damit stimmt die Begründung in `design.md`, die BUG-36 widerlegt hatte. An vier Fällen geprüft: env-Datei → blockiert, JWT → blockiert, geänderte `.env.local.example` → durchgelassen, reine Doku → `npm test` übersprungen  · files: .githooks/pre-commit, .gitattributes, package.json, features/PROJ-2-pokemon-quiz/design.md  · → EC-7

- [x] T38  **BUG-39 behoben (High, aus dem QA-Lauf vom 2026-09-05):** Ein erfolgreicher Login löscht nur noch den **Konto**-Zähler; der IP-Zähler bleibt stehen. Vorher wurde er mitgelöscht und war damit von jedem abschaltbar, der ein einziges eigenes Konto besitzt — gemessen 24 Passwortversuche gegen 24 Konten von einer IP in 3,6 s, null abgewiesen. Gegen Passwort-Spraying greift der Konto-Zähler nicht, dort ist der IP-Zähler die einzige Bremse. **Der Abnahmetest fährt das ganze Szenario** (raten → eigener Login → weiter raten), weil ein Test auf „Konto-Zähler ist nach dem Login leer" auch gegen den kaputten Code grün gewesen wäre; rot-geprüft gegen das alte Verhalten. Mitgefunden und mitbehoben: Die gefälschten Testadressen in `tests/fixtures.ts` waren pro Lauf identisch, wodurch zwei Läufe innerhalb einer Minute denselben Zähler erbten — sie tragen jetzt eine Kennung je Lauf  · files: src/lib/auth/throttle.ts, src/lib/auth/throttle.test.ts, tests/PROJ-1-throttle.spec.ts, tests/fixtures.ts, features/PROJ-1-user-login/design.md  · → PROJ-1 AC-8

- [x] T39  **BUG-54 behoben (Medium, Nebenwirkung des BUG-39-Fixes):** Der IP-Zähler zählt nur noch **Fehl**versuche — ein erfolgreicher Login erstattet genau den einen Versuch, den er selbst hochgezählt hat (`refund_auth_attempt`, Migration `0004`). Vorher verbrauchte auch der geglückte Login Budget, weil vor der Passwortprüfung gezählt wird; gemessen: acht Spieler mit **richtigem** Passwort hinter einer geteilten Adresse, fünf kamen hinein, drei wurden abgewiesen — trifft Familien-, Schul- und CGNAT-Anschlüsse, und die Zielgruppe im PRD schließt Kinder ausdrücklich ein. **Erstattet statt „erst prüfen, dann zählen"**, weil Zählen und Prüfen bewusst in einem SQL-Statement stecken und getrenntes Lesen/Schreiben die Gleichzeitigkeitslücke wieder aufreißen würde. **Nur für den Login:** `settleSuccessfulLogin()` nimmt keinen `scope` entgegen, damit Registrierung und Reset strukturell nicht erstatten können — dort ist die begrenzte Sache die Handlung selbst, mit Erstattung wäre Massenregistrierung unbegrenzt (BUG-47). **Zwei Abnahmetests, weil einer die Zusage nicht aufspannt:** gegen den Urzustand fällt nur der BUG-39-Test, gegen den Zwischenstand fallen beide, und der Urzustand hätte den BUG-54-Test bestanden — beide Rot-Proben durchgeführt und in `design.md` tabelliert  · files: supabase/migrations/0004_auth_throttle_refund.sql, src/lib/auth/throttle.ts, src/lib/auth/actions.ts, src/lib/auth/throttle.test.ts, tests/PROJ-1-throttle.spec.ts, features/PROJ-1-user-login/design.md  · → PROJ-1 AC-8

- [x] T40  **BUG-56 behoben (Medium):** Aufbewahrung der Zählertabelle. Zwei Mechanismen, weil einer die Lücke nicht schließt — (1) `prune_auth_throttle()` entfernt laufend abgelaufene Fenster, aufgerufen aus `register_auth_attempt` selbst: Wer zählt, räumt auch auf, und der Mechanismus kann nicht vergessen werden wie eine Dashboard-Einstellung (genau daran scheiterte BUG-36). (2) Trigger `on_auth_user_deleted` auf `auth.users` löscht alle Konto-Schlüssel sofort mit dem Konto — sie hängen an keinem Fremdschlüssel, die Kaskade erreichte sie nicht, und PROJ-4 hätte eine Löschung vollzogen, die etwas zurücklässt. **Die IP-Schlüssel bleiben dabei ausdrücklich stehen**, sonst wäre „Wegwerf-Konto anlegen und löschen" BUG-39 in neuer Verkleidung. Gegen die laufende Datenbank belegt: Rückstand von 1258 Zeilen abgeräumt, danach 0 älter als eine Stunde; von drei Probezeilen genau die beiden abgelaufenen gelöscht; nach `delete from auth.users` alle drei Konto-Schlüssel weg, IP-Schlüssel unverändert. **Benannte Lücke:** kein automatischer Wächter — ein gemockter Unit-Test würde nur den Mock bestätigen, für einen echten SQL-Test fehlt der Rahmen. `docs/privacy.md` ist mitgezogen (Mechanismus und Aufbewahrung standen dort falsch)  · files: supabase/migrations/0005_auth_throttle_retention.sql, docs/privacy.md, features/PROJ-1-user-login/design.md  · → PROJ-1 AC-8, PROJ-2 AC-26

- [x] T41  **BUG-55 und BUG-57 als bewusst akzeptiertes Risiko dokumentiert** (Entscheidung des Nutzers am 2026-09-05, ausdrücklich *nicht* behoben): `design.md` → „Bewusst akzeptierte Risiken der Drosselung" führt beide mit der genauen Zahl — 4 von 8 Spielern hinter einem geteilten Anschluss mit je einem Tippfehler; 20 Anfragen je 15 Minuten genügen zum Aussperren eines bekannten Kontos. Beide hängen an derselben Stellschraube, und wer eine anfasst, muss beide neu rechnen. Steht dort, damit niemand sie später für ein Versehen hält und beiläufig „repariert"  · files: features/PROJ-1-user-login/design.md  · → PROJ-1 AC-8

- [x] T42  **Entscheidungen zum finalen QA-Lauf umgesetzt** (Nutzer, 2026-09-05). **(1) BUG-61 zum Deploy-Blocker umgestuft** statt im Code gehärtet: Ob `x-forwarded-for` vertrauenswürdig ist, weiß nur die Ebene davor; eine Härtung im Code hätte die tags zuvor festgeschriebene Abwägung aus BUG-55/57 wieder aufgerissen. In `features/INDEX.md` als härtester Eintrag geführt, mit **Anbieter-Voraussetzung** (Host setzt/überschreibt den Header selbst und übernimmt ihn nicht vom Client — Vercel tut das; `proxy_add_x_forwarded_for` **hängt an** und genügt nicht) und **Schließbedingung**: gemessen an der echten Live-URL, dass ein selbst gesetzter Header den Zähler nicht beeinflusst. Eine Anbieter-Zusage in einer Dokumentation genügt ausdrücklich nicht. **(2) BUG-62 durch Korrektur des Wortlauts erledigt** statt durch einen Umbau: `docs/privacy.md` sagt keine feste Höchstfrist mehr zu, sondern beschreibt beide Wege getrennt — verkehrsabhängiges Aufräumen (bis zu 50 Zeilen je Versuch) und die sofortige, verkehrsunabhängige Löschung mit dem Konto, auf der das Löschungsrecht ruht. Der `pg_cron`-Ausbau ist als Backlog `B2` für den Deploy vermerkt, **nicht gebaut**  · files: features/INDEX.md, docs/privacy.md, features/PROJ-1-user-login/design.md, features/PROJ-2-pokemon-quiz/tasks.md, features/PROJ-2-pokemon-quiz/qa-report.md  · → PROJ-1 AC-8

- [ ] **BUG-58 zurückgestellt** (Entscheidung des Nutzers am 2026-09-05): Fehlerhaft geformte Action-Daten ergeben HTTP 500 statt einer sauberen Absage. Aus dem Browser vermutlich nicht auslösbar.
- [ ] **BUG-40 und BUG-41 zurückgestellt** (Entscheidung des Nutzers am 2026-09-05): Lücken im Pre-Commit-Wächter — Aktivierung erst nach `npm install`, und ein Umlaut im Dateinamen umgeht beide Prüfungen. Begründung des Nutzers: geringes Risiko, solange nur eine Person am Repository arbeitet. **Diese Begründung trägt genau so lange, wie sie stimmt** — kommt jemand dazu, ist sie neu zu bewerten.

**Entscheidungen und ihr Preis** stehen in `features/PROJ-1-user-login/design.md` → „Drosselung der Zugangsdaten-Pfade": Postgres statt Upstash (kein zweiter externer Blocker neben SMTP), Service-Role statt Browser-Schlüssel (sonst Aussperr-Waffe), fail-closed statt fail-open, und ein bewusst weiter gefasster Konto-Zähler, weil ein enger ohne CAPTCHA jedes Konto aussperrbar machen würde.

### Backlog — bewusst offen

Nicht Teil dieser Lieferung, aber festgehalten, damit es nicht nur im Chat steht. Diese Punkte haben **kein Acceptance Criterion**; sie werden erst dann Aufgaben, wenn jemand sie ausdrücklich in die Spec holt (`/refine PROJ-2`).

- [ ] **B1  Drosselung der Server Actions** (aus `qa-report.md` → BUG-2, Severity Low, am 2026-09-02 bewusst zurückgestellt)
  `getNextQuestion` und `saveRun` haben keine Begrenzung; ein angemeldeter Nutzer kann sie in einer Schleife aufrufen.
  **Warum es jetzt vertretbar ist:** Wiederholte Pokémon kommen aus dem Zwischenspeicher und erzeugen keine Last bei der PokeAPI (AC-31); `saveRun` kann ausschließlich eigene Zeilen anlegen und ist durch AC-12 begrenzt. Es gibt keinen Zugangsdaten-Pfad in diesem Feature.
  **Wann es akut wird:** wenn die App öffentlich erreichbar ist. Über immer neue Nummern lassen sich weiterhin echte Anfragen an die PokeAPI auslösen — das arbeitet gegen deren Fair-Use-Bitte, um die dieses Feature sich sonst ausdrücklich bemüht.
  **Nächster Schritt, wenn es angegangen wird:** vor dem öffentlichen Start neu bewerten; der Mechanismus steht in `docs/production/rate-limiting.md` und im Framework-Pack. Kein `[user]`-Task — es wäre Anwendungscode.

- [ ] **B2  Zeitgesteuertes Aufräumen der Drosseltabelle** (aus `qa-report.md` → BUG-62, Severity Medium, am 2026-09-05 auf Entscheidung des Nutzers als Backlog-Punkt für den Deploy vermerkt — **jetzt bewusst nicht gebaut**)
  Heute räumt `prune_auth_throttle()` **beim nächsten Anmelde-, Registrierungs- oder Reset-Versuch** auf, und zwar bis zu 50 Zeilen je Versuch (`supabase/migrations/0005_auth_throttle_retention.sql`). Ohne Datenverkehr geschieht nichts, und ein großer Rückstand baut sich über mehrere Versuche ab — gemessen: 200 abgelaufene Zeilen, nach einem Login-Versuch 100 gelöscht, 100 blieben liegen.
  **Warum es jetzt vertretbar ist:** Der Weg, auf dem das Löschungsrecht ruht, ist der andere — der Trigger `on_auth_user_deleted` löscht die Schlüssel mit der E-Mail-Adresse **sofort und unabhängig vom Verkehr**. Die verbleibenden Zeilen tragen Adresse, Zeitpunkt und Anzahl; im laufenden Betrieb dieses Projekts lag die Tabelle nach dem Fix durchgehend bei **0 Zeilen älter als eine Stunde**.
  **Wann es akut wird:** wenn die App öffentlich läuft und Lastspitzen den Rückstand schneller aufbauen, als der Abbau je Versuch ihn abträgt — oder wenn eine feste Höchstfrist zugesagt werden soll. `docs/privacy.md` sagt heute bewusst **keine** harte Frist zu.
  **Nächster Schritt, wenn es angegangen wird:** `pg_cron` im gehosteten Projekt einschalten und `prune_auth_throttle()` regelmäßig aufrufen. Das war beim Bau von `0005` bereits die erwogene Alternative und wurde verworfen, weil es eine Erweiterung braucht, die im Dashboard eingeschaltet werden muss — also eine Aufgabe von Hand, die vergessen werden kann. Beim Deploy ist dieser Einwand kleiner, weil dort ohnehin am Dashboard gearbeitet wird.

### Prüfhinweise für `/qa`

Zwei Kriterien sind **unsichtbar, wenn sie fehlen** — bei allen anderen fällt der Fehler beim Anschauen auf. Sie brauchen deshalb eine bestimmte Methode, nicht nur Aufmerksamkeit:

**AC-31 (Zwischenspeicher) — zwei Ebenen, weil eine nicht reicht.**

Der Zwischenspeicher gehört nicht unserem Code, sondern der `fetch`-Umhüllung des Frameworks. **Außerhalb des laufenden Next-Servers, also in Vitest, sind die Zwischenspeicher-Optionen wirkungslos.** Ein Unit-Test, der den Client zweimal aufruft und Anfragen zählt, sieht deshalb auch bei völlig korrektem Code zwei Anfragen — er widerlegt nichts und verleitet dazu, eine überflüssige eigene Memoisierung einzubauen, damit er grün wird. Stattdessen:

1. **Unit-Test prüft die Anweisung:** `fetch` stubben, den Client einmal aufrufen, prüfen, dass er mit erzwungenem Zwischenspeicher und 30-Tage-Gültigkeit aufgerufen wurde. Das fängt den eigentlichen Fehlerfall — ein blank geschriebenes `fetch` — deterministisch ab.
2. **Laufzeit-Beobachtung beweist die Wirkung:** Die in T4 aktivierte `fetch`-Protokollierung schreibt jeden Aufruf mitsamt Cache-Status ins Terminal. `npm run dev` starten, eine Runde spielen, und prüfen, dass ein zum zweiten Mal vorkommendes Pokémon als Treffer erscheint und nicht als frische Anfrage. Das ist die einzige Stelle, an der der Zwischenspeicher überhaupt sichtbar wird.

**~~EC-11 (Rückfallebene der Bildadresse)~~ — hinfällig seit dem 2026-09-04.**

Die Rückfallebene ist ersatzlos entfallen (T18, `spec.md` → EC-11). An ihre Stelle tritt ein Hinweis, der über dieses Feature hinaus gilt:

**EC-6 (kaputtes Bild) — das Fehlerereignis genau *einmal* auslösen.**

Der Verwurf hängt am `onError` eines `<img>`. Ein Test, der das Ereignis in einer Schleife von Hand nachfeuert, prüft den interessanten Fall weg: Genau das tut der Browser nämlich nicht. Der ursprüngliche Abnahmetest zu BUG-8 war deshalb **auch gegen den kaputten Code grün** und musste umgeschrieben werden. Einmal feuern, dann verlangen, dass die Runde von selbst weiterzieht.

### Parallelization

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Server-Bausteine (L2) → Server Actions (L3) → UI-Bausteine (L4) → Zusammenbau (L5).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Ebene nennen nie denselben Pfad unter `files:`. Geprüft: L2 (drei Dateien), L3 (zwei Dateien) und L4 (drei Dateimengen) sind jeweils überschneidungsfrei.
- **T10 ist bewusst eine einzige Aufgabe.** Zustandsmaschine und Startseite teilen sich zwangsläufig Zustand und Schnittstelle; eine Aufteilung hätte zwei Agenten auf dieselbe Datei gesetzt und damit die Disjunktheitsregel verletzt, ohne Zeit zu sparen.
- **Tests schreibt `/qa`, nicht `/build`** (`CLAUDE.md` → Key Conventions). Deshalb steht hier keine Test-Aufgabe — die Methode für die beiden unsichtbaren Kriterien ist oben hinterlegt.
