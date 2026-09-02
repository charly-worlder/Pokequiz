# QA Test Results

> **Dieser Bericht hat mehrere Durchgänge.** Der jeweils oberste trägt die gültige Bewertung; die älteren bleiben unverändert stehen, weil ein Bericht, der nachträglich grün geschrieben wird, nichts mehr wert ist.

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
