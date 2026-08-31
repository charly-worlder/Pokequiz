# PROJ-1: Benutzerkonto & Login

## Dependencies
- Keine

## User Stories
- Als deutschsprachiger Pokémon-Fan möchte ich mich mit E-Mail, Passwort und einem eindeutigen Trainernamen registrieren, damit ich sofort mitspielen und auf der Rangliste erscheinen kann.
- Als wiederkehrender Nutzer möchte ich mich mit E-Mail und Passwort einloggen, damit ich meine bisherigen Ergebnisse und meinen Platz auf der Rangliste behalte.
- Als Nutzer, der sein Passwort vergessen hat, möchte ich es per E-Mail-Link zurücksetzen können, damit ich nicht dauerhaft ausgesperrt bin.
- Als eingeloggter Nutzer möchte ich mich abmelden können, damit mein Konto auf einem geteilten Gerät nicht offen bleibt.
- Als Betreiber der öffentlichen Rangliste möchte ich, dass Logins gegen Brute-Force-Versuche geschützt sind, damit die Rangliste echte Ergebnisse zeigt.

## Out of Scope
- **Trainername ändern** — bewusst dauerhaft fix, siehe Decision Log. Kein Profilbereich im MVP.
- **E-Mail-Verifizierung / Bestätigungslink** — bewusst weggelassen, siehe Decision Log.
- **Login über Drittanbieter** (Google, Apple, etc.) — nur E-Mail/Passwort im MVP.
- **Konto-Löschung und Datenexport** — gehört zu PROJ-4 (Datenschutz & Kontolöschung).
- **Rollen oder Berechtigungsstufen** — alle angemeldeten Nutzer sind gleichberechtigt (siehe `docs/app-shell.md`).
- **Profilseite** über den Passwort-Reset hinaus.
- **CAPTCHA bei der Registrierung** — bewusst nicht im MVP, siehe Decision Log. Wird bei tatsächlich beobachtetem Missbrauch nachgerüstet, nicht präventiv gebaut.

## Acceptance Criteria

- [ ] **AC-1** — Angenommen ein Besucher ist ausgeloggt und öffnet `/login`, wenn er E-Mail, Passwort (mind. 8 Zeichen) und Trainername (3–20 Zeichen, nur Buchstaben/Zahlen/Unterstrich) ausfüllt und absendet, dann wird ein Konto samt Profil mit diesem Trainernamen angelegt und er ist sofort eingeloggt — ohne E-Mail-Bestätigung.
- [ ] **AC-2** — Angenommen ein Trainername ist (unabhängig von Groß-/Kleinschreibung) bereits vergeben, wenn sich jemand damit registrieren will, dann wird die Registrierung mit einer Fehlermeldung am Trainername-Feld abgelehnt.
- [ ] **AC-3** — Angenommen eine E-Mail-Adresse ist bereits registriert, wenn sich jemand erneut damit registrieren will, dann zeigt das Formular die Meldung „Diese E-Mail-Adresse ist bereits registriert" mit einem Link zum Login.
- [ ] **AC-4** — Angenommen ein Nutzer hat ein bestehendes Konto, wenn er auf `/login` E-Mail und Passwort korrekt eingibt und absendet, dann wird er eingeloggt und zur Startseite (`/`) weitergeleitet.
- [ ] **AC-5** — Angenommen ein Nutzer ist eingeloggt, wenn er den Browser schließt und später zurückkehrt, dann ist er weiterhin eingeloggt, bis er sich aktiv abmeldet.
- [ ] **AC-6** — Angenommen ein eingeloggter Nutzer, wenn er auf „Abmelden" klickt, dann wird die Sitzung beendet und er landet auf `/login`.
- [ ] **AC-7** — Angenommen ein Login-Versuch schlägt fehl (falsches Passwort oder unbekannte E-Mail-Adresse), wenn die Fehlermeldung angezeigt wird, dann ist sie in beiden Fällen identisch und verrät nicht, ob die E-Mail-Adresse existiert.
- [ ] **AC-8** — Angenommen es gab 30 Login- oder Registrierungsversuche von derselben IP-Adresse innerhalb von 5 Minuten, wenn ein weiterer Versuch erfolgt, dann wird er von Supabases eingebauter Rate-Limit-Regel abgelehnt.
- [ ] **AC-10** — Angenommen ein Nutzer hat sein Passwort vergessen, wenn er auf `/login` „Passwort vergessen?" wählt und seine E-Mail-Adresse eingibt, dann erhält er, falls ein Konto zu dieser Adresse existiert, einen Reset-Link per E-Mail; die angezeigte Meldung ist dieselbe unabhängig davon, ob die Adresse existiert.
- [ ] **AC-11** — Angenommen ein Nutzer öffnet einen gültigen Passwort-Reset-Link, wenn er ein neues Passwort (mind. 8 Zeichen) setzt und absendet, dann wird das Passwort geändert und er kann sich damit einloggen.
- [ ] **AC-12** — Angenommen ein Nutzer öffnet einen abgelaufenen oder bereits verwendeten Reset-Link, wenn er versucht ein neues Passwort zu setzen, dann wird eine Fehlermeldung angezeigt und er kann einen neuen Link anfordern.
- [ ] **AC-13** — Angenommen ein Nutzer lässt ein Pflichtfeld im Registrierungs- oder Login-Formular leer, wenn er absendet, dann wird für jedes fehlende Pflichtfeld eine Validierungsfehlermeldung angezeigt, ohne dass die Seite neu lädt.
- [ ] **AC-14** — Angenommen das Registrierungsformular wird angezeigt, wenn der Nutzer es ausfüllt, dann ist ein Link zur Datenschutzerklärung sichtbar, bevor er absendet.

