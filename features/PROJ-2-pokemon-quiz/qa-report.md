# QA Test Results

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
- **Priorität:** Vor dem Deploy beheben. `/build` hebt beim Fix das `.skip` auf; der Test ist die Abnahme
- **Umfang:** Ein `useEffect`, der ab Serie 1 einen `beforeunload`-Listener registriert

#### BUG-2: Keine Drosselung der Server Actions

- **Severity:** Low
- **Betrifft:** kein AC — in Spec und Design nicht gefordert, hier als Sicherheitsbefund vermerkt
- **Schritte zum Nachstellen:**
  1. Als angemeldeter Nutzer `getNextQuestion` wiederholt aufrufen
  2. **Tatsächlich:** keine Begrenzung
- **Wirkung:** Begrenzt. Wiederholte Pokémon werden aus dem Zwischenspeicher bedient, erzeugen also keine Last bei der PokeAPI; `saveRun` kann nur eigene Zeilen anlegen und wird durch AC-12 begrenzt. Ein entschlossener Nutzer könnte durch immer neue Nummern dennoch Anfragen an die PokeAPI auslösen und damit gegen deren Fair-Use-Bitte arbeiten
- **Priorität:** Nice to have — vor dem öffentlichen Start neu bewerten, nicht vor diesem Deploy

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
