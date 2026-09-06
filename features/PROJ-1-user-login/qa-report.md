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
- **Status: behoben am 2026-09-02.** Beide Seiten verwenden jetzt ein `<div>`; das ausgelieferte HTML enthaelt auf `/login` und `/reset-password` genau **ein** `<main>` (geprueft mit `curl`), Fusszeile und Inhalt unveraendert vorhanden

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
- **Production Ready:** **JA für diesen Stand** — kein kritischer oder hoher Fehler offen. Mit ~~zwei~~ **drei** Auflagen, die vor dem öffentlichen Start zu erledigen sind: **AC-8 gegen das gehostete Projekt prüfen**, **T4 im Dashboard setzen** und **den Warnhinweis am Trainername-Feld ergänzen** (dritte Auflage nachgetragen am 2026-09-03, siehe Nachtrag unten)
- **Weiterhin ungeprüft:** Firefox und Safari — in keinem Lauf getestet, alles lief in Chromium

---

## Nachtrag — 2026-09-03: Deploy-Blocker aus der Datenschutzprüfung zu PROJ-3

**Herkunft:** Dies ist **kein Befund aus einem QA-Lauf.** Er stammt aus `/dsgvo PROJ-3` vom 2026-09-03 und wird hier vermerkt, weil er PROJ-1 betrifft und in dieselbe Reihe gehört wie AC-8 und T4: etwas, das den jetzigen Stand nicht kaputt macht, aber vor dem öffentlichen Start erledigt sein muss.

### Offener Vertragsmangel: Der Trainername wird veröffentlicht, ohne dass die Registrierung es sagt

**Sachverhalt.** Drei Festlegungen greifen ineinander, jede für sich unauffällig:

1. `spec.md` → AC-1 nimmt den Trainernamen bei der Registrierung entgegen.
2. `spec.md` → Decision Log: „Trainername ist nach der Registrierung dauerhaft fix." Es gibt keinen Änderungsweg — auch nicht in der Datenbank, wo `0001_profiles.sql` bewusst **keine** `update`-Policy hat.
3. `0001_profiles.sql` macht den Namen für **alle angemeldeten Nutzer** lesbar (`profiles_select_authenticated`).

**Kein einziges AC verlangt, dass der Nutzer davon erfährt.** AC-14 fordert lediglich einen sichtbaren Link zur Datenschutzerklärung vor dem Absenden — das ist eine andere Zusage.

**Warum es erst jetzt auffällt.** Bis einschließlich PROJ-2 war der Trainername zwar für angemeldete Nutzer *lesbar*, wurde aber an keiner Stelle der Oberfläche **angezeigt**. Der Nutzer-Chip in der Kopfzeile zeigt jedem nur seinen eigenen. PROJ-3 ist der erste Ort, an dem der Name tatsächlich vor anderen Menschen erscheint — und dann unwiderruflich.

**Wirkung.** Ein Nutzer trägt seinen echten Namen ein, ohne zu wissen, dass er für alle anderen Spieler sichtbar und nachträglich nicht mehr änderbar ist. Der einzige Rückweg ist das Löschen des gesamten Kontos, und den gibt es erst mit PROJ-4. Das Publikum schließt laut `docs/PRD.md` absehbar Minderjährige ein — genau der Grund, aus dem dort die Datenschutz-Haltung `standard` gewählt wurde.

**Was mindestens fehlt.** Ein Warnhinweis am Trainername-Feld im Registrierungsformular, der **beide** Hälften sagt: für andere Spieler sichtbar **und** später nicht änderbar. Eine Hälfte allein genügt nicht — „öffentlich" ohne „endgültig" verschweigt genau den Teil, der die Entscheidung unumkehrbar macht.

**Priorität: Blocker für `/deploy`**, gleichrangig mit AC-8 und T4. Ein Unterschied zu jenen beiden: Die sind erst gegen das gehostete Projekt prüfbar — dieser hier ist **sofort behebbar**.

**Der Weg dorthin.** Der Hinweis ändert das Verhalten von PROJ-1 und braucht deshalb ein eigenes Acceptance Criterion. Route laut `.claude/rules/general.md` → Change Routing: **`/refine PROJ-1`** (AC ergänzen) → `/build` → `/qa`. `spec.md` wird **nicht** auf diesem Weg angefasst; sie ist der Vertrag und gehört `/refine`.

**Nicht Teil dieses Blockers, aber offen:** ob der Trainername (mindestens einmalig) änderbar sein sollte. Das ist eine Rechtsfrage, keine QA-Frage — sie liegt in `docs/privacy.md` → „Für einen Anwalt / Datenschutzbeauftragten".

---

## QA-Lauf — 2026-09-03, nach AC-15 (Hinweis am Trainername-Feld)

**Anlass:** `/build` hat T14 umgesetzt (AC-15). Geprüft wurde jedoch **nicht nur das Delta**: Alle 15 AC-IDs und 6 EC-IDs wurden in diesem Lauf neu verifiziert, ohne ein einziges Häkchen aus den Läufen vom 2026-09-01 und 2026-09-02 zu übernehmen. Das war eine bewusste Entscheidung — und sie hat sich gelohnt: Zwei der drei High-Bugs unten sind **Altlasten**, die in den früheren Läufen nicht gefunden wurden und nichts mit AC-15 zu tun haben.

**Aufbau:** Zwei `qa-engineer`-Verifizierer in getrennten Kontexten, die den Build nicht gesehen haben — Bahn A (Acceptance + Regression + Testsuite), Bahn B (Security-Red-Team). Beide gegen die laufende App (`http://localhost:3000`) und das lokale Supabase. Zusammenführung, Bewertung und dieser Report: Hauptkontext.

**Bug-Nummerierung:** Die Bahnen haben unabhängig voneinander bei BUG-1 begonnen. Hier durchnummeriert ab **BUG-6**, weil BUG-1/3/4/5 in diesem Feature bereits vergeben sind.

### Acceptance Criteria

| ID | Ergebnis | Beleg |
|----|----------|-------|
| AC-1 | [x] PASS | `registerAction` per HTTP → `x-action-redirect: /`, DB-Gegenprobe: Profil angelegt, Passwort bcrypt, keine Bestätigung nötig. Passwort < 8 → Feldfehler; Supabase lehnt zusätzlich serverseitig ab (`422 weak_password`) |
| AC-2 | [x] PASS | Registrierung mit kleingeschriebener Variante eines vergebenen Namens → Feldfehler; Durchsetzung per `profiles_trainer_name_lower_key` (`0001_profiles.sql:13`) |
| AC-3 | [x] PASS | Vergebene E-Mail → Feldfehler mit Login-Link (`error-mapping.ts:43-45`, `register-view.tsx:86-96`) |
| AC-4 | [x] PASS | Korrekter Login → `x-action-redirect: /;push` + Session-Cookie; im Browser bestätigt |
| AC-5 | [x] PASS | Cookie ist persistent (`Max-Age=34560000`), nicht sitzungsgebunden; `storageState` in frischem Browser-Kontext → `/` liefert 200 mit Startbildschirm |
| AC-6 | [x] PASS | `logoutAction` → Cookie `Max-Age=0`, Redirect `/login`; danach `/` → 307 |
| AC-7 | [x] PASS | Falsches Passwort und unbekannte Adresse liefern **identischen** String, in curl und Browser; `error-mapping.ts:61-67` verzweigt nur bei 429 |
| AC-8 | [!] **FAIL (lokal)** / NOT VERIFIED (hosted) | 35 Fehl-Logins in Folge, **kein einziges 429**, danach loggt das korrekte Passwort normal ein. Ursache belegt: `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt im lokalen Auth-Container, obwohl `config.toml:209` es setzt. → **BUG-7** |
| AC-10 | [x] PASS | Gleiche Meldung unabhängig von Kontoexistenz; Mailpit enthält genau **eine** Mail (für die existierende Adresse), keine für die unbekannte |
| AC-11 | [!] **TEILWEISE** | Im **selben** Browser vollständig grün (Reset angefordert → Mail → Link → neues Passwort → Login damit erfolgreich). **Über Gerätegrenzen hinweg gebrochen** → **BUG-6** |
| AC-12 | [x] PASS | Benutzter und tokenloser Link → „Dieser Link ist ungültig oder abgelaufen." + „Neuen Link anfordern"; serverseitig zusätzlich abgesichert (`actions.ts:146-151`) |
| AC-13 | [x] PASS | Leere Formulare → alle Feldfehler gleichzeitig; `framenavigated` auf dem Hauptframe **nicht** ausgelöst → kein Reload |
| AC-14 | [!] **Wortlaut erfüllt, Ziel defekt** | Link „Datenschutzerklärung" sichtbar mit `href="/privacy"` (`register-view.tsx:114-120`) — aber `GET /privacy` → **404** → **BUG-10** |
| AC-15 | [x] PASS | Hinweistext ohne Klick/Hover sichtbar (`register-view.tsx:68-71`), keine Checkbox im Formular; Unit-Tests grün |

_AC-9 existiert nicht — laut Decision Log gestrichen._

### Edge Cases

| ID | Ergebnis | Beleg |
|----|----------|-------|
| EC-1 | [x] PASS | 3 **parallele** Registrierungen mit demselben Trainernamen → 1 Erfolg, 2 Ablehnungen; DB: genau 1 Profil, **0** verwaiste `auth.users` ohne Profil. Zweiter Lauf mit Groß-/Kleinvarianten identisch. Garantie im Code bestätigt: Unique-Index + `SECURITY DEFINER`-Trigger in derselben Transaktion (`0001_profiles.sql:13,28-51`) |
| EC-2 | [x] PASS | `/`, `/?x=1`, `/some/deep/path`, `/api/whatever`, `/nonexistent` → alle 307 auf `/login` (Query bleibt erhalten); `/login`, `/reset-password` → 200; eingeloggt auf `/login` → 307 auf `/` |
| EC-3 | [x] PASS | Unbekannte Adresse → identische Meldung, **keine** zusätzliche Mail in Mailpit |
| EC-4 | [!] NOT VERIFIED / FAIL lokal | Deckungsgleich mit AC-8: Wo das Limit gar nicht greift, kann „bleibt weiterhin gesperrt" nicht eintreten |
| EC-5 | [x] PASS | Leerzeichen, 2 Zeichen, 21 Zeichen, Emoji → jeweils feldspezifische Ablehnung; DB-CHECK zusätzlich vorhanden |
| EC-6 | [!] **TEILWEISE FAIL** | Auth-Container per `docker pause` angehalten: Registrierung meldet korrekt „Verbindung fehlgeschlagen"; **Login meldet „E-Mail-Adresse oder Passwort ist falsch."** → **BUG-9** |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis | Beleg |
|---------|----------|-------|
| Authentication Bypass | [x] PASS | Ohne Session: `/` und `/api` → 307 auf `/login`; Guard `src/proxy.ts:52-56`, serverautoritative Prüfung per `getUser()` |
| Autorisierung (Datenbankebene) | [x] PASS | Zweites Konto liest fremde Runden → `[]`; gefälschter `profile_id`-INSERT → `403 / 42501`. Anon ohne Session sieht auf `profiles` und `runs` nichts |
| Input Injection | [x] PASS | XSS-Trainername **unter Umgehung der App-Validierung** direkt an Supabase → vom DB-CHECK abgelehnt. Defense in Depth wirkt (Zod **und** Constraint) |
| Brute Force auf Zugangsdaten | [!] **FAIL** | 35 Versuche ohne Drosselung → BUG-7 |
| Account-Enumeration (Login/Reset) | [x] PASS | Identische Meldungen und Codepfade (`error-mapping.ts:61-75`) |
| Account-Enumeration (Registrierung) | [x] Bekannt, by design | Vergebene E-Mail wird offen gemeldet — dokumentierte Produktentscheidung (2026-08-31), kein Bug |
| Bulk-Signup | [!] NOT VERIFIED — nicht implementiert | 10 Konten per Schleife angelegt, alle 200, kein CAPTCHA. AC-9 bewusst gestrichen; reaktiv geplant |
| Exponierte Secrets | [x] PASS | `.next/` durchsucht: kein Service-Role-Key, kein `SECRET_KEY`, kein `JWT_SECRET` im Bundle. Nur `NEXT_PUBLIC_*` erreicht den Client |
| Sensible Daten in API-Antworten | [x] PASS | `profiles` gibt nur `id` + `trainer_name` heraus, keine E-Mail |
| Zugangsdaten in der URL | [x] PASS | Alle vier Formulare `method="post"`, kein nativer GET-Fallback |
| Security-Header | [!] **FAIL** | Keiner von `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` gesetzt → **BUG-12** |

### Bugs

#### BUG-6: Passwort-Reset funktioniert nur in dem Browser, in dem er angefordert wurde
- **Severity: High** · betrifft **AC-11**
- **Ursache:** Der Reset-Link ist PKCE. Der `code_verifier` liegt als Cookie **auf dem anfordernden Gerät** (`Set-Cookie: sb-127-auth-token-code-verifier=…` in der Antwort von `requestPasswordResetAction`). Ohne dieses Cookie ist der Tausch nicht möglich.
- **Reproduktion:** Konto anlegen → in Browser-Kontext A „Passwort vergessen?" absenden → Link aus dem Postfach in **frischem** Kontext B öffnen → „Dieser Link ist ungültig oder abgelaufen.", obwohl der Link frisch und unbenutzt ist.
- **Wirkung:** Genau der Alltagsfall „am Rechner anfordern, Mail am Handy öffnen" ist gebrochen — und die Meldung ist dabei **sachlich falsch**: Sie behauptet einen abgelaufenen Link, wo ein gültiger vorliegt. Der Nutzer fordert einen neuen an, mit demselben Ergebnis. Das ist eine Sackgasse für jeden, der sein Passwort wirklich vergessen hat.
- **Nicht durch AC-15 verursacht** — Altlast, in den Läufen vom 01./02.09. nicht entdeckt, weil dort nur innerhalb **eines** Kontexts geprüft wurde. `design.md` → Technical Decisions behauptet, die clientseitige Lösung decke „beide Formen" ab; für PKCE über Gerätegrenzen gilt das nicht.

#### BUG-7: Keine wirksame Drosselung auf dem Zugangsdaten-Pfad (lokal nachgewiesen)
- **Severity: High** · betrifft **AC-8, EC-4**
- 35 Fehl-Logins gegen dasselbe Konto von derselben IP: keine einzige Ablehnung; danach loggt das korrekte Passwort normal ein.
- **Ursache belegt:** `docker exec … env | grep RATE_LIMIT` zeigt, dass `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` im lokalen Auth-Container **nicht gesetzt** ist, obwohl `supabase/config.toml:209` `sign_in_sign_ups = 30` konfiguriert.
- **Einordnung:** Inhaltlich die bekannte Open Question — neu ist die Beweislage. Bisher stand „nicht verifizierbar"; jetzt ist **demonstriert**, dass unbegrenztes Durchprobieren lokal funktioniert. Die App hat bewusst keinen eigenen Zähler (Produktentscheidung); der einzige vorgesehene Schutz ist Supabases Per-IP-Regel — die auch im funktionierenden Zustand weder verteilte noch geduldige kontobezogene Angriffe stoppt.
- **Nicht lokal reparierbar**, aber vor dem Livegang verifizierungspflichtig.

#### BUG-8: Offene `[user]`-Aufgabe T4 auf dem Zugangsdaten-Pfad
- **Severity: High** (nach QA-Regel für offene `[user]`-Tasks auf Credential-Pfaden) · betrifft **AC-1, AC-11**
- `tasks.md:17` — Passwort-Mindestlänge 8 im gehosteten Supabase-Projekt: nicht abgehakt.
- **Entlastender Kontext:** Der lokale Spiegel ist gesetzt **und nachweislich wirksam** (`config.toml:184`; direkter API-Signup mit 5 Zeichen → `422 weak_password`). Das gehostete Projekt existiert noch nicht, die Aufgabe ist also strukturell nicht erledigbar — kein Versäumnis, aber ein echtes Gate vor `/deploy`.

#### BUG-9: Login meldet bei Supabase-Ausfall „falsches Passwort" statt Netzwerkfehler
- **Severity: Medium** · betrifft **EC-6**
- `error-mapping.ts:61-67`: `mapLoginError` verzweigt nur auf 429; jeder andere Fehler — auch ein Transportfehler ohne Status — fällt auf `WRONG_CREDENTIALS_MESSAGE`.
- **Reproduktion:** `docker pause supabase_auth_…`, dann Login mit **korrekten** Zugangsdaten → nach ~61 s „E-Mail-Adresse oder Passwort ist falsch."
- **Wirkung:** Der Nutzer hält sein Passwort für falsch und läuft in den Reset — statt es erneut zu versuchen. Der Registrierungspfad macht es richtig (`mapRegisterError` fällt auf `NETWORK_ERROR_MESSAGE`, Zeile 55); nur der Login-Pfad nicht.
- **Teilregression:** EC-6 galt am 01.09. als vollständig grün. Der damalige Fix (`run-action.ts`) behob die rohe Browser-Fehlerseite; diese Fehlklassifizierung *innerhalb* der App blieb unentdeckt.

#### BUG-10: Datenschutz-Link im Registrierungsformular zeigt auf 404
- **Severity: Medium** · betrifft **AC-14**
- `register-view.tsx:116` verlinkt `/privacy`; `GET /privacy` → **404** (curl und Browser bestätigt). `/imprint` ebenfalls 404, dort aber nirgends verlinkt.
- **Inkonsistent zur eigenen Regel des Projekts:** `site-footer.tsx:11` hält `LEGAL_PAGES` bewusst leer, „damit kein toter Link entsteht, bis PROJ-4 die Seite baut". Im Registrierungsformular wurde derselbe Gedanke nicht angewandt.
- AC-14 ist im Wortlaut erfüllt („ein Link ist sichtbar") — der Vertrag hat nur nie verlangt, dass er irgendwo hinführt.

#### BUG-11: Passwort über 72 Zeichen scheitert mit „Verbindung fehlgeschlagen"
- **Severity: Medium** · betrifft **AC-1, AC-11**
- Registrierung mit 76-Zeichen-Passwort → „Die Verbindung ist fehlgeschlagen." Tatsächliche Ursache: `400 validation_failed "Password cannot be longer than 72 characters"` (bcrypt-Grenze). Exakt 72 Zeichen → 200.
- `mapRegisterError` hat für 400 keinen Zweig (`error-mapping.ts:42-56`); `updatePasswordAction` bildet jeden Fehler auf `NETWORK_ERROR_MESSAGE` ab (`actions.ts:155-157`) — betrifft also auch den Reset-Pfad.
- **Wirkung:** Passwortmanager erzeugen solche Passphrasen. Der Nutzer bekommt kein Feld-Feedback und keinen Hinweis, was zu tun wäre.

#### BUG-12: Security-Header fehlen vollständig
- **Severity: Medium**
- `curl -i http://localhost:3000/login`: weder `X-Frame-Options` noch `X-Content-Type-Options` noch `Referrer-Policy`; keine Header-Konfiguration in `next.config.ts` oder `src/proxy.ts`.
- `.claude/rules/security.md` verlangt alle vier. Fehlendes `X-Frame-Options`/`frame-ancestors` bedeutet Clickjacking-Risiko auf der Login-Seite. HSTS ist lokal über HTTP nicht prüfbar, die anderen drei sind es und fehlen.
- Wird typischerweise beim Host konfiguriert — muss dort gegen die Live-URL verifiziert werden.

#### BUG-13: Session-Cookie ohne `HttpOnly` und ohne `Secure`
- **Severity: Medium** — **Bewertung ausdrücklich offen, siehe unten**
- `Set-Cookie: sb-127-auth-token=…; Path=/; Expires=…; Max-Age=34560000; SameSite=lax` — kein `HttpOnly`, kein `Secure`. Access- und Refresh-Token sind damit per `document.cookie` lesbar.
- **Warum es so ist:** Der clientseitige Reset-Pfad liest die Sitzung im Browser (`getSession()`), was ein `HttpOnly`-Cookie ausschließen würde. Das ist Folge einer Designentscheidung, nicht ein vergessenes Flag.
- **Ehrliche Einordnung:** Diesen Punkt hat die **Acceptance-Bahn** nebenbei bemerkt; die Security-Bahn hatte ihn nicht auf der Liste und hat ihn **nicht bewertet**. Der beobachtete Befund (die Cookie-Flags) ist gesichert, das Severity-Urteil ist es nicht. Gehört vor dem Livegang bewusst entschieden, zusammen mit BUG-6 — beide hängen am selben clientseitigen Reset-Design.

#### BUG-14: „Stattdessen einloggen" erscheint bei jedem E-Mail-Feldfehler
- **Severity: Low** · `register-view.tsx:86-96` koppelt den Hinweis an *jeden* Fehler am E-Mail-Feld, also auch an „Bitte eine gültige E-Mail-Adresse eingeben", wo er sinnlos ist.

#### BUG-15: Codekommentar widerspricht dem beobachteten Verhalten
- **Severity: Low** · `actions.ts:115-118` behauptet, der Recovery-Link liefere die Tokens „always" im URL-Fragment und „never a server-readable `?code=`". Gemessen wurde genau die `?code=`-Form. `design.md` beschreibt die Doppeldeutigkeit korrekt, der Kommentar nicht — irreführend für den nächsten, der BUG-6 anfasst.

### Regression und automatisierte Tests

- **`npm test`: 11 Dateien, 96 Tests, alle grün** (2,50 s).
- **Bestehende Playwright-Suite als Regression: 14 von 15 grün.** Der eine Fehlschlag — `tests/PROJ-2-quiz-round.spec.ts:41` in Chromium, „Erste Frage brauchte 3880 ms, erlaubt sind 3000 ms" — war bei Einzelausführung grün und in Firefox und Mobile Safari grün. **Einstufung: Flake unter 15 parallelen Workern gegen den Dev-Server, kein PROJ-1-Regressionsbruch.** Erwähnenswert bleibt: Das AC-2-Zeitbudget von PROJ-2 hat unter Last **keine Reserve**.
- **Geteilte App-Shell und Auth (PROJ-2) intakt:** ausgeloggte Kopfzeile zeigt die Merkzeile (AC-22), eingeloggte den Trainername-Chip (AC-21), `/` ausgeloggt → 307. Der PROJ-2-Kernpfad läuft in drei Browsern durch und speichert Runden.
- **Datenschicht unverändert:** `pg_policies` bestätigt `profiles_select_authenticated`, `runs_select_own`, `runs_insert_own`; `ON DELETE CASCADE` vorhanden. Deckt sich mit `docs/data-model.md`.
- Kein Feature steht auf „Deployed" — außer PROJ-2 gab es nichts zu regressionsprüfen.

### Unit-Tests aus diesem Lauf

Keine neu geschrieben. Die drei Tests zu AC-15 (`register-view.test.tsx`) stammen aus dem `/build`-Lauf und wurden dort mit Rot-Nachweis geführt; sie liefen hier als Regression grün mit. Für die neuen Bugs sind Tests Sache des Fixes, nicht dieses Laufs.

### Not Verified In This Run

- [!] **AC-8 / EC-4 gegen das gehostete Projekt** — lokal nicht auslösbar (Ursache in BUG-7 belegt). Zu prüfen nach dem ersten `/deploy`: ~35 falsche Logins gegen die öffentliche Projekt-URL, auf 429. Einstellung: **Dashboard → Authentication → Rate Limits → `sign_in_sign_ups`**
- [!] **T4** — Wert im gehosteten Projekt nicht beobachtbar, weil es das Projekt nicht gibt. **Dashboard → Authentication → Sign In / Providers → Email → Minimum password length = 8**
- [!] **Site URL / Redirect URLs im gehosteten Projekt** — lokal korrekt, hosted nicht prüfbar
- [!] **Security-Header gegen die Live-URL** — lokal fehlen alle drei prüfbaren (BUG-12); HSTS erst über HTTPS beurteilbar
- [!] **Responsives Layout bei 375 / 768 / 1440 px** — kein Viewport-Urteil. Die E2E-Suite fährt „Mobile Safari", prüft dort aber Funktion, nicht Layout
- [!] **Cross-Browser über Chromium/Firefox/WebKit hinaus** — echtes Safari, ältere Engines nicht verfügbar
- [!] **DevTools-Prüfungen** — Konsole, Netzwerk-Tab, berechnete Styles nicht durchgeführt
- [!] **Verhalten ohne JavaScript** — als bekannte Einschränkung in `design.md` dokumentiert, in diesem Lauf nicht nachgestellt
- [!] **Severity-Bewertung von BUG-13** — von keiner der beiden Bahnen abschließend beurteilt (siehe dort)

### Verdikt

- **Acceptance Criteria:** 11 von 14 geprüften bestanden · AC-8 **FAIL** (lokal) · AC-11 **teilweise** (im selben Browser grün, geräteübergreifend gebrochen) · AC-14 im Wortlaut erfüllt, Ziel defekt
- **Edge Cases:** 4 von 6 bestanden · EC-4 nicht verifizierbar · EC-6 **teilweise FAIL**
- **Bugs:** 10 neu — **3 High** (BUG-6, BUG-7, BUG-8), **5 Medium** (BUG-9 bis BUG-13), **2 Low** (BUG-14, BUG-15)
- **Security:** 8 Prüfungen mit Beleg bestanden, **2 mit Befund** (Brute Force, Security-Header), 1 NOT VERIFIED (Bulk-Signup, bewusst nicht implementiert)
- **Automatisierte Tests:** 96/96 grün · E2E 14/15 (der eine Fehlschlag ein Flake, einzeln grün)
- **Production Ready: NEIN** — drei offene High-Bugs.

> **Was „NEIN" hier heißt und was nicht.** Es heißt nicht, dass AC-15 oder der Build vom 03.09. etwas kaputt gemacht hätten — AC-15 ist grün, und die Regression ist sauber. Es heißt, dass ein **vollständiger** Sweep zwei High-Bugs gefunden hat, die in den Läufen vom 01./02.09. durchgerutscht sind: der geräteübergreifende Passwort-Reset (**BUG-6**) und die nun nachgewiesene fehlende Drosselung (**BUG-7**). PROJ-1 stand seit dem 02.09. auf `Approved` — nach diesem Lauf zu Unrecht.

> **Der wichtigste einzelne Befund ist BUG-6.** Ein Nutzer, der sein Passwort vergisst, es am Rechner zurücksetzen will und die Mail am Handy öffnet, kommt nicht wieder in sein Konto — und die App sagt ihm dabei etwas Falsches. Für ein Produkt ohne E-Mail-Bestätigung ist der Reset der einzige Weg zurück ins Konto.

---

## QA-Lauf — 2026-09-03 (zweiter Lauf des Tages), nach EC-7 und BUG-13

**Anlass:** `/build` hat den Passwort-Reset auf `token_hash` + `verifyOtp` umgestellt (T15–T17) und das Session-Cookie auf `HttpOnly`/`Secure` (BUG-13). Erneut **vollständiger Sweep**: alle 15 AC-IDs und jetzt 7 EC-IDs neu verifiziert, nichts aus früheren Läufen übernommen.

