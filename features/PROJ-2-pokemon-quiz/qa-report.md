# QA Test Results

> **Dieser Bericht hat mehrere Durchgänge.** Der jeweils **unterste** ist der jüngste und trägt die gültige Bewertung; die älteren bleiben unverändert stehen, weil ein Bericht, der nachträglich grün geschrieben wird, nichts mehr wert ist.

---

## Dritter Lauf — 2026-09-02, nach den Fixes für BUG-3, BUG-4 und BUG-5

**Anlass:** Der Nutzer hatte PROJ-2 nach einem manuellen Test wieder auf *In Review* gesetzt (BUG-3 Weiterleitungsschleife, BUG-4 Zugangsdaten in der URL). Beide sind mit `6d1e5e7` behoben, BUG-5 mit `3937e52`. Dieser Lauf prüft die Fixes nach **und rollt die Acceptance Criteria vollständig neu auf**, statt frühere Häkchen zu übernehmen.

**Umgebung:** `npm run dev` auf `http://localhost:3000`, lokale Supabase-Instanz in Docker, Browser-Prüfungen in Chromium (bereits aus einem früheren Lauf installiert — es wurde nichts nachgeladen).

> Legende: `[x]` in **diesem** Lauf verifiziert (Nachweis auf derselben Zeile) · `[ ] BUG` als defekt verifiziert · `[!] NICHT VERIFIZIERT` mit Grund.

### Die drei Prüfungen — einzeln gelaufen, einzeln genannt

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **92 bestanden, 1 ausgesetzt** (10 Dateien) — das ausgesetzte ist der neue Abnahmetest zu BUG-6, siehe unten |
| Lint | `npm run lint` | **grün**, keine Befunde |
| Build | `npm run build` | **grün**, „Finished TypeScript" ohne Fehler |

### Die drei gemeldeten Fehler — nachgeprüft

- [x] **BUG-3 behoben** — Reproduktion exakt wie gemeldet: Konto über die Admin-API gelöscht, Sitzungs-Cookie im Client belassen, dann `GET /`. Ergebnis: **genau 1 Weiterleitung**, Endstatus 200 auf `/login` (vorher 19 Weiterleitungen und `ERR_TOO_MANY_REDIRECTS`). Ursache beseitigt: `src/proxy.ts:47` fragt jetzt `getUser()` statt `getClaims()` — eine einzige Autorität. Gültige Sitzung weiterhin korrekt: `/` → 200, `/login` → 307 auf `/`. Dazu 7 Regressionstests in `src/proxy.test.ts`
- [x] **BUG-4 behoben** — nicht nur im Quelltext, sondern **im ausgelieferten HTML** geprüft: `curl http://localhost:3000/login` liefert `<form class="space-y-4" method="post">`. Genau das ist der Nachweis, der im Erstlauf gefehlt hat — dort wurde der Handler gelesen statt das Formular ohne JavaScript abgeschickt. Alle vier Auth-Formulare tragen das Attribut (`login-view.tsx:56`, `register-view.tsx:54`, `forgot-password-view.tsx:65`, `reset-password-form.tsx:98`)
- [x] **BUG-5 behoben** — `<main>`-Elemente pro Seite: `/login` = 1, `/reset-password` = 1 (vorher 2 verschachtelte)

### Acceptance Criteria Status

#### Spielablauf

- [x] **AC-1** Startbildschirm mit Wortmarke, Spielregel und „Runde starten" — Browser-Lauf; nach gespielten Runden erscheint zusätzlich „DEINE BESTLEISTUNG · Serie 3·0:03"
- [x] **AC-2** Erste Frage in **1245 ms** (Grenze 3000 ms), gemessen vom Klick bis zum vollständig geladenen Bild (`naturalWidth > 0`); Uhrenstart am sichtbaren Bild: `quiz-screen.tsx:327` (`if (phase === 'open') startClock()`), ausgelöst aus `pokemon-image.tsx` `onLoad`
- [x] **AC-3** Vier Optionen, alle verschieden, die richtige dabei — Browser-Lauf, Beispiel `["Dragoran","Octillery","Regirock","Muntier"]` zu #149; `question-action.test.ts` („AC-3: liefert genau vier verschiedene Namen")
- [x] **AC-4** Richtige Antwort erhöht die Serie und die Uhr läuft weiter — Browser-Lauf: sechs richtige Antworten, Anzeige zählte auf `SERIE 6`, Uhr lief bis `0:04` durch
- [x] **AC-5** Kein Pokémon zweimal je Runde — Browser-Lauf: #149, #203, #267, #174, #376, #177, alle verschieden; `question-action.test.ts` (mit 385 verbrauchten Nummern)
- [x] **AC-6** Falsche Antwort: gewählte rot (`✕`), richtige grün (`✓`), Auflösung „Richtig wäre Aquana gewesen." bleibt stehen, „Weiter zum Ergebnis" statt Auto-Weiter — Browser-Lauf. **Uhr steht:** 0:04 vor und 1,6 s später unverändert 0:04
- [x] **AC-7** Ergebnis mit Serie, Zeit, „Nochmal spielen" und „Zur Bestenliste" — Browser-Lauf: „RUNDE BEENDET | 6 | richtige Antworten in 0:04"
- [x] **AC-8** Bestleistung **in beide Richtungen** geprüft — Browser-Lauf: bessere Runde zeigt „Neue persönliche Bestleistung", eine anschließende schlechtere Runde (Serie 0) zeigt sie **nicht**; Vergleichslogik zusätzlich in `run-actions.test.ts` (vier Fälle)
- [x] **AC-9** „Nochmal spielen" führt auf den Startbildschirm mit Serie 0 und zurückgesetzter Uhr — Browser-Lauf
- [x] **AC-10** Vorladen greift — Browser-Lauf: nach dem Fragenwechsel **0 Skelettflächen** im DOM, Wechseldauer 544 ms; `quiz-screen.test.tsx` (zwei rot-geprüfte Regressionstests)

#### Speicherung und Schutz des Ergebnisses

- [x] **AC-11** Jede beendete Runde wird gespeichert, auch Serie 0 — direkt in der Datenbank nachgesehen: `Qar1890 | 3 | 3011 ms` und `Qar1890 | 0 | 48 ms`, beide ohne Zutun des Nutzers geschrieben. Eine abgebrochene Runde (Browser geschlossen) erzeugte **keine** Zeile — wie AC-19 es vorsieht
- [x] **AC-12** Plausibilitätsprüfung, **doppelt** — Datenbank über PostgREST: Serie 999, Serie −1, Dauer −1, Dauer 0 bei Serie 50 und Dauer 24999 bei Serie 50 alle **400**; die exakte Grenze 50 × 500 = 25000 **201**. Anwendung: `validation/quiz.test.ts` (10 Fälle) und `run-actions.test.ts`
- [x] **AC-13** Ohne Sitzung `/` → **307** nach `/login`, ebenso `/leaderboard`; nach dem Abmelden im Browser landet ein Aufruf von `/` wieder auf `/login`
- [x] **AC-14** Nur eigene Runden schreibbar — Konto B versuchte eine Runde auf Konto A anzulegen: **403**; `run-actions.test.ts` („schreibt immer für das Profil aus der Sitzung")
- [x] **AC-27** Rundenzeile enthält nur `id, profile_id, streak, duration_ms, client_round_id, created_at` — tatsächliche Spalten aus der API abgefragt

#### Fehlerverhalten der externen Datenquelle

- [x] **AC-15** 5-Sekunden-Grenze, genau ein stiller Wiederholungsversuch — `client.test.ts`, vier Fälle inkl. „kein dritter Versuch" und „übergibt ein Abbruchsignal mit der 5-Sekunden-Grenze"
- [x] **AC-16** Fehlerhinweis innerhalb der Quiz-Karte, beide Auswege, Serie bleibt — `quiz-screen.error-states.test.tsx` („AC-16")
- [x] **AC-17** „Erneut versuchen" unbegrenzt, Runde läuft weiter — ebenda („AC-17")
- [x] **AC-18** „Runde beenden" wertet und speichert — ebenda („AC-18")
- [ ] **BUG-6 — AC-19 greift nicht, während die nächste Frage lädt.** Die Warnung hängt an `roundInFlight` (`quiz-screen.tsx:112`), das die Phase `loading` nicht einschließt. Gemessen: ~400 ms je Runde ungeschützt. Details unter Bugs

#### Bild-Auslieferung

- [x] **AC-20** Bilder ausschließlich über die eigene Domain — `src` ist `/_next/image?url=…` auf `localhost`; **in drei vollständigen Browser-Läufen ging keine einzige Anfrage an einen fremden Host** (jede Anfrage mitgeschnitten und gegen `localhost:3000` / `127.0.0.1:54321` geprüft)

#### App-Rahmen

- [x] **AC-21** Kopfzeile angemeldet: „Pokémon QUIZ | Bestenliste | Q | QaPlay9230 | Abmelden" — Browser-Lauf
- [x] **AC-22** Kopfzeile ausgeloggt: „Pokémon QUIZ | DEUTSCHE NAMEN · SERIE · WELTRANGLISTE" — Browser-Lauf auf `/login`
- [x] **AC-23** Fußzeile auf jeder Seite („Ein Fan-Quiz. Pokémon ist eine Marke ihrer jeweiligen Inhaber."), **0 Links** darin — kein toter Rechts-Link, bis PROJ-4 die Seiten liefert
- [x] **AC-24** Mobilverhalten — **in diesem Lauf geprüft**, nicht aus `/build` übernommen: bei 1440, 768 und 375 px jeweils **kein horizontales Scrollen** und **kein Burger-Menü**; bei 375 px reduziert sich der Nutzer-Chip nachweislich auf die Initiale (Kopfzeile „Pokémon QUIZ | Bestenliste | Q | Abmelden" statt „… | Q | Qar1890 | …")
- [x] **AC-25** Skelettfläche statt Spinner und gleichbreite Ziffern — 2 `.tabular`-Elemente in der Statusleiste; `pokemon-image.tsx:34` (Skelett in Bildgröße)

#### Datenschutz

- [x] **AC-26** Runden verschwinden mit dem Profil — `0002_runs.sql:9` (`on delete cascade`), `profiles.id` kaskadiert seinerseits von `auth.users` (`0001_profiles.sql:6`)
- [x] **AC-27** siehe oben
- [x] **AC-28** Kein Zwischenspeicher-Schlüssel enthält eine Nutzerkennung — `client.ts` (Schlüssel ist die Anfrage-URL), `next.config.ts` (Bild-Cache über URL und Größe); keine nutzerbezogene Tabelle oder Protokollierung im Code
- [x] **AC-29** Keine Analyse-, Werbe- oder Tracking-Ressourcen — im Browser ausgewertet: **0 externe `script`/`link`/`img`-Quellen**. Gesetzte Cookies ausschließlich Supabase-Auth (`sb-127-auth-token` plus PKCE-Verifier) — betriebsnotwendig, daher kein Einwilligungsbanner
- [x] **AC-30** Schriften von der eigenen Domain — **0 Anfragen** an `fonts.googleapis.com` oder `fonts.gstatic.com` über drei vollständige Browser-Läufe

#### Umgang mit der externen Datenquelle

- [x] **AC-31** Zwischenspeicher greift — **Wirkung diesmal in diesem Lauf belegt**, nicht aus `/build` übernommen: das Server-Log zeigt **91 `(cache hit)` gegen 133 `(cache skip)`**, darunter dieselbe Spezies mehrfach als Treffer (`pokemon-species/84`, `/83`, `/42` je zweimal) und **über verschiedene Spielerkonten hinweg**. Anweisung zusätzlich durch `client.test.ts` gesichert (`force-cache`, `revalidate: 2592000`)

### Edge Cases Status

- [x] **EC-1** Zweiter Klick wirkungslos — Browser-Lauf: nach der Antwort sind alle Optionen `disabled`; `quiz-screen.tsx:296` (`if (chosenIndex !== null || !current) return`)
- [x] **EC-2** Pool erschöpft → Gewinner-Meldung — `question-action.test.ts` („EC-2: meldet einen leeren Pool"); Anzeige `result-view.tsx`
- [x] **EC-3** Fehlgeschlagenes Speichern zeigt Ergebnis samt Wiederholung — `run-actions.test.ts` („EC-3"); im Browser trat kein Speicherfehler auf (Gegenprobe: „nicht gespeichert" erschien nicht)
- [x] **EC-4** Doppelte Einreichung erzeugt nur eine Zeile — Datenschicht: dasselbe `client_round_id` zweimal → **201, dann 409**. Garantie ist der Unique-Index (`0002_runs.sql:14`), keine Prüfung im Anwendungscode
- [x] **EC-5** Pokémon ohne deutschen Namen wird verworfen — `client.test.ts`, `question-action.test.ts`
- [x] **EC-6** Nicht abrufbares Bild verwirft die Frage, nicht die Runde — `client.test.ts`, `quiz-screen.error-states.test.tsx`
- [x] **EC-7** Abgelaufene Sitzung führt auf `/login` — `quiz-screen.error-states.test.tsx` (Fragen-Abruf und Speichern); serverseitig `question-action.test.ts`, `run-actions.test.ts`. **Zusätzlich der reale Fall**, der im Erstlauf fehlte: gültiges Cookie zu serverseitig widerrufener Sitzung landet in einer Weiterleitung auf `/login`
- [x] **EC-8** Rate-Limit/Serverfehler wie ein Ausfall behandelt — `client.test.ts` („liefert null bei einer Fehlerantwort", beide Endpunkte)
- [x] **EC-9** Mehrfaches „Runde starten" startet genau eine Runde — Browser-Lauf: drei Klicks gleichzeitig, genau eine Runde begann; `quiz-screen.error-states.test.tsx` („EC-9": genau ein Abruf)
- [x] **EC-10** Nach drei Verwürfen erscheint die Fehlerkarte — `quiz-screen.error-states.test.tsx` („EC-10")
- [x] **EC-11** Kaputte Bildadresse wird über die Rückfallebene repariert — `quiz-screen.error-states.test.tsx` („EC-11"), `client.test.ts` (vier Fälle)

### Security Audit Results

- [x] **Authentifizierung** — `/` und `/leaderboard` ohne Sitzung: **307** nach `/login`. Widerrufene Sitzung: eine Weiterleitung, keine Schleife
- [x] **Autorisierung** — zwei echte Konten über PostgREST: B liest A's Runden nicht (auch nicht gezielt nach `profile_id` gefiltert → `[]`), kann keine auf A schreiben (**403**). Anonym: `[]`. A sieht ausschließlich die eigenen
- [x] **Unveränderlichkeit** — PATCH und DELETE liefern zwar 204, **verändern aber nichts**: gegengeprüft, alle fünf Zeilen von A waren danach unverändert vorhanden (Serie 5, 12, 0 trotz versuchtem `streak=386` und versuchtem Löschen). Die 204 ist PostgREST's „0 Zeilen betroffen", kein erfolgreicher Schreibvorgang. B's PATCH auf A ebenso wirkungslos
- [x] **Injection** — `'; DROP TABLE public.runs; --`, `1 OR 1=1`, `<script>alert(1)</script>` als Filterwert: alle **400**, Tabelle danach unverändert erreichbar (200)
- [x] **Sensible Daten in Antworten** — `runs` gibt keine IP-, Geräte- oder Verlaufsdaten heraus; `profiles` gibt **keine E-Mail-Adresse** heraus (`id, trainer_name, created_at`)
- [x] **Keine Geheimnisse im Client-Bundle** — der tatsächliche Secret-Key kommt in `.next/static` **nicht** vor (gezielt nach dem Schlüsselwert gegrept: 0 Treffer). Der einzige `sb_secret_`-Treffer ist die Formaterkennung von `supabase-js` (`e.startsWith("sb_publishable_")||e.startsWith("sb_secret_")`), kein Schlüssel
- [x] **Keine Zugangsdaten in der URL** — **diesmal am ausgelieferten HTML geprüft, nicht am Handler**: `<form … method="post">`. Ohne JavaScript sendet der Browser damit POST statt GET (BUG-4)
- [x] **Keine Kontoexistenz-Preisgabe** — bekannte und unbekannte E-Mail-Adresse liefern im Browser wortgleich „E-Mail-Adresse oder Passwort ist falsch."
- [!] **Rate Limiting auf den Server Actions** — **NICHT VERIFIZIERT — weiterhin nicht umgesetzt.** Gegengeprüft: keine Drosselung im Quellcode (`rateLimit`/`throttle` kommen nicht vor). Unverändert BUG-2, Backlog-Punkt **B1**
- [!] **Brute Force auf Zugangsdaten** — **entfällt für PROJ-2:** Dieses Feature prüft keine Zugangsdaten. Login, Registrierung und Passwort-Reset gehören zu PROJ-1; dort ist AC-8 als offen dokumentiert und nur gegen das gehostete Projekt prüfbar

### E2E Tests

**Ausgeführt am 2026-09-02 — 4 kritische Journeys, 15 Läufe, alle grün** (`npm run test:e2e`).

Die Suite läuft ab jetzt in **drei Browser-Projekten**. Firefox war in `playwright.config.ts` gar nicht konfiguriert — die Datei stammte unverändert aus dem Kit-Scaffold (`6910cd8`) und kannte nur Chromium und WebKit. Das Projekt `firefox` wurde ergänzt, Firefox und WebKit wurden installiert. **Damit ist die Lücke geschlossen, die jeder bisherige QA-Bericht als „nie geprüft" führen musste** — jedenfalls für diese vier Abläufe.

| Journey | Datei | Deckt ab | chromium | firefox | Mobile Safari |
|---|---|---|---|---|---|
| Kernschleife: Runde spielen bis zum gespeicherten Ergebnis | `tests/PROJ-2-quiz-round.spec.ts` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-11, EC-1 | ✅ | ✅ | ✅ |
| Zugangsschutz, ausgeloggt und nach dem Abmelden | `tests/PROJ-2-access-guard.spec.ts` | AC-13, AC-21, AC-22, AC-23 | ✅ | ✅ | ✅ |
| Keine einzige Anfrage an einen fremden Host | `tests/PROJ-2-no-third-party.spec.ts` | AC-20, AC-29, AC-30 | ✅ | ✅ | ✅ |
| Zweite Runde und persönliche Bestleistung | `tests/PROJ-2-personal-best.spec.ts` | AC-1, AC-8, AC-9 | ✅ | ✅ | ✅ |

**Jede Journey wurde rot geprüft — durch Mutation des Anwendungscodes, nicht durch Verdrehen der Erwartung.** Ein E2E-Test, dessen Fehlschlag man nie gesehen hat, ist kein Regressionsnetz:

| Mutation im Quellcode | Erwartetes Verhalten | Ergebnis |
|---|---|---|
| Routenschutz im Proxy deaktiviert | Zugangsschutz fällt | fiel an der `/leaderboard`-Zusicherung (Zeile 24) |
| `unoptimized` an `next/image` — Browser lädt direkt vom CDN | Drittanbieter-Journey fällt | fiel mit „Das Pokémon-Bild muss über die eigene Domain kommen (AC-20)" und zeigte die durchgesickerte `raw.githubusercontent.com`-Adresse |
| Vergleichsoperator der Rekordlogik gedreht (`>` → `<`) | Bestleistungs-Journey fällt | fiel an der AC-8-Zusicherung: Abzeichen gefunden, obwohl die Runde schlechter war |
| `pauseClock()` bei falscher Antwort entfernt | Kernschleife fällt | fiel an der Uhr-Zusicherung (erwartet `0:03`, tatsächlich `0:09`) |

**Zwei Befunde aus dem Rot-Nachweis, beide an den Tests selbst — kein Fehler in der Anwendung:**

1. **Eine Abwesenheitsprüfung war wirkungslos.** „Die schlechtere Runde zeigt *kein* Bestleistungs-Abzeichen" war grün, bevor das Abzeichen überhaupt erscheinen konnte, und blieb deshalb auch bei absichtlich kaputter Rekordlogik grün. Auch `waitForLoadState('networkidle')` half nicht: Es löst auf, sobald das Netz gerade ruhig ist — unter Umständen also, bevor der Speicher-Aufruf startet. Nachgemessen: Nach `networkidle` fehlt das Abzeichen selbst dann, wenn es korrekt erscheinen müsste. Gelöst über `runSavedResponse()` in `tests/helpers.ts`, das gezielt auf die Antwort des Speicher-Aufrufs wartet (erkennbar am Runden-Kennzeichen im Rumpf). Danach fängt die Zusicherung die Mutation.
2. **Das Vorladen aus AC-10 hängt ein zweites, unsichtbares Bild in den Baum** (`alt=""`, `aria-hidden`) — im DOM sogar **vor** dem sichtbaren. Ein `main img` hätte zeitweise die Nummer der *nächsten* Frage gelesen und den Test auf die falsche Lösung angesetzt. Die Helfer hängen deshalb am Alt-Text der sichtbaren Frage.

**Anpassung außerhalb der Tests:** `vitest.config.ts` grenzt jetzt auf `src/**` ein. Vitest sammelt sonst über sein Standardmuster `**/*.spec.ts` die Playwright-Specs mit ein, die unter ihm nicht laufen — `npm test` meldete dadurch vier fehlgeschlagene Dateien, ohne dass ein Test defekt war. Beide Suiten zusammen: `npm run test:all` → **93 Unit-Tests und 15 E2E-Läufe grün**.

**Was die Suite bewusst nicht abdeckt:** die Fehlerpfade der externen Datenquelle (AC-15 bis AC-18, EC-5, EC-6, EC-8, EC-10, EC-11). Der Ausfall der PokeAPI lässt sich von außen nicht auslösen, weil der *Server* sie aufruft — diese Pfade bleiben bei den Komponententests, wo die Server Action mockbar ist.

### Regression

- [x] **PROJ-1 im Browser vollständig** — Registrierung mit Trainername, Abmelden über den Nutzer-Chip, Routenschutz nach dem Abmelden, erneuter Login mit demselben Konto, Trainername in der Kopfzeile, identische Fehlermeldung bei falschem Passwort: **6/6**
- [x] **Proxy-Verhalten** — 7 Tests in `src/proxy.test.ts` grün, inkl. beider Hälften der ehemaligen Schleife
- [x] **Datenschicht** — Sicherheitsdurchgang vollständig erneut gelaufen (Autorisierung, Grenzwerte, Unveränderlichkeit, Injection, sensible Daten)
- [x] **Keine JavaScript-Fehler** in drei vollständigen Browser-Läufen

### Not Verified In This Run

- [!] **Cross-Browser (Firefox, Safari)** — in **diesem QA-Lauf** nicht geprüft: Nur Chromium war installiert, und `/qa` lädt bewusst keinen weiteren Browser nach. **Nachträglich teilweise geschlossen:** Der `/e2e-tests`-Durchgang vom selben Tag installierte Firefox und WebKit und fährt die vier kritischen Journeys seitdem in allen drei Browsern (siehe E2E Tests oben). Ungeprüft in Firefox und Safari bleibt alles, was **außerhalb** dieser vier Journeys liegt
- [!] **Rate Limiting der Server Actions** — nicht umgesetzt, siehe BUG-2 / B1
- [!] **Verhalten unter echter Last / vieler gleichzeitiger Spieler** — nicht Gegenstand dieses Laufs
- [!] **Zugriffslogs des Hosters** — offen bis `/deploy`, wie in `spec.md` → Open Questions vermerkt

### Bugs Found

#### BUG-6: Die Verlassen-Warnung greift nicht, während die nächste Frage lädt (AC-19)

- **Severity:** Low
- **Betrifft:** AC-19 — teilweise. Die Warnung existiert (BUG-1 ist behoben und hält), sie deckt aber nicht die gesamte laufende Runde ab
- **Ursache:** `src/components/quiz/quiz-screen.tsx:112` — `roundInFlight` ist `phase === 'open' || 'resolved' || 'error'`. Die Phase **`loading`** fehlt. `advance()` setzt genau diese Phase, wenn die nächste Frage noch nicht vorgeladen ist (`quiz-screen.tsx:290`). In diesem Fenster läuft die Runde mit voller Serie weiter, ist aber ungeschützt
- **Schritte zum Nachstellen:**
  1. Anmelden, Runde starten, mindestens eine Frage richtig beantworten
  2. In dem Moment, in dem „Runde wird vorbereitet …" steht, die Seite neu laden
  3. **Erwartet:** Der Browser fragt vor dem Verlassen nach
  4. **Tatsächlich:** Die Seite wird kommentarlos verlassen, die Runde ist verloren
- **Nachweis und Ausmaß:** Im Browser über eine ganze Runde alle 40 ms gemessen (`beforeunload` ausgelöst, `defaultPrevented` ausgewertet). Ab Serie ≥ 1: 193 Messpunkte ≈ 7,7 s Spielzeit, davon **10 Messpunkte ≈ 400 ms ohne Warnung — 5,2 % der Rundenzeit**, als ein zusammenhängendes Fenster. Alle 10 ungeschützten Messpunkte fielen exakt mit „Runde wird vorbereitet …" zusammen, keiner außerhalb
- **Warum der bestehende Test es nicht fängt:** `quiz-screen.error-states.test.tsx` („AC-19: die Verlassen-Warnung greift erst ab Serie 1") prüft direkt nach der richtigen Antwort — da ist die Phase noch `open`. Die Phase `loading` kommt darin nicht vor
- **Abnahmetest liegt bereit:** `quiz-screen.error-states.test.tsx` → „AC-19: die Warnung greift auch, während die nächste Frage noch lädt". Mit `it.skip` ausgesetzt, damit die Suite nicht dauerhaft rot steht — dasselbe Vorgehen wie bei BUG-1. **Beide Richtungen belegt:** ohne `.skip` und mit unverändertem Code fällt er („expected false to be true"), mit probeweise um `|| phase === 'loading'` ergänztem `roundInFlight` besteht er (10/10). Der Code wurde danach unverändert zurückgesetzt — `/qa` behebt keine Fehler
- **Umfang des Fixes:** ein Term in Zeile 112. `/build` entfernt dabei das `.skip`
- **Priorität:** Nice to have. Das Fenster ist kurz, tritt nur beim Neuladen genau in diesem Moment auf, und die Runde ist laut `spec.md` ohnehin nicht wiederherstellbar — die Warnung rettet den versehentlichen F5, mehr verspricht sie nicht

#### BUG-2: Keine Drosselung der Server Actions

- **Severity:** Low — **unverändert offen**, bewusst als Backlog-Punkt **B1** in `tasks.md`
- **Betrifft:** kein AC; in Spec und Design nicht gefordert, hier als Sicherheitsbefund geführt
- **Stand in diesem Lauf:** gegengeprüft, weiterhin nicht umgesetzt. Bewertung wie zuvor: wiederholte Pokémon kommen aus dem Zwischenspeicher (AC-31 belegt: 91 Treffer), `saveRun` kann nur eigene Zeilen anlegen und ist durch AC-12 begrenzt. Vor dem öffentlichen Start neu bewerten

### Summary

- **Acceptance Criteria:** **30 von 31 vollständig verifiziert**, 1 teilweise (AC-19 — Warnung vorhanden, deckt aber die Ladephase nicht ab). **Alle 31 wurden in diesem Lauf angefasst**, keines aus einem früheren Durchgang übernommen — insbesondere AC-24 und die Wirkung von AC-31, die vorher aus dem `/build`-Durchgang stammten
- **Edge Cases:** **11 von 11 verifiziert**
- **Bugs:** 2 offen — 0 kritisch, 0 hoch, 0 mittel, **2 niedrig** (BUG-6 neu, BUG-2 bewusst zurückgestellt). BUG-1, BUG-3, BUG-4 und BUG-5 sind behoben und nachgeprüft
- **Security:** **8 von 10 Prüfungen verifiziert**, 2 nicht verifiziert — Rate Limiting (nicht umgesetzt, BUG-2) und Brute Force auf Zugangsdaten (entfällt, gehört zu PROJ-1)
- **Neue Tests in diesem Lauf:** 1 (der ausgesetzte Abnahmetest zu BUG-6), rot-geprüft in beide Richtungen
- **Production Ready:** **JA** — keine kritischen oder hohen Fehler
- **Was zum Zeitpunkt dieses Laufs niemand geprüft hatte:** Firefox und Safari. Alle Browser-Prüfungen liefen in Chromium. Der anschließende `/e2e-tests`-Durchgang hat das für die vier kritischen Journeys nachgeholt

> „Production Ready" ist eine Aussage über **gefundene Fehler**, nicht über Abdeckung. Cross-Browser wurde in keinem Lauf dieses Projekts geprüft.

---

## Nachtrag — 2026-09-02, BUG-6 behoben und nachgemessen

**Fix:** `src/components/quiz/quiz-screen.tsx` — `roundInFlight` schließt jetzt auch die Phase `loading` ein. Ein Term, sonst nichts. Der Abnahmetest „AC-19: die Warnung greift auch, während die nächste Frage noch lädt" ist nicht mehr ausgesetzt.

**Gegenprobe im Browser — dieselbe Messung wie bei der Entdeckung** (`beforeunload` alle 40 ms ausgelöst, `defaultPrevented` ausgewertet, Runde mit 8 richtigen Antworten):

| | vor dem Fix | nach dem Fix |
|---|---|---|
| Messpunkte ab Serie ≥ 1 | 193 (~7,7 s) | 193 (~7,7 s) |
| davon „Runde wird vorbereitet …" | 10 | 5 |
| davon geschützt | **0 von 10** | **5 von 5** |
| **ohne Verlassen-Warnung** | **10 (~400 ms, 5,2 %)** | **0 (0 ms, 0 %)** |

**Die Ränder verhalten sich weiterhin richtig** — der Fix macht die Warnung nicht pauschal:

- Startbildschirm, Serie 0: **warnt nicht** (nichts zu verlieren)
- Auflösung nach einer falschen Antwort: **warnt** (Runde noch nicht abgeschlossen)
- Ergebnis-Screen, Runde vorbei und gespeichert: **warnt nicht**

**Die drei Prüfungen, einzeln gelaufen:** `npm test` **93 bestanden, 0 ausgesetzt** (vorher 92 + 1 ausgesetzt) · `npm run lint` **grün** · `npm run build` **grün**, „Finished TypeScript" ohne Fehler.

**Damit ist AC-19 vollständig erfüllt** und BUG-6 geschlossen. Offen bleibt allein **BUG-2** (Low, bewusst zurückgestellt als Backlog-Punkt **B1**). Unverändert ungeprüft: **Firefox und Safari** — alle Browser-Prüfungen dieses Projekts liefen in Chromium.

---

## Nachlauf — 2026-09-02, nach dem Fix von BUG-1

**Anlass:** BUG-1 behoben (`0567e53`). Zusätzlich zu prüfen: ob der zwischenzeitlich kaputte Build aus `30607f0` sonst etwas beeinflusst hat.

### Hat der kaputte Build etwas berührt?

**Nein — nachweislich nicht.** Der Fehler war eine TypeScript-Verletzung in *einer Testdatei* (`client.test.ts`), die `npm run build` scheitern ließ. Drei unabhängige Belege:

- `git show --name-only 30607f0` außerhalb der Tests: **nur** `features/INDEX.md`, `features/PROJ-2-pokemon-quiz/qa-report.md`, `vitest.config.ts` — **keine Zeile Laufzeitcode**
- `git diff --stat d6aba45..HEAD -- src/ ':!*.test.*'`: **eine einzige** geänderte Laufzeitdatei, `quiz-screen.tsx` (+19 Zeilen) — der AC-19-Fix, sonst nichts
- Die einzige Konfigurationsänderung war der `server-only`-Alias in `vitest.config.ts`. Der könnte theoretisch die Import-Absicherung aushebeln, deshalb gegengeprüft: ein absichtlich eingebauter Client-Import lässt `npm run build` weiterhin mit „'server-only' cannot be imported from a Client Component module" abbrechen. Die Absicherung ist unverändert wirksam; der Alias wirkt nur in Vitest

Ein gescheiterter Build veröffentlicht nichts — er ist ein Tor, kein Zustand. Da er kein Laufzeitverhalten berührte, war kein zuvor verifiziertes Kriterium betroffen.

### AC-19 — neu bewertet

- [x] **AC-19** Verlassen-Warnung ab Serie 1 — **im echten Browser an vier Zuständen geprüft**: Startbildschirm (keine Warnung), Serie 0 (keine Warnung), nach der ersten richtigen Antwort (**abgewehrt**), bei Serie 4 (weiterhin abgewehrt), nach dem Rundenende (keine Warnung mehr). Verfahren: echtes `beforeunload`-Ereignis auslösen und `defaultPrevented` auswerten. Dazu `src/components/quiz/quiz-screen.error-states.test.tsx` („AC-19"), **rot-geprüft**: Entfernt man nur diesen Effekt, fällt genau dieser Test um, die übrigen acht bleiben grün

### Regression im Nachlauf

- [x] **Rundenablauf** — 15/15 im Browser: Serie zählt auf 4, falsche Antwort beendet, Ergebnis-Screen, Bestleistung, „Nochmal spielen" (AC-4, AC-7, AC-8, AC-9, EC-3)
- [x] **Rahmen und Grenzen** — keine Browser-Anfrage an einen fremden Host (AC-20), Trainername in der Kopfzeile (AC-21), kein toter Rechts-Link (AC-23), keine JS-Fehler
- [x] **Datenschicht** — Sicherheitsdurchgang erneut vollständig gelaufen: **19/19** (Autorisierung über zwei Konten, Grenzwerte, Injection, sensible Daten)
- [x] **AC-13** — `curl` auf `/` ohne Sitzung: **307** nach `/login`

### Die drei Prüfungen — einzeln gelaufen, einzeln genannt

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **85 bestanden**, 0 ausgesetzt (9 Dateien) |
| Lint | `npm run lint` | **grün**, keine Befunde |
| Build | `npm run build` | **grün**, „Finished TypeScript" ohne Fehler |

### Verdikt des Nachlaufs

- **Acceptance Criteria:** **30 von 31 verifiziert**, 1 nicht verifiziert (AC-24, Responsivität)
- **Edge Cases:** 11 von 11
- **Bugs offen:** BUG-1 **behoben**; BUG-2 (Low) bewusst offen als Backlog-Punkt **B1** in `tasks.md`
- **Production Ready:** **JA** — keine kritischen oder hohen Fehler
- **Weiterhin ungeprüft:** Cross-Browser (Firefox, Safari) wurde in **keinem** Lauf getestet, alles lief in Chromium. AC-24 (375/768/1440 px) stammt aus dem `/build`-Durchgang, nicht aus einem QA-Lauf. Beides gehört zu `/e2e-tests` oder einem menschlichen Durchgang

---

## Erstlauf — 2026-09-02 (unverändert, führte zu BUG-1)

**Getestet:** 2026-09-02
**App-URL:** http://localhost:3000 (lokaler Dev-Server, lokale Supabase-Instanz)
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Lauf verifiziert (Nachweis erforderlich) · `[ ] BUG` als defekt verifiziert · `[!] NICHT VERIFIZIERT` in diesem Lauf nicht prüfbar (Grund erforderlich)

**Ein Hinweis zur Methode vorab.** Der Ausfall der PokeAPI lässt sich **nicht** von außen simulieren: Die API ruft der *Server* auf, ein Blockieren im Browser erreicht sie also nicht. AC-16 bis AC-18, EC-10 und EC-11 sind deshalb als Komponententests abgedeckt, wo die Server Action mockbar ist — das ist die einzige Stelle, an der diese Pfade reproduzierbar sind.

---

### Acceptance Criteria Status

#### Spielablauf

- [x] **AC-1** Startbildschirm mit Wortmarke, Spielregel, „Runde starten" und Bestleistung — Browser-Lauf gegen `localhost:3000`; Bestleistung nach der ersten Runde sichtbar („Deine Bestleistung")
- [x] **AC-2** Erste Frage in **1744 ms** (Grenze 3000 ms); Uhr startet mit dem sichtbaren Bild — `src/components/quiz/pokemon-image.tsx:38` (`onReady` in `onLoad`), `quiz-screen.tsx:265` (`onPictureVisible` nur bei `phase === 'open'`)
- [x] **AC-3** Genau vier Optionen, vier verschiedene Namen, richtige Antwort unter ihnen — Browser-Lauf; `src/lib/quiz/question-action.test.ts` („AC-3: liefert genau vier verschiedene Namen, einer davon der richtige")
- [x] **AC-4** Richtige Antwort erhöht die Serie — Browser-Lauf: vier gezielt richtige Antworten, Anzeige zählte 1→4; `answer-option.tsx:44` (grüner Zustand)
- [x] **AC-5** Kein Pokémon zweimal pro Runde — Browser-Lauf: #267, #314, #139, #352 alle verschieden; `question-action.test.ts` („AC-5: zieht nie ein bereits gezeigtes Pokémon erneut", mit 385 verbrauchten Nummern)
- [x] **AC-6** Falsche Antwort: rot + Rütteln, richtige gleichzeitig grün, Auflösung bleibt stehen — Browser-Lauf: „Richtig wäre … gewesen" plus „Weiter zum Ergebnis", kein Auto-Weiter
- [x] **AC-7** Ergebnis mit Serie, Zeit, „Nochmal spielen" und „Zur Bestenliste" — Browser-Lauf
- [x] **AC-8** Persönliche Bestleistung wird ausgewiesen — Browser-Lauf; Vergleichslogik in `src/lib/quiz/run-actions.test.ts` (vier Fälle: erste Runde, höhere Serie, gleiche Serie kürzer, gleiche Serie länger)
- [x] **AC-9** „Nochmal spielen" führt auf den Start zurück, Serie und Uhr zurückgesetzt — Browser-Lauf
- [x] **AC-10** Nächste Frage wird vorgeladen — Browser-Lauf: **+2 Server-Aufrufe** zwischen Klick und erster sichtbarer Frage; `src/components/quiz/quiz-screen.test.tsx` (Regressionstest, rot-geprüft)

#### Speicherung und Schutz des Ergebnisses

- [x] **AC-11** Jede beendete Runde wird gespeichert, auch Serie 0 — `run-actions.test.ts` („AC-11: speichert auch eine Runde mit Serie 0"); Datenschicht: `POST /rest/v1/runs` mit `streak=0` → 201
- [x] **AC-12** Plausibilitätsprüfung, **doppelt** — Anwendung: `src/lib/validation/quiz.test.ts` (10 Fälle inkl. exakter 500-ms-Grenze); Datenbank: Direktangriff über PostgREST wies Serie 999, Serie −1, Dauer −1 und Dauer 0 bei Serie 50 mit **400** ab
- [x] **AC-13** Ausgeloggt auf `/` → Weiterleitung — `curl -i http://localhost:3000/` → **307** nach `/login`; zweite, unabhängige Prüfung in `src/app/page.tsx:18`
- [x] **AC-14** Nur eigene Runden schreibbar — B versuchte eine Runde auf A: **403**; `run-actions.test.ts` („AC-14: schreibt immer für das Profil aus der Sitzung") — rot-geprüft durch Mutation
- [x] **AC-27** Rundenzeile enthält nur Serie, Dauer, Zeitpunkt, Kennzeichen, Profil — tatsächliche Spalten aus der API: `id, profile_id, streak, duration_ms, client_round_id, created_at`

#### Fehlerverhalten der externen Datenquelle

- [x] **AC-15** 5 s Zeitgrenze, genau ein stiller Wiederholungsversuch — `src/lib/pokeapi/client.test.ts` (drei Fälle: Erfolg beim ersten, Erfolg beim zweiten, Aufgeben nach dem zweiten — **kein dritter Versuch**)
- [x] **AC-16** Fehlerhinweis innerhalb der Karte, beide Auswege, Serie bleibt — `src/components/quiz/quiz-screen.error-states.test.tsx` („AC-16: zeigt die Fehlerkarte mit beiden Auswegen")
- [x] **AC-17** „Erneut versuchen" ist unbegrenzt und setzt die Runde fort — ebenda („AC-17": zwei erfolglose Versuche, Karte bleibt; dritter erfolgreich → Frage erscheint)
- [x] **AC-18** „Runde beenden" wertet und speichert die Runde — ebenda; `saveRun` wird genau einmal mit der erreichten Serie aufgerufen
- [ ] **BUG-1 — AC-19 Verlassen-Warnung ist nicht umgesetzt.** `beforeunload` kommt im gesamten Quellcode nicht vor (`grep -rn "beforeunload" src/`), und **kein Commit hat es je enthalten** (`git log --all -S "beforeunload"` ohne Treffer). Details unter Bugs.

#### Bild-Auslieferung

- [x] **AC-20** Bilder ausschließlich über die eigene Domain — Browser-Lauf: `src` ist `/_next/image?url=…` auf `localhost`; Mitschnitt **jeder** Anfrage einer kompletten Runde ergab keine einzige an einen fremden Host; `next.config.ts:9`

#### App-Rahmen

- [x] **AC-21** Kopfzeile mit Wortmarke, Bestenlisten-Zugang, Nutzer-Chip und Abmelden — Browser-Lauf, Trainername sichtbar
- [x] **AC-22** Ausgeloggt zeigt die Kopfzeile „Deutsche Namen · Serie · Weltrangliste" — `curl http://localhost:3000/login` enthält die Zeile im ausgelieferten HTML
- [x] **AC-23** Fußzeile auf jeder Seite, kein toter Rechts-Link — `curl` auf `/login` zeigt `<footer` und „Ein Fan-Quiz"; `site-footer.tsx:12` (`LEGAL_PAGES` ist leer, bis PROJ-4 die Seiten liefert)
- [!] **AC-24** Mobilverhalten (kein Burger, Chip auf Initiale unter 640 px) — **NICHT VERIFIZIERT in diesem Lauf.** Im `/build`-Durchgang bei 1440/768/375 px geprüft (15/15), hier aber nicht erneut; Code: `site-header.tsx:52` (`hidden … sm:inline`)
- [x] **AC-25** Gleichbreite Ziffern und Skelettflächen statt Spinner — Browser-Lauf: mindestens zwei `.tabular`-Elemente; `pokemon-image.tsx:34` (Skelett in Bildgröße), `globals.css` (`.tabular`)

#### Datenschutz

- [x] **AC-26** Runden verschwinden mit dem Profil — `supabase/migrations/0002_runs.sql:9` (`references public.profiles (id) on delete cascade`), und `profiles.id` kaskadiert seinerseits von `auth.users` (`0001_profiles.sql:6`)
- [x] **AC-27** siehe oben
- [x] **AC-28** Kein Zwischenspeicher-Schlüssel enthält eine Nutzerkennung — `src/lib/pokeapi/client.ts:38` (Schlüssel ist die Anfrage-URL), `next.config.ts:24` (Bild-Cache über URL und Größe); keine Tabelle und keine Protokollierung pro Nutzer im Code
- [x] **AC-29** Keine Analyse-, Werbe- oder Tracking-Ressourcen — ausgeliefertes HTML von `/login` und `/reset-password` enthält **keine einzige** externe `src`/`href`; `package.json` ohne Tracking-Abhängigkeit
- [x] **AC-30** Schriften von der eigenen Domain — kein `fonts.googleapis.com` / `fonts.gstatic.com` im ausgelieferten HTML; `src/app/layout.tsx:5` (`next/font/google`, selbst ausgeliefert)

#### Umgang mit der externen Datenquelle

- [x] **AC-31** Zwischenspeicher greift — **zwei Ebenen, wie in `tasks.md` vorgegeben.** Anweisung: `src/lib/pokeapi/client.test.ts` prüft `cache: 'force-cache'` und `revalidate: 2592000`, **rot-geprüft** durch Entfernen der Option. Wirkung: im `/build`-Durchgang zeigte das Server-Log `pokemon-species/45 200 in 0ms (cache hit)` aus einer echten Runde — also im Server-Action-Kontext, nicht nur in einem Route Handler.

---

### Edge Cases Status

- [x] **EC-1** Zweiter Klick nach der Antwort bleibt wirkungslos — Browser-Lauf: alle vier Optionen nach der Antwort `disabled`; `quiz-screen.tsx:243` (`if (chosenIndex !== null …) return`)
- [x] **EC-2** Pool erschöpft endet mit Gewinner-Meldung — `question-action.test.ts` („EC-2: meldet einen leeren Pool"); Anzeige: `result-view.tsx:47`
- [x] **EC-3** Fehlgeschlagenes Speichern zeigt das Ergebnis samt Wiederholung — `run-actions.test.ts` („EC-3: meldet einen echten Speicherfehler"); Anzeige `result-view.tsx:72`
- [x] **EC-4** Doppelte Einreichung erzeugt nur eine Zeile — Datenschicht: zweite Einreichung desselben Kennzeichens → **409**; Anwendung: `run-actions.test.ts` („EC-4: … meldet Erfolg statt eines Fehlers") — **rot-geprüft**. Garantie ist der Unique-Index (`0002_runs.sql:14`), nicht eine Prüfung im Code
- [x] **EC-5** Pokémon ohne deutschen Namen wird verworfen — `client.test.ts` (liefert `null`), `question-action.test.ts` (zieht ein anderes)
- [x] **EC-6** Nicht abrufbares Bild verwirft die Frage statt die Runde — `quiz-screen.error-states.test.tsx` (EC-10-Fall deckt den Verwurf mit ab); `client.test.ts` („EC-6: liefert null, wenn auch die offizielle Antwort kein Bild hat")
- [x] **EC-7** Abgelaufene Sitzung führt auf `/login` — `quiz-screen.error-states.test.tsx` (zwei Fälle: beim Fragen-Abruf und beim Speichern); serverseitig `question-action.test.ts`, `run-actions.test.ts`
- [x] **EC-8** Rate-Limit/Serverfehler der PokeAPI wird wie ein Ausfall behandelt — `client.ts:60` und `:80` behandeln jedes `!res.ok` als „kein Ergebnis"; `client.test.ts` („liefert null bei einer Fehlerantwort", beide Endpunkte)
- [x] **EC-9** Mehrfaches „Runde starten" startet genau eine Runde — `quiz-screen.error-states.test.tsx` („EC-9"): drei Klicks → genau ein Abruf
- [x] **EC-10** Nach drei Verwürfen erscheint die Fehlerkarte — `quiz-screen.error-states.test.tsx` („EC-10"): Grenze greift, höchstens vier Abrufe
- [x] **EC-11** Kaputte Bildadresse wird über die Rückfallebene repariert — `quiz-screen.error-states.test.tsx` („EC-11"): `repairImageUrl` wird gerufen, die reparierte Adresse ersetzt die alte, die Frage bleibt erhalten; `client.test.ts` (drei Fälle für die Auflösung)

---

### Security Audit Results

- [x] **Authentifizierung** — `/` und `/leaderboard` ohne Sitzung: **307** nach `/login`; zweite Prüfung in `src/app/page.tsx:18`
- [x] **Autorisierung** — mit zwei echten Konten über PostgREST: B sieht A's Runden nicht (auch nicht gezielt gefiltert), kann keine auf A schreiben (**403**), keine ändern und keine löschen. Anonym: keine Zeile. Grundlage: `0002_runs.sql:33` und `:44`
- [x] **Unveränderlichkeit** — selbst der Eigentümer kann seine Runde weder ändern noch löschen (keine `update`/`delete`-Policy)
- [x] **Injection** — `'; DROP TABLE public.runs; --`, `1 OR 1=1` und `<script>alert(1)</script>` als Filterwert: alle **400**, Tabelle danach unverändert vorhanden. Trainername mit HTML wird bei der Registrierung abgelehnt (Regression PROJ-1)
- [x] **Sensible Daten in Antworten** — `runs` gibt keine IP-, Geräte- oder Verlaufsdaten heraus; `profiles` gibt **keine E-Mail-Adresse** heraus (`id, trainer_name, created_at`)
- [x] **Keine Geheimnisse im Client-Bundle** — `grep` über `.next/static` fand *einen* Treffer auf `sb_secret_`, der sich als **Schlüsselformat-Erkennung von `supabase-js`** herausstellte (`startsWith("sb_secret_")`), nicht als Schlüssel. Der tatsächliche Secret-Key kommt im Bundle nicht vor
- [x] **Keine Zugangsdaten in der URL** — alle Formulare senden über Server Action oder `handleSubmit` (`site-header.tsx:61`, `login-view.tsx:55`, `register-view.tsx:53`, `forgot-password-view.tsx:64`, `reset-password-form.tsx:97`); kein natives GET
- [!] **Rate Limiting auf den Server Actions** — **NICHT VERIFIZIERT — nicht umgesetzt.** `getNextQuestion` und `saveRun` haben keine Drosselung. Ein angemeldeter Nutzer kann sie in einer Schleife aufrufen. Abgemildert durch den Zwischenspeicher (wiederholte Pokémon erzeugen keine API-Last) und dadurch, dass `saveRun` nur eigene Zeilen anlegt. Siehe BUG-2
- [!] **Brute Force auf Zugangsdaten** — **entfällt für PROJ-2:** Dieses Feature prüft keine Zugangsdaten. Login, Registrierung und Passwort-Reset gehören zu PROJ-1; deren Drosselung ist dort als AC-8 offen und nur gegen das gehostete Projekt prüfbar (`PROJ-1/spec.md` → Open Questions)
- [x] **Keine Kontoexistenz-Preisgabe** — geprüft als Regression: bekannte und unbekannte E-Mail-Adresse liefern denselben Wortlaut („E-Mail-Adresse oder Passwort ist f…")

---

### E2E Tests

- Status: **nicht ausgeführt** (`/e2e-tests` für die kritischen Abläufe)

---

### Regression

- [x] **PROJ-1 vollständig nachgeprüft**, weil PROJ-2 die Kopfzeile umgebaut hat, in der jetzt PROJ-1s „Abmelden" sitzt: Registrierung, Abmelden, Routenschutz nach dem Abmelden, Login mit bestehendem Konto, Trainername in der Kopfzeile, identische Fehlermeldung — **7/7**
- [x] **Bestehende Testsuite** — 84 bestanden, 1 ausgesetzt (BUG-1), `npm test`
- [x] **Build und Lint** — `npm run build` und `npm run lint` ohne Fehler

---

### Not Verified In This Run

- [!] **AC-24 / Responsivität bei 375, 768 und 1440 px** — in diesem Lauf nicht erneut geprüft. Im `/build`-Durchgang mit 15/15 belegt (kein horizontales Scrollen, kein Burger-Menü, Chip reduziert sich unter 640 px)
- [!] **Cross-Browser (Firefox, Safari)** — **nie geprüft, in keinem Lauf.** Alle Browser-Prüfungen liefen ausschließlich in Chromium. Gehört zu `/e2e-tests` oder einem menschlichen Durchgang
- [!] **Rate Limiting der Server Actions** — nicht umgesetzt, siehe BUG-2
- [!] **AC-31 Wirkung im Server-Log** — die Cache-Treffer stammen aus dem `/build`-Durchgang, nicht aus diesem Lauf; hier ist nur die *Anweisung* durch einen rot-geprüften Test belegt. Der Daten-Cache liegt in der Entwicklung im Speicher und ist auf der Platte nicht einsehbar (`.next/cache` enthält kein `fetch-cache`)
- [!] **Verhalten unter echter Last / vieler gleichzeitiger Spieler** — nicht Gegenstand dieses Laufs

---

### Bugs Found

#### BUG-1: Die Warnung vor dem Verlassen einer laufenden Runde fehlt vollständig (AC-19)

- **Severity:** Medium
- **Betrifft:** AC-19, Aufgabe T10 in `tasks.md` („Warnung vor dem Verlassen, sobald die Serie mindestens 1 beträgt")
- **Schritte zum Nachstellen:**
  1. Anmelden, „Runde starten", mindestens eine Frage richtig beantworten (Serie ≥ 1)
  2. Die Seite neu laden oder den Tab schließen
  3. **Erwartet:** Der Browser fragt vor dem Verlassen nach
  4. **Tatsächlich:** Die Seite wird kommentarlos verlassen, die Runde ist verloren
- **Nachweis:** `grep -rn "beforeunload" src/` findet keinen Treffer im Quellcode; `git log --all -S "beforeunload" -- src/` liefert **keinen einzigen Commit**. Der Test dazu liegt fertig vor: `src/components/quiz/quiz-screen.error-states.test.tsx` („AC-19: die Verlassen-Warnung greift erst ab Serie 1") — er ist mit `.skip` ausgesetzt, damit die Suite nicht dauerhaft rot steht. **Ohne das `.skip` schlägt er fehl.** Gegenprobe: Ein eigener Listener setzt in derselben Umgebung `defaultPrevented` korrekt, der Fehler liegt also nicht am Testaufbau
- **Ursache:** Die Zustandsmaschine wurde während `/build` einmal vollständig neu geschrieben; dabei ging der Effekt verloren, ohne dass es auffiel — die Aufgabe wurde trotzdem abgehakt
- **Priorität:** Vor dem Deploy beheben
- **Umfang:** Ein `useEffect`, der ab Serie 1 einen `beforeunload`-Listener registriert
- **Status: behoben am 2026-09-02** (`quiz-screen.tsx`, Effekt ergänzt; `.skip` am Test entfernt). Der Test ist rot-geprüft: ohne den Effekt fällt genau er um, die übrigen acht bleiben grün. **Die Gesamtbewertung dieses Berichts bleibt trotzdem stehen** — sie beschreibt den Lauf vom 2026-09-02 vor dem Fix. Ein erneuter `/qa`-Durchgang erteilt die neue Freigabe

#### BUG-2: Keine Drosselung der Server Actions

- **Severity:** Low
- **Betrifft:** kein AC — in Spec und Design nicht gefordert, hier als Sicherheitsbefund vermerkt
- **Schritte zum Nachstellen:**
  1. Als angemeldeter Nutzer `getNextQuestion` wiederholt aufrufen
  2. **Tatsächlich:** keine Begrenzung
- **Wirkung:** Begrenzt. Wiederholte Pokémon werden aus dem Zwischenspeicher bedient, erzeugen also keine Last bei der PokeAPI; `saveRun` kann nur eigene Zeilen anlegen und wird durch AC-12 begrenzt. Ein entschlossener Nutzer könnte durch immer neue Nummern dennoch Anfragen an die PokeAPI auslösen und damit gegen deren Fair-Use-Bitte arbeiten
- **Priorität:** Nice to have — vor dem öffentlichen Start neu bewerten, nicht vor diesem Deploy
- **Status: bewusst offen.** Als Punkt **B1** im Backlog von `tasks.md` festgehalten, damit die Entscheidung nachlesbar bleibt

---

### Summary

- **Acceptance Criteria:** **29 von 31 verifiziert**, 1 als defekt (AC-19), 1 nicht verifiziert (AC-24)
- **Edge Cases:** **11 von 11 verifiziert**
- **Bugs:** 2 gesamt — 0 kritisch, 0 hoch, **1 mittel** (BUG-1), 1 niedrig (BUG-2)
- **Security:** **8 von 10 Prüfungen verifiziert**, 2 nicht verifiziert — Rate Limiting der Server Actions (nicht umgesetzt, BUG-2) und Brute Force auf Zugangsdaten (entfällt, gehört zu PROJ-1)
- **Neue Tests in diesem Lauf:** 56 (Validierung, PokeAPI-Client, beide Server Actions, Fehlerpfade der Zustandsmaschine). **Rot-Nachweis geführt:** fünf gezielte Mutationen im Quellcode warfen jeweils genau den zuständigen Test um, danach alle Dateien unverändert zum Commit
- **Production Ready:** **NEIN** — BUG-1 ist ein vollständig fehlendes Acceptance Criterion
- **Empfehlung:** BUG-1 über `/build` beheben (ein `useEffect`), dann `/qa` erneut. BUG-2 bewusst zurückstellen

> „Production Ready" ist eine Aussage über **gefundene Fehler**, nicht über Abdeckung. Cross-Browser wurde in keinem Lauf geprüft, und die Responsivität stammt aus dem `/build`-Durchgang, nicht aus diesem.

---

## Nachtrag — 2026-09-02, Funde aus dem manuellen Test des Nutzers

Der Nutzer hat nach der Freigabe manuell getestet und drei Dinge gemeldet. Alle drei wurden hier reproduziert bzw. gegen die Spec geprüft. **Zwei davon sind echte Fehler, einer ist keiner.** Die Freigabe oben ist damit hinfällig — PROJ-2 geht zurück auf *In Review*, PROJ-1 ebenfalls.

### BUG-3 — Weiterleitungsschleife bei ungültiger Sitzung (High)

**Reproduziert.** Anmelden, Runde starten, die Sitzung serverseitig ungültig machen (Nutzer über die Admin-API gelöscht, Cookie im Browser belassen), dann F5: **`ERR_TOO_MANY_REDIRECTS`, 19 Weiterleitungen bei einem einzigen Aufruf.**

**Ursache — zwei Prüfungen, die einander widersprechen:**

- `src/proxy.ts:40` benutzt `getClaims()`. Das prüft nur die **Signatur** des Tokens, lokal, ohne Rückfrage beim Auth-Server. Eine widerrufene oder zu einem gelöschten Konto gehörende Sitzung besteht diese Prüfung weiterhin → der Proxy hält den Nutzer für angemeldet und leitet `/login` → `/`.
- `src/app/page.tsx:20` benutzt `getUser()`. Das fragt den Auth-Server und bekommt **403** → die Seite hält den Nutzer für abgemeldet und leitet `/` → `/login`.

Zwischen diesen beiden Antworten pendelt der Browser, bis er abbricht. Das erklärt auch das zweite Symptom des Nutzers: wiederholte `GET /auth/v1/user` mit 403, gefolgt von `GET / 307`.

**Eingeführt hat das PROJ-2.** Vor diesem Feature stand in `page.tsx` `return null` statt `redirect('/login')` (`git show 6b9ecf6:src/app/page.tsx`) — ohne die zweite Weiterleitung gab es keine Schleife. Die Entscheidung für `getClaims()` im Proxy stammt aus PROJ-1 (`design.md` → Technical Decisions) und ist für sich genommen richtig begründet; erst die Kombination beider Prüfungen erzeugt den Fehler.

**Warum es zählt:** Der Nutzer kommt aus der Schleife nicht heraus, ohne selbst die Cookies zu löschen — die App bietet keinen Ausweg. Der Fall tritt bei jeder widerrufenen Sitzung auf und wird mit PROJ-4 (Kontolöschung) zum Regelfall: Wer sein Konto löscht und einen offenen Tab hat, landet darin.

**Warum QA es nicht gefunden hat:** Die EC-7-Prüfungen simulierten eine fehlende Sitzung, indem die Server Action `unauthenticated` zurückgab. Der reale Fall — Cookie vorhanden, Signatur gültig, Sitzung serverseitig weg — kam in keinem Test vor. Das ist eine echte Lücke im Testansatz, nicht nur ein übersehener Fall.

### BUG-4 — Zugangsdaten im Klartext in der URL (Critical)

**Reproduziert, und zwar unabhängig von der LAN-IP.** Mit abgeschaltetem JavaScript (`javaScriptEnabled: false`) sendet das Login-Formular nativ:

```
GET /login?email=opfer%40example.com&password=GeheimesPasswort123
```

**Ursache:** Die vier Auth-Formulare (`login-view.tsx:55`, `register-view.tsx:53`, `forgot-password-view.tsx:64`, `reset-password-form.tsx:97`) tragen **kein `method`-Attribut**. Sie verlassen sich vollständig auf `onSubmit={form.handleSubmit(...)}`. Läuft das JavaScript nicht, fällt der Browser auf das HTML-Standardverhalten zurück — und das ist GET mit allen Feldern in der Adresszeile.

Der vom Nutzer beobachtete Auslöser (Zugriff über die LAN-IP) ist nur *ein* Weg dorthin: `allowedDevOrigins` ist in `next.config.ts` **nicht gesetzt**, deshalb blockiert Next die `/_next/*`-Ressourcen als Cross-Origin und das JavaScript lädt nicht. Aber jeder andere Hydrationsfehler — Netzabbruch, CSP-Problem, blockierendes Add-on — führt in Produktion zum selben Ergebnis.

**Verstößt gegen** `.claude/rules/security.md` → „Auth forms must submit via POST, never GET" (dort ausdrücklich als harte Regel geführt) und gegen PROJ-1 → Technical Requirements.

**Warum QA es nicht gefunden hat:** Im Erstlauf habe ich „Keine Zugangsdaten in der URL" abgehakt mit dem Nachweis „alle Formulare senden über Server Action oder `handleSubmit`". Das war die **falsche Art von Nachweis** — ich habe den Code gelesen, statt das Formular ohne JavaScript abzuschicken. Genau davor warnt die Regel: Ein `preventDefault()` im Handler sieht regelkonform aus und schützt nicht, wenn der Handler nie läuft.

**Nebenbefund, dringend:** Im Dev-Log dieses Rechners steht aus dem manuellen Test eine echte Anmeldung im Klartext (`GET /login?email=chris%40chros.de&password=…`). Das Passwort ist als kompromittiert zu behandeln.

### Kein Bug — vertikales Scrollen bei 375 px

Geprüft in `spec.md`, `design.md`, `docs/app-shell.md` und `docs/design-system.md`: **Kein Dokument verlangt, dass alle vier Antwortoptionen ohne Scrollen sichtbar sind.**

- **AC-24** betrifft ausschließlich die Kopfzeile: kein Burger-Menü, Nutzer-Chip unter 640 px auf die Initiale reduziert. Über den Inhaltsbereich sagt es nichts.
- **AC-25** betrifft Skelettflächen, nicht die Sichtbarkeit.
- `docs/app-shell.md:34` sagt für Mobil ausdrücklich: „Die Inhalte stapeln sich von selbst" — vertikales Stapeln *ist* das vorgesehene Verhalten.

Verboten ist nur **horizontales** Scrollen, und das wurde geprüft (kein horizontales Scrollen bei 375/768/1440 px).

Wenn die vier Optionen ohne Scrollen sichtbar sein *sollen*, ist das eine Produktentscheidung und kein Fix: Sie gehört über `/refine PROJ-2` als neues AC in die Spec, nicht als stille Änderung in den Code.

### Offene Statuszeile

| | |
|---|---|
| **PROJ-2** | Approved → **In Review** (BUG-3) |
| **PROJ-1** | Approved → **In Review** (BUG-4, betrifft alle vier Auth-Formulare) |
| Weiterhin ungeprüft | Firefox, Safari, 768 px und 1440 px abschließend |

---

## QA-Lauf — 2026-09-04, vollständiger Sweep nach AC-7

**Anlass:** `/refine` und `/build` haben AC-7 geändert (der Bestenlisten-Link im Ergebnis-Screen erscheint erst, wenn die Seite existiert). Dieser Lauf ist aber **kein Delta-Lauf** — PROJ-2 stand seit dem 2026-09-02 auf `Approved` und hatte seither die Kopfzeilen-Änderung aus `/refine PROJ-2` (AC-21) unverifiziert mitbekommen. Geprüft wurden deshalb **alle 31 AC-IDs und alle 11 EC-IDs** neu.

**Aufbau:** Drei `qa-engineer`-Verifizierer in getrennten Kontexten, die den Build nicht gesehen haben — Bahn A (Acceptance), Bahn B (Security, Schwerpunkt Bild-Proxy/SSRF), Bahn C (Regression und Testsuiten). Zusammenführung und Bewertung: Hauptkontext.

**Bug-Nummerierung:** neue Befunde ab **BUG-7** (BUG-1 bis BUG-6 sind in diesem Feature vergeben). Die Nummern gelten pro Feature — PROJ-1s BUG-7 ist ein anderer.

### Das Ergebnis vorweg

**Production Ready: NEIN — 2 High, 3 Medium, 2 Low.** PROJ-2 war seit dem 2026-09-02 als `Approved` geführt. Dieser Lauf zeigt, dass das nicht trug: Zwei Fehler brechen den Vertrag an Stellen, die genau für den Ausnahmefall geschrieben wurden — Bildausfall und fehlgeschlagenes Speichern. Beide sind im Alltag selten und im Ernstfall genau das, was die betroffenen EC verhindern sollten.

Der frühere Lauf hat sie nicht gefunden, weil er die Ausnahmefälle nicht **provoziert** hat. Dieser Lauf hat Bildantworten auf 404 gesetzt, den Speicheraufruf netzseitig abgebrochen und Sitzungs-Cookies mitten in der Runde gelöscht.

### Acceptance Criteria

Bestanden mit Beleg: **AC-1 bis AC-8, AC-10 bis AC-24, AC-26 bis AC-31** (26 von 31).

Hervorzuheben, weil aufwendig belegt:

| ID | Beleg |
|----|-------|
| AC-2 | Uhrenstart am sichtbaren Bild mit künstlicher 2-s-Bremse geprüft: nach ~4 s seit Klick stand die Uhr auf `0:00` |
| AC-10 | MutationObserver über den kompletten Fragenwechsel — **kein** Ladezustand, keine Phase ohne Optionen |
| AC-12 | Gegen die **echte Server Action** mit mitgeschnittener Action-ID: Serie 400, Dauer 0, negative Dauer, Text statt Zahl → alle abgelehnt; Grenzfall 386/193 000 ms → gespeichert. Zweite Ebene live in der DB bestätigt (`23514`, `runs_duration_plausible`) |
| AC-14 | Fremdes `profile_id` über die Action **injiziert** → Zeile landet trotzdem beim Angreifer; Datenbank lehnt den Direktversuch mit `403 / 42501` ab |
| AC-19 | Über CDP `getEventListeners(window)` gezählt: 0 `beforeunload` bei Serie 0, 1 bei Serie 1 |
| AC-26 | Live in einer **zurückgerollten Transaktion**: Profil gelöscht → 0 Runden, 0 verwaiste Zeilen |
| AC-27 | `\d public.runs` gegen die laufende DB: genau sechs Spalten, keine IP, kein Verlauf |
| AC-31 | Zwei frisch registrierte Konten spielten je drei Fragen — **kein einziger** neuer Eintrag im Fetch-Cache, obwohl alle 386 Species dort liegen. Bild-Cache direkt: dieselbe Adresse dreimal → `MISS, HIT, HIT` |

**Nicht bestanden:**

| ID | Ergebnis |
|----|----------|
| **AC-9** | [ ] **FAIL** — „Nochmal spielen" startet keine neue Runde → **BUG-10** |
| **AC-25** | [ ] **FAIL** — keine Skelettfläche beim Rundenstart → **BUG-11** |

### Edge Cases

Bestanden: **EC-1, EC-4, EC-5, EC-8, EC-9** (5 von 11).

| ID | Ergebnis |
|----|----------|
| EC-4 | [x] PASS — **drei gleichzeitige** Einreichungen derselben Runden-ID → alle melden Erfolg, **eine** Zeile in der DB; Unique-Constraint live bestätigt, Direktversuch über PostgREST → `409 / 23505` |
| **EC-3** | [ ] **FAIL** → **BUG-7 (High)** |
| **EC-6** | [ ] **FAIL** → **BUG-8 (High)** |
| **EC-7** | [ ] **FAIL** → **BUG-9 (Medium)** |
| EC-2 | [!] NOT VERIFIED — 386 richtige Antworten nicht spielbar; Garantie im Code belegt (`question-action.ts:74`, Unit-Test grün). **Nebenbefund:** `seenIdsRef` zählt auch **verworfene** Fragen mit, die Gewinner-Meldung könnte also mit weniger als 386 richtigen Antworten auslösen |
| EC-10 | [!] **faktisch unerreichbar** — der Verwurfs-Zähler wird nie hochgezählt, weil schon der erste Verwurf hängen bleibt (BUG-8). Der grüne Unit-Test ruft die Funktion direkt auf und mockt eine abweichende Reparaturadresse |
| EC-11 | [!] **TEILWEISE, Garantie im Code widerlegt** — der Reparaturweg wird betreten, hilft aber nur, wenn die reparierte Adresse **abweicht**. Im Normalfall ist sie identisch, und der Spieler bemerkt den Umweg sehr wohl: als Dauerhänger |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis |
|---------|----------|
| Authentication Bypass | [x] PASS — Server Actions nur an `/` gebunden, POST ohne Sitzung → 307; doppelt abgesichert über `getUser()` in beiden Actions |
| Autorisierung (AC-14) | [x] PASS — auf Action- **und** Datenbankebene, inklusive Feld-Injektion |
| Input Injection / AC-12 / EC-4 | [x] PASS — zwei Ebenen, live belegt |
| **SSRF über den Bild-Proxy** | [x] **PASS** — `example.com`, Supabase auf `127.0.0.1`, **`169.254.169.254`** (Cloud-Metadaten), die eigene App, `/etc/passwd`, fremde GitHub-Organisation, Groß-/Kleinschreibungs-Trick, Nicht-Bild-Ressource im erlaubten Muster → **alle HTTP 400**. Angriffsfläche auf öffentliche PokeAPI-Bilddateien begrenzt |
| Exponierte Secrets | [x] PASS — kein Service-Role-JWT, kein `sb_secret_`, kein JWT-Secret im Bundle |
| Sensible Daten in Antworten | [x] PASS — `runs`-Zeile trägt nur die sechs zugesagten Felder |
| Zugangsdaten in URLs | [x] PASS — alle Formulare POST |
| Drosselung der Server Actions | [!] NOT VERIFIED — nicht implementiert. **Kein Bug**: kein Zugangsdaten-Pfad in diesem Feature (Auth gehört PROJ-1). Praktische Folge unter BUG-13 |
| Security-Header | [!] FAIL — fehlen; bereits als Deploy-Blocker in `features/INDEX.md` geführt, kein neuer Befund |
| Eingabevalidierung `getNextQuestion` | [!] FAIL → **BUG-12 (Low)** |

### Regression (Bahn C) — ohne Befund

- **`npm test`: 12 Dateien, 121 Tests, 121 bestanden.**
- **E2E: 24 Tests, 24 bestanden, 0 flaky** über Chromium, Firefox und Mobile Safari bei 16 Workern.
- **`npm run lint`: Exit 0. `npm run build`: Exit 0**, TypeScript sauber, 5 Routen plus Proxy.
- **PROJ-1 unversehrt** in beide Richtungen: Registrierung, Login, Abmelden und Passwort-Reset laufen; `logoutAction` unverändert und nur aus der Shell aufgerufen.
- **Sieben geteilte Shell-Bausteine** gegen das server-gerenderte HTML geprüft: Kopfzeile in beiden Auth-Zuständen, Fußzeile ohne toten Link, Wortmarke, Seitenrahmen auch auf der 404-Antwort, Routenschutz für alle Shell-Routen, kein zweiter Rahmen.
- **Datenschicht gegen die laufende Datenbank**, nicht nur gegen die `.sql`-Dateien: RLS aktiv, `runs` nur für den Eigentümer lesbar, **keine** UPDATE- und keine DELETE-Policy, 9 Constraints und 5 Indizes identisch mit den Migrationen, keine `leaderboard`-Tabelle. Deckt sich mit `docs/data-model.md`.

### Bugs

#### BUG-7: Schlägt das Speichern fehl, erfährt der Spieler es nicht
- **Severity: High** · betrifft **EC-3**
- **Beleg:** Speicher-Aufruf netzseitig abgebrochen → Ergebnis-Screen sieht aus wie ein normal gespeichertes Ergebnis. Weder der Hinweis „konnte noch nicht gespeichert werden" noch die Möglichkeit, es erneut zu versuchen. Danach steht keine Bestleistung auf dem Startbildschirm — gespeichert wurde also nichts. Konsolen-Ausgabe: `TypeError: Failed to fetch`.
- **Ursache, selbst nachgeprüft:** `quiz-screen.tsx:141` ruft `await saveRun({...})` **ohne `try/catch`**. Wirft der Aufruf auf Transportebene, läuft keine der folgenden Zeilen mehr — `setSaveState('failed')` wird nie erreicht, `saveState` bleibt auf `'saving'` stehen. Die Fehler-UI existiert (`result-view.tsx:63-75`) und wird nie erreicht. Der Kommentar eine Zeile darunter sagt sogar „spec.md EC-3 — result stays on screen, with a retry": Die Absicht ist da, die Absicherung nicht.
- **Das Bemerkenswerte:** Das ist **derselbe Fehlertyp, den PROJ-1 am 2026-09-01 als BUG-1 (High) gefunden und behoben hat.** Dort entstand dafür eigens `src/lib/auth/run-action.ts` mit `unstable_rethrow`, und alle vier Auth-Formulare wurden umgestellt. Der Quiz-Pfad hat diesen Schutz **nie bekommen** — `grep -rn "runAuthAction" src/components/quiz/ src/lib/quiz/` liefert keinen Treffer. PROJ-2 stand zu diesem Zeitpunkt bereits auf `Approved`, und niemand hat über die Feature-Grenze geschaut.

#### BUG-8: Ein nicht ladbares Bild lässt die Runde dauerhaft hängen
- **Severity: High** · betrifft **EC-6**, und zieht **EC-10** und **EC-11** mit sich
- **Beleg:** Alle Bildantworten auf 404 gesetzt, dann Runde gestartet. Nach 18 Sekunden: genau **eine** Bildanfrage, zwei Server-Aufrufe, **keine** Fehlerkarte, kein neuer Zug, der Bildschirm unverändert auf „Runde wird vorbereitet …". Kein Ausweg außer Neuladen — und damit ist die Runde verloren.
- **Ursache:** `repairImageUrl` liefert dieselbe Adresse zurück, die schon gescheitert ist (die offizielle Artwork-Adresse **ist** die konstruierte Adresse). `ImageProbe` rendert mit `key={src}`; da sich `src` nicht ändert, bleibt das Element identisch, der Browser lädt nicht neu, `onError` feuert kein zweites Mal. `onProbeFail` wird nie erneut betreten — kein Verwurf, kein Nachziehen, kein Fehlerzustand.
- **Wirkung:** Betrifft real **jeden Ausfall des Sprite-CDN**. EC-6 wurde geschrieben, damit genau das die Runde nicht beendet; stattdessen beendet es sie auf die schlechteste Art — ohne Meldung, ohne Ausweg, mit Verlust der Serie.
- **Folgeschäden:** **EC-10** (Grenze nach drei verworfenen Fragen) ist dadurch faktisch unerreichbar — der Zähler wird nie hochgezählt. **EC-11** (Reparaturweg) greift nur, wenn die reparierte Adresse abweicht; im Normalfall tut sie das nicht. Beide Unit-Tests sind grün, weil sie die Funktionen direkt aufrufen und eine abweichende Adresse mocken. Sie prüfen damit einen Fall, den der laufende Code nicht erzeugt.

#### BUG-9: Abgelaufene Sitzung — keine Weiterleitung, irreführender Ergebnis-Screen
- **Severity: Medium** · betrifft **EC-7**
- **Beleg:** Cookies mitten in der Runde gelöscht, dann „Weiter zum Ergebnis": `POST / → 307 /login`, danach `POST /login → 200 (HTML)`, Konsolenfehler „An unexpected response was received from the server", URL bleibt `/`, Bildschirm zeigt „Runde beendet". Erst ein manueller Reload landet auf `/login`.
- **Ursache:** Der Proxy fängt den Server-Action-POST ab, die Aktion erreicht ihren `unauthenticated`-Zweig also nie — und der Wurf wird nicht gefangen. **Gleiche Wurzel wie BUG-7.**
- Der Unit-Test „EC-7: eine abgelaufene Sitzung beim Speichern führt ebenfalls auf /login" ist grün, weil er die Action mockt und damit den Proxy überspringt.

#### BUG-10: „Nochmal spielen" startet keine neue Runde
- **Severity: Medium** · betrifft **AC-9** · **Vertrag und Design widersprechen sich**
- AC-9 verlangt: „dann **startet eine neue Runde** mit Serie 0, zurückgesetzter Uhr und einem neu gezogenen, unabhängigen Fragen-Pool." Tatsächlich führt der Klick auf den Startbildschirm zurück (`quiz-screen.tsx:351` → `setPhase('ready')`); der Spieler muss zusätzlich „Runde starten" drücken.
- **`design.md` beschreibt genau diesen Übergang** (`beendet --"Nochmal spielen"--> bereit`). Der Code folgt dem Design, das Design widerspricht dem Vertrag.
- **Das ist deshalb keine reine Fix-Entscheidung.** Entweder der Code zieht nach (ein Klick startet direkt), oder AC-9 wird per `/refine` an das Design angeglichen. Für die erste Variante spricht das PRD-Erfolgskriterium „mindestens die Hälfte startet nach einem Lauf direkt eine zweite Runde" — jeder zusätzliche Klick arbeitet dagegen.

#### BUG-11: Keine Skelettfläche beim Rundenstart
- **Severity: Low** · betrifft **AC-25**
- Acht Messpunkte über 2,4 s mit künstlicher Bildbremse: keine pulsierende Fläche, nur die Textzeile „Runde wird vorbereitet …". Das Layout springt beim Eintreffen der Frage von einer Textzeile auf die volle Quiz-Karte.
- Ein Spinner erscheint nicht — insofern ist nur die halbe Zusage gebrochen. Die vorhandene Skelettfläche (`pokemon-image.tsx:33`) greift praktisch nie, weil das Bild beim Mounten der Frage schon im Browser-Cache liegt.

#### BUG-12: `getNextQuestion` validiert seine Eingabe nicht
- **Severity: Low**
- Ein Nicht-Array als `seenIds` löst eine unbehandelte `TypeError` aus → HTTP 500. `saveRun` hat für seinen Fall ein Zod-Schema, `getNextQuestion` keines.
- Kein Datenabfluss, keine Zustandsänderung; in Produktion strippt Next.js Meldung und Stacktrace. Robustheitslücke, kein Loch.

#### BUG-13: Unbegrenztes automatisches Nachziehen belastet die PokeAPI
- **Severity: Medium** · betrifft **AC-31** und die Fair-Use-Zusage aus `docs/PRD.md`
- Die Vorlade-Schleife bricht nur ab, wenn der Spieler wartet (`quiz-screen.tsx:249`: `&& !hasCurrentRef.current`). Fällt die Bildquelle aus, **während der Spieler noch antwortet**, zieht der Client endlos neue Fragen — je vier Namensabfragen an die PokeAPI, ohne Backoff.
- **Das widerspricht der Begründung im eigenen Design**, das den Verzicht auf eine Drosselung ausdrücklich damit rechtfertigt, „der Nutzer klickt selbst, es entsteht also keine automatische Last gegen die Fair-Use-Policy".
- Derzeit vom Hänger aus BUG-8 maskiert — wird sichtbar, sobald dieser behoben ist. **Beide zusammen fixen**, sonst tauscht man einen Hänger gegen eine Anfrageschleife.
- Verwandt: Bahn B hält fest, dass ein angemeldeter Nutzer `getNextQuestion` auch von Hand mit immer neuen `seenIds` in einer Schleife aufrufen kann. Das ist Backlog-Punkt `B1` und wird vor dem öffentlichen Start relevant.

### Not Verified In This Run

- [!] **Cross-Browser in Bahn A** — nur Chromium, um die PokeAPI nicht mehrfach zu belasten. Bahn C hat die E2E-Suite in allen drei Engines gefahren (24/24)
- [!] **Optisches und responsives Urteil** — belegt sind DOM, Klassen und Sichtbarkeit; kein Screenshot-Abgleich, kein Urteil über Abstände, „sanften Puls" oder Kontraste
- [!] **EC-2** (Pool erschöpft) — 386 richtige Antworten nicht spielbar; Garantie im Code belegt
- [!] **AC-15 mit echtem Timeout, EC-8 mit echtem 429/5xx der PokeAPI** — bewusst nicht provoziert, Fair Use. Über Unit-Tests und Code belegt
- [!] **EC-5 mit echtem fehlendem deutschen Namen** — existiert im Pool nicht
- [!] **AC-26 im echten Löschablauf** — PROJ-4 baut ihn erst; geprüft wurde die Datenbank-Garantie
- [!] **AC-2 und AC-31 unter Produktionsbedingungen** — gemessen im Dev-Server mit warmem Cache
- [!] **AC-31, offene Beobachtung:** In einem Zeitfenster wurden 39 bereits zwischengespeicherte Species-Einträge neu von der PokeAPI geholt, obwohl alle 386 auf Platte lagen. In zwei kontrollierten Läufen danach trat das nicht auf (0 Neuanfragen bei 24 Abfragen). Ursache nicht sicher zuordenbar — möglicherweise ein Neustart des Dev-Servers oder ein zweiter Prozess auf demselben Cache-Verzeichnis. **Der Beleg für AC-31 trägt damit nur für einen warmgelaufenen Prozess**
- [!] **Security-Header gegen die Live-URL** — lokal fehlend bestätigt

### Verdikt

- **Acceptance Criteria:** 26 von 31 bestanden · **AC-9 FAIL** · **AC-25 FAIL** · AC-24 nur strukturell
- **Edge Cases:** 5 von 11 bestanden · **EC-3, EC-6, EC-7 FAIL** · EC-2 und EC-10 nicht erreichbar · EC-11 teilweise widerlegt
- **Bugs:** 7 neu — **2 High** (BUG-7, BUG-8), **3 Medium** (BUG-9, BUG-10, BUG-13), **2 Low** (BUG-11, BUG-12)
- **Security:** 8 Prüfungen mit Beleg bestanden, 1 mit Befund (BUG-12), 2 NOT VERIFIED (Drosselung bewusst, Header bekannt). **Kein SSRF über den Bild-Proxy**
- **Regression:** ohne Befund — 121/121, E2E 24/24, Lint und Build grün
- **Production Ready: NEIN**

> **Was dieser Lauf über den vorherigen sagt.** PROJ-2 stand seit dem 2026-09-02 auf `Approved`. Die fünf gefallenen Kriterien beschreiben ausnahmslos **Ausnahmefälle** — Bild fehlt, Speichern schlägt fehl, Sitzung weg. Der frühere Lauf hat sie nicht provoziert, sondern die glücklichen Pfade geprüft und die Garantien im Code gelesen. Genau dort liegt der Unterschied: EC-6, EC-3 und EC-7 sind Zusagen **für den Ausnahmefall**, und ein Test, der den Ausnahmefall nicht herstellt, prüft sie nicht — er liest sie nur.

> **Die unangenehmste Einzelheit ist BUG-7.** PROJ-1 hat exakt denselben Fehlertyp am 2026-09-01 gefunden, als High eingestuft und mit einer eigens gebauten Hülle (`run-action.ts`) über alle vier Auth-Formulare behoben. Der Quiz-Pfad benutzt diese Hülle nicht — und PROJ-2 war zu dem Zeitpunkt schon `Approved`, wurde also nie erneut daraufhin angesehen. Ein Fix in einem Feature erreicht das Nachbarfeature nicht von selbst.

---

## QA-Lauf — 2026-09-04 (zweiter des Tages), nach den Fixes für BUG-7, BUG-8, BUG-10 und BUG-13

**Anlass:** Der Sweep weiter oben hat 7 Fehler gefunden. Vier davon wurden mit `562bd0e` behoben (BUG-10 → AC-9, BUG-7 → EC-3, BUG-8 → EC-6, BUG-13 → AC-31); BUG-9, BUG-11 und BUG-12 blieben bewusst offen. Dieser Lauf prüft die Fixes nach **und rollt alle 31 AC-IDs und alle 11 EC-IDs neu auf**, statt frühere Häkchen zu übernehmen.

**Aufbau:** Drei `qa-engineer`-Verifizierer in getrennten Kontexten, die den Bau nicht gesehen haben — Bahn A (Acceptance), Bahn B (Security), Bahn C (Regression). Zusammenführung, Nachprüfung strittiger Punkte und Bewertung: Hauptkontext.

**Bug-Nummerierung:** neue Befunde ab **BUG-14** (BUG-1 bis BUG-13 sind in diesem Feature vergeben).

### Das Ergebnis vorweg

**Production Ready: NEIN — 1 High, 4 Medium, 3 Low.**

Die vier beauftragten Fixes wirken; drei davon sind belegt, einer nur auf Testebene, weil das Regressionsnetz dafür kaputt ist. Der Lauf fördert dafür zwei Dinge zutage, die vorher niemand gesehen hat:

1. **Der Fix für AC-9 hat die E2E-Suite rot gemacht** — sie kodierte das alte Verhalten und wurde nicht mitgezogen. Das ist der High-Befund, und er geht auf diesen Fix-Lauf zurück.
2. **Die Rückfallebene der Bildadresse (EC-11) ist im Betrieb wirkungslos** — und zwar nicht seit dem Fix, sondern seit dem ersten Tag. Der Fix für BUG-8 hat sie nur sichtbar gemacht.

### Die vier Fixes — nachgeprüft

- [x] **BUG-10 behoben (AC-9)** — `onPlayAgain={startRound}` (`quiz-screen.tsx:396`); `startRound` setzt Serie 0, Uhr 0, neue Runden-ID, neuen Pool und geht direkt in `loading` (`:291-314`). Kein Übergang zurück nach `ready`. Abnahmetest `quiz-screen.error-states.test.tsx:334`, **rot geprüft** gegen den wiederhergestellten Fehler. `design.md` mitgezogen. **Im Browser nicht verifiziert** — ausgerechnet der E2E-Test, der das könnte, ist durch diesen Fix rot (BUG-14)
- [x] **BUG-7 behoben (EC-3)** — **serverseitig provoziert**, nicht nur gelesen: Profilzeile des Testkontos gelöscht → echter Datenbankfehler beim Insert → Action liefert `{"status":"failed"}`, 0 Zeilen; der Wiederholungsversuch scheitert erneut und schreibt nichts. Client-Kette: `runClientAction` fängt den Transportfehler (`src/lib/actions/run-action.ts:24-31`) → `saveState 'failed'` (`quiz-screen.tsx:149-167`) → Hinweis + „Erneut speichern" (`result-view.tsx:63-75`). Abnahmetest `error-states.test.tsx:247`, rot geprüft
- [x] **BUG-8 behoben (EC-6)** — `/_next/image` antwortet auf eine kaputte Sprite-Adresse mit **404** (live geprüft, zwei Varianten) → `onError` → `onProbeFail` verwirft, sobald die Reparaturadresse nicht abweicht (`quiz-screen.tsx:263-286`). Abnahmetest `error-states.test.tsx:277` feuert `error` **genau einmal** und verlangt, dass die Runde von selbst weiterzieht. **Damit ist EC-10 überhaupt erst erreichbar.** Die Browser-Ereigniskette selbst: nicht verifizierbar
- [x] **BUG-13 behoben (AC-31)** — zwei unabhängige Messungen: Bahn A spielte rund 55 Fragen (etwa 220 Namensabfragen, zufällig über 1–386) → **kein einziger** neuer Species-Eintrag im Fetch-Cache; Bahn B fuhr 40 `getNextQuestion`-Aufrufe in Folge → **393 Cache-Einträge vorher, 393 nachher, null ausgehende Anfragen**. Die Verwurfsgrenze greift jetzt auch beim Vorladen (`quiz-screen.tsx:279-285`) und zeitversetzt aus `advance` (`:331-335`)

### Acceptance Criteria

Bestanden mit Beleg: **AC-1, AC-3, AC-5, AC-7, AC-8, AC-11, AC-12, AC-13, AC-14, AC-20, AC-21, AC-22, AC-23, AC-26 bis AC-31** (20 von 31).

Hervorzuheben:

| ID | Beleg |
|----|-------|
| AC-8 | Fünf echte Speicherungen: 3/3000 → `true`, 2/9000 → `false`, 3/3001 → `false`, 3/2999 → `true`, 4/60000 → `true`; Startbildschirm zeigt danach „Serie 4 · 1:00" |
| AC-12 | Beide Ebenen: Action lehnt Serie 400, Serie −1, Dauer −1, 50/24999 ms, Dauer 1.5, Serie `"5"` und kein-UUID ab; Grenzfall 50/25000 und 386/193000 gespeichert. DB bestätigt `runs_streak_range`, `runs_duration_non_negative`, `runs_duration_plausible` |
| AC-14 | `profile_id` **und** `profileId` in die Nutzlast injiziert → Zeile landet beim Sitzungsprofil, 0 Zeilen auf der fremden ID; direkter PostgREST-Insert → `403 / 42501` |
| AC-26 | **Live**: Profilzeile gelöscht → Runden weg; Auth-Konto gelöscht → Profil und 5 Runden weg; **0 verwaiste Zeilen von 18** |
| AC-29 | Auf `/` (angemeldet) und `/login` (anonym) kommt **kein** `Set-Cookie` zurück; einziges Cookie ist `sb-127-auth-token` |
| AC-30 | Preload zeigt auf `/_next/static/media/…woff2` (200); im ausgelieferten CSS **0 Treffer** für `googleapis` oder `gstatic` |
| AC-31 | Siehe BUG-13 oben — zwei unabhängige Messungen; Bildspeicher `MISS, HIT, HIT` |

**Nicht bestanden:**

| ID | Ergebnis |
|----|----------|
| **AC-15** | [ ] **TEILWEISE** — die 5-Sekunden-Grenze deckt nur die serverseitige Fragenmontage. **Für das Bild gibt es keinerlei Zeitgrenze** → **BUG-15 (Medium)** |
| **AC-25** | [ ] **FAIL** — keine Skelettfläche beim Rundenstart. Unverändert **BUG-11 (Low)** |
| **AC-2** | [~] **TEILWEISE** — serverseitig 202–385 ms über 5 Rundenstarts (Grenze 3000 ms), Uhrenstart am sichtbaren Bild im Code belegt. Klick bis sichtbares Bild: kein Browser |

### Edge Cases

Bestanden: **EC-3, EC-4** (2 von 11) — beide mit provozierter Ausnahme, nicht gelesen.

| ID | Ergebnis |
|----|----------|
| EC-4 | [x] PASS — dieselbe `clientRoundId` zweimal nacheinander **und** dreimal gleichzeitig → alle melden `saved`, **1 Zeile**; zweiter Durchgang mit frischer ID, drei parallel → 1 Zeile |
| **EC-7** | [ ] **FAIL** — zweimal provoziert (ohne Cookie; Konto per Admin-API gelöscht, Cookie behalten): `POST / → 307 /login`, dann `POST /login → 200 application/json {}`. Der `unauthenticated`-Zweig ist in der laufenden App **unerreichbar**. Unverändert **BUG-9 (Medium)** |
| **EC-11** | [ ] **FAIL, im Betrieb wirkungslos** → **BUG-16 (Medium)** |
| **EC-2** | [~] **TEILWEISE** — serverseitig belegt (386 IDs → `pool-empty`; mit 385 kommt exakt die fehlende Nummer). Zwei Wege zur Gewinner-Meldung ohne 386 richtige Antworten → **BUG-17 (Low)** |
| EC-6, EC-10 | [!] Browser-Ereigniskette nicht auslösbar; Verwurfspfad im Code und über die Abnahmetests belegt, 404 der eigenen Bild-Route live bestätigt |
| EC-1, EC-9 | [!] reine Client-Interaktionen — Garantien im Code (`quiz-screen.tsx:342`, `:292`, `:175`), Tests grün |
| EC-5 | [!] im Pool 1–386 fehlt kein deutscher Name — der Fall ist nicht herstellbar |
| EC-8 | [!] echter 429 oder 5xx bewusst nicht provoziert (Fair Use). **Nebenbefund:** der stille Wiederholungsversuch aus AC-15 greift nur bei Wurf oder Timeout, **nicht bei einer Fehlerantwort** (`client.ts:113-119`) |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis |
|---------|----------|
| Authentication Bypass | [x] PASS — Routen-Sweep, alle vier Server Actions ohne Cookie → 307; Umgehung über die Bild-Endungs-Ausnahme des Proxys (`POST /x.png`) → 404; gefälschtes Cookie und selbstgebautes `alg=none`-JWT → 307. Ursache: `proxy.ts:53` nutzt `getUser()`, nicht die lokale Signaturprüfung |
| Autorisierung | [x] PASS — auf Action- und Datenbankebene, inklusive Feld-Injektion; Unveränderlichkeit hält auch gegen direktes `PATCH` und `DELETE` |
| **SSRF über den Bild-Weg** | [x] **PASS** — 16 Angriffe: `169.254.169.254`, `metadata.google.internal`, `127.0.0.1:54321`, die eigene App, `file://`, protokollrelativ, doppelt kodiert, `raw.githubusercontent.com.evil.com`, `…@evil.com`, Pfad-Traversal, Nicht-Bild auf erlaubtem Host → **alle 400** |
| Exponierte Secrets | [x] PASS — Wertsuche nach Service-Role-JWT, `sb_secret_` und JWT-Secret in `.next/static` → kein Treffer; die Mustertreffer sind Literale der Supabase-Bibliothek selbst |
| Sensible Daten in Antworten | [x] PASS — `runs`-Zeile trägt exakt die sechs zugesagten Felder; HTML von `/` (20.429 Bytes) enthält 0 Treffer für E-Mail, UUID oder Tokens |
| Zugangsdaten in URLs | [x] PASS — alle vier Auth-Formulare `method="post"`; im Quiz existiert überhaupt kein `<form>` |
| **Eingabevalidierung** | [ ] **FAIL** → **BUG-12, hochgestuft auf Medium und erweitert** |
| **Security-Header** | [ ] **FAIL** — auf **keiner** Route ist einer der vier gesetzt. Bekannt als Deploy-Blocker (dort unter PROJ-1 geführt); Bahn B stuft höher ein als „Low", weil es jede Route trifft |
| Drosselung der Server Actions | [!] NOT VERIFIED — nicht implementiert. 40 Aufrufe in 6933 ms, keine Drosselung. **Kein Bug**: kein Zugangsdaten-Pfad in diesem Feature |
| CSRF | [~] Origin-Prüfung greift (`Origin: https://evil.example` → 500), lässt sich aber mit `X-Forwarded-Host` aushebeln → **BUG-18 (Low, Deploy-Notiz)** |
| Brute Force und Enumeration | [!] NOT VERIFIED — **dieses Feature hat keinen Zugangsdaten-Pfad**; gehört vollständig zu PROJ-1 |

**Ausdrücklich festgehalten:** PROJ-2 enthält kein Login, keine Registrierung, keinen Passwort-Reset. `tasks.md:8` bestätigt: keine `[user]`-Aufgaben. Die Regel „nicht implementiert = High" gilt hier daher nicht.

**Entwarnung zur Fair-Use-Sorge:** Der Schleifen-Angriff auf `getNextQuestion` belastet die PokeAPI **nicht**. Der Angreifer steuert über `seenIds` nur, was ausgeschlossen wird; gezogen wird serverseitig aus 1–386, und alle 386 Species liegen mit 30-Tage-Cache vor. Eine uncachebare URL lässt sich nicht einschleusen. Die Obergrenze ist die Poolgröße, nicht die Aufrufzahl. Das relativiert Backlog-Punkt **B1** spürbar. Nebenbefund: 300.000 `seenIds` (1,90 MB) → `500 Body exceeded 1 MB limit`, App danach gesund — kein Speicher-DoS.

### Regression (Bahn C)

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **13 Dateien, 129 Tests, 129 grün** |
| `npm run lint` | **Exit 0** |
| `npm run build` | **Exit 0**, TypeScript fehlerfrei, keine Kollision mit dem laufenden Dev-Server |
| **`npm run test:e2e`** | **ROT — 6 von 24** → **BUG-14 (High)** |

Ohne Befund: PROJ-1 in beide Richtungen (Registrierung live gegen die Datenbank inklusive Profil-Trigger, Login, Abmelden, Passwort-Reset über echten Mailpit-Link — alle drei Engines); sieben geteilte Shell-Bausteine gegen das gerenderte HTML (Kopfzeile in beiden Auth-Zuständen, Fußzeile ohne toten Link, Wortmarke, Seitenrahmen auch auf der 404-Antwort, Routenschutz, kein zweiter Rahmen); die Datenschicht gegen die **laufende** Datenbank (RLS aktiv, `runs` nur für den Eigentümer, exakt drei Policies — keine UPDATE, keine DELETE —, alle Constraints und Indizes deckungsgleich mit den Migrationen, keine `leaderboard`-Tabelle).

**Die verschobene Hilfsfunktion eigens geprüft**, unabhängig von der Behauptung des Commits: `src/lib/auth/run-action.ts:13-15` delegiert an `src/lib/actions/run-action.ts:24-31`, Semantik zeilengleich zum Vorgänger (`unstable_rethrow` **zuerst**, dann Rückfallwert). 9/9 Tests in beiden Dateien; der `redirect()`-Durchlass ist zur Laufzeit der Login-Erfolgspfad, der Fehlerpfad die gemappte Falschpasswort-Meldung — beide grün in drei Engines. Alle fünf Aufrufstellen abgeklopft: kein toter Import, kein zweiter Pfad ohne Fänger.

### Bugs

#### BUG-14: Die E2E-Suite kodiert das alte AC-9-Verhalten und ist rot
- **Severity: High** · betrifft **AC-1, AC-8, AC-9, AC-11, EC-1** · **verursacht durch den Fix-Lauf `562bd0e`**
- **Beleg:** `npm run test:e2e` → **6 von 24 rot**, Exit 1, reproduzierbar in Chromium, Firefox und Mobile Safari (drei Läufe: 8/24, 2/8, 6/24). Zwei Specs:
  - `tests/PROJ-2-personal-best.spec.ts:49` — nach „Nochmal spielen" wird „Runde starten" erwartet → `element(s) not found`
  - `tests/PROJ-2-quiz-round.spec.ts:104` — nach „Nochmal spielen" wird „Deine Bestleistung" erwartet → `element(s) not found`
- **Ursache:** `quiz-screen.tsx:396` startet die Runde jetzt unmittelbar. Die Specs kodieren das alte Verhalten — `personal-best.spec.ts:46` trägt sogar den Kommentar „AC-9 — „Nochmal spielen" führt auf den Startbildschirm zurück" — und wurden im selben Commit **nicht mitgezogen**.
- **Das Anwendungsverhalten ist richtig.** `spec.md` AC-9 verlangt „dann **startet eine neue Runde**". Rot ist das Regressionsnetz, nicht die Funktion.
- **Warum trotzdem High:** `npm run test:e2e` und `npm run test:all` sind rot, und **zwei Abdeckungen sind faktisch tot**, weil die Tests vorher abbrechen — die Gegenprobe „schlechtere zweite Runde überschreibt den Rekord nicht" (AC-8) und die Persistenz-Gegenprobe zu AC-11. Beide benutzten den Startbildschirm nur als *Vehikel*, um etwas anderes zu prüfen.
- **Das Bemerkenswerte:** Der Abnahmetest zu BUG-10 (Unit) schrieb das **neue** Verhalten fest, die E2E-Suite das **alte**. Beide existierten. Gelaufen ist nur die Hälfte — ausgerechnet die selbst geschriebene. Dieses Projekt hat vier Prüfungen, nicht drei.

#### BUG-15: Ein hängendes Bild lässt die Runde dauerhaft stehen, ohne Fehlerkarte
- **Severity: Medium** · betrifft **AC-15** und **AC-16**
- **Ursache:** `ImageProbe` (`pokemon-image.tsx:64-89`) meldet nur `onLoad` und `onError`. In `quiz-screen.tsx` existiert **kein Timer**, der das Vorladen begrenzt (`grep setTimeout|setInterval|timeout` → nur Uhr-Tick `:96` und `CORRECT_FEEDBACK_MS`). Die 5-Sekunden-Grenze aus AC-15 (`client.ts:33`) deckt ausschließlich die serverseitige Namensmontage.
- **Wirkung:** `design.md` sagt „Eine Frage gilt erst als vorgeladen, wenn ihr Bild geladen ist." Bleibt die Bildanfrage stehen — stockende Verbindung, hängender Upstream, **kein** 404 —, feuert weder `onOk` noch `onFail`: `phase` bleibt `loading`, der Bildschirm bleibt auf „Runde wird vorbereitet …", die Fehlerkarte wird nie erreicht, die Serie ist beim Neuladen verloren.
- **Dieselbe Symptomatik wie BUG-8, anderer Auslöser.** Der Fix für BUG-8 deckt nur „Bild antwortet mit Fehler" ab. AC-15 verspricht eine Zeitgrenze für „eine Frage ist nicht vollständig ladbar" — das Bild gehört dazu.

#### BUG-16: Die Rückfallebene der Bildadresse ist im Betrieb wirkungslos
- **Severity: Medium** · betrifft **EC-11** und eine ausdrückliche Zusage aus `design.md`
- **Beleg:** Bahn A maß `repairImageUrl` für die IDs 1, 25, 150, 236 und 386 — **5 von 5 liefern exakt die konstruierte Adresse.** Vom Hauptkontext unabhängig nachgeprüft: `SPRITE_BASE` (`client.ts:17-18`) ist zeichengleich mit dem, was `/pokemon/{id}` unter `sprites.other.official-artwork.front_default` zurückgibt (live gegen die PokeAPI für 25 und 386).
- **Wirkung:** Da nur eine *abweichende* Adresse als Reparatur gilt (`quiz-screen.tsx:263`), kann die von EC-11 zugesagte „offizielle Bildadresse … verwenden" für den aktuellen Pool **nie stattfinden**. Jeder Bildausfall fällt sofort in EC-6.
- **Die eigentlichen Kosten:** Die Zusatzanfrage wird trotzdem gestellt (`question-action.ts:117-129`, **über 100 KB je Antwort**) und ihr Ergebnis verworfen — bis zu drei vor der Fehlerkarte. Das arbeitet gegen dieselbe Fair-Use-Zusage, für die BUG-13 behoben wurde.
- **`design.md` rechtfertigt das konstruierte Adressmuster ausdrücklich damit**, dass „der schlimmste Fall … nicht ‚alle Bilder kaputt', sondern ‚eine Zusatzanfrage pro Pokémon'" sei. **Diese Garantie hat der Code nicht.** Das ist keine Folge des BUG-8-Fixes — es galt seit dem ersten Tag. Der Fix hat es nur sichtbar gemacht: Vorher endete derselbe Weg im Hänger, jetzt im Verwurf.
- **Braucht eine Entscheidung, keinen reinen Codefix:** entweder die Reparaturanfrage entfällt (dann ist die Leiter einstufig und `design.md` muss das sagen), oder EC-11 wird per `/refine` an das angeglichen, was die Datenquelle tatsächlich hergibt.

#### BUG-12 (neu bewertet): Eingabevalidierung fehlt an zwei Server Actions
- **Severity: Medium** (vorher Low) · Erweiterung des Befunds vom selben Tag
- **Neu:** Nicht nur `getNextQuestion`, sondern auch **`getPersonalBest`**. `seenIds` geht ungeprüft in `.filter()` (`question-action.ts:73`), `excludeRoundId` ungeprüft in die Abfrage (`run-actions.ts:40`).
- **Beleg:** `[]`, `[null]`, `["abc"]`, `[{"toString":1}]` → jeweils **HTTP 500** (`TypeError`); 200.000 Einträge → 500 nach 65 ms. Die Antwort trägt im Dev-Modus **absolute Dateipfade**.
- **Verstoß gegen** `.claude/rules/security.md` → Input Validation. Pikant: `saveRun` macht es mustergültig mit `runSubmissionSchema`, und `src/lib/validation/quiz.ts:12` enthält bereits ein **ungenutztes** `pokemonIdSchema` — die Bausteine liegen da.
- **Kein Datenabfluss**, keine Zustandsänderung. Ob Next.js die Pfade im Produktionsmodus entfernt: `[!]` nicht verifiziert.

#### BUG-17: Gewinner-Meldung ohne 386 richtige Antworten
- **Severity: Low** · betrifft **EC-2**
- Zwei unabhängige Wege: (a) verworfene Fragen bleiben in `seenIdsRef` (gefüllt `quiz-screen.tsx:211`, in `onProbeFail` `:269` nie zurückgenommen) — die Gewinner-Prüfung `:355` zählt sie mit; (b) der Server prüft die Ausschlussliste nicht gegen den Pool: 386 Nummern **außerhalb** 1–386 → `{"status":"pool-empty"}` (verifiziert). Gleiche Wurzel wie BUG-12.
- Folge: „Alle Pokémon geschafft" plus gespeicherte Runde, ohne den Pool geleert zu haben.

#### BUG-18: `X-Forwarded-Host` hebelt die Origin-Prüfung der Server Actions aus
- **Severity: Low** · **Deploy-Notiz, kein Codefix**
- `Origin: https://evil.example` → **500 `Invalid Server Actions request.`**; mit zusätzlichem `X-Forwarded-Host: evil.example` → **200 `{"status":"saved"}`**.
- **Aus dem Browser praktisch nicht ausnutzbar:** `X-Forwarded-Host` ist nicht CORS-safelisted (Preflight scheitert), und das Sitzungscookie ist `sameSite: 'lax'` (`cookie-options.ts:19-23`).
- **Relevant wird es beim Deploy:** Steht ein Reverse Proxy oder CDN davor, das clientseitige `X-Forwarded-Host`-Header nicht verwirft, wird daraus ein echter CSRF-Vektor.

#### BUG-9 und BUG-11 — bestätigt, unverändert offen
- **BUG-9 (Medium, EC-7)** — zweimal provoziert, siehe EC-7 oben. **Zusatzbefund:** Verliert die Sitzung *während des Fragenladens*, zeigt der Client „Die Pokémon-Datenquelle antwortet nicht" — die Ursache wird dem Anbieter zugeschrieben statt der Abmeldung. Kein Rückschritt: derselbe Pfad galt vor `562bd0e`.
- **BUG-11 (Low, AC-25)** — `quiz-screen.tsx:423-432`, nur die Textzeile „Runde wird vorbereitet …". Die zweite Hälfte der Zusage hält: kein Spinner im Feature (`grep animate-spin|Loader|Spinner` → 0).

### Not Verified In This Run

- [!] **Alle reinen Client-Interaktionen** — AC-4, AC-6, AC-9, AC-10, AC-17, AC-18, AC-19, AC-24, EC-1, EC-9: **kein Browser**. Jeweils Garantie im Code mit `file:line` belegt und durch Komponententests gestützt. **AC-9 wäre über die E2E-Suite prüfbar gewesen — die ist durch BUG-14 rot**
- [!] **Optisches Urteil** — `pop` (AC-8), `nudge` (AC-6), „sanfter Puls" (AC-25), Abstände, Kontraste: kein Screenshot-Abgleich
- [!] **Cross-Browser und Viewport** — Bahn A lief ohne Browser; die E2E-Suite deckt drei Engines ab, ist aber rot (BUG-14). AC-24 (Umschalten bei 640 px) prüft sie ohnehin nicht
- [!] **AC-16 und EC-8 mit echtem PokeAPI-Ausfall, 429 oder 5xx** — bewusst nicht provoziert (Fair Use)
- [!] **EC-5** — im Pool 1–386 fehlt kein deutscher Name; der Fall ist nicht herstellbar
- [!] **EC-2 als echte 386-Antworten-Runde** — nicht spielbar; die serverseitige Hälfte ist verifiziert
- [!] **EC-6 und EC-10 als Browser-Ereigniskette** — das `error`-Ereignis eines `<img>` ist ohne Browser nicht auslösbar
- [!] **AC-20 browserseitig** — dass der Browser tatsächlich keine CDN-Anfrage stellt, ist ohne Browser nicht messbar; serverseitig und im HTML belegt
- [!] **AC-2 und AC-31 unter Produktionsbedingungen** — gemessen gegen den Dev-Server mit warmem Cache (393 Einträge)
- [!] **Drosselung der Server Actions** — nicht implementiert, bewusst (Backlog `B1`)
- [!] **Security-Header gegen die Live-URL** — lokal nachweislich alle abwesend
- [!] **Stack-Trace-Redaktion im Produktionsmodus (BUG-12)** — nur im Dev-Server beobachtet
- [!] **Clickjacking praktisch demonstriert** — kein Browser
- [!] **Ursache der E2E-Instabilität unter 16 Workern** — `no-third-party.spec.ts:29` löste einmalig auf 0 Antwortoptionen auf, seriell und im dritten Lauf grün; nicht deterministisch reproduzierbar
- [!] **Regression bei „Deployed"-Features** — `features/INDEX.md` führt **kein** Feature auf `Deployed`; ersatzweise gegen PROJ-1 und PROJ-2 geprüft

### Verdikt

- **Acceptance Criteria:** 20 von 31 mit Beleg bestanden · **AC-25 FAIL** · AC-15 und AC-2 teilweise · 9 ohne Browser nicht verifizierbar
- **Edge Cases:** 2 von 11 mit provozierter Ausnahme bestanden · **EC-7 und EC-11 FAIL** · EC-2 teilweise · 6 nicht verifizierbar
- **Die vier beauftragten Fixes:** alle vier wirken. BUG-7, BUG-8 und BUG-13 mit Beleg; BUG-10 auf Testebene, weil das Regressionsnetz dafür rot ist
- **Bugs:** 5 neu — **1 High** (BUG-14), **3 Medium** (BUG-15, BUG-16, BUG-12 hochgestuft), **2 Low** (BUG-17, BUG-18) · dazu bestätigt offen: BUG-9 (Medium), BUG-11 (Low)
- **Security:** **6 Prüfungen mit Beleg bestanden**, 2 mit Befund (Eingabevalidierung, Security-Header), 1 teilweise (CSRF), **3 NOT VERIFIED** (Drosselung bewusst, Header live, Brute Force gehört PROJ-1). **Kein SSRF über den Bild-Weg**, keine exponierten Secrets
- **Regression:** Test, Lint und Build grün · **E2E rot (BUG-14)** · PROJ-1, Shell und Datenschicht ohne Befund
- **Production Ready: NEIN**

> **Was dieser Lauf über den Fix-Lauf sagt.** Die vier beauftragten Fehler sind behoben, und drei davon wurden diesmal wirklich provoziert statt gelesen — ein gelöschtes Profil für EC-3, 404-Bildantworten für EC-6, zwei Cache-Messungen für AC-31. Der Fix-Lauf hat aber **die E2E-Suite nicht gefahren** und damit die einzige Stelle übersehen, an der das alte AC-9-Verhalten festgeschrieben war. Der eigene Unit-Test schrieb das neue fest, die fremde E2E-Suite das alte, und nur der eigene wurde ausgeführt. Ein Fix ist nicht fertig, wenn die selbst geschriebenen Tests grün sind.

> **Der lehrreichste Befund ist BUG-16.** Der Fix für BUG-8 war richtig — eine unveränderte Adresse ist keine Reparatur. Genau dadurch wurde sichtbar, dass die Reparaturebene für diesen Pool **nie** etwas anderes liefern kann und die Zusatzanfrage von über 100 KB immer umsonst ist. `design.md` begründet das gesamte Adressmuster mit einer Rückfallebene, die es faktisch nicht gibt. Das stand seit dem 2026-09-01 so da; niemand hat die beiden Konstanten je nebeneinandergelegt. Einen Fehler zu beheben heißt manchmal nur, den darunterliegenden freizulegen.

---

## QA-Lauf — 2026-09-05, nach den sechs Fixes vom Vortag

**Anlass:** Seit dem letzten Lauf sind BUG-14, BUG-16 (per `/refine` EC-11 gestrichen), BUG-15, BUG-12, BUG-17 und BUG-9 bearbeitet worden. Dieser Lauf prüft sie nach **und rollt alle 31 AC-IDs und alle 11 EC-IDs neu auf**.

**Aufbau:** Drei `qa-engineer`-Verifizierer in getrennten Kontexten, die den Bau nicht gesehen haben — Bahn A (Acceptance), Bahn B (Security), Bahn C (Regression). Zusammenführung und Bewertung: Hauptkontext.

**Zwei Aufträge dieses Laufs waren ausdrücklich, eigene Behauptungen zu widerlegen:** Bahn B sollte den alten Beleg für „Authentication Bypass" **nicht übernehmen** (seine Grundlage ist mit BUG-9 weggefallen) und den Wächter-Test aus T24 selbst angreifen. Bahn C sollte die Begründung der Worker-Deckelung nachmessen statt glauben. Beide Aufträge haben getragen — siehe BUG-20 und BUG-27.

**Bug-Nummerierung:** neue Befunde ab **BUG-19**.

### Das Ergebnis vorweg

**Production Ready: NEIN — 1 High, 4 Medium, 7 Low.**

Die sechs Fixes wirken; fünf davon sind mit provozierten Ausnahmen belegt. Der Lauf zeigt aber drei Dinge, die vorher niemand gesehen hat:

1. **Der Wächter aus T24 hält seine eigene Zusage nicht** (BUG-20). Er sollte strukturell erzwingen, dass jede Server Action ihre Sitzung prüft — und übersieht fünf Schreibweisen, darunter die, die Next.js' eigene Dokumentation als Erstes zeigt.
2. **Der BUG-9-Fix hat eine Nebenwirkung, die bei der Genehmigung nicht auf dem Tisch lag** (BUG-21): PROJ-1s Anmelde- und Registrier-Actions laufen jetzt unter **jedem** Pfad, nicht mehr nur unter `/login`.
3. **Die Ranglisten-Integrität trägt in der Kombination nicht mehr** (BUG-19) — ein Request erzeugt einen perfekten Bestwert, und Konten dafür lassen sich unbegrenzt und ohne CAPTCHA erzeugen.

### Die sechs Fixes — nachgeprüft

- [x] **BUG-14 behoben** — `npm run test:e2e` **24/24**, zweimal (Bahn C). Die beiden umgeschriebenen Specs laufen in allen drei Engines
- [x] **BUG-16 behoben, mit einem Rest** — kein `repairImageUrl`, kein `resolveOfficialImageUrl` mehr in `src/`; der laufende Client-Chunk exportiert als Server-Referenzen nur noch `getNextQuestion` und `saveRun`. **Aber:** `next.config.ts` trägt den zugehörigen `remotePattern` weiter → **BUG-22**
- [x] **BUG-15 behoben** — Zeitgrenze und stiller zweiter Versuch in `pokemon-image.tsx:56,110-116`, Abnahmetest mit Fake-Timern (`error-states.test.tsx:285-319`). Eine real hängende Quelle ist von außen nicht provozierbar
- [x] **BUG-12 behoben, live nachgeprüft** — `"oops"`, `null`, `{}`, `[999]`, `[0]`, `["1","2"]` → **alle `unavailable`**, kein 500, keine Serverpfade in der Antwort. 60.000 Elemente (120 KB) → `unavailable` in 0,30 s
- [x] **BUG-17 zur Hälfte behoben** — Zahlen außerhalb des Pools erzwingen kein „Pool leer" mehr (Bahn B). Der **Client-Pfad über „Pool leer"** trägt den Fehler jedoch weiter → **BUG-23**
- [x] **BUG-9 behoben, real provoziert** — Bahn A hat die Sitzung mitten in der Runde **global** abgemeldet (GoTrue `/logout?scope=global`, der „anderer Tab"-Fall aus EC-7): Beide Actions liefern danach `{"status":"unauthenticated"}` als reguläre Action-Antwort, für die Runde wurde **keine** Zeile geschrieben. Der über BUG-9 unerreichbare Zweig ist nachweislich erreichbar

### Acceptance Criteria

Bestanden mit Beleg: **AC-1, AC-3, AC-5, AC-8 bis AC-14, AC-19 bis AC-23, AC-26 bis AC-31** (21 von 31).

| ID | Beleg |
|----|-------|
| AC-8 | Fünf Rekord-Konstellationen live: erste Runde `true`, gleiche Serie schneller `true`, gleiche Serie langsamer `false`, höhere Serie `true`, erneutes Einreichen derselben Rekordrunde weiterhin `true` (Selbstausschluss) |
| AC-12 | Live abgelehnt: Serie 387, −1, 3.5, `"5"`, Dauer −5, 10 Fragen in 4999 ms, ungültige UUID, `null`. Angenommen an der Grenze: 10/5000 ms und 386/193000 ms. Zweite Ebene in der DB bestätigt |
| AC-14 | Fremdes `profile_id` **und** `profileId` injiziert → Zeile trägt die Sitzungs-ID; direkt über PostgREST → `42501` |
| AC-20 | Kein einziges rohes `<img>` in `src/`; `/_next/image` liefert von der eigenen Domain, Wiederholung `X-Nextjs-Cache: HIT`; der PokeAPI-Client trägt `server-only` |
| AC-26 | Konto über die Admin-API gelöscht → 0 Runden, 0 Profile. Zusätzlich in einer zurückgerollten Transaktion: Profil mit 2 Runden gelöscht → 0 verwaiste Zeilen |
| AC-30 | Schrift von `/_next/static/media/…woff2`; **0 Treffer** für `googleapis`/`gstatic` |
| AC-31 | 15 Fragen zweier Spieler (60 Namensabfragen) → Fetch-Cache blieb bei 393 Einträgen, **0 neue, 0 neu geschriebene Dateien** |

**Nicht bestanden:**

| ID | Ergebnis |
|----|----------|
| **AC-25** | [ ] **FAIL** — der Ladezustand der Runde ist ein alleinstehender Textabsatz ohne Skelettfläche (`quiz-screen.tsx:426-435`). Unverändert **BUG-11 (Low)** |
| AC-2, AC-4, AC-6, AC-7, AC-15 bis AC-18, AC-24 | [~] **TEILWEISE** — Logik und Markup belegt, das sichtbare Verhalten nicht (kein Browser) |

### Edge Cases

| ID | Ergebnis |
|----|----------|
| **EC-4** | [x] **PASS** — dieselbe `clientRoundId` zweimal nacheinander **und** zweimal parallel (`Promise.all`) → beide `saved`, **eine** Zeile. Garantie in der laufenden DB: `runs_client_round_id_key UNIQUE` |
| **EC-7** | [x] **PASS (Serverhälfte, real provoziert)** — siehe BUG-9 oben. Die Client-Navigation ist ohne Browser nicht beobachtbar |
| **EC-6** | [~] Kette live nachgewiesen: `/_next/image?url=…/99999.png` → **404**, worauf im Browser `error` feuert; `onProbeFail` verwirft und zieht neu. Das Browser-Ereignis selbst nicht beobachtbar |
| **EC-2** | [~] **TEILWEISE + BUG-23 (Low)** — Server meldet `pool-empty` exakt bei 386 gesehenen IDs, bei 385 kommt deterministisch das letzte Pokémon |
| **EC-11** | [x] **Verhalten stimmt mit dem neuen Wortlaut überein** — die Ebene ist im Code weg. Rest in der Konfiguration → **BUG-22** |
| EC-1, EC-5, EC-8, EC-9 | [!] NOT VERIFIED — Client-Interaktionen bzw. nicht herstellbare Quellenfehler; Garantien im Code belegt |
| EC-3, EC-10 | [~] Fänger und Grenze im Code belegt, Abnahmetests grün; echter Verbindungsabbruch nicht provozierbar |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis |
|---------|----------|
| **Authentication Bypass — Beleg vollständig neu erhoben** | [x] **PASS** — siehe eigener Abschnitt unten |
| Autorisierung | [x] PASS — 8 Prüfungen: fremde Runden über App und PostgREST, Feld-Injektion, `UPDATE`/`DELETE`, `auth.users`, fremde UUID als `excludeRoundId` (kein Existenz-Orakel) |
| Eingabevalidierung | [x] PASS — 9 Nutzlasten gegen `saveRun` (inkl. Prototype-Pollution und exakter Grenze 386/193000 gegen 192999), 6 gegen `getNextQuestion` |
| **SSRF über `/_next/image`** | [x] **PASS** — 10 Ausbruchsversuche, alle 400; Cache-Auffüllung als DoS nicht möglich (`q` ist beschränkt) |
| Exponierte Secrets | [x] PASS — 19 Chunks, 5,3 MB zusammengefügt: **0 Treffer** für Service-Role, `sb_secret_`, JWT-Secret, Action-`encryptionKey`, Anon-JWT |
| Sensible Daten in Antworten | [x] PASS — im gerenderten `/` mit Sitzung: E-Mail 0, User-ID 0, Tokens 0 |
| Zugangsdaten in URLs | [x] PASS — alle vier Formulare `method="post"` **plus** `onSubmit`. Zusatz: `/auth/confirm` hat **keinen** Open Redirect (5 Varianten geprüft) |
| Drosselung | [!] NOT VERIFIED — nicht implementiert: `saveRun` 40/40, `getNextQuestion` 30/30 ohne Bremse. Kein Zugangsdaten-Pfad in PROJ-2 |
| Security-Header | [ ] **FAIL** — weiterhin **keiner** der vier gesetzt |
| CSRF (`X-Forwarded-Host`) | [ ] **FAIL** — BUG-18 unabhängig als weiterhin vorhanden bestätigt; zusätzlich wirkt auch `Host: evil.example` |

#### Authentication Bypass — der alte Beleg galt nicht mehr, hier ist der neue

Der frühere Beleg lautete „alle Server Actions ohne Cookie → 307". Mit BUG-9 ist diese Grundlage weggefallen. Neu erhoben, 12 Prüfungen:

| Prüfung | Ergebnis |
|---|---|
| `getNextQuestion` ohne Sitzung | `200`, Body `{"status":"unauthenticated"}` — kein Pokémon, kein Name |
| `saveRun` ohne Sitzung | `{"status":"unauthenticated"}`, DB-Gegenprobe: **0 Zeilen** |
| `getPersonalBest` ohne Sitzung | `null` |
| **Gefälschtes** Action-Kennzeichen | `404`, `x-nextjs-action-not-found: 1` — kein Seiteninhalt |
| **Leeres** Kennzeichen | `404` |
| `Next-Action` auf **GET** | `307 → /login` (der Proxy verlangt `POST`) |
| Header-Groß-/Kleinschreibung | kein Unterschied — beide `unauthenticated` |
| Quiz-Kennzeichen auf **fremden Routen** | `/login`, `/reset-password` → `unauthenticated`; `/privacy`, `/leaderboard` → 404-Status, Action gibt nichts preis |
| Leakt die Antwort die **Seiten-Flight-Payload**? | **Nein** — auch mit `Next-Router-State-Tree` bleibt der Body ohne RSC-Baum von `/` |

**Antwort auf die Kernfrage:** Ein Action-POST ohne Sitzung erreicht ausschließlich Actions, die sich selbst schützen, und sie geben nichts preis. **Der Verzicht auf die 307 öffnet für sich genommen kein Loch.** Die Nebenwirkung liegt woanders — siehe BUG-21.

### Regression (Bahn C)

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **14 Dateien, 137 Tests, 137 grün** |
| `npm run lint` | **Exit 0** |
| `npm run build` | **Exit 0**, keine Kollision mit dem Dev-Server |
| `npm run test:e2e` | **24/24**, zweimal |

Ohne Befund: PROJ-1 vollständig gegen das laufende System — Registrierung, Abmelden, Login (korrekt / falsches Passwort / unbekanntes Konto mit **identischer** Meldung), Reset-Anforderung, echter Mailpit-Link, Reset in einem **frischen Browser-Kontext** („anderes Gerät"), Login mit neuem Passwort in einem dritten Kontext. Die Shell auf fünf Routen inklusive der 404-Antworten, je genau ein `<header>`/`<footer>`/`<main>`. Die Datenschicht gegen die laufende Datenbank: RLS aktiv, exakt drei Policies, keine UPDATE/DELETE, alle Constraints und Indizes deckungsgleich, keine `leaderboard`-Tabelle, Kaskade live in einer zurückgerollten Transaktion.

### Bugs

#### BUG-19: Ein Request genügt für einen perfekten Ranglisten-Bestwert — und Konten dafür sind unbegrenzt
- **Severity: High** · betrifft die User Story in `spec.md:16` und **PROJ-3, das es ungefiltert erbt**
- **Beleg:** `saveRun {"streak":386,"durationMs":193000,…}` → `200 {"status":"saved","isPersonalBest":true}` — ohne eine einzige Frage. Dazu: sechs Konten in Folge registriert, ohne Sitzung, ohne Bremse, ohne CAPTCHA (`supabase/config.toml:231-234`, `[auth.captcha]` auskommentiert).
- **Warum das trotz der Decision-Log-Zeile ein Befund ist:** `spec.md` akzeptiert bewusst den Rest-Missbrauch einer Formprüfung statt einer serverseitig autoritativen Runde. **Es akzeptiert nicht die Kombination** mit unbegrenzter, CAPTCHA-freier Kontoerzeugung. Einzeln ist jedes Stück eine getroffene Entscheidung; zusammen machen sie den Kern-Wettbewerbsmechanismus mit einem Skript wertlos.
- **Das ist eine Owner-Entscheidung, keine reine Fix-Frage.** Optionen: CAPTCHA bei der Registrierung, Drosselung auf `saveRun`, oder die Rangliste in PROJ-3 auf verifizierte Konten stützen. Vor PROJ-3 zu entscheiden, nicht danach.

#### BUG-20: Der Wächter-Test findet nicht jede Server Action
- **Severity: Medium** · betrifft die in `design.md` → T24 zugesagte Zusicherung, auf die sich `proxy.ts:77` ausdrücklich stützt
- Bahn B hat die Erkennungslogik unverändert gegen fünf synthetische Dateien laufen lassen. **Fünf Umgehungen, alle ohne böse Absicht erreichbar:**

| # | Form | Warum sie durchfällt |
|---|---|---|
| 1 | **Inline-`'use server'` im Funktionsrumpf** | `isServerActionModule` prüft nur den Dateianfang. **Das ist die Form, die Next.js' mitgelieferte Doku als Erstes zeigt** (`node_modules/next/dist/docs/…/07-mutating-data.md:38`) |
| 2 | `export { x } from './y'` / `export *` | `exportedActions` kennt nur `FunctionDeclaration` und `VariableStatement`, keine `ExportDeclaration` |
| 3 | `export default async function (…)` | übersprungen, weil `statement.name` fehlt |
| 4 | `export const { doThing } = impl` | übersprungen wegen `ts.isIdentifier(decl.name)` |
| 5 | `// TODO: getUser() here` im Rumpf | `SESSION_CHECK` ist eine **Textsuche** — ein Kommentar reicht für ein Falsch-Grün |

- Zusätzlich fängt die Mindestzahl `toBeGreaterThanOrEqual(4)` das nicht ab: Fielen alle drei Quiz-Actions still aus der Erkennung, blieben die vier Auth-Actions übrig — der Test wäre grün.
- **Kein aktueller Exploit.** Für den heutigen Code stimmt die Antwort des Wächters; Bahn B hat das unabhängig am Quelltext und am Manifest verifiziert. Der Befund ist, dass die **Zusicherung** nicht hält, während der Proxy sich auf sie stützt.
- **Das ist die unangenehmste Stelle dieses Laufs.** Der Wächter wurde gebaut, um genau die Frage „gilt das auch für die fünfte Action?" strukturell zu beantworten. Eine Absicherung, die ihre eigene Zusage nicht einlöst, ist schlechter als keine — weil man aufhört hinzusehen.

#### BUG-21: PROJ-1s Anmelde- und Registrier-Actions laufen jetzt unter jedem Pfad
- **Severity: Medium** · **Nebenwirkung des BUG-9-Fixes, die bei der Genehmigung nicht auf dem Tisch lag**
- **Beleg:** `loginAction` als Action-POST auf **`/`** ohne Sitzung → `200 {"error":"E-Mail-Adresse oder Passwort ist falsch."}`. `registerAction` ebenso: sechs Konten über `/` statt `/login`.
- **Ursache:** Vor der Änderung war ein Action-POST auf einem geschützten Pfad ohne Sitzung eine 307. Jetzt lässt `proxy.ts:79-81` jeden `POST` mit `next-action`-Header durch — unabhängig vom Pfad. Next.js bindet Actions nicht an die Route, auf der sie definiert sind.
- **Die praktische Folge, und sie ist der eigentliche Punkt:** Eine Edge- oder WAF-Regel, die nur `/login` bewacht — **der naheliegende Fix für BUG-21 aus PROJ-1** (das dortige Rate-Limit greift pro IP und damit auf der Server-IP) — **greift ins Leere.** Wer den Schutz beim Deploy plant, muss ihn auf den Action-Header stützen, nicht auf den Pfad.
- **Kein Datenabfluss**, keine Rechteausweitung. Der Befund ist die Erreichbarkeit, nicht das Verhalten.

#### BUG-22: Totes `remotePattern` weitet die Bild-Allowlist auf die ganze PokeAPI-Organisation
- **Severity: Low** · von **allen drei Bahnen** unabhängig gefunden
- `next.config.ts:21-24` trägt einen zweiten Eintrag `https://raw.githubusercontent.com/PokeAPI/**`, im Kommentar ausschließlich mit **EC-11** begründet — und EC-11 ist ersatzlos entfallen. Der Code dazu wurde entfernt, die Konfiguration nicht.
- **Er wirkt:** `/_next/image?url=…/PokeAPI/sprites/master/sprites/items/master-ball.png` → **200, image/png, 285 B**. Dieser Pfad liegt außerhalb des engen ersten Musters. Ein fremdes Repo wird mit 400 abgewiesen, ein PokeAPI-fremdes Verzeichnis mit 404 (Allowlist passiert, Upstream geholt).
- Folge: Der Bild-Proxy holt und cached auf Zuruf beliebige Bilddateien aus jedem Repository der Organisation, unauthentifiziert. Nicht-Bilder werden abgewiesen — deshalb Low.

#### BUG-23: Die Gewinner-Meldung kann weiterhin ohne 386 richtige Antworten erscheinen
- **Severity: Low** · betrifft **EC-2** · **der BUG-17-Fix war halb**
- Der Fix stellte die Gewinner-Prüfung in `answer()` von der Ausschlussliste auf die Serie um. Auf dem **zweiten** Pfad — `fetchQuestion → pool-empty → finishRound(streak, true)` (`quiz-screen.tsx:189-197`) — hängt `cleared=true` weiterhin an „Pool leer", nicht an „386 richtig".
- `seenIdsRef` enthält auch nach EC-6 verworfene Fragen. Wurden Bilder verworfen, ist der Pool erschöpft, bevor die Serie 386 erreicht — und der Spieler liest „Du hast jedes Pokémon aus dem Pool richtig erkannt", ohne es getan zu haben.
- Der Kommentar im Code verweist ausdrücklich auf diesen Pfad als „den ehrlichen Ort dafür". Er ist es nicht.

#### BUG-24: `durationMs` hat keine Obergrenze
- **Severity: Low** · betrifft **AC-12** · von Bahn A und Bahn B unabhängig gefunden
- `saveRun {"durationMs":2147483648}` → `200 {"status":"failed"}`. `validation/quiz.ts:38` hat nur `.min(0)`; der Wert passiert Zod und läuft erst im `integer`-Feld der Datenbank über.
- Zwei Folgen: AC-12s „rechnerisch möglich" ist an dieser Stelle nicht geprüft, und der Client bekommt die **falsche Fehlerklasse** — `failed` statt `rejected` — und bietet damit ein „Erneut speichern" an, das nie gelingen kann.
- Verwandt: `rejected` und `failed` teilen sich im Client denselben Zweig (`quiz-screen.tsx:166`). Für ehrliche Clients unerreichbar.

#### BUG-25: Die `profiles`-Policy gibt alle Spalten frei, nicht nur den Trainernamen
- **Severity: Low** · Datenminimierung (Art. 5(1)(c) DSGVO)
- `GET /rest/v1/profiles?select=*` mit gültiger Sitzung → `[{"id":"…","trainer_name":"…","created_at":"…"}]`, `count=exact` → **574**. Die Tabelle ist von jedem angemeldeten Konto vollständig auslesbar.
- `migrations/0001_profiles.sql:19-22` erlaubt `select` mit `using (true)` auf **alle** Spalten. `docs/data-model.md` sagt nur den Trainernamen zu; mitgeliefert werden Auth-User-ID und Registrierungszeitpunkt jedes Spielers.
- AC-27 gilt nur für `runs` und ist nicht verletzt. Gehört zu PROJ-1s Tabelle, betrifft aber die Zusage im app-weiten Datenmodell.

#### BUG-26: Der Proxy-Matcher lässt jeden Pfad mit Bild-Endung ungeprüft durch
- **Severity: Low** · vorbeugend
- `/secret` → `307 /login`, aber `/secret.png`, `/secret.svg`, `/secret.webp` → **404 ohne dass der Proxy läuft** (`proxy.ts:97`). `/secret?x=.png` → korrekt 307, die Query zählt also nicht mit.
- Heute ohne Wirkung, weil keine Route auf diese Endungen hört. Eine künftige geschützte Route — Export, Sharecard, `og:image` — wäre still ungeschützt, und die zweite Schranke aus `page.tsx` gäbe es dort nicht automatisch.

#### BUG-27: Die Begründung der E2E-Worker-Deckelung ist nicht reproduzierbar
- **Severity: Low** · Testinfrastruktur · **Bahn C hat eine Behauptung aus dem Vortag widerlegt**
- `playwright.config.ts:5-17` behauptet, ohne Deckel seien „5 bis 6 rot, reproduzierbar", an drei benannten Stellen. Bahn C hat **fünf Läufe mit 16 Workern** gefahren: **119 von 120 Einzelausführungen grün (0,8 % rot).**
- Der eine Fehlschlag lag an **keiner** der drei genannten Stellen. Insbesondere hielt AC-2s 3-Sekunden-Budget — im Kommentar als reißend beschrieben — in **allen fünf** Läufen.
- Der Deckel kostet **~22 % Laufzeit** (28 s → 36 s).
- **Plausible Erklärung der Abweichung, die den Kommentar trotzdem falsch macht:** Die ursprünglichen Messungen liefen jeweils kurz nach dem Start eines **frischen** Dev-Servers, also gegen kalte Turbopack-Kompilierung; Bahn C hat gegen einen lange warmgelaufenen gemessen. Ob der Deckel bleibt, ist damit neu zu entscheiden — der Kommentar ist in jedem Fall zu korrigieren.
- **Versteckt der Deckel einen Produktfehler?** Kein Beleg dafür. Der eine rote Lauf ist aber auch nicht sauber als Kontention erklärt: Der Snapshot zeigt das Formular ohne Bestätigung **und** ohne Fehlermeldung, und Drosselung ist als Ursache ausgeschlossen (6× `/auth/v1/recover` → 6× 200 in 56–70 ms). `[!]` Ursache nicht abschließend bestimmbar.

#### BUG-28: Dokumentation verweist auf entfernten Code
- **Severity: Low**
- `design.md:247` sagt im Präsens: „Im Quiz gehen `saveRun`, `getNextQuestion` und **`repairImageUrl`** hindurch." Die Funktion existiert nicht mehr.
- `tasks.md:20` (T2, abgehakt) und T5 verlangen weiterhin „bei fehlendem Bild über `/pokemon/{id}` die offizielle Adresse nachschlagen" — was T18 in derselben Datei zurücknimmt. Zwei abgehakte Tasks widersprechen sich, T2 ist nicht als überholt markiert.
- Die Kommentare in `client.ts:43`, `quiz-screen.tsx:252` und `error-states.test.tsx:251` nennen die entfallene Ebene ausdrücklich **als Historie** — das ist Absicht und kein Rest.

#### Bestätigt offen, unverändert
- **BUG-18 (Medium)** — `X-Forwarded-Host` hebelt die Origin-Prüfung aus; zusätzlich wirkt `Host: evil.example`. `serverActions.allowedOrigins` ist nicht konfiguriert. Deploy-Blocker in `INDEX.md`
- **Security-Header (Medium)** — weiterhin keiner der vier auf `/`, `/login`, `/reset-password`. Zusätzlich `X-Powered-By: Next.js`
- **BUG-11 (Low)** — AC-25, keine Skelettfläche beim Rundenstart
- **PROJ-1: T4 und T18 unabgehakt** — beide `[user]`-Aufgaben auf dem Zugangsdaten-Pfad. Nach der QA-Regel ein **High**; beide stehen bereits als Deploy-Blocker in `INDEX.md`, T18 ist hart blockiert (kein eigener SMTP). **PROJ-2 selbst hat keine `[user]`-Aufgaben**

### Not Verified In This Run

- [!] **Alles Optische und rein clientseitig Interaktive** — AC-4, AC-6 (`nudge`), AC-8 (`pop`), AC-19 (Verlassen-Dialog), AC-25 (Puls), EC-1, EC-9: **kein Browser**
- [!] **Responsives Rendering (AC-24) und Cross-Browser** — kein Viewport; die E2E-Suite fährt drei Engines, prüft aber keine Breakpoints
- [!] **AC-2 im Browser** — nur die Serverhälfte messbar (184–279 ms von 3000 ms)
- [!] **AC-15 mit real hängender Bildquelle, EC-3 mit real abgerissenem Speicheraufruf** — von außen nicht erzeugbar, ohne den geteilten Dev-Server zu stören
- [!] **EC-5 und EC-8** — setzen manipulierte PokeAPI-Antworten voraus; alle 386 Namen existieren
- [!] **AC-31 unter kaltem Cache** — der Speicher war warm (393 Einträge); belegt ist die Wiederverwendung, nicht der Erstaufbau
- [!] **Drosselung** — nicht implementiert (Backlog `B1`)
- [!] **`Strict-Transport-Security`** — lokal nur HTTP
- [!] **Ausnutzbarkeit von BUG-18 im Browser** — der Header-Durchgriff ist per `curl` belegt, der Preflight nicht nachstellbar
- [!] **Ob Next die Formen 2–4 aus BUG-20 tatsächlich als Actions registriert** — Bahn B hat bewusst keinen Code ins Projekt geschrieben. Belegt ist, dass der Wächter sie nicht sieht; für Form 1 belegt die mitgelieferte Next-Doku, dass sie eine gültige Action ist
- [!] **Ursache des einen E2E-Fehlschlags bei 16 Workern** — 1 in 120, nicht reproduzierbar
- [!] **Verhalten gegen das gehostete Supabase-Projekt** — nur lokal geprüft

### Verdikt

- **Acceptance Criteria:** 21 von 31 mit Beleg bestanden · **AC-25 FAIL** · 9 teilweise (Logik belegt, Sichtbares nicht)
- **Edge Cases:** EC-4 und EC-7 mit provozierter Ausnahme bestanden · EC-2 teilweise (BUG-23) · EC-11 verhaltensseitig erfüllt · 4 nicht verifizierbar
- **Die sechs Fixes:** alle wirken. BUG-16 und BUG-17 jeweils mit einem Rest (BUG-22, BUG-23)
- **Bugs:** 10 neu — **1 High** (BUG-19), **2 Medium** (BUG-20, BUG-21), **7 Low** · bestätigt offen: BUG-18 und Security-Header (je Medium), BUG-11 (Low), PROJ-1s T4/T18 (High, bereits Deploy-Blocker)
- **Security:** **7 Prüfungen mit Beleg bestanden**, 3 mit Befund, **2 NOT VERIFIED**. Der Authentication-Bypass-Beleg wurde **vollständig neu erhoben**: kein SSRF, keine exponierten Secrets, keine sensiblen Daten in Antworten, kein Open Redirect
- **Regression:** ohne Befund — 137/137, E2E 24/24, Lint und Build grün
- **Production Ready: NEIN**

> **Was dieser Lauf über den vorigen sagt.** Sechs Fixes, alle wirksam, zwei davon mit einem Rest, den erst ein fremder Blick fand. Bemerkenswert ist die Art der Reste: Bei BUG-16 wurde der Code entfernt und die Konfiguration vergessen; bei BUG-17 wurde der Fehler von einem Pfad auf den anderen geschoben und im Kommentar als gelöst beschrieben. Beides sind Fehler des Nachsehens, nicht des Denkens — und beide hätte man beim Bauen finden können, wenn man nach *allen* Stellen gesucht hätte statt nach der einen, die man gerade repariert.

> **Der wichtigste Befund ist BUG-20.** Der Wächter wurde ausdrücklich gebaut, um zu verhindern, dass die Sitzungsprüfung bei der fünften Action still verfällt — und er übersieht fünf Schreibweisen, darunter die, die Next.js' eigene Dokumentation zuerst zeigt. Solange er unvollständig ist, ist er schlimmer als sein Fehlen: Der Proxy stützt sich in einem Kommentar ausdrücklich auf ihn, und wer das liest, hört auf zu prüfen. Das gehört als Erstes repariert — nicht weil heute etwas offen steht, sondern weil die Zusage falsch ist.

---

## QA-Lauf — 2026-09-05 (zweiter des Tages), nach BUG-20 bis BUG-23

**Anlass:** Seit dem letzten Lauf sind BUG-20 (Wächter), BUG-21 (Proxy-Eingrenzung), BUG-22 (Bild-Allowlist) und BUG-23 (Gewinner-Meldung) bearbeitet worden; BUG-19 wurde als Voraussetzung nach PROJ-3 geroutet.

**Aufbau:** Drei `qa-engineer`-Verifizierer in getrennten Kontexten. Bahn B hatte den ausdrücklichen Auftrag, den **neu gebauten** Wächter anzugreifen, als hätte sie die alte Fassung nie gesehen, und die verengte Proxy-Ausnahme mit Pfadvarianten zu attackieren. Bahn A sollte **beide** Wege in EC-2 prüfen und sich nicht davon beruhigen lassen, dass einer stimmt. Bahn C sollte die Bild-Allowlist in **beide** Richtungen prüfen und den Worker-Deckel erneut nachmessen.

**Bug-Nummerierung:** neue Befunde ab **BUG-29**.

### Das Ergebnis vorweg

**Production Ready: NEIN — 1 High, 5 Medium, 6 Low.**

Dieser Lauf ist unbequem, weil die schwersten Befunde nicht alte Schulden sind, sondern **Folgen der Fixes des Vortags**:

1. **`/` ist durch den BUG-9-Fix ein Zugangsdaten-Endpunkt geworden** (BUG-29, High). 35 Fehlversuche gegen ein Konto über `POST /` — 35-mal dieselbe Antwort, keine Sperre. `tasks.md` behauptet an dieser Stelle bis heute, dieses Feature habe keinen Zugangsdaten-Pfad. Das ist durch Messung widerlegt.
2. **Die Eingrenzung aus BUG-21 ist weitgehend wirkungslos** (BUG-30, Medium). `POST /x.png` mit dem Anmelde-Kennzeichen liefert **200 samt vollständigem Sitzungs-Cookie** — der Proxy läuft auf Pfaden mit Bild-Endung gar nicht. Die Begründung, die im Code steht („eine WAF-Regel auf `/login` würde sonst umgangen"), ist damit nicht erfüllt.
3. **Der überarbeitete Wächter prüft nicht, was er verspricht** (BUG-32, Medium). Seine *Erkennung* ist jetzt vollständig — Bahn B hat alle in der Next-Doku dokumentierten Formen durchprobiert, keine wurde übersehen, und still grün werden kann er nicht. Aber seine *Sitzungsprüfung* fragt nur, ob irgendwo ein Aufruf namens `getUser` steht.
4. **Der BUG-23-Fix hat einen Off-by-one geerbt** (BUG-33, Medium): Auf dem Weg über „Pool leer" wird eine richtige Antwort **zu wenig** gespeichert — ranglistenrelevant.

### Die vier Fixes — nachgeprüft

- [x] **BUG-22 behoben, in beide Richtungen belegt** — Bahn C und Bahn B unabhängig: die real erzeugte Artwork-Adresse → **200**, `sprites/items/master-ball.png` → **400**, fremdes Repo → 400, Traversal roh und kodiert → 400, Host-Verwirrung → 400. **Nichts kaputtgespart**, die Allowlist deckt `spriteUrlFor` vollständig ab
- [x] **BUG-20 zur Hälfte behoben** — die Erkennung ist vollständig (siehe unten), die Sitzungsprüfung nicht → **BUG-32**
- [x] **BUG-21 formal behoben, praktisch unterlaufen** — `POST /leaderboard`, `/gibtsnicht`, `/irgendwas/tief` → 307. Aber Bild-Endungen und öffentliche Pfade umgehen es → **BUG-30**, **BUG-31**
- [x] **BUG-23 behoben, aber auf einer falschen Zahl** — Weg A (letzte richtige Antwort) korrekt, inklusive Gegenprobe. Weg B trägt einen Off-by-one → **BUG-33**

**Was am Wächter hält, ausdrücklich festgehalten:** Bahn B hat alle Formen aus `node_modules/next/dist/docs/…/use-server.md` und `…/server-actions.md` durchprobiert — Datei-Direktive, Inline-Direktive im Funktionsrumpf, Pfeilfunktion, Objekt-Methode, anonymer Default-Export, Currying, `export { inner as doThing }`, HOF-Umhüllung, `async function*`, `'use client'` davor. **Keine wurde übersehen**; nicht analysierbare Formen landen korrekt als „nicht durchlassen". Auf die Frage „kann er still grün werden?": **nein** — der Gegenzeuge hält an den Schwellen `>= 8` Actions in `>= 3` Dateien.

### Acceptance Criteria

Bestanden mit Beleg: **AC-1 bis AC-23 und AC-26 bis AC-31** (29 von 31), viele davon live provoziert.

| ID | Beleg |
|----|-------|
| AC-2 | Eigene Sonde: 2,5 s zwischen Klick und Bild-`onLoad`, Uhr zeigt bei Anzeige `0:00`, nach 1,2 s `0:01` — der Uhrenstart hängt am Bild, nicht am Klick. Serverbudget: `getNextQuestion` in **0,159 s** |
| AC-12 | 9 Live-Fälle: 387→`rejected`, 386/193000→`saved`, 386/192999→`rejected`, 0/0→`saved`, 2.5→`rejected`, UUID „nope"→`rejected` |
| AC-16 | Sonde: Fehlerkarte **innerhalb** der Quiz-Fläche, „Deine Serie von 1 bleibt erhalten", Uhr über 1,3 s stillstehend. Dass der Server den Zustand real erzeugt, live belegt |
| AC-17 | Sonde: nach „Erneut versuchen" läuft die Runde weiter, Uhr springt `0:01` → `0:02`, Serie unverändert |
| AC-20 | Sprite über die eigene Domain: 200, `image/png`, 19.291 Byte aus ~110 KB optimiert; fremder Host 400; im HTML **kein einziger** `https://`-Host |
| AC-26 | Konto mit 5 Runden live gelöscht → `runs` und `profiles` beide `[]` |
| AC-31 | 393 Cache-Einträge, alle 386 Species mit 30 Tagen Gültigkeit; zwei Live-Fragen (8 Namensabfragen) erzeugten **null** neue Cache-Dateien — bedient aus Einträgen, die eine **andere Sitzung am Vortag** angelegt hatte (spielerübergreifend) |
| AC-30 | Einzige Schriftquelle auf eigener Domain, **0** Treffer auf `fonts.gstatic`/`googleapis` im ausgelieferten CSS |

**Nicht bestanden:**

| ID | Ergebnis |
|----|----------|
| **AC-25** | [ ] **FAIL** — für „Runde wird vorbereitet" rendert `quiz-screen.tsx:437-446` eine zentrierte **Textzeile** statt einer Skelettfläche; beim Eintreffen der Frage springt das Layout auf StatusBar + Bildkarte + vier Optionen. Unverändert **BUG-11 (Low)**. Immerhin: kein alleinstehender Spinner — das einzige `animate-spin` liegt im ungenutzten `ui/sonner.tsx` |
| AC-24 | [!] **NOT VERIFIED** — kein Viewport. Markup-Beleg: kein Burger-Element, Trainername `hidden … sm:inline` |

*Strukturelle Abweichung ohne Bug-Charakter:* Das Abmelden sitzt als Geschwister **neben** dem Nutzer-Chip; `design.md` zeichnet es darunter. Funktional erfüllt.

### Edge Cases

Bestanden: **EC-1, EC-3, EC-4, EC-5, EC-6, EC-7, EC-9, EC-10** (8 von 11) — durchgehend provoziert statt gelesen.

| ID | Beleg |
|----|-------|
| EC-3 | **Nicht gemockt:** gültige Sitzung, aber gelöschte `profiles`-Zeile → Insert scheitert am Fremdschlüssel → der laufende Server antwortet live `{"status":"failed"}` |
| EC-7 | **Provoziert:** Sitzung mitten in der Runde global abgemeldet → `saveRun` antwortet `unauthenticated`, dazu `Set-Cookie: …Max-Age=0` und die In-Band-Umleitung nach `/login`; **keine** Zeile in der Datenbank |
| EC-4 | Dreimal dieselbe `clientRoundId`, davon einmal mit anderen Werten → dreimal `saved`, **eine** Zeile |
| EC-6 | Auslöser real belegt: `/_next/image` auf ein nicht existierendes Sprite → **404**, genau das Ereignis, das die Sonde mockt. Sonde feuert `error` **genau einmal** → Runde verwirft von sich aus |
| EC-10 | Streng nachgeprüft: **je ein** `error` pro Adresse, keine nachgelieferten Ereignisse → 3 Verwürfe, 3 Abrufe, dann die Fehlerkarte. Gegenprobe: nach einem einzelnen Verwurf läuft die Runde weiter, Zähler zurückgesetzt |
| EC-5 | Zusatzbefund aus dem Cache-Bestand: **386/386 Arten haben einen deutschen Namen, 0 Duplikate** — die Gefahr zweier gleicher Optionsnamen existiert im Pool nicht |

| ID | Ergebnis |
|----|----------|
| **EC-2** | Weg A **PASS** (mit verkleinertem Pool, inklusive Gegenprobe) · Weg B **FAIL** → **BUG-33 (Medium)** |
| EC-8 | [~] Code-Pfad belegt, `unavailable` live erzeugt; eine echte 429/500 der PokeAPI nicht erzwingbar |
| EC-11 | Verhalten korrekt, Code und Konfiguration frei von Resten — **ein Doku-Rest** → BUG-38 |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis |
|---------|----------|
| Authentication Bypass (Actions) | [x] PASS — beide Quiz-Actions und `getPersonalBest` ohne Sitzung: `unauthenticated` bzw. `null`, keine Zeile geschrieben |
| Pfadvarianten gegen das Sitzungsgatter | [x] PASS — `//`, `/.`, `/%2e`, `/./`, `/index`, `/a/../`, `/%2f`, `/?x=1`, `/LOGIN`, `HEAD /` → alle 307/308 |
| **Brute Force auf Zugangsdaten** | [ ] **FAIL → BUG-29 (High)** |
| **Proxy-Ausnahme umgehbar** | [ ] **FAIL → BUG-30, BUG-31 (je Medium)** |
| **Wächter: Sitzungserkennung** | [ ] **FAIL → BUG-32 (Medium)** |
| Wächter: Action-Erkennung | [x] **PASS** — alle dokumentierten Formen erfasst, kann nicht still grün werden |
| Autorisierung | [x] PASS — 8 Prüfungen: fremdes `profile_id` → `42501`, Querlesen → `[]`, PATCH/DELETE wirkungslos, Feld-Injektion landet beim Sitzungsprofil |
| Eingabevalidierung | [x] PASS — 13 Nutzlasten gegen `saveRun`, 9 gegen `getNextQuestion`, **kein einziger HTTP 500**, kein Stacktrace, kein Serverpfad |
| **SSRF über `/_next/image`** | [x] **PASS** — 10 Ziele, dicht **und** funktionsfähig; Antwort trägt zusätzlich `Content-Disposition: attachment` und eine restriktive CSP |
| Exponierte Secrets | [x] PASS — 19 Chunks, 5.285.283 Byte: **0 Treffer**; es existiert kein Browser-Supabase-Client |
| Sensible Daten in Antworten | [x] PASS — 0× E-Mail, 0× Tokens, 0× UUID |
| Zugangsdaten in URLs | [x] PASS — alle vier Formulare `method="post"` plus JS-Submit, im ausgelieferten HTML bestätigt |
| Kontoverrat | [x] PASS — unbekannte Adresse und falsches Passwort liefern denselben Text |
| Security-Header | [ ] **FAIL** — weiterhin keiner der vier, dafür `X-Powered-By: Next.js` |
| CSRF (`X-Forwarded-Host`) | [ ] **FAIL** — BUG-18 als offen bestätigt, auch in abweichender Header-Schreibweise |
| Drosselung | [!] NOT VERIFIED — 40× `getNextQuestion`, 40× `saveRun`, 30× `/_next/image` ohne Sitzung → keine Bremse |

### Regression (Bahn C)

`npm test` **150/150** · `npm run lint` **Exit 0** · `npm run build` **Exit 0** · `npm run test:e2e` **24/24**, zweimal, auch nach dem Build. PROJ-1 vollständig gegen das laufende System in drei Engines. Shell auf vier Routen inklusive 404. Datenschicht gegen die laufende Datenbank: RLS aktiv, exakt drei Policies, keine UPDATE/DELETE, `streak=500` → `23514`, doppelte `client_round_id` → `23505`, keine `leaderboard`-Tabelle.

### Bugs

#### BUG-29: `/` ist ein Zugangsdaten-Endpunkt — unbegrenztes Raten und Massenregistrierung
- **Severity: High** · **Folge des BUG-9-Fixes**
- **Beleg:** 35 Fehlversuche gegen ein bestehendes Konto über **`POST /`** mit dem Anmelde-Kennzeichen → **35-mal** `{"error":"E-Mail-Adresse oder Passwort ist falsch."}`, kein 429, keine Verzögerung. Zehn Registrierungen in Folge über `/` → zehn echte Konten in der Datenbank, ohne CAPTCHA.
- **Ursache:** `ACTION_HOST_PATHS = ['/']` (`proxy.ts:95`) lässt Action-POSTs ohne Sitzung durch. Next.js bindet eine Action nicht an ihre Route — im Manifest sind `loginAction` und `registerAction` auch als Worker von `app/page` eingetragen.
- **Die Zuordnung genau:** Das unbegrenzte Raten selbst ist **PROJ-1s bekannte Lücke** und existiert an `/login` unabhängig hiervon (dort als BUG-21 Deploy-Blocker geführt: das Limit greift pro IP und damit hinter Server Actions für alle Spieler gemeinsam). **Neu ist die Erreichbarkeit über `/`** — vor dem BUG-9-Fix war ein Action-POST dort ohne Sitzung eine 307.
- **`tasks.md:122` behauptet: „Es gibt keinen Zugangsdaten-Pfad in diesem Feature."** Diese Annahme ist widerlegt und war die Grundlage dafür, die fehlende Drosselung als „kein Bug" zu führen. Nach der Regel aus `.claude/skills/qa/SKILL.md` ist unbegrenztes Raten auf einem Zugangsdaten-Pfad ein **High**, kein NOT VERIFIED.
- Erschwerend: `T4 [user]` in PROJ-1 (Passwort-Mindestlänge im gehosteten Projekt) ist **nicht abgehakt**, und die Registrierung über diesen Pfad hängt daran.

#### BUG-30: Jeder Pfad mit Bild-Endung überspringt den Proxy vollständig
- **Severity: Medium** · **hebt die Wirkung von BUG-21s Fix weitgehend auf** · Höherstufung von **BUG-26** (dort Low, „vorbeugend")
- **Beleg:** `POST /x.png` mit dem Anmelde-Kennzeichen → **`HTTP 200`**, `Set-Cookie: sb-127-auth-token=…` (vollständige Sitzung ausgestellt), `x-action-redirect: /;push`. Dasselbe mit `/a/b.svg`. Pfadtiefe und Name sind frei wählbar — praktisch unbegrenzt viele Endpunkte.
- **Ursache:** `config.matcher` (`proxy.ts:117`) nimmt `.*\.(?:svg|png|jpg|jpeg|gif|webp)$` aus. Der Proxy läuft dort **gar nicht**, also greift weder `isPublicPath` noch `ACTION_HOST_PATHS`.
- **Damit ist die Begründung im Code hinfällig.** `proxy.ts:76-92` rechtfertigt die Verengung damit, eine WAF-Regel auf `/login` würde sonst umgangen — sie wird weiterhin umgangen, jetzt über beliebige Bild-Pfade. Auch die zweite Zusage („wenn es vergessen wird, ist das Symptom laut") gilt dort nicht: Auf diesen Pfaden gibt es kein Symptom.
- Im letzten Lauf stand dieser Matcher als BUG-26 mit „heute ohne Wirkung". Er hatte Wirkung; die Verbindung zum Action-Pfad wurde nicht gezogen.

#### BUG-31: Zugangsdaten-Actions laufen auch auf den öffentlichen Pfaden
- **Severity: Medium**
- **Beleg:** `POST /privacy` mit dem Anmelde-Kennzeichen → **200 + Sitzungs-Cookie**. Ebenso `/imprint` und `/reset-password`. Nur `/auth/confirm` antwortet 405.
- **Ursache:** `isPublicPath` (`proxy.ts:11-14`) greift **vor** der Action-Prüfung; die Ausnahme ist auf öffentlichen Pfaden gegenstandslos.
- **Und der Test dazu deckt es nicht auf:** `proxy.test.ts:110-124` prüft `/leaderboard`, `/gibtsnicht`, `/irgendwas/tief` — genau die drei Fälle, die die Implementierung ohnehin abfängt. Weder ein öffentlicher Pfad noch der Matcher-Fall kommt vor; letzterer ist konstruktionsbedingt unsichtbar, weil der Test `proxy()` direkt aufruft.

#### BUG-32: Der Wächter prüft, ob `getUser` *aufgerufen* wird — nicht, ob eine Sitzung geprüft wird
- **Severity: Medium** · betrifft die Zusage in `design.md:288` und den Kommentar in `proxy.ts:83-88`
- **Beleg:** Bahn B hat die Erkennungslogik gebündelt und direkt gefüttert. Fünf Attrappen, **alle grün**:

| Quelltext | Urteil |
|---|---|
| Eigene lokale `function getUser() { return { id: 'anyone' } }` | **GRÜN** |
| `if (false) { await supabase.auth.getUser() }` | **GRÜN** |
| Aufruf hinter `if (payload.checkPlease)` — der Angreifer setzt das Feld nie | **GRÜN** |
| `const never = () => supabase.auth.getUser()` — nie aufgerufen | **GRÜN** |
| `await supabase.auth.getUser()` ohne jede Auswertung des Ergebnisses | **GRÜN** |

- **Kein aktueller Exploit** — alle vier geschützten Actions prüfen echt, unabhängig nachgemessen. Der Befund ist, dass die Zusicherung im Design („eine Sitzungsprüfung im Rumpf") im Code nicht existiert, während der Proxy sich in seinem Kommentar darauf stützt.
- **Dies ist die zweite Runde in Folge, in der der Wächter mehr verspricht als er hält.** Beim ersten Mal war die Erkennung unvollständig, jetzt die Prüfung. Die Erkennung ist inzwischen belegt vollständig — das Problem ist an die andere Hälfte gewandert.

#### BUG-33: Auf dem Weg über „Pool leer" wird eine richtige Antwort zu wenig gespeichert
- **Severity: Medium** · betrifft **EC-2** und **AC-11** · **ranglistenrelevant, also PROJ-3**
- **Beleg (Sonde, Ausgabe wörtlich):** `WEG B saveRun: {"streak":0,…}` bei gleichzeitig angezeigtem „Runde beendet … 1 richtige Antworten".
- **Ursache, vom Hauptkontext unabhängig nachgeprüft:** `answer` plant `window.setTimeout(advance, CORRECT_FEEDBACK_MS)` (`quiz-screen.tsx:373`) aus dem Render **vor** `setStreak(nextStreak)` (`:355`). Das eingefangene `advance` hält das `fetchQuestion` desselben Renders, und dieses hält `streak` in seiner Closure (`:231`). Der `pool-empty`-Zweig ruft deshalb `finishRound(streak, streak >= POOL_SIZE)` (`:205`) mit der **alten** Serie auf.
- **Zwei Folgen:** Die gespeicherte Runde ist um eine richtige Antwort zu klein — auf der Rangliste dauerhaft. Und `cleared` wird aus derselben zu kleinen Zahl berechnet, ein über diesen Weg endender Volltreffer bekäme die Gewinner-Meldung **nicht**.
- **Der Off-by-one auf der Serie ist älter als der BUG-23-Fix** — dort stand `finishRound(streak, true)` mit demselben veralteten Wert. Neu ist, dass `cleared` die Staleness geerbt hat. Der Fix hat das Symptom verschoben, ohne die Wurzel anzusehen.
- Erreichbar erst bei erschöpftem Pool — selten, aber es ist genau der Fall, den EC-2 beschreibt.

#### BUG-34: `PUBLIC_ACTIONS` befreit nach Namen, nicht nach Datei
- **Severity: Low**
- `server-actions.guard.test.ts:60` prüft `PUBLIC_ACTIONS[action.name]` ohne Bezug zur Datei. Eine neue Action, die irgendwo in `src/` `loginAction` oder `logoutAction` heißt, ist automatisch befreit.
- Die „Begründungspflicht" ist eine Längenprüfung: 21 beliebige Zeichen genügen.

#### BUG-35: Die Selbsttests des Wächters prüfen den Ist-Zustand, nicht die Eigenschaft
- **Severity: Low**
- `server-actions.guard.self.test.ts` deckt genau die fünf benannten Alt-Lücken plus einen Positivfall ab. **Kein Fall prüft** „eine Action ohne echte Sitzungsprüfung fällt durch" — alle fünf Attrappen aus BUG-32 fehlen.
- Dasselbe Muster wie bei `proxy.test.ts` (BUG-31): Die Tests beschreiben, was die Implementierung tut, statt was sie leisten soll.

#### BUG-36: `npm test` ist nirgends erzwungen
- **Severity: Low**
- `design.md:296` begründet den Verzicht auf eine ESLint-Regel damit, der Test laufe „in `npm test`, also in der Prüfung, die dieses Projekt ohnehin vor jedem Commit fährt". Es gibt **kein** `.husky/`, **kein** `.github/workflows/`, keinen Hook.
- Der einzige strukturelle Schutz läuft nur, wenn jemand ihn von Hand startet — und die Begründung, warum kein zweiter Mechanismus nötig sei, hält nicht.

#### BUG-37: Die Proxy-Verengung bringt BUG-9 auf der 404-Seite zurück
- **Severity: Low**
- Die 404-Seite rendert die Shell **samt Abmelden-Formular** (`site-header.tsx:70-74`, im HTML nachgewiesen). Läuft dort die Sitzung ab und der Nutzer klickt „Abmelden", antwortet der Proxy mit `307` auf einen Action-POST — genau der Protokollbruch, gegen den BUG-9 gebaut wurde. Gemessen: `POST /gibtsnicht` ohne Sitzung → 307, mit Sitzung → durchgelassen.
- Heute nur die 404-Seite. Sobald PROJ-3 `/leaderboard` mit Actions baut und `ACTION_HOST_PATHS` vergisst, wird daraus derselbe Fehler auf einer echten Seite.

#### BUG-38: Doku-Drift, teils vom Fix des Vortags übrig gelassen
- **Severity: Low** · von Bahn A und Bahn C unabhängig gefunden
- `tasks.md:72` (T14) und `:73` (T15) beschreiben `repairImageUrl` und den Reparaturzweig weiter im Präsens. **T29 hat genau diese Drift bei T2, T5 und `design.md` durchgestrichen und T14/T15 ausgelassen** — die Zeile T29 behauptet mehr, als sie geleistet hat.
- `design.md:201` führt als geltende Entscheidung „Der Proxy leitet Server-Action-POSTs nicht um", ohne die Einschränkung auf `/` aus T26. Dieselbe überholte Aussage steht in `server-actions.guard.ts:12` **und in der Fehlermeldung**, die ein Entwickler liest, wenn der Wächter anschlägt (`server-actions.guard.test.ts:85`).
- `design.md:201` behauptet zudem, ein Action-Kennzeichen fremder Routen ergebe ohne Sitzung **HTTP 500**. Gemessen: **404** mit `x-nextjs-action-not-found: 1`, und `loginAction` an `/` gepostet läuft sogar (200).

#### BUG-27 (bestätigt, zweiter unabhängiger Verifizierer): Die Worker-Deckelung ist unbegründet
- **Severity: Low**
- Bahn C: **fünf Läufe bei 16 Workern → 5× 24/24**, dabei ~25 % schneller als mit Deckel (29 s gegen 36 s). Der Kommentar behauptet an genau dieser Zahl „5 bis 6 rot, reproduzierbar".
- Kontention beginnt erst bei **24 Workern** (dort 4 rot). Diese Zahl stünde korrekt im Kommentar.
- Nach dem letzten Lauf nicht korrigiert — ein Versäumnis, nicht ein neuer Befund.

#### Bestätigt offen, unverändert
- **BUG-11 (Low, AC-25)** — keine Skelettfläche beim Rundenstart. Das einzige gefallene AC
- **BUG-18 (Medium)** — `X-Forwarded-Host` hebelt die Origin-Prüfung aus, auch in abweichender Schreibweise
- **Security-Header (Medium)** — weiterhin keiner der vier
- **BUG-24 (Low)** — `durationMs` ohne Obergrenze: `3000000000` → `failed` statt `rejected`
- **PROJ-1: T4 unabgehakt** — Zugangsdaten-Pfad, siehe BUG-29

### Not Verified In This Run

- [!] **Alles Optische und rein clientseitig Interaktive** — Farben (AC-4, AC-6), `pop` (AC-8), `nudge`, Puls (AC-25), Verlassen-Dialog (AC-19): **kein Browser**
- [!] **AC-24 vollständig** — kein Viewport
- [!] **AC-2 als Ende-zu-Ende-Messung** „Klick bis sichtbares Pokémon < 3 s" — nur Server- und Bildabruf messbar (0,159 s + 0,002 s)
- [!] **AC-20 als Netzwerk-Mitschnitt** einer echten Runde
- [!] **AC-15 und EC-8 mit real hängender bzw. mit 429/500 antwortender PokeAPI** — der ausgehende Verkehr des Dev-Servers ist von hier nicht manipulierbar
- [!] **EC-2 Weg A mit dem echten Pool 386** — geprüft mit auf 3 verkleinertem `POOL_SIZE`; die Codezweige sind identisch
- [!] **Drosselung** — nicht implementiert (Backlog `B1`); auf dem Zugangsdaten-Pfad ist das jetzt BUG-29 und kein NOT VERIFIED mehr
- [!] **Security-Header und `X-Forwarded-Host` gegen die Live-URL** — es gibt noch keinen Host
- [!] **Wächter-Erkennung außerhalb `src/` und außerhalb `.ts`/`.tsx`** — eine Action in `.js`/`.mjs` oder außerhalb `src/` wäre für Erkennung **und** Gegenzeuge gleichzeitig unsichtbar. Im heutigen Projekt gibt es keine solche Datei (74 gescannt), deshalb Restrisiko statt Bug
- [!] **AC-31 unter Produktionsbedingungen** — `minimumCacheTTL` wirkt erst im Produktionsserver; im Dev antwortet `/_next/image` mit `max-age=0, must-revalidate`
- [!] **Regression gegen „Deployed"-Features** — es gibt keine; ersatzweise PROJ-1

### Verdikt

- **Acceptance Criteria:** 29 von 31 mit Beleg bestanden · **AC-25 FAIL** · AC-24 ohne Viewport nicht verifizierbar
- **Edge Cases:** 8 von 11 provoziert bestanden · **EC-2 Weg B FAIL** · EC-8 teilweise · EC-11 verhaltensseitig erfüllt
- **Die vier Fixes:** BUG-22 vollständig; BUG-20, BUG-21 und BUG-23 jeweils **halb** — mit einem Rest, der schwerer wiegt als das, was behoben wurde
- **Bugs:** 10 neu — **1 High** (BUG-29), **4 Medium** (BUG-30, BUG-31, BUG-32, BUG-33), **5 Low** · bestätigt offen: BUG-18 und Security-Header (je Medium), BUG-11, BUG-24, BUG-27 (Low)
- **Security:** **10 Prüfungen mit Beleg bestanden** — kein SSRF, keine exponierten Secrets, keine sensiblen Daten in Antworten, keine Zugangsdaten in URLs, Autorisierung auf beiden Ebenen, Eingabevalidierung ohne einen einzigen 500er, kein Kontoverrat · **5 mit Befund** · **2 NOT VERIFIED**
- **Regression:** ohne Befund — 150/150, E2E 24/24 (auch nach dem Build), Lint und Build grün
- **Production Ready: NEIN**

> **Was dieser Lauf über den vorigen sagt.** Von vier Fixes ist einer vollständig (BUG-22, in beide Richtungen belegt). Die anderen drei haben jeweils **die eine Hälfte repariert und die andere freigelegt**: Der Wächter erkennt jetzt jede Action, prüft aber die falsche Eigenschaft. Die Proxy-Ausnahme ist auf `/` verengt, und `/` ist damit ein Zugangsdaten-Endpunkt — während Bild-Pfade und öffentliche Pfade die Verengung ohnehin umgehen. Die Gewinner-Meldung hängt jetzt an der Serie, und die Serie ist auf diesem Pfad um eins zu klein.

> **Das Muster ist deutlich genug, um benannt zu werden.** Drei Fixes in Folge wurden dort angesetzt, wo der Befund stand, statt an der Stelle, die er beschreibt. Bei BUG-21 hätte die Frage „wo läuft der Proxy überhaupt?" den Matcher sofort gezeigt — er stand als BUG-26 im selben Bericht, zwei Absätze weiter. Bei BUG-23 hätte die Frage „woher kommt `streak` an dieser Stelle?" den Off-by-one gezeigt, der schon vorher dort war. Ein Fix, der die genannte Zeile ändert und die Umgebung nicht liest, verschiebt den Fehler, statt ihn zu beheben.

---

## QA-Lauf — 2026-09-05 (dritter des Tages), nach der Drosselung, dem E2E-Lauf und dem Pre-Commit-Wächter

**Getestet:** 2026-09-05 · **App-URL:** `http://localhost:3000` (`probe.kind: http`) · **Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Lauf verifiziert (Beleg Pflicht) · `[ ] BUG` als kaputt verifiziert · `[!]` in diesem Lauf nicht prüfbar (Grund Pflicht)

Drei Bahnen mit getrennten Bereichen, keine kannte die Sitzung, in der gebaut wurde — nur den Feature-Ordner, die AC-/EC-Liste, ihren Schritt aus dem Skill und die laufende App. Bahn A: Acceptance. Bahn B: Security-Red-Team. Bahn C: Regression. Zusammengeführt und bewertet von einem Besitzer.

### Das Ergebnis vorweg

- **30 von 31 AC bestanden**, **AC-25 FAIL** (unverändert BUG-11), **AC-24** ohne Viewport nicht verifizierbar.
- **10 von 11 EC bestanden**, EC-11 ist laut `spec.md` entfallen und der Code dazu ist nachweislich konsistent.
- **Regression ohne Befund:** `npm test` 164/164, Lint grün, Build grün, E2E 27/27 über drei Engines, alle Kernabläufe von PROJ-1 unverändert.
- **15 neue Bugs** — **1 High**, **7 Medium**, **7 Low** — plus eine High-Bewertung für zwei offene `[user]`-Aufgaben auf dem Zugangsdaten-Pfad.
- **Production Ready: NEIN.**

> **Der Satz, auf den es in diesem Lauf ankommt.** Die drei Arbeiten dieses Tages — Drosselung, E2E-Entkopplung, Pre-Commit-Wächter — funktionieren im gewöhnlichen Ablauf und sind nachgemessen. Zwei von ihnen tragen aber eine **Begründung, die weiter reicht als der Code**: Die Drosselung verspricht einen Schutz gegen Passwort-Spraying, den ihr eigener Zurücksetz-Mechanismus wieder aufhebt (BUG-39), und der Wächter verspricht, „einen frischen Klon zu überleben", was er in der geprüften Form nicht tut (BUG-40). Das ist nach BUG-20 und BUG-32 das **dritte und vierte Mal** in diesem Feature, dass eine Zusage nicht durch das gedeckt ist, was darunter läuft.

### Antwort auf die Frage, die diesen Lauf ausgelöst hat: Schließt der Pre-Commit-Wächter BUG-36?

**Überwiegend ja, vollständig nein.** Die Sache, für die BUG-36 geschrieben wurde — „läuft der Wächter-Test wirklich vor jedem Commit?" — ist im Arbeitsablauf dieses Repositories erledigt und nachgemessen: Eine ungeschützte Server Action unter `src/` vorgemerkt → `1 failed | 162 passed` → **Commit gestoppt**. Das ist mehr, als vorher da war, und es ist belegt statt behauptet.

Nicht geschlossen sind vier Punkte, von denen einer die Kernzusage selbst trifft:

| Behauptet in `design.md:314` / `tasks.md` (T37) | Wirklichkeit |
|---|---|
| „überlebt einen frischen Klon" | **falsch, so wie es dasteht** (BUG-40). Im frischen Klon ist `core.hooksPath` leer; ein Commit mit JWT geht durch. Aktiv wird der Hook erst **nach** `npm install` — `prepare` läuft nicht beim Klonen. Die **Datei** überlebt den Klon, die **Aktivierung** nicht |
| blockt echte env-Dateien | stimmt, in beide Richtungen gemessen |
| blockt Schlüssel-Muster im vorgemerkten Inhalt | stimmt — **außer** bei Dateinamen mit Nicht-ASCII-Zeichen (BUG-41) und bei Binärdateien (BUG-43) |
| „Die Fundstelle wird nie ausgegeben" | stimmt |
| fährt `npm test`, sobald Code im Commit liegt | stimmt — prüft dabei aber den **Arbeitsbaum**, nicht das Vorgemerkte (BUG-42) |
| `--no-verify` umgeht ihn, Absicht | stimmt und ist benannt |

**BUG-41 ist der unangenehmste der vier**, weil er beide Hälften gleichzeitig still abschaltet: `git diff --cached --name-only` gibt einen Pfad mit Umlaut **quotiert** aus (`"docs/schl\303\274ssel-probe.md"`), `git show ":$file"` scheitert daran, `2>/dev/null` verschluckt den Fehler, `grep` bekommt leere Eingabe — und der Commit läuft durch. In einem Projekt, dessen Dokumente durchgehend deutsch sind, ist ein Umlaut im Dateinamen kein exotischer Fall. Vom Besitzer unabhängig nachgemessen: JWT in `docs/schlüssel-probe.md` → **durchgelassen**, Exit 0.

### Acceptance Criteria

- [x] **AC-1 bis AC-3, AC-5, AC-7 bis AC-14, AC-16 bis AC-18, AC-20 bis AC-23, AC-26 bis AC-31** — bestanden mit Beleg. Auszug der Messungen: AC-2 fünf Läufe, 318–350 ms bis zur ersten Frage (Grenze 3 s); AC-3 zwölf echte Fragen, jede Lösung zeichengleich mit `pokemon-species/{id}` → `names[de]`, `correctIndex` streute über alle vier Positionen; AC-8 über die echte Action gemessen (9/20000 → false, 11/60000 → true, 11/45000 → false); AC-12 sechs unmögliche Einreichungen → alle `rejected`, dazu eine **zweite, unabhängige Schranke** in der DB (`23514 runs_streak_range`, `runs_duration_plausible`); AC-14 untergeschobene `profile_id` landet auf dem eigenen Profil, direkter Insert als Fremder → `42501`; AC-26 Konto gelöscht → `runs`-Zeilen weg (`0002_runs.sql:7 on delete cascade`); AC-31 sechs Fragen hintereinander → **kein einziger neuer Eintrag** im Fetch-Cache, Bilder `X-Nextjs-Cache: HIT`
- [x] **AC-4, AC-6, AC-15, AC-19** — Verhalten bestanden, Farb- und Bewegungsanteile siehe „Nicht verifiziert". **AC-6 ist seit diesem Lauf erstmals automatisiert gedeckt** — `src/components/quiz/quiz-screen.wrong-answer.test.tsx`, siehe „Neue Unit-Tests"
- [ ] **AC-25 — FAIL** (unverändert **BUG-11**, Low). Das Bild-Skelett existiert, der Ladezustand der Quiz-Karte ist aber ein zentrierter Satz statt einer Skelettfläche: `quiz-screen.tsx:457-466` rendert `<p class="py-16 text-center">Runde wird vorbereitet …</p>`. Das Layout springt beim Eintreffen des Bildes — genau das, was AC-25 ausschließt
- [!] **AC-24** — kein Viewport. Markup-Beleg vorhanden (`site-header.tsx:57-67`, kein Burger-Element), das Verhalten bei 375/640/768 px nicht

### Edge Cases

- [x] **EC-1 bis EC-10** — bestanden. Hervorzuheben: **EC-4 mit echter Gleichzeitigkeit** — vier parallele identische Einreichungen (`Promise.all`) → alle „saved", in der DB genau **eine** Zeile. Die Garantie dahinter ist die richtige: `client_round_id uuid not null unique` (`0002_runs.sql:14`), Behandlung des `23505` in `run-actions.ts:93-97`
- [x] **EC-11** — laut `spec.md` entfallen, und der Code ist konsistent: kein `repairImageUrl`, keine zweite Bildquelle, das breite `…/PokeAPI/**`-Muster ist raus (gegengemessen: `/_next/image` auf `…/sprites/items/poke-ball.png` → **400**). BUG-22 damit geschlossen

### Security-Audit (Bahn B)

- [x] **Authentifizierung** — geschützte Routen ohne Sitzung: `/` → 307, `/leaderboard` → 307; Server Actions ohne Cookie → `unauthenticated`, **auch** unter `/beliebig.png` und `/reset-password`. Die Schranke sitzt in der Action, nicht am Pfad
- [x] **Autorisierung** — Konto B liest die Runden von A → `[]`; Insert mit fremder `profile_id` → `42501`; `PATCH`/`DELETE` auf Runden → `[]`, Werte unverändert (keine update/delete-Policy). Drosseltabelle und ihre Funktionen für `anon` und `authenticated` gesperrt (`401`/`403 42501`)
- [x] **Eingabevalidierung** — XSS, SQLi, Typverwechslungen, 1000-Element-Arrays gegen beide Actions: durchweg `rejected` bzw. `unavailable`, **kein einziger 500er**
- [x] **Brute Force, Konto-Hälfte** — 25 Fehlversuche gegen **ein** Konto mit **je eigener** gefälschter `x-forwarded-for`: ab dem **21.** gedrosselt. Diese Hälfte hält und ist per Header nicht umgehbar
- [ ] **BUG: Brute Force, IP-Hälfte** — mit einem eigenen Konto abschaltbar, siehe **BUG-39 (High)**
- [x] **Open Redirect** — sieben Varianten gegen `/auth/confirm?next=` → alle auf `/reset-password?error=1`. BUG-20 geschlossen
- [x] **SSRF / Bild-Allowlist** — `evil.example.com` → 400, `169.254.169.254` → 400, Pfad-Traversal → 400
- [x] **Zugangsdaten in der URL** — alle vier Auth-Formulare tragen `method="post"`, im ausgelieferten HTML belegt
- [x] **Sensible Daten in Antworten** — angemeldete `/`-Antwort: Trainername 2×, **0×** E-Mail, **0×** UUID, **0×** Token
- [x] **Geheimnisse im ausgelieferten Bundle** — **in der Sache bestanden**, mit zwei Kontrollen (ausgeloggt **und** angemeldet) und einer Marker-Gegenprobe, die belegt, dass die Suche den Fehlerweg überhaupt träfe. Zur Methode und zum Fund im Build-Cache: **BUG-44**
- [ ] **BUG: Security-Header** — keiner der vier, auch im echten Produktionsbuild nicht. Unverändert **BUG-12 (Medium)**
- [ ] **BUG: `X-Forwarded-Host`** — hebelt die Origin-Prüfung weiter aus (mit Header: 200 statt 500). Unverändert **BUG-18 (Medium)**
- [ ] **BUG: Kontoerkennung** — bei der Registrierung (BUG-48) und über die Antwortzeit (BUG-46)
- [!] **Rate-Limit gewöhnlicher Endpunkte** — nicht implementiert (Backlog `B1`): 30 × `saveRun` in 5,9 s → 30 gespeichert. Bewusst zurückgestellt, deshalb NOT VERIFIED und kein Bug
- [!] **Supabases eigenes IP-Limit (30/5 min)** — lokal nicht auslösbar; nur gegen das gehostete Projekt messbar

### Regression (Bahn C) — ohne Befund

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **164/164 grün**, 17 Dateien (162 + 2 neue, siehe unten) |
| `npm run lint` | grün, Exit 0 |
| `npm run build` | grün, Next.js 16.3.3 |
| `npx playwright test` | **27/27 grün**, drei Engines, 38,5 s — Browser waren vorhanden, **nichts nachinstalliert** |
| PROJ-1 Kernabläufe | Registrierung, Anmeldung, Abmeldung, Zugangsschutz, Passwort-Reset über den echten Mail-Link, Zweitverwendung des Links, identische Fehlermeldung — **alle unverändert** |
| App-Shell auf allen Routen | je genau **eine** Kopf- und Fußzeile, kein zweiter Rahmen, kein toter Bestenlisten-Link |

### Neue Unit-Tests (von `/qa` geschrieben)

`src/components/quiz/quiz-screen.wrong-answer.test.tsx` — zwei Tests für **AC-6**.

Der Anlass ist ein Befund über die Testsuite selbst: **Jede Fixture trug `correctIndex: 0`, und jeder Klick in jedem Test ging auf „Antwort A"** — also immer auf die richtige. Der Ablauf, mit dem *jede* Runde endet, war damit nirgends automatisiert gedeckt.

Geprüft werden vier Zusagen aus AC-6: die rote Markierung samt `nudge` auf der gewählten Option, **gleichzeitig** die grüne auf der richtigen, das Anhalten der Uhr, und dass die Auflösung stehen bleibt, bis der Nutzer selbst weiterklickt (der richtige Pfad zieht nach 350 ms von allein weiter — hier darf das nicht passieren).

**Rot-Probe durchgeführt, beide Tests einzeln:** Markierung der falschen Option auf `dimmed` gesetzt → Test 1 rot (`expected … to contain 'animate-[nudge_0.4s_ease-in-out]'`). `pauseClock()` im Falsch-Zweig auskommentiert → Test 2 rot (`expected '0:08' to be '0:03'`). Beide Eingriffe danach zurückgenommen.

Ein dritter Anlauf war nötig und gehört zur Ehrlichkeit dieses Eintrags: Der Uhr-Test war zunächst **grün, weil die Uhr nie lief** — Vitest fälscht `performance.now()` nicht von sich aus. Ohne `toFake: [… 'performance']` hätte er genau den Fehler durchgewunken, den er bewachen soll. Der Grund steht als Kommentar in der Datei.

### Bugs

#### BUG-39: Der IP-Zähler der Drosselung lässt sich mit einem eigenen Login zurücksetzen
- **Severity: High** · PROJ-1 AC-8 · `.claude/rules/security.md` → Authentication
- `clearAttempts()` löscht nach jedem geglückten Login **beide** Schlüssel, auch `login:ip:<IP>` (`src/lib/auth/throttle.ts:113-121`, aufgerufen in `actions.ts:101`). Wer **ein einziges eigenes Konto** hat, löscht damit seinen eigenen IP-Zähler beliebig oft — ohne jede Header-Fälschung.
- **Gemessen:** 4 Fehlversuche (Zähler 4/5) → ein erfolgreicher eigener Login → 5 weitere Fehlversuche, **alle durchgelassen**. Als Schleife: **24 Passwortversuche gegen 24 verschiedene Konten von einer IP in 3,6 s, 0 abgewiesen.**
- **Warum das High ist:** Gegen **Passwort-Spraying** — ein gängiges Passwort gegen viele Konten — greift der Konto-Zähler nicht, weil jedes Opferkonto genau einen Versuch bekommt. Der IP-Zähler ist dagegen die einzige Bremse, und die ist mit einem legitimen Konto abschaltbar. Genau diesen Angriff nennt `throttle.ts` in seinem eigenen Kopfkommentar als Begründung für den zweiten Zähler.
- `design.md` von PROJ-1 beschreibt den Reset als reine Bequemlichkeit („vier Tippfehler sollen nicht nachwirken") und benennt diese Nebenwirkung nicht.
- **Richtung:** beim Erfolg nur den **Konto**-Schlüssel löschen, den IP-Schlüssel stehen lassen.

#### BUG-40: „Überlebt einen frischen Klon" trifft auf die Datei zu, nicht auf die Aktivierung
- **Severity: Medium** · schließt BUG-36 nur teilweise
- Im frischen Klon (`git clone --no-hardlinks`): `git config --get core.hooksPath` → **leer**; Commit einer Datei mit JWT → **durchgelassen**. Der Hook wird erst aktiv, nachdem jemand `npm install`/`npm ci` ausgeführt hat — `prepare` läuft nicht beim Klonen, und `--ignore-scripts` überspringt es ganz.
- Der Vergleich in `design.md:314` („anders als alles unter `.git/hooks/`") stimmt und führt trotzdem in die Irre: Gegenüber `.git/hooks/` ist es ein Fortschritt, aber der Satz sagt „überlebt einen frischen Klon", und das tut die Aktivierung nicht.
- **Ehrlich wäre:** „aktiv, sobald einmal `npm install` gelaufen ist; vorher nicht."

#### BUG-41: Ein Umlaut im Dateinamen schaltet beide Prüfungen des Wächters still ab
- **Severity: Medium**
- `git diff --cached --name-only` gibt Nicht-ASCII-Pfade **quotiert** aus (`"docs/schl\303\274ssel-probe.md"`). `git show ":$file"` scheitert daran, der Fehler wird von `2>/dev/null` verschluckt, `grep` bekommt leere Eingabe, `blocked` bleibt 0.
- **Zweimal unabhängig gemessen** (Bahn B im Wegwerf-Klon mit echtem Commit; Besitzer über den Index): JWT in einer Datei mit Umlaut im Namen → **Commit durchgelassen, Exit 0**.
- In einem Projekt mit durchgehend deutschen Dokumenten ist das kein Randfall. **Richtung:** `-z` bzw. `core.quotePath=false`.

#### BUG-42: Die Testhälfte des Wächters prüft den Arbeitsbaum, nicht das Vorgemerkte
- **Severity: Low**
- Die Geheimnis-Prüfung liest korrekt `git show ":$file"` — die Testhälfte ruft schlicht `npm test` und sieht damit die Platte. Gemessen: ungeschützte Server Action `git add`, danach von der Platte gelöscht → Index enthält sie, Arbeitsbaum nicht → `npm test` grün → **Commit durchgelassen**, die Datei ist im Commit.
- Trifft jedes teilweise Vormerken (`git add -p`) und hebt für die Testhälfte die Zusage auf, die der Hook im selben Atemzug erhebt: „Was committet würde, ist das, was zählt."

#### BUG-43: Binärdateien werden übersprungen — und der Build-Cache ist eine
- **Severity: Low**
- `grep -I` lässt Binärdateien aus; JWT in einer Datei mit NUL-Byte → durchgelassen. Im Hook-Kommentar als Absicht benannt, in T37 und `design.md` nicht.
- Die Relevanz steigt durch BUG-44: Der Turbopack-Build-Cache, der den echten Schlüsselwert enthält, ist genau so eine Datei.

#### BUG-44: Der Service-Role-Schlüssel liegt im Turbopack-Build-Cache, und die Belegzusage ist zu weit formuliert
- **Severity: Medium**
- **Die Sache selbst ist in Ordnung:** Kein Server-Geheimnis erreicht den Browser — ausgeloggt **und angemeldet** gemessen, mit positiver Kontrolle in beiden Zuständen und einer Marker-Gegenprobe (`NEXT_PUBLIC_QA_MARKER` → 1 Treffer in `.next/static`, `QA_SERVER_MARKER` in derselben Client-Komponente → 0). Damit ist auch belegt, dass der eigentliche Schutz die **Namenskonvention plus `server-only`** ist, nicht eine Textsuche.
- **Der Fund:** Über den **ganzen** Build-Ordner (235 Dateien) gesucht, liegen **2 Treffer** für den Schlüsselwert in `.next/cache/turbopack/…/00000003.sst` und `…/00000012.sst`. Ausgeliefert wird davon nichts, aber es ist ein Geheimnis im Ruhezustand in einem Build-Artefakt, das auf CI-Caches, in Docker-Schichten und in Deploy-Artefakte wandert.
- **Die Zusage in `features/PROJ-1-user-login/design.md`** sagt „Im gebauten Ordner: 17 Dateien unter `.next/static` und 49 unter `.next/server` durchsucht — kein Treffer". Sie benennt den Ordner und meint zwei Unterordner; genau in der Lücke dazwischen liegen die Treffer. Ebenso deckt die Leitungsmessung („17 ausgelieferte Antworten") nur den **ausgeloggten** Zustand ab — die Quiz-Chunks werden dabei nie ausgeliefert.

#### BUG-45: `/auth/confirm` ist ungedrosselt
- **Severity: Medium** · PROJ-1 AC-11/AC-12
- 30 Anfragen mit ungültigem `token_hash` → **30 × HTTP 307**, kein 429, keine Verzögerung. Der Zähler sitzt ausschließlich in den drei Server Actions; die Route-Handler-Einlösung ist nicht angebunden (`src/app/auth/confirm/route.ts:63-83`).
- `.claude/rules/security.md` nennt „magic link, OTP" ausdrücklich in derselben Aufzählung wie Login und Reset. Das Raten eines `token_hash` ist praktisch aussichtslos — die Lücke ist eine im Muster und ein kostenloser Lastvektor gegen den Auth-Server.

#### BUG-46: Zeitliches Orakel beim Login trotz identischer Meldung
- **Severity: Medium** · PROJ-1 AC-7
- 10 abwechselnde Messungen, jede von eigener IP: vorhandenes Konto mit falschem Passwort **Median 132 ms** (99–156), unbekannte Adresse **Median 85 ms** (68–88). **Die Wertebereiche überschneiden sich nicht.**
- Die Meldung ist identisch (AC-7 erfüllt), die Antwortzeit verrät trotzdem, ob ein Konto existiert. `.claude/rules/security.md` verlangt ausdrücklich auch „vergleichbare Antwortzeiten". Ursache liegt bei Supabase (Hashing nur bei existierendem Konto), die Wirkung ist hier messbar.

#### BUG-47: Massenregistrierung ist automatisierbar
- **Severity: Medium**
- **15 echte, sofort benutzbare Konten in 4,4 s**, je eigener `x-forwarded-for`, 0 gedrosselt; Gegenprobe: Login mit dem ersten → Weiterleitung auf `/`. Kein CAPTCHA (bewusste Entscheidung, AC-9 gestrichen).
- Auch **ohne** Header-Fälschung bleiben 5 Registrierungen/Minute pro IP = 7 200 Konten/Tag. Jedes belegt einen öffentlichen, unveränderlichen Trainernamen und darf Runden schreiben — **die Weltrangliste ist vor ihrem Bau schon flutbar** (PROJ-3).

#### BUG-48: Die Registrierung verrät, ob eine Adresse ein Konto hat
- **Severity: Medium** · **Vertragskonflikt, kein Baufehler**
- `registerAction` mit bereits registrierter Adresse → `{"fieldErrors":{"email":"Diese E-Mail-Adresse ist bereits registriert."}}`. Login und Passwort-Reset sind sauber neutral (gemessen) — die Registrierung ist die dritte Tür und steht offen.
- **PROJ-1 AC-3 verlangt diese Meldung wörtlich.** Die Auflösung gehört deshalb in ein `/refine PROJ-1`, nicht in einen Fix.

#### BUG-49: Eine wiederholte Runden-ID meldet Erfolg und Rekord, ohne etwas zu schreiben
- **Severity: Low**
- `saveRun {streak:7, …, clientRoundId:X}` → saved; danach `saveRun {streak:99, …, clientRoundId:X}` → `{"status":"saved","isPersonalBest":true}`, in der DB steht weiterhin **streak 7**.
- `run-actions.ts:96` schluckt den `23505`, `:99-102` berechnet `isPersonalBest` aus der **eingereichten** statt der gespeicherten Zeile. Der Client setzt daraufhin eine Bestleistung, die die Datenbank nicht kennt; nach einem Reload verschwindet sie. Mit dem echten Client nicht auslösbar (der Wiederholungsversuch aus EC-3 schickt identische Werte), deshalb Low.

#### BUG-50: Ein Ausfall der PokeAPI erzeugt bis zu 12 Anfragen pro Fragenversuch
- **Severity: Low**
- `question-action.ts:91` zieht bis zu dreimal, je 1 + 3 Namensabrufe; jeder Klick auf „Erneut versuchen" wiederholt das, und AC-17 macht das ausdrücklich unbegrenzt.
- Genau im Ausfallfall arbeitet das gegen die Fair-Use-Zusage, die AC-31 sonst überall einhält. Der Decision-Log-Satz „der Nutzer klickt selbst, es entsteht also keine automatische Last" unterschätzt den Faktor 12.

#### BUG-51: `profiles` gibt jedem Angemeldeten UUID und Anmeldezeitpunkt jedes Kontos heraus
- **Severity: Low**
- `select` als Nutzer B liefert `id`, `trainer_name`, `created_at` **aller** Profile (`0001_profiles.sql:22-25`, `using (true)`). `docs/data-model.md` sagt nur zu: „Der Trainername ist für alle angemeldeten Nutzer lesbar" — `id` und `created_at` stehen dort nicht.
- Für PROJ-3 unmittelbar relevant; eine spaltenbeschränkte View wäre das Gegenmittel.

#### BUG-52: `/_next/image` ist offen, und die Mengenzusage im Design stimmt nicht
- **Severity: Low**
- Sprite-Abruf **ohne Sitzung** → 200 `image/png`; 15 Breiten werden akzeptiert. Die Allowlist deckt den **ganzen** Teilbaum `sprites/pokemon/**` ab (`versions/generation-i/red-blue/1.png` → 200), nicht nur die 386 Artworks.
- `design.md` behauptet „Obergrenze 386 optimierte Bilder insgesamt"; real ist sie *Dateien im Teilbaum × 15 Breiten*, auslösbar von beliebigen Dritten ohne Konto. Relevant für `/deploy`, wenn Bild-Optimierung abgerechnet wird.

#### BUG-53: Ohne Proxy-Header fallen alle Spieler auf einen gemeinsamen Zähler
- **Severity: Low, aber Deploy-entscheidend**
- `clientIp()` fällt ohne `x-forwarded-for`/`x-real-ip` auf den festen Schlüssel `'unbekannt'` zurück (`src/lib/auth/throttle.ts:61-66`). Setzt der spätere Host keinen dieser Header, teilen sich **alle** Spieler einen Zähler mit 5 Versuchen pro Minute — der Schutz wird dann zur Aussperr-Waffe gegen die eigenen Nutzer.
- Aus dem Code belegt, nicht provoziert (das hätte die Parallel-Bahnen ausgesperrt).

#### Zusätzlich, ohne eigene BUG-Nummer
- **Zwei offene `[user]`-Aufgaben auf dem Zugangsdaten-Pfad — vom Skill als High geführt:** `T4` (Passwort-Mindestlänge im gehosteten Projekt; lokal verifiziert, gehostet nicht) und `T18` (Reset-Vorlage; ohne sie ist der geräteübergreifende Reset in Produktion kaputt). Beide stehen in `features/INDEX.md` als Deploy-Blocker und sind erst nach dem ersten Deploy bzw. nach eigenem SMTP setzbar. **`T34` ist dagegen abgehakt** und durch die funktionierende Drosselung belegt.
- **PROJ-1 AC-8 beschreibt weiterhin den Zustand vor BUG-29** („30 Versuche … durch Supabases eingebaute Rate-Limit-Regel"). Gebaut ist etwas anderes: 5/60 s pro IP plus 20/900 s pro Konto im Anwendungscode. Sache eines `/refine PROJ-1`, in INDEX bereits als BUG-21 vermerkt.
- **Schwache Passwörter werden angenommen** (`password`, 8 Zeichen) — bewusste Entscheidung, Leaked-Password-Schutz ist Paid-Feature. Zusammen mit 20/15 min ergibt das 1 920 gezielte Rateversuche pro Konto und Tag.

#### Bestätigt offen, unverändert
- **BUG-11 (Low, AC-25)** — keine Skelettfläche beim Rundenstart. Das einzige gefallene AC
- **BUG-12 (Medium)** — keiner der vier Security-Header, auch im Produktionsbuild nicht
- **BUG-18 (Medium)** — `X-Forwarded-Host` hebelt die Origin-Prüfung aus

#### Geschlossen in diesem Lauf
- **BUG-20** (Open Redirect) — sieben Varianten abgewiesen
- **BUG-22** (breites `remotePattern`) — `…/sprites/items/…` → 400
- **BUG-29/30/31** (Drosselung) — greift, sitzt in den Actions und ist per Pfad nicht umgehbar. **Aber:** die IP-Hälfte ist durch BUG-39 unterlaufbar
- **BUG-36** — siehe den eigenen Abschnitt oben: überwiegend, nicht vollständig

### Not Verified In This Run

- [!] **AC-24** — kein Viewport
- [!] **Alles Optische** — Grün/Rot (AC-4, AC-6), `nudge`, `pop`, Puls, `float`: Klassen und Keyframes sind belegt, die Darstellung nicht. Kein Browser
- [!] **AC-2, zweite Hälfte** — die Renderzeit bis zum gezeichneten Bild; gemessen ist die Serverseite (318–350 ms)
- [!] **AC-19** — dass der Browser den Verlassen-Dialog wirklich zeigt; belegt ist der registrierte Handler
- [!] **AC-20 als Netzwerk-Mitschnitt** einer echten Runde
- [!] **AC-15 / EC-8 mit real hängender bzw. 429/500 antwortender PokeAPI** — von hier nicht manipulierbar
- [!] **EC-1** — der echte Doppelklick; nur der Code-Riegel ist belegt
- [!] **Rate-Limit gewöhnlicher Endpunkte** — nicht implementiert (Backlog `B1`), bewusst
- [!] **Supabases eigenes IP-Limit (30/5 min)** — lokal nicht auslösbar
- [!] **T4 und T18 im gehosteten Projekt** — kein Dashboard-Zugang. Zu setzen unter *Authentication → Sign In / Providers → Email → Minimum password length* bzw. *Authentication → Email Templates → Reset Password*
- [!] **Security-Header und `X-Forwarded-Host` gegen die Live-URL** — es gibt noch keinen Host
- [!] **Verhalten von `x-forwarded-for` beim späteren Host** — entscheidet, ob der IP-Zähler etwas wert ist (BUG-53) und ob BUG-39 in Produktion schwerer oder leichter wiegt
- [!] **`X-Forwarded-Host`-CSRF in einer echten Proxy-Kette** — der Bypass ist gemessen, die Ausnutzbarkeit hinter einem konkreten CDN nicht
- [!] **Konto-Zähler-Grenze in der Regressionsbahn** — bewusst nicht ausgereizt; in Bahn B dann doch gemessen (ab dem 21. Versuch), damit belegt
- [!] **E2E gegen den Produktions-Build** — `playwright.config.ts:39` nutzt `reuseExistingServer`, die Suite lief gegen den Dev-Server. Der Produktionsbuild ist separat grün, von der E2E-Suite aber nicht berührt
- [!] **Datenfluss-Qualität der Sitzungsprüfungen** — dass jede Action `getUser()` *aufruft*, prüft der Wächter; dass das Ergebnis den Ablauf beendet, prüft niemand maschinell. Alle sechs Actions gelesen, jede mit frühem Rücksprung — Code-Review, keine Messung
- [!] **Cross-Browser über die drei E2E-Engines hinaus** und alles mit DevTools

### Verdikt

- **Acceptance Criteria:** 30 von 31 mit Beleg bestanden · **AC-25 FAIL** · AC-24 ohne Viewport nicht verifizierbar
- **Edge Cases:** 10 von 10 geltenden bestanden, EC-11 entfallen und der Code konsistent
- **Bugs:** 15 neu — **1 High** (BUG-39), **7 Medium** (BUG-40, BUG-41, BUG-44, BUG-45, BUG-46, BUG-47, BUG-48), **7 Low** (BUG-42, BUG-43, BUG-49, BUG-50, BUG-51, BUG-52, BUG-53) · bestätigt offen: BUG-11, BUG-12, BUG-18 · zusätzlich zwei offene `[user]`-Aufgaben auf dem Zugangsdaten-Pfad, vom Skill als High geführt
- **Security:** **9 Prüfungen mit Beleg bestanden** · **6 mit Befund** · **2 NOT VERIFIED**
- **Regression:** ohne Befund — 164/164, Lint und Build grün, E2E 27/27, PROJ-1 unverändert
- **Production Ready: NEIN**

> **Was dieser Lauf über die Arbeit des Tages sagt.** Alle drei Bauteile funktionieren — das ist gemessen, nicht angenommen: Die Drosselung greift in den Actions und ist per Pfad nicht umgehbar, die E2E-Suite läuft wieder vollständig **und** prüft die Drosselung jetzt ausdrücklich, der Wächter stoppt einen Commit mit ungeschützter Action wirklich. Was in allen drei Fällen fehlt, ist dasselbe: **die Grenze im selben Satz wie die Zusage.** Bei der Drosselung fehlt sie ganz (BUG-39 war nicht bedacht), beim Wächter steht sie zu breit (BUG-40), bei der Bundle-Gegenprobe suggeriert die Formulierung mehr Umfang als die Messung hatte (BUG-44). Ein Beleg, der weiter klingt, als er reicht, ist schlechter als kein Beleg — weil man aufhört hinzusehen.

---

## QA-Nachlauf — 2026-09-05, nach dem Fix für BUG-39

**Getestet:** 2026-09-05 · **App-URL:** `http://localhost:3000` · **Commit:** `8198a19` · **Tester:** QA Engineer (AI)

Gezielter Nachlauf mit zwei Bahnen, beide ohne Kenntnis der Sitzung, in der gebaut wurde. Bahn B2: den Angriff aus BUG-39 wirklich nachstellen und nach weiteren Umgehungswegen suchen. Bahn C2: Regression, mit besonderem Augenmerk darauf, ob der normale Nutzer schlechter dasteht.

### Das Ergebnis vorweg

- **BUG-39 ist geschlossen** — über den echten Server-Action-Pfad nachgestellt, nicht aus dem Code abgeleitet.
- **Fünf weitere Umgehungswege geprüft und ausgeschlossen.**
- **Der Fix hat eine Nebenwirkung, die vorher nicht da war: BUG-54 (Medium).** Hinter einer geteilten Adresse teilen sich jetzt **alle** Nutzer ein Budget von 5 Anmeldungen pro Minute — auch die mit richtigem Passwort.
- Regression sonst ohne Befund: 165/165, Lint grün, Build grün, E2E **zweimal hintereinander** 30/30.
- **Production Ready: NEIN** — PROJ-2 bleibt **In Review**.

### BUG-39 — geschlossen, mit Zahlen

Bahn B2 hat `loginAction` direkt über HTTP angesprochen, mit **fester** gefälschter Herkunft, und den ursprünglichen Angriff als Schleife nachgestellt: drei Zyklen à „vier Fehlversuche gegen fremde Konten + ein erfolgreicher Login mit dem eigenen Konto".

| Versuch | Was | Ergebnis |
|---|---|---|
| 1–4 | fremdes Konto, falsches Passwort | durchgelassen |
| 5 | **eigenes** Konto, richtiges Passwort | Erfolg — **und die IP-Bremse bleibt gesetzt** |
| 6–15 | weitere Versuche, auch erfolgreiche Eigen-Logins | **durchweg abgewiesen** |

**15 Versuche, ab dem sechsten abgewiesen, über drei Zyklen, null durchgelassen.** Vor dem Fix lief Versuch 6 wieder durch und die Schleife war beliebig oft wiederholbar — die ursprüngliche Messung lautete 24 von 24 durchgelassen.

**Fünf andere Wege zum selben Zähler, geprüft und ausgeschlossen:**

| Weg | Ergebnis | Beleg |
|---|---|---|
| Erfolgreiche **Registrierung** als Reset | ausgeschlossen — eigener Scope `register:ip`, ruft `clearAttempts` nicht auf | `throttle.ts:101/103` |
| **Passwort-Reset** | ausgeschlossen — Scope `password-reset:ip`, kein `clearAttempts`, prüft kein Passwort | `actions.ts:126` |
| **Abmelden** | ausgeschlossen — rührt keinen Zähler an | `actions.ts:108` |
| **Schreibweise** der Adresse | ausgeschlossen — IP-Zähler ist adress-unabhängig, Konto-Schlüssel wird kleingeschrieben | `throttle.ts:70` |
| Einen Zähler durch **Überlauf des anderen** entlasten | ausgeschlossen — beide werden immer gezählt, erlaubt nur wenn beide unter Limit | `throttle.ts:103-109` |

Zusätzlich bestätigt: `clearAttempts` hat genau **einen** Aufrufer im ganzen Projekt.

**Die Zusagen sind durch den Code gedeckt.** Bahn B2 hat ausdrücklich geprüft, ob die Begründung in `design.md` wieder weiter reicht als die Implementierung — das Muster, das hier schon dreimal aufgetreten ist (BUG-20, BUG-32, BUG-40). Urteil: „die Zusage ist enger als der beobachtete Effekt, nicht umgekehrt". Auch der Abnahmetest hält der Prüfung stand: Er würde den alten Fehlermodus fangen und lässt sich in dieser Form nicht täuschen.

### Was der Fix **nicht** löst, und das gehört in denselben Satz

**Passwort-Spraying mit rotierender Herkunft funktioniert unverändert:** 30 Versuche, ein Passwort gegen 30 Konten, je eigene gefälschte `x-forwarded-for` — **30 durchgelassen, 0 abgewiesen.** Der Konto-Zähler greift hier grundsätzlich nicht (jedes Opferkonto bekommt genau einen Versuch), und der IP-Zähler lässt sich mit einem selbstgesetzten Header umgehen.

Das ist **kein neuer Befund** — es steht in `throttle.ts:48-58` und in `design.md` unter „Was die IP-Hälfte wert ist, ehrlich gesagt" und ist als Deploy-Blocker geführt. Aber die Einordnung gehört klar gesagt: **Der Fix stellt die Integrität des IP-Zählers nur für den Fall einer vertrauenswürdigen Herkunft wieder her.** Ob sie vertrauenswürdig ist, entscheidet erst der Host beim `/deploy`. Vorher ist der Spraying-Schutz nicht wirksam.

### BUG-54: Hinter einer geteilten Adresse teilen sich alle Nutzer 5 Anmeldungen pro Minute

- **Severity: Medium** · **Nebenwirkung des BUG-39-Fixes** · PROJ-1 AC-8
- Der IP-Zähler wird **vor** der Passwortprüfung hochgezählt (`actions.ts:84`), ein erfolgreicher Login verbraucht also ein Budget — und seit dem Fix wird nichts davon zurückgegeben. Drei Messungen von Bahn C2, jede mit eigener Herkunft:

| Szenario | Ergebnis |
|---|---|
| **Acht verschiedene Spieler**, alle mit **richtigem** Passwort, hinter einer Adresse | **5 kommen hinein, 3 werden abgewiesen** |
| Zwei Konten im Wechsel, beide mit richtigem Passwort | ab dem 6. Login abgewiesen |
| Anmelden/Abmelden im Zyklus | 5 Zyklen, der 6. abgewiesen |

- **Was daran neu ist:** Vor dem Fix löschte jeder erfolgreiche Login den IP-Zähler mit — für legitime Nutzer war die Grenze damit praktisch nie spürbar. Genau diese Nebenwirkung war der Bug; ihr Wegfall ist die Nebenwirkung des Fixes.
- **Warum das mehr ist als eine Fußnote:** Die Zielgruppe im PRD schließt Kinder ausdrücklich ein, also Familien- und Schulanschlüsse. Dazu kommt Mobilfunk-CGNAT, wo sich sehr viele Anschlüsse eine öffentliche Adresse teilen. Diese Nutzer sehen „Zu viele Versuche von dieser Verbindung", ohne dass irgendjemand etwas falsch gemacht hat.
- **Warum Medium und nicht High:** Es heilt nach 60 Sekunden von selbst aus — nachgemessen, und die Fenster-Semantik ist geprüft: `window_started_at` wird nur beim Ablaufen neu gesetzt (`0003_auth_throttle.sql:62-71`), weiteres Hämmern verlängert die Sperre also **nicht**. Ein Workaround existiert (warten, erneut versuchen).
- **`throttle.ts:132-137` benennt diesen Preis** — aber ohne Zahl. Die Zahl ist 5 Anmeldungen pro Minute für **alle** Nutzer eines Anschlusses zusammen, und mit ihr liest sich die Entscheidung anders als ohne.
- **Naheliegende Richtung** (nicht umgesetzt, `/qa` baut nicht): Auf dem IP-Zähler **nur Fehlversuche** zählen, statt jeden Versuch. Dann verbraucht ein erfolgreicher Login kein Budget — legitime Nutzer hinter einer geteilten Adresse laufen nie in die Sperre —, und der Angreifer bekommt trotzdem nichts zurück, weil kein Zähler zurückgesetzt wird. Das löst BUG-39 und BUG-54 zugleich. Zu beachten ist dabei die Atomarität: Der heutige Aufbau zählt und prüft in **einem** Statement (genau deshalb hält er unter Gleichzeitigkeit); eine Umstellung muss diese Eigenschaft behalten.

### Regression (Bahn C2) — sonst ohne Befund

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **165/165 grün**, 17 Dateien, 3,61 s |
| `npm run lint` | grün |
| `npm run build` | grün, 6/6 Seiten, 5 Routen |
| `npx playwright test` — **Lauf 1** | **30/30 grün**, 41,3 s |
| `npx playwright test` — **Lauf 2**, 5 s später | **30/30 grün**, 40,5 s |

Der zweite Lauf startete **mitten im 60-Sekunden-Fenster** des IP-Zählers — genau der Fall, in dem sich die Suite vorher selbst ausgesperrt hätte. Die Kennung je Lauf in `tests/fixtures.ts` trägt.

Kernabläufe einzeln bestätigt: Registrierung, Anmeldung, Abmeldung (5 Zyklen sauber), Zugangsschutz (auch mit untergeschobenem Cookie → 307), Passwort-Reset über einen **echt zugestellten** Mail-Link (in Mailpit gegengeprüft), und eine vollständige Quiz-Runde bis zum gespeicherten Ergebnis samt Bestleistung.

### Not Verified In This Run

- [!] **Verhalten hinter einem echten Reverse Proxy** — lokal steht keiner davor; alle Herkunfts-Messungen beruhen auf selbst gesetzten Headern. Ob der Host clientseitige Werte verwirft, entscheidet, ob der IP-Zähler überhaupt etwas wert ist (und damit, ob BUG-54 in Produktion schwerer oder leichter wiegt)
- [!] **Der Vorher-Zustand wurde von Bahn C2 nicht durch Rückbau nachgemessen** — sie darf den Repository-Zustand nicht ändern und stützt sich auf den Diff. Die Rot-Probe gegen den alten Code liegt aus dem Build vor und fiel an der erwarteten Zusage
- [!] **Der Playwright-Abnahmetest wurde von Bahn B2 gelesen, nicht ausgeführt** — kein Browser in ihrem Lauf; sie hat den Mechanismus stattdessen direkt über HTTP nachgestellt. Ausgeführt wurde er von Bahn C2, zweimal, in drei Engines
- [!] **Visuelle Regression** — es gibt keine Screenshot-Baselines im Repository
- [!] **Gehostetes Projekt und Produktions-Mailversand** — geprüft wurde ausschließlich gegen den lokalen Stack
- [!] Alles Browser-Abhängige über die drei E2E-Engines hinaus

### Kleinere Beobachtungen

- `throttle.ts:10-11` nennt `/privacy` als Route, unter der `loginAction` erreichbar sei — die Seite gehört zu PROJ-4 und liefert heute 404. Kosmetisch, aber beim nächsten Sicherheitsdurchgang irreführend.
- Jeder `npm test`-Lauf gibt eine Vite-Warnung aus (ESM-Syntax in `vitest.config.ts`, als CommonJS geladen) — wird in einer künftigen Vite-Hauptversion zum Fehler. Low.

### Verdikt

- **BUG-39: geschlossen**, mit nachgestelltem Angriff belegt, fünf weitere Umgehungswege ausgeschlossen
- **Neu: BUG-54 (Medium)** — Nebenwirkung desselben Fixes, trifft legitime Nutzer hinter geteilten Anschlüssen
- **Regression: ohne Befund** — 165/165, Lint, Build, E2E 2× 30/30
- Offen aus dem vorigen Lauf: BUG-40, BUG-41, BUG-44 bis BUG-48 (Medium), BUG-11, BUG-12, BUG-18, BUG-42, BUG-43, BUG-49 bis BUG-53 (Low), dazu die beiden offenen `[user]`-Aufgaben auf dem Zugangsdaten-Pfad
- **Production Ready: NEIN** · **PROJ-2 bleibt In Review**

> **Die Lehre aus diesem Nachlauf.** Der Fix ist richtig und belegt — und er hat, wie jede Verschärfung einer Drosselung, jemanden getroffen, der nicht gemeint war. Bemerkenswert ist nicht, dass es passiert ist, sondern **dass es im Design bereits stand und trotzdem niemandem auffiel**: Der Preis war benannt, aber nicht beziffert. „Hinter einer geteilten Adresse zählen die Fehlversuche des einen weiter" liest sich harmlos; „fünf Anmeldungen pro Minute für alle Nutzer eines Schulanschlusses zusammen" liest sich anders. Eine Grenze ohne Zahl ist eine Grenze, die niemand prüft.

---

## QA-Nachlauf — 2026-09-05, nach dem Fix für BUG-54 (Erstattung auf dem IP-Zähler)

**Getestet:** 2026-09-05 · **App-URL:** `http://localhost:3000` · **Commit:** `b846111` · **Tester:** QA Engineer (AI)

Zwei Bahnen mit getrennten Bereichen, beide ohne Kenntnis der Sitzung, in der gebaut wurde. Bahn B3: den Erstattungs-Mechanismus angreifen. Bahn C3: den NAT-Fall gegenmessen und Regression fahren.

### Das Ergebnis vorweg

- **BUG-54 ist geschlossen** — mit Zahlen gegengemessen, nicht abgeleitet.
- **BUG-39 bleibt geschlossen** — über 20 Angriffszyklen erneut bestätigt.
- **Der Erstattungs-Mechanismus hält gegen sechs Angriffswinkel** — kein Guthaben aufbaubar, keine Erstattung von außen auslösbar, Gleichzeitigkeit intakt.
- **Zwei neue Medium-Befunde**, beide *nicht* Rückfälle: BUG-55 (der NAT-Fall **mit Tippfehlern**, den die Zusage nicht abdeckt) und BUG-56 (die Zählertabelle wächst unbegrenzt und speichert E-Mail-Adressen unbefristet).
- Regression ohne Befund: 166/166, Lint grün, Build grün, E2E **zweimal hintereinander** je 33/33.
- **Production Ready: NEIN** — PROJ-2 bleibt **In Review**.

### BUG-54 — geschlossen, mit Zahlen

| Messung | Vorher | Jetzt |
|---|---|---|
| **Acht verschiedene Spieler**, richtiges Passwort, **eine** Adresse | 5 von 8 kamen hinein | **8 von 8** (2497 ms) |
| Anmelden/Abmelden im Zyklus, eine Adresse | ab dem 6. abgewiesen | **25 von 25**, keine einzige Abweisung |
| Vier Tippfehler, dann richtig | kam hinein | kommt hinein |
| Fünf Tippfehler, dann richtig | abgewiesen | abgewiesen — Grenze unverändert, heilt nach 63 s aus |

25 Zyklen liegen über **beiden** Limits (IP 5/60 s, Konto 20/900 s). Dass sie durchlaufen, belegt beides zusammen: Der Konto-Zähler wird bei Erfolg geleert, der IP-Zähler erstattet.

**Und die Bremse ist noch da — dreimal gegengemessen:**

- Direkt nach den acht Erfolgen, gleiche Adresse, gleiches Fenster: Fehlversuche 1–5 kommen bis zur Passwortprüfung, **der sechste wird abgewiesen**.
- Direkt nach den 25 Zyklen: identisch.
- **Gegenprobe auf BUG-39:** 20 Runden „eigener erfolgreicher Login, dann ein Rateversuch gegen ein fremdes Konto" von einer Adresse → **exakt 5 Rateversuche kamen durch**; ab Runde 6 sind eigener Login *und* Rateversuch gesperrt. Der eigene Login bringt **keinen** zusätzlichen Rateversuch.

Vorbedingung nicht angenommen, sondern geprüft: Registrierungs- und Login-Zähler sind getrennt — 5 Registrierungen von einer Adresse, dann der 6. abgewiesen, und **direkt danach im selben Fenster 5 von 5 Logins erfolgreich**.

### Der Angriff auf die Erstattung (Bahn B3) — sechs Winkel, kein Durchkommen

| Angriff | Ergebnis | Beleg |
|---|---|---|
| **Guthaben aufbauen** — mehr erstatten als hochgezählt | **nein** — 10 erfolgreiche Logins auf leerem Zähler → Zähler bleibt 0, nie negativ | `greatest(attempts - 1, 0)`, `0004:48` |
| **Zähler unter 0 parken** über einen Fensterwechsel | **nein** — zwei Timing-Strategien, 4 Adressen, nie unter den echten Fehlversuchsstand | Messreihe 192.0.2.240/80/81/90/91 |
| **Zusätzliche Rateversuche** durch eigene Logins | **nein** — 30 Zyklen Erfolg→Fehlversuch in *einem* Fenster: genau **5** Fehlversuche durch | seriell und im Straddle gemessen |
| **Erstattung von außen auslösen** | **nein** — `anon` und `authenticated` bekommen `permission denied`; über die REST-API mit dem Browser-Schlüssel **HTTP 401 / 42501** | Grants: `service_role = true`, sonst `false` |
| **Erstattung auf Register/Reset** | **nein** — `login:ip` bleibt unverändert nach erfolgreicher Registrierung *und* nach erfolgreichem Reset; 8 Registrierungen von einer Adresse → ab der 6. abgewiesen, kein Refund | `settleSuccessfulLogin` nimmt keinen `scope` |
| **Gleichzeitigkeit beschädigt** | **nein** — 40 parallele Anfragen (20 Fehlversuche + 20 Erfolge): nur 3 Fehlversuche und 2 Erfolge durch, kein „alle sehen 0"-Durchbruch | Zählen+Prüfen bleibt atomar in `0003` |

Bahn B3 hat außerdem ausdrücklich geprüft, ob die Begründung wieder weiter reicht als der Code — das Muster, das hier viermal aufgetreten ist (BUG-20, BUG-32, BUG-40, und der Preis in BUG-39/54). Urteil: **„Die Begründung ist diesmal nicht zu breit"** — die textliche Zusage deckt sich mit dem gemessenen Verhalten.

Eine theoretische ±1-Mikrorace bleibt benannt: `refund_auth_attempt` prüft das Fenster nicht, eine Erstattung könnte nach einem Fensterwechsel einen echten Fehlversuch „vergessen". Über mehrere Timing-Strategien und vier Adressen **nicht in einen zusätzlichen Rateversuch umwandelbar** — die Erstattung ist auf −1 je Erfolg begrenzt, und für jeden Erfolg wurde vorher ein Slot verbraucht. Kein Befund, aber im Bericht, damit es niemand neu entdecken muss.

### BUG-55: Der NAT-Fall **mit Tippfehlern** — 4 von 8 kommen hinein

- **Severity: Medium** · PROJ-1 AC-8 · **kein Rückfall in BUG-54**
- Acht verschiedene Spieler hinter **einer** geteilten Adresse, jeder vertippt sich **einmal** und gibt dann das richtige Passwort ein:

```
Spieler 1–4: Tippfehler → falsch, danach richtig → angemeldet
Spieler 5:   Tippfehler → falsch, danach richtig → ABGEWIESEN
Spieler 6–8: schon der Tippfehler → ABGEWIESEN, danach ebenso
ERGEBNIS: 4 von 8 kamen hinein.
```

- **Warum das kein Rückfall ist:** Die Zusage „ein geglückter Login erstattet seinen eigenen Versuch" hält — die Messungen oben belegen sie. Dies ist der **Rest, den die Zusage nicht abdeckt**: Fehlversuche werden weiterhin pro Adresse gezählt, und **fünf Tippfehler pro Minute gelten für den ganzen Schulanschluss zusammen**. Ab dem fünften ist die Verbindung für alle dicht — auch für die, die richtig tippen.
- **Warum es trotzdem zählt:** Genau die Zielgruppe, die der BUG-54-Nachtrag als Grund nennt — Familien- und Schulanschlüsse, CGNAT, Kinder laut PRD —, vertippt sich. Ein Haushalt ohne Tippfehler ist die optimistische Annahme; der Nachtrag misst nur diesen Fall.
- **Das ist dieselbe Lücke wie beim letzten Mal, eine Ebene tiefer.** In `design.md` steht im selben Abschnitt der Satz „Eine Grenze ohne Zahl ist eine Grenze, die niemand prüft" — und der Fall mit Tippfehlern ist dort nirgends beziffert.
- **Richtungen** (nicht umgesetzt, `/qa` baut nicht): den IP-Grenzwert anheben und dafür den Konto-Zähler enger stellen; oder Fehlversuche pro Adresse **und Konto** kombiniert bewerten, statt die Adresse allein zu bestrafen. Beides berührt die Abwägung aus `design.md` und gehört entschieden, nicht beiläufig geändert.

### BUG-56: Die Zählertabelle wächst unbegrenzt — und speichert E-Mail-Adressen unbefristet

- **Severity: Medium** · trifft `docs/privacy.md` und PROJ-4
- `public.auth_throttle`: **1433 Zeilen**, älteste vom selben Tag 08:46. **Nichts löscht abgelaufene Fenster.** `clear_auth_attempts` wird ausschließlich für den Konto-Schlüssel nach erfolgreichem Login gerufen; einen Aufräum-Job, Cron oder TTL gibt es weder in `supabase/` noch in `src/`.
- **Ein zugesagter Mechanismus ohne Code:** Der Index `auth_throttle_window_idx` trägt in `0003_auth_throttle.sql:23-24` den Kommentar **„Für das Aufräumen alter Fenster"** — das Aufräumen, für das er da ist, existiert nicht. Dasselbe Muster wie BUG-36, nur in der Datenbank.
- **Die datenschutzrechtliche Hälfte wiegt schwerer als die Größe.** Der Schlüssel lautet `login:account:<e-mail-adresse>`. Die Tabelle ist damit ein **unbefristeter Speicher der Adressen aller, die sich je vertippt haben** — in einem Projekt mit `law: gdpr`, dessen Datenmodell ausdrücklich festhält, die E-Mail bleibe beim Auth-System. Und die Kontolöschung aus PROJ-4 würde diese Zeilen nicht mitnehmen: Sie hängen an keinem Fremdschlüssel.
- Der Speicherbedarf allein wäre unkritisch; die Aufbewahrung ist es nicht.

### BUG-57: Ein bekanntes Konto lässt sich mit 20 Anfragen je 15 Minuten aussperren

- **Severity: Low** · **bewusste Entscheidung, jetzt beziffert**
- Gemessen: 20 Fehlversuche gegen **ein** Konto von **20 verschiedenen** Adressen — alle 20 kommen durch, keiner gedrosselt. Danach der rechtmäßige Besitzer mit **richtigem** Passwort von einer unbelasteten 21. Adresse: **abgewiesen**, 15 Minuten lang.
- Kein neuer Fehler: `design.md` benennt den Preis („ein hartnäckiger Angreifer kann ein bekanntes Konto weiterhin phasenweise blockieren"). Neu ist die Zahl — **20 Anfragen pro 15 Minuten genügen**, um jemanden dauerhaft draußen zu halten, und das kostet einen Angreifer praktisch nichts.
- Gehört in dieselbe Entscheidung wie BUG-55: Beide hängen an der Verteilung der Grenzwerte zwischen IP- und Konto-Zähler.

### BUG-58: Fehlerhaft geformte Action-Daten ergeben HTTP 500 statt einer sauberen Absage

- **Severity: Low**
- Ein `Next-Action`-Aufruf ohne das erwartete Argumentgerüst antwortet gelegentlich mit **HTTP 500 „Connection closed."** statt der sauberen Fehlerantwort. Aus dem Browser vermutlich nicht auslösbar — der Client serialisiert korrekt —, nur beim manuellen Nachbau des Protokolls gesehen.
- Notiert, weil frühere Läufe dieses Projekts „Eingabevalidierung ohne einen einzigen 500er" ausdrücklich als bestandene Prüfung geführt haben. Diese Aussage gilt für die Feldinhalte, nicht für das Transportformat.

### Regression (Bahn C3) — ohne Befund

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **166/166 grün**, 17 Dateien, 3,72 s |
| `npm run lint` | grün, Exit 0 |
| `npm run build` | grün, Next.js 16.3.3, 5 Routen + Proxy |
| `npx playwright test` — **Lauf 1** | **33/33 grün**, 50,8 s, kein Retry |
| `npx playwright test` — **Lauf 2**, unmittelbar danach | **33/33 grün**, 49,5 s |
| `npx vitest run src/lib/auth/throttle.test.ts` (Bahn B3, unabhängig) | 13/13 grün |

Kernabläufe abgedeckt und **zweimal** gefahren: Registrierung, Anmeldung, Abmeldung, Zugangsschutz, Passwort-Reset über den echten Mail-Link inklusive Zweitgerät, gespielte Quiz-Runde bis zum gespeicherten Ergebnis. Unabhängig gegengeprüft: `GET /` ohne Sitzung → 307 auf `/login`; in der Datenbank stehen 421 `runs`-Zeilen mit frischem Zeitstempel — die Runden der E2E-Läufe sind wirklich persistiert.

**Migration `0004`:** lokal angewandt (`supabase migration list` zeigt alle vier), `refund_auth_attempt` vorhanden, Rechte korrekt (`service_role` ja, `anon`/`authenticated` nein). Die Migrationskette wurde in einer **frischen Wegwerf-Datenbank** der Reihe nach eingespielt — alle vier ohne Fehler.

### Keine neuen Unit-Tests in diesem Lauf — mit Begründung

Step 6 verlangt, isolierte Logik zu prüfen und zu testen. Ich habe das getan und **nichts Ungedecktes gefunden**: Der Erstattungspfad ist in `src/lib/auth/throttle.test.ts` positiv *und* negativ festgehalten (genau eine Erstattung; der IP-Schlüssel darf nie im Löschaufruf auftauchen), das Szenario in drei zusammengehörigen Playwright-Tests. Die Untergrenze `greatest(…, 0)` ist SQL und wurde von Bahn B3 empirisch gegen die laufende Datenbank geprüft.

**Für BUG-55 habe ich bewusst keinen Test geschrieben:** Er würde das heutige, unerwünschte Verhalten festschreiben, bevor entschieden ist, wie die Grenzwerte verteilt werden. Ein Test, der einen offenen Befund zementiert, macht die spätere Korrektur teurer statt sicherer.

### Not Verified In This Run

- [!] **`supabase db reset`** — nicht ausgeführt, weil zerstörend (1125 `profiles`, 421 `runs`, dazu der Mailpit-Zustand, auf dem die Reset-Journey aufsetzt). Ersatzweise die Kette in einer Wegwerf-Datenbank durchgespielt; ein echter Reset samt Supabase-Seed und Rollen-Setup steht aus
- [!] **Die Playwright-Rot-Proben selbst ausgeführt von Bahn B3** — kein Browser in ihrem Lauf; sie hat den inhaltlichen Kern stattdessen unabhängig über HTTP und die Datenbank nachgemessen. Ausgeführt wurden sie von Bahn C3, zweimal, in drei Engines
- [!] **Verhalten gegen das gehostete Projekt** — alle Zahlen stammen vom lokalen Stack
- [!] **Ob `x-forwarded-for` in Produktion trägt** — die gesamte NAT-Messung setzt den Header selbst, was lokal geht, weil kein Reverse Proxy davorsteht. Ob der Host clientseitige Werte verwirft, entscheidet, ob der IP-Zähler überhaupt etwas wert ist (dieselbe Hausaufgabe wie BUG-18 und BUG-53)
- [!] **Visuelle Regression und responsives Rendern** — keine Baselines; die E2E-Suite prüft Verhalten, nicht Aussehen
- [!] **Features mit Status „Deployed"** — es gibt keine; ersatzweise die Kernabläufe von PROJ-1 und PROJ-2
- [!] **Sauberkeit der Messumgebung:** Beide Bahnen liefen gleichzeitig gegen **dieselbe** App und Datenbank. Bahn C3 hat fremde Zählerzeilen bemerkt und darauf mit disjunkten Adressbereichen reagiert; ihre Zahlen sind davon unberührt. Für die beiden E2E-Läufe lässt sich eine Überschneidung nicht ausschließen — beide waren vollständig grün, ein falsch-grüner Effekt ist hier aber nicht konstruierbar, weil Kontention nur zu *mehr* Abweisungen führen würde

### Weiterhin offen, unverändert

- **BUG-40, BUG-41** (Hook-Lücken) — **auf Wunsch des Nutzers zurückgestellt**, Begründung: geringes Risiko, solange nur eine Person am Repository arbeitet. Das ist eine tragfähige Einordnung, solange sie stimmt; ändert sich das, ändert sich die Bewertung
- **BUG-11, BUG-12, BUG-18, BUG-42 bis BUG-53** — unverändert
- **Zwei offene `[user]`-Aufgaben auf dem Zugangsdaten-Pfad** (T4, T18) — vom Skill als **High** geführt, erst nach dem ersten Deploy bzw. mit eigenem SMTP setzbar. Der lokale Spiegel der Passwort-Mindestlänge ist gesetzt und bestätigt
- **PROJ-1 `spec.md` beschreibt weiterhin eine andere Drosselung als der Code** — AC-8 nennt Supabases eingebaute Regel und hält fest, es gebe „keine eigene kontobezogene Drosselung". Gebaut ist das Gegenteil. Der Vertrag, den `/deploy` liest, beschreibt nicht mehr die Realität; gehört in ein `/refine PROJ-1` (in INDEX als BUG-21 geführt)

### Verdikt

- **BUG-54: geschlossen** — 8 von 8 und 25 von 25 gegengemessen, die Bremse dreimal gegengeprüft
- **BUG-39: bleibt geschlossen** — 20 Angriffszyklen, exakt 5 Rateversuche
- **Der Erstattungs-Mechanismus: hält** — sechs Angriffswinkel, kein Durchkommen, keine neuen Befunde aus der Angriffsbahn
- **Bugs:** 4 neu — **2 Medium** (BUG-55, BUG-56), **2 Low** (BUG-57, BUG-58) · keiner davon ein Rückfall
- **Security:** 6 Prüfungen mit Beleg bestanden · 0 mit Befund in der Angriffsbahn · 2 NOT VERIFIED (Produktions-Proxy, gehostetes Projekt)
- **Regression:** ohne Befund — 166/166, Lint, Build, E2E 2× 33/33
- **Production Ready: NEIN** · **PROJ-2 bleibt In Review**

> **Was dieser Durchgang zeigt.** Der Fix ist gut und hält auch dem gezielten Angriff stand — das ist das erste Mal in dieser Serie, dass eine Angriffsbahn mit „keine neuen Befunde" zurückkommt. Und trotzdem steht wieder ein Befund an derselben Stelle: BUG-55 ist nicht der Fehler, der behoben wurde, sondern **der Fall daneben, den die Messung nicht abgedeckt hat**. Bei BUG-39 war es der geteilte Anschluss, bei BUG-54 der Anschluss mit Tippfehlern. Die Lehre ist nicht „schlechter fixen", sondern: Wer eine Grenze verschiebt, muss sie für die **unbequemste realistische Nutzung** durchrechnen, nicht für die glatte. Beim IP-Zähler ist die unbequeme Nutzung ein Schulanschluss am Montagmorgen.

---

## QA-Lauf — 2026-09-05 (finaler Sweep), nach BUG-56

**Getestet:** 2026-09-05 · **App-URL:** `http://localhost:3000` (`probe.kind: http`) · **Commit:** `dc71557` · **Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Lauf verifiziert (Beleg Pflicht) · `[ ] BUG` als kaputt verifiziert · `[!]` in diesem Lauf nicht prüfbar (Grund Pflicht)

Vollständiger Sweep mit drei Bahnen, getrennte Bereiche, keine kannte die Sitzung, in der gebaut wurde. Ausdrückliche Vorgabe an alle drei: **„hat letztes Mal bestanden" gilt nicht als Beleg** — jede Prüfung neu.

### Das Ergebnis vorweg

- **30 von 31 AC bestanden**, AC-25 FAIL (unverändert BUG-11, Low), AC-24 ohne Viewport nicht verifizierbar.
- **10 von 10 geltenden EC bestanden**, EC-11 spec-konform entfallen.
- **BUG-56 ist geschlossen** — beide Mechanismen unabhängig nachgemessen.
- **Regression ohne Befund:** 166/166, Lint, Build, E2E **zweimal hintereinander** je 33/33.
- **Ein neuer High: BUG-61.** Die IP-Hälfte der Drosselung ist mit einem selbst gesetzten Header abschaltbar — **40 Rateversuche gegen 40 Konten in 5 Sekunden, null abgewiesen**, dazu 25 Konten in 9 Sekunden.
- **Production Ready: NEIN** · **PROJ-2 bleibt In Review.**

> **Das Ziel dieses Laufs war „Approved". Er erreicht es nicht, und der Grund ist keine Formalie.** Die Substanz von BUG-61 war bekannt und in `throttle.ts` und `design.md` ehrlich benannt — als etwas, das der Host beim Deploy löst. Neu und entscheidend ist, was diese Bahn dazu gemessen und nachgeschlagen hat: Der Deploy-Blocker in `features/INDEX.md` deckt **nur die eine Richtung** ab (Host setzt gar keinen Header), nicht die häufigere (Host **hängt an** einen vom Client mitgebrachten Wert, wie es ein gewöhnlicher nginx-Aufbau tut — dann bleibt der erste Eintrag angreiferkontrolliert). Und im Code gibt es keine Behandlung vertrauenswürdiger Proxys. Ohne CAPTCHA — bewusst nicht vorhanden — ist der IP-Zähler die einzige Bremse gegen Passwort-Spraying, und sie lässt sich mit einer Kopfzeile ausschalten.

### BUG-56 — geschlossen, beide Mechanismen belegt

| Zusage | Ergebnis | Beleg |
|---|---|---|
| Abgelaufene Fenster werden laufend entfernt | **bestätigt** | Ausgangslage 976 Zeilen, **0 älter als eine Stunde**. Gezielt: drei Probezeilen (3 h / 30 min / 2 min), nach **einem** Login-Versuch war die 3-h-Zeile weg, die anderen standen |
| Konto-Schlüssel verschwinden mit dem Konto | **bestätigt** | Konto mit sechs Zeilen angelegt; nach `DELETE /auth/v1/admin/users/<uid>` alle **drei** Konto-Schlüssel weg, alle **drei** IP-Schlüssel unverändert. `profiles` und `runs` ebenfalls leer → **AC-26 hält** |
| Der Aufräumer löscht **nicht zu viel** | **bestätigt** | Die 30-Minuten-Zeile trägt formal noch eine Entscheidung und wurde **nicht** gelöscht |
| Von außen auslösbar? | **nein** | `prune_auth_throttle` für `anon` 401, für `authenticated` 403 |
| Öffnet die Kontolöschung eine Umgehung? | **nein** | Wegwerf-Konto registriert, 7 Rateversuche (ab 6 gesperrt), Konto gelöscht → Versuche 8 und 9 **weiterhin gesperrt**, Zähler unverändert bei 9 |

Bahn C hat dasselbe unabhängig in einer Wegwerf-Datenbank nachgestellt und die Migrationskette `0001`–`0005` vollständig durchlaufen lassen.

### BUG-61: `x-forwarded-for` ist frei fälschbar — Passwort-Spraying und Massenregistrierung ungebremst

- **Severity: High** · PROJ-1 AC-8, EC-4 · `.claude/rules/security.md` → Authentication
- `clientIp()` nimmt ungeprüft den **ersten** Eintrag aus `x-forwarded-for` (`src/lib/auth/throttle.ts:60-66`). Lokal kommt der Header direkt vom Client.
- **Gemessen:**
  - **Passwort-Spraying:** 40 Login-Versuche gegen **40 verschiedene Konten**, je eigene gefälschte Herkunft → **40 durchgelassen, 0 gedrosselt, in 5 Sekunden.** Der Konto-Zähler sieht je Konto einen Versuch, der IP-Zähler je Adresse einen — **keiner der beiden greift.**
  - **Massenregistrierung:** **25 Konten in 9 Sekunden.** Von einer unmanipulierten Adresse: 5 pro Minute.
  - Gegenprobe ohne Header: Der Zähler greift korrekt (`login:ip:::1` = 7 nach 7 Versuchen).
- **Warum das trotz bekannter Dokumentation ein High ist:**
  1. Der Skill führt unbegrenztes Raten auf einem Login ausdrücklich als High. Für einen Angreifer mit rotierendem Header ist das Raten hier unbegrenzt.
  2. **Der Deploy-Blocker deckt es nicht ab.** `features/INDEX.md` nennt bei BUG-53 nur den Fall „Host setzt **keinen** Header" (alle fallen auf `unbekannt`). Der häufigere Fall — der Host **hängt an**, statt zu überschreiben — steht nirgends. Ein Plan, der die halbe Bedingung nennt, wird zur halben Prüfung.
  3. **Es gibt keine Code-Ebene dagegen:** keine Behandlung vertrauenswürdiger Proxys, kein CAPTCHA (bewusste Produktentscheidung), keine E-Mail-Bestätigung (`enable_confirmations = false`).
  4. Zusammen mit **BUG-48** (die Registrierung verrät, ob eine Adresse existiert) ist der gesamte Nutzerbestand mit rund 40 Anfragen je 5 Sekunden durchprobierbar.
- **Produktfolge über PROJ-2 hinaus:** Massenregistrierung ist die Voraussetzung dafür, die Weltrangliste zu fluten (PROJ-3), und jedes Konto belegt dauerhaft einen öffentlichen, unveränderlichen Trainernamen.

### BUG-62: Die Aufbewahrungsfrist in `docs/privacy.md` ist absolut formuliert, der Mechanismus garantiert sie nicht

- **Severity: Medium** · DSGVO Art. 5(1)(e)
- `docs/privacy.md` sagt „**Höchstens 1 Stunde** nach dem letzten Versuch". Der Code leistet das nicht unbedingt: `prune_auth_throttle()` löscht **höchstens 50 Zeilen je Aufruf** und läuft **nur**, wenn jemand einen Anmelde-, Registrierungs- oder Reset-Versuch macht.
- **Gemessen:** 200 künstliche Zeilen mit fünf Stunden Alter eingefügt, danach **ein** Login-Versuch (zwei Zählaufrufe) → **100 gelöscht, 100 blieben stehen**; ohne weiteren Verkehr blieben sie liegen.
- `design.md` benennt die Verkehrsabhängigkeit, aber **nicht** die 50-Zeilen-Grenze. `docs/privacy.md` — das Dokument, das die Rechtsgrundlage trägt — nennt keine der beiden Einschränkungen.
- **Das ist eine Zusage, die ich in diesem Zyklus selbst geschrieben habe**, und sie ist breiter als die Messung, die sie belegen sollte. Genau das Muster, das dieser Bericht seit BUG-20 verfolgt.

### BUG-63: Die Zusage aus T26 über den Proxy-Pfad stimmt nicht

- **Severity: Medium**
- `tasks.md` (T26) und `src/proxy.ts:86-100` behaupten, die Ausnahme für Server-Action-POSTs sei „auf die Pfade eingegrenzt, die sie brauchen — derzeit nur `/`", weshalb eine pfadbasierte Abwehr beim Deploy „sich nicht mehr umgehen" lasse.
- **Gemessen:** `loginAction` läuft weiterhin unter `/`, `/login`, `/reset-password`, `/privacy`, `/imprint` **und jedem Pfad mit Bild-Endung** (`POST /beliebig.png` → die Action antwortet). Ursache: Öffentliche Pfade werden ohnehin durchgelassen, und der Matcher nimmt Bild-Endungen komplett aus — dort läuft der Proxy gar nicht.
- Heute ohne Sicherheitsfolge, weil die Drosselung **in** der Action sitzt (belegt: der 6. Versuch wird abgewiesen, egal über welchen Pfad). Der Befund ist die zu breite Zusage, auf die sich der Deploy-Plan stützt.

### BUG-64: `design.md` behauptet, der öffentliche Schlüssel stecke im Browser-Bundle

- **Severity: Low**
- `features/PROJ-1-user-login/design.md` führt als Verifizierungsplan, anon key und Projekt-URL „stecken im ausgelieferten Browser-Bundle" und seien „ohnehin öffentlich". **Messbar falsch:** 0 Treffer in `.next/static`, 0 im angemeldeten Client-Code. Diese App hat gar keinen Browser-Supabase-Client.
- Der darauf gestützte Deploy-Prüfplan beruht auf einer falschen Annahme.

### BUG-59: Die Drosselmeldung stimmt weder in der Dauer noch in der Ursache

- **Severity: Low** · von **zwei** Bahnen unabhängig gefunden
- **Dauer:** „Bitte **in ein paar Minuten** erneut versuchen" — tatsächlich sind es höchstens 60 Sekunden (gemessen: Wiedereintritt nach 37 s). Der Nutzer wartet länger als nötig oder gibt auf.
- **Ursache:** Beim Überschreiten des **Konto**-Zählers erscheint dieselbe Meldung „Zu viele Versuche von **dieser Verbindung**". Gemessen: rechtmäßiger Besitzer, richtiges Passwort, **unbelastete** 21. Adresse → genau diese Meldung. Der Nutzer sucht den Fehler an der falschen Stelle; ein Netzwechsel hilft nicht, nur Warten.

### BUG-60: Eine endgültig abgelehnte Runde wird wie ein Transportfehler behandelt

- **Severity: Low**
- `quiz-screen.tsx:172-180` behandelt `rejected` (AC-12) wie `failed` und zeigt „noch nicht gespeichert" samt „Erneut speichern" — obwohl die Runde endgültig abgelehnt ist und die Wiederholung nie gelingen kann.
- Relevant, falls die 0,5-Sekunden-Untergrenze aus AC-12 — laut `spec.md` → Open Questions eine Schätzung — je einen echten schnellen Spieler trifft: Er sieht eine Meldung, die Rettung verspricht, und verliert die Runde stillschweigend.

### Acceptance Criteria

- [x] **AC-1 bis AC-23 und AC-26 bis AC-31** — bestanden mit Beleg. Vieles diesmal zur **Laufzeit** statt aus dem Code: AC-12 als neunfache Grenzwert-Matrix gegen die echte Action (`386/193000` → saved, `386/192999` → rejected); AC-14 mit untergeschobener fremder `profile_id` (Zeile landet beim eigenen Konto) **und** direktem Insert-Versuch (`42501`); AC-26 mit echter Kontolöschung; AC-5 mit 12 Fragen ohne Wiederholung; AC-3 mit 30 Stichproben; AC-31 mit **0 neuen Cache-Einträgen** bei über 250 Namensabfragen aus drei Konten
- [ ] **AC-25 — FAIL** (unverändert **BUG-11**, Low). Der Ladezustand der Quiz-Karte ist ein Textabsatz statt einer Skelettfläche (`quiz-screen.tsx:457-466`); das Layout springt beim Übergang. Das **Bild** hat sein Skelett in exakter Größe — die Lücke ist die Karte
- [!] **AC-24** — kein Viewport, kein Browser

### Edge Cases

- [x] **EC-1 bis EC-10** — bestanden. **EC-4 mit echter Gleichzeitigkeit:** vier **parallele** Einreichungen derselben Runden-ID → alle „saved", in der Datenbank **genau eine** Zeile. Garantie: `client_round_id … unique`
- [x] **EC-11** — spec-konform entfallen, Code konsistent

### Security-Audit (Bahn B)

- [x] **Authentifizierung** — geschützte Routen 307; Actions ohne Sitzung `unauthenticated`; **gefälschtes Sitzungs-Cookie** mit gültiger Struktur → 307, weil der Proxy den Auth-Server fragt statt nur die Signatur zu prüfen; auch im **Produktionsbuild** geprüft
- [x] **Autorisierung** — zwei echte Konten, zwei echte Token: fremde Runden `[]`, Insert für fremdes Profil 403, Runden unveränderlich (PATCH/DELETE ändern nichts), Drosseltabelle und alle **vier** RPCs für `anon`/`authenticated` gesperrt
- [x] **Eingabevalidierung** — SQL, XSS, Header-Injection, Typverwechslungen, 400-Element-Arrays: durchweg abgewiesen, **kein 500er** auf Feldinhalte
- [x] **Open Redirect / SSRF** — fünf Redirect-Varianten abgewiesen; `/_next/image` weist fremde Hosts, `127.0.0.1:54321` und PokeAPI-fremde Pfade mit 400 ab
- [x] **Geheimnisse im Bundle** — **0 Treffer** für Service-Role-Schlüssel, anon key und Projekt-URL in `.next/static` **und** im angemeldeten Zustand (20 Dateien). Der Service-Role-Schlüssel steht nicht einmal in den Serverbündeln — er wird zur Laufzeit gelesen
- [x] **Zugangsdaten in der URL** — alle vier Formulare `method="post"`, Abmelden ebenfalls
- [x] **Kontoaufzählung über Login und Reset** — beide neutral
- [x] **Brute Force, beide Zähler** — 25 Fehlversuche von einer Adresse: ab dem 6. gesperrt; 24 Fehlversuche von 24 Adressen gegen ein Konto: ab dem 21. gesperrt; **BUG-39 und BUG-54 als Regression bestätigt**
- [ ] **BUG: `x-forwarded-for` fälschbar** → **BUG-61 (High)**
- [ ] **BUG: Kontoaufzählung über die Registrierung** → unverändert **BUG-48 (Medium)**, Vertragskonflikt mit PROJ-1 AC-3
- [ ] **BUG: `/auth/confirm` ungedrosselt** → unverändert **BUG-45 (Medium)**; 40 Versuche ohne App-Absage
- [ ] **BUG: `X-Forwarded-Host`** → unverändert **BUG-18 (Medium)**, auch am Produktionsbuild reproduziert
- [ ] **BUG: Security-Header** → unverändert **BUG-12 (Medium)**, auch am Produktionsbuild keiner der vier
- [ ] **BUG: `profiles` gibt UUID und Anmeldedatum aller Spieler heraus** → unverändert **BUG-51 (Low)**
- [!] **Rate-Limit auf `getNextQuestion` und `saveRun`** — nicht implementiert (Backlog `B1`): 30/30 bzw. 30/30 durchgelassen. Anmerkung der Bahn: Die Begründung in B1 („`saveRun` ist durch AC-12 begrenzt") verwechselt **Werte** mit **Anzahl** — AC-12 begrenzt keine Zeilen
- [!] **Supabases eigenes Limit** — lokal gar nicht gesetzt (45 direkte Versuche, 0 × 429); erst gegen das gehostete Projekt messbar

### Regression (Bahn C) — ohne Befund

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **166/166 grün**, 17 Dateien |
| `npm run lint` | grün |
| `npm run build` | grün, 6/6 Seiten, kein `/leaderboard` (konsistent mit PROJ-3 = Planned) |
| `npx playwright test` — Lauf 1 | **33/33 grün**, 51,0 s |
| `npx playwright test` — Lauf 2, unmittelbar danach | **33/33 grün**, 49,5 s |
| Migrationskette `0001`–`0005` | in Wegwerf-Datenbank vollständig durchgelaufen, alle fünf ohne Fehler |
| Kernabläufe | Registrierung, Anmeldung, Abmeldung, Zugangsschutz, Passwort-Reset über echten Mail-Link, Quiz-Runde bis zum gespeicherten Ergebnis — alle bestanden |
| App-Shell | je eine Kopf- und Fußzeile, keine toten Links auf `/leaderboard`, `/privacy`, `/imprint` |

**Die drei Nutzer-Abläufe:** Vertippen-dann-richtig bestanden (4 Fehler, 5. Versuch richtig → drin); Ab- und wieder Anmelden bestanden; **8 von 8** Spielern mit richtigem Passwort von einer Adresse. Die von Bahn C gemeldeten Fälle REG-1 und REG-2 (fünf Tippfehler sperren den Anschluss für alle) sind **kein neuer Befund**, sondern exakt das als BUG-55 bewusst akzeptierte Risiko — von einer dritten, unabhängigen Bahn bestätigt.

### Keine neuen Unit-Tests in diesem Lauf — mit Begründung

Step 6 verlangt, isolierte Logik zu prüfen und zu testen. Ich habe gesucht und **nichts Ungedecktes gefunden**, das sich sinnvoll isoliert testen ließe: Die neuen Mechanismen aus `0005` sind SQL; ein Unit-Test mit gemocktem Client würde nur die Mock-Antwort bestätigen — dieselbe Begründung, die seit `0003` im Kopf von `throttle.test.ts` steht. Für die offenen Befunde wäre ein Test verfrüht: Er würde das heutige Verhalten festschreiben, bevor entschieden ist, wie es aussehen soll.

**Die daraus folgende Lücke ist benannt, nicht übersehen** — und Bahn B hat sie unabhängig bestätigt: `grep` über `src` und `tests` findet **keinen** Treffer für `prune_auth_throttle`, `on_auth_user_deleted` oder `forget_auth_throttle`. Jede künftige Migration, die `register_auth_attempt` erneut überschreibt, kann das Aufräumen stillschweigend wieder entfernen — genau so, wie `0005` die Fassung aus `0003` ersetzt hat. Ein SQL-Testrahmen wäre der Ausbauweg.

### Not Verified In This Run

- [!] **AC-24** und **alles Optische** (Farben, `pop`, `nudge`, `float`, Skelett-Puls, Layout-Sprünge) — kein Browser, kein Viewport; belegt sind Klassennamen und Keyframes, nicht die Darstellung
- [!] **AC-2, browserseitiger Anteil** — Hydration und Rendering nicht messbar; gemessen ist der Serverpfad (Action 0,111–0,127 s, Bild kalt 0,273 s)
- [!] **AC-20 als Netzwerk-Mitschnitt** — ohne DevTools nicht beobachtbar
- [!] **AC-15 / EC-8 mit echtem Ausfall der PokeAPI** — nicht provozierbar; der Zwischenspeicher war warm, es ging keine Anfrage hinaus
- [!] **EC-1, echter Doppelklick** — nur der Code-Riegel ist belegt
- [!] **Rate-Limit auf gewöhnlichen Endpunkten** — nicht implementiert (Backlog `B1`)
- [!] **`supabase db reset`** — bewusst nicht ausgeführt (zerstörend: Testdaten und Mailpit-Zustand, auf dem die Reset-Journey aufsetzt). Ersatzweg über eine Wegwerf-Datenbank; der deckt **nicht** ab: RLS-/Grant-Durchsetzung im Stub, Supabase-Seed und Rollen-Setup
- [!] **Alles gegen das gehostete Projekt** — `0005` ist dort nicht eingespielt; Supabases eigenes Limit, T4 und T18 dort nicht prüfbar
- [!] **Verhalten des künftigen Hosts bei `x-forwarded-for` und `X-Forwarded-Host`** — `deploy` ist in `.ai-eng-kit` `null`, es gibt keinen Anbieter, gegen den man messen könnte. **Davon hängt ab, ob BUG-61 in Produktion entschärft ist**
- [!] **Browserseitige Ausnutzbarkeit von BUG-18** — aus Preflight und `sameSite` abgeleitet, nicht beobachtet
- [!] **Security-Header gegen die Live-URL** — es gibt keine
- [!] **Optische Regression** — keine Baselines im Repository
- [!] **Konto-Fenster (20 / 15 min) beim Ausheilen** — nicht ausgemessen, der IP-Zähler greift in den meisten Szenarien zuerst

### Bewusst zurückgestellt (Entscheidungen des Nutzers)

- **BUG-55 und BUG-57** — akzeptiertes Risiko, mit Zahlen in `design.md` dokumentiert. Bahn B hat **beide Zahlen unabhängig nachgestellt und exakt bestätigt** (4 von 8 mit Tippfehlern, 8 von 8 ohne; 20 Anfragen je 15 Minuten zum Aussperren)
- **BUG-58** — zurückgestellt. Nebenbefund dieses Laufs: Im **Produktionsbuild** liefert der Fall nur noch `{"digest":"…"}` statt Name und Meldung — kein Informationsleck in Produktion
- **BUG-40, BUG-41** — zurückgestellt, Begründung des Nutzers: geringes Risiko bei Einzelarbeit am Repository

### Verdikt

- **Acceptance Criteria:** 30 von 31 mit Beleg bestanden · **AC-25 FAIL** (Low) · AC-24 nicht verifizierbar
- **Edge Cases:** 10 von 10 geltenden bestanden
- **Bugs:** 6 neu — **1 High** (BUG-61), **2 Medium** (BUG-62, BUG-63), **3 Low** (BUG-59, BUG-60, BUG-64) · bestätigt offen: BUG-11, BUG-12, BUG-18, BUG-24, BUG-45, BUG-48, BUG-51 · dazu **T4 und T18** von PROJ-1, vom Skill als High geführt
- **Security:** **9 Prüfungen mit Beleg bestanden** · **6 mit Befund** · **2 NOT VERIFIED**
- **Regression:** ohne Befund — 166/166, Lint, Build, E2E 2× 33/33, Migrationskette vollständig
- **Production Ready: NEIN** · **PROJ-2 bleibt In Review**

> **Was dieser Lauf über die Serie sagt.** Von den fünf Fixes dieses Tages hält jeder einzelne, was er zusagt — BUG-29/30/31, BUG-36, BUG-39, BUG-54, BUG-56 sind alle nachgemessen geschlossen, mehrere davon von zwei unabhängigen Bahnen. Das ist der eigentliche Fortschritt. Was in jedem einzelnen Durchgang wiederkehrt, ist nicht ein fehlerhafter Fix, sondern **ein Satz, der weiter reicht als seine Messung**: „überlebt einen frischen Klon" (BUG-40), „höchstens eine Stunde" (BUG-62), „lässt sich nicht mehr umgehen" (BUG-63), „steckt im Browser-Bundle" (BUG-64). Viermal in einem Bericht, dreimal davon in Sätzen, die als Beleg gemeint waren. **Die Zahlen in diesem Projekt sind verlässlich; die Sätze daneben sind es noch nicht.** Wer hier weiterarbeitet, sollte jede Reichweiten-Aussage wie eine Behauptung behandeln, die eine eigene Messung braucht — nicht wie eine Zusammenfassung der Messung, die daneben steht.

---

## Nachtrag zum finalen Sweep — 2026-09-05, Entscheidungen des Nutzers

> Der Lauf oben bleibt **unverändert** stehen, samt seinem Verdikt „Production Ready: NEIN". Was hier folgt, ist keine Korrektur des Befunds, sondern eine **Umstufung durch den Nutzer** — mit ihren Bedingungen. Wer nur den Abschnitt oben liest, liest den Stand der Messung; wer beide liest, kennt auch die Entscheidung darüber.

### BUG-61 — von High zu Deploy-Blocker umgestuft

**Entscheidung (Nutzer, 2026-09-05):** BUG-61 wird nicht im Code gehärtet, sondern als Deploy-Blocker geführt.

**Begründung, die diese Umstufung trägt:** Ob `x-forwarded-for` vertrauenswürdig ist, kann der Anwendungscode nicht wissen — das entscheidet die Ebene davor. Ein Host, der den Header selbst setzt und einen mitgebrachten Wert verwirft, beseitigt die Schwäche vollständig. Die Alternative im Code hätte die Abwägung aus BUG-55/57 wieder aufgerissen, die einen Tag zuvor bewusst festgeschrieben wurde.

**Anbieter-Voraussetzung, ausdrücklich festgehalten:** Der Hosting-Anbieter muss `x-forwarded-for` **selbst setzen bzw. überschreiben** und darf ihn **nicht vom Client übernehmen**. Vercel tut das. Bei einem eigenen nginx- oder Traefik-Aufbau ist die Konfiguration ausdrücklich auf Überschreiben statt Anhängen zu stellen — `proxy_add_x_forwarded_for` **hängt an** und genügt nicht.

**Schließbedingung — und nur diese zählt:** BUG-61 gilt erst als geschlossen, wenn **gegen die echte Live-URL gemessen** wurde, dass ein selbst gesetzter `x-forwarded-for` den Zähler nicht beeinflusst. Konkret: Rateversuche mit rotierendem Header müssen ab dem sechsten abgewiesen werden. **Eine Zusage in der Dokumentation des Anbieters genügt nicht** — dieses Projekt hat mehrfach erlebt, dass ein Satz weiter reichte als das, was er belegen sollte.

**Was bis dahin gilt:** Der Schutz gegen Passwort-Spraying **existiert nicht**. Solange die App nur lokal läuft, ist das folgenlos. Ab dem ersten öffentlichen Start ist es die schärfste offene Kante des Produkts, und sie steht deshalb als härtester Eintrag in `features/INDEX.md` → Deploy-Blocker.

### BUG-62 — Wortlaut korrigiert, Ausbau als Backlog vermerkt

**Entscheidung (Nutzer, 2026-09-05):** Der zeitgesteuerte Aufräum-Lauf wird **jetzt nicht gebaut**; stattdessen beschreibt `docs/privacy.md` das tatsächliche Verhalten.

**Umgesetzt:**
- `docs/privacy.md` sagt **keine feste Höchstfrist** mehr zu. Es beschreibt beide Wege getrennt: (1) abgelaufene Zeilen verschwinden **beim nächsten Anmelde-, Registrierungs- oder Reset-Versuch**, bis zu 50 je Versuch, ohne Verkehr geschieht nichts; (2) Schlüssel mit einer **E-Mail-Adresse** verschwinden **sofort und unabhängig vom Verkehr** mit dem Konto. Der zweite Weg ist der, auf dem das Löschungsrecht ruht — und er hat die Einschränkung des ersten nicht.
- `tasks.md` → Backlog **`B2`** hält den `pg_cron`-Ausbau samt Messung fest (200 abgelaufene Zeilen, nach einem Login-Versuch 100 gelöscht, 100 blieben liegen) und benennt, wann er akut wird.

**Damit ist BUG-62 als Befund erledigt** — nicht durch eine Änderung am Verhalten, sondern dadurch, dass die Zusage jetzt beschreibt, was das Verhalten ist. Das war der Kern des Befunds.

### Revidiertes Verdikt

Mit BUG-61 als Deploy-Blocker und BUG-62 als korrigierter Zusage bleibt **kein Critical- oder High-Befund** offen, der PROJ-2 zugerechnet wird:

- **Offen, Medium:** BUG-12, BUG-18, BUG-40, BUG-41, BUG-44 bis BUG-48, BUG-55 (akzeptiert), BUG-63
- **Offen, Low:** BUG-11 (**AC-25 fällt weiterhin** — ein Acceptance Criterion ist nicht erfüllt), BUG-24, BUG-42, BUG-43, BUG-49 bis BUG-53, BUG-57 (akzeptiert), BUG-58, BUG-59, BUG-60, BUG-64
- **PROJ-1:** T4 und T18 unabgehakt. Sie liegen in `features/PROJ-1-user-login/tasks.md` und betreffen das Verdikt über **PROJ-1**, nicht über PROJ-2 — PROJ-2s einzige `[user]`-Aufgabe (T34) ist erledigt und belegt. Das ist ausdrücklich festgehalten, damit niemand später den Eindruck bekommt, sie seien übersehen worden

**Production Ready: JA für PROJ-2 — unter drei ausgesprochenen Bedingungen:**

1. **BUG-61 muss beim Deploy gemessen geschlossen werden.** Ohne diese Messung ist der Spraying-Schutz nicht vorhanden. Das ist keine Formalie, sondern der Grund, warum dieser Lauf ursprünglich „NEIN" sagte.
2. **AC-25 ist weiterhin nicht erfüllt.** „Approved" heißt hier: keine Critical- oder High-Befunde — nicht: alle Kriterien erfüllt.
3. **Was nie geprüft wurde, bleibt ungeprüft.** Kein Browser, kein Viewport: das gesamte optische Verhalten, AC-24, der Netzwerk-Mitschnitt zu AC-20 und der echte Ausfall der PokeAPI (AC-15/EC-8). `/e2e-tests` deckt davon die kritischen Journeys ab, nicht alles.

**Status in `features/INDEX.md`: Approved.**

---

## QA-Lauf — 2026-09-07, nach dem Umbau auf die serverseitig geführte Runde

**Anlass:** `/refine PROJ-2` (2026-09-06) hat die Runde serverseitig autoritativ gemacht (AC-32 bis AC-41), `/architecture` und `/tasks` haben sie neu entworfen und geplant, `/build` hat sie in den Commits `6acd8a9` und `7a7c1de` umgesetzt. Dieser Lauf prüft den **gesamten Vertrag** neu — alle 41 AC und alle 14 gültigen EC —, statt frühere Häkchen zu übernehmen.

**Umgebung:** `npm run dev` auf `http://localhost:3000`, lokale Supabase-Instanz in Docker (Migrationen 0001–0010 angewandt), Branch `feat/PROJ-2-server-authoritative-round`.

**Wie geprüft wurde — und warum das hier zählt.** Die Verifikation lief in **drei `qa-engineer`-Lanes mit getrennten Aufgabenbereichen**, von denen keine den Bau gesehen hat: Lane 1 Abnahme, Lane 2 Security-Red-Team, Lane 3 Regression. Jede bekam nur den Feature-Ordner, die AC-Liste, ihren Prüfschritt und die URL. Diese Sitzung ist der eine Eigentümer: Sie führt zusammen, entscheidet bei Widersprüchen und trägt die Bewertung. **Das war diesmal ausschlaggebend** — siehe BUG-110.

> Legende: `[x]` in **diesem** Lauf verifiziert (Nachweis auf derselben Zeile) · `[ ] BUG` als defekt verifiziert · `[!] NICHT VERIFIZIERT` mit Grund.

### Die vier Prüfungen — einzeln gelaufen, einzeln genannt

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **239/239 grün**, 22 Dateien |
| Lint | `npm run lint` | **Exit 0**, keine Befunde |
| Build | `npm run build` | **Exit 0**, 6 Routen inkl. `/api/question/[token]/image` |
| E2E | `npx playwright test` | **57/57 grün** in drei Engines (Chromium, Firefox, Mobile Safari) |

Alle vier von Lane 3 unabhängig nachgefahren; die Zahlen decken sich mit denen im Commit `6acd8a9`.

### Acceptance Criteria

#### Spielablauf

- [x] **AC-1** Startbildschirm mit Wortmarke, Regelsatz, Primär-Aktion und Bestleistung — Nachweis: `curl` gegen `/` mit Sitzung (Bestleistung „Serie 1 · 1:50"), `tests/PROJ-2-quiz-round.spec.ts`
- [x] **AC-2** Erste Frage unter 3 s, Uhr startet am sichtbaren Bild — Nachweis: E2E misst < 3000 ms (19/19 Chromium); `startRoundAction` 0,138 s; `pokemon-image.tsx:59-62` + `quiz-screen.tsx:450-452`. **Lokal gemessen** — siehe „Nicht verifiziert"
- [x] **AC-3** Vier verschiedene deutsche Namen, gemischt, aus 1–386 — Nachweis: Startantwort `["Raichu","Ditto","Pandir","Kramurx"]`, DB `current_answer_id=132`/`correct_index=1`; `draw-question.ts:38-54`
- [x] **AC-4** Richtige Antwort: grün, Serie +1, nächste Frage ohne Uhrenstopp — Nachweis: `answerAction` → `{correct:true, streak:1}`; `answer-option.tsx:50`; `quiz-screen.test.tsx:90`
- [x] **AC-5** Kein Pokémon zweimal als Lösung — Nachweis: 40 Ziehungen in Folge → `seen_ids` 43 Einträge, **0 Duplikate** (psql `unnest`/`group by`)
- [x] **AC-6** Falsche Antwort: rot + nudge, richtige grün, Uhr stoppt, Auflösung bleibt stehen — Nachweis: Antwort `{"correct":false,"correctIndex":2}` erst mit dem Urteil; `question-view.tsx:85-98`; `quiz-screen.tsx:384`
- [x] **AC-7** Ergebnis-Screen mit Serie, Zeit, „Nochmal spielen"; kein toter Bestenlisten-Link — Nachweis: `result-view.tsx:37-77`, `site-pages.ts:24` (`LEADERBOARD_PAGE_EXISTS=false`)
- [x] **AC-8** Persönliche Bestleistung mit `pop` — Nachweis: Runde 1 (Serie 1/110034 ms) `isPersonalBest:true`, die schlechtere dritte `false`; `result-view.tsx:60-64`; `tests/PROJ-2-personal-best.spec.ts`
- [x] **AC-9** „Nochmal spielen" startet unmittelbar eine neue Runde — Nachweis: `quiz-screen.tsx:284-321`; Server legt neue Runde mit `streak 0` an
- [x] **AC-10** Nächste Frage vorgeladen, ohne sichtbaren Ladezustand — Nachweis: Startantwort enthält Token + Optionen der vorbereiteten Frage; `GET /api/question/<prepared-token>/image` → 200; `quiz-screen.test.tsx:77,90`

#### Speicherung und Schutz des Ergebnisses

- [x] **AC-11** Ergebnis automatisch gespeichert, auch bei Serie 0 — Nachweis: `runs` id=37 (Serie 1, 110034 ms) ohne Zutun; `endRoundAction` schrieb auch eine Serie-0-Zeile
- [ ] **BUG — AC-12** „Es existiert keine Schnittstelle, über die ein Aufrufer ein fertiges Ergebnis einreichen könnte" — **gebrochen**, siehe **BUG-110**. Die Server Action hält (mitgeschickte `streak:300` wurde ignoriert, Antwort `streak:1`), die Datenschnittstelle nicht.
- [x] **AC-13** Ohne Anmeldung kein Zugang zu `/` — Nachweis: `curl -i /` ohne Cookie → 307 → `/login`; zweite Prüfung `src/app/page.tsx:20`; `tests/PROJ-2-access-guard.spec.ts`
- [x] **AC-14** Nur Runden für das eigene Konto — Nachweis: mitgeschickte `profileId` wirkungslos; PostgREST-Insert mit **fremdem** `profile_id` → `42501 row-level security`; fremde Runden lesen → `[]`

#### Serverseitig geführte Runde

- [x] **AC-32** Weder Nummer noch richtige Option ableitbar — Nachweis: Startantwort ohne beides; Bildadresse ist ein UUID-Token; `active_runs` für `authenticated` nicht lesbar (`42501`, Migration `0007:103-109`); `submit_answer`/`resolve_question_image` nicht ausführbar (`42501`); fremdes Token → 404
- [x] **AC-33** Server urteilt und führt die Serie — Nachweis: behauptete Serie 300 → Server antwortet `streak:1`; Urteil aus `current_correct_index` (`0009_round_functions.sql:247`)
- [x] **AC-34** Server misst Ausgabe → Antwort-Eingang und summiert — Nachweis: gemessene 65939 ms bzw. 110034 ms entsprachen der realen Wartezeit; DB-Uhr (`0009:245`); Fehlerwartezeit zählt nicht (`0009:288-296`)
- [x] **AC-35** Ergebnis geschrieben, bevor geantwortet wird — Nachweis: `runs`-Zeile lag unmittelbar nach der Antwort vor; Insert vor dem `RETURN` in derselben Transaktion (`0009:256-267`)
- [x] **AC-36** Genau eine laufende Runde je Spieler — Nachweis: 5 parallele `startRoundAction` → **1** Zeile in `active_runs`, keine zusätzliche `runs`-Zeile; Antwort auf das verdrängte Token → `{"status":"stale"}`
- [x] **AC-37** Zwischenspeicher über die Nummer, nicht über das Token — Nachweis: zwei verschiedene Token auf dasselbe Pokémon → erster Abruf legt einen Cache-Eintrag an (688 → 689), der zweite keinen (689 → 689); Cache-Schlüssel enthält `official-artwork/380.png`

#### Fehlerverhalten der externen Datenquelle

- [x] **AC-15** (Serverhälfte) 5-Sekunden-Grenze mit genau einem stillen Versuch — Nachweis: `withTimeoutAndOneRetry`, `src/lib/pokeapi/client.test.ts:100-127`. **Client-Hälfte nicht verifiziert** (siehe unten) und **für die erste Frage einer Runde gar nicht vorhanden** → BUG-111
- [ ] **BUG — AC-16** Fehlerkarte innerhalb der Karte, Uhr steht still — im Regelfall erfüllt (`load-error-card.tsx`, `quiz-screen.error-states.test.tsx:105,163`), aber **für die erste Frage einer Runde nie erreichbar** (BUG-111) und im Transportfehler-Fall widerspricht die Aussage „die Uhr steht still" der Messung (BUG-113)
- [x] **AC-17** Unbegrenzt wiederholbar, Serie und Uhr unangetastet — Nachweis: `quiz-screen.error-states.test.tsx:163`; `quiz-screen.tsx:140-150`
- [x] **AC-18** „Runde beenden" wertet und speichert normal — Nachweis: `endRoundAction` → `{"status":"ended","result":{"streak":0,"durationMs":0}}` + `runs`-Zeile; `run-actions.test.ts:170`
- [x] **AC-19** Warnung erst ab Serie 1, verlassene Runde wird nicht gespeichert — Nachweis: `quiz-screen.tsx:168-179`; `quiz-screen.error-states.test.tsx:218`. Der Browser-Dialog selbst: ohne Browser nicht prüfbar

#### Bild-Auslieferung

- [x] **AC-20** Nur die eigene Domain — Nachweis: ausgeliefertes HTML von `/` und `/login` enthält **null** externe URLs (grep auf `https?://`); Bild über `/api/question/<token>/image`; `tests/PROJ-2-no-third-party.spec.ts` in drei Engines

#### App-Rahmen

- [x] **AC-21** Kopfzeile angemeldet — Nachweis: gerendertes HTML zeigt Wortmarke, Chip „Q qalane1a", „Abmelden"; kein Bestenlisten-Zugang (Schalter aus)
- [x] **AC-22** Kopfzeile ausgeloggt — Nachweis: `/login` und `/reset-password` zeigen „Deutsche Namen · Serie · Weltrangliste"
- [x] **AC-23** Fußzeile überall, ohne toten Link — Nachweis: auf `/`, `/login`, `/reset-password`; `LEGAL_PAGES` leer (`site-footer.tsx:11,20`)
- [!] **AC-24** Kein Burger-Menü, Chip reduziert sich unter 640 px — **NICHT VERIFIZIERT**: kein Viewport. Code spricht dafür (`site-header.tsx:64`, `hidden … sm:inline`), gerendert wurde es nicht
- [ ] **BUG — AC-25** Skelettfläche statt Spinner — für das Quizbild erfüllt (`pokemon-image.tsx:50`), **beim Rundenstart nicht**: dort steht nur eine Textzeile → BUG-112

#### Umgang mit der externen Datenquelle

- [x] **AC-31** Bereits Abgerufenes wird nicht erneut angefragt — Nachweis: Fetch-Cache mit 386 Einträgen zu `pokemon-species/` und 295 zu `official-artwork/`; ein ungecachtes Pokémon 688 → 689, jeder weitere Abruf 689

#### Datenschutz

- [x] **AC-26** Profillöschung nimmt die Runden mit — Nachweis: `delete from auth.users` → `runs` des Profils 1 → 0; FK `runs_profile_id_fkey … ON DELETE CASCADE`
- [x] **AC-27** Runden-Zeile enthält nur Serie, Zeit, Zeitpunkt, Profilbezug — Nachweis: psql `\x`: `id, profile_id, streak, duration_ms, round_id, created_at`
- [x] **AC-28** Keine dauerhafte nutzerbezogene Bild-Historie — Nachweis: `active_runs` nach Rundenende leer; Fetch-Cache ohne Nutzerbezug (0 Einträge mit `api/question/`); `.next/dev/logs` ohne Bildzeilen
- [x] **AC-29** Nur betriebsnotwendige Cookies, kein Tracking, kein Banner — Nachweis: kein `Set-Cookie` bei anonymen Aufrufen; grep auf `gtag|GTM|plausible|posthog|sentry|matomo` → 0
- [x] **AC-30** Schriften von der eigenen Domain — Nachweis: `next/font/google` zur Bauzeit (`layout.tsx:2-12`), `preload` auf `/_next/static/media/…woff2`, `@font-face` ohne externe URL
- [x] **AC-38** Rundenzustand enthält nur das Nötige — Nachweis: Spaltenliste von `active_runs` deckt sich Feld für Feld mit AC-38 (psql `\x`), inkl. vorbereiteter Frage ohne Zeitpunkt und `touched_at`; keine IP-, Geräte- oder Verlaufsspalte
- [x] **AC-39** Löschung am Rundenende, im selben Vorgang — Nachweis: `count(active_runs)=0` danach; `0009:260-267`
- [x] **AC-40** Löschung mit dem Profil über Fremdschlüssel — Nachweis: `delete from auth.users` → `active_runs` 1 → 0; `active_runs_profile_id_fkey … ON DELETE CASCADE`
- [x] **AC-41** Verfall nach spätestens zwei Stunden, zeitgesteuert — Nachweis (**lokal**): `cron.job` = `*/5 * * * *`, `delete … touched_at < now() - interval '110 minutes'`, `active=t`, 6 erfolgreiche Läufe in `cron.job_run_details`; eine Zeile mit `touched_at −111 min` wurde gelöscht. Schlimmstenfalls ~115 min < 2 h. **Im gehosteten Projekt nicht verifiziert** (T36/T37 offen)

### Edge Cases

- [x] **EC-1** Zweiter Klick wirkungslos — Nachweis: zweiter Aufruf mit demselben Token → `{"status":"stale"}`. **Garantie geprüft:** bedingtes UPDATE auf `current_token` unter Zeilensperre (`0009:232-242`); `quiz-screen.wrong-answer.test.tsx:103`
- [ ] **BUG — EC-2** Pool erschöpft → Gewinner-Meldung und Wertung — bei Serie 386 erfüllt, bei **erschöpftem Ziehungsvorrat unterhalb 386 hängt die Runde und wird nie gespeichert** → BUG-114
- [x] **EC-3** Ergebnis bleibt sichtbar, Speichern wiederholbar — Nachweis: `getRunByRoundIdAction` → `{"streak":1,"durationMs":110034}`, unbekannte Kennung → `null`. **Garantie geprüft:** Insert und Delete in einer Transaktion (`0009:256-267`); `quiz-screen.error-states.test.tsx:185`
- [x] **EC-4** Zweimaliges Rundenende erzeugt eine Zeile — Nachweis: zweiter `endRoundAction` → `{"status":"gone"}`, weiterhin 2 Zeilen. **Garantie geprüft:** `UNIQUE (round_id)` + `on conflict on constraint runs_round_id_key do nothing` (`0009:265,342`)
- [x] **EC-5** Pokémon ohne deutschen Namen wird verworfen — Nachweis: `draw-question.ts:77-82`; `client.test.ts:62`, `question-action.test.ts:76`. Zur Laufzeit nicht auslösbar: alle 386 Spezies haben einen deutschen Namen (nachgezählt)
- [x] **EC-6** Nicht ladbares Bild → Frage verwerfen — Nachweis: `replacePreparedQuestionAction` ersetzte die vorbereitete Frage (96 → 277), verworfene Nummer bleibt in `seen_ids`; `question-action.test.ts:99`. **Gilt nicht für die erste Frage** → BUG-111
- [x] **EC-7** Sitzung weg → `/login`, Runde keinem fremden Konto — Nachweis: Server Action ohne Cookie → `{"status":"unauthenticated"}`; Bildroute ohne Sitzung → 307; `tests/PROJ-2-round-authority.spec.ts:169`
- [x] **EC-8** Rate-Limit/Serverfehler der PokeAPI wie ein Ausfall — Nachweis: `question-action.ts:57,61` → `unavailable` → Fehlerkarte. **Nebenwirkung** → BUG-115
- [x] **EC-9** Mehrfachklick startet eine Runde — Nachweis: 5 parallele Startaufrufe → 1 laufende Runde; `quiz-screen.tsx:285`; `quiz-screen.test.tsx:149`
- [x] **EC-10** Drei Verwürfe → Fehlerzustand — Nachweis: `MAX_CONSECUTIVE_DISCARDS=3`, `quiz-screen.error-states.test.tsx:105`. Drei **echte** Bildausfälle nicht erzeugbar
- **EC-11** — entfallen laut `spec.md`, nichts zu prüfen
- [x] **EC-12** Angezeigte Frage nicht verwerfbar — Nachweis: nach `replacePreparedQuestionAction` blieben `current_token` und `current_answer_id` unverändert (psql vorher/nachher). **Garantie geprüft:** `discard_prepared_question` rührt nur die `prepared_*`-Spalten an (`0009:126-138`); Beförderung bei offener Frage → `{"promoted":false}`
- [x] **EC-13** Netzlatenz zählt mit — Nachweis: die gemessenen 65939/110034 ms enthalten die volle Warte- und Netzzeit; keine vom Browser gemeldete Zeit im Datenpfad
- [x] **EC-14** Bilderkennungs-Bot bleibt möglich — Nachweis: nichts im Ausgelieferten reduziert den Aufwand (keine Nummer, keine markierte Option, Token-Bild). Bewusst getragen
- [x] **EC-15** Verwaister Tab wird abgewiesen und sagt es — Nachweis: Antwort aus der verdrängten Runde → `{"status":"stale"}`; Meldung `quiz-screen.tsx:56`, `load-error-card.tsx:39`; `tests/PROJ-2-round-authority.spec.ts:133`

### Security Audit

- [ ] **BUG — Autorisierung / Einreiche-Schnittstelle:** ein angemeldeter Nutzer kann über PostgREST beliebige Runden für sein **eigenes** Profil schreiben → **BUG-110 (Critical)**
- [x] Authentifizierung: kein Zugriff ohne Anmeldung — Nachweis: `/` → 307 `/login`; Bildroute ohne Sitzung → 307; Server Actions → `{"status":"unauthenticated"}`
- [x] Autorisierung über Konten hinweg: dicht — Nachweis: Insert mit fremdem `profile_id` → `403/42501`; fremde Runden lesen → `[]`; anon lesen → `[]`, anon schreiben → `403`
- [x] Rundenzustand nicht lesbar: die Lösung verlässt den Server nicht — Nachweis: `GET /rest/v1/active_runs` mit gültigem JWT → `403 permission denied for table active_runs`
- [x] RPC-Schicht verriegelt — Nachweis: alle acht Runden-Funktionen → `authenticated: 403`, `anon: 404`; `0009:378-394`
- [x] Eingabevalidierung: keine ausnutzbare Fläche gefunden — Nachweis: alle `runs`-Spalten streng typisiert, PostgREST parametrisiert, `trainer_name` per DB-Check begrenzt; Positionen 0–3 und Token als UUID an der Grenze geprüft
- [x] Unveränderlichkeit der Runden — Nachweis: `PATCH`/`DELETE` auf eigene Zeilen wirkungslos (keine Policy), Zeile unverändert
- [x] Keine Geheimnisse im Client-Bundle — Nachweis: 0 Treffer für anon-Key, `54321`-URL und Service-Role-Key in `.next/static`; `admin.ts` ohne `NEXT_PUBLIC_`-Präfix, mit `import 'server-only'`
- [x] Keine Zugangsdaten in der URL — Nachweis: alle vier Auth-Formulare mit `method="post"` (server-gerendertes HTML geprüft)
- [x] Brute-Force auf Zugangsdaten (PROJ-1, als Regression) — Nachweis: 5 Fehlversuche je Verbindung, der 6. abgewiesen; 20 Versuche gegen ein Konto von 20 Verbindungen, der 21. abgewiesen; Erstattung nach Erfolg belegt (Zählerstand 0)
- [x] Keine Kontoexistenz-Preisgabe (PROJ-1, als Regression) — Nachweis: falsches Passwort und unbekannte Adresse wortgleich; Reset-Antwort **byte-identisch** (470 Byte, `diff` leer), kein `Set-Cookie` in beiden Fällen
- [ ] **BUG — Security-Header fehlen** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, CSP) → **BUG-116 (Medium)**, deckt sich mit dem bekannten BUG-12
- [!] Ratenbegrenzung der PROJ-2-Server-Actions — **NICHT VERIFIZIERT — nicht implementiert (für MVP optional)**. Keine Zugangsdaten-Pfade; ein Flut-Aufruf von `startRoundAction` erzeugt PokeAPI- und DB-Last

### E2E Tests

- [x] Kernschleife bis zum gespeicherten Ergebnis (AC-1 bis AC-7, AC-11, EC-1) — `tests/PROJ-2-quiz-round.spec.ts` — grün in drei Engines
- [x] Persönliche Bestleistung über zwei Runden (AC-1, AC-8, AC-9) — `tests/PROJ-2-personal-best.spec.ts` — grün
- [x] Routenschutz (AC-13) — `tests/PROJ-2-access-guard.spec.ts` — grün
- [x] Keine Anfrage an einen fremden Host (AC-20, AC-29, AC-30) — `tests/PROJ-2-no-third-party.spec.ts` — grün
- [x] Serverseitige Autorität (AC-12, AC-14, AC-32, AC-33, EC-1, EC-7, EC-15) — `tests/PROJ-2-round-authority.spec.ts` — grün. **Deckt die Lücke aus BUG-110 nicht ab**, siehe dort
- [x] PROJ-1 als Regression — `PROJ-1-password-reset`, `PROJ-1-reset-response`, `PROJ-1-throttle` — grün

### Nicht verifiziert in diesem Lauf

- [!] **Cross-Browser-Darstellung** — `/qa` hat keinen Browser. Die E2E-Suite lief zwar in drei Engines, das ist aber ein Funktions- und kein Darstellungsnachweis
- [!] **Responsive Layout** bei 375 / 768 / 1440 px (**AC-24**, AC-25 visuell) — kein Viewport
- [!] **Browser-Konsole / Netzwerk-Tab** — keine DevTools
- [!] **AC-15, Client-Hälfte** — die 5-Sekunden-Frist der Bildsonde und ihr stiller zweiter Versuch: kein Test deckt sie ab, ein echter Bildausfall war ohne Netzsperre nicht auslösbar
- [!] **EC-10 mit echten Ausfällen** — belegt ist nur der Unit-Test mit gestellten Fehlschlägen
- [!] **AC-2 unter realen Bedingungen** — lokal gegen einen warmen Zwischenspeicher gemessen, nicht über eine echte Leitung mit kaltem Cache
- [!] **AC-41 im gehosteten Projekt** — lokal vollständig belegt; die beiden `[user]`-Aufgaben **T36** (`pg_cron` im Dashboard) und **T37** (Projekt nicht pausiert) sind **offen** (`tasks.md:24-25`). Kein Zugangsdaten-Pfad, aber ohne sie ist die Frist in Produktion eine Absichtserklärung
- [!] **Wirksamkeit der IP-Drosselung gegen rotierende Header** — die Messungen von Lane 3 isolieren sich über einen selbst gesetzten `x-forwarded-for`-Header, was lokal nur funktioniert, **weil** der Client-Wert ungeprüft übernommen wird (bekannter Deploy-Blocker BUG-61). Belegt ist, dass die Zähler zählen — nicht, dass sie gegen einen Angreifer mit rotierendem Header halten
- [!] **Visuelle Regressionen an der geteilten Shell** — geprüft ist nur die Markup-Struktur; die Suite enthält keine Screenshot-Vergleiche

### Gefundene Bugs

#### BUG-110: Rundenergebnisse lassen sich direkt in die Datenbank schreiben — die Runde ist umgehbar
- **Severity:** **Critical**
- **Bricht:** AC-12, AC-11
- **Schritte zur Reproduktion:**
  1. Konto anlegen und über `POST /auth/v1/token?grant_type=password` ein Zugangstoken holen (öffentlicher anon-Key genügt)
  2. `POST http://127.0.0.1:54321/rest/v1/runs` mit `{"profile_id":"<eigene uid>","streak":386,"duration_ms":0,"round_id":"<uuid>"}`
  3. Erwartet: Abweisung — AC-12 sagt, es gebe **keine** Schnittstelle für ein fertiges Ergebnis
  4. Tatsächlich: **HTTP 201 Created**, die Zeile steht in `runs`. In einer einzigen Anfrage lassen sich 50 gefälschte Runden schreiben
- **Vom Eigentümer dieses Berichts unabhängig nachgemessen** (nicht nur von der Lane): eigenes Konto, eigener Insert, `201`, Zeile vorhanden
- **Ursache:** Die Policy `runs_insert_own` aus `supabase/migrations/0002_runs.sql:48-51` stammt aus dem abgelösten Entwurf, in dem der Browser das Ergebnis einreichte. Sie ist beim Umbau stehengeblieben. **Für den legitimen Ablauf ist sie tot**: Kein Anwendungscode schreibt `runs` über die Nutzersitzung (`src/lib/quiz/run-actions.ts:64,103` lesen nur); geschrieben wird ausschließlich in den `security definer`-Funktionen (`0009:260,337`), die als Eigentümer laufen und RLS ohnehin umgehen
- **Warum es niemand vorher sah:** Die Prüfungen des Baus fragen die Anwendung durch ihre eigene Oberfläche — `tests/PROJ-2-round-authority.spec.ts` belegt, dass der **Browser** kein Ergebnis schickt. Dieser Angriff geht am Browser-Code vorbei. Das ist genau die Klasse von Lücke, für die die unabhängige Prüf-Lane existiert
- **Wirkung:** Die Rangliste aus PROJ-3 liest `runs`. Ein einziger Aufruf trägt Serie 386 in 0 ms ein — der Zustand, den `/refine PROJ-2` verhindern sollte
- **Priorität:** Vor dem Deploy beheben

#### BUG-111: Die erste Frage einer Runde hat keine Absicherung gegen ein nicht ladbares Bild
- **Severity:** Medium
- **Bricht:** AC-15 (Client-Hälfte), AC-16, EC-6 — jeweils für diese eine Frage
- **Schritte zur Reproduktion:**
  1. Runde starten, während `/api/question/<current-token>/image` keine Bytes liefert (CDN-Ausfall oder einzelnes kaputtes Sprite)
  2. Erwartet: ein stiller zweiter Versuch (AC-15), danach die Fehlerkarte mit „Erneut versuchen" und „Runde beenden" (AC-16)
  3. Tatsächlich: Die Skelettfläche bleibt dauerhaft stehen. Kein zweiter Versuch, keine Fehlerkarte, die Anzeigeuhr bleibt bei 0:00 (`onReady` feuert nie), die vier Optionen bleiben klickbar — der Spieler rät blind. Ausweg nur durch Neuladen
- **Ursache:** `startRound` setzt die erste Frage direkt als aktuelle (`quiz-screen.tsx:313-316`); die Sonde `ImageProbe` läuft nur über die **vorbereitete** Frage. Das sichtbare Bild hat weder `onError` noch eine Zeitgrenze (`pokemon-image.tsx:52-64` — nur `onLoad`)
- **Nicht zur Laufzeit provoziert** (keine Netzsperre); der Befund steht auf dem Code, nicht auf einer Vermutung über ihn
- **Priorität:** Vor dem Deploy beheben

#### BUG-114: Erschöpfter Ziehungsvorrat unterhalb Serie 386 lässt die Runde hängen; das Ergebnis geht verloren
- **Severity:** Medium
- **Bricht:** EC-2
- **Schritte zur Reproduktion:**
  1. Rundenzustand mit `seen_ids` = 1..386 und Serie 5 herstellen, nichts vorbereitet
  2. Richtig antworten → `{"correct":true,"streak":6,"result":null}`
  3. `prepareNextQuestionAction` → `{"status":"pool-empty"}`
  4. Erwartet: Die Runde endet, wird gewertet und gespeichert (EC-2)
  5. Tatsächlich: keine neue `runs`-Zeile; der Client behandelt „pool-empty" als „nichts weiter vorzubereiten" und kehrt kommentarlos zurück (`quiz-screen.tsx:228`) — Bildschirm dauerhaft „Runde wird vorbereitet …", keine Fehlerkarte, kein „Runde beenden". Der Zustand verfällt nach 110 Minuten, die Runde ist verloren
- **Ursache:** Das Rundenende hängt allein an `v_streak >= 386` (`0009:252`), nicht am erschöpften Vorrat — und `seen_ids` enthält laut EC-5/EC-6 auch **verworfene** Nummern, kann also vor der Serie voll sein
- **Erreichbarkeit gering** (~380 Fragen), trifft aber genau den Fall, den EC-2 definiert, und kostet die bestmögliche Runde
- **Priorität:** Vor dem Deploy beheben

#### BUG-116: Security-Header fehlen
- **Severity:** Medium
- **Nachweis:** `curl -I http://localhost:3000/login` liefert nur `X-Powered-By: Next.js`; `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` und CSP fehlen auf jeder Route, auch auf der Bild-Route
- **Einordnung:** identisch mit dem projektweit bekannten **BUG-12** aus PROJ-1, in `features/INDEX.md` bereits als Deploy-Blocker geführt. Wird beim Host konfiguriert und gegen die Live-URL geprüft
- **Priorität:** Beim Deploy

#### BUG-112: Kein Skelett beim Rundenstart
- **Severity:** Low
- **Bricht:** AC-25
- **Nachweis:** Zwischen „Runde starten" und der ersten Frage (laut AC-2 bis zu 3 s) zeigt der Inhaltsbereich nur die zentrierte Textzeile „Runde wird vorbereitet …" (`quiz-screen.tsx:496-505`) statt einer Skelettfläche in Größe des erwarteten Inhalts; das Layout springt beim Eintreffen der Frage. Für das Bild selbst ist das Skelett korrekt vorhanden (`pokemon-image.tsx:50`)
- **Priorität:** Nächster Durchgang

#### BUG-113: Die Fehlerkarte behauptet eine stehende Uhr, die servergemessene Zeit läuft weiter
- **Severity:** Low
- **Widerspruch zu:** AC-16, AC-34
- **Nachweis:** Reißt der Transport beim Absenden einer Antwort ab, geht der Client in den Fehlerzustand (`quiz-screen.tsx:373-377`), obwohl die Frage serverseitig offen bleibt. Die Anzeigeuhr pausiert, die maßgebliche Messung nicht: `submit_answer` rechnet beim Wiederholungsversuch `now() - current_issued_at` (`0009:245`) und schreibt die Wartezeit vor der Fehlerkarte in die Rundenzeit. Der Kartentext „die Uhr steht so lange still" (`load-error-card.tsx:44-47`) stimmt dann nicht
- **Wirkt nur zuungunsten des Spielers** (Tie-Breaker). Nicht provoziert; dass die Serveruhr bei offener Frage Wanduhrzeit zählt, ist gemessen (65939 ms reine Wartezeit)
- **Priorität:** Nächster Durchgang

#### BUG-115: Ein 429/500 der PokeAPI verbrennt eine Pokémon-Nummer dauerhaft für die laufende Runde
- **Severity:** Low
- **Nebenwirkung zu:** EC-8, EC-5
- **Nachweis:** `fetchGermanName` liefert bei jeder Fehlerantwort `null` (`client.ts:71`), und der Aufrufer wertet das als „hat keinen deutschen Namen": Die Nummer wandert in `alsoSeen` und damit in `seen_ids`, wird also nie wieder gezogen (`draw-question.ts:77-82`). Ein vorübergehender Serverfehler schrumpft so den Fragenvorrat — bis zu drei Nummern je Ziehversuch. Verstärkt BUG-114
- **Priorität:** Nächster Durchgang

#### BUG-117: Die Dokumente dieses Umbaus tragen durchgehend das Datum 2026-09-06, entstanden sind sie am 2026-09-07
- **Severity:** Low
- **Nachweis:** `spec.md`, `design.md`, `tasks.md` und die Migrationskommentare datieren den Refine, den Entwurf und den Bau auf den 2026-09-06; die Commits `6fa42ba` bis `7a7c1de` sind vom 2026-09-07. Ein Datum, das um einen Tag danebenliegt, ist in einem Entscheidungsprotokoll kein Schönheitsfehler: Es ist die Spur, an der später jemand die Reihenfolge von Entscheidungen rekonstruiert
- **Nicht blind zu korrigieren:** Ältere, echte Verweise auf den 2026-09-06 (PROJ-1s Abschluss) müssen stehenbleiben — eine pauschale Ersetzung würde sie mit verfälschen
- **Priorität:** Nächster Durchgang

### Zusammenfassung

- **Acceptance Criteria:** **37 von 41 bestanden**, 3 gebrochen (AC-12, AC-16, AC-25), 1 nicht verifiziert (AC-24)
- **Edge Cases:** **13 von 14 gültigen bestanden**, 1 gebrochen (EC-2); EC-11 ist entfallen
- **Gefundene Bugs:** **7** — 1 Critical, 0 High, 3 Medium, 3 Low
- **Security:** 11 Prüfungen verifiziert, 1 als **Critical-Bug** gefallen (BUG-110), 1 nicht verifiziert (Ratenbegrenzung der Spiel-Endpunkte — nicht implementiert, für ein MVP vertretbar)
- **Production Ready:** **NEIN**
- **Empfehlung:** BUG-110 zuerst — er entwertet genau das, wofür dieser ganze Umbau gemacht wurde. Danach BUG-111 und BUG-114, die beide dazu führen, dass eine laufende Runde ohne Ausweg hängenbleibt. Der Rest kann in einen späteren Durchgang.

> „Production Ready: NEIN" heißt hier: ein Critical. Die Liste unter „Nicht verifiziert" bleibt unabhängig davon offen — insbesondere Darstellung und Responsive-Verhalten hat in diesem Lauf **niemand** gesehen.

---

## QA-Nachlauf — 2026-09-07, nach den Fixes für BUG-110, BUG-111 und BUG-114

**Anlass:** Der Lauf vom selben Tag fand einen Critical und zwei Medium. Commit `dd361c3` behauptet, sie behoben zu haben. Dieser Lauf prüft nach.

**Umgebung:** `npm run dev` auf `http://localhost:3000`, lokale Supabase-Instanz (Migrationen 0001–**0011** angewandt), Branch `feat/PROJ-2-server-authoritative-round`.

**Wie geprüft wurde:** Wieder **drei `qa-engineer`-Lanes ohne Kenntnis des Fixes** — A (Nachprüfung der drei Befunde und der Kriterien an denselben Stellen), B (Security-Red-Team, vollständige Angriffsliste), C (Regression). Lane B und C bekamen ausdrücklich den Auftrag, den Fix **nicht** zu glauben: B sollte den geschlossenen Weg erneut angreifen und nach Varianten suchen, C darauf achten, ob der Rechte-Entzug etwas Legitimes zerbrochen hat. Diese Sitzung führt zusammen und bewertet.

> Legende: `[x]` in **diesem** Lauf verifiziert (Nachweis auf derselben Zeile) · `[ ] BUG` als defekt verifiziert · `[!] NICHT VERIFIZIERT` mit Grund.

### Die vier Prüfungen

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **242/242 grün**, 22 Dateien |
| Lint | `npm run lint` | **Exit 0** |
| Build | `npm run build` | **Exit 0**, 6 Routen |
| E2E | `npx playwright test` | **60/60 grün** in drei Engines |

Von Lane C unabhängig nachgefahren.

### Die drei Befunde des Vorlaufs

- [x] **BUG-110 (Critical) — behoben, an der Wurzel.** Der Repro-Schritt aus dem Vorbericht 1:1 nachgestellt: `POST /rest/v1/runs` mit eigenem JWT und `streak:386, duration_ms:0` → **403 `42501 permission denied for table runs`** (vorher 201). Ebenso abgewiesen: Bulk-Insert, Upsert über `Prefer: resolution=merge-duplicates`, `PATCH`, `DELETE`, anon-Insert, alle Runden-RPCs als `authenticated`. **Mit Kontrollmessung**, damit das 403 nicht an einem kaputten Rumpf liegt: derselbe Rumpf mit `service_role` → **201**, Kontrollzeile danach entfernt. Ursache-Ebene bestätigt: auf `runs` existiert nur noch `runs_select_own`, `authenticated` hat nur `SELECT` (Migration `0011:30,36`)
- [x] **BUG-110, Gegenprobe: der legitime Weg lebt.** `AC-8` — gerendertes HTML von `/` mit Sitzung zeigt „Deine Bestleistung Serie 1 · 0:22"; `EC-3` — `getRunByRoundIdAction` liefert das Ergebnis, bei fremder Sitzung `null`; `AC-11` — echte Runde gespielt, Zeile geschrieben, auch mit Serie 0; der Schreibweg über die `security definer`-Funktionen ist unberührt (`runs` wuchs im Lauf von 20 auf 34 Zeilen)
- [ ] **BUG-111 (Medium) — im Code behoben, Wirkung nur zur Hälfte belegt.** Die angezeigte Frage hat jetzt Frist und Fehlerpfad (`pokemon-image.tsx:42,80-92` → `question-view.tsx:67-72` → `quiz-screen.tsx:487`), und die Optionen sind während des Fehlers nicht mehr blind klickbar (`quiz-screen.tsx:424`). Belegt ist der **`onError`-Pfad** (`quiz-screen.error-states.test.tsx:144-156`). **Die 5-Sekunden-Frist pinnt kein Test** und war ohne Browser nicht provozierbar → siehe „Nicht verifiziert" und BUG-118
- [ ] **BUG-114 (Medium) — nur zur Hälfte behoben.** Der Client beendet die Runde jetzt (`quiz-screen.tsx:244-247`, Unit-Test `quiz-screen.error-states.test.tsx:175-208`), und zur Laufzeit schreibt der ausgelöste `endRoundAction` sie korrekt. **Der Server tut es weiterhin nicht:** Nach `pool-empty` stand `active_runs` mit Serie 6 unverändert, bis der Prüfer `endRoundAction` selbst aufrief → **BUG-119**

### Erneut geprüfte Kriterien

- [x] **AC-12** — kein Einreichweg mehr, in allen von Lane B durchprobierten Varianten (Verben, Tabellen, RPC, `Prefer`-Kopfzeilen, Auth-Schnittstelle, fremdes Konto). Mitgeschmuggelte `streak:300`, `durationMs:1`, `profileId:<fremd>` bleiben wirkungslos → Antwort `streak:1`
- [x] **AC-14** — Sitzung von Konto 1 sieht 2 von 32 Zeilen, davon 0 fremde; Antwort von Konto 2 auf ein fremdes Token → `{"status":"stale"}`
- [x] **AC-17** — „Erneut versuchen" holt dieselbe Frage zurück, statt eine neue zu ziehen (`quiz-screen.tsx:450-453`; Test belegt `replacePreparedQuestionAction` **nicht** aufgerufen). Laufzeit-Gegenprobe: `promoteQuestionAction` auf eine offene Frage → `{"promoted":false}`
- [x] **AC-18 / EC-4** — `endRoundAction` → `{"status":"ended", …}` + Zeile; zweiter Aufruf → `{"status":"gone"}`, keine zweite Zeile
- [x] **AC-26 / AC-40** — nach `DELETE /auth/v1/admin/users/<uid>`: `runs` 1 → 0, `active_runs` 1 → 0. Der Revoke hat die Kaskade nicht angefasst
- [x] **AC-32 / AC-36 / EC-1 / EC-6 / EC-12 / EC-15** — `active_runs` für `authenticated` weder les- noch schreibbar (403); Ersetzen der vorbereiteten Frage lässt `current_token` und `current_answer_id` unverändert (90/`ab99fe30…`); wiederverwendetes Token → `stale`; Bild fremder Sitzung → 404, ohne Sitzung → 307, erfundene UUID → 404
- [x] **EC-2, Vollständigkeitsfall** — Serie 385 → richtig → `{"streak":386, …}`, Zeile geschrieben, `active_runs` 0, Gewinner-Meldung an der Serie
- [x] **Regression PROJ-1** — vollständig eigenständig nachgefahren: AC-1 bis AC-8, AC-10, AC-13, AC-16, AC-17, AC-19, EC-2, EC-3, EC-5 gegen die laufende Anwendung; beide Drosselungs-Hälften mit exakt gemessenen Grenzen (ab dem 6. Versuch je Verbindung, ab dem 21. je Konto). App-Shell, Routenschutz und das POST-Abmeldeformular unverändert

### Neue Bugs

#### BUG-119: Bei erschöpftem Ziehungsvorrat wertet der **Browser** die Runde, nicht der Server
- **Severity:** Medium
- **Bricht:** AC-35
- **Nachweis:** Repro-Schritte aus BUG-114 exakt nachgestellt (`seen_ids` 1..386, Serie 5): richtige Antwort → `{"correct":true,"streak":6,"result":null}`; `prepareNextQuestionAction` → `pool-empty`, **keine `runs`-Zeile, `active_runs` steht weiter**. Erst der zusätzliche Aufruf von `endRoundAction` schreibt sie
- **Warum das ein eigener Befund ist:** AC-35 nennt „weil der Pool erschöpft ist" ausdrücklich als eine der **drei** Endbedingungen, bei denen **der Server** das Ergebnis schreibt, „bevor er dem Browser antwortet". Der Fix für BUG-114 hat den sichtbaren Hänger beseitigt, aber die Wertung an den Browser gehängt: Bleibt sein Aufruf aus (Tab geschlossen, Verbindung weg, JS-Fehler), ist das Ergebnis genau wie vorher verloren und der Zustand verfällt nach 110 Minuten
- **Wo es hingehört:** `src/lib/quiz/question-action.ts:107` erkennt die Erschöpfung und antwortet nur; die Runde müsste dort enden
- **Priorität:** Vor dem Deploy beheben

#### BUG-120: „Runde beenden" aus einem veralteten Tab beendet die **laufende** Runde des anderen Tabs
- **Severity:** Medium
- **Berührt:** AC-36, AC-18, EC-15
- **Schritte zur Reproduktion (zur Laufzeit gemessen):**
  1. Runde A starten (`roundId 36ebcbd3…`)
  2. Runde B starten (`roundId b24eeddc…`) — verdrängt A nach AC-36
  3. In B eine Frage richtig beantworten (Serie 1)
  4. `endRoundAction` aufrufen — der Aufruf, den Tab A auslöst
  5. Erwartet: A ist gegenstandslos, B läuft weiter
  6. Tatsächlich: `{"status":"ended","result":{"streak":1,…}}`, geschriebene Zeile trägt `round_id = b24eeddc…` (**Runde B**), `active_runs` danach 0. Tab A beendet die laufende Runde von Tab B und bekommt deren Ergebnis angezeigt
- **Ursache:** `endRoundAction` trägt keine Runden-Kennung; `finish_round(p_profile)` beendet, was gerade aktiv ist (`0009_round_functions.sql:316-346`). **Antworten** sind token-geprüft — dort halten AC-36 und EC-15 —, das Rundenende ist es nicht
- **Warum es jetzt auffällt:** Der Weg in die Fehlerkarte eines veralteten Tabs ist durch den BUG-111-Fix neu. Das Bild des verdrängten Tokens liefert 404 (gemessen: vorher 200), zwei Fehlschläge ergeben die Fehlerkarte — und dort steht „Runde beenden". Ein Fix hat einen bestehenden Konstruktionsfehler erreichbar gemacht
- **Priorität:** Vor dem Deploy beheben

#### BUG-118: Die 5-Sekunden-Frist des angezeigten Bildes ist von keinem Test gepinnt
- **Severity:** Low
- **Nachweis:** `grep FakeTimers|advanceTimers|5_000` findet nur `src/lib/pokeapi/client.test.ts:123` (Server-Hälfte). Für `pokemon-image.tsx` ist ausschließlich der `onError`-Pfad getestet; die Frist selbst könnte ein späterer Umbau entfernen, ohne dass etwas rot wird
- **Priorität:** Nächster Durchgang

#### BUG-121: Die Fehlerkarte betitelt den Fremdrunden-Fall falsch
- **Severity:** Low
- **Nachweis:** Erreicht ein veralteter Tab die Karte über den Bildfehler (404 des verdrängten Tokens), steht dort „Die nächste Frage lädt gerade nicht" statt der vorhandenen EC-15-Meldung „Diese Runde ist nicht mehr offen" (`load-error-card.tsx:39`). Der Text spricht außerdem von der *nächsten* Frage, obwohl es die angezeigte ist
- **Priorität:** Nächster Durchgang

#### BUG-113 (aus dem Vorlauf) — jetzt auf dem Normalpfad erreichbar
- **Severity:** von Low auf **Medium** heraufgestuft
- **Nachweis:** Die Fehlerkarte behauptet „die Uhr steht so lange still" (`load-error-card.tsx:44-47`); für die **angezeigte** Frage läuft die Serveruhr weiter — gemessen **10525 ms nach genau 10 s Wartezeit**. Beim „Runde beenden" folgenlos, auf dem AC-17-Pfad wird die Wartezeit dem Spieler angerechnet
- **Warum die Heraufstufung:** Im Vorlauf war der Fall nur bei einem Transportabriss erreichbar. Der BUG-111-Fix macht ihn zum Normalpfad — jeder Bildausfall der angezeigten Frage führt jetzt dorthin
- **Priorität:** Zusammen mit BUG-119/BUG-120

### Nicht verifiziert in diesem Lauf

- [!] **BUG-111 als Laufzeit-Reproduktion** — der Originalbefund („die Skelettfläche bleibt stehen") ist ohne Browser weder vorher noch nachher beobachtbar. Beleg für den Fix sind Code und Unit-Test, nicht eigene Beobachtung
- [!] **AC-15, Client-Hälfte (5-Sekunden-Frist)** — ohne Netzsperre und ohne Rendering nicht provozierbar; zusätzlich von keinem Test gepinnt (BUG-118)
- [!] **AC-16 / AC-17 als sichtbares Verhalten** — Fehlerkarte, Skelettfläche, stehende Anzeigeuhr, `nudge`/`pop`: kein Browser, kein Viewport
- [!] **AC-24, Responsive** — kein Viewport
- [!] **EC-6 / EC-10 mit echten Bildausfällen** — nicht provozierbar
- [!] **EC-2 als Client-Ablauf im Browser** — nur durch den jsdom-Test belegt
- [!] **AC-41 im gehosteten Projekt** — lokal vollständig belegt (`pg_cron`, Job `active-runs-retention`, Fenster 110 min); **T36 und T37 sind weiterhin offene `[user]`-Aufgaben**
- [!] **Drosselung der Spiel-Endpunkte** — nicht implementiert (kein Zugangsdaten-Pfad, für ein MVP vertretbar)
- [!] **Migration 0011 auf frischer Datenbank** — Lane C konnte keinen `db reset` fahren, ohne die Parallel-Lanes zu zerstören. Vom Berichtseigentümer separat abgedeckt: `supabase db reset` über 0001–0011 lief vor dem Gesamtdurchlauf durch, und der E2E-Test, der den Schreibversuch mit 403 festnagelt, war danach grün. Ein eigener Rohmesswert unmittelbar nach diesem Reset liegt nicht vor
- [!] **Visuelle Regressionen** — keine Screenshot-Vergleiche in der Suite
- [!] **Wirksamkeit der IP-Drosselung gegen rotierende Header** — die Messungen setzen den Header selbst; das ist der bekannte Deploy-Blocker BUG-61

### Zusammenfassung

- **Der Critical ist weg.** BUG-110 ist an der Wurzel behoben, in allen durchprobierten Varianten dicht, mit Kontrollmessung abgesichert, und der legitime Lesepfad ist unbeschädigt
- **Keine Regression:** 242/242, Lint 0, Build 0, 60/60 E2E in drei Engines; PROJ-1 vollständig eigenständig nachgefahren
- **Zwei der drei Fixes sind nicht ganz fertig:** BUG-114 hat die Wertung an den Browser gehängt (**BUG-119**, bricht AC-35), und der BUG-111-Fix hat zwei bestehende Schwächen erreichbar gemacht (**BUG-120** und die Heraufstufung von **BUG-113**)
- **Gefundene Bugs:** **5** — 0 Critical, 0 High, **3 Medium** (BUG-119, BUG-120, BUG-113), 2 Low (BUG-118, BUG-121)
- **Acceptance Criteria:** **AC-35 gefallen**; AC-15 und AC-16 nur teilweise belegt (kein Browser); alle übrigen in diesem Lauf geprüften bestanden
- **Production Ready:** **NEIN** — nicht wegen der Severity, sondern weil mit **AC-35 ein Kriterium des Vertrags nachweislich nicht erfüllt** ist. Nach der reinen Bug-Regel („kein Critical, kein High") wäre die Antwort JA; das wäre hier irreführend
- **Empfehlung:** BUG-119 und BUG-120 zusammen beheben — beide sitzen an derselben Stelle (das Rundenende gehört auf den Server und braucht eine Runden-Kennung), beide sind klein. BUG-113 fällt dabei mit ab, wenn die Fehlerkarte ehrlich formuliert wird. Die zwei Low können warten.

> „Production Ready: NEIN" heißt hier: ein gebrochenes Kriterium, keine offene Sicherheitslücke. Die Liste unter „Nicht verifiziert" bleibt unabhängig davon offen — Darstellung und Responsive-Verhalten hat auch in diesem Lauf **niemand** gesehen.

---

## QA-Lauf — 2026-09-07 (dritter Durchgang), nach den Fixes für BUG-119, BUG-120 und BUG-113

**Anlass:** Der Nachlauf vom selben Tag ließ PROJ-2 auf „NICHT bereit" stehen — nicht wegen der Severity, sondern weil mit **AC-35** ein Kriterium des Vertrags nachweislich gebrochen war. Commit `5bb6631` behauptet, das und zwei weitere Befunde behoben zu haben. Dieser Lauf prüft nach und geht zugleich den **vollständigen** Vertrag noch einmal durch.

**Umgebung:** `npm run dev` auf `http://localhost:3000`, lokale Supabase-Instanz (Migrationen 0001–**0012** angewandt), Branch `feat/PROJ-2-server-authoritative-round`, Arbeitsbaum sauber auf `5bb6631`.

**Wie geprüft wurde:** Wieder **drei `qa-engineer`-Bahnen ohne Kenntnis der Fixes** — A (alle 41 AC und 15 EC gegen die laufende Anwendung), B (Security-Red-Team mit der vollständigen Angriffsliste, ausdrücklich beauftragt, den geschlossenen Critical-Weg erneut und in Varianten anzugreifen), C (Regression, die vier Prüfungen, PROJ-1 vollständig, App-Shell, Migrationskette). Keine Bahn kannte den Inhalt der Fix-Commits; jede bekam nur den Feature-Ordner, die AC-/EC-Liste, ihren Schritt aus `SKILL.md` und die Zugangsdaten zur laufenden Umgebung. Diese Sitzung führt zusammen, prüft strittige Punkte selbst nach und bewertet.

**Zur Lesart von AC-16** („die Uhr steht still" = die **angezeigte** Uhr, nicht die gewertete Zeit): vom Nutzer vor diesem Lauf bestätigt, den Bahnen als entschieden mitgegeben. Keine Vertragsfrage mehr.

> Legende: `[x]` in **diesem** Lauf verifiziert (Nachweis auf derselben Zeile) · `[ ] BUG` als defekt verifiziert · `[!] NICHT VERIFIZIERT` mit Grund.

### Die vier Prüfungen — einzeln gelaufen, einzeln genannt

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **253/253 grün**, 23 Dateien (247 vorgefunden + 6 neue, siehe unten) |
| Lint | `npm run lint` | **Exit 0**, keine Meldung |
| Build | `npm run build` | **Exit 0**, 6 Routen — von Bahn C auf einer isolierten Kopie von `HEAD` gefahren, weil `next build` sonst das `.next` des laufenden Dev-Servers zerlegt hätte |
| E2E | `npx playwright test` | **66/66 grün** in drei Engines (chromium 22 · firefox 22 · Mobile Safari 22), 1,3 min |

**Einschränkung zum Build, ehrlich benannt:** Bahn C hat ihn auf dem Stand `HEAD` gefahren, also **ohne** die sechs neuen Unit-Tests dieses Laufs. Für die neue Datei ist stattdessen `npx tsc --noEmit` gelaufen — **Exit 0**. Ein voller `next build` einschließlich der neuen Testdatei ist in diesem Lauf nicht gefahren worden.

### Die drei Befunde des Vorlaufs — alle drei geschlossen

- [x] **BUG-119 (Medium, brach AC-35) — behoben, an der richtigen Stelle.** Repro des Vorlaufs 1:1 nachgestellt (`seen_ids` 1..386, Serie 5, keine Frage offen): `prepareNextQuestionAction` → `{"status":"pool-empty","result":{"streak":5,"durationMs":1234}}`, **`runs` 1→2, `active_runs` 0** — der Server wertet und schreibt, bevor er antwortet. Vorher blieb der Zustand stehen, bis der Browser nachhalf. **Mit Gegenprobe**, dass die Wertung nicht zu früh greift: derselbe Aufruf **mit offener Frage** → `{"status":"pool-empty", result: null}`, keine Zeile, Zustand unangetastet (`src/lib/quiz/question-action.ts:120-143`, Riegel in `:128`)
- [x] **BUG-120 (Medium, berührte AC-36/AC-18/EC-15) — behoben.** `endRoundAction` trägt jetzt die Runden-Kennung; `finish_round(p_profile, p_round_id)` beendet nur die benannte Runde (Migration `0012_finish_round_by_id.sql`). Gemessen: Aufruf mit **verdrängter** Kennung → `{"status":"gone"}`, die laufende Runde bleibt stehen (vorher wurde sie beendet und ihr Ergebnis dem falschen Tab gezeigt). **Von Bahn B unabhängig gegengeprüft** und zusätzlich über Kontogrenzen: Konto B mit der echten, laufenden Kennung von Konto A → `{"status":"gone"}`
- [x] **BUG-113 (Medium) — behoben, durch einen ehrlichen Text statt durch eine anhaltbare Uhr.** Die Fehlerkarte unterscheidet jetzt die beiden Fälle (`src/components/quiz/load-error-card.tsx:56-61`, Unit-Test `quiz-screen.error-states.test.tsx:179`). `design.md` → „Notizen aus dem zweiten Fix-Lauf" begründet, warum die naheliegende Alternative — die Serveruhr beim Bildfehler anhalten — **verworfen** wurde: sie wäre vom Client auslösbar und damit freie Bedenkzeit auf dem Tie-Breaker. Das ist die richtige Entscheidung; sie hinterlässt aber eine Vertragslücke, siehe **BUG-125**

### Acceptance Criteria

**Alle 41 Kriterien geprüft.** Hier das Ergebnis:

#### Spielablauf
- [x] **AC-1** — HTML von `/` mit Sitzung: Wortmarke, Regelsatz, „Runde starten", „Deine Bestleistung Serie 13 · 1:39"
- [x] **AC-2** (Serverhälfte) — `startRoundAction` 138/167/258 ms, mit Bild der ersten Frage **437 ms** gesamt; Uhrstart am sichtbaren Bild (`pokemon-image.tsx:109-112` → `quiz-screen.tsx:485-487` → `:142-144`). Kalte Leitung: siehe „Nicht verifiziert"
- [x] **AC-3** — 16 Runden geprüft: je vier verschiedene Optionen, alle Nummern in 1..386, richtige Position streut (7/5/1/3); deutscher Name der Lösung gegen die PokeAPI abgeglichen; Fisher-Yates `draw-question.ts:47-54`
- [x] **AC-4** (Serverhälfte) — `{"correct":true,"streak":1}`, vorbereitete Frage rückt mit neuem `current_issued_at` nach, keine Unterbrechung der Messung (`0009:268-282`); Färbung folgt dem Serverurteil (`question-view.tsx:48-60`)
- [x] **AC-5** — 12 Fragen in Folge, 0 Duplikate; SQL auf `unnest(seen_ids)` ohne Dublette
- [x] **AC-6** (Serverhälfte) — `{"correct":false,"correctIndex":2,"result":{…}}`; `correctIndex` kommt erst mit dem Urteil, derselbe Aufruf beendet die Runde und schreibt sie
- [x] **AC-7** — `result-view.tsx:37-77`; `LEADERBOARD_PAGE_EXISTS=false` (`site-pages.ts:29`), `/leaderboard` → 404, kein Link im HTML
- [x] **AC-8** — fünf gemessene Fälle auf frischem Konto: 12/9651 → true · 5/1000 → false · 12/20000 → false · 12/500 → true · 13/99999 → true
- [x] **AC-9** — nach beendeter Runde neu gestartet: `streak` 0, `accumulated_ms` 0, frische `seen_ids`, neue `round_id`
- [x] **AC-10** (Serverhälfte) — Startantwort trägt Token und Optionen der vorbereiteten Frage; deren Bild → 200, 169 671 Bytes

#### Speicherung und Schutz des Ergebnisses
- [x] **AC-11** — Zeilen entstehen ohne Zutun (12/9651, 1/4661) und **auch mit Serie 0** (`{"streak":0,"durationMs":305}`)
- [x] **AC-12** — kein Einreichweg: `POST` → **403 `42501`**, Upsert mit `Prefer: resolution=merge-duplicates` → 403, `PATCH` → 403, `DELETE` → 403; mitgeschmuggelte `streak:300`/`durationMs:1`/`profileId` wirkungslos. Bereichs-Constraints `runs_streak_range` (0..386) und `runs_duration_non_negative` bestehen weiter
- [x] **AC-13** — `GET /` ohne Cookie → 307 → `/login`; zweite Prüfung `src/app/page.tsx:20`
- [x] **AC-14** — Konto B gegen Runde A: answer → `stale`, promote → `false`, endRound → `gone`, Bild → 404, `getRunByRoundId` → `null`; Profil-ID stammt überall aus `getUser()`

#### Serverseitig geführte Runde
- [x] **AC-32** — 16 Runden: weder Nummer noch richtige Position im Ausgelieferten; Bildadresse ist ein UUID-Token; erfundenes/fremdes/unformatiertes Token → 404; `GET /rest/v1/active_runs` mit gültigem JWT → **403**; alle **8** Runden-Funktionen: `authenticated` → 403, `anon` → 401
- [x] **AC-33** — Urteil aus `current_correct_index` (`0009:247`); Position `4`/`-1`/`1.5`/`"2"` → `rejected`
- [x] **AC-34** (Messung) — 4 s Wartezeit → `accumulated_ms` 4316; 12 Antworten mit ≥3000 ms → 8564 ms Summe; gemessen von der DB-Uhr (`0009:245`). **Satz 2 des Kriteriums stimmt nicht mehr → BUG-125**
- [x] **AC-35** — alle drei Endbedingungen serverseitig **vor** der Antwort: (a) falsche Antwort → Zeile lag mit der Antwort vor, `active_runs` 0, eine Transaktion (`0009:256-267`) · (b) „Runde beenden" → `{"status":"ended"}` + Zeile 7/9999 · (c) erschöpfter Vorrat → siehe BUG-119 oben. **Damit ist das im Vorlauf gebrochene Kriterium erfüllt**
- [x] **AC-36** — 5 parallele Startaufrufe → genau **1** Zeile in `active_runs`, `runs` unverändert; Antwort auf verdrängtes Token → `stale`; endRound mit verdrängter Kennung → `gone`. Nebenbefund zur Gleichzeitigkeit → **BUG-123**
- [x] **AC-37** — ungecachtes Pokémon 376 über **zwei verschiedene Token**: erster Abruf 344 ms (Cache 744→745), zweiter 164 ms (Cache 745→**745**); Cache-Schlüssel trägt `official-artwork/376.png`, **0** Einträge mit einem Frage-Token

#### Fehlerverhalten der externen Datenquelle
- [x] **AC-15** (Serverhälfte) — `withTimeoutAndOneRetry`, `REQUEST_TIMEOUT_MS=5000` (`client.ts:91-102`, Test `client.test.ts:123`)
- [x] **AC-15** (Client-Hälfte) — **in diesem Lauf erstmals gepinnt**: neue Tests `pokemon-image.test.tsx`, siehe „Neue Unit-Tests". Damit ist **BUG-118 geschlossen**
- [x] **AC-16** (unter der bestätigten Lesart) — Karte liegt in der Inhaltsspalte, nie ganzseitig (`load-error-card.tsx:46-81`, eingebunden `quiz-screen.tsx:516-530`); angezeigte Uhr pausiert immer (`goToError` → `pauseClock`, `:196-203`); Serie unangetastet. Überschrift weiterhin falsch in zwei Fällen → BUG-121
- [x] **AC-17** (Testebene) — „Erneut versuchen" holt dieselbe Frage zurück, `replacePreparedQuestionAction` **nicht** aufgerufen (`quiz-screen.error-states.test.tsx:161-175`); Laufzeit-Gegenprobe: `promote` auf offene Frage → `{"promoted":false}`
- [x] **AC-18** — `endRoundAction(roundId)` → `{"status":"ended","result":{"streak":7,"durationMs":9999}}` + Zeile; mit Serie 0 ebenso
- [x] **AC-19** (Serverhälfte) — `beforeunload` erst ab Serie 1 (`quiz-screen.tsx:170-181`, Test `:341`); Laufzeit-Beleg für „nicht gespeichert": die per Cron verfallene Runde hinterließ **keine** `runs`-Zeile

#### Bild-Auslieferung
- [x] **AC-20** — HTML von `/`, `/login`, `/reset-password`: **0** externe `http(s)`-URLs; Bild ausschließlich über `/api/question/<token>/image`; `next.config.ts` ohne `images.remotePatterns`

#### App-Rahmen
- [x] **AC-21** — Wortmarke, Nutzer-Chip mit Trainername, „Abmelden"; kein Bestenlisten-Zugang (`site-header.tsx:49-53`)
- [x] **AC-22** — `/login` und `/reset-password` zeigen „Deutsche Namen · Serie · Weltrangliste"
- [x] **AC-23** — dieselbe Fußzeile auf allen drei Seiten, `LEGAL_PAGES` leer (`site-footer.tsx:11,20`) → kein toter Link
- [!] **AC-24** — kein Viewport, kein Browser. Markup spricht dafür (kein Burger, `hidden … sm:inline` in `site-header.tsx:57-68`), beobachtet ist es nicht
- [ ] **AC-25 — teilweise defekt.** Für das Quizbild erfüllt (Skelett in Bildgröße, `pokemon-image.tsx:95-96`); beim **Rundenstart** und beim Warten auf die nächste Frage weiterhin nur die Textzeile „Runde wird vorbereitet …" statt einer Fläche (`quiz-screen.tsx:532-541`) → **BUG-112, unverändert offen**

#### Umgang mit der externen Datenquelle
- [x] **AC-31** — 386 Cache-Einträge zu `pokemon-species/`; erneuter Abruf desselben Pokémon legt keinen neuen an (744→745→745→745)

#### Datenschutz
- [x] **AC-26** — Kontolöschung: `runs` 1→0, `profiles` 1→0 über `runs_profile_id_fkey … ON DELETE CASCADE`
- [x] **AC-27** — Spalten von `runs`: `id, profile_id, streak, duration_ms, round_id, created_at` — nichts weiter
- [x] **AC-28** — nach Rundenende `active_runs` = 0; Fetch-Cache (756 Dateien) enthält **0** Treffer auf die Profil-ID und **0** auf `/api/question`; Dev-Log ohne Bild- oder Nummernzeilen
- [x] **AC-29** — anonym `/login`: kein `Set-Cookie`; angemeldet `/`: kein zusätzliches; **0** Treffer für gtag/GTM/plausible/posthog/sentry/matomo; kein Banner
- [x] **AC-30** — 11 `@font-face` im ausgelieferten CSS, alle `src: url("../media/…woff2")`; keine externe URL
- [x] **AC-38** — Spaltenliste von `active_runs` deckt sich **Feld für Feld** mit AC-38, einschließlich der vorbereiteten Frage ohne Zeitpunkt und `touched_at`; keine IP-, Geräte- oder Verlaufsspalte
- [x] **AC-39** — nach jedem Rundenende `count(active_runs)=0`; Insert und Delete in derselben Funktion/Transaktion (`0009:256-267`)
- [x] **AC-40** — Profillöschung: `active_runs` 1→0 über `active_runs_profile_id_fkey … ON DELETE CASCADE`
- [x] **AC-41** (lokal) — `cron.job` „active-runs-retention", `*/5 * * * *`, Schwelle 110 min. **Live nachgemessen**: Zeile mit `touched_at` −111 min angelegt, Lauf um 18:10:00 → `status succeeded`, `return_message "DELETE 1"`, Zeile weg. Gehostetes Projekt: siehe „Nicht verifiziert" (T36/T37 offen) und **BUG-124**

### Edge Cases

- [x] **EC-1** — **echter Wettlauf gefahren**: zwei gleichzeitige Antworten auf dasselbe Token → einmal `answered`, einmal `stale`, genau **1** `runs`-Zeile. Garantie im Code: bedingtes `SELECT … FOR UPDATE` auf `current_token`, Token wird im selben Schritt geleert (`0009:232-242`)
- [x] **EC-2** — Serie 385 → richtig → `{"streak":386}`, Zeile 386/308, `active_runs` 0; Gewinner-Meldung an der Serie (`result-view.tsx:39-46`)
- [x] **EC-3** — `getRunByRoundIdAction` liefert das Ergebnis; erfundene UUID → `null`, kein UUID → `null`, fremde Sitzung → `null`
- [x] **EC-4** — **drei gleichzeitige** `endRound`-Aufrufe auf dieselbe Kennung → 1× `ended`, 2× `gone`, genau **1** Zeile. Garantie: `UNIQUE runs_round_id_key` + `on conflict … do nothing` (`0009:265`, `0012`)
- [!] **EC-5** — zur Laufzeit nicht auslösbar (alle 386 Spezies haben einen deutschen Namen). Code belegt (`draw-question.ts:77-82`), Test grün
- [x] **EC-6** — `replacePreparedQuestionAction`: vorbereitete Nummer 67 → 384, verworfene bleibt in `seen_ids`, **aktuelle Frage unverändert**
- [x] **EC-7** — alle Runden-Actions ohne Cookie → `{"status":"unauthenticated"}`; Bildroute ohne Sitzung → 307
- [!] **EC-8** — ein 429/500 der PokeAPI ist von hier nicht erzwingbar. Code: jeder Fehlschlag endet in `{"status":"unavailable"}` (`question-action.ts:70,74,145`)
- [ ] **EC-9 — Wortlaut hält, Verhalten nicht.** Nach 5 bzw. 3 parallelen Startaufrufen läuft genau **eine** Runde, keine zusätzliche `runs`-Zeile. **Aber:** die unterlegenen Aufrufe enden in **HTTP 500** statt in einer sauberen Absage → **BUG-123**
- [!] **EC-10** — drei echte Bildausfälle ohne Netzsperre nicht erzeugbar. Belegt: `MAX_CONSECUTIVE_DISCARDS=3` (`quiz-screen.tsx:51`) und Test `:108-137`
- **EC-11** — entfallen laut `spec.md`, nichts zu prüfen
- [x] **EC-12** — nach `replacePrepared` blieben `current_answer_id` und `current_token` **unverändert**; `promote` auf offene Frage → `false`; vorbereitetes Token als Antwort → `stale` (kein Überspringen)
- [x] **EC-13** — die gespeicherte Zeit enthält Warte- und Netzzeit (4 s → 4316 ms); im Datenpfad existiert **kein** vom Browser gemeldeter Zeitwert (`answerSubmissionSchema` kennt nur `token`+`choice`)
- [x] **EC-14** — bewusst akzeptiert, bestätigt: im Ausgelieferten reduziert nichts den Aufwand
- [x] **EC-15** — Antwort aus der verdrängten Runde → `stale`; `endRound` mit deren Kennung → `gone`, die laufende Runde bleibt. Einschränkung: falsche Überschrift auf dem Bildfehler-Weg → BUG-121

### Security Audit

**Verifiziert: 8 Prüfpunkte · NICHT VERIFIZIERT: 3.** Jeder Angriff wurde ausgeführt, nicht gelesen; für die 403 der Datenschicht liegt eine **Kontrollmessung** mit `service_role` (→ 200) vor, die belegt, dass die Aufrufform stimmt.

- [x] **Der Critical des Vorvorlaufs bleibt geschlossen — in allen gesuchten Varianten.** `POST`/`PATCH`/`DELETE`/Upsert auf `runs` → 403 · `POST` auf `active_runs` → 403 · alle acht Runden-**RPCs** direkt aufgerufen (`submit_answer`, `start_round`, `get_round_snapshot` und vor allem `resolve_question_image`, das zu jedem Token die Nummer verriete) → **403 `permission denied for function`**
- [x] **Feld-Schmuggel** — `streak:385, durationMs:0, profileId:<fremd>, roundId` in `answerAction` → Serverurteil `streak:0, durationMs:97490` (echte Messung), gefälschte Felder wirkungslos (`z.object` verwirft Zusatzfelder)
- [x] **Antwort-Replay** (falsch antworten, Lösung lernen, alten Stand erneut senden) — zweiter Aufruf mit demselben Token → `{"status":"stale"}`; das Token wird in `submit_answer` unter `for update` im selben Schritt geleert
- [x] **Autorisierung quer über Konten** — fremdes Token beantworten → `stale`; fremde **laufende** Runde beenden → `gone`; `runs` fremder Nutzer lesen → nur eigene Zeilen; `active_runs` für `authenticated` gar nicht lesbar
- [x] **Bild-Route** — eigenes Token → 200 `image/png`, `cache-control: private`; fremdes → 404; erfundene UUID → 404; unformatiert → 404; ohne Sitzung → 307; Pfad-Manipulation (`..%2f`, `%00.png`) → 404. **SSRF nicht möglich**: die Sprite-URL wird aus einem von der DB gelieferten `smallint` 1–386 gebaut, nie aus nutzerkontrolliertem String (`client.ts:51-52`, `route.ts:34-37`)
- [x] **Eingabevalidierung an der Grenze** — SQL-Injektion im Token (`' OR 1=1;DROP TABLE runs;--`) → `rejected`, `runs` unversehrt; `choice: 9999` → rejected; `choice: 1.5` → rejected
- [x] **Auth-Bypass** — alle sechs Quiz-Actions ohne Sitzung → `unauthenticated`; `/` ohne Sitzung → 307
- [x] **Exponierte Geheimnisse — kein Befund.** 18 ausgelieferte Chunks plus HTML durchsucht: kein `service_role`-Literal, kein Service-Role-JWT, kein `SUPABASE_SERVICE_ROLE_KEY`; im Quiz-Bundle nicht einmal der anon-Schlüssel (der Datenzugriff läuft vollständig über Server Actions und die Bild-Route). `src/lib/supabase/admin.ts` trägt `import 'server-only'`
- [ ] **Rechte auf `runs` nicht vollständig entzogen** → **BUG-122** (in diesem Lauf neu)
- [ ] **BUG-18 zur Laufzeit reproduziert** — `startRoundAction` mit `Origin: https://evil.example.com` allein → **HTTP 500 „Invalid Server Actions request."**; **zusätzlich mit `X-Forwarded-Host: evil.example.com`** → `{"status":"ok"}`, Runde gestartet. Aus dem Browser wegen `sameSite: lax` nicht ausnutzbar, real hinter einem Proxy, der den Header nicht verwirft. Medium, beim Deploy zu schließen
- [ ] **BUG-12 / BUG-116 bestätigt** — `GET /` und die Bild-Route liefern **keine** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`; `next.config.ts` hat keinen `headers()`-Block. Zusätzlich `X-Powered-By: Next.js`. Medium, beim Deploy zu schließen
- [!] **Drosselung der Spiel-Endpunkte** — nicht implementiert (15× `startRoundAction` in Folge, alle `ok`). Kein Zugangsdaten-Pfad, für ein MVP vertretbar; die Nebenwirkung auf die Fair-Use-Zusage ist **BUG-126**
- [!] **Security-Header gegen die Live-URL** — `deploy` steht in `.ai-eng-kit` auf `null`, es gibt kein Ziel
- [!] **Cross-Browser / Responsive / DevTools** — kein Browser

### Regression

- [x] **Die vier Suiten** — 253/253, Lint 0, Build Exit 0, 66/66 E2E in drei Engines. **Kein Fehlschlag.**
- [x] **PROJ-1 vollständig eigenständig nachgefahren** — AC-1 bis AC-8, AC-10 bis AC-17, AC-19, AC-20 sowie EC-1 bis EC-5, EC-7, EC-8 gegen die laufende Anwendung, jede Messung mit eigenem `x-forwarded-for`. Hervorzuheben: **AC-10** — Rumpf für bestehendes vs. erfundenes Konto **byte-identisch** (`diff` leer), beide 200, **0 `Set-Cookie`** in beiden, Mailpit 134→135 = genau eine Mail (das Orakel aus BUG-87 bleibt zu) · **AC-8** — ab dem 6. Versuch je Verbindung abgewiesen, Erstattung gegengemessen (7 erfolgreiche Logins hintereinander) · **AC-16** — 20 Fehlversuche von 20 verschiedenen IPs durch, **der 21. abgewiesen**, Leerung bei Erfolg gegengemessen · **AC-17** — die 4. Reset-Anfrage je Verbindung abgewiesen · **AC-20** — 12 Einlösungen: 1–10 je ~78 ms, **11.–12. je ~45 ms** = Abweisung vor dem Auth-Dienst
- [x] **Regressionsfläche eingegrenzt** — `git diff --stat main...HEAD` zeigt **keine einzige geänderte Datei** unter `src/lib/auth/`, `src/components/auth/`, `src/components/layout/`, `src/proxy.ts` oder `src/app/layout.tsx`. Der Umbau hat nur Quiz-Code, `next.config.ts` und die Migrationen `0007`–`0012` angefasst
- [x] **App-Shell unverändert** — Kopf- und Fußzeile auf `/login` und `/`; ausgeloggt die Zeile „Deutsche Namen · Serie · Weltrangliste", angemeldet der Nutzer-Chip; **Abmeldeformular ist POST** (`method="POST"`, kein GET); keine toten Links
- [x] **Migrationskette `0001`–`0012`** — statt eines verbotenen `db reset`: **Reihenfolge-Replay auf einer frischen Scratch-Datenbank** (11 von 12 sauber durch; `0010` scheitert dort nur daran, dass `pg_cron` ausschließlich in der Datenbank `postgres` anlegbar ist — Artefakt des Aufbaus) **plus Drift-Vergleich** Replay ↔ laufende Datenbank: **55 Objekte gegen 55 Objekte, in beide Richtungen deckungsgleich**. Nichts ist an den Migrationen vorbei entstanden, nichts fehlt. `0008` benennt die in `0002` erzeugte Constraint korrekt um, `0011` löscht die dortige Policy, `0012` löscht `finish_round(uuid)` aus `0009` — jeweils sauber nach ihrer Entstehung

### Neue Unit-Tests — die Frist des Bildes ist jetzt gepinnt

`src/components/quiz/pokemon-image.test.tsx`, **6 Tests**, geschrieben in diesem Lauf. Sie schließen **BUG-118**: `IMAGE_TIMEOUT_MS` war der einzige Schutz gegen ein Bild, das **gar nicht antwortet** — der Fall, für den es kein Ereignis gibt — und von keinem Test gepinnt.

Die Tests pinnen den **Zahlenwert**, nicht nur „es gibt eine Frist": bei 4999 ms darf nichts geschehen, bei 5000 ms muss es geschehen. Abgedeckt sind die angezeigte Frage (`PokemonImage`) und die Sonde der vorgeladenen (`ImageProbe`), je mit dem stillen zweiten Versuch aus AC-15.

**Rot-Nachweis geführt** — drei Mutationen, jede einzeln eingebaut, gemessen und zurückgenommen:

| Mutation | Ergebnis |
|---|---|
| `IMAGE_TIMEOUT_MS` 5 s → **10 s** | **3 von 6 rot** |
| `IMAGE_TIMEOUT_MS` 5 s → **1 s** | **2 von 6 rot** |
| `if (loaded) return` **entfernt** | **1 von 6 rot** |

Die dritte Mutation war im ersten Anlauf **grün** — und das war ein Fehler im Test, nicht im Code: Ein einziger großer `advanceTimersByTime` lässt React zwischen den Timern nicht neu rendern, der zweite Versuch kam gar nicht zustande. Der Test rückt jetzt **eine Frist je Schritt** vor und prüft zusätzlich, dass das Bild-Element dasselbe bleibt. Danach rot. Nach Rücknahme aller drei Mutationen: `git diff HEAD -- src/components/quiz/pokemon-image.tsx` **leer**.

### Neue Bugs

#### BUG-122: `runs` gewährt `anon` und `authenticated` weiterhin TRUNCATE
- **Severity:** Medium
- **Berührt:** AC-12, AC-14 (Verteidigungstiefe)
- **Nachweis:** `select relacl from pg_class where relname='runs'` → `anon=rDxtm/postgres, authenticated=rDxtm/postgres`. Das `D` ist **TRUNCATE**, dazu `x` REFERENCES und `t` TRIGGER. `active_runs` hat korrekt **gar keine** Rechte für diese Rollen
- **Ursache:** `0011_runs_no_client_insert.sql:36` entzieht nur `insert, update, delete`. `0007_active_runs.sql:109` macht es richtig: `revoke all on table public.active_runs from anon, authenticated`
- **Warum es zählt:** TRUNCATE **unterliegt keiner Row Level Security**. Wäre es erreichbar, löschte ein einziger Aufruf die Runden **aller** Spieler — die Rangliste wäre weg. Es ist exakt die Lehre aus BUG-110, halb angewandt: „Wer einen Schreibweg entfernt, muss die Rechte mitentfernen"
- **Ehrlich zur Erreichbarkeit:** **Kein erreichbarer Weg gefunden.** PostgREST kennt kein TRUNCATE-Verb, die RPCs sind gesperrt, und eine direkte Postgres-Verbindung als `authenticated` setzt Zugangsdaten voraus, die niemand hat. Der Befund ist heute **nicht ausnutzbar** — er ist eine scharfe Kante, die auf die nächste neue Funktion oder Schnittstelle wartet
- **Priorität:** Vor dem Deploy beheben — eine Zeile `revoke all`, dann `grant select`

#### BUG-123: Gleichzeitige Rundenstarts enden in HTTP 500 und einer Sackgasse
- **Severity:** Medium (Bahn A stufte Low ein; heraufgesetzt, weil das Ergebnis eine Sackgasse ist und EC-9 den Mehr-Tab-Fall ausdrücklich nennt)
- **Berührt:** EC-9, AC-36
- **Schritte zur Reproduktion:** Drei gleichzeitige `startRoundAction` mit derselben Sitzung → 1× HTTP 200, **2× HTTP 500** mit `duplicate key value violates unique constraint "active_runs_pkey"`
- **Ursache:** `start_round` löscht und fügt in **getrennten Anweisungen** ein, ohne `on conflict` (`supabase/migrations/0009_round_functions.sql:68-84`); zwei Transaktionen sehen die Löschung der jeweils anderen nicht
- **Folge im Browser:** `runClientAction` macht daraus `unavailable` → `goToError(null)` (`quiz-screen.tsx:324`) → Fehlerkarte **ohne Runden-Kennung**. „Erneut versuchen" landet wieder in der Karte, „Runde beenden" endet über `gone` in der Fremdrunden-Meldung. **Einziger Ausweg: neu laden.** Aus einem Tab verhindert der `starting`-Riegel (`quiz-screen.tsx:298`) das; aus zwei Tabs oder zwei Geräten nicht — und genau die nennt EC-9
- **Priorität:** Vor dem Deploy beheben. `on conflict (profile_id) do update` macht aus Löschen-und-Einfügen einen Schritt

#### BUG-124: `0010` kann `supabase db push` beim gehosteten Projekt hart scheitern lassen
- **Severity:** Medium
- **Berührt:** AC-41
- **Nachweis:** `supabase/migrations/0010_active_runs_retention.sql:22` ist ein ungeschütztes `create extension if not exists pg_cron;` — kein `DO`-Block, keine Ausnahmebehandlung. Verweigert das Zielprojekt die Erweiterung, bricht die **ganze** Migration ab. Im Replay von Bahn C genau so gesehen (`psql_exit=3`), dort aus anderem Grund — der nachfolgende `comment on table` lief nicht mehr mit
- **Die Spannung zum eigenen Bauplan:** `0005_auth_throttle_retention.sql` begründet ausdrücklich, warum es **kein** `pg_cron` nimmt — „verlangt eine Erweiterung, die im gehosteten Projekt eigens eingeschaltet werden muss — also eine weitere Aufgabe, die jemand von Hand erledigt und vergessen kann. Genau daran ist BUG-36 gescheitert." `0010` geht diesen Weg fünf Migrationen später doch. Die Absicherung dafür ist **T36** — und die ist offen
- **Lokal ohne Auswirkung:** der Job läuft (`cron.job` → `active-runs-retention`)
- **Priorität:** Zusammen mit T36/T37 beim Deploy

#### BUG-125: AC-34 Satz 2 stimmt nicht mehr mit dem gebauten Verhalten überein
- **Severity:** Low — **Vertrag, kein Code**
- **Betrifft:** AC-34
- **Nachweis:** AC-34 sagt: „Wartezeiten im Fehlerzustand zählen nicht mit, weil dann keine Frage offen ist." Seit dem BUG-111-Fix ist der **Regelweg** in die Fehlerkarte der Bildausfall der **angezeigten** Frage — dann ist serverseitig sehr wohl eine Frage offen, und `now() - current_issued_at` (`0009:245`) rechnet die Wartezeit dem Spieler an
- **Warum kein Code-Bug:** Die Fehlerkarte sagt es seit dem BUG-113-Fix ehrlich (`load-error-card.tsx:56-61`), und `design.md` begründet, warum die Alternative — die Serveruhr anhalten — verworfen wurde: sie wäre vom Client auslösbar und damit freie Bedenkzeit auf dem Tie-Breaker. Die Entscheidung ist richtig; nur `spec.md` trägt sie nicht
- **Priorität:** `/refine PROJ-2` — AC-34 Satz 2 auf das tatsächliche Verhalten umschreiben. `spec.md` ist während `/build` read-only, deshalb geht das nicht nebenbei

#### BUG-126: `replacePreparedQuestionAction` ist unbegrenzt aufrufbar und erzeugt externe Last
- **Severity:** Low
- **Berührt:** AC-31 und die Fair-Use-Zusage aus `docs/PRD.md`
- **Nachweis:** Der Aufruf lässt sich beliebig oft wiederholen, zieht je Aufruf bis zu vier PokeAPI-Namensabfragen nach und verbrennt Pool-Nummern in `seen_ids`. Der Schaden am eigenen Spiel ist Selbstschaden; die **externe Anfragehäufigkeit** ist es nicht — die PRD-Rahmenbedingung bittet ausdrücklich darum, sie gering zu halten
- **Priorität:** Nächster Durchgang

### Weiterhin offen, unverändert

- [ ] **BUG-112** (Low, bricht AC-25 teilweise) — keine Skelettfläche beim Rundenstart, nur die Textzeile „Runde wird vorbereitet …" (`quiz-screen.tsx:532-541`)
- [ ] **BUG-121** (Low) — die Fehlerkarte betitelt ohne `message` immer „Die nächste Frage lädt gerade nicht" (`load-error-card.tsx:52`), auch wenn es die **angezeigte** Frage ist und auch, wenn ein veralteter Tab über das 404 seines verdrängten Tokens dort landet (richtig wäre „Diese Runde ist nicht mehr offen", EC-15)
- [ ] **BUG-12 / BUG-116** (Medium) und **BUG-18** (Medium) — beide oben unter Security, beide am Deploy-Ziel zu schließen
- [x] **BUG-118** — **geschlossen** durch die neuen Unit-Tests dieses Laufs

### Außerhalb von PROJ-2 aufgefallen (PROJ-1, nicht Gegenstand dieses Laufs)

Drei Beobachtungen der Regressions-Bahn, hier nur festgehalten, damit sie nicht verlorengehen — **nicht** abschließend bewertet, weil PROJ-1 nicht der Prüfgegenstand war:

- **BUG-127** (Low) — `auth_throttle` nimmt beliebig lange Zählerschlüssel an: ein nicht angemeldeter Aufrufer schreibt pro Fehlversuch eine ~3 KB große Zeile (gemessen `length(key) = 3026`). Entschärft durch `prune_auth_throttle` (1 Stunde) und die Drosselung selbst; eine Längenbegrenzung gibt es nirgends
- **BUG-128** (Low) — Zeitkanal auf `/auth/confirm`: ~78 ms gegen ~45 ms verrät zuverlässig, ob die Verbindung ihr Kontingent erschöpft hat. Der Kommentar in `src/app/auth/confirm/route.ts:81-84` begründet die identische Antwort ausdrücklich damit, einem Angreifer das **nicht** zu bestätigen — die Laufzeit tut es trotzdem. Dieselbe Klasse wie die bereits akzeptierten EC-10/EC-11
- **BUG-129** (Low) — `next.config.ts` enthält weiterhin `allowedDevOrigins: ['192.168.0.165']`, eine fest verdrahtete private IP im Repository

### Nicht verifiziert in diesem Lauf

- [!] **Alles Sichtbare** — AC-24 (Responsive), AC-25 visuell, AC-16/AC-17 als sichtbares Verhalten, die Färbung aus AC-4/AC-6, `pop` und `nudge`, AC-10 „ohne sichtbaren Ladezustand", der Browser-Dialog aus AC-19. **Kein Browser, kein Viewport, keine DevTools.** Jeweils mit Quelltext- und Unit-Test-Beleg unterlegt, aber von niemandem gesehen
- [!] **AC-2 unter realen Bedingungen** — lokal gegen einen warmen Zwischenspeicher gemessen (437 ms), nicht über eine echte Leitung mit kaltem Cache; das rohe PNG (110–170 KB) nicht über eine gedrosselte Verbindung geprüft
- [!] **EC-5, EC-8, EC-10 mit echten Ausfällen** — PokeAPI-Fehler und Bildausfälle von hier nicht erzwingbar (keine Netzsperre)
- [!] **EC-3 im Fehlerfall** (das Schreiben schlägt fehl) — ein fehlschlagender Insert ist von außen nicht erzeugbar; belegt ist nur die Transaktionsklammer im SQL
- [!] **AC-41 im gehosteten Projekt** — lokal vollständig belegt (Job lief, `DELETE 1`). **T36 und T37 sind weiterhin offene `[user]`-Aufgaben** (`features/PROJ-2-pokemon-quiz/tasks.md:24-25`): `pg_cron` im Dashboard einschalten (Database → Extensions) und prüfen, dass das Projekt nicht wegen Inaktivität pausiert ist (Project Settings). Kein Zugangsdaten-Pfad, deshalb kein High — aber ohne sie ist die Zwei-Stunden-Frist in Produktion eine Absichtserklärung. Siehe BUG-124
- [!] **Echter `supabase db reset`** — untersagt, weil drei Bahnen auf derselben Datenbank arbeiteten. Ersetzt durch Replay auf einer Scratch-Datenbank plus Drift-Vergleich (55/55 deckungsgleich), was in der Aussage stärker ist als ein reines Lesen, aber kein Reset gegen die echte Zieldatenbank
- [!] **`next build` einschließlich der neuen Testdatei** — der Build lief auf `HEAD`; für die neue Datei ist `npx tsc --noEmit` (Exit 0) der Beleg
- [!] **Security-Header gegen die Live-URL** und **Wirksamkeit der IP-Drosselung gegen rotierende Header** — beides braucht ein Deploy-Ziel; `deploy` steht in `.ai-eng-kit` auf `null`. Letzteres ist der bekannte Deploy-Blocker BUG-61
- [!] **Drosselung der Spiel-Endpunkte** — nicht implementiert, kein Zugangsdaten-Pfad
- [!] **Visuelle Regressionen** — keine Screenshot-Vergleiche in der Suite
- [!] **PROJ-1 AC-18 zur Laufzeit** (Drosselung fällt aus → fail-closed) — nur durch Abschalten der geteilten Datenbank provozierbar, was die Parallel-Bahnen zerstört hätte. Code (`src/lib/auth/throttle.ts:138`) und Unit-Test (`throttle.test.ts:112`) belegen es

### Zusammenfassung

- **Alle drei Befunde des Vorlaufs sind geschlossen**, jeder mit einer Messung von Prüfern, die den Fix nicht gebaut haben — und BUG-119 zusätzlich mit einer **Gegenprobe**, dass die neue Wertung nicht zu früh greift
- **AC-35, das im Vorlauf gebrochene Kriterium, ist erfüllt.** Der Server schreibt bei allen drei Endbedingungen, bevor er antwortet
- **Der Critical bleibt zu.** Bahn B hat den Weg und alle gesuchten Varianten erneut angegriffen — Verben, Upsert, RPC-Direktaufrufe, `active_runs`, Feld-Schmuggel, Replay, Kontogrenzen, Bild-Route, SSRF: sämtlich abgewehrt und mit gemessenen Antworten belegt, mit Kontrollmessung
- **Keine Regression:** 253/253, Lint 0, Build Exit 0, 66/66 E2E in drei Engines; PROJ-1 vollständig eigenständig nachgefahren, App-Shell unverändert, Migrationskette gegen die laufende Datenbank driftfrei (55/55)
- **BUG-118 geschlossen** — die 5-Sekunden-Frist ist jetzt von sechs Tests gepinnt, deren Rot-Verhalten gegen drei Mutationen gemessen wurde
- **Gefundene Bugs:** **5 neue in PROJ-2** — 0 Critical, 0 High, **3 Medium** (BUG-122, BUG-123, BUG-124), 2 Low (BUG-125, BUG-126). Dazu 3 Low außerhalb von PROJ-2 (BUG-127 bis BUG-129) und die unverändert offenen BUG-112, BUG-121 (Low) sowie BUG-12/BUG-116 und BUG-18 (Medium, Deploy-Ziel)
- **Acceptance Criteria:** **40 von 41 erfüllt.** Einzige Ausnahme ist **AC-25**, teilweise (BUG-112, Low): das Quizbild hat seine Skelettfläche, der Rundenstart nicht. Dazu **AC-34**, dessen zweiter Satz das gebaute Verhalten nicht mehr beschreibt (BUG-125) — eine Vertragsfrage, kein Defekt
- **Production Ready: NEIN — knapp.** Nach der reinen Bug-Regel („kein Critical, kein High") wäre die Antwort JA. Sie lautet trotzdem NEIN, aus demselben Grund wie im Vorlauf und nach demselben Maßstab: **ein Kriterium des Vertrags ist nicht erfüllt** (AC-25) und ein zweites beschreibt nicht mehr, was gebaut wurde (AC-34). Beides ist klein, keines ist ein Sicherheits- oder Datenrisiko
- **Empfehlung, in dieser Reihenfolge:** (1) **BUG-122** — eine Zeile `revoke all` + `grant select`, die schärfste Kante für den geringsten Aufwand. (2) **BUG-123** — `on conflict (profile_id) do update` in `start_round`. (3) **BUG-112** — die Skelettfläche beim Rundenstart, danach ist AC-25 erfüllt. (4) `/refine PROJ-2` für **BUG-125**, und dabei gleich prüfen, ob AC-25 so gemeint war. (5) **BUG-124** zusammen mit T36/T37 beim Deploy. Die übrigen Low können warten

> **Der Unterschied zum Vorlauf, in einem Satz:** Dort war ein Kriterium gebrochen, weil eine Zuständigkeit beim Falschen lag; hier ist eines unerfüllt, weil eine Skelettfläche fehlt. Die Liste unter „Nicht verifiziert" bleibt davon unberührt — **Darstellung und Responsive-Verhalten hat auch in diesem dritten Lauf niemand gesehen.**

---

## Nachtrag — Übersicht aller Server-Autoritätsübergänge (2026-09-07)

**Anlass:** Vor dem nächsten `/build` sollte einmal zusammenhängend statt Bug für Bug sichtbar sein, wo die Runde vom Browser auf den Server übergeht — und woran der Server an jeder dieser Stellen erkennt, **welche** Runde gemeint ist. Alle Angaben aus dem Quelltext von `HEAD` (`5bb6631`) und aus Messungen gegen die laufende lokale Datenbank.

**Die Leitfrage der Tabelle** ist nicht „darf der Aufrufer das?" — das ist überall gleich und überall dicht (jede Funktion ist `security definer`, von `public`/`anon`/`authenticated` entzogen und nur für `service_role` ausführbar; das Profil stammt ausnahmslos aus `getUser()`, nie aus einem mitgeschickten Feld). Die Leitfrage ist: **„woher weiß der Server, welche Runde der Aufrufer meint?"** An genau dieser Frage ist BUG-120 gescheitert.

### Die acht Übergänge

| # | Übergang | Eintritt (Server Action) | DB-Funktion | Bindung an die Runde | Race-Garantie | Befund |
|---|---|---|---|---|---|---|
| 1 | **Runde starten** | `startRoundAction()` — ohne Argument | `start_round(profile, …)` | **keine nötig** — erzeugt die Runde, Profil aus der Sitzung | ❌ `delete` und `insert` sind **getrennte Anweisungen** ohne `on conflict` (`0009:68-84`) | **BUG-123** — gleichzeitige Starts → HTTP 500 `active_runs_pkey` |
| 2 | **Antwort prüfen** | `answerAction({token, choice})` | `submit_answer(profile, token, choice)` | ✅ **Frage-Token** — `where current_token = p_token` (`0009:232-237`) | ✅ `for update` + Token wird im selben Schritt geleert → jeder zweite Aufruf läuft ins Leere | — (EC-1, EC-15 halten) |
| 3 | **Nächste Frage vorbereiten** | `prepareNextQuestionAction()` — **ohne Argument** | `get_round_snapshot(profile)` → `set_prepared_question(profile, …)`, bei leerem Vorrat `finish_round(profile, snapshot.roundId)` | ❌ **nur das Profil** — der Aufrufer nennt seine Runde nirgends | ⚠️ letzter Schreiber gewinnt | **BUG-130** |
| 4 | **Vorbereitete Frage ersetzen** | `replacePreparedQuestionAction()` — **ohne Argument** | `discard_prepared_question(profile)` + `set_prepared_question(profile, …)` | ❌ **nur das Profil** | ⚠️ letzter Schreiber gewinnt | **BUG-130** |
| 5 | **Vorbereitete Frage befördern** | `promoteQuestionAction(token)` | `promote_prepared_question(profile, token)` | ✅ **Frage-Token**, zusätzlich `and current_token is null` — eine angezeigte Frage ist nicht verdrängbar (`0009:180-190`) | ✅ bedingtes Update in einer Anweisung | — (EC-12 hält) |
| 6 | **Runde beenden** | `endRoundAction(roundId)` | `finish_round(profile, roundId)` | ✅ **Runden-Kennung** — `and a.round_id = p_round_id` (`0012`) | ✅ `for update` + `runs.round_id UNIQUE` + `on conflict … do nothing` | — (BUG-120 geschlossen) |
| 7 | **Bildzugriff** | `GET /api/question/[token]/image` | `resolve_question_image(profile, token)` | ✅ **Frage-Token**, nur für die eigene laufende Runde; fremd/erfunden/abgelaufen → 404 | n/a — `stable`, nur lesend | — (AC-32 hält) |
| 8 | **Ergebnis lesen** | `getRunByRoundIdAction(roundId)`, `getPersonalBest()` | keine — PostgREST über die **Nutzersitzung** | ✅ Runden-Kennung **plus** RLS `runs_select_own` | n/a | — (AC-14 hält) |

**Was die Tabelle als Muster zeigt:** Drei Bindungsarten sind im Einsatz — Frage-**Token** (2, 5, 7), Runden-**Kennung** (6, 8), und **gar nichts** (3, 4). Übergang 1 braucht keine, weil er die Runde erzeugt. Die beiden Zeilen ohne Bindung sind exakt der Zustand, in dem `finish_round` vor Migration `0012` war.

### Die drei Tabellen darunter

| Tabelle | RLS | Policies | Tabellenrechte `anon` / `authenticated` | Bewertung |
|---|---|---|---|---|
| `active_runs` | an | **keine** — bewusst, denn die Zeile enthält die Lösung | **keine** (`revoke all`, `0007:109`) | ✅ **Das Vorbild:** zwei Schichten, beide zu |
| `runs` | an | nur `runs_select_own` (SELECT) | `rDxtm` = SELECT + **TRUNCATE** + TRIGGER + REFERENCES | **BUG-122** — `0011:36` entzieht nur `insert, update, delete` |
| `profiles` | an | nur `profiles_select_authenticated` (SELECT) | **`arwdDxtm` = alle Rechte** | ⚠️ **Hält allein durch RLS.** Gemessen: `PATCH`/`DELETE` auf eigene und fremde Zeilen → HTTP 204 mit **0 betroffenen Zeilen**, Trainername unverändert, Profilzahl unverändert (133). Einschichtig statt zweischichtig — dieselbe Klasse wie BUG-122, gehört zu PROJ-1 |

### BUG-130: Zwei Übergänge kennen die Runde nicht, die sie verändern

- **Severity:** Medium
- **Berührt:** AC-36, EC-15, AC-10, AC-35
- **Klasse:** identisch mit BUG-120 — dort war es das Rundenende, hier sind es Vorbereiten und Ersetzen
- **Warum es BUG-120s Fix überlebt hat:** `0012` hat die Runden-Kennung nur bei `finish_round` nachgezogen. `set_prepared_question` und `discard_prepared_question` nehmen weiterhin nur `p_profile`, und die zugehörigen Server Actions nehmen **überhaupt kein Argument** — ein veralteter Tab ist für den Server von einem aktuellen nicht unterscheidbar, weil er seine Runde gar nicht nennen kann

**Messung 1 — der veraltete Tab verändert die laufende Runde** (Runde A gestartet, Runde B gestartet und A damit verdrängt, dann der Aufruf, den Tab A auslöst):

```
B VORHER   round_id 48f32e60…  prepared_answer_id 151  prepared_token 62960415…  seen_ids {150,151}
   → discard_prepared_question(profile) + set_prepared_question(profile, 300, 1, {301,302})
B NACHHER  round_id 48f32e60…  prepared_answer_id 300  prepared_token 4a3fbb79…  seen_ids {150,151,301,302,300}
```

Die vorbereitete Frage der **laufenden** Runde ist ausgetauscht, ihr Token gewechselt, ihr Ziehungsvorrat um drei Nummern verkürzt. Der Tab, der gerade spielt, hat das Bild zu `62960415…` vorgeladen — das ist jetzt wertlos, und die nächste Frage kommt mit sichtbarem Ladezustand statt vorgeladen (**AC-10**).

**Messung 2 — der veraltete Tab kann die laufende Runde beenden** (Runde B auf „Vorrat erschöpft, keine Frage offen" gesetzt, dann der `pool-empty`-Zweig aus `question-action.ts:120-143`):

```
B VOR DEM ENDE   round_id 48f32e60…  streak 9  keine_frage_offen t   runs 0
   → finish_round(profile, snapshot.roundId)     ← die Kennung stammt vom SERVER, nicht vom Aufrufer
ENDE             round_id 48f32e60…  streak 9  duration_ms 0  written t
                 runs 1   active_runs 0
```

Die Runden-Kennung, die `0012` als Schutz eingeführt hat, wird hier **serverseitig aus der gerade laufenden Runde abgeleitet** — der Schutz ist damit auf diesem Pfad wirkungslos. Voraussetzung ist ein erschöpfter Ziehungsvorrat ohne offene Frage; das ist selten, aber es ist derselbe Konstruktionsfehler.

- **Was es nicht ist:** kein Sicherheitsproblem über Kontogrenzen hinweg. Ein Spieler kann ausschließlich seine **eigenen** Runden so beeinflussen — fremde Profile sind an jeder Stelle durch `getUser()` und RLS getrennt (Übergang 8 und die Tabelle darüber)
- **Der Fix, in derselben Form wie `0012`:** `prepareNextQuestionAction` und `replacePreparedQuestionAction` nehmen die Runden-Kennung entgegen, `set_prepared_question` und `discard_prepared_question` bekommen `p_round_id` und ein `and a.round_id = p_round_id`; passt sie nicht, geschieht nichts. Im `pool-empty`-Zweig wird die Kennung des Aufrufers gegen `snapshot.roundId` geprüft, statt Letztere zu verwenden

### Antwort auf die Gate-Frage

**Nein — BUG-122, BUG-123 und BUG-124 waren nicht die letzten offenen Lücken.** Die Übersicht hat mit **BUG-130** eine vierte gefunden, und zwar genau dort, wo die Tabelle eine Lücke im Muster zeigt: zwei von acht Übergängen binden sich an keine Runde. Ohne die zusammenhängende Betrachtung wäre sie stehen geblieben, weil jeder Einzelbefund für sich harmlos aussah.

**Alle vier gehören in denselben `/build`-Durchgang** — sie sitzen in denselben zwei Dateien (`supabase/migrations/*`, `src/lib/quiz/*`), und BUG-123 und BUG-130 fassen beide `start_round` bzw. die Vorbereitungs-Funktionen an.

### Nachtrag zum Verdikt — Entscheidung des Nutzers, 2026-09-07

**BUG-112 (AC-25, fehlende Skelettfläche) und BUG-125 (AC-34 Satz 2) blockieren die „production ready"-Bewertung nicht länger.** Entscheidung des Nutzers, ausdrücklich begründet: Beide tragen **kein Sicherheits- und kein Datenrisiko**. Sie werden getrennt weitergeführt — BUG-112 als gewöhnlicher Task im nächsten `/build`, BUG-125 als `/refine PROJ-2` am Vertrag.

Das ändert die Bewertung des dritten Laufs **nicht rückwirkend**, es ändert den Maßstab für den nächsten: Ein `NEIN` wird ab jetzt nur noch von Befunden getragen, die Verhalten, Daten oder Sicherheit betreffen — nicht von einer fehlenden Ladefläche und nicht von einem Satz im Vertrag, der dem gebauten Verhalten hinterherhinkt.

**Der Stand nach diesem Nachtrag ist trotzdem `NEIN`** — aber aus einem anderen Grund als im Bericht oben: Die Autoritäts-Übersicht hat mit **BUG-130** eine Lücke gefunden, die Verhalten betrifft (die laufende Runde wird von einem veralteten Tab verändert und im Randfall beendet). Zusammen mit BUG-122, BUG-123 und BUG-124 sind das vier Befunde für den nächsten `/build`.
