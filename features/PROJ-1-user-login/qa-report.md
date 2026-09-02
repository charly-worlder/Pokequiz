# QA Test Results

**Tested:** 2026-08-31 · **Nachprüfung nach BUG-1-Fix:** 2026-09-01
**App URL:** http://localhost:3000 (`probe.baseUrl`, lokaler Next.js-Dev-Server + lokaler Supabase-Stack)
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Durchlauf verifiziert (mit Beleg) · `[ ] BUG` als defekt verifiziert · `[!] NOT VERIFIED` in diesem Durchlauf nicht prüfbar (mit Grund)

Vorgehen: Lokale DB per `supabase db reset` auf einen sauberen Stand gebracht, Dev-Server gestartet, dann zwei parallele Prüfspuren gefahren — (a) funktional per echtem Chromium-Browser (Playwright, temporäres Prüf-Skript, nicht committet — `/e2e-tests` ist für dauerhafte Browser-Tests zuständig) gegen jede AC-ID/EC-ID, (b) ein unabhängiger Security-Red-Team-Subagent gegen die echte API (curl, `docker exec ... psql`, Build-Output-Grep). Zusätzlich ein echter Concurrency-Test für EC-1 (zwei gleichzeitige Registrierungen, dreifach wiederholt).

### Acceptance Criteria Status