## Edge Cases
- **EC-1** — Zwei Registrierungen mit demselben Trainernamen (unterschiedliche Groß-/Kleinschreibung) treffen gleichzeitig ein: Die zuerst verarbeitete gewinnt, die zweite bekommt die Fehlermeldung „Trainername bereits vergeben".
- **EC-2** — Ein ausgeloggter Nutzer ruft eine geschützte Route (z. B. `/`) direkt per URL auf: Er wird zu `/login` weitergeleitet.
- **EC-3** — Jemand fordert einen Passwort-Reset für eine nicht existierende E-Mail-Adresse an: Er sieht dieselbe „E-Mail wurde verschickt, falls ein Konto existiert"-Meldung wie bei einer existierenden Adresse.
- **EC-4** — Eine IP-Adresse hat das 5-Minuten-Limit für Login-/Registrierungsversuche erreicht und versucht es erneut, bevor das Fenster abgelaufen ist: Supabases eingebaute Rate-Limit-Regel lehnt den Versuch weiterhin ab.
- **EC-5** — Ein Trainername enthält nicht erlaubte Zeichen (z. B. Leerzeichen, Emoji) oder ist kürzer als 3 / länger als 20 Zeichen: Die Registrierung wird mit einer feldspezifischen Fehlermeldung abgelehnt.
- **EC-6** — Die Verbindung zu Supabase Auth schlägt beim Absenden fehl (Netzwerkfehler): Der Nutzer sieht eine Fehlermeldung mit einer „Erneut versuchen"-Möglichkeit, ohne bereits eingegebene Werte zu verlieren.

## Technical Requirements (optional)
- Auth-Formulare senden ausschließlich per POST, nie per GET (siehe `.claude/rules/security.md`)
- Passwörter werden ausschließlich gehasht gespeichert (Supabase-Auth-Standard), nie im Klartext
- Datenregion: eu-central-1 (Frankfurt), siehe `docs/PRD.md` → Rahmenbedingungen
- Die Login-/Registrierungs-Drosselung läuft ausschließlich über Supabases eingebaute Rate-Limit-Regel (serverseitig), nicht im UI

