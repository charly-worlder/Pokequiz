# QA Test Results — Lauf 2

**Getestet:** 2026-09-09 (Lauf 2; Lauf 1 am selben Tag, siehe „Was Lauf 1 fand")
**App-URL:** `http://localhost:3000` (lokaler Dev-Server, einmal vom Owner gestartet)
**Tester:** QA Engineer (KI) — drei unabhängige `qa-engineer`-Bahnen mit getrennten Bereichen, zusammengeführt von einem Owner

> Legende: `[x]` in diesem Lauf belegt (Beleg zwingend) · `[ ] BUG` als gebrochen belegt · `[!] NICHT GEPRÜFT` in diesem Lauf nicht prüfbar (Grund zwingend)

## Der Anlass und das Ergebnis in drei Sätzen

Lauf 1 fand **einen High** (BUG-4-1: die E-Mail-Adresse überlebte die Löschung in `auth.audit_log_entries`). Er wurde behoben; Lauf 2 hat die Behebung **nicht bestätigt, sondern angegriffen** — und sie hält im Kern: ein vollständiger Suchlauf über *alle* Schemata nach der Löschung findet **null Treffer** auf Adresse und Trainername, und die Wirksamkeit ist per Mutation belegt (Funktion auf No-Op → dieselbe Löschung hinterlässt wieder 5 Adresszeilen).

**Kein Critical, kein High.** Dafür elf Medium und fünfzehn Low — darunter **zwei Reste, die AC-17 und AC-22 weiterhin im Wortlaut brechen**, und **zwei Löcher im Testnetz, die genau die Kernzusage dieses Features nicht schützen**.

---

## Korrektur an Lauf 1

**Eine Beweisangabe aus dem ersten Bericht war falsch.** Dort stand, die Mutation „Grenzwert 5 → 19" mache `tests/PROJ-4-delete-throttle.spec.ts` rot, der Grenzwert sei also gepinnt. In Lauf 1 wurden dabei **beide** Hälften gleichzeitig verändert. Einzeln gemessen (Lauf 2, vom Owner nachgeprüft):

| Mutation | Ergebnis |
|---|---|
| nur `accountDeletePerAccount` 5 → 19 | **grün** |
| nur `accountDeletePerIp` 5 → 19 | **grün** |
| beide 5 → 19 | rot |

Der Test feuert von **einer** Verbindung gegen **ein** Konto — welche Hälfte auch immer noch bei 5 steht, sperrt bei Versuch 6. Der Vertragswert aus AC-15 ist damit **nicht einzeln gepinnt** (BUG-4-19).

---

## Acceptance Criteria

**17 von 22 vollständig bestanden.** Belege je Kriterium; die fünf Brüche stehen darunter.

| AC | Ergebnis | Beleg |
|---|---|---|
| **AC-1** | [x] | Ein Chip-Link `header a[href="/account"]`, `aria-label="Dein Konto — <Name>"`; Kopfzeile trägt weiterhin genau vier Elemente |
| **AC-2** | [x] | Gemessen: E-Mail, Trainername, „Dabei seit 09.09.2026", „Runden gespielt 3" (inkl. Nullrunde), „Bester Lauf Serie 7 · 01:35,0" bei gesetzten Runden 7/107,3 s · 0/1,2 s · 7/95,0 s |
| **AC-3** | [x] | `main form` 0, `main input\|textarea\|select` 0 |
| **AC-4** | [x] | `curl -i /account` ohne Cookie → 307 `/login`; Pfadvarianten (`/account/`, `//account`, `/Account`, `/account.json`, `/account%2f`, `/account/../account`, RSC-Variante) allesamt 307/308, **kein 200** |
| **AC-5** | [x] | Genau ein `main`, eine Shell-Kopfzeile, eine Fußzeile, Zweitnavigation 0 |
| **AC-6** | [x] | Frisches Konto: „Runden gespielt 0", „Noch keine gewertete Runde" |
| **AC-7** | [x] | Bei 320 px `scrollWidth = clientWidth = 320`, E-Mail-Kasten x=43…277 (Chromium) |
| **AC-8** | [x] inhaltlich · [!] optisch | Alle vier Folgen zur Laufzeit vor jeder Interaktion belegt. Die *optische* Absetzung nur als Klassen (`danger-zone-card.tsx:15-17`) — kein Auge im Lauf |
| **AC-9** | [x] | Leeres Feld → **0 POST-Anfragen**, Dialog bleibt, Konto unverändert. Serverseitig zusätzlich: Feld fehlt / zweimal gesetzt mit leerem ersten Wert → je abgewiesen |
| **AC-10** | [x] | Vorher `auth 1 / profiles 1 / runs 3 / active_runs 1 / Konto-Zähler 1` → nachher **0/0/0/0/0** |
| **AC-11** | [x] | „Das Passwort ist falsch.", Dialog offen, Konto in der DB unverändert |
| **AC-12** | [x] | `/login?geloescht=1` mit Banner; ohne Merker kein Banner |
| **AC-13** | [x] | Neuregistrierung mit **derselben** Adresse und **demselben** Trainernamen erfolgreich, neue Kennung ≠ alte |
| **AC-14** | [ ] **BUG-4-3** | Abbrechen und Escape schließen folgenlos; **Klick daneben nicht** — `mouse.click(5,5)` → `alertdialog`-Anzahl bleibt 1 |
| **AC-15** | [x] Zahl · [ ] **BUG-4-2** Meldung | Zahl von zwei Bahnen unabhängig belegt: Konto-Hälfte 1–5 durch, **6 und 7 abgewiesen**; Verbindungs-Hälfte mit sechs *verschiedenen* Konten von fester IP: 1–5 durch, **6 abgewiesen**. Sperre schützt wirklich: mit gesperrtem Zähler und **richtigem** Passwort abgewiesen, Konto blieb. Die Meldung nennt keine Minuten |
| **AC-16** | [x] | Als Nutzer A mit **richtigem eigenem Passwort** und der Kennung von B in **zehn Feldern** plus zwei Positionsargumenten **und manipuliertem prevState** → gelöscht wurde **A**, B samt Runden unversehrt. Datenebene: `DELETE`/`PATCH` auf fremde und eigene Zeilen je **403** (Tabellenrecht) |
| **AC-17** | [ ] **BUG-4-17** | Hauptbefund behoben (siehe unten). **Weiterhin gebrochen im Wortlaut:** `auth.flow_state` behält eine Zeile mit der Kennung des gelöschten Kontos |
| **AC-18** | [x] | Spieler war Platz 2, nach der Löschung weg, Plätze 1–5 lückenlos, kein Fehler |
| **AC-19** | [ ] **BUG-4-6** | Der Satz „Das ist alles, was wir über dich gespeichert haben." stimmt nicht — und breiter als in Lauf 1 berichtet |
| **AC-20** | [x] | Dialogtext zur Laufzeit gemessen, benennt alle vier Folgen und die Unwiderruflichkeit |
| **AC-21** | [x] | Nach der Löschung `/`, `/account`, `/leaderboard` je → `/login`. Das rohe JWT war noch **3.573 s (≈ 59 min)** gültig: gegen GoTrue `/auth/v1/user` → **403 `user_not_found`**, `/logout` → 403, `refresh` → 400; gegen PostgREST → `200 []` |
| **AC-22** | [ ] **BUG-4-16** | In der Datenbank sauber (Suchlauf über alle Schemata: 0 Treffer). **Weiterhin gebrochen im Wortlaut:** das Log des Auth-Dienstes führt jede Protokollzeile ein zweites Mal als JSON, inklusive `user_deleted` mit der Adresse |

---

## Edge Cases

**11 von 12 bestanden**, EC-9 nicht prüfbar.

| EC | Ergebnis | Beleg |
|---|---|---|
| **EC-1** | [x] | Zweiter Tab landet folgenlos auf `/login`, keine Fehlermeldung. Garantie im Code bestätigt: kein Idempotenz-Schlüssel nötig, weil ohne Sitzung umgeleitet wird; Doppelklick zusätzlich durch `disabled={pending}` |
| **EC-2** | [x] | `active_runs 1 → 0`, anderer Tab → `/login` ohne Absturz |
| **EC-3** | [x] | Mit werfendem Trigger: technische Meldung, `users 1 / profiles 1 / runs 1` unverändert, **beide Zähler auf 0 erstattet**. **Gegenprobe:** mit falschem Passwort **keine** Erstattung — der Zweig ist kein Angriffsweg |
| **EC-4** | [x] | Cookies bei offenem Dialog gelöscht → `/login`, Konto unversehrt |
| **EC-5** | [x] | Zweiter Spieler, Neuladen: keine Lücke, kein Fehler |
| **EC-6** | [x] | Neues Konto: 0 Runden, „Noch keine gewertete Runde" |
| **EC-7** | [x] | Fenster auf `now()-16min` → nächster Versuch erreicht wieder die Passwortprüfung, Zähler startet bei 1 |
| **EC-8** | [x] | Browser 120 ms nach dem Absenden geschlossen: Endzustand eindeutig, kein Teilzustand |
| **EC-9** | [!] NICHT GEPRÜFT | Keine Backup-Infrastruktur lokal; die Frist ist laut Vertrag selbst offen. Bewusst getragen |
| **EC-10** | [x] | Trainername sofort wieder vergebbar, keine Meldung an irgendwen |
| **EC-11** | [x] | `/account` während laufender Runde: kein Rundenhinweis, keine Wiederherstellung |
| **EC-12** | [x] vertragsgemäß | Kein Download, keine Export-Aktion in Quelltext und Markup — **kein Befund**, wie EC-12 es vorsieht |

---

## BUG-4-1 — behoben, und wie das belegt ist

Nicht durch Lesen des Codes, sondern durch drei voneinander unabhängige Messungen:

1. **Wirksamkeit per Mutation.** `forget_audit_log_for_user()` auf No-Op gesetzt → derselbe Löschdurchlauf über die Oberfläche hinterlässt **5 Protokollzeilen mit der Adresse**, darunter `{"action":"user_deleted",…"user_email":"…"}`. Zurückgedreht → 0.
2. **Suchlauf über alle Schemata.** Eine eigens gebaute Sonde durchsucht **jede Spalte jedes Schemas** (`public`, `auth`, `storage`, `realtime`, `cron`, `vault`, auch `uuid`-Spalten) nach Adresse und Trainername: **null Treffer**.
3. **Sechs Umgehungsversuche, alle gescheitert:** Groß-/Kleinschreibung (`RT4Mix@Example.COM`), Adresse als Teilzeichenkette einer fremden (`rt4sub@` ⊂ `xrt4sub@` — Nachbarkonto blieb **unversehrt**), Recovery-Token in `one_time_tokens` (kaskadiert weg), Löschung per direktem `delete from auth.users` (Trigger feuert), Löschung über einen fremden Pfad, Nachstoßen mit veralteten Token (erzeugt keine neue Zeile).

**Auch die Gegenrichtung geprüft — löscht der Fix zu viel?** Die Protokollzeilen des Nachbarkontos blieben unangetastet. Von sechs geseedeten Zeilen traf der Trigger genau eine fremde, und die trug die Adresse des Löschenden — also genau das, wovon AC-22 spricht. **Kein Befund.**

---

## Security Audit

- [x] **Authentifizierung** — kein 200 auf `/account` ohne Sitzung, über acht Pfadvarianten und die RSC-Variante geprüft
- [x] **Autorisierung** — AC-16 oben; zusätzlich Datenebene mit gültiger Sitzung: `profiles` genau eine Zeile, `runs` `[]`, `active_runs` `42501 permission denied`
- [x] **Brute Force** — beide Hälften ausgelöst, Zahlen oben. Kein Erstatten vor der Passwortprüfung: über 7 Fehlversuche stieg der Zähler monoton 1→7
- [x] **Zähler nicht manipulierbar** — `DELETE`/`PATCH` auf `/rest/v1/auth_throttle` → `204`, Wert **unverändert**; `POST` → 403 RLS; alle RPCs → 403 bzw. 401
- [x] **Einschleusung** — Passwortfeld mit fünf Nutzlasten (`' or 1=1--`, `"><script>`, `%' or key like '%`, `${jndi:ldap://x}`, `'; drop table …`) → je die erwartete Meldung, `auth_throttle` unverändert. Gezielt gegen den `right()`-Vergleich aus `0017`: Registrierung mit `x:account:<adresse>` → **beide** Schichten weisen ab (GoTrue 400, Zod). Reflektiertes XSS und Open-Redirect: keine
- [x] **Keine Geheimnisse im Client** — Service-Role-Wert **null**mal in `.next/static`, `.next/dev/static`, `public/` und im `/account`-HTML; kein `"role":"service_role"` in ausgelieferten Dateien
- [x] **Keine sensiblen Felder in Antworten** — `/account`-HTML (29.474 Byte): Konto-UUID 0, JWT 0, `$2a$` 0, `last_sign_in` 0
- [x] **Keine Zugangsdaten in URLs** — kein `method="get"` im gesamten `src/`
- [x] **Zählerzeilen fremder Konten und IP-Schlüssel** — nach der Löschung bleiben `register:ip:…` und `account-delete:ip:…` stehen; die BUG-39-Abwehr ist durch `0017` nicht aufgeweicht
- [ ] **BUG-4-16, BUG-4-17** — Reste nach der Löschung (unten)
- [ ] **BUG-4-4, BUG-4-5, BUG-4-7, BUG-4-8, BUG-4-21, BUG-4-22** — unten
- [!] **Drosselung auf `GET /account`** — NICHT GEPRÜFT im Sinne von *nicht implementiert*: 40 Anfragen → 40× 200 (BUG-4-13)

---

## Regression

- [x] **Delta seit Lauf 1 ist rein additiv** — ein Commit, drei Dateien, **+237 / −0**, kein `src/`-File, kein Test eines anderen Features angefasst (`git diff 0902c25..HEAD --stat`)
- [x] **Der neue Trigger bricht PROJ-1 nicht** — Registrierung 200 (zweimal), Anmeldung 200, Reset 200, Abmelden 204; Profil-Anlage-Trigger intakt. Der Trigger feuert ausschließlich `after delete` und kann diese Pfade strukturell nicht erreichen
- [x] **Sprengradius null** — vorher A 6 Protokollzeilen / B 2; nach Löschung von A: **A 0, B unverändert 2**
- [x] **Voraussetzungen der Migration unabhängig belegt** — Eigentümer `postgres` hat `DELETE`, **kein** Fremdschlüssel zeigt auf `auth.audit_log_entries` (`pg_constraint`: 0)
- [x] **Migrationen 0001–0019 der Reihe nach** — `npx supabase db reset` Exit 0; danach DB-Wächter: PROJ-2 12/12, PROJ-3 27/27 (isoliert), PROJ-4 15/15
- [x] **Lint 0 · `tsc` 0 · `npm test` 310/310 · Build Exit 0**
- [x] **Datenisolation unverändert** — `profiles` genau eine Zeile, `runs` `[]` mit gültiger Sitzung
- [ ] **BUG-4-25, BUG-4-27** — Testsuite-Stabilität (unten)

---

## Gefundene Bugs

**Neu in Lauf 2**

### BUG-4-16 — Das Log des Auth-Dienstes behält die Adresse
- **Schwere:** **Medium** · **Bricht:** AC-22 im Wortlaut
- `docker logs supabase_auth_…` enthält jede Protokollzeile ein zweites Mal als JSON, einschließlich `user_deleted` mit `user_email` im Klartext. Gezählt: **906 `user_deleted`-Zeilen in 60 Minuten**
- **Dieselbe Fehlerklasse wie BUG-4-1 selbst:** eine Aufzählung von Orten, die den Dienst-Log nicht kennt. Die Datenbank ist sauber, der Betreiber-Log nicht
- **Empfehlung:** entweder Log-Level/Aufbewahrung regeln — oder AC-22 per `/refine` um die Anbieter-Protokolle erweitern, genau wie EC-9 es für Sicherungskopien tut. Ein Bugfix im Anwendungscode löst das nicht

### BUG-4-17 — `auth.flow_state` behält die Kennung des gelöschten Kontos
- **Schwere:** **Low** · **Bricht:** AC-17 im Wortlaut · **von zwei Bahnen unabhängig gefunden**
- Kein Fremdschlüssel auf `auth.users`, kein Trigger fasst die Tabelle an — **exakt die Bauart, die `design.md` für `auth_throttle` schon einmal beschrieben hat.** Die zweite Tabelle derselben Art wurde nie gesucht
- **Systematisch, kein Einzelfall:** nach 31 gelöschten Konten blieben genau **2** verwaiste Zeilen — die beiden mit einem Recovery-Flow
- Enthält weder Adresse noch Trainername, nur UUID, Zeitpunkt und einen wertlosen PKCE-Code. GoTrue räumt sie mit der Zeit weg
- **Prüftechnischer Hinweis:** Ein Scan nur über Text-/JSON-Spalten findet das **nicht** — die Spur steckt in einer `uuid`-Spalte

### BUG-4-18 — Das Browser-Netz unterscheidet harte von weicher Löschung nicht
- **Schwere:** **Medium** (Testabdeckung) · **vom Owner unabhängig nachgemessen**
- `deleteUser(user.id, false)` → `true` gesetzt (weiche Löschung): **12 von 12 PROJ-4-Browsertests grün**, der Nutzer sieht „Dein Konto wurde gelöscht" — und in der Datenbank stehen danach `auth 1 / profiles 1 / runs 3 / active_runs 1 / audit 5`. Rot wurden **nur zwei** Vitest-Zusicherungen, die das Argument am Mock prüfen
- **Warum das Netz das durchlässt:** Die Kaskadentests rufen `admin.auth.admin.deleteUser` **direkt** auf und umgehen die Server Action; die Browsertests prüfen Weiterleitung und Cookie, nicht den Datenbankzustand. AC-10, AC-13, AC-17 und AC-22 — die Kernzusage des Features — hängen damit an zwei Mock-Zeilen
- **Kein aktueller Produktfehler:** Der ausgelieferte Code löscht hart, und das ist zur Laufzeit von zwei Bahnen belegt. Was fehlt, ist der Schutz gegen einen künftigen Umbau

### BUG-4-19 — Der Grenzwert-Test pinnt keine der beiden Hälften einzeln
- **Schwere:** **Medium** (Testabdeckung) · **korrigiert eine Falschangabe aus Lauf 1**
- Siehe „Korrektur an Lauf 1" oben. Jede Hälfte darf still auf 19 hochgedreht werden, solange die andere bei 5 bleibt
- **Dieselbe Klasse wie BUG-101 in PROJ-1** — ein Grenzwert, den kein Test wirklich festhält

### BUG-4-20 — Der Fix ist weiterhin eine Aufzählung, nur eine Ebene tiefer
- **Schwere:** **Low** (die überlebenden Formen sind geseedet; keine heutige GoTrue-Aktion schreibt sie)
- Sechs Zeilen mit der Adresse geseedet, Konto gelöscht → **drei überlebten**: Adresse in `traits.email` (statt `traits.user_email`), in `actor_name`, und in einem Freitextfeld
- **Widerlegt eine Zusage im Migrationskommentar** (`0019_forget_audit_log_for_user.sql:52-54`: „Sie halten die Zusage auch dann, wenn eine künftige GoTrue-Fassung eine Zeile ohne Kennung schreibt"). Der Kommentar gehört korrigiert
- `0017` ersetzte eine Aufzählung von *Schlüsselnamen*, `0019` erweiterte eine Aufzählung von *Orten* — und benutzt darin wieder eine Aufzählung, diesmal von **vier Feldern**. Ein inhaltlicher Vergleich über `payload::text` erfasste alle drei Formen

### BUG-4-21 — Die Löschung läuft unter jedem Pfad mit Bild-Endung
- **Schwere:** **Low** (kein Rechtegewinn — die Action prüft Sitzung, Passwort und Drosselung selbst) · Erweiterung von BUG-4-5
- `POST /irgendwas.png` mit der Action-Kennung und gültigem Cookie → **HTTP 404**, und trotzdem `x-action-redirect: /login?geloescht=1`; das Konto war **weg**
- Der Proxy-Matcher nimmt Bild-Endungen aus — derselbe Umstand, der bei PROJ-1 zu BUG-30/31 führte. Eine unumkehrbare Löschung ist damit über beliebig viele Pfade auslösbar, und der Statuscode 404 verdeckt, dass sie stattgefunden hat

### BUG-4-22 — `forget_audit_log_for_user()` ist für `public`, `anon` und `authenticated` ausführbar
- **Schwere:** **Low** (nicht erreichbar) · **von zwei Bahnen unabhängig bemerkt**
- `proacl` zeigt `anon=X`, `authenticated=X`; `0019` benutzt `create or replace` **ohne** `revoke` — anders als `0003`/`0005`, die die Datei selbst als Vorbild nennt
- **Gegenprobe:** `POST /rest/v1/rpc/forget_audit_log_for_user` als `anon` und `authenticated` → `PGRST202` (Rückgabetyp `trigger`, nicht im Schema-Cache). Kein Angriffsweg gefunden
- Steht hier, weil es eine `security definer`-Funktion mit `postgres`-Rechten ist, die aus dem `auth`-Schema löscht — dieselbe Klasse wie BUG-131/132

### BUG-4-23 — Der Aufräum-Lauf wird mit der Tabelle langsamer, ohne Auffangnetz
- **Schwere:** **Low**
- Gemessen (`begin; delete …; rollback;`): **21 ms** bei 2.239 Zeilen · **525 ms** bei 302.239 · **1.704 ms** bei 1.002.239
- Kein Index auf den Prädikatsfeldern, **kein Aufräum-Lauf** (`cron.job` kennt nur `active-runs-retention`), und `0019` verzichtet bewusst auf einen Ausnahmeblock
- Der Migrationskommentar benennt Wachstum und Tabellendurchlauf **einzeln** — die Kombination (unbegrenztes Wachstum × O(n) je Löschung × Fehlschlag reißt die Löschung mit) steht nirgends. Nach Art. 17 ein Pfad, der mit der Zeit langsamer und irgendwann unzuverlässig wird

### BUG-4-24 — Die Kopfzeile im zweiten Tab zeigt weiter den gelöschten Trainernamen
- **Schwere:** **Low**
- Nach EC-1 zeigt der zweite Tab die Anmeldeseite, die Kopfzeile trägt aber weiterhin Trainername und „Abmelden". Erst ein Neuladen räumt sie ab

### BUG-4-25 — Ein PROJ-3-Wächtertest ist unter parallelen Schreibern instabil
- **Schwere:** **Medium** · **trifft PROJ-3, verursacht von PROJ-4**
- `PROJ-3-leaderboard-db-guard.spec.ts:305` (EC-1): `rank: 8` beim ersten, `rank: 9` beim zweiten Aufruf derselben Zeile
- **A/B-Messung, je 5 Läufe:** allein **0/5** rot · zusammen mit den Löschketten-Tests **4/5** · zusammen, aber mit ausgeblendetem neuen Test ebenfalls **4/5**
- **Also nicht von der BUG-4-1-Behebung verursacht**, sondern von den Löschketten-Tests aus `29c7ae4` — sie schreiben Runden, die fremde Ränge verschieben
- **Produktverhalten korrekt, die Zusicherung des Tests ist zu stark:** Der Kommentar dort behauptet „Der eigene Eintrag bleibt davon unberührt", das verglichene Objekt enthält aber `rank`

### BUG-4-26 — PROJ-1 EC-12 begründet sein akzeptiertes Risiko mit etwas, das seit PROJ-4 nicht mehr stimmt
- **Schwere:** **Medium** · **trifft PROJ-1, kein Codefehler**
- EC-12 akzeptiert, dass die Recovery-Sitzung nicht verbraucht wird — begründet mit „**Kein Kontoverlust** — der Besitzer kontrolliert sein Postfach und kann jederzeit zurücksetzen"
- Seit PROJ-4 kann, wer eine Recovery-Sitzung auf einem geteilten Gerät hat, das Konto **unwiderruflich löschen**. Aus „Übernahme, umkehrbar" wird „Verlust, endgültig"
- `/account` bleibt mit einer Recovery-Sitzung bewusst erreichbar (`design.md` → Open Questions, so entschieden). Die Entscheidung war richtig; **die Begründung in PROJ-1 EC-12 ist es nicht mehr** und gehört per `/refine PROJ-1` nachgezogen

### BUG-4-27 — Die Playwright-Suite ist nicht deterministisch
- **Schwere:** **Medium** (Verlässlichkeit des Deploy-Gates)
- Vier vollständige Läufe: **grün / rot / rot / grün**, jedes Mal ein anderer Test. Beide Fehlschläge isoliert nachgemessen → grün, kein Produktbruch nachweisbar
- `playwright.config.ts:24` setzt lokal `retries: 0`, jeder Flake wird also rot. **Für das Deploy-Gate heißt das: ein grüner Lauf trägt weniger, als er zu tragen scheint**
- **Teilursache ist die Prüfumgebung** (siehe Methodik-Vorbehalt unten), nicht allein das Produkt

**Aus Lauf 1 bestätigt, weiterhin offen**

| Bug | Schwere | Kurzstand in Lauf 2 |
|---|---|---|
| **BUG-4-2** Restzeit fehlt | Medium | Bestätigt, beide Meldungen ohne Zahl |
| **BUG-4-3** Klick daneben | Low | Bestätigt |
| **BUG-4-4** rotierendes `x-forwarded-for` | Medium | Bestätigt; **die Konto-Hälfte trägt** und wurde erneut gemessen |
| **BUG-4-5** `/account` als zweiter Action-Host | Medium | Bestätigt: `POST /account` ohne Cookie legt ein Konto an, `/leaderboard` → 307 |
| **BUG-4-6** `last_sign_in_at` | Low | Bestätigt und **breiter**: auch `updated_at`, `raw_user_meta_data` und die Zählerzeilen mit der Adresse |
| **BUG-4-7** Security-Header | Medium | Bestätigt, nur `x-powered-by` und `cache-control` |
| **BUG-4-8** `X-Forwarded-Host` | Medium | Bestätigt **mit zerstörerischem Beweis**: ohne Header 500 und Konto bleibt, mit Header 200 und **Konto gelöscht**. Ohne `Origin`-Header ebenfalls gelöscht |
| **BUG-4-9** kein Test pinnt Spaltenrechte | Low | Bestätigt, Schwere belegt: `grant select on profiles to authenticated` → PROJ-3-Wächter **9/9 grün** |
| **BUG-4-10** Feldlisten-Wächter wacht nicht | Low | Bestätigt per Mutation |
| **BUG-4-11** gemeinsames Anmeldekontingent | Low | Code/Config belegt, Laufzeit nicht ausgereizt |
| **BUG-4-12** verwaiste Sitzung nach Fehlschlag | Low | Bestätigt: `sessions 1→2`, `refresh_tokens 1→2` |
| **BUG-4-13** keine Drosselung auf `GET /account` | Low | Bestätigt, 40× 200 |
| **BUG-4-14** Testartefakt in der DB | Low | Bestätigt, `proj4_fail_delete` existiert |
| **BUG-4-15** IP-Zähler bei Erfolg nicht erstattet | Low | Mechanismus bestätigt; das Aussperr-Szenario nicht durchgespielt |

---

## Methodik-Vorbehalt (Owner)

**Alle drei Bahnen teilten sich einen Dev-Server und eine Datenbank.** Während der Läufe standen dort zeitweise **971 Konten und über 1000 Zählerzeilen** aus einer Nachbarbahn, und eine Bahn hat mitten in einer fremden Messreihe die Datenbank zurückgesetzt. Betroffen sind **zeit-, rang- und drosselungsabhängige** Messungen; BUG-4-27 geht teilweise darauf zurück. Die A/B-Messung zu BUG-4-25 bleibt gültig, weil beide Arme im selben Fenster liefen und der Isolationsarm 5/5 grün war. **Für künftige Läufe: getrennte Datenbanken je Bahn.**

**Eine Bahn (Acceptance) lief in ihr Zug-Limit** und musste zur Abgabe ihres Befundstands aufgefordert werden. Ihr Arbeitsbaum und ihre acht Mutationen sind nachweislich zurückgedreht (vom Owner gegengeprüft: `git status` leer, Grenzwerte 5/5, Spaltenrechte exakt drei, Datenbankfunktion identisch zur Migration).

---

## Nicht geprüft in diesem Lauf

- [!] **Optische Beurteilung** — die Absetzung des Gefahrenbereichs (AC-8), Farben, Fokusringe, Animationen. Kein Auge im Lauf
- [!] **Alles außerhalb von Chromium** — die Acceptance-Messungen liefen in einer Engine; Firefox und WebKit nur soweit die Suite reicht
- [!] **AC-15 in WebKit** — siehe Restrisiko unten
- [!] **EC-9 Sicherungskopien** — keine Backup-Infrastruktur lokal, Frist laut Vertrag offen
- [!] **Gehostetes Projekt** — insbesondere **ob `postgres` dort `DELETE` auf `auth.audit_log_entries` hat**. Fehlt das Recht, schlägt **jede** Kontolöschung fehl, weil `0019` bewusst keinen Ausnahmeblock hat. Ebenso offen: ob der Logs-Explorer die `user_deleted`-Zeilen mit Adresse vorhält (BUG-4-16)
- [!] **Security-Header gegen die Live-URL** und **Verhalten hinter einem echten Reverse Proxy** — kein Deploy-Ziel (`deploy: null`)
- [!] **Fehlerausgabe des Produktions-Builds** — ein zweiter Server durfte nicht gestartet werden
- [!] **BUG-4-11 und BUG-4-15 als vollständige Szenarien** — Kontingent nicht ausgereizt, sechs erfolgreiche Löschungen hinter einer IP nicht durchgespielt

---

## Bekanntes Restrisiko: die Drosselung auf einem echten iPhone

Unverändert gegenüber Lauf 1, hier bewusst wiederholt.

**Der Serverschutz ist belegt** — beide Hälften wurden in diesem Lauf erneut von zwei unabhängigen Bahnen über HTTP ausgelöst und greifen an der Vertragszahl. Der Zähler sitzt vollständig in der Datenbank und kennt keine Browser.

**Ungeprüft bleibt, ob ein Mensch auf einem echten iPhone die Sperrmeldung zu sehen bekommt.** In WebKit löst der sechste Klick kein Absenden aus, weshalb `tests/PROJ-4-delete-throttle.spec.ts:41` dort überspringt. Dieser Lauf unterscheidet **nicht** zwischen „nur die Automatisierung stolpert" und „der Dialog reagiert nach fünf Fehlversuchen nicht mehr". Das eine wäre folgenlos, das andere ein Bedienfehler auf dem verbreitetsten mobilen Browser.

---

## E2E Tests

Vier Browser-Suiten aus dem Bau, hier als Regression mitgelaufen (kein eigener `/e2e-tests`-Durchgang):

- [x] `tests/PROJ-4-deletion-cascade.spec.ts` — Löschkette in beide Richtungen, jetzt inkl. Protokollzeilen (AC-10, AC-13, AC-17, AC-18, AC-22; EC-2, EC-3, EC-5, EC-6, EC-10)
- [x] `tests/PROJ-4-account-guard.spec.ts` — Zugang und altes Cookie (AC-4, AC-12, AC-16, AC-21; EC-1, EC-4)
- [x] `tests/PROJ-4-account-narrow.spec.ts` — 320 px und Dialog-Bedienung (AC-1, AC-7, AC-14)
- [x] `tests/PROJ-4-delete-throttle.spec.ts` — Grenzwert (AC-15, EC-7), **in WebKit übersprungen**, und laut BUG-4-19 nicht je Hälfte pinnend

---

## Zusammenfassung

- **Acceptance Criteria:** **17 von 22** vollständig bestanden, 5 im Wortlaut gebrochen (AC-14, AC-15-Meldung, AC-17, AC-19, AC-22), AC-8 optisch nicht beurteilbar
- **Edge Cases:** **11 von 12**, EC-9 nicht prüfbar
- **Bugs:** **26 offen** — 0 Critical, **0 High**, 11 Medium, 15 Low. **1 behoben** (BUG-4-1, dreifach belegt)
- **Security:** 9 Prüfungen belegt, 8 als Befund, 1 als „nicht implementiert" — dazu 7 NICHT GEPRÜFT (gehostetes Projekt, Live-Header, echter Proxy, Produktions-Build, Optik, Nicht-Chromium, EC-9)
- **Regression:** keine durch die Behebung. Der neue Trigger lässt PROJ-1 unberührt, Sprengradius null, Migrationen 0001–0019 sauber
- **Production Ready:** **JA im Sinne der Regel** — kein Critical, kein High, und die Laufzeit-Kriterien wurden tatsächlich ausgeübt

### Was „JA" hier **nicht** heißt

**Zwei Acceptance Criteria sind weiterhin im Wortlaut gebrochen** — AC-17 durch `auth.flow_state`, AC-22 durch das Log des Auth-Dienstes. Beide sind Reste derselben Fehlerklasse wie BUG-4-1, und **beide löst kein Bugfix im Anwendungscode**: Der eine ist eine Tabelle ohne Fremdschlüssel im fremden Schema, der andere ein Betreiber-Protokoll. Der ehrliche Weg dorthin ist ein `/refine PROJ-4`, das AC-17 und AC-22 auf das beschränkt, was das Produkt halten kann — so wie EC-9 es für Sicherungskopien bereits tut.

**Und das Testnetz schützt die Kernzusage nicht.** BUG-4-18 wiegt schwerer als seine Einstufung vermuten lässt: Wer den Löschmodus von hart auf weich umstellt, bekommt **12 von 12 grünen Browsertests** und einen Nutzer, dem „Dein Konto wurde gelöscht" angezeigt wird, während in der Datenbank alles steht. Das ist kein aktueller Fehler — es ist die Abwesenheit des Netzes an genau der Stelle, an der dieses Feature seinen Zweck hat.