**Aufbau:** Zwei `qa-engineer`-Verifizierer in getrennten Kontexten ohne Kenntnis des Builds — Bahn A (Acceptance + Regression + Testsuite), Bahn B (Security-Red-Team). Zusammenführung und Bewertung: Hauptkontext.

**Bug-Nummerierung:** neue Befunde ab **BUG-16** (BUG-1 bis BUG-15 sind vergeben).

### Was dieser Lauf bestätigt hat

- **BUG-13 geschlossen.** Unabhängig nachgemessen: Dev `HttpOnly; SameSite=lax`, Produktions-Build zusätzlich `Secure`. Die geteilte Ablage der Cookie-Optionen wurde als Schutz gegen Flag-Verlust beim Session-Refresh erkannt.
- **BUG-15 geschlossen** (irreführender Codekommentar korrigiert).
- **Die Geräte-Bindung aus BUG-6 ist tatsächlich weg.** Bahn A hat den Token in einem **frisch gestarteten Firefox mit null Cookies** eingelöst und das Passwort gesetzt — die PKCE-Abhängigkeit vom anfordernden Gerät existiert nicht mehr.
- **`/auth/confirm` besteht die Red-Team-Prüfung:** Open-Redirect abgewehrt (auch mit gültigem Token), kein Sitzungs-Erschleichen, Token kontogebunden und einmalig.
- **Regression sauber:** `npm test` 102/102, E2E 15/15 über Chromium, Firefox und Mobile Safari, PROJ-2-Kernpfad und geteilte App-Shell intakt.

**Und trotzdem ist AC-11/EC-7 FAIL** — aus einem Grund, der mit BUG-6 nichts zu tun hat. Siehe BUG-16.

### Acceptance Criteria

| ID | Ergebnis | Beleg |
|----|----------|-------|
| AC-1 | [x] PASS | Registrierung → Redirect auf `/`, Chip mit Trainername, `profiles`-Zeile per psql bestätigt; Passwort < 8 abgelehnt (`validation/auth.ts:12`) |
| AC-2 | [x] PASS | Abweichende Groß-/Kleinschreibung → Feldfehler; Unique-Index `0001_profiles.sql:16` |
| AC-3 | [x] PASS | Vergebene E-Mail → Feldfehler mit Login-Umschalter (`register-view.tsx:96-106`) |
| AC-4 | [x] PASS | Login mit korrekten Daten → `/` |
| AC-5 | [x] PASS | Cookie persistent (Ablauf 2027-10-08, `httpOnly=true`); **neuer Browser-Prozess** mit persistiertem Cookie öffnet `/` mit 200 |
| AC-6 | [x] PASS | „Abmelden" → `/login`; anschließendes `GET /` → `/login` |
| AC-7 | [x] PASS | Falsches Passwort und unbekannte Adresse wortgleich (245 ms / 133 ms); `error-mapping.ts:61-67` verzweigt nicht |
| AC-8 | [!] NOT VERIFIED | 40 Fehl-Logins → 40× 400, kein 429. Ursache nachgeprüft: `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt in der Container-Umgebung, obwohl `config.toml:209` es setzt. Nur gehostet prüfbar → **BUG-7** (unverändert) |
| AC-10 | [x] PASS | Gleiche Meldung unabhängig von Kontoexistenz; Mail „Passwort zurücksetzen" trifft ein, Link zeigt auf `/auth/confirm?token_hash=…` |
| AC-11 | [ ] **FAIL** | Über den **tatsächlich versendeten** Link ist kein Passwortwechsel möglich → **BUG-16**. Mit host-korrigiertem Link läuft die Kette vollständig durch (Formular → 7 Zeichen abgelehnt → Passwort gesetzt → Redirect → Login mit neuem Passwort erfolgreich, altes abgelehnt) |
| AC-12 | [x] PASS | Benutzter und manipulierter Token → `?error=1`, Seite zeigt Fehlerzustand mit „Neuen Link anfordern". **Einschränkung:** durch BUG-16 erscheint dieselbe Meldung auch bei gültigen Links |
| AC-13 | [x] PASS | Leere Formulare → alle Feldmeldungen; JS-Sentinel überlebt das Absenden → kein Reload |
| AC-14 | [!] Wortlaut erfüllt, Ziel defekt | Link sichtbar mit `href="/privacy"`, aber `GET /privacy` → 404 → **BUG-10** (unverändert) |
| AC-15 | [x] PASS | Hinweistext ohne Klick/Hover sichtbar, Wortlaut zeichengenau wie im Vertrag (`register-view.tsx:76-79`) |

### Edge Cases

| ID | Ergebnis | Beleg |
|----|----------|-------|
| EC-1 | [x] PASS | Echter Race: zwei parallele Signups mit gleichem Namen in verschiedener Schreibweise → 200 + 500, genau **eine** `profiles`-Zeile; Trigger und Unique-Index in derselben Transaktion |
| EC-2 | [x] PASS | `/` und `/leaderboard` ohne Sitzung → 307 auf `/login` |
| EC-3 | [x] PASS | Reset für unbekannte Adresse: zeichengleiche Meldung, **keine** Mail in Mailpit |
| EC-4 | [!] NOT VERIFIED | Deckungsgleich mit AC-8 |
| EC-5 | [x] PASS | „ab", 21 Zeichen, Leerzeichen, Emoji, leer → jeweils Feldmeldung; serverseitig identisch abgesichert (`actions.ts:28-36`) |
| EC-6 | [x] PASS | Login-POST gekappt → „Die Verbindung ist fehlgeschlagen."; **E-Mail und Passwort bleiben erhalten**, Button wieder aktiv |
| EC-7 | [ ] **FAIL** | Die **Geräte-Unabhängigkeit selbst ist nachgewiesen** (frischer Firefox, null Cookies, host-korrigierter Link → Formular erscheint, Passwort setzbar). Der real versendete Link scheitert aber in **jedem** Browser, auch im anfordernden → **BUG-16** |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis | Beleg |
|---------|----------|-------|
| Authentication Bypass | [x] PASS | `/` ohne Sitzung → 307; `getUser()` statt Signaturprüfung (`proxy.ts:51-53`) |
| Autorisierung (RLS) | [x] PASS | Mit echtem Bearer-Token von Nutzer X gegen Daten von Nutzer Y: Lesen → `[]`, gefälschter INSERT → `42501`, UPDATE/DELETE → 0 Zeilen |
| Sensible Felder | [x] PASS | `profiles` gibt nur `id`, `trainer_name`, `created_at` heraus — keine E-Mail |
| Input Injection | [x] PASS | XSS- und SQL-Payloads unter Umgehung der App direkt an Supabase → `23514` vom Check-Constraint, **kein verwaistes Konto** |
| Brute Force | [!] **FAIL** | 30 Fehlversuche ohne Drosselung → **BUG-7** |
| Account-Enumeration (Login/Reset) | [x] PASS | Identische Meldungen und Codepfade |
| Exponierte Secrets | [x] PASS | `.next/static` durchsucht nach `sb_secret`, `service_role`, `JWT_SECRET` → kein Treffer |
| Zugangsdaten in der URL | [x] PASS | Alle vier Formulare `method="post"` |
| Session-Cookie-Flags | [x] **PASS (neu)** | Dev `HttpOnly; SameSite=lax`; Produktions-Build zusätzlich `Secure` (`cookie-options.ts:19-23`) — **BUG-13 geschlossen** |
| `/auth/confirm` | [x] PASS | Fehlender/manipulierter Token → `error=1` ohne Sitzung; `next=//evil.com` abgewehrt (`route.ts:22-26`); Sitzung nur bei erfolgreichem `verifyOtp` |
| Security-Header | [!] **FAIL** | Weder Dev noch Prod liefern die vier geforderten Header → **BUG-12** (unverändert), dazu **BUG-19** |

### Bugs

#### BUG-16: Der versendete Reset-Link führt immer zu „Link ungültig oder abgelaufen"
- **Severity: High** · betrifft **AC-11, AC-12, EC-7**
- **Dies ist ein neuer Fehler, eingeführt durch den Fix vom selben Tag** — nicht der alte BUG-6. Dessen Ursache (PKCE-Bindung ans Gerät) ist nachweislich beseitigt.
- **Mechanik:** Der Mail-Link trägt den Host aus `{{ .SiteURL }}`, lokal `http://127.0.0.1:3000` (`config.toml:158`). `/auth/confirm` löst den Token korrekt ein und setzt das Cookie auf der Domain, unter der es aufgerufen wurde — **leitet aber auf einen anderen Host um**: `request.nextUrl.clone()` (`route.ts:34`) liefert `localhost:3000`, unabhängig vom eingehenden Host. Der Browser folgt nach `localhost`, schickt das auf `127.0.0.1` gesetzte Cookie nicht mit, `reset-password/page.tsx` sieht keinen Nutzer und rendert den AC-12-Fehlerzustand — über einen frischen, gültigen Link.
- **Selbst reproduziert:** `curl -i "http://127.0.0.1:3000/auth/confirm?token_hash=bogus&type=recovery"` → `location: http://localhost:3000/reset-password?error=1`.
- **Wirkung:** Der Passwort-Reset ist im aktuellen Stand **vollständig unbenutzbar** — in jedem Browser, auch in dem, der ihn angefordert hat. Da es keine E-Mail-Bestätigung gibt, ist er der einzige Weg zurück ins Konto.
- **Warum der Build ihn nicht gefunden hat:** Die Verifikation dort rief `/auth/confirm` direkt über `localhost` auf, statt dem Link zu folgen, wie er in der Mail steht. Anfrage-Host und Redirect-Host waren dadurch zufällig identisch, und der Mismatch konnte nicht auftreten. Geprüft wurde die eigene Konstruktion, nicht das ausgelieferte Artefakt.
- **Produktionsrisiko über den lokalen Fall hinaus:** Sobald Site-URL und der Host, den `request.nextUrl` liefert, auseinanderfallen — `www` gegen Apex-Domain, ein Proxy oder ein Domain-Alias —, kehrt exakt dieser Fehler zurück. Der Fix muss den Host der eingehenden Anfrage respektieren, nicht einen abgeleiteten.

#### BUG-17: `/reset-password` akzeptiert jede normale Sitzung, nicht nur eine Recovery-Sitzung
- **Severity: Medium** · **Altlast, nicht von diesem Build eingeführt**
- `reset-password/page.tsx` prüft nur, ob **ein Nutzer** angemeldet ist; `updatePasswordAction` (`actions.ts:152-158`) ebenso. Beide unterscheiden nicht zwischen einer Recovery-Sitzung und einer gewöhnlichen.
- **Wirkung:** Wer an einem offen gelassenen, angemeldeten Gerät sitzt, kann `/reset-password` aufrufen und das Passwort **ohne Eingabe des alten** ändern — und sperrt den Eigentümer damit dauerhaft aus.
- `design.md` sagt „nur über `/auth/confirm` erreichbar". Im Code steht diese Bindung nicht; das Dokument beschreibt eine Absicht, keine Durchsetzung.
- **Einordnung der Bewertung:** Von der Acceptance-Bahn als außerhalb ihres Scopes gemeldet; die Security-Bahn hatte den Punkt nicht auf ihrer Liste und hat ihn **nicht bewertet**. Der Befund ist belegt, das Severity-Urteil stammt von der Zusammenführung, nicht von einer der Prüfbahnen.

#### BUG-18: Jeder 500 bei der Registrierung wird als „Trainername bereits vergeben" angezeigt
- **Severity: Low** · betrifft **AC-3**
- `error-mapping.ts:51-53` bildet jeden Status 500 auf die Trainernamen-Meldung ab, mit dem Kommentar „nothing else in this flow produces a 500". Widerlegt: Zwei gleichzeitige Registrierungen mit **derselben E-Mail** liefern 500 mit `duplicate key … users_email_partial_key`.
- **Wirkung:** Der Nutzer sieht einen Trainernamen-Fehler für ein E-Mail-Duplikat und ändert das falsche Feld.

#### BUG-19: `X-Powered-By: Next.js` wird ausgeliefert
- **Severity: Low** · Verrät das Framework und seine Version an jeden Aufrufer, ohne Nutzen. Abschaltbar über `poweredByHeader: false` in `next.config.ts` — gehört zusammen mit BUG-12 erledigt.

#### Unverändert offen aus dem vorherigen Lauf
- **BUG-7 (High)** — AC-8, keine wirksame Drosselung; 30 bzw. 40 Fehlversuche ohne 429. Die Security-Bahn schärft nach: Selbst wenn das Limit gehostet greift, ist es **per IP** — Credential Stuffing über wechselnde IPs bleibt ungebremst, weil es keinen kontobezogenen Zähler und kein CAPTCHA gibt.
- **BUG-8 (High)** — offene `[user]`-Aufgaben auf dem Zugangsdaten-Pfad. **Jetzt zwei:** T4 (Passwort-Mindestlänge) und neu **T18** (Reset-Vorlage im gehosteten Projekt). Ohne T18 verschickt die Produktion wieder den PKCE-Standardlink und die Geräte-Bindung aus BUG-6 ist zurück.
- **BUG-10 (Medium)** — Datenschutz-Link → 404.
- **BUG-12 (Medium)** — Security-Header fehlen, in Dev **und** im Produktions-Build.
- **BUG-14 (Low)** — „Stattdessen einloggen" erscheint bei jedem E-Mail-Feldfehler.

### Regression und automatisierte Tests

- **`npm test`: 12 Dateien, 102 Tests, alle grün.**
- **E2E-Suite: 15/15 grün** über Chromium, Firefox und Mobile Safari — anders als im Vorlauf **kein** Flake.
- **PROJ-2-Kernpfad intakt:** „Runde spielen bis zum gespeicherten Ergebnis" und „Angemeldet ins Spiel, nach dem Abmelden wieder gesperrt" grün.
- **Geteilte App-Shell und Proxy intakt:** Trainername-Chip und „Abmelden" rendern, `logoutAction` beendet die Sitzung, `/` und `/leaderboard` ohne Sitzung → 307, mit Sitzung `/login` → `/`.
- **`npm run lint`: grün.**

### Not Verified In This Run

- [!] **AC-8 / EC-4 gehostet** — `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt in der lokalen Container-Umgebung. Prüfung nach dem ersten `/deploy`: ~35 Fehlversuche gegen die Live-URL. Stelle: **Dashboard → Authentication → Rate Limits → `sign_in_sign_ups`**
- [!] **T4 / T18** — gehostete Dashboard-Einstellungen von hier aus nicht einsehbar; nur der lokale Spiegel ist belegt
- [!] **Verteilter bzw. kontobezogener Brute-Force in Produktion** — strukturell offen, von hier aus nicht messbar
- [!] **Verhalten des Reset-Links unter echter Produktions-Domain** — hängt an BUG-16 und T18
- [!] **Responsives Layout bei 375 / 768 / 1440 px** — kein Viewport-Urteil. Die E2E-Suite fährt ein iPhone-13-Profil, prüft dort aber Funktion, nicht Layout
- [!] **Cross-Browser über Chromium/Firefox/WebKit hinaus** — nicht verfügbar
- [!] **DevTools-Prüfungen** — Konsole, Netzwerk-Tab, berechnete Styles nicht durchgeführt
- [!] **Severity-Bewertung von BUG-17** — von keiner Prüfbahn abschließend beurteilt (siehe dort)

### Verdikt

- **Acceptance Criteria:** 12 von 14 geprüften bestanden · **AC-11 FAIL** · AC-8 nicht verifizierbar · AC-14 im Wortlaut erfüllt, Ziel defekt
- **Edge Cases:** 5 von 7 bestanden · **EC-7 FAIL** · EC-4 nicht verifizierbar
- **Bugs:** 4 neu — **1 High** (BUG-16), 1 Medium (BUG-17), 2 Low (BUG-18, BUG-19). Unverändert offen: 2 High (BUG-7, BUG-8), 2 Medium (BUG-10, BUG-12), 1 Low (BUG-14). **Geschlossen: BUG-13, BUG-15**
- **Security:** 10 Prüfungen mit Beleg bestanden, 2 mit Befund (Brute Force, Security-Header)
- **Automatisierte Tests:** 102/102 · E2E 15/15 · Lint grün
- **Production Ready: NEIN** — drei offene High-Bugs.

> **Der Fix hat sein Ziel erreicht und ist trotzdem nicht fertig.** Die Geräte-Bindung, wegen der dieser Umbau gemacht wurde, ist beseitigt — nachgewiesen in einem frischen Browser ohne ein einziges Cookie. Darüber gelegt hat sich ein neuer Fehler derselben Klasse: Wieder scheitert der Reset, wieder mit einer Meldung, die etwas Falsches behauptet, diesmal wegen eines Host-Mismatches statt eines fehlenden Cookies. Für den Nutzer ist das Ergebnis identisch mit vorher.

> **Warum der Build das nicht gesehen hat, ist die wichtigere Lehre.** Die Verifikation dort hat `/auth/confirm` direkt über `localhost` aufgerufen, statt dem Link zu folgen, wie er in der Mail steht. Damit waren Anfrage-Host und Redirect-Host zufällig gleich und der Fehler unsichtbar. Geprüft wurde die eigene Konstruktion, nicht das ausgelieferte Artefakt — genau der Unterschied, den ein unabhängiger Verifizierer aufdeckt und der Erbauer strukturell übersieht.

---

## QA-Lauf — 2026-09-03 (dritter Lauf des Tages), nach dem BUG-16-Fix

**Anlass:** `/build` hat die Weiterleitung in `/auth/confirm` auf ein relatives Ziel umgestellt und `site_url` an den Host angeglichen, unter dem die App ausgeliefert wird. Erneut vollständiger Sweep, nichts aus früheren Läufen übernommen.

**Aufbau:** Zwei `qa-engineer`-Verifizierer in getrennten Kontexten ohne Kenntnis des Builds. Der Acceptance-Bahn wurde diesmal ausdrücklich untersagt, eine URL selbst zusammenzusetzen — sie musste den Link **unverändert aus dem Postfach** holen. Der Security-Bahn wurde die im Vorlauf zwischen den Bahnen durchgefallene Frage (Recovery- vs. normale Sitzung) ausdrücklich zugewiesen.

**Bug-Nummerierung:** neue Befunde ab **BUG-20**.

### Der Reset funktioniert — beide Fehler sind geschlossen

- **AC-11 PASS** und **EC-7 PASS.** Die Acceptance-Bahn hat den Link **exakt so, wie er in der Mail steht** in einem frisch gestarteten Browser mit leerem Cookie-Jar geöffnet: Formular erscheint, zu kurzes Passwort wird abgelehnt, gültiges wird gesetzt, Weiterleitung auf `/`. In einem **dritten** frischen Browser danach: altes Passwort abgelehnt, neues akzeptiert.
- **AC-12 PASS** für die drei prüfbaren Fälle (benutzt, manipuliert, ohne Link).
- **BUG-6 und BUG-16 sind damit beide geschlossen.**
- Bestätigt durch die Security-Bahn: relative `Location` ohne Host-Rekonstruktion, Token einmalig verwendbar.

### Acceptance Criteria

| ID | Ergebnis | Beleg |
|----|----------|-------|
| AC-1 | [x] PASS | Registrierung → `/`, Profil-Zeile mit exaktem Trainernamen; `enable_confirmations = false`; Passwort < 8 doppelt abgelehnt (Zod **und** Auth-API `422 weak_password`) |
| AC-2 | [x] PASS | Groß geschriebene Variante eines vergebenen Namens → Feldfehler; Unique-Index auf `lower(trainer_name)` |
| AC-3 | [x] PASS | Doppelte Adresse → Feldfehler mit Umschalter; auch die **groß geschriebene** Adressvariante wird als Duplikat erkannt |
| AC-4 | [x] PASS | Korrekte Zugangsdaten → `/` |
| AC-5 | [x] PASS | Browser **vollständig geschlossen**, neuer Browser mit persistiertem Cookie-Jar → bleibt auf `/`; Cookie `httpOnly`, Ablauf 2027 |
| AC-6 | [x] PASS | „Abmelden" → `/login`; danach `/` → 307 |
| AC-7 | [x] PASS | Beide Fehlerfälle zeichengleich; `error-mapping.ts:61-67` ohne Verzweigung |
| AC-8 | [!] NOT VERIFIED | 45 Fehlversuche → 45× 400, kein 429. `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt in der Container-Umgebung. Zusätzlich **BUG-21** |
| AC-10 | [x] PASS | Gleiche Meldung unabhängig von Kontoexistenz; Mail < 1 s in Mailpit, für die unbekannte Adresse **0 Mails** |
| AC-11 | [x] **PASS** | Vollständige Kette über den **unveränderten Mail-Link** in frischem Browser; neues Passwort gilt, altes nicht mehr |
| AC-12 | [x] PASS (teilweise) | Benutzt, manipuliert, ohne Link → Fehlerzustand ohne Passwortfeld. **Abgelaufener** Link nicht prüfbar (1 h Gültigkeit) |
| AC-13 | [x] PASS | Drei bzw. zwei Feldmeldungen; gesetzter JS-Sentinel überlebt das Absenden → kein Reload |
| AC-14 | [!] Wortlaut erfüllt, Ziel defekt | Link sichtbar, `/privacy` → **404** → **BUG-10** |
| AC-15 | [x] PASS | Hinweis ohne Klick/Hover sichtbar, Text **wortgleich** mit dem Vertrag, keine Checkbox |

### Edge Cases

| ID | Ergebnis | Beleg |
|----|----------|-------|
| EC-1 | [x] PASS | Echter Race provoziert: gleichzeitige Signups mit `race_…` und `RACE_…` → 200 + `23505`; **eine** Zeile in der DB, `auth.users` = `profiles` = 28, **0 Konten ohne Profil** |
| EC-2 | [x] PASS | `/`, `/quiz`, `/profile`, `/irgendwas` → je 307 auf `/login`; `/login`, `/reset-password` → 200 |
| EC-3 | [x] PASS | Zeichengleiche Meldung, Mailpit-Suche für die unbekannte Adresse → 0 Mails |
| EC-4 | [!] NOT VERIFIED | Gleiche Ursache wie AC-8 |
| EC-5 | [x] PASS | `ab`, 21 Zeichen, Leerzeichen, Emoji, Bindestrich → je feldspezifische Meldung |
| EC-6 | [x] PASS mit Einschränkung | Transportfehler: Meldung erscheint, **beide Eingaben bleiben erhalten**, zweiter Klick loggt ohne Neueingabe ein. Der Vertragsfall „Verbindung **zu Supabase Auth** schlägt fehl" ist damit nicht abgedeckt → **BUG-9** |
| EC-7 | [x] **PASS** | Link unverändert aus dem Postfach, frischer Browser mit leerem Cookie-Jar → Formular, Passwort gesetzt, Weiterleitung. Kein `code_verifier` nötig |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis | Beleg |
|---------|----------|-------|
| Auth-Bypass | [x] PASS | `/` ohne Sitzung → 307; `getUser()` im Proxy |
| Autorisierung (RLS) | [x] PASS | Anon → `[]`; als Nutzer X fremde Runden auch mit `?profile_id=eq.<opfer>` → `[]`; `profiles` ohne E-Mail |
| Input Injection | [x] PASS | XSS und SQL als Trainername direkt an Supabase → `23514` vom Constraint, `profiles` unversehrt |
| Brute Force | [!] **FAIL** | 35 Fehlversuche ohne 429 → **BUG-7** |
| Enumeration (Login/Reset) | [x] PASS | Identische Meldungen und Codepfade |
| Exponierte Secrets | [x] PASS | Kein `service_role`, `sb_secret_`, JWT-Secret im Bundle; kein Browser-Client mehr vorhanden |
| Zugangsdaten in der URL | [x] PASS | Alle vier Formulare `method="post"`, im gerenderten HTML bestätigt |
| Session-Cookie-Flags | [x] PASS | Prod `httpOnly, secure, sameSite=lax`; Dev ohne `secure` (korrekt) |
| `/auth/confirm` — Token | [x] PASS | Einmalig verwendbar; Müll- und Fehlparameter → `?error=1` |
| `/auth/confirm` — Redirect-Ziel | [x] PASS | Relative `Location`, kein Host aus Request oder Header rekonstruiert |
| `/auth/confirm` — `next`-Parameter | [!] **FAIL** | Backslash-Variante nicht abgefangen → **BUG-20** |
| Recovery- vs. normale Sitzung | [!] **FAIL** | Nicht unterschieden → **BUG-17**, jetzt bewertet |
| Security-Header | [!] **FAIL** | Auch im Produktions-Build abwesend → **BUG-12** |

### Bugs

#### BUG-20: Open Redirect an `/auth/confirm` über einen Backslash
- **Severity: Medium** · neu, in dem Code, der BUG-16 beheben sollte
- `safeNext` (`route.ts:22-26`) blockt `https://…` und `//…`, lässt aber **`/\evil.com`** durch. Browser normalisieren `\` zu `/`, daraus wird `//evil.com` — ein protokoll-relatives Ziel auf einen fremden Host.
- **Selbst nachgestellt** mit einem über die Admin-API erzeugten gültigen Recovery-Token: `GET /auth/confirm?token_hash=<gültig>&type=recovery&next=/\evil.com` → `location: /\evil.com`. Zum Vergleich blockiert: `next=https://evil.com` und `next=//evil.com` → beide `/reset-password`.
- **Wichtig für die Reproduktion:** Mit einem *ungültigen* Token greift immer der Fehlerpfad, und der Test sieht grün aus, ohne `safeNext` je erreicht zu haben. Genau daran ist meine erste Gegenprobe gescheitert.
- **Wirkung:** Ein Angreifer fordert für sein **eigenes** Konto einen Reset an und hat damit eine Weiterleitung auf unserer vertrauenswürdigen Domain, die auf einen beliebigen fremden Host zeigt — ein klassischer Phishing-Baustein.
- **Warum die Tests es nicht gefangen haben:** Die Unit-Tests prüfen genau die zwei Varianten, an die beim Schreiben gedacht wurde. Der Kommentar im Code behauptet dabei, die Prüfung verhindere Open Redirects — sie tut es unvollständig. Eine Positivliste erlaubter Ziele wäre robuster als eine Liste verbotener Präfixe.

#### BUG-21: Die zugesagte IP-Drosselung kann die Nutzer-IP gar nicht sehen
- **Severity: Medium** · betrifft **AC-8, EC-4** · code-belegt, laufzeitseitig lokal nicht entscheidbar
- Login und Registrierung laufen ausschließlich über Server Actions; der Supabase-Client wird serverseitig gebaut (`supabase/server.ts:9-33`) und reicht **keine** Client-Header weiter (`grep -rn "x-forwarded\|global:" src/` findet nichts).
- **Folge:** Supabase sieht für jeden Nutzer dieselbe IP — die des Anwendungsservers. AC-8 verspricht aber „30 Versuche **von derselben IP-Adresse**".
- **Zwei mögliche Ausgänge, beide schlecht:** Entweder verbraucht ein einzelner Angreifer das Kontingent **aller** Nutzer und sperrt sie gemeinsam aus, oder das Limit greift nie so, wie der Vertrag es beschreibt.
- Das ist ein **eigenständiger** Befund neben BUG-7: Dort geht es darum, dass lokal gar nichts greift; hier darum, dass die Zusage auch im gehosteten Betrieb strukturell nicht erfüllbar ist. Vor dem Launch gegen das gehostete Projekt zu prüfen — und gegebenenfalls per `/refine` neu zu formulieren.

