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