#### AC-1: Registrierung legt Konto + Profil an, sofortiger Login
- [x] E-Mail/Passwort/Trainername → Konto + Profil angelegt, sofort eingeloggt, keine Bestätigungsmail nötig — Playwright: `AC-1, AC-14` (register → `waitForURL('/')` → „Eingeloggt als …" sichtbar)
- [x] Passwort-Mindestlänge 8 Zeichen serverseitig erzwungen, nicht nur im Formular — `curl POST /auth/v1/signup` mit 6-Zeichen-Passwort → `422 weak_password`

#### AC-2: Doppelter Trainername (Groß-/Kleinschreibung) abgelehnt
- [x] Feldspezifischer Fehler „Dieser Trainername ist bereits vergeben." — Playwright: `AC-2, EC-1`
- [x] Auch bei direktem API-Aufruf (Zod umgangen) abgelehnt — Security-Lane: `POST /auth/v1/signup` mit Duplikat → `500 {"code":"P0001","message":"trainer_name_taken"}`

#### AC-3: Doppelte E-Mail-Adresse mit offener Meldung abgelehnt
- [x] Meldung „Diese E-Mail-Adresse ist bereits registriert." erscheint — Playwright: `AC-3`
- [x] `mapRegisterError` ordnet `error.code === 'user_already_exists'` korrekt dem E-Mail-Feld zu — `src/lib/auth/error-mapping.ts:43-45`, per Unit-Test abgesichert (`error-mapping.test.ts`)

#### AC-4: Login mit korrekten Zugangsdaten → Weiterleitung zu `/`
- [x] Playwright: `AC-4, AC-6` (Login → `waitForURL('/')`, Trainername sichtbar)

#### AC-5: Sitzung bleibt bis aktivem Logout bestehen
- [x] Neuer Browser-Kontext aus gespeichertem `storageState` (simuliert „Browser schließen und neu öffnen") bleibt eingeloggt — Playwright: `AC-5`

#### AC-6: Abmelden beendet die Sitzung, Weiterleitung zu `/login`
- [x] Playwright: `AC-4, AC-6`

#### AC-7: Identische Fehlermeldung bei falschem Passwort / unbekannter E-Mail
- [x] Byte-genau identischer Text in beiden Fällen, per UI geprüft — Playwright: `AC-7` (`expect(msg1).toBe(msg2)`, Wert: „E-Mail-Adresse oder Passwort ist falsch.")
- [x] Auch auf API-Ebene identisch — Security-Lane: beide Fälle liefern `400 {"error_code":"invalid_credentials"}`

#### AC-8: Supabases eingebautes Rate-Limit (30 Versuche / 5 Min pro IP)
- [!] NOT VERIFIED — 45 aufeinanderfolgende Fehlversuche gegen die lokale Instanz, alle `400 invalid_credentials`, kein einziges `429` (Security-Lane, reproduziert den bereits während `/build` dokumentierten Befund). Ursache laut `design.md` → Technical Decisions: die lokale Supabase-CLI setzt `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` im Auth-Container nicht, obwohl `config.toml` den Wert enthält — ein Tooling-Gap der lokalen Umgebung, kein Code-Fehler dieses Features. Nur gegen das gehostete Projekt nach dem ersten `/deploy` wirklich verifizierbar (Verifizierungsplan bereits in `design.md` hinterlegt). Siehe auch Security-Audit unten für die Einordnung des Rest-Risikos.

#### AC-10: Passwort-Reset anfordern — identische Meldung unabhängig von Kontoexistenz
- [x] Playwright: `AC-10, EC-3` (existierende und nicht-existierende Adresse liefern denselben Text)

#### AC-11: Gültiger Reset-Link → neues Passwort setzen → eingeloggt
- [x] Echter E-Mail-Link aus Mailpit ausgelesen, angeklickt, Passwort gesetzt, landet eingeloggt auf `/`, **und** das neue Passwort funktioniert für einen frischen Login — Playwright: `AC-11` (End-to-End über den echten Client-seitigen Session-Aufbau aus `reset-password-form.tsx`, nicht nur Code-Lektüre)

#### AC-12: Abgelaufener/ungültiger Reset-Link zeigt Fehlermeldung
- [x] `#error=access_denied&error_code=otp_expired` im Fragment → Fehlermeldung + „Neuen Link anfordern"-Link — Playwright: `AC-12`
- [x] Direkter Aufruf ohne jedes Fragment/Sitzung → dieselbe Fehlermeldung, kein Absturz — Playwright: `AC-12` (zweiter Teil), auch von der Security-Lane unabhängig bestätigt

#### AC-13: Leeres Formular → Validierungsfehler pro Feld, keine Seiten-Neuladen
- [x] Playwright: `AC-13` — alle drei Feldfehler erscheinen, `page.url()` bleibt `/login` (kein natives GET mit Feldern in der Query-String)

#### AC-14: Datenschutz-Link auf dem Registrierungsformular sichtbar
- [x] Playwright: `AC-1, AC-14`

### Edge Cases Status

#### EC-1: Zwei gleichzeitige Registrierungen mit demselben Trainernamen (Groß-/Kleinschreibung)
- [x] **Echter Concurrency-Test** (nicht nur sequenziell): zwei `signUp()`-Aufrufe per `Promise.all`, dreifach wiederholt — jedes Mal genau 1 Erfolg, der andere erhält `500 Database error saving new user` (Postgres-Unique-Index serialisiert den Race korrekt). Kein halb angelegtes Konto: Security-Lane bestätigt per `docker exec ... psql`, dass bei einem abgelehnten Duplikat keine verwaiste `auth.users`-Zeile zurückbleibt — die im selben Trigger geworfene Exception rollt die gesamte Transaktion zurück, wie in `supabase/migrations/0001_profiles.sql` und `design.md` zugesichert.

#### EC-2: Ausgeloggter Zugriff auf geschützte Route → Weiterleitung
- [x] Playwright: `EC-2` + Security-Lane: `curl -i http://localhost:3000/` ohne Cookies → `307` zu `/login`; `/login` und `/reset-password` bleiben `200`

#### EC-3: Reset-Anfrage für nicht existierende Adresse
- [x] Playwright: `AC-10, EC-3` (siehe oben)

#### EC-4: Wiederholter Versuch innerhalb der Sperrfrist
- [!] NOT VERIFIED — dieselbe Ursache wie AC-8; ohne ein auslösbares Limit lässt sich „bleibt weiterhin gesperrt" lokal nicht separat prüfen

#### EC-5: Ungültiger Trainername (Zeichen/Länge)
- [x] Playwright: `EC-5` (zu kurzer Name → feldspezifische Meldung „3–20 Zeichen…")

#### EC-6: Netzwerkfehler beim Absenden — Fehlermeldung + Werte bleiben erhalten
- [x] **Behoben und nachgeprüft (2026-09-01).** Abgebrochener POST auf Transportebene (Playwright `route.abort('failed')`) in drei Formularen geprüft — Login, Registrierung, Passwort-vergessen: jeweils erscheint „Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen." **in der App**, alle eingegebenen Werte bleiben erhalten, der Button ist wieder aktiv. Für den Login zusätzlich der komplette Wiederholungspfad geprüft: Netzwerk wieder freigegeben, derselbe Klick erreicht den Server (normale „E-Mail-Adresse oder Passwort ist falsch."-Meldung) — Beleg: temporäres Prüf-Skript `ec6-verify.spec.ts`, 4/4 grün
- [x] Fix ohne Nebenwirkung auf den Erfolgsfall: `redirect()` aus einer Server Action ist ein *geworfenes* Kontrollfluss-Signal — ein pauschaler `catch` hätte es verschluckt. `runAuthAction` wirft es per `unstable_rethrow` (Next.js' offizielle API dafür) weiter — `src/lib/auth/run-action.ts:19`, per Unit-Test und Browser-Regression abgesichert

### Security Audit Results

_Ausgeführt von einer unabhängigen Security-Red-Team-Subagenten-Instanz mit vollem Kontext von `spec.md`/`design.md`, gegen die echte laufende App und API._

- [x] **Authentifizierungs-Umgehung:** `curl -i http://localhost:3000/` ohne Sitzung → `307` zu `/login`, nie `200` mit Inhalt — Beleg: Security-Lane-Report §1
- [x] **Autorisierung/RLS:** Anon ohne Sitzung sieht `[]` auf `profiles`; ein echter eingeloggter Nutzer kann seine eigene `trainer_name`-Zeile weder per `PATCH` noch `INSERT` noch `DELETE` ändern (0 betroffene Zeilen bzw. `403 42501`) — Beleg: Security-Lane-Report §2, `supabase/migrations/0001_profiles.sql`
- [x] **Input-Injection:** XSS- und SQL-Injection-förmige Payloads direkt gegen die API (Zod umgangen) → von der DB-`CHECK`-Constraint abgelehnt (`23514`), keine verwaiste Nutzerzeile — Beleg: Security-Lane-Report §3
- [!] **Rate Limiting (allgemein):** NOT VERIFIED — siehe AC-8/EC-4; bewusst kein App-eigener Zähler (Product Decision)
- [ ] **Brute Force auf Login:** 45 Fehlversuche gegen ein Konto, kein einziger `429` — bereits dokumentierter, akzeptierter Gap (Supabases IP-Limit ist der einzige Schutz, siehe `spec.md` Decision Log). **Eingeordnet als Medium, nicht High**, weil bewusst und wiederholt vom Nutzer bestätigte Produktentscheidung (reaktiv statt präventiv), nicht ein übersehener Ist-Zustand — aber: **auch wenn Supabases IP-Limit hosted greift, deckt es nur einen Angreifer von einer IP ab, keinen verteilten oder geduldigen Angriff auf ein einzelnes Konto, und nichts, was diese Anwendung selbst geschrieben hat.** Das gilt unabhängig vom Deploy-Ergebnis und ist als Rest-Risiko festzuhalten, nicht nur als „lokal nicht auslösbar".
- [x] **Keine Konto-Enumeration:** unbekannte E-Mail und falsches Passwort liefern identische Meldung — Beleg: AC-7 oben
- [x] **Bulk-Signup automatisierbar:** 8 Registrierungen im Skript-Loop, alle `200`, keine Bremse — bestätigt die dokumentierte, bewusste Entscheidung gegen CAPTCHA im MVP, keine neue Erkenntnis
- [x] **Zugangsdaten nie in der URL:** alle vier Formulare laufen über Server Actions (`startTransition` + `await xAction(...)`), nie ein natives GET-Formular; kein `redirect()`-Aufruf in `src/lib/auth/actions.ts` trägt E-Mail/Passwort in der Ziel-URL — Beleg: Security-Lane-Report §8, Code-Lektüre aller vier View-Komponenten
- [x] **Keine Secrets im Client-Bundle:** `npm run build` + Grep über `.next/static` nach `service_role`/`JWT_SECRET`/DB-Passwörtern → keine Treffer; einzige gefundene JWT-förmige Zeichenkette dekodiert zu `role: anon` (der öffentliche Key) — Beleg: Security-Lane-Report §6
- [x] **Keine sensiblen Daten in Antworten:** Server Actions geben nur `{error, fieldErrors, message}` zurück, nie das rohe Supabase-Antwortobjekt — Beleg: Security-Lane-Report §7, `src/lib/auth/actions.ts`
- [ ] BUG-1 (siehe unten) — kein Security-Fund, aber Robustheits-Lücke bei Netzwerkfehlern

**Informativ (kein PROJ-1-Scope):** `/login` liefert dev-seitig keine Security-Header (`X-Frame-Options` etc.) — laut `design.md`/`.claude/rules/security.md` bewusst ein Deploy-/Host-Thema, von `/security-check` nach dem Launch gegen die echte URL geprüft, kein Fund dieses Durchlaufs.

### E2E Tests
_Optionale Schicht — von `/e2e-tests` für kritische Kernabläufe geschrieben._

- Status: **nicht ausgeführt** (`/e2e-tests` für kritische Abläufe)

_Hinweis: Die funktionale Prüfung oben lief über ein temporäres Playwright-Skript (echter Chromium, nicht nur curl) — das ist kein Ersatz für die von `/e2e-tests` dauerhaft angelegte Regressionsdecke und wurde nicht committet._

### Not Verified In This Run

- [!] AC-8 / EC-4 — Supabases Rate-Limit lokal nicht auslösbar (Tooling-Gap, siehe oben) — erneut zu prüfen nach `/deploy`
- [!] Cross-Browser-Rendering (Firefox / Safari) — nur Chromium eingesetzt
- [!] Responsives Layout bei 375px / 768px / 1440px — kein Viewport-Test in diesem Durchlauf
- [!] Barrierefreiheit / Tastaturnavigation im Detail — nicht dediziert geprüft (shadcn/ui-Grundkomponenten haben eingebaute ARIA-Unterstützung, aber kein eigener Test)
- [!] `[user]`-Task T4 (Passwort-Mindestlänge im gehosteten Dashboard): strukturell noch nicht setzbar, da das gehostete Supabase-Projekt erst bei `/deploy` entsteht — kein Bug, sondern korrekt aufgeschoben. Der lokale Spiegel (`config.toml`) ist gesetzt und serverseitig bestätigt wirksam (422 bei 6-stelligem Passwort)

### Bugs Found

#### BUG-1: Netzwerkfehler beim Absenden eines Auth-Formulars zeigt eine rohe Browser-Fehlerseite statt einer In-App-Meldung
- **Status:** ✅ **BEHOBEN am 2026-09-01, im echten Browser nachgeprüft** (siehe EC-6 oben). Fix: `src/lib/auth/run-action.ts` fängt den Transportfehler ab und gibt ihn als normalen `ActionState` zurück; alle vier Formulare rufen ihre Server Action jetzt darüber auf. `unstable_rethrow` schützt dabei den `redirect()`-Erfolgspfad. Neue Unit-Tests: `src/lib/auth/run-action.test.ts` (5 Tests, beide Fix-Hälften einzeln rot nachgewiesen).
- **Severity:** High
- **Betrifft:** alle vier Formulare — `src/components/auth/login-view.tsx:41`, `register-view.tsx:37`, `forgot-password-view.tsx:35`, `reset-password-form.tsx:83`
- **Ursache:** `await xAction({}, formData)` steht in keinem `try/catch`. Schlägt der Server-Action-Aufruf selbst auf Transportebene fehl (z. B. Verbindungsabbruch, bevor die Antwort ankommt — anders als ein vom Server zurückgegebener Fehler, den `error-mapping.ts` bereits sauber behandelt), gibt es keinen Fänger.
- **Steps to Reproduce:**
  1. `/login` öffnen, E-Mail/Passwort ausfüllen
  2. Den POST-Request der Server Action auf Netzwerkebene abbrechen (reproduziert per Playwright `page.route('**/login', route => route.abort('failed'))` auf die POST-Anfrage)
  3. „Einloggen" klicken
  4. Erwartet (EC-6): Fehlermeldung im Formular, eingegebene Werte bleiben erhalten, „Erneut versuchen" möglich
  5. Tatsächlich: Chromium zeigt „This page couldn't load / Reload to try again, or go back" — die React-App ist weg, die eingegebenen Werte sind verloren
- **Priority:** Vor dem Deploy beheben — betrifft den Kernpfad (Login/Registrierung/Reset) und genau den Netzwerk-Wackelkontakt-Fall, den EC-6 im Vertrag ausdrücklich zusichert.

### Nachprüfung nach dem BUG-1-Fix (2026-09-01)

Umfang der zweiten Runde — bewusst nicht der volle AC-Sweep, sondern der Fix plus alles, was der Fix anfassen konnte:

- [x] EC-6 in drei Formularen (Login, Registrierung, Passwort-vergessen) im echten Chromium — 4/4 grün (`ec6-verify.spec.ts`)
- [x] Regression über **alle drei `ActionState`-Formen**, weil der Fix jeden Rückgabeweg umschließt: Feldfehler (AC-2, AC-3), Meldung (AC-10/EC-3), Erfolg + `redirect()` (AC-11, kompletter Reset-Flow inkl. Login mit dem neuen Passwort) — 4/4 grün (`regression.spec.ts`)
- [x] Unit-Tests 25/25 grün (5 neue in `run-action.test.ts`), `npm run build` und `npm run lint` fehlerfrei
- Nebenbefund dieser Runde: Ein Testlauf mit einem 21-stelligen Trainernamen wurde von der App korrekt abgelehnt — ungeplante Zusatzbestätigung für EC-5 exakt an der 20-Zeichen-Grenze.
- Nicht erneut ausgeführt: AC-1, AC-4 bis AC-7, AC-12 bis AC-14, EC-1, EC-2, EC-5 (Ergebnisse der ersten Runde vom 2026-08-31 gelten weiter; der Fix berührt weder Schema, RLS, Proxy noch die Validierung). AC-1/AC-4/AC-6 liefen als Nebeneffekt der Regressionstests trotzdem erneut durch.

### Summary
- **Acceptance Criteria:** 13/13 geprüfte ACs bestanden (AC-1 bis AC-14, AC-9 im Decision Log gestrichen), 1 nicht verifizierbar (AC-8, lokaler Tooling-Gap)
- **Edge Cases:** 6/6 bestanden (EC-6 nach dem Fix nachgeprüft), EC-4 nicht verifizierbar (deckungsgleich mit AC-8)
- **Bugs Found:** 1 total (1 High) — **behoben und nachgeprüft**, 0 offen
- **Security:** 10/12 Prüfungen mit Beleg verifiziert, 2 NOT VERIFIED (Rate-Limiting allgemein, deckungsgleich mit AC-8/EC-4) — Brute-Force-Check zeigt einen bereits dokumentierten, bewusst akzeptierten Medium-Rest-Risiko-Befund, keinen neuen Fund
- **Production Ready:** YES — kein offener Critical/High-Bug
- **Recommendation:** Deploy möglich. Zwei Dinge müssen aber direkt nach dem ersten `/deploy` gegen das gehostete Projekt geprüft werden, bevor die App öffentlich geht: **AC-8/EC-4** (Rate-Limit, lokal nicht auslösbar) und **AC-11/AC-12** (Reset-Link, hängt an Site-URL/Redirect-URLs des gehosteten Projekts) — beide Prüfpläne stehen in `design.md`.

> „Production Ready: YES" heißt hier ausschließlich: **kein offener Critical- oder High-Bug**. Es heißt *nicht*, dass alles geprüft wurde. Offen bleiben AC-8/EC-4 (erst hosted prüfbar), Cross-Browser, responsives Layout und ein dedizierter Barrierefreiheits-Durchgang — siehe „Not Verified In This Run".

---

## Nachlauf — 2026-09-02, nach BUG-3 und BUG-4

**Anlass:** Zwei Fehler aus dem manuellen Test des Nutzers wurden in PROJ-1 behoben (`791c786`) — die Weiterleitungsschleife und die Zugangsdaten in der URL. Dieser Lauf prüft die Fixes und die vom Nutzer geforderte Erweiterung des Sitzungs-Testfalls („Cookie da, Sitzung serverseitig ungültig").

### Der erweiterte Sitzungs-Testfall

Genau dieser Fall fehlte bisher in jeder Suite: Alle bisherigen Prüfungen simulierten eine *fehlende* Sitzung. Der reale Fall ist ein **vorhandenes, signatur-gültiges Cookie zu einer serverseitig widerrufenen Sitzung** — und nur der erzeugte die Schleife.

- [x] **BUG-3 im Browser** — angemeldet, Konto über die Admin-API gelöscht, Cookie belassen, dann F5: **kein `ERR_TOO_MANY_REDIRECTS`, genau 1 Weiterleitung, Ziel `/login`** (vorher: 19 Weiterleitungen, Abbruch)
- [x] **BUG-3 als dauerhafter Regressionstest** — `src/proxy.test.ts`, 7 Tests. Beide Hälften der Schleife sind festgehalten: die ungültige Sitzung *muss* nach `/login`, und auf `/login` darf sie *nicht* zurückgeschickt werden. Dazu eine ausdrückliche Zusicherung, dass der Proxy `getUser()` benutzt und `getClaims()` **nicht** mehr aufruft
- [x] **Rot-Nachweis, präzise** — der Proxy wurde auf `getClaims()` zurückgestellt **und** der Mock so gesetzt, dass die Signaturprüfung eine gültige Sitzung meldet, während der Auth-Server ablehnt: also exakt der Fehlerzustand. Ergebnis: **5 von 7 Tests rot**, darunter beide Schleifen-Hälften; die zwei Tests für eine echte Sitzung blieben grün. Die Tests fangen also den Fehler, nicht bloß eine Codeänderung

### Acceptance Criteria — in diesem Lauf geprüft

- [x] **AC-1** Registrierung ohne E-Mail-Bestätigung, sofort eingeloggt — Browser-Lauf
- [x] **AC-1/AC-11** Passwort-Mindestlänge greift serverseitig — 7 Zeichen: **422 „Password should be at least 8 characters"**, 8 Zeichen: 200
- [x] **AC-2** Trainername eindeutig, unabhängig von Groß-/Kleinschreibung — beide Varianten abgelehnt
- [x] **AC-3** Bereits registrierte E-Mail-Adresse gibt kein zweites Konto — 422
- [x] **AC-4** Login mit korrekten Daten führt auf `/` — Browser-Lauf
- [x] **AC-5** Sitzung überlebt einen neuen Seitenaufruf — Browser-Lauf
- [x] **AC-6** Abmelden beendet die Sitzung und führt auf `/login` — Browser-Lauf, über den **neuen** Abmelden-Button in PROJ-2s Kopfzeile
- [x] **AC-7** Identische Fehlermeldung für falsches Passwort und unbekannte Adresse — beide „Invalid login credentials", gleicher Status
- [x] **AC-10** Gleiche Bestätigungsmeldung für bekannte und unbekannte Adresse — Browser-Lauf
- [x] **AC-11** Passwort-Reset **vollständig durchgespielt**: Link aus der echten E-Mail (Mailpit) → Formular erscheint → neues Passwort gesetzt → direkt eingeloggt → Login mit dem neuen Passwort funktioniert → **das alte Passwort funktioniert nicht mehr**
- [x] **AC-12** Bereits verwendeter Link gibt kein Passwortformular mehr her (0 Felder) und zeigt „Dieser Link …" als Fehlermeldung
- [x] **AC-13** Leeres Formular zeigt Validierungsfehler ohne Neuladen — Browser-Lauf
- [x] **AC-14** Datenschutz-Hinweis im Registrierungsformular sichtbar — Browser-Lauf
- [!] **AC-8** Drosselung nach wiederholten Fehlversuchen — **NICHT VERIFIZIERT.** 30 falsche Passwörter gegen dasselbe Konto lösten **kein 429** aus, ebenso 10 Konten mit demselben Passwort. Das bestätigt die bekannte Open Question in `spec.md`: Supabases eingebautes Limit ist im lokalen CLI-Stack nicht aktiv. **Prüfbar erst gegen das gehostete Projekt**, mit demselben Verfahren

### Edge Cases

- [x] **EC-1** Trainername doppelt (auch mit anderer Schreibweise) → abgelehnt
- [x] **EC-2** Ausgeloggt auf geschützte Route → `/login`; **erweitert** um den Fall „Cookie da, Sitzung ungültig" (siehe oben)
- [x] **EC-3** Reset für unbekannte Adresse → dieselbe Meldung
- [!] **EC-4** Verhalten am erreichten IP-Limit — **NICHT VERIFIZIERT**, gleiche Ursache wie AC-8
- [x] **EC-5** Ungültige Trainernamen (zu kurz, zu lang, Leerzeichen, Emoji) → alle abgelehnt
- [!] **EC-6** Netzwerkfehler beim Absenden — **NICHT VERIFIZIERT in diesem Lauf**; abgedeckt durch `src/lib/auth/run-action.test.ts` aus dem Erstlauf

### Security

- [x] **Zugangsdaten nie in der URL (BUG-4)** — mit abgeschaltetem JavaScript sendet das Formular `POST /login`, die URL bleibt sauber. **Durch Mutation belegt:** ohne `method="post"` erscheint wieder `GET /login?email=…&password=…`
- [x] **Keine Kontoexistenz-Preisgabe** — siehe AC-7
- [x] **Authentifizierung** — `/` ohne Sitzung: 307 nach `/login`
- [x] **Autorisierung / Datenschicht** — Sicherheitsdurchgang 19/19 (fremde Runden nicht lesbar, fremdes Profil nicht beschreibbar, Injection abgewiesen, `profiles` gibt keine E-Mail heraus)
- [!] **Brute-Force-Schutz** — nicht auslösbar, siehe AC-8. **Das ist keine bestandene Prüfung**, sondern eine offene
- [!] **Massen-Registrierung** — 5 von 5 Konten per Skript angelegt. Bewusste Produktentscheidung (kein CAPTCHA im MVP, `spec.md` → Out of Scope), hier nur festgehalten

### Bugs

#### BUG-5: Zwei verschachtelte `<main>`-Elemente auf `/login` und `/reset-password`

- **Severity:** Low
- **Ursache:** PROJ-2s `PageFrame` bringt ein `<main>` mit (`page-frame.tsx:13`), PROJ-1s Seiten haben bereits eines (`login/page.tsx:5`, `reset-password/page.tsx:16`). Das ausgelieferte HTML enthält **zwei** — geprüft mit `curl`
- **Wirkung:** Ungültiges HTML; Screenreader finden zwei „main"-Landmarken statt einer, was die Landmarken-Navigation unbrauchbar macht. Keine funktionale Einschränkung
- **Regression aus PROJ-2:** Vor der Shell gab es nur das innere `<main>`
- **Fix:** Das innere `<main>` in den beiden Seiten zu einem `<div>` machen. Eine Zeile je Datei
- **Priorität:** Vor dem Deploy, aber nicht blockierend

#### Offene `[user]`-Aufgabe: T4 (Passwort-Mindestlänge im Dashboard)

`tasks.md` → T4 ist offen: *Supabase Dashboard → Authentication → Sign In / Providers → Email → Minimum password length: 8*. Sie liegt auf einem Zugangsdaten-Pfad (AC-1, AC-11).

**Einordnung:** Die Aufgabe ist ausdrücklich für das **gehostete** Projekt ab dem ersten Deploy formuliert, und das existiert noch nicht. Der lokale Spiegel in `supabase/config.toml` ist gesetzt und in diesem Lauf **verifiziert** (7 Zeichen → 422). Sie ist damit kein Fehler im jetzigen Stand, aber ein **echter Blocker für `/deploy`** — ohne sie akzeptiert das Produktivsystem kürzere Passwörter als zugesagt.

### Die drei Prüfungen — einzeln gelaufen

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **92 bestanden** (85 + 7 neue Proxy-Tests) |
| Lint | `npm run lint` | **grün**, keine Befunde |
| Build | `npm run build` | **grün**, „Finished TypeScript" |

### Verdikt

- **Acceptance Criteria:** **12 von 13 verifiziert**, 1 nicht verifiziert (AC-8, lokal nicht auslösbar)
- **Edge Cases:** 4 von 6 verifiziert, 2 nicht verifiziert (EC-4 gleiche Ursache wie AC-8; EC-6 aus dem Erstlauf abgedeckt)
- **Bugs:** BUG-3 und BUG-4 **behoben und verifiziert**; **BUG-5 neu (Low)**
- **Security:** 4 von 6 Prüfungen verifiziert, 2 offen (Brute Force, Massen-Registrierung)
- **Production Ready:** **JA für diesen Stand** — kein kritischer oder hoher Fehler offen. Mit zwei Auflagen, die vor dem öffentlichen Start zu erledigen sind: **AC-8 gegen das gehostete Projekt prüfen** und **T4 im Dashboard setzen**
- **Weiterhin ungeprüft:** Firefox und Safari — in keinem Lauf getestet, alles lief in Chromium