#### BUG-17 (aus dem Vorlauf): jetzt bewertet — Passwortwechsel ohne Kenntnis des alten
- **Severity: Medium (High-nah)** — von der Security-Bahn ausdrücklich beurteilt, nicht mehr vom Owner geschätzt
- Auf zwei Ebenen belegt: `/reset-password` rendert mit einer **normalen** Login-Sitzung das Formular (HTTP 200, nicht der Ungültig-Zustand); und `PUT /auth/v1/user` mit einem gewöhnlichen Session-Token ändert das Passwort ohne das alte (`SECURE_PASSWORD_CHANGE` ist aus).
- `design.md` verspricht ausdrücklich „nur mit gültiger Recovery-Sitzung" und eine erneute serverseitige Prüfung. Beides steht so nicht im Code (`actions.ts:153-166`, `reset-password/page.tsx:30-36`).
- **Wirkung:** Wer eine bestehende Sitzung erreicht — geteiltes oder offen gelassenes Gerät, und die Sitzung läuft laut AC-5 **nie** ab —, ändert still das Passwort und sperrt den Eigentümer aus.

#### BUG-22: Abmelden beendet die Sitzung auf allen Geräten
- **Severity: Low** · Beobachtung, von keinem AC beschrieben
- `logoutAction` (`actions.ts:89-93`) ruft `signOut()` im Standard-Scope `global` auf. Der Acceptance-Bahn ist es aufgefallen, weil ihr erster AC-5-Versuch daran scheiterte: Ein Logout in einer zweiten Sitzung entwertete die erste.
- Weder AC-5 noch AC-6 sagen, was hier gelten soll. Das ist keine Fehlfunktion, sondern eine **Lücke im Vertrag** — Kandidat für `/refine`, nicht für einen Fix.