## Open Questions
- [ ] Braucht es einen Hinweis, der Minderjährige davon abhält, ihren echten Namen als Trainernamen zu verwenden? Die Kontoerstellung läuft über Vertrag (Art. 6(1)(b) DSGVO), nicht über Einwilligung — greift Art. 8 DSGVO hier überhaupt, oder ist die relevante Frage die Geschäftsfähigkeit nach BGB? (siehe `docs/privacy.md` → Für einen Anwalt)
- [ ] Hosting-Anbieter (Vercel/Hostinger) noch nicht entschieden — betrifft die Verarbeitung von Server-Logs, wird bei `/deploy` festgelegt
- [ ] AC-8 (Supabases eingebautes Rate-Limit) ließ sich lokal nicht auslösen — 150 Fehlversuche gegen die lokale Supabase-Instanz lösten kein 429 aus, vermutlich eine Lücke im lokalen Supabase-CLI-Stack (siehe design.md → Technical Decisions). Nach dem ersten `/deploy` gegen das gehostete Projekt erneut prüfen, bevor die App öffentlich geht
- [ ] AC-11/AC-12 (Passwort-Reset-Link): Die Lösung — Sitzung wird clientseitig aus dem URL-Fragment gelesen, keine Server-seitige Code-Exchange — hängt von der aktuellen lokalen `flow_type`-Konfiguration ab und muss nach dem ersten Cloud-Deploy erneut verifiziert werden, zusammen mit dem AC-8-Test. Außerdem müssen Site URL und Redirect URLs im gehosteten Supabase-Projekt auf die echte Domain gesetzt werden (siehe design.md → Settings the user makes) — sonst tritt derselbe Bug wie lokal erneut auf

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Formular registriert Trainername gemeinsam mit E-Mail/Passwort | Reduziert Reibung, passt zum Ziel „sofort loslegen" | 2026-08-31 |
| Keine E-Mail-Verifizierung vor dem ersten Spiel | Rundenstart soll ohne Zwischenschritt möglich sein; passt zum Erfolgskriterium „Runde startet in unter 3 Sekunden" | 2026-08-31 |
| Trainername: 3–20 Zeichen, Buchstaben/Zahlen/Unterstrich, Groß-/Kleinschreibung wird bei der Eindeutigkeit ignoriert | Verhindert Verwechslungen auf der Rangliste und unleserliche Namen | 2026-08-31 |
| Trainername ist nach der Registrierung dauerhaft fix | Vermeidet Verwirrung auf der Rangliste, kein zusätzlicher Profil-Scope im MVP | 2026-08-31 |
| Passwort-Mindestlänge 8 Zeichen, keine erzwungene Zeichen-Vielfalt | Aktuelle Empfehlung (NIST/OWASP), weniger Reibung als klassische Komplexitätsregeln | 2026-08-31 |
| Passwort-Reset gehört zum MVP-Umfang | Ohne Self-Service-Reset sperren sich Nutzer dauerhaft aus | 2026-08-31 |
| Session bleibt bis aktivem Logout bestehen (kein Ablauf nach Inaktivität) | Passt zu einem Spiel, das man wiederholt kurz öffnet | 2026-08-31 |
| Login-/Registrierungs-Drosselung: Supabases eingebaute IP-Regel (Standardwert 30 Versuche / 5 Minuten), keine eigene kontobezogene Drosselung | Dieselbe reaktive Logik wie beim CAPTCHA-Verzicht: bewusst kein Sicherheits-Feature vorab bauen, das erst bei tatsächlichem Missbrauch gebraucht wird; eine eigene Drosselung kann jederzeit nachgerüstet werden | 2026-08-31 |
| Kein CAPTCHA bei der Registrierung im MVP; AC-9 (ursprünglich: CAPTCHA gegen automatisierte Registrierung) dafür gestrichen | Bewusste produkttypische Entscheidung: reaktiv nachrüsten, wenn tatsächlich Missbrauch auftritt, statt präventiv zu bauen — unabhängig von der geringen erwarteten Nutzerzahl | 2026-08-31 |
| Kein Leaked-Password-Schutz (HaveIBeenPwned) im MVP | Dieselbe reaktive Logik wie beim CAPTCHA-Verzicht; zusätzlich ein Supabase-Paid-Plan-Feature | 2026-08-31 |
| Bei Duplikat-E-Mail wird offen mitgeteilt, dass das Konto existiert (statt neutraler Meldung) | Anders als beim Login wird hier kein Passwort erraten; der Nutzer muss erfahren, dass er einloggen statt erneut registrieren soll | 2026-08-31 |
| Anmeldung und Registrierung teilen sich die Route `/login` mit einem Umschalter | Passt zur App-Shell-Karte, die genau eine Route „Anmeldung" vorsieht | 2026-08-31 |