#### BUG-23: „Bestenliste" in der Kopfzeile führt für jeden angemeldeten Nutzer auf eine 404
- **Severity: Medium** · **gehört nicht zu PROJ-1**
- `site-header.tsx:44` verlinkt `/leaderboard`; die Route existiert nicht (PROJ-3 ist `Planned`).
- Die App-Shell gehört laut `docs/app-shell.md` zu **PROJ-2**. Dieselbe Regel, die dort für die Fußzeile befolgt wurde („kein Link, solange die Zielseite fehlt"), wurde für die Kopfzeile nicht angewandt — genau wie bei BUG-10 im Registrierungsformular.

#### Unverändert offen aus den Vorläufen
- **BUG-7 (High)** — AC-8: 35 bzw. 45 Fehlversuche ohne Drosselung. Lokal nicht behebbar.
- **BUG-8 (High)** — offene `[user]`-Aufgaben T4 und T18 auf dem Zugangsdaten-Pfad. Lokal nicht behebbar.
- **BUG-9 (Medium)** — Login meldet einen Auth-Ausfall als „Passwort falsch". Diesmal **bewusst nur code-belegt**: Ein Laufzeit-Nachweis hätte das Anhalten des Auth-Containers erfordert und die parallel laufende zweite Bahn gestört. Sauber begründete Entscheidung der Bahn, kein Versäumnis.
- **BUG-10 (Medium)** — Datenschutz-Link → 404.
- **BUG-12 (Medium)** — Security-Header fehlen, auch im Produktions-Build.
- **BUG-14, BUG-18, BUG-19 (Low)** — unverändert.

### Regression und automatisierte Tests

- **`npm test`: 12 Dateien, 105 Tests, alle grün.**
- **`npx playwright test`: 24/24 grün in 29 s bei voller Parallelität mit 16 Workern — keine Flakes, kein Einzel-Nachlauf nötig.** Das ist eine Verbesserung gegenüber den beiden Vorläufen, in denen PROJ-2-Tests unter Last wackelten.
- **PROJ-2 ohne Regression:** alle vier E2E-Journeys in drei Browsern grün, dazu manuell Kopfzeile, „Runde starten", vier Antwortoptionen und sichtbares Bild.
- **`npm run lint`: grün.**
- **`npm run build`: grün** — von der Acceptance-Bahn nicht ausgeführt, vom Owner nach Abschluss der Bahnen nachgeholt.

### Not Verified In This Run

- [!] **AC-8 / EC-4** — lokal nicht auslösbar; `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt im Container. Prüfung nach dem ersten `/deploy`: ~35 Fehlversuche gegen die Live-URL. **Dashboard → Authentication → Rate Limits → `sign_in_sign_ups`**
- [!] **T4 / T18** — nur im gehosteten Projekt beobachtbar; lokale Spiegel beide verifiziert
- [!] **BUG-21 zur Laufzeit** — die Frage, welche IP Supabase tatsächlich sieht, ist erst gegen das gehostete Projekt entscheidbar
- [!] **AC-12, Teilfall „abgelaufener Link"** — Gültigkeit 1 h, im Testfenster nicht herbeiführbar
- [!] **BUG-9 zur Laufzeit** — Auth-Ausfall bewusst nicht provoziert (parallele Bahn), Befund rein code-belegt
- [!] **Cross-Browser über Chromium, Firefox und WebKit hinaus** — keine weiteren Engines installiert
- [!] **Responsives Layout-Urteil bei 375 / 768 / 1440 px** — kein visuelles Urteil; das iPhone-13-Profil belegt Funktion, nicht Gestaltung
- [!] **DevTools-Prüfungen** — nicht durchführbar
- [!] **Verhalten ohne JavaScript** — bekannte Einschränkung laut `design.md`, kein AC

### Verdikt

- **Acceptance Criteria:** 13 von 14 geprüften bestanden · AC-8 nicht verifizierbar · AC-14 im Wortlaut erfüllt, Ziel defekt. **AC-11 erstmals PASS**
- **Edge Cases:** 6 von 7 bestanden · EC-4 nicht verifizierbar. **EC-7 erstmals PASS**
- **Bugs:** 4 neu — **0 High**, 3 Medium (BUG-20, BUG-21, BUG-23), 1 Low (BUG-22). BUG-17 aus dem Vorlauf jetzt bewertet (Medium, High-nah)
- **Geschlossen in diesem Lauf: BUG-6, BUG-16** (dazu BUG-13 und BUG-15 aus dem Vorlauf)
- **Security:** 10 Prüfungen mit Beleg bestanden, 4 mit Befund
- **Automatisierte Tests:** 105/105 · E2E 24/24 ohne Flake · Lint grün · Build grün
- **Production Ready: NEIN** — zwei offene High-Bugs.

> **Die beiden verbleibenden High-Bugs sind kein Code.** BUG-7 (Drosselung) und BUG-8 (T4, T18) hängen beide ausschließlich am **gehosteten Supabase-Projekt**, das es noch nicht gibt. Lokal ist an ihnen nichts zu reparieren: Der lokale Container setzt das Rate-Limit nicht durch, und die beiden Dashboard-Einstellungen existieren nirgends, wo man sie setzen könnte. **PROJ-1 kann `Approved` nicht erreichen, bevor dieses Projekt angelegt ist** — und dafür genügt das Anlegen, ein App-Deploy ist nicht nötig.

> **BUG-21 ist der unangenehmste neue Befund**, weil er eine Zusage betrifft und nicht nur eine Umsetzung: AC-8 verspricht eine Drosselung „von derselben IP-Adresse", aber die Architektur — Login über Server Actions — lässt Supabase überhaupt nur die IP des Anwendungsservers sehen. Selbst ein korrekt konfiguriertes Limit würde dann entweder alle Nutzer gemeinsam aussperren oder nie greifen. Das ist vor dem Launch zu klären und gehört vermutlich in ein `/refine` von AC-8, nicht in einen Fix.

---

## QA-Lauf — 2026-09-04, Delta nach BUG-20/9/11 und den Link-Fixes (BUG-10/23)

**Anlass und Scope:** `/build` hat vier Fixes geliefert — die Open-Redirect-Positivliste (BUG-20), die Ausfall-Meldung beim Login (BUG-9), die Passwort-Obergrenze (BUG-11) und die beiden toten Links (BUG-10 in PROJ-1, BUG-23 in PROJ-2s Kopfzeile). **Dies ist bewusst ein Delta-Lauf**, kein vierter vollständiger Sweep: Nach drei kompletten Durchgängen am Vortag mit konsistenten Ergebnissen wurden nur die betroffenen Kriterien neu verifiziert, plus Regression und die Testsuiten. Alles, was hier nicht als geprüft erscheint, trägt den Stand des Laufs vom 2026-09-03 (dritter Lauf) — nicht ein neues Häkchen.

**Aufbau:** Zwei `qa-engineer`-Verifizierer in getrennten Kontexten. Bahn A: AC-14, AC-7/EC-6, Passwortlänge, Reset über den echten Mail-Link, Regression, Suiten. Bahn B: `/auth/confirm` mit systematischem Angriff auf `next`, **mit gültigem Token**.

**Bug-Nummerierung:** neue Befunde ab **BUG-24**.

### Die vier Fixes — Ergebnis

| Fix | Ergebnis | Beleg |
|-----|----------|-------|
| **BUG-20** Open Redirect | ✅ **geschlossen** | ~30 Varianten mit gültigem Recovery-Token — absolut, `//`, Backslash roh/kodiert, doppelt kodiert, Tab/Newline, `@`-Trick, Traversal, Null-Byte, 5000 Zeichen, `next` mehrfach — **jede** → `Location: /reset-password`. Auch `next=/` und `next=/login` kollabieren auf die Reset-Seite: Die Liste hat genau einen Eintrag |
| **BUG-9** Ausfall als „Passwort falsch" | ⚠️ **teilweise** | Die Variante „Fehlerobjekt kommt zurück" ist per Unit-Test belegt (`error-mapping.test.ts:91-97`). Die Variante „Backend antwortet gar nicht" zeigt ein **anderes** Versagen → **BUG-24** |
| **BUG-11** Passwort-Obergrenze | ✅ **geschlossen** | 73 Zeichen → Feldmeldung am Passwortfeld, kein Konto; **72 Zeichen → angenommen** (inklusiv, kein Off-by-one); 40 × `ä` (80 Byte) → abgelehnt. Aber: Meldung dabei irreführend → **BUG-25** |
| **BUG-10** Datenschutz-Link → 404 | ✅ **geschlossen** | Hinweis sichtbar, **0** Anker im Absatz, **0** Treffer für `a[href*="privacy"]`; `/privacy` → 404, Build-Routenliste kennt sie nicht. AC-14 im neuen Wortlaut erfüllt |
| **BUG-23** Kopfzeilen-Link → 404 (PROJ-2) | ✅ **geschlossen** | Kopfzeile angemeldet: Wortmarke, Chip, „Abmelden" — **0** `a[href*="leaderboard"]`, 0 Vorkommen „Bestenliste"; `/leaderboard` → 404. AC-21 im neuen Wortlaut erfüllt |

### Neu verifizierte Kriterien

| ID | Ergebnis | Beleg |
|----|----------|-------|
| AC-7 | [x] PASS | Falsches Passwort und unbekannte Adresse zeichengleich (`a === b` → `true`); 400 und 401 laufen auf dieselbe Konstante |
| AC-10 | [x] PASS | Bestätigungsmeldung, Mail in Mailpit |
| AC-11 | [x] PASS | Neues Passwort im fremden Kontext gesetzt; Login damit in einem **dritten** frischen Kontext erfolgreich |
| AC-12 | [x] PASS | Benutzter Link und Müll-Token → Fehlerzustand mit „Neuen Link anfordern"; „abgelaufen" nach 1 h weiterhin nicht prüfbar |
| AC-14 | [x] PASS | Neuer Wortlaut: Hinweis ja, Link nein, solange `/privacy` fehlt |
| EC-6 | [ ] **FAIL** | Siehe BUG-24 |
| EC-7 | [x] PASS | Link **unverändert** aus Mailpit, frischer Kontext ohne Cookies → Formular, Sitzung serverseitig über `verifyOtp` |
| PROJ-2 AC-21 | [x] PASS | Neuer Wortlaut: kein Bestenlisten-Zugang, solange `/leaderboard` fehlt |

### Bugs

#### BUG-24: Login hängt bei nicht antwortendem Auth-Backend unbegrenzt — ohne Meldung, ohne „Erneut versuchen"
- **Severity: Medium** · betrifft **EC-6**
- **Beleg:** Auth-Container per `docker pause` angehalten (17:56:57Z), Login abgeschickt → Button **12 Sekunden** in „Einloggen …", `errors=[]`, sekündlich protokolliert. Erst das `unpause` (17:57:09Z) löste den Request; danach lief der Login regulär durch. Container danach `running, paused=false, healthy`.
- **Ursache:** Im gesamten Auth-Pfad gibt es **keinen Timeout** — `grep -rn "AbortSignal\|timeout" src/lib/auth/ src/lib/supabase/` liefert null Treffer. Der PokeAPI-Client desselben Projekts hat genau das (`pokeapi/client.ts:106-111`). `error-mapping.ts` und `run-action.ts` greifen erst, wenn eine Antwort oder eine Exception zurückkommt — bei einem hängenden Backend kommt beides nie.
- **Einordnung gegenüber BUG-9:** BUG-9 war „falsche Meldung, wenn ein Fehler zurückkommt" und ist behoben. BUG-24 ist „gar keine Meldung, wenn nichts zurückkommt". EC-6 verlangt „eine Fehlermeldung mit einer Erneut-versuchen-Möglichkeit" — für die häufigste Ausfallform bekommt der Nutzer unbegrenzt gar nichts.
- **Nicht geprüft:** die Variante „Verbindung aktiv abgelehnt" (`docker stop`), weil das die parallele Bahn härter getroffen hätte. Dafür stehen die Unit-Tests.

#### BUG-25: „Höchstens 72 Zeichen" bei einer Eingabe von 40 Zeichen
- **Severity: Low** · betrifft **AC-1, AC-11**
- 40 × `ä` = 40 Zeichen, 80 Byte → korrekt abgelehnt, aber die Meldung nennt eine Zeichenzahl, die der Nutzer nicht überschritten hat. Der Klammerzusatz erklärt das Prinzip, sagt aber weder die Byte-Grenze noch, um wie viel zu kürzen ist.
- **Dazu:** Die 72-Byte-Grenze steht **nirgends im Vertrag** — AC-1/AC-11 kennen nur „mind. 8 Zeichen". Sinnvoll gebaut, aber unspezifiziert. Kandidat für `/refine`.

#### Unverändert offen
- **BUG-7 (High)** — Drosselung, nur gehostet prüfbar.
- **BUG-8 (High)** — T4 und T18 offen. Bahn B stuft T18 als Medium ein („Template-Konfiguration, keine Credential-Prüfung"), Bahn A als High (Regel). Der Report führt beide unter BUG-8 weiter; die Regel des Skills ist eindeutig, und ohne T18 bricht EC-7 live.
- **BUG-12** — Security-Header fehlen. **Abweichende Einstufung:** Bahn B nennt es diesmal **High** nach Checklisten-Lesart; die drei Vorläufe sagten Medium. Beides steht hier — nicht stillschweigend geglättet. Als Deploy-Blocker ist es ohnehin geführt.
- **BUG-17 (Medium)** — bestätigt: gewöhnliche Passwort-Sitzung (`amr: password`) rendert das Reset-Formular. **Neu belegt:** `config.toml:245` `secure_password_change = false` — Step-up-Auth beim Passwortwechsel ist aus. Gehört zu einer Refine-Entscheidung.
- **BUG-14, BUG-18, BUG-19, BUG-21, BUG-22** — unverändert.

### Regression und automatisierte Tests

- **`npm test`: 12 Dateien, 121 Tests, alle grün.**
- **E2E: 24/24** über Chromium, Firefox, Mobile Safari — keine Flakes.
- **PROJ-2 Kernpfad:** Runde starten, Bild + vier Optionen, Serie zählt hoch, neue Frage — intakt. AC-22 mitgeprüft.
- **`npm run lint`** und **`npm run build`**: grün.

### Not Verified In This Run

- [!] **Alle nicht oben genannten AC/EC** — bewusst nicht neu geprüft (Delta-Lauf); Stand vom dritten Lauf am 2026-09-03 gilt
- [!] **EC-6, Variante „aktiv abgelehnt"** — nicht provoziert, nur Unit-Tests
- [!] **AC-12 „abgelaufen"** — 1 h Gültigkeit, nicht herbeiführbar
- [!] **AC-7 Timing unter Last** — Messung enthielt ein fixes 4-s-Fenster, kein echter Verteilungsvergleich
- [!] **AC-8 / EC-4, T4 / T18, BUG-21, Security-Header live** — nur gegen das gehostete Projekt entscheidbar
- [!] **Responsive Darstellung und Kontrast** von AC-14/AC-15 — DOM-Sichtbarkeit geprüft, nicht Layout
- [!] **Brute Force in diesem Lauf** — nicht Schwerpunkt der Security-Bahn; Stand vom Vortag gilt

### Auch bemerkt (unverifiziert, nicht bewertet)
- Nach der Reset-Anfrage trägt der anfordernde Kontext drei PKCE-Cookies (`…-code-verifier`), obwohl der Ablauf keinen `code_verifier` mehr benutzt — toter Ballast; die Namen tragen `127`, während `site_url` auf `localhost` steht.
- `/reset-password` rendert bei gültigem Link die Kopfzeile im **angemeldeten** Zustand (Chip + „Abmelden"). PROJ-2s AC-22 nennt für `/reset-password` ausdrücklich den abgemeldeten Zustand — möglicher Widerspruch, gehört PROJ-2.

### Verdikt

- **Vier Fixes:** BUG-20, BUG-11, BUG-10, BUG-23 **geschlossen** · BUG-9 teilweise (Rest → BUG-24)
- **Bugs neu:** 1 Medium (BUG-24), 1 Low (BUG-25)
- **Automatisierte Tests:** 121/121 · E2E 24/24 · Lint und Build grün
- **Production Ready: NEIN** — unverändert zwei High-Bugs (BUG-7, BUG-8), beide nur am gehosteten Projekt behebbar.

> **Was dieser Lauf für den PR bedeutet:** Alles, was auf diesem Branch gebaut wurde, ist unabhängig bestätigt. Was PROJ-1 von `Approved` trennt, liegt nicht im Code, sondern im fehlenden gehosteten Supabase-Projekt. BUG-24 ist ein echter, neuer Befund — aber er beschreibt Verhalten, das **vor** diesem Branch schon so war (kein Timeout gab es nie), nicht eine Regression durch ihn.

---

## Nachtrag — 2026-09-04: T18 ist ohne eigenen SMTP-Dienst nicht setzbar

**Kein QA-Lauf.** Festgehalten beim Versuch, das gehostete Supabase-Projekt anzubinden, damit BUG-7 und BUG-8 endlich prüfbar werden.

`npx supabase config push` gegen das neu angelegte Projekt scheitert:

```
unexpected status 400: {"message":"Email template modification is not available for
free tier projects using the default email provider. Please upgrade your plan or
configure a custom SMTP provider."}
```

**Der eigentliche Befund ist größer als die Vorlage.** Supabases Dokumentation zum eingebauten Mailversand nennt drei Einschränkungen: Zustellung **ausschließlich an Adressen im Team des Projekts** (alle anderen werden mit „Email address not authorized" abgelehnt), **2 Nachrichten pro Stunde**, und ausdrücklich **kein Produktivbetrieb**.

Für dieses Produkt heißt das: **Der Passwort-Reset funktioniert für echte Spieler nicht** — nicht „mit dem falschen Link", sondern es kommt keine Mail an. Zusammen mit der Produktentscheidung gegen eine E-Mail-Bestätigung (`spec.md`, Decision Log) ist der Reset der einzige Weg zurück ins Konto.

**Konsequenzen:**
- **T18 bleibt offen** und damit **BUG-8 (High)**. Nicht wegen eines Codefehlers — die Vorlage existiert, ist lokal aktiv und in drei Browser-Engines verifiziert (Lauf vom 2026-09-04) —, sondern weil das gehostete Projekt sie nicht annimmt.
- **AC-11, AC-12 und EC-7 sind gegen das gehostete Projekt nicht verifizierbar**, solange kein Mailversand an beliebige Adressen möglich ist.
- **PROJ-1 bleibt `In Review`** (Entscheidung des Nutzers am 2026-09-04). Der Status wird nicht auf `Approved` gehoben, obwohl der Code fertig ist: Eine zugesagte Funktion ist in Produktion nachweislich nicht lauffähig, und ein Status, der das verschweigt, wäre wertlos.

**Was es braucht:** einen SMTP-Anbieter mit kostenlosem Kontingent (Resend, Brevo) **und eine eigene Absender-Domain** — ohne verifizierte Domain stellt praktisch jeder Anbieter nur an die Adresse des Kontoinhabers zu. Stand 2026-09-04 ist keine Domain vorhanden; nachgetragen in `docs/PRD.md` → Rahmenbedingungen und in `features/INDEX.md` → Deploy-Blocker.

**Weiterhin ohne SMTP prüfbar und noch offen:** AC-8 / EC-4 (Rate-Limit, braucht keine E-Mail) und T4 (Passwort-Mindestlänge, ein Dashboard-Feld). Beide sind gegen das gehostete Projekt jederzeit nachholbar und würden BUG-7 schließen sowie die offene Frage aus BUG-21 beantworten, welche IP-Adresse Supabase überhaupt sieht.

**Warnung zu `supabase config push`:** Das Kommando überträgt den kompletten `[auth]`-Block aus `config.toml` — darunter `site_url = "http://localhost:3000"` und die lokalen `additional_redirect_urls`. Würde es durchlaufen, trüge das Produktivprojekt anschließend `localhost` als Site-URL und jeder Mail-Link zeigte ins Leere. Solange `config.toml` lokale Entwicklungswerte enthält, ist das Kommando für dieses Projekt ungeeignet; die Einstellungen gehören einzeln ins Dashboard.

---

## Verifikation gegen das gehostete Projekt — 2026-09-04

**Kein vollständiger QA-Lauf.** Gezielte Messung gegen `https://twssvibxqobepmxjrqln.supabase.co`, sobald das gehostete Projekt existierte, um die seit drei Läufen offene Frage aus AC-8 zu beantworten.

### AC-8 / EC-4 — VERIFIZIERT, BUG-7 geschlossen

40 aufeinanderfolgende Login-Versuche mit falschem Passwort gegen dasselbe (nicht existierende) Konto, direkt gegen `POST /auth/v1/token?grant_type=password` mit dem öffentlichen Publishable Key:

```
Versuche 1–32: HTTP 400
Versuch 33:    HTTP 429 {"error_code":"over_request_rate_limit","msg":"Request rate limit reached"}
```

Das entspricht dem dokumentierten Standardwert von 30 Versuchen / 5 Minuten pro IP (die zwei zusätzlichen Anfragen davor — ein `settings`-Abruf und ein Signup-Versuch — zählen auf dasselbe Kontingent). **AC-8 ist damit erstmals belegt**, nachdem drei lokale Läufe es mangels Container-Konfiguration nicht auslösen konnten. `[x] AC-8 — PASS (hosted)`, `[x] EC-4 — PASS (hosted)`.

### BUG-21 — bestätigt und verschärft

Die Messung lief **direkt von einem Client-Rechner** aus, also mit einer echten Nutzer-IP. Genau so läuft die Anwendung aber nicht: Login und Registrierung gehen über **Next.js Server Actions**, der Supabase-Client wird serverseitig gebaut und reicht keine Client-Header weiter. Supabase sieht deshalb im Produktivbetrieb **nicht die IP des Spielers, sondern die des Anwendungsservers** — für alle Spieler dieselbe.

Was dieser Lauf beweist und was nicht:

- ✅ **Bewiesen:** Das Limit existiert, greift und ist **pro IP** gezählt.
- ❌ **Nicht bewiesen:** dass die Anwendung davon profitiert. Im Gegenteil — aus „pro IP" plus „alle Nutzer teilen sich eine IP" folgt eines von zwei Ergebnissen, und beide sind schlecht:
  1. Die Egress-IP des Hosts ist stabil → **30 Fehlversuche von irgendwem sperren alle Spieler gleichzeitig für 5 Minuten aus.** Das ist kein Schutz mehr, sondern ein Denial-of-Service-Hebel, den ein einzelner Angreifer bedienen kann.
  2. Die Egress-IP wechselt (bei serverlosen Plattformen üblich) → das Limit greift praktisch nie, und es gibt **gar keinen** Schutz.

**Severity: Medium → das Urteil gehört dem Nutzer.** AC-8 verspricht wörtlich eine Drosselung „von derselben IP-Adresse". Nach dieser Messung ist die Zusage für die reale Architektur nicht haltbar — nicht weil die Umsetzung fehlerhaft wäre, sondern weil das Kriterium einen Mechanismus beschreibt, der an dieser Stelle nicht greifen kann. Das ist ein Fall für `/refine PROJ-1` auf AC-8, verbunden mit der Frage, ob die Anwendung einen **eigenen, kontobezogenen** Zähler bekommt (bisher bewusst abgelehnt, siehe Decision Log 2026-08-31).

**Nicht geprüft:** ob die Egress-IP des künftigen Hosts stabil ist — das entscheidet sich erst mit der Wahl des Hosting-Anbieters (`deploy` in `.ai-eng-kit` ist weiterhin `null`).

### T4 — nicht geprüft, bewusst

Die Passwort-Mindestlänge lässt sich nur über einen Signup-Versuch messen. Steht der Wert im gehosteten Projekt **noch nicht** auf 8, würde ein Versuch mit 7 Zeichen ein echtes Konto anlegen. Das gehostete Projekt weist außerdem `@example.com` als ungültige Domain ab (anders als der lokale Stack), es gibt also keine gefahrlose Wegwerf-Adresse. **Reihenfolge deshalb: erst im Dashboard setzen, dann messen** — dann beweist ein `422 weak_password`, dass die Einstellung greift, ohne dass je ein Konto entsteht.

### Site-URL — Fehlkonfiguration durch `config push` bestätigt

Der abgebrochene `supabase config push` hat die lokalen Werte **doch geschrieben**, bevor er an der E-Mail-Vorlage scheiterte: Das Dashboard zeigt unter Authentication → URL Configuration `http://localhost:3000` als Site URL. Bestätigt vom Nutzer am 2026-09-04.

Derzeit folgenlos — es gibt keine Nutzer, keine Domain, und der eingebaute Mailversand stellt ohnehin nur an Team-Adressen zu. **Vor dem Livegang zwingend zu korrigieren**, sonst zeigt jeder Mail-Link auf `localhost`. Als Deploy-Blocker geführt.

---

## QA-Lauf — 2026-09-05, gegen den überarbeiteten Vertrag

**Anlass:** `/refine PROJ-1` vom selben Tag hat AC-8 und EC-4 auf die tatsächlich gebaute Drosselung umgeschrieben und AC-16, AC-17, AC-18 sowie EC-8 und EC-9 ergänzt. Dieser Lauf prüft den Code gegen diesen neuen Vertrag — vier Kriterien und zwei Edge Cases waren nie zuvor unter ihren IDs verifiziert.

**App URL:** `http://localhost:3000` (`probe.baseUrl`, lokaler Next.js-Dev-Server + lokaler Supabase-Stack)
**Tester:** drei unabhängige `qa-engineer`-Sub-Agenten mit disjunktem Scope, keiner mit Kenntnis des Builds oder der Spec-Überarbeitung — (1) Akzeptanz, (2) Security-Red-Team, (3) Regression. Zusammenführung, Bewertung und dieser Bericht durch den einen Owner.

Vorgehen der Lanes: Server Actions direkt über das Next-Action-RPC-Protokoll angesprochen (Action-IDs aus dem ausgelieferten Client-Chunk gezogen), Zählerstände gegen `postgresql://…:54322` gelesen, Reset-Mails über Mailpit `:54324`, dazu Code-Inspektion mit `file:line` und gezielte Testläufe.

### Acceptance Criteria

- [x] **AC-1** — Registrierung legt Konto + Profil an, sofortiger Login. `Set-Cookie: sb-127-auth-token=…; HttpOnly; SameSite=lax` + `x-action-redirect: /;push`; Profilzeile in der DB vorhanden, `email_confirmed_at` sofort gesetzt (`supabase/config.toml:243` → `enable_confirmations = false`). Mindestlänge 8 serverseitig erzwungen (`src/lib/validation/auth.ts:26`; gemessen: `kurz12` → `{"password":"Mindestens 8 Zeichen"}`)
- [x] **AC-2** — `QAPROBEA1` gegen bestehendes `QaProbeA1` → `{"fieldErrors":{"trainerName":"Dieser Trainername ist bereits vergeben."}}`. Garantie: Unique-Index auf `lower(trainer_name)`, `supabase/migrations/0001_profiles.sql:13`
- [x] **AC-3** — Zweitregistrierung derselben Adresse → `{"fieldErrors":{"email":"Diese E-Mail-Adresse ist bereits registriert."}}`, Umschalter zum Login erscheint (`src/components/auth/register-view.tsx:99-109`)
- [x] **AC-4** — Login → `x-action-redirect: /;push`; `GET /` mit dem Cookie: HTTP 200, Trainername im HTML
- [x] **AC-5** — Cookie persistent: `Max-Age=34560000; Expires=Sun, 10 Oct 2027`, kein Session-Cookie; `timebox`/`inactivity_timeout` in `supabase/config.toml:299,301` auskommentiert; Cookie in einem *separaten* Prozess wiederverwendet und weiter gültig. Einschränkung siehe „Not Verified"
- [x] **AC-6** — Nativer POST des Abmelde-Formulars → `HTTP 303`, `Set-Cookie: …; Max-Age=0`, `Location: /login`; danach `GET /` → `307 → /login`
- [x] **AC-7** — Falsches Passwort und unbekannte Adresse liefern **wortgleich** `{"error":"E-Mail-Adresse oder Passwort ist falsch."}` (`src/lib/auth/error-mapping.ts:69-79`). **Einschränkung: die Antwortzeit verrät die Kontoexistenz — siehe BUG-65.** Der Wortlaut erfüllt AC-7, das erklärte Ziel des Kriteriums nicht vollständig
- [x] **AC-8** — **unbedingter Teil bestanden, bedingter Teil lokal nicht erfüllt.** Vollständige Trennung im eigenen Abschnitt unten
- [x] **AC-10** — Bestehende und unbekannte Adresse liefern identisch `{"message":"Falls diese Adresse registriert ist, wurde ein Link zum Zurücksetzen verschickt."}`; Mailpit zeigt die Mail nur für die bestehende Adresse
- [x] **AC-11** — `/auth/confirm?token_hash=…&type=recovery` → `307 → /reset-password`; neues Passwort < 8 abgelehnt; gültiges gesetzt; Login mit neuem Passwort erfolgreich, mit altem abgelehnt
- [x] **AC-12** — Wiederverwendeter und erfundener Token → beide `307 → /reset-password?error=1`; Seite zeigt „Dieser Link ist ungültig oder abgelaufen." + „Neuen Link anfordern" (`src/app/reset-password/page.tsx:36,51-59`)
- [x] **AC-13** — Registrierung leer → alle drei Feldfehler gleichzeitig; Login leer → beide Feldfehler. Kein Neuladen, weil die Action einen ActionState statt einer Weiterleitung liefert und das Formular über `form.handleSubmit` läuft (`src/components/auth/login-view.tsx:57`)
- [x] **AC-14** — `/privacy` antwortet 404; im ausgelieferten Client-Chunk ist der Link-Zweig wegkompiliert („TURBOPACK unreachable"), es bleibt reiner Text (`register-view.tsx:35,127-137` → `PRIVACY_PAGE_EXISTS = false`). Genau die Regel, die AC-14 verlangt
- [x] **AC-15** — Der vollständige Satz steht als `FormDescription` dauerhaft am Feld (`register-view.tsx:81-84`), kein Tooltip, kein Aufklappen, Zuordnung über `aria-describedby` (`src/components/ui/form.tsx:116`), keine Checkbox. Unit-Tests `register-view.test.tsx:25,35,55` grün

**Erstmals unter ihrer ID verifiziert:**

- [x] **AC-16** (Konto-Zähler, 20/15 Min, verbindungsunabhängig) — 20 Fehlversuche von **20 verschiedenen** `x-forwarded-for`-Adressen: alle 20 durchgelassen, Zähler `login:account:qa.ec9@example.com = 20`. Der **21.** Versuch mit **richtigem** Passwort von der unbelasteten Adresse `10.32.7.7` wurde abgewiesen. Leerung nach Erfolg gemessen: Zähler stand auf 5, nach erfolgreichem Login war die Zeile weg. Schlüssel schreibweise-unabhängig (`QA.EC9@EXAMPLE.COM` zählte auf denselben Schlüssel, 21→22). Unabhängig in Lane 2 reproduziert: 20 erlaubt, ab Nr. 21 abgewiesen
- [x] **AC-17** (Passwort-Reset, 3/5 Min, **ohne** Erstattung) — Anfragen 1–3 bestätigt, 4 und 5 abgewiesen. Keine Erstattung bei Registrierung gegengeprüft: 5 **erfolgreiche** Registrierungen von einer Adresse, die 6. abgewiesen — der Erfolg kauft kein neues Budget. Eigener Scope, getrennt vom Login
- [x] **AC-18** (Fail-Closed) — **Zählerausfall zur Laufzeit provoziert, ohne Code oder Konfiguration zu ändern:** ein 4000 Zeichen langer `x-forwarded-for` sprengt den Primärschlüssel-Index (`index row size 4024 exceeds btree version 4 maximum 2704`). Ergebnis mit **richtigem** Passwort: `HTTP 500`, **kein** Session-Cookie, Fehler `Drosselung nicht zählbar: …` (`src/lib/auth/throttle.ts:84`). Registrierung auf demselben Weg: `HTTP 500`, **0 angelegte Konten**. Passwort-Reset: `HTTP 500`. Zusätzlich wirft `createAdminClient()` bei fehlendem Schlüssel (`src/lib/supabase/admin.ts:26-35`); Unit-Test `src/lib/auth/throttle.test.ts:111` grün

### Edge Cases

- [x] **EC-1** — Echter Wettlauf: 4 gleichzeitige Registrierungen mit demselben Trainernamen in unterschiedlicher Schreibweise → genau **1** Konto und 1 Profil, die anderen 3 mit Feldfehler, **keine halb angelegten Konten**. Garantie im Code bestätigt: Unique-Index `0001_profiles.sql:13` plus Trigger in derselben Transaktion (`0001_profiles.sql:49-51`)
- [x] **EC-2** — `GET /` und `GET /irgendwas` ohne Sitzung → `307 → /login`; `/login` ohne Sitzung → 200; `/login` **mit** Sitzung → `307 → /`
- [x] **EC-3** — Identische Meldung, keine Mail für die unbekannte Adresse (siehe AC-10)
- [x] **EC-4** — Versuch 6 und 7 innerhalb des Fensters beide abgewiesen, Meldung für bestehendes und unbekanntes Konto wortgleich. **Selbstheilung gemessen:** Adresse `10.70.0.16` um 22:04:40 gesperrt, um 22:05:57 (nach 70 s) kam ein Versuch wieder durch, Zähler danach 1
- [x] **EC-5** — `ab`, `mein name`, `Pika🔥`, 26 Zeichen → jeweils `{"fieldErrors":{"trainerName":"Trainername: 3–20 Zeichen, nur Buchstaben, Zahlen und _"}}`
- [!] **EC-6 — teilweise verifiziert.** Der Fehler-Renderpfad wurde zur Laufzeit erreicht (`{"error":"Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen."}`), und die eingegebenen Werte bleiben nachweislich erhalten, weil die Actions ausschließlich `setServerError` setzen und den react-hook-form-Zustand nicht anfassen (`login-view.tsx:44-49`, `register-view.tsx:54-59`). **Nicht verifiziert:** ein echter Netzwerkausfall zu Supabase — dafür hätte der Auth-Container gestoppt werden müssen, was die beiden parallel laufenden Lanes zerstört hätte. Anzumerken: eine eigene „Erneut versuchen"-Schaltfläche gibt es nicht; die Möglichkeit besteht darin, dass das ausgefüllte Formular absendbar bleibt
- [x] **EC-7** — Reset-Link mit **frischem, leerem Cookie-Jar** geöffnet (fremdes Gerät): `307 → /reset-password`, Sitzung serverseitig gesetzt, Passwort erfolgreich geändert. Die lokale Vorlage liefert korrekt `…/auth/confirm?token_hash=…&type=recovery&next=/reset-password` (aus Mailpit ausgelesen)

### EC-8 / EC-9 — die akzeptierten Grenzen, gegen die Vertragszahlen gemessen

Diese beiden Edge Cases beschreiben **bewusst akzeptiertes** Verhalten. Geprüft wurde deshalb nicht, ob das Verhalten wünschenswert ist, sondern ob die im Vertrag zugesagten **Zahlen noch stimmen**. Eine Abweichung wäre der Befund gewesen — es gab keine.

| Zusage im Vertrag | Gemessen in diesem Lauf | Deckung |
|---|---|---|
| **EC-8:** ohne Tippfehler kommen **8 von 8** hinter einer Adresse hinein | 8 von 8, 0 abgewiesen, Zähler danach `login:ip:10.61.0.176 = 0` | ✔ identisch |
| **EC-8:** bei je **einem** Tippfehler kommen **4 von 8** hinein, ab dem 5. Fehlversuch je Minute dicht | Spieler 1–4 drin, Spieler 5–8 „Zu viele Versuche von dieser Verbindung" → **4 von 8** | ✔ identisch |
| **EC-8:** **25** Anmelde-/Abmelde-Zyklen ohne eine Abweisung | 25 von 25 erfolgreich, 0 abgewiesen, Zähler danach 0 | ✔ identisch |
| **EC-9:** **20** Fehlversuche je 15 Min von **20 verschiedenen** Adressen kommen durch, danach ist der Besitzer mit **richtigem** Passwort von einer unbelasteten 21. Adresse draußen | 20 von 20 durchgelassen (Zähler = 20); 21. Versuch, richtiges Passwort, saubere Adresse → abgewiesen | ✔ identisch |

**Ergebnis: keine Abweichung.** EC-8 und EC-9 sind `[x]` verifiziert als beschriebenes Soll-Verhalten. Sie sind **kein** offener Befund und werden in der Bug-Liste unten bewusst nicht geführt.

### AC-8 getrennt: unbedingter Teil gegen bedingten Teil

AC-8 ist das einzige Kriterium dieses Features mit einer **Bedingung**. Beides wird hier getrennt ausgewiesen, weil ein gemeinsames Häkchen die eine Hälfte mit der anderen decken würde.

**Unbedingt — lokal vollständig belegt `[x]`:**

| Zusage | Beleg |
|---|---|
| 5 Fehlversuche je Verbindung und Minute, der **6.** wird abgewiesen | Von einer Adresse gemessen; unabhängig in Lane 2 reproduziert (erster abgewiesener Versuch = Nr. 6) |
| Abweisung **vor** der Zugangsdaten-Prüfung | `registerAttempt` in `src/lib/auth/actions.ts:84`, `signInWithPassword` erst in Zeile 95 |
| Login und Registrierung zählen **getrennt** | Nach 6 Fehl-Logins auf `10.96.0.139` war der Login gesperrt, eine Registrierung von derselben Adresse ging durch; DB: `login:ip:10.96.0.139 = 7` neben `register:ip:10.96.0.139 = 1` |
| Erstattung des **eigenen** Versuchs bei Erfolg | 4 Fehlversuche → 1 erfolgreicher Login → Zähler wieder auf **4** → der 5. Fehlversuch kam durch, der 6. wurde abgewiesen. Der Angreifer gewinnt durch den eigenen Login **keinen** Rateversuch (`0004_auth_throttle_refund.sql:40-51`) |
| Atomarität unter Gleichzeitigkeit | Hochzählen und Prüfen in einem Statement, `on conflict do update … returning` (`0003_auth_throttle.sql:57-72`) |
| Umgehung über eine matcher-ausgenommene Route | `loginAction` per POST an `/icon.png` **wird** erreicht — die Drosselung greift dort **identisch ab dem 6. Versuch**. Die Gegenmaßnahme zu BUG-30/31 hält |

**Bedingt — lokal nicht erfüllt `[ ]`, hängt an der Deploy-Umgebung:**

Die Zusage gilt laut Vertrag nur, wenn die anfragende IP verlässlich feststellbar ist. Lokal ist sie es nicht:

- **Richtung (b), gemessen:** 40 Rateversuche gegen 40 verschiedene Konten mit rotierendem `x-forwarded-for` — **0 abgewiesen, in 3,0 s.** Unabhängig in beiden Lanes reproduziert. Der Dev-Server überschreibt einen mitgebrachten Header nicht; jeder gesetzte Wert wurde 1:1 zum Zählerschlüssel. Ebenso: **25 Konten in 7,7 s** angelegt, 0 abgewiesen
- **Richtung (a), `[!] NOT VERIFIED`:** dass ohne jeden Header alle Spieler auf den Sammelschlüssel `unbekannt` fallen, ließ sich lokal **nicht** zeigen — der Next-Dev-Server setzt selbst `x-forwarded-for: ::1`; der Fallback `'unbekannt'` (`src/lib/auth/throttle.ts:65`) ist damit lokal unerreichbar. Beobachtet wurde stattdessen der gleichwertige Effekt: **alle** Anfragen ohne eigenen Header landeten auf dem **einen** Schlüssel `login:ip:::1`

**Das ist kein neuer Befund.** Es ist die exakte Reproduktion des in `features/INDEX.md` geführten Deploy-Blockers **BUG-61**, samt dessen Zahlen. Die Schließbedingung bleibt unverändert: gemessen gegen die **echte Live-URL**, dass ein selbst gesetzter `x-forwarded-for` den Zähler nicht beeinflusst. Als eigenständiger Bug wäre der Zustand High; er wird bewusst als Deploy-Blocker geführt (Entscheidung vom 2026-09-05).

### Security-Audit (Red Team)

**20 Prüfungen belegt · 2 Befunde · 5 `[!] NOT VERIFIED`.**

- [x] **Authentifizierungs-Umgehung** — `/` und `/nonexistent-protected` ohne Sitzung → 307 `/login`; `/auth/confirm` ohne Token → 307 `/reset-password?error=1`
- [x] **Server Action über matcher-ausgenommenen Pfad** — erreichbar, aber gedrosselt (siehe AC-8-Tabelle). Kein Befund
- [x] **Autorisierung / RLS** — anon-REST auf `profiles`, `runs`, `auth_throttle` liefert je `[]`, obwohl belegt (1268 / 410 / 380 Zeilen per `psql`) → echte RLS-Filterung, keine leeren Tabellen. RLS auf allen dreien aktiv
- [x] **`auth_throttle` von außen nicht manipulierbar** — anon-DELETE löschte 0 Zeilen (380→380), anon-INSERT → `42501 new row violates RLS`. Der Zähler ist weder leerbar noch vergiftbar
- [x] **Drossel-RPCs nur für `service_role`** — `register_auth_attempt`, `clear_auth_attempts`, `refund_auth_attempt` je `42501 permission denied for function` als anon
- [x] **Input-Injection** — XSS und SQLi im Trainername sowie SQLi im E-Mail-Feld von Zod abgewiesen, `profiles` danach unverändert. Validierung greift **vor** dem Auth-Aufruf
- [x] **Brute Force** — alle vier Zähler mit den oben genannten Zahlen belegt; Umgehung über einen eigenen Login zwischendurch ist geschlossen
- [x] **Exponierte Geheimnisse** — 20 tatsächlich verlinkte Dateien der `/login`-Seite geladen und durchsucht. **Mit Positivkontrolle:** der Client-Text `Trainername` **wurde gefunden** → die Suche erreicht das ausgelieferte JavaScript. Service-Role-Wert, ANON-Wert, `sb_secret_…` und das Literal `service_role`: **kein Treffer**. Einschränkung: gegen den Dev-Server gemessen, die Produktions-Build-Messung ist in `design.md` dokumentiert
- [x] **Sensible Daten in Antworten** — Server Actions geben ausschließlich `{error}` / `{fieldErrors}` zurück, keine Nutzerfelder
- [x] **Zugangsdaten in der URL** — alle vier Auth-Formulare tragen `method="post"` (`login-view.tsx:56`, `register-view.tsx:68`, `forgot-password-view.tsx:65`, `reset-password-form.tsx:54`), im ausgelieferten HTML bestätigt. Kein nativer GET-Submit
- [x] **Session-Cookie** — `HttpOnly: true`, `SameSite: lax`, `Secure` an `NODE_ENV === 'production'` gebunden (`src/lib/supabase/cookie-options.ts:19-23`), per JS nicht auslesbar. **Damit sieht der als BUG-13 geführte Punkt erledigt aus**; `Secure` ist erst an der Live-URL abschließend prüfbar
- [ ] **BUG-65 — Antwortzeit verrät die Kontoexistenz** (Medium, neu)
- [ ] **Security-Header fehlen** — deckt sich mit dem dokumentierten **BUG-12** (Deploy-Blocker, Medium). Lokal bestätigt weiterhin abwesend; kein neuer Befund

### Bugs

#### BUG-65: Die Antwortzeit des Logins verrät, ob ein Konto existiert
**Severity: Medium** · betrifft AC-7

Die Fehlermeldung ist wortgleich, die Antwortzeit nicht. 12 Messungen je Fall mit jeweils frischer Adresse: **falsches Passwort Median 176 ms / Mittel 164 ms**, **unbekannte Adresse Median 102 ms / Mittel 98 ms** — konstant rund **74 ms** Unterschied. Bestehende Konten laufen durch die Passwort-Hash-Prüfung, unbekannte kehren früher um.

AC-7 ist im Wortlaut erfüllt, sein erklärtes Ziel („verrät nicht, ob die E-Mail-Adresse existiert") und die Erwartung aus `.claude/rules/security.md` („comparable response times where it matters") sind es nicht. Enumeration ist genau das, was Passwort-Spraying von Raten ins Effiziente hebt.

**Warum Medium und nicht High:** Die Ursache sitzt in Supabase GoTrue (`signInWithPassword`), nicht im App-Code; die App kann sie nicht trivial glätten. Nicht von EC-8/EC-9 gedeckt — die betreffen die Drosselung, nicht das Timing.

**Repro:** je 12 Logins gegen ein reales Konto (falsches Passwort) und gegen eine nicht existierende Adresse, jeweils mit frischem `x-forwarded-for`, Antwortzeiten messen.

#### BUG-66: Ein neues Passwort, das dem alten entspricht, meldet „Verbindung fehlgeschlagen"
**Severity: Medium** · betrifft AC-11

`updatePasswordAction` mit dem aktuell geltenden Passwort liefert `{"error":"Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen."}`. Supabase antwortet mit 422, die Fehlerzuordnung (`src/lib/auth/actions.ts:189-191`) kennt für diesen Fall nur den Netzwerkfehler. Der Nutzer sieht einen Verbindungsfehler für ein Feldproblem und erfährt nicht, was er ändern soll — dieselbe Fehlerklasse, die als BUG-9 und BUG-11 bereits zweimal behoben wurde.

Workaround vorhanden (anderes Passwort wählen), deshalb Medium.

**Repro:** einloggen, Passwort-Reset durchlaufen und als neues Passwort das geltende eingeben.

#### BUG-67: Die Sperrmeldung nennt immer „diese Verbindung", auch wenn der Konto-Zähler sperrt
**Severity: Low** · betrifft AC-16, EC-9

Beim Aussperren über den Konto-Zähler wird der rechtmäßige Besitzer von einer völlig unbelasteten Adresse abgewiesen und liest „Zu viele Versuche von dieser Verbindung" (`src/lib/auth/error-mapping.ts:27-28`). AC-7 und EC-4 bleiben gewahrt — über die Kontoexistenz wird nichts verraten, weil der Konto-Zähler auch für nicht existierende Adressen zählt. Aber die Meldung führt in die Irre und schickt den Nutzer zum falschen Workaround („anderes WLAN versuchen"), obwohl Warten die einzige Abhilfe ist.

#### BUG-68: Jeder 500 während der Registrierung wird als „Trainername bereits vergeben" gedeutet
**Severity: Low** · betrifft AC-2, EC-1

`mapRegisterError` (`src/lib/auth/error-mapping.ts:51-53`) deutet **jeden** Status 500 als vergebenen Trainernamen. Genau das macht EC-1 unter Gleichzeitigkeit korrekt — aber ein echter Datenbank- oder Auth-Ausfall während der Registrierung meldet dem Nutzer einen vergebenen Trainernamen statt einer Störung. Der Kommentar an der Stelle benennt die Annahme („nichts anderes in diesem Fluss erzeugt einen 500"), sie ist jedoch nicht abgesichert.

#### BUG-69: `NEXT_PUBLIC_SITE_URL` wird verwendet, ist aber nicht dokumentiert
**Severity: Low**

`src/lib/auth/actions.ts:140` nutzt `NEXT_PUBLIC_SITE_URL` als Rückfallebene für `origin` beim Reset-Link. In `.env.local.example` steht die Variable nicht (dort nur `SUPABASE_SERVICE_ROLE_KEY:30`). Das verstößt gegen `.claude/rules/security.md` → „Any new environment variable must be documented in the example env file" — und trifft eine Variable, die beim Deploy gesetzt sein muss, damit der Reset-Link stimmt.

#### BUG-70: `auth_throttle` trägt breite Tabellen-GRANTs für `anon` und `authenticated`
**Severity: Low** (Defense-in-Depth)

Die Tabelle trägt die Supabase-Standard-GRANTs (INSERT/SELECT/UPDATE/DELETE/TRUNCATE) für `anon` und `authenticated`. **Aktuell ungefährlich und gemessen wirkungslos**, weil RLS aktiv ist und **keine** Policy existiert (deny-all) — der Angriff darauf ist oben unter Security belegt fehlgeschlagen. Der Schutz hängt damit aber allein an „RLS an, Policy leer": Eine später versehentlich hinzugefügte Policy würde sofort die E-Mail-Adressen im Schlüssel `login:account:<adresse>` exponieren. Härtung: GRANTs für `anon`/`authenticated` auf dieser Tabelle explizit entziehen.

#### Unverändert offen aus den Vorläufen
- **BUG-61** (Deploy-Blocker) — in diesem Lauf mit seinen Zahlen reproduziert, siehe AC-8-Abschnitt
- **BUG-12** Security-Header (Deploy-Blocker, Medium) — lokal weiterhin abwesend
- **BUG-18** `X-Forwarded-Host` (Deploy-Blocker, PROJ-2)
- **T4** und **T18** — offene `[user]`-Aufgaben, siehe eigenen Abschnitt

### `[user]`-Aufgaben in `tasks.md`

- [!] **T4 — Passwort-Mindestlänge (8) im gehosteten Projekt: offen.** Ein **Zugangsdaten-Pfad**, und die Skill-Regel wertet einen offenen `[user]`-Haken darauf als **High**. Das wird hier so ausgewiesen — mit zwei Einschränkungen, die der Nutzer kennen muss, um bewusst zu entscheiden: **(1)** Die Regel selbst ist lokal **durchgesetzt und gemessen** — Zod lehnt Passwörter unter 8 Zeichen auf beiden Pfaden ab (`src/lib/validation/auth.ts:26`), der Spiegel in `config.toml:199` ist gesetzt. Der Pfad ist also nicht ungeschützt; es fehlt die zweite Ebene beim Anbieter. **(2)** `features/INDEX.md` führt T4 als „erst nach dem ersten `/deploy`" — das trifft nach dem Wortlaut von `tasks.md:17` **nicht** zu: Die Aufgabe braucht „**nur** ein gehostetes Projekt, **keinen** App-Deploy", und ein gehostetes Projekt existiert (`Pokequiz-PRO`, gegen das am 2026-09-04 bereits gemessen wurde). **T4 ist damit heute setzbar.** Genaue Stelle: *Dashboard → Authentication → Sign In / Providers → Email → Minimum password length: 8*
- [!] **T18 — Reset-Mail-Vorlage im gehosteten Projekt: offen.** Betrifft AC-11 und EC-7, **kein** Zugangsdaten-Rate-Pfad. Lokal ist die Vorlage gesetzt und der geräteübergreifende Reset damit nachgewiesen; ohne T18 verschickt die Produktion den PKCE-Standardlink und EC-7 ist dort erneut kaputt. Laut INDEX derzeit **nicht setzbar**, solange kein eigener SMTP-Dienst konfiguriert ist. Genaue Stelle: *Dashboard → Authentication → Email Templates → Reset Password*

### Regression und automatisierte Tests

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| **Test** | `npm test` | ✅ 17 Dateien, **166/166** grün, zweimal reproduziert |
| **Lint** | `npm run lint` | ✅ **72 Dateien, 0 Errors, 0 Warnings** — gegengeprüft mit `--format json`, dass der Lauf nicht leerläuft |
| **Build** | `next build` | ✅ Exit 0, plus `tsc --noEmit` über den vollständigen Baum inkl. `tests/`, Exit 0 |
| **E2E** | `npx playwright test` | ✅ **33/33** grün (11 Specs × Chromium, Firefox, Mobile Safari). Browser waren aus einem früheren `/e2e-tests`-Lauf vorhanden — **nichts nachinstalliert** |

**Regression an Nachbar-Features: 0 Befunde.** Kein Feature trägt Status „Deployed"; geprüft wurde daher **PROJ-2** (Approved), das sich App-Shell, Proxy-Wächter, Startseite, Supabase-Server-Client und Datenbank mit PROJ-1 teilt:

- Routen-Wächter intakt (`/` → 307 `/login`, `/login` → 200, `/reset-password` → 200)
- Kopfzeile samt Abmelden funktioniert in allen drei Engines (`tests/PROJ-2-access-guard.spec.ts:37`), Verdrahtung bestätigt in `src/components/shell/site-header.tsx:73`
- PROJ-2-Datenpfad schreibt durch: 9 neue Zeilen in `public.runs` während des Laufs
- Schema unversehrt: alle 5 Migrationen angewandt, beide Trigger vorhanden, RLS auf allen drei Tabellen aktiv, PROJ-2s Policies unverändert; 1268 `profiles` zu 1268 `auth.users` — die 1:1-Zusage des Datenmodells hält
- Aufräumen der Zählertabelle läuft: 334 Zeilen, davon **0 älter als eine Stunde**, älteste 3 Minuten alt

**Der Production-Build lief in einer isolierten Kopie**, nicht im Projektordner, damit er sich nicht über ein geteiltes `.next/` mit dem laufenden Dev-Server der anderen Lanes ins Gehege kommt. Die dadurch entstandene Lücke (`tests/` war in der Kopie nicht enthalten) wurde mit `tsc --noEmit` im echten Projekt geschlossen. `git status --porcelain` war vor und nach allen Läufen leer — **keine Projektdatei verändert**.

### Unit-Tests aus diesem Lauf

**Keine neuen geschrieben — und das ist ein Befund, kein Auslassen.** Die isolierte Logik hinter den vier erstmals geprüften Kriterien ist bereits abgedeckt, und zwar an den Stellen, die dieser Lauf gegen die laufende App gegengemessen hat:

- `src/lib/auth/throttle.test.ts` (13 Tests, grün) — Grenzwerte gegen `docs/production/rate-limiting.md`, getrennte Zählung von IP und Konto, Ablehnung sobald **einer** der Zähler ablehnt, der engere Reset-Grenzwert (AC-17), das Werfen statt Durchwinken bei Datenbankfehlern (AC-18), die Erstattung genau eines Versuchs (AC-8) und dass der IP-Zähler unter keinen Umständen gelöscht wird
- `src/lib/auth/error-mapping.test.ts` (12), `src/lib/validation/auth.test.ts` (14), `src/app/auth/confirm/route.test.ts` (17), `src/proxy.test.ts` (11)

Ein zusätzlicher Test hätte hier nur bestätigt, was diese schon prüfen. Die Lücken, die dieser Lauf gefunden hat (BUG-66, BUG-68), sind **Defekte, keine Testlücken** — sie gehören in `/build` behoben und dort mit einem Test abgesichert, nicht hier mit einem absichtlich roten Test dokumentiert.

### Not Verified In This Run

- [!] **Cross-Browser (Chrome/Firefox/Safari) und responsive Darstellung bei 375 / 768 / 1440 px** — kein Browser-Engine in `/qa`, kein Viewport. Betrifft die *sichtbare* Darstellung von AC-13, AC-14, AC-15 und des AuthCard-Umschalters. Dass die Playwright-Suite in drei Engines grün lief, belegt Funktion, **nicht Layout**
- [!] **Visuelle Regression an geteilten Komponenten** — kein Screenshot-Baseline-Vergleich vorhanden und kein Browser für einen Sichtvergleich
- [!] **AC-5, „Browser schließen und zurückkehren"** — nicht beobachtbar. Belegt sind die Cookie-Lebensdauer und das Fehlen jeder Session-Ablauffrist
- [!] **AC-13, das *visuelle* Ausbleiben des Seiten-Neuladens** — der Mechanismus ist im Code belegt, die Beobachtung braucht einen Browser
- [!] **EC-6, echter Netzwerkausfall** — nicht provoziert; der Auth-Container hätte gestoppt werden müssen, was die beiden parallelen Lanes zerstört hätte
- [!] **EC-4, das 15-Minuten-Fenster des Konto-Zählers** — Laufzeit nicht abgewartet. Die Selbstheilung ist am 60-Sekunden-Fenster gemessen, die Fensterlogik ist für beide dieselbe (`0003_auth_throttle.sql:62-71`)
- [!] **AC-8, Richtung (a) des Blockers** („Host setzt gar keinen Header") — lokal unerreichbar, der Dev-Server setzt selbst `x-forwarded-for: ::1`
- [!] **AC-18, Datenbank zur Laufzeit unerreichbar** — der Zählerausfall wurde über einen Index-Sprengsatz provoziert (belegt), ein echter Verbindungsverlust nicht
- [!] **Secrets im Produktions-Build** — hier gegen den Dev-Server geprüft, mit Positivkontrolle. Die `next build`-Messung ist in `design.md` dokumentiert, wurde in diesem Lauf nicht wiederholt
- [!] **Security-Header und die Schließbedingung von BUG-61** — nur gegen die echte Live-URL prüfbar
- [!] **T4 und T18** — Anbieter-Einstellungen im Dashboard des gehosteten Projekts, lokal nicht prüfbar. Genaue Pfade oben genannt
- [!] **Build im Projektordner selbst** — bewusst ausgelassen wegen des geteilten `.next/`; Ersatzbelege oben

### Verdikt

**NOT READY.** Kein Critical. Kein neuer High-Befund im Code — aber die offene `[user]`-Aufgabe **T4** liegt auf einem Zugangsdaten-Pfad und wird nach der Skill-Regel als **High** geführt. Neu gefunden: **2 Medium** (BUG-65, BUG-66) und **4 Low** (BUG-67, BUG-68, BUG-69, BUG-70).

**Was dieser Lauf positiv festgestellt hat:** Alle 17 Acceptance Criteria und alle 9 Edge Cases wurden gegen die laufende App geprüft, keines ist defekt. Die vier erstmals unter ihrer ID geprüften Kriterien (AC-16, AC-17, AC-18) und die beiden neuen Edge Cases halten ihre Zahlen **exakt** — auch AC-18 wurde nicht nur im Code gelesen, sondern durch einen echten, provozierten Zählerausfall zur Laufzeit belegt. Test, Lint, Build und die vorhandene E2E-Suite sind grün, es gibt keine Regression an PROJ-2.

**Was READY im Weg steht:** allein T4, und der ist nach Aktenlage **heute setzbar** (siehe `[user]`-Abschnitt) — nicht, wie `INDEX.md` behauptet, erst nach dem ersten Deploy.

`features/INDEX.md` bleibt bei **In Review**.

---

## Nachtrag — 2026-09-05: Ausgang der sechs Befunde

_Geschrieben vom Fix-Durchgang, **nicht** von einem QA-Lauf. Die Fixes sind unten belegt, aber sie sind **nicht unabhängig verifiziert** — das holt der nächste `/qa`-Lauf nach._

| Befund | Entscheidung des Nutzers | Stand |
|---|---|---|
| **BUG-66** neues Passwort = altes | beheben | ✅ behoben, belegt |
| **BUG-68** jeder 500 = „Trainername vergeben" | beheben | ✅ behoben, belegt |
| **BUG-69** `NEXT_PUBLIC_SITE_URL` undokumentiert | beheben | ✅ behoben |
| **BUG-65** Timing verrät Kontoexistenz | als akzeptiertes Risiko dokumentieren | ✅ als **EC-10** im Vertrag |
| **BUG-67** irreführende Sperrmeldung | vorerst unangetastet | offen (Low) |
| **BUG-70** breite GRANTs auf `auth_throttle` | vorerst unangetastet | offen (Low) |
| **T4** Passwort-Mindestlänge gehostet | vom Nutzer gesetzt | ✅ gesetzt, **noch nicht gegengemessen** |

### Was BUG-68 wirklich war

Die ursprüngliche Diagnose („jeder 500 wird als vergebener Trainername gedeutet") stimmte, die naheliegende Behebung nicht. Gemessen am 2026-09-05 mit demselben `supabase-js`, das die App benutzt: Der Trigger wirft zwar ausdrücklich `trainer_name_taken`, **GoTrue reicht den Text aber nicht durch** — beim Client kommt `AuthRetryableFetchError`, Status 500, `code: undefined`, `"Database error saving new user"` an. Am Fehlerobjekt allein ist ein doppelter Name von einem echten Datenbankausfall **nicht** unterscheidbar.

Deshalb fragt `registerAction` jetzt nach, statt zu raten: Bei einem 500 wird die Datenbank gefragt, ob der Trainername tatsächlich existiert (`src/lib/auth/trainer-name.ts`), und die Antwort geht an `mapRegisterError`. Nur auf dem Fehlerpfad — der geglückte Weg kostet keine zusätzliche Abfrage. **EC-1 bleibt unangetastet:** In einem echten Wettlauf hat die gewinnende Transaktion committet, bevor nachgefragt wird.

### Belege

- **Unit-Tests:** `error-mapping.test.ts` von 12 auf 17 Tests. **Rot-Nachweis geführt:** Mit entfernten Prüfungen fallen genau zwei Tests — „meldet einen 500 als Störung, wenn der Trainername gar nicht vergeben ist" und „meldet ein unverändertes Passwort am Passwort-Feld" —, alle übrigen bleiben grün. Die drei Tests der Gegenrichtung waren auch gegen den kaputten Stand grün; erst zusammen spannen sie die Zusage auf
- **Gegen die laufende App im echten Browser** (Chromium, Wegwerf-Skript): doppelter Trainername → Feldfehler „Dieser Trainername ist bereits vergeben." und **keine** Störungsmeldung (AC-2 hält); unverändertes Passwort → Feldfehler „Das neue Passwort muss sich vom bisherigen unterscheiden." und **keine** Störungsmeldung
- **Vier Prüfungen, alle gelaufen:** Test **171/171** (vorher 166), Lint 73 Dateien **0/0**, Build **Exit 0 — diesmal im echten Projektordner**, was die im QA-Lauf offen gebliebene Lücke schließt, E2E **33/33**
- **Kein Geheimnis im Bundle:** Weil der Admin-Client jetzt an einer weiteren Stelle benutzt wird, gegengeprüft — mit Positivkontrolle (`Trainername` **gefunden**, also erreicht die Suche das Bundle): Service-Role-Schlüssel **kein Treffer**, Literal `service_role` in `.next/static` **kein Treffer**, `isTrainerNameTaken` **nicht** in einem Client-Chunk

### Was offen bleibt

- **BUG-67** und **BUG-70** bleiben auf Wunsch unangetastet und stehen weiter oben in der Befundliste
- **BUG-65** ist als **EC-10** in den Vertrag aufgenommen und in `design.md` begründet — ab jetzt erwartetes Verhalten, kein offener Befund
- **T4** ist gesetzt, aber **nicht gegengemessen**. Die Prüfung wäre eine Registrierung mit 7 Zeichen gegen das gehostete Projekt, die abgelehnt werden muss
- Die Deploy-Blocker **BUG-61**, **BUG-12** und **BUG-18** sind von diesem Durchgang unberührt

### T4 — gegen das gehostete Projekt gegengemessen (2026-09-05)

Der Nutzer hat die Einstellung im Dashboard gesetzt; hier ist die Messung, die belegt, dass sie greift.

**Dreiteilig aufgebaut, damit ein negatives Ergebnis überhaupt deutbar gewesen wäre** — eine Probe, die nichts findet, könnte auch am falschen Ort suchen:

| Schritt | Anfrage | Ergebnis |
|---|---|---|
| 1. Lokale Kontrolle | Registrierung, Passwort **7 Zeichen**, lokale Instanz (Regel dort gesetzt) | `HTTP 422 · weak_password · "Password should be at least 8 characters."` → die Probe **erkennt** eine gesetzte Regel |
| 2. Lokale Positivkontrolle | Registrierung, Passwort **10 Zeichen** | `HTTP 200` → der Endpunkt funktioniert, die Abweisung lag an der Länge und nicht an etwas anderem |
| 3. **Gehostetes Projekt** | Registrierung, Passwort **7 Zeichen** | `HTTP 422 · weak_password · "Password should be at least 8 characters."` |

**Ergebnis: T4 ist im gehosteten Projekt wirksam.** Damit ist die zweite Ebene für AC-1 und AC-11 vorhanden — die App-seitige Zod-Prüfung war es ohnehin schon.

**Rückstandsfrei:** Die Registrierung wurde abgewiesen, es entstand **kein Konto** im gehosteten Projekt. Für den Fall, dass die Regel *nicht* gegriffen hätte, war ein Aufräumschritt vorbereitet (Konto über die Admin-API wieder entfernen, mit Gegenprobe) — er wurde nicht gebraucht.

Damit ist die letzte offene `[user]`-Aufgabe auf einem Zugangsdaten-Pfad geschlossen. **T18 bleibt offen** und ist weiterhin nicht setzbar, solange kein eigener SMTP-Dienst konfiguriert ist.

---

## QA-Nachlauf — 2026-09-05 (später), Gegenprüfung von BUG-66 und BUG-68

**Anlass:** Die Fixes zu BUG-66, BUG-68 und BUG-69 wurden in derselben Sitzung geschrieben, in der sie zuvor gefunden worden waren. Dieser Lauf holt die unabhängige Bestätigung nach — und prüft die neue Angriffsfläche, die dabei entstanden ist.

**App URL:** `http://localhost:3000` · **Tester:** drei `qa-engineer`-Sub-Agenten mit disjunktem Scope und sauberem Kontext, Zusammenführung durch den einen Owner.

Den Lanes wurde ausdrücklich gesagt, den Nachtrag im vorherigen Berichtsteil als **unbestätigte Behauptung** zu behandeln, nicht als Beleg — und die Gegenrichtung von BUG-68 selbst zu provozieren, ohne zu erfahren, wie der Fix gebaut ist.

### Ergebnis in einem Satz

**Alle 17 Acceptance Criteria und alle 10 Edge Cases bestanden.** BUG-66 ist bestätigt behoben, **BUG-68 nur teilweise** — und der Fix selbst hat drei neue Befunde erzeugt. Dazu ein neuer High außerhalb des Fix-Bereichs.

### Acceptance Criteria — alle bestanden

AC-1 bis AC-8, AC-10 bis AC-18 gegen die laufende App gemessen (Server Actions über das Flight-Protokoll, Zählerstände gegen die DB, Mails über Mailpit). Hervorzuheben:

- **AC-16** — 22 Fehlversuche gegen **ein** Konto von 22 verschiedenen Adressen: erste Abweisung exakt bei Versuch 21. Leerung nach Erfolg belegt (19 Fehlversuche → 1 Login → 6 weitere kamen durch)
- **AC-17** — Reset 3 durch, ab dem 4. abgewiesen. Lane 2 musste dafür unbekannte Adressen nehmen, weil bei einer existierenden Adresse **Supabases eigenes `email_sent = 2/h`** schon beim 2. Versuch griff — eine saubere Unterscheidung, die den Messwert erst gültig macht
- **AC-18** — von Lane 2 **zur Laufzeit** ausgelöst: ein überlanger `x-forwarded-for` sprengt den Index, die Anmeldung wird abgelehnt statt durchgelassen. Richtung stimmt; die Art, wie sie sich auslösen lässt, ist allerdings selbst ein Befund (BUG-72)
- **EC-1** — echter Wettlauf mit 6 gleichzeitigen Registrierungen in drei Schreibweisen: genau **1** Gewinner, 5 Feldfehler, genau 1 Zeile in `profiles` **und** in `auth.users` — kein halb angelegtes Konto. Garantie im Code bestätigt (`0001_profiles.sql:13` Unique-Index auf `lower()`, Trigger in derselben Transaktion)

**EC-8 und EC-9 halten ihre Vertragszahlen exakt** (8/8 ohne Tippfehler, 4/8 mit, 20 durch und der 21. abgewiesen) — in zwei Lanes unabhängig reproduziert.

**EC-10 — Verhalten bestätigt, Zahlen im Vertrag zu eng.** Beide Lanes messen die Zeitdifferenz in derselben Richtung und Größenordnung, aber mit anderen Absolutwerten: Lane 1 misst 133/84 ms (**49 ms**), Lane 2 misst 241/176 ms (**65 ms**). Der Vertrag nennt 176/102 ms und „rund 74 ms". **Kein Defekt, sondern ein Formulierungsfehler in EC-10:** Eine Momentaufnahme wurde als feste Eigenschaft geschrieben. Die Zahl ist maschinen- und lastabhängig; EC-10 sollte „rund 50–75 ms" sagen und den Messaufbau nennen.

### BUG-66 — bestätigt behoben

Vollständig über den echten Reset-Link durchgespielt (Konto → Reset anfordern → Mail aus Mailpit → `/auth/confirm` mit frischem Client → neues Passwort = altes):

```
{"fieldErrors":{"password":"Das neue Passwort muss sich vom bisherigen unterscheiden."}}
```

Keine Störungsmeldung, Feldfehler am richtigen Feld, Recovery-Sitzung danach weiter nutzbar. Belegt in `error-mapping.ts:118-124` und `reset-password-form.tsx:43-47,67`.

### BUG-68 — nur teilweise behoben

Die Richtung „doppelter Trainername → Feldfehler" hält, auch unter echter Gleichzeitigkeit (EC-1). **Aber:**

**(a) Die Richtung, um die es ging, ist end-to-end nicht belegt.** Der Browser-Beleg im vorherigen Nachtrag zeigt nur die Richtung, die schon *vor* dem Fix richtig war. Für „500 bei freiem Namen → Störungsmeldung" existiert allein ein Unit-Test auf eine reine Funktion, die die entscheidende Antwort als **Argument** bekommt. Der Code, der dieses Argument erzeugt, ist ungetestet. **Die Formulierung „✅ behoben, belegt" im vorherigen Abschnitt überzeichnet den Beleg** — das ist hiermit korrigiert.

**(b) In genau diesem ungetesteten Code steckt ein Rest des Defekts** — siehe BUG-74.

### Security-Audit

**31 Prüfungen belegt · 8 `[!] NOT VERIFIED` · 5 neue Befunde.**

Sauber geblieben: Authentifizierungs-Umgehung, RLS für anon **und** für ein fremdes angemeldetes Konto, Input-Injection (mit Persistenz-Gegenprobe: 0 Zeilen verletzen das Format), Zugangsdaten in der URL, sensible Daten in Antworten, Session-Cookie.

**Geheimnisse im Bundle: kein Treffer, mit belastbarer Kontrolle.** Produktions-Build in einer Kopie, dazu die 22 tatsächlich ausgelieferten Chunks (5,4 MB). Zwei Positivkontrollen **gefunden**, eine eigens gesetzte Negativkontrolle **nicht** — und `createAdminClient`, `isTrainerNameTaken`, alle vier Drossel-Funktionen, `SUPABASE_SERVICE_ROLE_KEY`, `service_role`: je 0 Treffer. Ein Dev-Chunk enthält die Meldungstexte aus `error-mapping.ts`; im Produktions-Bundle sind sie weggeschüttelt. **Kein Befund.**

**Die neue Service-Role-Abfrage als Angriffsfläche — Urteil:** kein Orakel (nur ein Boolean, das AC-2 ohnehin preisgibt), und die **Drosselung ist unbeschädigt**: Gezählt wird nachweislich **vor** der Abfrage (`actions.ts:47` vor `:68`), belegt nicht nur im Code, sondern an der Laufzeit — abgewiesene Versuche antworten ~115 ms schneller, weil Signup und Abfrage dort gar nicht laufen. Auch über eine matcher-ausgenommene Route (`/x.png`) greift die Sperre ab dem 6. Versuch. **Aber sie taugt als Verstärker** — BUG-74.

### Bugs

#### BUG-71: `/auth/confirm` prüft ein Credential ohne jede App-Drosselung
**Severity: High** · betrifft AC-11, AC-12, EC-7

`src/app/auth/confirm/route.ts:57-77` ruft `verifyOtp` auf und enthält **keinen** `registerAttempt`-Aufruf — anders als alle drei Server Actions (`actions.ts:47`, `:92`, `:136`). Gemessen: **40 ungültige Token-Einlösungen von einer Verbindung, 40× 307, null abgewiesen.**

**Warum das trotz hoher Token-Entropie ein High ist — und der Grund ist nicht das Erraten.** Der Weg ist ein ungebremster Kanal zum Auth-Dienst. Supabase begrenzt `token_verifications` auf 30 je 5 Minuten (`config.toml:222`), und dieses Limit sieht wegen der Server-Action-Architektur für **alle** Spieler dieselbe Server-IP (BUG-21). Ein Angreifer kann das gemeinsame Kontingent also erschöpfen und damit **jeden legitimen Passwort-Reset blockieren** — und der Reset ist laut PRD der einzige Weg zurück ins Konto. Lokal löste das Limit nicht aus (dasselbe Muster wie beim historischen AC-8-Problem), gegen das gehostete Projekt ist es zu messen.

**Repro:** 40× `GET /auth/confirm?token_hash=<beliebig>&type=recovery` von einer Verbindung — keine Abweisung.

#### BUG-72: Der rohe `x-forwarded-for` wird ungeprüft zum Datenbank-Primärschlüssel
**Severity: Medium** · betrifft AC-8, AC-18

`src/lib/auth/throttle.ts:60-66` übernimmt den Headerwert ohne Längen- oder Formatprüfung; `0003_auth_throttle.sql:15` ist `key text primary key`. Gemessen: ein Schlüssel mit **4009 Zeichen** in der Tabelle. Oberhalb der ~8-KB-Indexgrenze bricht das Einfügen ab und erzwingt einen **vom Client per Kopfzeile auslösbaren, unbehandelten HTTP 500** auf dem Anmeldepfad. Im Dev-Modus enthält die Antwort Fehlertext und absolute Dateipfade (in Produktion ersetzt Next das durch einen Digest — an der Live-URL zu bestätigen).

Die Richtung ist korrekt (AC-18: abgelehnt statt durchgelassen), aber ein Fehlerpfad, den ein Fremder auf Zuruf auslöst, gehört behandelt.

#### BUG-73: `auth_throttle` wächst unter Angreiferkontrolle unbegrenzt
**Severity: Medium** · betrifft AC-8, AC-18

Jeder unterschiedliche Headerwert erzeugt eine neue Zeile — **auch wenn der Versuch abgewiesen wird** (`throttle.ts:103-109`, „Beide werden immer gezählt"). Gemessen, 30 Login-Versuche mit je 1500 Zeichen Zufallswert gegen **eine** Adresse: **+30 Zeilen, +81 920 Bytes**, davon 10 abgewiesene — und trotzdem eingefügt.

`prune_auth_throttle` (`0005`) räumt nur Fenster **älter als eine Stunde** und höchstens 50 Zeilen je Aufruf; der stehende Bestand einer Angriffsstunde ist damit unbegrenzt. Auf einem 500-MB-Free-Tier relevant. Der *beliebige* Wert hängt an BUG-61 — die **Kardinalität** bleibt aber auch danach, weil ein einzelnes IPv6-/64 praktisch unbegrenzt echte Adressen liefert.

> **BUG-72 und BUG-73 haben dieselbe Wurzel** — der Headerwert geht ungeprüft weiter — und eine gemeinsame Behebung (Länge begrenzen, Format prüfen, sonst auf einen Sammelschlüssel abbilden).

#### BUG-74: `.ilike()` in der neuen Trainername-Nachfrage — falsche Aussage und Full Scan
**Severity: Medium** · betrifft AC-2, EC-1 · **Defekt im Fix zu BUG-68**

`src/lib/auth/trainer-name.ts:31-36` fragt mit `.ilike('trainer_name', trainerName)`. `_` ist ein **erlaubtes** Trainername-Zeichen (`validation/auth.ts:7`) **und** ein LIKE-Platzhalter für genau ein Zeichen. Die App-Prüfung weicht damit von der Wahrheitsquelle ab, die der Trigger benutzt (`0001_profiles.sql:39`: `lower(...) = lower(...)`).

**Von zwei Lanes unabhängig belegt**, über zwei verschiedene Wege:

```
select count(*) from profiles where lower(trainer_name)=lower('QaPro_e1');  -> 0   (Name ist FREI)
GET /rest/v1/profiles?select=id&trainer_name=ilike.QaPro_e1&limit=1         -> [{"id":"d120…"}]  (App: „vergeben")
GET /rest/v1/profiles?trainer_name=ilike.QaOutage_robe                      -> [{"trainer_name":"QaOutageProbe"}]
```

**Zwei Wirkungen:**

1. **Der Rest von BUG-68.** Bei einer echten Störung während der Registrierung liest ein Nutzer, dessen Wunschname einen Unterstrich enthält, wieder „Dieser Trainername ist bereits vergeben." — genau die Fehlklasse, die der Fix beseitigen sollte, nur enger.
2. **Ein Verstärker.** `ilike` kann den Funktionsindex `profiles_trainer_name_lower_key` nicht benutzen. Gemessen: `Seq Scan`, 0,72 ms gegen 0,03 ms beim Index-Scan — **Faktor ~23 bei 1340 Zeilen, linear wachsend**. 25 Registrierungen mit vergebenem Namen erzeugten **+22 Full Scans und +29 467 gelesene Zeilen** — und legten **kein einziges Konto an**, hinterlassen also keine Spur und brauchen kein Aufräumen.

Korrekt wäre ein Vergleich ohne Musterzeichen — Escaping von `_`, oder besser eine Abfrage, die denselben Funktionsindex trifft wie der Trigger.

#### BUG-75: Die Verdrahtung beider Fixes hat keinen Wächter
**Severity: Medium**

Lane 3 hat nicht nur die Wächter mutiert, sondern auch den Code, der sie benutzt:

| Mutation | Ergebnis |
|---|---|
| BUG-68-Guard in `error-mapping.ts` entfernt | **rot** (1 Test) |
| BUG-66-Guard in `error-mapping.ts` entfernt | **rot** (1 Test) |
| `isTrainerNameTaken` in `actions.ts:68` umgangen (`… : false` → `false`) | **171/171 grün** |
| `mapUpdatePasswordError` in `actions.ts:198` nicht mehr aufgerufen | **171/171 grün** |

Man könnte AC-2 vollständig totlegen — jeder vergebene Trainername würde als „Die Verbindung ist fehlgeschlagen" gemeldet — und die Suite bliebe grün. Dazu: `src/lib/auth/trainer-name.ts` ist die **einzige** Datei unter `src/lib/auth/` ohne Testdatei daneben, obwohl sie die einzige Stelle außerhalb der Drosselung ist, die den Service-Role-Schlüssel benutzt. Ihr Fehlerpfad (`catch → false`) ist nirgends abgesichert.

Der Rot-Nachweis im vorherigen Nachtrag war korrekt, aber **eine Ebene zu tief angesetzt**: Er belegte, dass die Funktionen richtig entscheiden, nicht dass die Actions sie benutzen.

#### BUG-76: Der Reset-Pfad hat keine eigene Konto-Grenze
**Severity: Low** · betrifft AC-17

`throttle.ts:105` nimmt für **jeden** Scope `LIMITS.credentialsPerAccount` (20/15 min). Für den Reset heißt das: bis zu 20 Mails je 15 Minuten an eine Opferadresse, sobald Adressen rotierbar sind (BUG-61) — rund 80 pro Stunde, jede eine Einheit des SMTP-Kontingents. AC-17 nennt nur die Verbindungsgrenze; die Konto-Seite steht in keinem Kriterium. Lokal nicht bis zur Grenze messbar, weil Supabases `email_sent = 2/h` vorher greift.

#### BUG-77: Der `origin`-Header fließt ungeprüft in `redirectTo`
**Severity: Low** · betrifft AC-10, AC-11, EC-7

`actions.ts:147-163` nimmt `headerList.get('origin') ?? NEXT_PUBLIC_SITE_URL` ohne eigene Prüfung. **Lokal folgenlos** — nachgemessen mit `Origin: https://evil.example`: Der Mail-Link zeigt weiterhin auf `localhost:3000`, weil die eigene Vorlage `{{ .SiteURL }}` benutzt und die Redirect-Allowlist eng steht.

**Scharf wird es genau dann, wenn beides zutrifft, was in Produktion offen ist:** Vorlage nicht gesetzt (**T18**, Deploy-Blocker) → Supabase nimmt die Standardvorlage mit `{{ .ConfirmationURL }}`, gebaut aus `redirect_to`; **und** die Redirect-Allowlist des gehosteten Projekts steht weit. Dann zeigt der Reset-Link eines Opfers auf eine fremde Domain.

#### BUG-78: Ein Test verspricht im Namen mehr, als er bewacht
**Severity: Low**

„lässt die Nachfrage den 429 nicht überstimmen — Drosselung bleibt Drosselung" (`error-mapping.test.ts`) bleibt grün, wenn man die 429-Prüfung **unter** den 500-Zweig verschiebt. Rot wird er erst, wenn der 429-Zweig ganz verschwindet — die Reihenfolge, die sein Name behauptet, bewacht er nicht.

#### Unverändert offen aus den Vorläufen
- **BUG-67** (Low) — Sperrmeldung nennt immer „von dieser Verbindung", auch wenn der **Konto**-Zähler auslöst. In beiden Lanes erneut beobachtet
- **BUG-70** (Low) — breite GRANTs auf `auth_throttle`; weiterhin wirkungslos, weil RLS ohne Policy alles sperrt (in diesem Lauf erneut belegt)
- **BUG-61**, **BUG-12**, **BUG-18** — Deploy-Blocker, mit ihren Zahlen bestätigt (25 Konten in 10,1 s; keine Security-Header; `X-Forwarded-Host` lässt die Action laufen)

### `[user]`-Aufgaben

- [x] **T4** — abgehakt; lokal gegengeprüft (`config.toml:199`). Die gehostete Einstellung wurde in diesem Lauf nicht erneut gemessen (die Messung vom selben Tag steht weiter oben)
- [ ] **T18** — offen, auf dem Passwort-Reset-Pfad. Nach der Skill-Regel ein **High**. Bereits als Deploy-Blocker in `features/INDEX.md` geführt und **nicht setzbar**, solange kein eigener SMTP-Dienst existiert. Lokal funktioniert EC-7 mit der Vorlage `supabase/templates/recovery.html` nachweislich. **BUG-77 hängt daran**

### Regression und automatisierte Tests

| Prüfung | Ergebnis |
|---|---|
| **Test** | ✅ 17 Dateien, **171/171** |
| **Lint** | ✅ **73 Dateien, 0 Errors, 0 Warnings** (Dateizahl aus dem JSON-Report gezählt) |
| **Build** | ✅ Exit 0 in einer Kopie, plus `tsc --noEmit` **im echten Projekt** über 115 Dateien inkl. `tests/` |
| **E2E** | ✅ **33/33** in Chromium, Firefox, Mobile Safari — Browser waren vorhanden, **nichts nachinstalliert** |

**0 Regressionen an PROJ-2** (einziges `Approved`-Feature; kein Feature steht auf `Deployed`). Schema, beide Trigger, alle Policies und Constraints unversehrt; Funktions-GRANTs nur `postgres` + `service_role`. **Aufräum-Mechanik aktiv nachgewiesen:** künstlich auf 2 Stunden gealterte Zeile eingefügt → nach einem Zählvorgang verschwunden.

**Der Projektbaum ist unverändert** (`git status --porcelain` leer); alle Mutationen liefen in einer Kopie außerhalb des Projekts.

### Unit-Tests aus diesem Lauf

**Keine geschrieben — mit Begründung, nicht aus Versäumnis.** Die identifizierte Lücke (BUG-75) sitzt an Code, der in diesem Lauf als defekt befunden wurde (BUG-74). Ein Test gegen den jetzigen Stand würde entweder das `ilike`-Verhalten als richtig festschreiben oder als roter Test liegen bleiben — beides schlechter als eine benannte Lücke. **Die Tests gehören in denselben `/build`-Durchgang, der BUG-74 behebt**, und dann auf die Verdrahtung, nicht nur auf die reine Funktion.

### Not Verified In This Run

- [!] **Cross-Browser, responsive Darstellung (375/768/1440 px), DevTools-Prüfungen** — kein Browser-Engine. Betrifft die *sichtbare* Darstellung von AC-13, AC-14, AC-15 und den AuthCard-Umschalter
- [!] **Visuelle Regression an geteilten Komponenten** — kein Bildvergleich vorhanden
- [!] **AC-13 „ohne dass die Seite neu lädt"** und **AC-3 „Link zum Login"** — clientseitiges Verhalten
- [!] **AC-15 optische Platzierung** — Markup und Chunk-Inhalt belegt, gerendertes Layout nicht
- [!] **EC-6 echter Netzwerkausfall** — nicht provozierbar, ohne den Stack für die parallelen Lanes lahmzulegen
- [!] **BUG-68 Gegenrichtung zur Laufzeit** — verlangt einen 500 ohne Namenskollision, also einen DDL-Eingriff in die Test-Datenbank; von der Berechtigungsprüfung der Umgebung blockiert. Belegt sind nur Codeebene und Unit-Test
- [!] **Rate Limiting auf gewöhnlichen Endpunkten** — **nicht implementiert (für MVP optional)**, gemessen: 60× `GET /login` ohne Drosselung. Kein Pass
- [!] **Security-Header, BUG-61-Schließbedingung, T18, Redirect-/Site-URL des gehosteten Projekts** — nur gegen die Live-URL bzw. das Dashboard prüfbar. Damit auch die tatsächliche Ausnutzbarkeit von BUG-77
- [!] **Supabases `token_verifications`-Kontingent** (der Kern von BUG-71) — 40 direkte Aufrufe lösten lokal kein 429 aus, dasselbe Muster wie beim historischen AC-8-Problem. Gegen das gehostete Projekt zu messen
- [!] **Mail-Bombing über den Reset-Konto-Zähler bis zur Grenze** — lokal durch `email_sent = 2/h` abgeschnitten; nur der Code-Beleg liegt vor

### Verdikt

**NOT READY.** Kein Critical. **Ein High: BUG-71.** Dazu 4 Medium (BUG-72, BUG-73, BUG-74, BUG-75) und 3 Low (BUG-76, BUG-77, BUG-78), plus die weiterhin offenen BUG-67 und BUG-70.

**Was dieser Lauf positiv festgestellt hat:** Der Vertrag wird eingehalten — alle 17 AC und alle 10 EC bestanden, EC-1 unter echter Gleichzeitigkeit, EC-8/EC-9 mit exakt den zugesagten Zahlen. BUG-66 ist bestätigt behoben. Die Drosselung ist durch den Eingriff **nicht** beschädigt worden, und der Service-Role-Schlüssel erreicht den Browser nicht — beides mit belastbaren Kontrollen geprüft.

**Was offen bleibt:** BUG-71 ist neu und unabhängig vom Fix. BUG-74 und BUG-75 sind Defekte **im Fix selbst** und in seiner Absicherung; BUG-72 und BUG-73 lagen schon vorher im Drosselungspfad und sind erst jetzt aufgefallen.

**Drei Dinge gehören außerdem in den Vertrag statt in einen Bugreport:** die Zahlen in **EC-10** sind maschinenabhängig und zu eng formuliert; die **Konto-Grenze des Reset-Pfads** (BUG-76) steht in keinem Kriterium; und ob `/auth/confirm` gedrosselt sein muss, ist eine Frage an AC-11/AC-12, die der Vertrag nicht beantwortet.

`features/INDEX.md` bleibt bei **In Review**.

---

## QA-Lauf — 2026-09-06, nach AC-19/AC-20 und dem BUG-67-Fix

**Anlass:** AC-19 und AC-20 waren erstmals gebaut und nie unabhängig geprüft; BUG-67, BUG-74 und BUG-75 wurden in derselben Sitzung behoben, in der sie gefunden worden waren. Schwerpunktfrage des Nutzers: **Gibt die neue, ursachenbezogene Sperrmeldung irgendwo Informationen preis?**

**App URL:** `http://localhost:3000` · **Tester:** drei `qa-engineer`-Sub-Agenten mit disjunktem Scope und sauberem Kontext. Lane 2 bekam die Schwerpunktfrage **offen** gestellt — mit den zu prüfenden Angriffsflächen, aber ohne vorweggenommenes Ergebnis.

### Ergebnis in einem Satz

**Die neue Meldung ist sauber — aber zwei Lanes haben unabhängig voneinander ein Kontoexistenz-Orakel im Zweig daneben gefunden, das älter ist als der Fix und AC-10 sowie EC-3 im Wortlaut bricht.** Dazu deckt ein Mutationstest über 32 Fälle auf, dass die Tests aus dem letzten Build zwei von fünf Aufrufstellen bewachen — die drei übrigen nicht.

### Die Schwerpunktfrage, einzeln beantwortet

Alle fünf Teilfragen an der laufenden App gemessen, nicht aus dem Code abgeleitet:

| Frage | Antwort | Beleg |
|---|---|---|
| Verrät die Unterscheidung Verbindung/Adresse die **Kontoexistenz**? | **Nein** | Beide Pfade, existierende gegen frei erfundene Adresse: Reset je 5 durch, ab der 6. `ACCOUNT`; Login je exakt 20 durch, ab der 21. `ACCOUNT`. Der Zähler zählt Adressen ohne Konto identisch mit |
| Neuer **Zeitseitenkanal**? | **Nein** | Im gesperrten Zustand Median 108 ms (existierend) gegen 106 ms (erfunden) — 2 ms. Der EC-10-Kanal **verschwindet** dort sogar, weil Supabase gar nicht mehr angerufen wird |
| **Zählerstand** ablesbar? | **Ja, exakt** — BUG-84, Low | Fremdverbrauch korrekt bestimmt (2 von 5 belegt → 3 gingen durch; unbelastet → 5) |
| Was erfährt ein **Erstkontakt** mit sofortiger Adressmeldung? | Dass Dritte die Adresse im laufenden Fenster bearbeitet haben — **keine** Kontoexistenz | Erstkontakt von unbelasteter IP (`attempts = 1`) nach 5 fremden Anfragen → `ACCOUNT` |
| Systematisches **Orakel**? | **Ja — aber aus dem Zweig daneben**, nicht aus der Unterscheidung | BUG-79, siehe unten |

**Die Antwort auf die gestellte Frage lautet also: Nein, die neue Meldung leckt nicht.** Der Befund liegt daneben und wurde durch den Fix weder verursacht noch verschärft.

### Acceptance Criteria

Alle geprüft. **Bestanden: AC-1 bis AC-8, AC-11 bis AC-20.** **Fehlgeschlagen: AC-10** (siehe BUG-79).

Hervorzuheben:

- **AC-20 — entscheidend belegt, von beiden Lanes unabhängig.** Der `Location`-Header taugt nicht als Beleg, weil die Abweisung laut Vertrag absichtlich wie ein abgelaufener Link aussieht. Beide Lanes lösten das gleich: echten Token aus dem Postfach ziehen, Verbindung bis an die Grenze füllen, dann den **gültigen** Token von dort abweisen lassen (kein `Set-Cookie`) und **denselben** Token unmittelbar danach von einer unbelasteten Verbindung erfolgreich einlösen. Nur die Drosselung kann ihn aufgehalten haben, und sie greift vor dem Auth-Dienst
- **AC-19 — gemessen mit einer frei erfundenen Adresse**, damit zugleich die Zusage „der Zähler zählt jede Adresse" geprüft ist: 5 durch, ab der 6. abgewiesen, abweisende Verbindung nachweislich unbelastet (1 von 3)
- **AC-18 — zur Laufzeit provoziert**, indem der `execute`-Grant auf `register_auth_attempt` kurzzeitig entzogen wurde: Login mit **korrekten** Zugangsdaten → HTTP 500, kein Cookie, kein Redirect. Grant danach wiederhergestellt und mit `has_function_privilege` **und** einem erfolgreichen Login gegengemessen
- **AC-8 — die Reihenfolge belegt**, nicht nur die Zahl: Der 8. Versuch mit **korrekten** Zugangsdaten wurde ebenfalls abgewiesen, die Drosselung greift also vor der Zugangsdatenprüfung

### Edge Cases

**Bestanden: EC-1, EC-2, EC-5, EC-7.** **Fehlgeschlagen: EC-3** (BUG-79). **Teilweise: EC-4** (BUG-80), **EC-6** (kein echter Ausfall provozierbar).

- **EC-1** — Garantie im Code (`0001_profiles.sql:13` Unique-Index auf `lower()`, Trigger in derselben Transaktion) **und** echter Wettlauf: 6 parallele Registrierungen in 6 Schreibweisen → genau 1 Gewinner, 5 Feldfehler, 1 `profiles`-Zeile, **0 auth.users ohne Profil**
- **EC-4** — alle drei zugesagten Zweige stimmen, einzeln gemessen: nur Verbindung → „von dieser Verbindung"; nur Adresse (unbelastete Verbindung) → „für diese E-Mail-Adresse"; **beide zugleich → die Adresse**, wie verlangt. Selbstheilung gemessen: Fenster um 61 s zurückdatiert → nächster Versuch geht durch. **Aber es gibt einen vierten Zweig, den der Vertrag nicht kennt** — siehe BUG-80

**EC-8, EC-9, EC-10 — Zusagen halten, keine Abweichung.** EC-8: 8 von 8 ohne Tippfehler (Zähler danach 0), 4 von 8 mit je einem. EC-9: 20 von 20 durch, dann der Besitzer mit richtigem Passwort von unbelasteter Verbindung abgewiesen. EC-10: rund 58–60 ms in beiden Lanes — Richtung und Größenordnung wie zugesagt. **Die am 2026-09-06 entschärfte Formulierung hat sich bewährt:** Mit der alten festen Zahl hätten beide Lanes eine Abweichung melden müssen, die keine ist.

### Security-Audit

**17 Prüfungen belegt · 4 `[!] NOT VERIFIED` · 1 High, 1 Medium, 3 Low.**

Sauber und mit Belegen: Authentifizierungs-Umgehung · **Autorisierung mit zwei echten Sitzungen** (fremde `runs` lesen → `[]`, INSERT → `42501`, UPDATE/DELETE → 0 Zeilen bei unveränderten 446) · Funktions-Grants inklusive der neuen `is_trainer_name_taken` (für `anon` **und** `authenticated` gesperrt) · Input-Injection (0 angelegte Profile, `runs` unverändert) · Open Redirect `?next=` (fünf Varianten, alle abgewiesen — BUG-20 nicht zurück) · Brute Force auf beiden Zählern · Erstattungs-Semantik (BUG-39 nicht zurück) · Zugangsdaten in der URL · Session-Cookie.

**Geheimnisse: kein Treffer, mit belastbarer Kontrolle.** 5.357.138 Byte tatsächlich ausgeliefertes Material — HTML von fünf Routen plus alle 19 nachgeladenen JS-Chunks. Sechs Suchmuster (Service-Role-Wert, Literal `service_role`, Variablenname, `isTrainerNameTaken`, `register_auth_attempt`, Anon-Wert) je **0 Treffer**, bei **drei Positivkontrollen > 0**.

### Bugs

#### BUG-79: Die Kontoexistenz ist über den Passwort-Reset ermittelbar
**Severity: High** · bricht **AC-10** und **EC-3** im Wortlaut · `.claude/rules/security.md` → „Never reveal whether an account exists"

**Von zwei Lanes unabhängig gefunden.** Zwei aufeinanderfolgende Anfragen für dieselbe Adresse genügen:

| 2. Reset-Anfrage | Konto existiert | Konto existiert nicht |
|---|---|---|
| Antwort | „Zu viele Versuche von dieser **Verbindung**." | „Falls diese Adresse registriert ist, wurde ein Link verschickt." |

**Gemessen: 30 von 30 Adressen korrekt bestimmt, ~2 Adressen/Sekunde**, ohne Zeitmessung, ohne Statistik, ohne eigenes Konto.

**Ursache.** Supabase antwortet auf `/auth/v1/recover` mit `429 over_email_send_rate_limit` **nur dann, wenn tatsächlich eine Mail hinausginge** — also nur bei existierenden Konten. `mapPasswordResetRequestError` (`src/lib/auth/error-mapping.ts:123`) bildet diesen 429 auf die Drosselungsmeldung ab, während die unbekannte Adresse die Bestätigung bekommt. Direkt gegen die Auth-API bestätigt, an der App vorbei:

```
POST /auth/v1/recover  {"email":"<existiert>"}       -> 1. 200   2. 429 over_email_send_rate_limit
POST /auth/v1/recover  {"email":"<existiert nicht>"} -> 1. 200   2. 200
```

**Ausschluss der App-Zähler gemessen:** `password-reset:ip:… = 2` (Grenze 3) und `password-reset:account:… = 2` (Grenze 5) — **keiner** der beiden hatte gegriffen.

**Herkunft, damit die Zuordnung stimmt:** Diese Zeile steht seit dem ursprünglichen Build und ist **nicht** durch den BUG-67-Fix entstanden. Drei vorherige QA-Läufe haben sie nicht gefunden. Der Fix hätte sie allerdings aufdecken müssen: Er stellte die Drosselungsmeldungen auf Ursachenbezug um und ließ genau die Funktion aus, die dieselbe Art Zuordnung macht.

**In Produktion wird es größer, nicht kleiner:** Lokal steht `max_frequency` auf 1 Sekunde, der gehostete Supabase-Standard ist **60 Sekunden** — das Zeitfenster ist 60× breiter. Dazu erzeugt das Stundenkontingent (`email_sent`, laut `config.toml` 2/Stunde) denselben 429 aus einem zweiten Grund; solange es erschöpft ist, steht das Orakel dauerhaft offen.

> **Diese Konsequenz reicht über den Befund hinaus: BUG-79 entwertet die Begründung von EC-9.** Dort ist das Aussperren eines Kontos als Low akzeptiert, **ausdrücklich weil man die Adresse kennen muss**. Wer Adressen maschinell bestätigen kann, hat diese Voraussetzung. Nach dem Fix gehört EC-9 neu gerechnet — und die DSGVO-Seite mitbedacht, denn die bloße Zugehörigkeit zu diesem Dienst ist ein personenbezogenes Datum (`docs/PRD.md`: `standard`-Niveau, absehbar minderjährige Nutzer).

**Reproduktion:** 2× `requestPasswordResetAction` für dieselbe Adresse innerhalb von `max_frequency`, von einer Verbindung. Verbindungs-Meldung ⇒ Konto existiert; Bestätigung ⇒ existiert nicht.

#### BUG-80: Die Sperrmeldung nennt eine Ursache, die messbar nicht zutrifft
**Severity: Medium** · betrifft **EC-4** · dieselbe Codezeile wie BUG-79

EC-4 verlangt, dass die Meldung sagt, **welche der beiden Grenzen** griff. In der oben gezeigten Abweisung griff **keine**: Verbindungszähler 2 von 3, Adresszähler 2 von 5. Der Nutzer liest „von dieser Verbindung", wechselt das Netz — und es hilft nicht, weil die Ursache das Mailkontingent des Projekts ist. Genau die Fehlklasse, die BUG-67 für den Konto-Zähler beseitigt hat; `mapPasswordResetRequestError` wurde dabei nicht mitgezogen.

> **BUG-79 und BUG-80 haben dieselbe Wurzel und eine gemeinsame Behebung** — mit einer wichtigen Umkehrung gegenüber AC-19: Supabases 429 darf **nicht** unterscheidbar sein, weil er nur bei existierenden Konten auftritt. Die App-eigenen Zähler dürfen ihre Ursache nennen, weil sie auch unbekannte Adressen zählen. Der Unterschied ist nicht Formulierungskunst, sondern messbar.

#### BUG-81: Die Aufräumlogik nach dem Login ist von der schnellen Testsuite völlig unbewacht
**Severity: High**

Ein Mutationstest über **32 Fälle** (in einer Wegwerf-Kopie, Projektbaum unangetastet) zeigt: 26 Mutationen werden erkannt, **6 überleben** — und die schwerste ist keine Kleinigkeit.

| Mutation | `npm test` | E2E deckt |
|---|---|---|
| **M27** `settleSuccessfulLogin` läuft **auch nach fehlgeschlagenem** Login → beide Zähler bei **jedem** Rateversuch zurückgesetzt | **0 rot** | ja |
| **M13** `settleSuccessfulLogin` wird gar nicht mehr aufgerufen | **0 rot** | ja |
| **M31** `settleSuccessfulLogin` bekommt die **falsche Adresse** → Konto-Zähler wird nie geleert | **0 rot** | **nein** |

**M27 wäre unbegrenztes Raten** — AC-8 und AC-16 gleichzeitig tot. Das schnelle Gate (`npm test`, 3,8 s) fängt es nicht; nur die langsame Browser-Suite. **Und genau diese Datei ist bereits zweimal in Folge in die jeweils andere Richtung gekippt** (BUG-39, dann BUG-54).

**Ursache im Testcode belegt, nicht vermutet:** `actions.test.ts:20` legt einen Spion `settleSuccessfulLogin: vi.fn()` an und mockt ihn in Zeile 27 — **kein einziger Test prüft ihn danach.** Das ist genau die Hälfte, die der Kopf derselben Datei als ihren Existenzgrund nennt („nicht was die Funktionen entscheiden, sondern **dass sie gefragt werden**"): umgesetzt für zwei von fünf Aufrufstellen.

#### BUG-82: Zwei weitere ungeprüfte Aufrufstellen
**Severity: Medium**

| Mutation | Folge | Erkannt von |
|---|---|---|
| **M12** `registerAction` zählt mit `null` statt der E-Mail | Konto-Hälfte der Registrierungs-Drosselung tot | **niemandem** |
| **M14** `updatePasswordAction` prüft die Recovery-Sitzung nicht mehr | AC-12 gebrochen | **niemandem** |

Belegt: Die Argumente von `registerAttempt` werden nirgends geprüft (die einzige `toHaveBeenCalledWith`-Zeile der Datei betrifft `isTrainerNameTaken`); `getUser` wird in `beforeEach` gesetzt und **nie auf `null` gekippt**; `INVALID_RESET_LINK_MESSAGE` kommt in **keiner** Testdatei vor.

#### BUG-83: `profiles` gibt angemeldeten Nutzern alle Spalten heraus
**Severity: Low** · betrifft PROJ-3 stärker als PROJ-1

`profiles_select_authenticated` hat `USING (true)` ohne Spaltenbeschränkung — angemeldete Nutzer lesen neben `trainer_name` auch `id` (die Auth-User-UUID) und `created_at`. `design.md` sagt „darf `trainer_name` aller Profile lesen". Eine Spaltenbeschränkung oder eine View wäre die engere Umsetzung.

#### BUG-84: Der Zählerstand einer fremden Adresse ist ablesbar
**Severity: Low**

Der Konto-Zähler ist eine geteilte Ressource. Wer zählt, wie viele Anfragen noch durchgehen, liest den Fremdverbrauch exakt aus (gemessen: 2 von 5 belegt → 3 gingen durch; unbelastet → 5) und erfährt damit, **dass gerade jemand für diese Adresse ein Passwort zurücksetzt** — ein brauchbares Timing-Signal für eine Phishing-Mail. Keine Kontoexistenz. Das Ablesen kostet das gesamte Stundenbudget des Opfers, ist also zugleich die in AC-19 bewusst akzeptierte Sperre. Strukturbedingt bei jedem geteilten Konto-Zähler vorhanden.

#### BUG-85: `anon` und `authenticated` besitzen `TRUNCATE` auf allen drei Tabellen
**Severity: Low**

`has_table_privilege` = true für `profiles`, `runs`, `auth_throttle` (Supabase-Standard `GRANT ALL`). **`TRUNCATE` unterliegt in PostgreSQL nicht der Row Level Security.** Über PostgREST nicht auslösbar, über die App-Oberfläche also nicht ausnutzbar — aber RLS ist damit nicht das Einzige, was zwischen der `anon`-Rolle und den Daten steht. Verwandt mit dem offenen BUG-70.

#### BUG-86: `npm run lint` prüft keine TypeScript-Regeln
**Severity: Low**

66 Regeln konfiguriert, **61 aktiv — sämtlich React / Next / react-hooks / jsx-a11y.** Gemessen: `const qaUnbenutzt = 1` und `function qaKaputt(x: any)` liefen ohne einen Befund durch. Unbenutzte Variablen und `any` fängt hier nichts; das Typnetz ist allein der `tsc`-Schritt in `next build`. Der Lint-Lauf ist echt (Positivkontrolle: ein `<img>` wurde als `no-img-element` gemeldet), nur schmaler als sein grünes Ergebnis suggeriert.

#### Unverändert offen aus den Vorläufen
- **BUG-72, BUG-73** (Medium) — roher `x-forwarded-for` als DB-Schlüssel; gemeinsame Wurzel, gemeinsame Behebung
- **BUG-77** (Low) — hängt an T18; lokal wie dokumentiert nicht auslösbar, weil die eigene Vorlage `{{ .SiteURL }}` nutzt
- **BUG-78** (Low), **BUG-70** (Low)
- **BUG-61**, **BUG-12**, **BUG-18** — Deploy-Blocker, mit ihren Zahlen bestätigt (25 Konten in 9 s; keine Security-Header)

### `[user]`-Aufgaben

- [x] **T4** — abgehakt und lokal beobachtbar bestätigt: Registrierung mit 7 Zeichen → Feldfehler, **kein Konto angelegt**
- [ ] **T18** — offen, auf dem Passwort-Reset-Pfad. Nach Skill-Regel ein **High**. Bereits Deploy-Blocker und sachlich blockiert (kein eigener SMTP; Free Tier lehnt `supabase config push` ab). **BUG-77 hängt daran**

### Regression und automatisierte Tests

| Prüfung | Ergebnis |
|---|---|
| **Test** | ✅ 19 Dateien, **205/205**, zweimal gelaufen |
| **Lint** | ✅ 0/0 — **75 Dateien** wirklich geprüft, mit Positivkontrolle. Reichweite siehe BUG-86 |
| **Build** | ✅ Exit 0 (isolierte Kopie aus `git archive HEAD`; einziger Unterschied zum Arbeitsbaum ist `features/INDEX.md`) |
| **E2E** | ✅ **33/33** in drei Engines — Browser waren vorhanden, **nichts nachinstalliert** |

**0 Regressionen an PROJ-2** (einziges `Approved`-Feature; kein Feature steht auf `Deployed`). Routen-Wächter, Kopfzeile mit Abmelden, Schema, Policies, Constraints alle unversehrt.

**Datenbank:** 6 von 6 Migrationen angewandt, deckungsgleich mit den Dateien. RLS empirisch mit `set role` geprüft — `anon` sieht 0/0/0 und bekommt auf alle fünf Funktionen `permission denied`. **Löschtrigger in einer zurückgerollten Transaktion gemessen:** alle drei Konto-Schlüssel weg, IP-Schlüssel unverändert da, `profiles`/`runs` sauber kaskadiert. Aufräum-Mechanik arbeitet: 882 Zeilen, **0 älter als eine Stunde**. Alle vier Scopes zählen tatsächlich, auch der neue `token-confirm` (30 IP-Schlüssel). `profiles` 1570 = `auth.users` 1570.

### Unit-Tests aus diesem Lauf

**Keine geschrieben — mit Begründung.** Die identifizierten Lücken (BUG-81, BUG-82) sind Lücken in Tests, die **ich in derselben Sitzung geschrieben habe**. Sie jetzt selbst zu schließen, würde Finder und Behebenden erneut zusammenlegen — genau der Fehler, der diese Lücken überhaupt erst entstehen ließ: Der Rot-Nachweis zu BUG-75 saß eine Ebene zu tief und deckte zwei von fünf Aufrufstellen ab. Die fehlenden Tests gehören in denselben `/build`-Durchgang, der BUG-79 behebt, und danach unabhängig geprüft.

### Not Verified In This Run

- [!] **Cross-Browser, responsive Darstellung (375/768/1440 px), DevTools** — kein Browser-Engine. Die Playwright-Suite lief über drei Engines, prüft aber Journeys, keine Darstellung
- [!] **AC-13 zweite Hälfte („ohne dass die Seite neu lädt")** und **AC-14/AC-15 als sichtbare Darstellung** — Client-Verhalten; Quelltext und Komponententests belegt. Die Registrierungsansicht steht nicht im server-gerenderten HTML (Client-Umschalter), per `curl` also nicht prüfbar
- [!] **EC-6 an einem echten Ausfall** — nicht provoziert; der Auth-Container hätte gestoppt werden müssen, was die parallelen Lanes getroffen hätte
- [!] **Ob die E2E-Suite M13 und M27 wirklich rot meldet** — hätte einen zweiten Dev-Server mit mutiertem Code und damit `.env.local` verlangt. Die Deckung ist **aus dem Testcode** belegt (`PROJ-1-throttle.spec.ts:96–105` und `:191–197`); die für den Befund entscheidende Hälfte ist gemessen: **`npm test` fängt beide nicht**
- [!] **Rate Limiting auf gewöhnlichen Endpunkten** — nicht implementiert (40× `GET /login` → 40× 200). Für ein MVP optional, kein Pass
- [!] **BUG-61-Schließbedingung, Security-Header, T18 und BUG-77 im gehosteten Projekt** — nur gegen die Live-URL bzw. das Dashboard prüfbar
- [!] **Build mit echten Umgebungsvariablen** — bewusst ohne `.env.local` in einer Kopie gebaut

### Verdikt

**NOT READY.** Kein Critical. **Zwei High: BUG-79 und BUG-81**, dazu das nach Skill-Regel als High geführte offene **T18** (deploy-blockiert). Ferner 2 Medium (BUG-80, BUG-82) und 4 Low (BUG-83 bis BUG-86).

**Was dieser Lauf positiv festgestellt hat:** Die Schwerpunktfrage ist beantwortet — **die neue ursachenbezogene Meldung leckt nicht**, in fünf Teilaspekten einzeln gemessen. AC-19 und AC-20 halten, beide erstmals unabhängig und AC-20 entscheidend getrennt. AC-18 wurde zur Laufzeit provoziert. Die Fixes zu BUG-66, BUG-67 und BUG-74 tragen; 26 von 32 Mutationen werden erkannt, inklusive der Verdrahtungsebene und zweier Reihenfolge-Mutationen, die kein Testname ankündigt.

**Was offen bleibt:** BUG-79 ist ein deterministisches Orakel auf einem Pfad, den der Vertrag ausdrücklich anders zusagt — und es entwertet die Begründung von EC-9. BUG-81 zeigt, dass die schnelle Testsuite einen Zustand durchließe, in dem unbegrenztes Raten möglich wäre.

**Drei Dinge gehören nach dem Fix in den Vertrag, nicht in einen Bugreport:** die neu zu rechnende Risikoakzeptanz in **EC-9**; die Frage, ob der vierte Abweisungsgrund (Mailkontingent des Anbieters) ein eigenes Kriterium braucht; und ob `profiles` spaltenbeschränkt gelesen werden soll (BUG-83), was PROJ-3 betrifft.

`features/INDEX.md` bleibt bei **In Review**.

---

## Nachtrag — 2026-09-06: Ausgang der Befunde aus dem Lauf oben

_Geschrieben vom Fix-Durchgang, **nicht** von einem QA-Lauf. Die Belege stehen unten, sie sind aber **nicht unabhängig verifiziert** — das holt der nächste `/qa`-Lauf nach._

| Befund | Entscheidung | Stand |
|---|---|---|
| **BUG-79** Kontoexistenz-Orakel (High) | beheben | ✅ behoben, live gegengeprüft |
| **BUG-80** falsche Ursache in der Meldung (Medium) | beheben | ✅ mit BUG-79 erledigt, gleiche Wurzel |
| **BUG-81 / BUG-82** Test-Lücken | **umgestuft und akzeptiert** | dokumentiert, siehe unten |
| **BUG-83 … BUG-86** (Low) | offen | unverändert |

### BUG-79 / BUG-80 — behoben

`mapPasswordResetRequestError` schluckt jetzt **jeden** Fehler; der 429-Zweig ist entfernt. Die Begründung samt der Umkehrung gegenüber AC-16/AC-19 steht in `design.md` → Nachtrag 2026-09-06.

**Live gegengeprüft:** Der im QA-Lauf gemessene Angriff nachgestellt — je 2 Anfragen für 5 **echte** und 5 **erfundene** Adressen, jede von einer eigenen Verbindung. **Alle zehn Paare antworten identisch.** Rot-Nachweis: Mit wieder eingebautem 429-Zweig fallen genau die zwei neuen Wächter in `error-mapping.test.ts`, alle übrigen bleiben grün.

**Vier Prüfungen:** Test **206/206** (vorher 205) · Lint 75 Dateien 0/0 · Build Exit 0 im echten Projektordner · E2E 33/33.

### ⚠️ Neu gemessen, noch in keinem Kriterium: ein Zeitkanal auf dem Reset-Pfad

Der **Melde**kanal ist zu, der **Zeit**kanal nicht. Direkt gegen `/auth/v1/recover` gemessen, je 12 frische Adressen:

| | Median |
|---|---|
| Konto vorhanden | **41 ms** |
| Adresse erfunden | **20 ms** |

Rund **20 ms, Faktor 2** — bestehende Konten sind langsamer, weil tatsächlich eine Mail gebaut wird. Dieselbe Klasse wie **EC-10** am Login, nur auf dem Reset-Pfad, und bisher nirgends im Vertrag.

**Ehrlich zur Messgrenze:** gemessen an der **Supabase-API**, nicht durch die Server Action hindurch. Die App legt auf beiden Wegen konstante Arbeit obendrauf, die absolute Differenz bleibt also — wie deutlich sie beim Angreifer ankommt, ist **nicht** gemessen. Gehört in den nächsten QA-Lauf, und die Bewertung anschließend in den Vertrag.

### BUG-81 / BUG-82 — bewusst akzeptiert, mit benannter Rest-Lücke

Auf Entscheidung des Nutzers vom 2026-09-06 nicht behoben. Begründung: Der Drosselungsmechanismus selbst ist gegen echte Angriffe verifiziert (BUG-29, BUG-39, BUG-54 und drei QA-Läufe) und hält; was fehlt, ist Regressionsschutz an einigen Aufrufstellen, kein aktiver Funktionsfehler.

**Das trägt für M27 und M13** — beide werden von der E2E-Suite gefangen, nur langsamer.

**Für drei Mutationen gibt es jedoch gar keinen automatischen Wächter:** **M31** (falsche Adresse an `settleSuccessfulLogin` → Konto-Zähler wird nie geleert), **M12** (`registerAction` zählt ohne E-Mail → Konto-Hälfte der Registrierungs-Drosselung tot) und **M14** (`updatePasswordAction` prüft die Recovery-Sitzung nicht mehr → **AC-12 gebrochen**, eine Sicherheitszusage). Dort ruht die Zusage allein auf Messungen, die einmal von Hand gemacht wurden.

Die vollständige Aufteilung je Mutation, die Ursache im Testcode und der Vorschlag, wo man beim Schließen anfängt, stehen in `design.md`.

---

## QA-Lauf — 2026-09-06 (final), nach dem BUG-79-Fix

**Anlass:** Gegenprüfung des BUG-79/BUG-80-Fixes, der neu bewerteten EC-9 und der neuen EC-11 — und die Zahl, die dem Vertrag fehlte: der Zeitkanal **durch die Server Action** statt an der Supabase-API.

**Tester:** drei `qa-engineer`-Sub-Agenten mit disjunktem Scope und sauberem Kontext. Beide Prüf-Lanes haben die Server Actions über das Flight-Protokoll angesprochen, mit frischer Verbindung je Messung.

### Ergebnis in einem Satz

**Der Meldekanal ist geschlossen — die Antwort nicht.** BUG-79 lebt über den `Set-Cookie`-Header weiter, deterministisch und doppelt so schnell wie vorher. Zusätzlich ist die am Vortag neu geschriebene Begründung von EC-9 **zum zweiten Mal** durch Messung widerlegt, und die Zahl der ungeschützten Mutationen ist von 5 auf 12 gestiegen.

### Acceptance Criteria

**Alle 19 geprüft, alle bestanden** — AC-1 bis AC-8, AC-10 bis AC-20. Hervorzuheben:

- **AC-10 und EC-3 — auf dem Meldekanal repariert.** 12 echte gegen 12 erfundene Adressen, je **zwei** aufeinanderfolgende Anfragen von derselben Verbindung (genau die Bedingung des alten Befunds): **24 von 24 Paaren vollständig identisch** — Status 200, 9923 Byte, gleicher Text. Der Fix trägt, soweit er reicht
- **AC-20 — erneut entscheidend belegt:** 10 Dummy-Einlösungen, dann der **echte** Token als 11. → abgewiesen ohne Sitzung; derselbe Token von frischer Verbindung → eingelöst. Der Token war unverbraucht, die Drosselung war der Grund
- **AC-16, AC-17, AC-19** — mit den Vertragszahlen bestätigt, und **AC-19 auch mit einer frei erfundenen Adresse** (Zähler zählt Adressen ohne Konto identisch)
- **EC-1** — echter Wettlauf mit 8 gleichzeitigen Registrierungen in drei Schreibweisen: 1 Gewinner, 7 Feldfehler, genau 1 Profil
- **AC-12** — Passwort setzen **ohne** Sitzung wird korrekt abgewiesen. Der verwandte Schwachpunkt betrifft eine *vorhandene* Sitzung und ist BUG-17, siehe unten

### Edge Cases

**EC-1 bis EC-8, EC-10 bestanden. EC-6 teilweise** (echter Ausfall nicht provozierbar, ohne die Parallel-Lanes zu treffen). **EC-9 und EC-11 mit Abweichungen** — siehe Befunde.

### Die Zahl, die dem Vertrag fehlte: EC-11 durch die Server Action

Beide Lanes haben unabhängig gemessen, mit frischer Adresse und frischer Verbindung je Messung:

| Messebene | Konto vorhanden | erfunden | Δ | Quelle |
|---|---|---|---|---|
| **Server Action** (Lane 2, 3 Serien à 80) | 124,8 ms | 84,4 ms | **+40,3 ms** | AUC 0,998 |
| **Server Action** (Lane 1, 12+12) | 154,0 ms | 99,4 ms | **+54,6 ms** | Faktor 1,55 |
| Supabase-API (Lane 2) | 37,8 ms | 9,6 ms | +28,1 ms | Faktor 3,9 |
| Supabase-API (Lane 1) | 40,9 ms | 11,0 ms | +29,9 ms | Faktor 3,7 |

**Die entscheidende Antwort: der Kanal ist durch die App hindurch praktisch nutzbar.** Out-of-sample mit festem Schwellwert aus einer anderen Serie: **97,5 % Trefferquote bei einer einzigen Anfrage je Adresse.** Unter Maschinenlast und mit realistischer gleitender Eichung 85 % je Einzelmessung; **3 Messungen** drücken den Irrtum unter 7 %, **5** unter 3 %.

Der Grund ist einfach: Die konstante Zusatzarbeit der App verschiebt **beide** Fälle gleich und bringt eine Eigenstreuung von sd ≈ 9 ms mit — das Signal von ~40 ms ist ein Vielfaches davon.

**Damit ist die Open Question aus `spec.md` beantwortet, und die Antwort fällt zuungunsten aus.** Die Vorhersage dort („die absolute Differenz bleibt, aber der relative Abstand schrumpft") trifft nur zur Hälfte: Der relative Abstand schrumpft (3,9 → 1,5), die **absolute Differenz ist durch die Action größer** als an der API.

### Bugs

#### BUG-87: BUG-79 ist nicht geschlossen — nur der Body ist es
**Severity: High** · betrifft **AC-10**, **EC-3** und die tragende Begründung von **EC-9**

Der Meldungstext ist vereinheitlicht, Status und Antwortlänge auch. **Der `Set-Cookie`-Header verrät die Kontoexistenz weiter.**

Liefert Supabase den 429 (was nur passiert, wenn tatsächlich eine Mail hinausginge, also nur bei existierendem Konto), löscht `@supabase/ssr` die PKCE-`code-verifier`-Cookies. Dieser Schreibvorgang läuft über den Cookie-Adapter in `src/lib/supabase/server.ts:21-25` in **dieselbe Antwort**, deren Body neutralisiert wurde:

```
echtes Konto, 2. Anfrage:  Set-Cookie: sb-…-code-verifier=          (Max-Age=0, gelöscht)
erfundene Adresse:         Set-Cookie: sb-…-code-verifier=base64-…  (mit Wert)
```

**Blind gemessen: 30 von 30 Adressen korrekt, 4,13 Adressen/Sekunde** — doppelt so schnell wie das ursprüngliche Orakel (dort ~2/s). Kein Konto, keine Sitzung, kein Browser nötig; der Endpunkt ist öffentlich.

**Der Mechanismus ist festgenagelt, nicht nur korreliert:** Dieselbe echte Adresse mit 1,5 s Pause — also nach Ablauf von `max_frequency = 1s` — ergibt **0 gelöschte Cookies** und ist von einer erfundenen Adresse ununterscheidbar. Der Diskriminator ist exakt der 429, den der Fix zu schlucken glaubte.

**Gehostet wird es leichter, nicht schwerer:** `max_frequency` steht lokal auf 1 s, Supabases Standard ist **60 s** — das Zeitfenster für die zweite Anfrage ist 60× breiter.

**Was der Fix richtig gemacht hat und was er übersah:** Er hat die Zuordnungsfunktion korrigiert und mit zwei Wächtern abgesichert. Er hat „die Antwort" mit „dem Rückgabewert der Funktion" verwechselt. Die HTTP-Antwort entsteht aber aus mehr als diesem Wert — der Cookie-Adapter schreibt an derselben Stelle mit.

**Repro:** zwei Reset-Anfragen an dieselbe Adresse innerhalb von `max_frequency`; enthält die zweite Antwort ein `Set-Cookie` mit `Max-Age=0` auf `*-code-verifier`, existiert das Konto.

#### BUG-88: Die Begründung von EC-9 ist zum zweiten Mal durch Messung widerlegt
**Severity: Medium** · Vertragsdefekt, kein Codefehler

EC-9 stützt seine Low-Einstufung seit dem 2026-09-06 auf vier Aussagen. **Zwei davon stimmen nicht**, beide unabhängig von zwei Lanes belegt:

| Aussage im Vertrag | Messung |
|---|---|
| „Die Bestätigung einer Adresse ist nur noch **statistisch** möglich — kostet Messreihen statt zweier Anfragen" | **Falsch, dreifach.** (a) BUG-87 ist deterministisch, zwei Anfragen. (b) EC-11 genügt mit **einer** Anfrage bei 97,5 %. (c) Es gibt ein drittes, deterministisches Ein-Anfragen-Orakel über das **Registrierungsformular** — siehe unten |
| „Ausgerechnet **derselbe** Konto-Zähler begrenzt die Zahl der Proben je Adresse" | **Falsch.** Es sind getrennte Schlüssel: Aussperren über `login:account:` (20/15 min), Reset-Proben über `password-reset:account:` (5/Std). Gemessen: nach 9 Reset-Proben existiert `login:account:` **überhaupt nicht**, und danach gehen volle 20 Login-Fehlversuche durch. Das Messen kostet **null** vom Aussperr-Budget |

**Das dritte Orakel ist kein Bug, sondern der eigene Vertrag.** Eine Registrierung mit einem **bereits vergebenen Trainernamen** legt kein Konto an und antwortet eindeutig:

```
Adresse hat ein Konto  -> {"fieldErrors":{"email":"Diese E-Mail-Adresse ist bereits registriert."}}
Adresse hat keins      -> {"fieldErrors":{"trainerName":"Dieser Trainername ist bereits vergeben."}}
```

Das ist die ausdrückliche Produktentscheidung hinter **AC-3** (Decision Log, 2026-08-31) — und AC-3 ist zu Recht PASS. Der Befund ist, dass **EC-9 eine Begründung trägt, die der eigene Vertrag an anderer Stelle widerlegt**: 5 bestätigte Adressen pro Minute und Verbindung, ohne jede Nebenwirkung.

Die Aussagen (3) Ausheilen und (4) kein CAPTCHA sind bestätigt.

> **Das ist die zweite widerlegte EC-9-Begründung in zwei Tagen.** Die erste („man muss die Adresse kennen") fiel durch BUG-79, die zweite („nur noch statistisch") fällt jetzt durch drei unabhängige Wege. Der beschriebene **Sachverhalt** stimmt jedes Mal — es ist die Einordnung, die nicht hält. Wer EC-9 ein drittes Mal begründet, sollte zuerst festhalten, was tatsächlich gemessen ist, statt die Einstufung zu erhalten.

#### BUG-89: EC-11 unterschätzt den eigenen Kanal
**Severity: Low** · Vertragstext

EC-11 nennt „41 ms gegenüber 20 ms, ungefähr Faktor 2". Gemessen an derselben Ebene: **37,8 / 9,6 ms** und **40,9 / 11,0 ms** — der Erfunden-Wert ist halb so groß wie eingetragen, der Faktor **3,7 bis 3,9** statt 2. Der Kanal ist breiter als zugesagt, nicht schmaler. Dazu fehlt die jetzt gemessene Aussage, dass **eine** Anfrage für 97,5 % genügt; der Vertrag legt bislang „Messreihen" nahe.

#### BUG-90: `updatePasswordAction` ist die einzige Zugangsdaten-Action ohne Drosselung
**Severity: Medium** · betrifft **AC-18** und die Technical Requirements

Gemessen: **15 Aufrufe ohne Sitzung von einer Verbindung — 0 abgewiesen.** In `src/lib/auth/actions.ts:177-209` fehlt jeder `registerAttempt`-Aufruf; Login (`:47`), Registrierung (`:93`), Reset (`:138`) und `/auth/confirm` (seit AC-20) haben ihn.

Das widerspricht zwei Zusagen: `spec.md` → Technical Requirements („Die Drosselung der Zugangsdaten-Pfade sitzt **in den Server Actions selbst**") und **AC-18** (der nur greift, wo überhaupt gezählt wird). Sachlich derselbe Grund, aus dem AC-20 gebaut wurde: Jeder Aufruf löst ein `getUser()` gegen Supabase aus, dessen gemeinsames Kontingent an derselben Server-IP hängt (BUG-21).

#### Bestätigt, nicht neu

- **BUG-17** (Medium, High-nah) — `updatePasswordAction` akzeptiert **jede** Sitzung, nicht nur eine Recovery-Sitzung; ein Passwortwechsel ohne Kenntnis des alten ist möglich. Von Lane 2 unabhängig zur Laufzeit reproduziert (Login mit neuem Passwort erfolgreich, mit altem abgelehnt). **Seit dem 2026-09-04 dokumentiert und unverändert offen** — mit BUG-90 zusammen betrifft es dieselbe Action
- **BUG-61, BUG-12, BUG-18** — Deploy-Blocker, Zahlen bestätigt (20/20 Spraying, 30/30 Konten; keine Security-Header)
- **BUG-77** — `origin` ungeprüft in `redirectTo`, unverändert vorhanden
- **T18** — offene `[user]`-Aufgabe auf dem Reset-Pfad, von beiden Lanes als **High** nach Skill-Regel gemeldet; deploy-blockiert durch fehlenden SMTP

### Die akzeptierte Test-Lücke ist gewachsen: 5 → 12

Lane 3 hat **41 Mutationen** gefahren und die in `design.md` dokumentierte Liste gegengeprüft. **Alle fünf dokumentierten überleben unverändert — die Liste stimmt.** Aber sie ist unvollständig; **sieben weitere** überleben, und der Zuwachs liegt überwiegend auf dem zuletzt geänderten Pfad:

| Neu | Mutation | Wirkung |
|---|---|---|
| **N23 / N2** | Den BUG-79-Zweig in `actions.ts:174` wieder einbauen statt in der Zuordnungsfunktion | **Das Kontoexistenz-Orakel ist wieder offen, 206/206 grün.** Die zwei Wächter fangen die Mutation *in* der Funktion — dass die Action ihr Ergebnis unverändert zurückgibt, prüft niemand |
| **N3** | Reset zählt unter Scope `'login'` | **AC-17 und AC-19 zugleich tot** |
| **N24 / N25** | `registerAttempt(…, null)` auf Reset- bzw. Login-Pfad | Konto-Hälfte von AC-19 bzw. AC-16 tot. Die M12-Lücke betrifft **alle drei** Aufrufstellen |
| **N22 / N31** | `tokenConfirmPerIp` auf 1000 bzw. Fenster 1 s | **Die Zahlen von AC-20 sind nirgends festgeschrieben** |
| **N27** | `return data !== false` statt `=== true` | Fail-open-Variante **an AC-18 vorbei**, wenn die RPC `null` liefert |

**Das Muster, das Lane 3 herausarbeitet:** Was in `throttle.ts`, `error-mapping.ts`, `trainer-name.ts` und `proxy.ts` **entschieden** wird, ist dicht bewacht (24 von 41 Mutationen erkannt). Was in `actions.ts` **verdrahtet** wird — welcher Scope, welche Adresse, welches Ergebnis weitergereicht wird —, ist es nur punktuell.

> **N23 verdient besondere Beachtung:** Es ist dieselbe Fehlklasse wie BUG-75, auf Code, der eine Stunde alt ist, und es betrifft ausgerechnet den Fix für den schwersten Befund des Vortags.

### Regression und automatisierte Tests

| Prüfung | Ergebnis |
|---|---|
| **Test** | ✅ 19 Dateien, **206/206** |
| **Lint** | ✅ 75 Dateien, 0/0 — **Dateizahl in beide Richtungen abgeglichen**, kein blinder Fleck |
| **Build** | ✅ Exit 0 in einer Kopie; `diff -r` gegen den Projektbaum: identisch |
| **E2E** | ✅ **33/33** in drei Engines, nichts nachinstalliert |

**0 Regressionen an PROJ-2.** Schema ohne Drift (6 von 6 Migrationen), Funktions-Grants eng, RLS auf allen drei Tabellen, beide Trigger aktiv, alle Indizes vorhanden. **Aufräum-Mechanik als Gegenbeweis zum BUG-56-Zustand:** 2163 Zeilen, davon nur **6 älter als eine Stunde**.

**Zur Lint-Notiz aus `design.md`:** stimmt weiterhin und war **zu freundlich** — nicht nur fehlen TypeScript-Regeln, es fehlt auch `eslint:recommended`. Empirisch: unbenutzte Konstante **und** ein Typfehler laufen durch `eslint` (Exit 0), `tsc` meldet `TS2322`. **Das Typnetz dieses Projekts ist `next build`, nicht `npm run lint`.**

### Unit-Tests aus diesem Lauf

**Keine geschrieben.** Dieselbe Begründung wie in den beiden Vorläufen, und sie ist durch N23 eher bestätigt worden: Die Lücken sitzen an Code, den derselbe Kontext geschrieben hat, der sie schließen würde. Sie gehören in den `/build`-Durchgang, der BUG-87 behebt — und dort auf die **Verdrahtung**, nicht auf die Funktion.

### Not Verified In This Run

- [!] **Cross-Browser, responsive Darstellung (375/768/1440 px), DevTools** — kein Browser-Engine
- [!] **AC-13 „ohne dass die Seite neu lädt"**, **AC-14/AC-15 als sichtbare Darstellung** — Client-Verhalten bzw. Layout
- [!] **AC-18 und EC-6 zur Laufzeit** — hätten verlangt, Container anzuhalten oder den Service-Role-Schlüssel zu entziehen; beides hätte die zwei parallelen Lanes mitgerissen. Garantie im Code belegt (`throttle.ts:116`, `admin.ts:26-35`) plus Unit-Test
- [!] **AC-12 mit einem wirklich abgelaufenen Token** — hätte das Abwarten von `otp_expiry` verlangt; Ersatzbeleg über unbekannte und bereits verwendete Tokens
- [!] **E2E-Wirksamkeit für M27 und M13** — nicht als roter Lauf nachgemessen; ein Mutationslauf gegen den Browser hätte den Produktivbaum verändert oder `.env.local` in die Kopie verlangt. Per Code-Inspektion bestätigt
- [!] **Geheimnis-Suche im Produktions-Build** — durchsucht wurden die vom Dev-Server ausgelieferten Chunks (11 MB, 0 Treffer, Positivkontrolle schlägt an), kein `next build`-Ergebnis
- [!] **Set-Cookie-Orakel im gehosteten Projekt** — nur lokal gemessen (`max_frequency` 1 s); die Richtung der Verschiebung auf 60 s ist abgeleitet
- [!] **Rate Limiting auf gewöhnlichen Endpunkten** — nicht implementiert (100× `GET /login` → 100× 200). Für ein MVP optional, kein Pass
- [!] **BUG-61-Schließbedingung, Security-Header, T18 im gehosteten Projekt** — nur gegen die Live-URL bzw. das Dashboard prüfbar

### Verdikt

**NOT READY.** Kein Critical. **Ein High: BUG-87**, dazu das nach Skill-Regel als High geführte **T18** (deploy-blockiert) und der unverändert offene **BUG-17** (Medium, High-nah). Neu ferner 2 Medium (BUG-88, BUG-90) und 1 Low (BUG-89).

**Was dieser Lauf positiv festgestellt hat:** Alle 19 Acceptance Criteria bestehen. Der Fix hat den Meldekanal wirklich geschlossen (24/24 identisch). AC-20 wurde erneut entscheidend belegt, AC-19 auch gegen eine erfundene Adresse. Die Drosselung ist an allen geprüften Stellen unbeschädigt, RLS und Grants sind dicht, kein Geheimnis im ausgelieferten Code, 0 Regressionen. Die geforderte Zahl für EC-11 liegt jetzt vor.

**Was offen bleibt:** BUG-87 ist der schwerste Befund — ein bereits behobenes Orakel, das über einen zweiten Kanal derselben Antwort zurückkehrt, schneller als zuvor. BUG-88 zeigt, dass die Einordnung von EC-9 zum zweiten Mal an der Wirklichkeit vorbeigeht. Und die ungeschützte Verdrahtung in `actions.ts` hat sich von fünf auf zwölf Stellen ausgeweitet, darunter der Fix von vorhin.

`features/INDEX.md` bleibt bei **In Review**.

---

## QA-Nachlauf — 2026-09-06 (zweiter des Tages), Gegenprüfung des BUG-87-Fixes

**Getestet:** 2026-09-06 · **App URL:** http://localhost:3000 (`probe.baseUrl`, lokaler Dev-Server + lokaler Supabase-Stack)
**Auftrag:** BUG-87 **unabhängig** gegenprüfen — der Wächter dafür stammt vom selben Kontext, der den Fix gebaut hat, und genau daran sind die beiden Vorläufe gescheitert.

### Aufbau — warum dieses Ergebnis mehr trägt als die Vorläufe

Drei `qa-engineer`-Lanes in getrennten Kontexten, die den `/build`-Durchgang **nie gesehen haben**: (1) Abnahme, (2) Security-Red-Team, (3) Regression + Wächter-Tauglichkeit. Jede bekam nur den Feature-Ordner, die AC-/EC-Liste, ihren Schritt aus `SKILL.md`, `.ai-eng-kit` und die Adresse des laufenden Servers — keine Beschreibung des Fixes, keine Bauhistorie.

**Zusätzlich hat der Owner die entscheidende Mutation selbst gefahren**, statt sie sich berichten zu lassen. Das ist der Punkt, an dem die beiden Vorläufe nachgaben: Dort belegte der Wächter, dass eine *Funktion* richtig entscheidet, nicht dass die *Antwort* dicht ist.

### Das Kernergebnis: BUG-87 ist geschlossen — dreifach belegt

**(1) Lane 2, Blindtest über den ursprünglichen Vektor.** 12 echte + 12 erfundene Adressen, je 2 Anfragen innerhalb `max_frequency`, Fingerabdruck aus Status + vollem Rumpf + Content-Länge + **allen** `Set-Cookie`-Kopfzeilen + allen Header-Namen:

```
24 Sonden -> 1 einziger Fingerabdruck   (REAL=12, FAKE=12)
{"status":200,"len":161,"cookieCount":0,"cookies":[],...}
```

**(2) Lane 1, unabhängig und mit anderer Methode.** Status gleich, Rumpf **byte-identisch** (`cmp`), **kein einziger** `Set-Cookie` auf beiden Seiten, `diff` der Header-Namen leer — auch im Zwei-Anfragen-Fall.

**Beide mit Gegenkontrolle**, damit „identisch" nicht „kaputt" heißt: Mailpit trägt die Reset-Mail für die echten Adressen, für die erfundenen keine. Der Pfad tut also weiterhin, was er soll.

**(3) Der Owner hat den Fehler wieder eingebaut** — und zwar in der Klasse, die diesem Projekt zweimal die Wächter unterlaufen hat (N23): das Orakel **inline in `actions.ts`**, Rückgabewert vollkommen gleichförmig, Leck ausschließlich über die Cookies des regulären Clients.

| Prüfung mit eingebautem Orakel | Ergebnis |
| --- | --- |
| `npm test` | 🟢 **209/209 grün** — die Unit-Ebene ist für diese Klasse **blind** |
| `npx playwright test tests/PROJ-1-reset-response.spec.ts` | 🔴 **rot**, Zeile 106, mit der richtigen Diagnose |

```
Error: zweite Anfrage: Cookie-Kopfzeilen müssen gleich sein — hier hing BUG-87
-   "sb-127-auth-token-flow-<id>-code-verifier:gesetzt"
+   "sb-127-auth-token-flow-<id>-code-verifier:geloescht"
```

Nach Rücknahme der Mutation (`git checkout --`) wieder **2/2 grün**. **Rot mit Fehler, grün ohne — der Wächter ist echt.** Damit ist die Frage aus dem Auftrag beantwortet: Der Wächter belegt diesmal wirklich die Zusage und nicht sich selbst.

### Was diesen Fix von den beiden Vorläufen unterscheidet

Er normalisiert die **Antwort**, nicht einen Kanal. `requestPasswordResetIdentically` (`src/lib/auth/reset-response.ts:44-57`) ist der einzige Ausgang, und der Cookie-Kanal ist an der Quelle zu: `createResponseNeutralClient` (`src/lib/supabase/server.ts:25-44`) gibt `@supabase/ssr` ein leeres `setAll()`, sodass die PKCE-Löschung die Antwort nicht erreichen kann.

### Ergebnisse nach AC-ID / EC-ID

| ID | Ergebnis | Beleg |
| --- | --- | --- |
| **AC-10** | ✅ PASS | Lane 1 (byte-identisch, 0 Cookies) + Lane 2 (1 Fingerabdruck / 24 Sonden) + Owner-Mutation (rot/grün) + Mailpit-Gegenkontrolle |
| **EC-3** | ✅ PASS | dieselben drei Messungen |
| AC-1 … AC-6 | ✅ PASS | Lane 1, Flight-Protokoll gegen den laufenden Server |
| AC-7 | ✅ PASS | 40 Messungen, ausnahmslos „E-Mail-Adresse oder Passwort ist falsch." |
| AC-8 | ✅ PASS (Verhalten) | 1–5 durch, ab 6 abgewiesen; Erstattung belegt (4 Fehl → 1 Erfolg → 5. noch erlaubt). **IP-Vorbedingung unerfüllt**, siehe BUG-61 |
| AC-11, AC-12 | ✅ PASS | echter Mail-Link in leerem Cookie-Jar eingelöst; Zweiteinlösung → `?error=1` |
| AC-13 | ✅ PASS (serverseitig) | Client-Hälfte `[!]`, kein Browser |
| AC-14, AC-15 | ✅ PASS (Quelle) | Darstellung `[!]`, kein Browser |
| AC-16 | ✅ PASS | 20 Fehlversuche von 20 Verbindungen durch, 21. abgewiesen; Leerung nach Erfolg belegt |
| AC-17 | ✅ PASS | 3 durch, 4. abgewiesen; keine Erstattung |
| AC-18 | ✅ PASS (Code + Unit) | Laufzeit-Ausfall nicht provozierbar → `[!]` |
| AC-19 | ✅ PASS | **frei erfundene** Adresse: 5 durch, ab 6. abgewiesen — die tragende Behauptung „zählt auch Adressen ohne Konto" ist bestätigt |
| AC-20 | ✅ PASS | 10 Müll-Einlösungen, dann echter Token von derselben Verbindung abgewiesen, von frischer Verbindung angenommen |
| EC-1 | ✅ PASS | echtes Rennen gefahren, genau eine Profilzeile; Unique-Index `0001_profiles.sql:13` |
| EC-2, EC-5, EC-7, EC-8 | ✅ PASS | Lane 1; EC-8 exakt reproduziert (8/8 ohne Tippfehler, 4/8 mit) |
| EC-4 | ⚠️ Verhalten PASS, **Zahlen im Vertrag falsch** | BUG-95 |
| EC-6 | ⚠️ Serverseitig PASS, UI-Hälfte `[!]` | kein Browser |
| **EC-9** | ⚠️ **Verhalten PASS, Begründung widerlegt** | BUG-88, siehe unten |
| **EC-10** | ✅ PASS, **Kanal breiter als gedacht** | Median 136,2 vs. 78,7 ms, n=24/24, **überlappungsfrei**, 100 % bei *einer* Anfrage |
| **EC-11** | ✅ PASS (Kanal existiert), **Open Question beantwortet** | BUG-89 |

### Bugs

#### BUG-87 — **GESCHLOSSEN**
Siehe oben. Drei unabhängige Belege, davon einer eine vom Owner selbst gefahrene Mutation.

#### BUG-91: `updatePasswordAction` — Kontoübernahme aus jeder beliebigen Sitzung
**Severity: High** · betrifft **AC-18**, Technical Requirements · **fasst BUG-17 und BUG-90 zusammen**

`src/lib/auth/actions.ts:161-193` prüft nur `getUser()` — nicht, ob es eine **Recovery**-Sitzung ist — und ruft `registerAttempt` **überhaupt nicht** auf. `design.md` → Behaviors & Access sagt ausdrücklich „nur mit gültiger Recovery-Sitzung"; diese Zusage existiert im Code nicht.

Zur Laufzeit gefahren (Lane 2), mit gewöhnlicher Login-Sitzung:

```
updatePasswordAction mit NORMALER Sitzung -> kein Fehler | status 200
  Login mit ALTEM Passwort  -> "E-Mail-Adresse oder Passwort ist falsch."
  Login mit NEUEM Passwort  -> ERFOLG (Sitzung gesetzt)
12 Aufrufe von EINER IP    -> abgewiesen: 0
```

Wirkung: Wer eine bestehende Sitzung erreicht — geteiltes Gerät; die Sitzung läuft laut AC-5 und `AUTH_COOKIE_OPTIONS` mit `Max-Age=34560000` bis zum aktiven Logout — übernimmt das Konto endgültig **ohne Kenntnis des alten Passworts** und sperrt den Besitzer aus. Zugleich der einzige Zugangsdaten-Pfad ohne Zähler. **Seit dem 2026-09-04 als BUG-17 dokumentiert und unverändert offen**; die Höherstufung folgt aus dem erstmals gefahrenen Laufzeit-Nachweis der vollständigen Übernahme.

#### BUG-88: Die Begründung von EC-9 ist zum zweiten Mal widerlegt — **bestätigt, mit einer Korrektur**
**Severity: Medium** · Vertragsdefekt, kein Codefehler · von **beiden** Lanes unabhängig belegt

| Aussage in `spec.md` | Messung |
| --- | --- |
| „Bestätigung nur noch **statistisch** möglich — kostet Messreihen statt zweier Anfragen" | **Falsch.** **Eine** Anfrage je Adresse genügt. EC-11: Lane 1 Blindtest **20/20**, 97,9 % über n=48; Lane 2 Blindtest **30/30**, 9,93 Adressen/s. EC-10: 100 % über n=48, überlappungsfreie Verteilungen. Dazu ein **drittes**, deterministisches Ein-Anfragen-Orakel über die Registrierung: Lane 2 **30/30**, 6,72 Adressen/s, ohne Kontoanlage. Das ist **billiger** als die zwei Anfragen von BUG-79, nicht teurer |
| „Ausgerechnet **derselbe** Konto-Zähler begrenzt Proben **und** Aussperren" | **Halb falsch — hier korrigiert der Nachlauf auch BUG-88 selbst.** Für den **Reset**-Kanal falsch: Sondieren zählt auf `password-reset:account:` (5/Std), Aussperren auf `login:account:` (20/15 min) — getrennte Budgets. Für den **Login**-Kanal (EC-10) trifft die Aussage dagegen **zu**: derselbe Schlüssel. Der Vertrag ist also nicht schlicht falsch, sondern **unzulässig verallgemeinert** |

Laufzeit-Beleg für die Schlüsseltrennung (Lane 2, `public.auth_throttle` nach 3 Reset-Sonden + 3 Fehl-Logins):

```
 login:account:<adresse>          | 8
 password-reset:account:<adresse> | 6
 register:account:<adresse>       | 1
```

Und die Folge davon, ebenfalls gemessen: 6 Reset-Sonden bis zur Abweisung, **danach Login mit richtigem Passwort von frischer IP erfolgreich** — `login:account:` existierte zu dem Zeitpunkt gar nicht. Sondieren über den Reset kostet **null** vom Aussperr-Budget.

Die Aussagen (3) *Ausheilen* und (4) *kein CAPTCHA* sind bestätigt.

#### BUG-89: EC-11 unterschätzt den eigenen Kanal — **bestätigt und verschärft**
**Severity: Low → Medium** · Vertragstext

Die **Open Question** aus `spec.md` („Wie breit ist der Kanal **durch die Server Action**?") ist damit beantwortet, und zwar zuungunsten:

| Messung | Konto vorhanden | Adresse erfunden | Trefferquote bei **1** Anfrage |
| --- | --- | --- | --- |
| Lane 1, n=24/24 | Median **120,3 ms** | Median **71,1 ms** | 97,9 % · Blindtest **20/20** |
| Lane 2, n=25/25 | Median **117,2 ms** | Median **83,3 ms** | überlappungsfrei · Blindtest **30/30**, 9,93 Adr./s |

Die absolute Differenz **wächst** durch die Server Action (≈20 ms an der API → ≈49 ms), der relative Abstand schrumpft (Faktor 2,0 → 1,7). Der Vertragssatz „sagt nur, dass der Kanal existiert, nicht wie breit er ist" ist überholt: Der Kanal ist **mit einer einzigen Anfrage je Adresse** nutzbar.

#### BUG-92: Der E2E-Wächter des Reset-Pfades kann **leer grün** werden
**Severity: Medium** · Test-Konstruktion · von Lane 3 **vorgeführt**, nicht vermutet

`tests/PROJ-1-reset-response.spec.ts:35` hat **keine positive Kontrolle in sich**: Er vergleicht nur echt gegen erfunden und behauptet nirgends, dass die Antwort die *Bestätigung* ist. Antwortet die App-eigene Drosselung **vor** dem bewachten Code, sind alle vier Sonden byte-gleich und alle Cookie-Listen leer — alle drei Vergleiche bestehen, obwohl `actions.ts:143-158` nie lief:

```
alle 4 Sonden identisch, Rumpf = {"error":"Zu viele Versuche von dieser Verbindung. ..."}
Anfrage 1/2: status gleich=true  rumpf gleich=true  cookies gleich=true
Bestaetigungstext im Rumpf? false
```

Mit **eingebautem Orakel** und einem Host, der `x-forwarded-for` überschreibt — also der **geforderten Schließbedingung von BUG-61**, dem gewünschten Deploy-Zustand, in dem die synthetischen Adressen aus `tests/fixtures.ts:59-75` auf **einen** Zählerschlüssel kollabieren:

```
--- Orakel M5b eingebaut ---
  ok  Die Reset-Antwort ist ... identisch (AC-10, EC-3)   <- GRÜN MIT LECK
  x   Der Reset funktioniert weiterhin ... (AC-10)
```

Der eigentliche Wächter war grün; rot wurde nur der Begleittest — **mit einer Meldung, die auf ein fehlendes Bestätigungs-Element zeigt, nicht auf ein Leck.** Wer den Begleittest entfernt, umbaut oder überspringt, verliert die Leck-Erkennung, ohne dass etwas rot wird. Dazu hängt der Test am lokalen `max_frequency`-Fenster (1 s; gemessene Sondenabstände 178–381 ms, Marge ≈ 4×) und kippt unter Last **still ins Vakuum statt ins Rot**. Die Klasse hat in zwei Tagen zwei High-Bugs erzeugt.

#### BUG-93: AC-17 und AC-19 haben auf der Verdrahtungsebene **keinen einzigen** Wächter
**Severity: Medium** · Test-Lücke, kein aktueller Produktdefekt

Drei Mutationen überleben `npm test` **und** `npx playwright test` (Lane 3, in quellgleicher Kopie gefahren):

| ID | Mutation | Wirkung |
| --- | --- | --- |
| M1 | `actions.ts:138` · `registerAttempt('password-reset', email)` → `(..., null)` | Konto-Hälfte von **AC-19** tot |
| M2 | `actions.ts:138` · Scope `'password-reset'` → `'login'` | **AC-17 und AC-19 zugleich** auf Login-Grenzwerte umgestellt |
| **M3** | `actions.ts:138-141 + :158` · Zähl-Block **hinter** den Versand verschieben | **neu.** Der Zähler zählt weiter, verhindert den Versand aber nicht mehr — genau die Sache, die AC-17/AC-19 begrenzen („Begrenzt ist der Versand selbst") |

`actions.test.ts` prüft nie die **Argumente** von `registerAttempt`, `throttle.test.ts` ruft die Funktion direkt mit dem richtigen Scope auf, und ein E2E-Test für die Reset-Drosselung existiert nicht. M1/M2 entsprechen N24/N3 aus dem Vorlauf und sind damit **zum zweiten Mal offen**.

#### BUG-94: `npm test` allein deckt die N23-Klasse auf dem Reset-Pfad nicht ab
**Severity: Medium** · Prozess/Test-Lücke

Vom Owner selbst gemessen: mit vollständig wiederhergestelltem Kontoexistenz-Orakel **209/209 grün**. `actions.test.ts` erreicht `actions.ts:143-158` in **keinem** Test — die einzige Reset-Zusicherung dort mockt `registerAttempt` auf `allowed: false` und kehrt vorher um. **Wer vor einem Commit nur `npm test` fährt, sieht BUG-87 nicht wiederkommen.**

#### BUG-95: EC-4 nennt für den Reset-Pfad die falschen Ausheilzeiten
**Severity: Low** · Vertragstext

`spec.md` sagt „60 Sekunden bei der Verbindung, 15 Minuten beim Konto". Für den Reset gilt **300 s** (`passwordResetPerIp`, `throttle.ts:26`) und **3600 s** (`passwordResetPerAccount`, `:61`). Gemessen: nach 4 Reset-Anfragen war die Verbindung nach 60 s **noch** gesperrt, erst nach ~5 min frei. EC-4 ist generisch formuliert, nennt aber nur die Login-Zahlen.

#### BUG-96: AC-8 formuliert die Erstattung so, als gälte sie auch für die Registrierung
**Severity: Low** · Vertragswiderspruch zwischen AC-8 und AC-17

Gemessen: **5 erfolgreiche Registrierungen** von einer Verbindung, die 6. abgewiesen — bei der Registrierung zählt auch der Erfolg. So gewollt (AC-17, BUG-47), aber AC-8 allein gelesen sagt das Gegenteil.

#### BUG-97: „Stattdessen einloggen" erscheint bei **jedem** E-Mail-Feldfehler
**Severity: Low** · `src/components/auth/register-view.tsx:105`

Geprüft wird nur `form.formState.errors.email`. Wer sich bei der Adresse **vertippt**, bekommt den Vorschlag, sich stattdessen einzuloggen — in ein Konto, das es nicht gibt. AC-3 verlangt den Link nur für den Duplikat-Fall. Nur an der Quelle geprüft.

#### BUG-98: Trainername wird vor der Prüfung getrimmt, EC-5 sagt „Leerzeichen ⇒ abgelehnt"
**Severity: Low** · `src/lib/validation/auth.ts:4-7`

`"  QaTrim_1788716000  "` wird angenommen und als `QaTrim_1788716000` gespeichert. Innenliegende Leerzeichen werden korrekt abgelehnt. Fachlich vermutlich gewollt, steht so aber nicht im Vertrag.

#### BUG-99: `auth_throttle.key` wird ungeprüft aus `x-forwarded-for` gebaut
**Severity: Low** · Speicher-/Kostenvektor · `src/lib/auth/throttle.ts:92-98`

Ein 4000 Zeichen langer Header erzeugt anstandslos eine Zeile mit 4000-Zeichen-Schlüssel. Die Tabelle ist damit von außen mit beliebig vielen, beliebig großen Zeilen befüllbar; aufgeräumt wird erst nach einer Stunde und nur verkehrsabhängig (`0005`). Hängt an derselben Wurzel wie BUG-61.

#### Bestätigt, unverändert offen
- **BUG-61** (Deploy-Blocker) — Passwort-Spraying **40 Versuche gegen 20 Konten, rotierender Header → 0 abgewiesen, 5,5 s**; Kontrolle von fester IP: **36 von 40 abgewiesen**. Der Zähler funktioniert, sein Schlüssel ist angreiferkontrolliert. Massenregistrierung **30 Konten in 9,5 s**
- **BUG-12** — keiner von `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS`, `CSP` gesetzt; kein `headers()`-Block in `next.config.ts`
- **BUG-18** — `X-Forwarded-Host` hebelt die Origin-Prüfung aus, erstmals auf einem **PROJ-1**-Credential-Pfad reproduziert (`Origin evil` → 500, `Origin evil + X-Forwarded-Host: evil` → 200)
- **BUG-77** — `origin` ungeprüft in `redirectTo` (`actions.ts:143-144`)
- **T18** — offene `[user]`-Aufgabe auf dem Reset-Pfad, von beiden Lanes nach Skill-Regel als **High** gemeldet; deploy-blockiert durch fehlenden SMTP

### Regression und automatisierte Tests

| Prüfung | Ergebnis |
| --- | --- |
| **Test** | ✅ 20 Dateien, **209/209**, Exit 0 |
| **Lint** | ✅ 0 Fehler, 0 Warnungen, Exit 0 |
| **Build** | ✅ Exit 0 — in quellgleicher Kopie gefahren, weil `next build` und der laufende `next dev` sich `.next` teilen |
| **E2E** | ✅ **39/39 in drei Engines, zwei vollständige Läufe** (53,2 s / 55,2 s), kein Flake, nichts nachinstalliert |

**0 Regressionen an PROJ-2.** RLS auf allen drei Tabellen **zur Laufzeit mit zwei echten Konten** geprüft: A liest B's `runs` → `[]`; A löscht B's Run → 204, Run **noch da**; A patcht B's Trainernamen → 200, Name **unverändert**. Funktions-Grants eng (anon 401, angemeldet 403), beide Trigger aktiv, alle Indizes vorhanden, **kein Schema-Drift** (6/6 Migrationen). Aufräum-Mechanik trägt: 1754 Zeilen, **0 älter als eine Stunde**.

### Unit-Tests aus diesem Lauf

**Keine geschrieben** — und diesmal mit einem konkreten Ziel statt einer Begründung: Die Lücke sitzt nicht in einer Funktion, sondern in der **Verdrahtung** (BUG-93, BUG-94). Ein sinnvoller Test prüft die **Argumente** von `registerAttempt` in `requestPasswordResetAction` und die **Reihenfolge** von Zählen und Versenden. Das gehört in den `/build`-Durchgang, der BUG-93 schließt, mit den drei Mutationen M1/M2/M3 als Abnahmekriterium.

### Security-Audit — Zusammenfassung

**Verifiziert: 9 Prüfungen** — Auth-Bypass (Redirects korrekt), Authorization (RLS zur Laufzeit, beide Richtungen), Input-Injection (XSS/SQLi/CRLF sämtlich an der Zod-Grenze abgewiesen, nichts erreicht die DB), Brute-Force auf Zugangsdaten (Zähler greifen, Grenzen wie zugesagt), Meldungsgleichheit beim Login, exponierte Geheimnisse (27 ausgelieferte Antworten + gebautes `.next/static`, **0 Treffer**, mit Positivkontrolle), sensible Daten in Antworten (keine Adresse, keine Tokens, keine UUIDs), Credentials in URLs (alle vier Formulare `method="post"`), Kontoexistenz über den Reset-Pfad (**geschlossen**).

**`[!] NOT VERIFIED: 8** — siehe unten. Die wichtigste davon ist die Schließbedingung von BUG-61, die eine echte Live-URL braucht; `deploy` in `.ai-eng-kit` steht auf `null`.

### Not Verified In This Run

- [!] **Cross-Browser jenseits der drei Playwright-Engines, responsive Darstellung (375/768/1440 px), DevTools** — kein Browser-Engine in `/qa`
- [!] **AC-13 „ohne dass die Seite neu lädt", AC-14/AC-15 als gerendertes Ergebnis, EC-6 UI-Hälfte** — Client-Verhalten bzw. Layout
- [!] **AC-18 zur Laufzeit** — der Zähler war ohne Eingriff in die laufende Datenbank nicht ausfallbar zu machen; Code (`throttle.ts:116`) und `throttle.test.ts:111` belegen die Richtung
- [!] **AC-8, IP-Vorbedingung** (Host setzt `x-forwarded-for` und verwirft Client-Werte) — nur gegen die echte Live-URL messbar, **BUG-61**
- [!] **AC-11 / AC-12 / EC-7 gegen das gehostete Projekt** (Site URL, Redirect URLs, Mail-Vorlage T18)
- [!] **Supabases eingebaute Rate-Limit-Ebene** — lokal nicht auslösbar
- [!] **`Secure`-Flag am Session-Cookie** — greift erst bei `NODE_ENV=production`
- [!] **Wirksamkeit des Reset-Wächters im gehosteten Projekt** — nur lokal gemessen (`max_frequency` 1 s statt 60 s); die Richtung der Verschiebung ist abgeleitet, nicht gemessen
- [!] **Visuelle Regressionen an gemeinsamen Komponenten** — kein Viewport, keine Screenshots

### Production-Ready-Entscheidung

**NOT READY.** Kein Critical. **Zwei High:** BUG-91 (Kontoübernahme über `updatePasswordAction`) und T18 nach Skill-Regel; dazu der unverändert offene Deploy-Blocker BUG-61. Ferner 5 Medium (BUG-88, BUG-89, BUG-92, BUG-93, BUG-94) und 5 Low (BUG-95 … BUG-99).

**Was dieser Lauf positiv festhält:** BUG-87 ist geschlossen, und zwar erstmals mit einem Wächter, dessen Rot-Zustand von einem Kontext nachgewiesen wurde, der den Fix nicht gebaut hat. Die Kette „Fix → eigener Wächter → nächster Lauf findet dasselbe Orakel wieder" ist damit unterbrochen.

**Was offen bleibt:** Der schwerste Befund ist nicht mehr das Orakel, sondern **BUG-91** — eine vollständige Kontoübernahme, seit dem 2026-09-04 als BUG-17 dokumentiert und dreimal überrollt worden. Und die Test-Lücke hat sich verlagert, nicht geschlossen: Sie sitzt jetzt sichtbar in der **Verdrahtung** der Reset-Drosselung (BUG-93) und in einem Wächter, der unter der gewünschten Deploy-Konfiguration leer grün werden kann (BUG-92).
