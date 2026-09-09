# QA Test Results

**Getestet:** 2026-09-09
**App-URL:** `http://localhost:3000` (lokaler Dev-Server, einmal vom Owner gestartet)
**Tester:** QA Engineer (KI) — drei unabhängige `qa-engineer`-Bahnen mit getrennten Bereichen, zusammengeführt von einem Owner

> Legende: `[x]` in diesem Lauf belegt (Beleg zwingend) · `[ ] BUG` als gebrochen belegt · `[!] NICHT GEPRÜFT` in diesem Lauf nicht prüfbar (Grund zwingend)

## Wie geprüft wurde

Die Verifikation lief in **drei Kontexten, die den Bau nicht kennen**. Jede Bahn bekam ausschließlich den Feature-Ordner, die AC-/EC-Liste, ihren Schritt aus `.claude/skills/qa/SKILL.md`, `.ai-eng-kit` und die Basis-URL — nicht die Bau-Unterhaltung, nicht die Abweichungsliste aus `design.md`, keine Zusammenfassung dessen, was gebaut wurde.

| Bahn | Bereich | Umfang |
|---|---|---|
| Acceptance | Schritt 2 | 22 AC, 12 EC, 5 Mutationsproben |
| Security | Schritt 3 | Redteam gegen die laufende App, echte Flight-Requests statt Oberfläche |
| Regression | Schritte 4+5 | PROJ-1/2/3, volle Suiten, `db reset` von 0001–0018 |

**Zwei Bahnen haben denselben schwersten Befund unabhängig voneinander gefunden** (BUG-4-1). Das ist der Grund, warum er hier als High steht und nicht als Ermessensfrage.

---

## Acceptance Criteria

### Der Kontobereich `/account`

#### AC-1 — Nutzer-Chip führt auf `/account`, kein viertes Bedienelement
- [x] Belegt — `src/components/shell/site-header.tsx:82-96` (`href="/account"`, `aria-label`), im gerenderten HTML bestätigt; `tests/PROJ-4-account-narrow.spec.ts:72` grün in Chromium, Firefox und Mobile Safari

#### AC-2 — Die fünf Werte
- [x] Belegt — `curl` mit Sitzungscookie auf `/account`: „E-Mail … | Trainername … | Dabei seit 09.09.2026 | Runden gespielt 3 | Bester Lauf Serie 7 · 01:35,0". Gesetzt waren drei Runden (7/107,3 s · 0/1,2 s · 7/95,0 s) — gezählt werden **alle drei inkl. Nullrunde**, bester Lauf ist der schnellere Siebener, Format `mm:ss,s` korrekt

#### AC-3 — Nichts änderbar
- [x] Belegt — kein `input`/`textarea`/`button`/`form` in der Karte (`src/components/account/account-data-card.test.tsx:58`); im HTML von `/account` existiert genau **ein** `<form>`, der Abmelden-Knopf der Shell

#### AC-4 — Ohne Anmeldung auf `/login`
- [x] Belegt — `curl -i http://localhost:3000/account` ohne Cookie → `307`, `location: /login`. Drei unabhängige Schranken: `src/proxy.ts`, `src/app/account/page.tsx:39`, `src/lib/account/queries.ts:46` (Sitzungsprüfung **vor** jedem Datenzugriff)

#### AC-5 — App-Shell unverändert
- [x] Belegt — im HTML genau ein `<main>`, eine Kopfzeile mit Navigation, eine Fußzeile. Der zweite `<header>` ist der Titelblock (`page.tsx:43-50`) ohne Navigation

#### AC-6 — Ohne gewerteten Lauf ein Hinweis
- [x] Belegt — frisches Konto zeigt „Noch keine gewertete Runde", keine Null. Mutation **M3** (Hinweis durch „Serie 0 · 00:00,0" ersetzt) macht `account-data-card.test.tsx:55` rot

#### AC-7 — 320 px ohne waagerechten Überlauf
- [x] Belegt — `tests/PROJ-4-account-narrow.spec.ts:14` in **drei Engines**: `scrollWidth ≤ clientWidth` bei 320 px, E-Mail-Kasten innerhalb 0…320 px

### Die Löschung auslösen

#### AC-8 — Gefahrenbereich benennt die Folgen vor dem Klick
- [x] Inhaltlich belegt — alle vier Folgen (Konto, Trainername, Runden, Ranglisteneintrag) im HTML vor jeder Interaktion
- [!] NICHT GEPRÜFT: „optisch abgesetzt" — nur über den Quelltext belegbar (`danger-zone-card.tsx:15-17`: `border-destructive/40`, Titel in `text-destructive`). Die optische Wirkung beurteilt kein Lauf ohne Auge

#### AC-9 — Passwort verlangt, ohne Eingabe nicht auslösbar
- [x] Belegt — Klick mit leerem Feld: **0 POST-Anfragen**, Dialog bleibt offen, `validity.valid=false` (`delete-account-dialog.tsx:93`). Serverseitig zusätzlich `delete-action.ts:67-70`. Security-Bahn gegengeprüft: Feld leer, Feld fehlt, Feld **zweimal gesetzt mit leerem ersten Wert** → jeweils abgewiesen, nichts gelöscht

#### AC-10 — Löschung erfasst alles in einem Vorgang
- [x] Belegt — über die Oberfläche mit laufender Runde: vorher `auth 1 / profiles 1 / runs 2 / active_runs 1 / Konto-Zählerzeilen 4` → nachher **0 / 0 / 0 / 0 / 0** (psql-Zählung, zwei unabhängige Durchläufe)

#### AC-11 — Falsches Passwort löscht nichts
- [x] Belegt — Dialog bleibt offen, „Das Passwort ist falsch.", URL bleibt `/account`, Konto in der DB unverändert

#### AC-12 — Abgemeldet, `/login`, Bestätigung
- [x] Belegt — nach Erfolg `/login?geloescht=1` mit dem Banner; ohne Merker **kein** Banner (`account-guard.spec.ts:92`, `grep -c` → 0)

#### AC-13 — Name und Adresse wieder frei
- [x] Belegt — Neuregistrierung mit derselben Adresse **und** demselben Trainernamen erfolgreich, neue UUID ≠ alte

#### AC-14 — Abbrechen, Escape, Klick daneben
- [x] „Abbrechen" und Escape schließen folgenlos — drei Engines, `PROJ-4-account-narrow.spec.ts:43`
- [ ] **BUG-4-3: Klick daneben schließt den Dialog NICHT.** Gemessen: `mouse.click(5,5)` auf das Overlay, Dialog danach weiter sichtbar

#### AC-15 — Drosselung 5 je 15 Minuten mit Restzeit
- [x] Die **Zahl** stimmt, beide Hälften, von zwei Bahnen unabhängig gemessen — Konto-Hälfte: Versuch 1–5 durch, **6 abgewiesen** (IP je Versuch rotiert). Verbindungs-Hälfte: eine feste IP, **sieben verschiedene Konten**, Konten 1–5 durch, **das sechste abgewiesen**. Eigener Scope ohne Kreuzwirkung: nach 8 Lösch-Fehlversuchen war der **Login** desselben Kontos ungehindert möglich. Mutation **M1** (5 → 19) macht `PROJ-4-delete-throttle.spec.ts:127` rot
- [ ] **BUG-4-2: Die Meldung nennt keine Minuten.** Gemessener Wortlaut: „Zu viele Versuche für diese E-Mail-Adresse. Bitte später erneut versuchen."

#### AC-16 — Fremde Kennung wird ignoriert
- [x] Belegt, und zwar hart — Security-Bahn als Nutzer A mit **richtigem eigenem Passwort** und der Kennung von B in **elf Feldern gleichzeitig** plus zwei zusätzlichen Positionsargumenten: gelöscht wurde **A**, B und B's drei Runden unversehrt. Auf der Datenebene: `DELETE /rest/v1/runs?profile_id=eq.<fremd>` → 403, `DELETE /auth/v1/admin/users/<fremd>` mit Nutzer-Token → 403 `not_admin`. Mutation **M2** macht `delete-action.test.ts:139` rot

### Datenschutz

#### AC-17 — Kein Personenbezug mehr in der Datenbank
- [x] Im `public`-Schema restlos sauber — `profiles`/`runs`/`active_runs` 0, **alle vier** Konto-Zählerschlüssel weg, IP-Zeile und fremde Zeile bleiben stehen. Mutation **M5** (Trigger auf die alte Drei-Schlüssel-Aufzählung zurückgedreht) macht `deletion-cascade.spec.ts:172` rot — Migration `0017` ist damit als **wirksam** belegt, nicht nur als plausibel
- [ ] **BUG-4-1: `auth.audit_log_entries` behält die E-Mail-Adresse im Klartext** — 7 Zeilen nach der Löschung eines Kontos, darunter eine, die **der Löschvorgang selbst schreibt**

#### AC-18 — Nicht mehr in der Rangliste
- [x] Belegt — `deletion-cascade.spec.ts:228` (vorher/nachher über `leaderboard_page`); eigene Messung: nach der Löschung lückenlose 1–5-Liste

#### AC-19 — Die Anzeige ist vollständig
- [x] Die fünf Werte plus der Satz „Das ist alles, was wir über dich gespeichert haben." im HTML belegt
- [ ] **BUG-4-6: Der Satz stimmt im Wortlaut nicht.** `auth.users.last_sign_in_at` wird gespeichert (gemessen) und nicht gezeigt

#### AC-20 — Klare Sprache vor der Bestätigung
- [x] Belegt — Dialogtext zur Laufzeit: „Dein Konto, dein Trainername, alle gespielten Runden und dein Eintrag in der Weltrangliste werden gelöscht. Das lässt sich nicht rückgängig machen."

#### AC-21 — Altes Cookie öffnet nichts mehr
- [x] Belegt, doppelt — Cookie-Glas vor der Löschung aufbewahrt: `/`, `/account`, `/leaderboard` je `307 → /login`; `deleteAccountAction` → `x-action-redirect: /login`; `startRoundAction` → `unauthenticated`. **Das rohe JWT (noch ~55 min gültig) gegen GoTrue: `403 user_not_found`**, gegen PostgREST: `200 []`. Kein Datenrest

#### AC-22 — Keine Kopie, keine Löschhistorie, kein Protokoll mit Personenbezug
- [x] Im `public`-Schema kein Archiv und keine Löschhistorie (alle 4 Tabellen nachgezählt); Anwendungsprotokoll sauber (`next-development.log` → 0 Treffer)
- [ ] **BUG-4-1 (derselbe Befund):** Der Löschvorgang erzeugt selbst einen Protokolleintrag mit der Adresse

---

## Edge Cases

| EC | Ergebnis | Beleg |
|---|---|---|
| **EC-1** Doppeltes Absenden / zweiter Tab | [x] | `account-guard.spec.ts:69`; Garantie im Code bestätigt — **kein** Idempotenz-Schlüssel nötig, weil `delete-action.ts:93` ohne Sitzung umleitet; Doppelklick zusätzlich durch `disabled={pending}` abgefangen |
| **EC-2** Laufende Runde in anderem Tab | [x] | Konto mit echter laufender Runde gelöscht: `active_runs 1 → 0` (Kaskade `0007`); anderer Tab landet auf `/login` |
| **EC-3** Teilausfall | [x] | **Vollständig zur Laufzeit durchgespielt, von beiden Bahnen unabhängig.** Werfender Trigger auf `auth.users` → Dialog bleibt offen mit der technischen Meldung, danach `auth 1 / profiles 1 / runs 1 / active_runs 1`, Nutzer weiter angemeldet, **beide Zähler erstattet**. **Gegenprobe, dass die Erstattung hinter der Passwortprüfung liegt:** mit **falschem** Passwort blieben die Zähler stehen (Konto 1→2, IP 0→1). Der Zweig ist damit kein Angriffsweg |
| **EC-4** Sitzung läuft im offenen Dialog ab | [x] | Cookies bei offenem Dialog gelöscht, dann bestätigt → `/login`, Konto unversehrt (psql: 1) |
| **EC-5** Rangliste eines anderen Spielers | [x] | Zweiter Spieler mit offener Rangliste, Neuladen: Liste ohne Fehler, ohne Lücke, Plätze 1–5 fortlaufend |
| **EC-6** Sofortige Neuregistrierung | [x] | Neue UUID, `runs 0`, `active_runs 0`, `/account` zeigt „Noch keine gewertete Runde" |
| **EC-7** Sperre heilt aus | [x] | Fenster künstlich auf `now()-16min` gesetzt → nächster Versuch geht durch. Garantie: `0003_auth_throttle.sql:57-74` setzt `attempts=1` bei überschrittenem Fenster |
| **EC-8** Verbindungsabbruch | [x] | Browser-Kontext **120 ms** nach dem Absenden geschlossen: Zustand vollständig unverändert (`auth 1 / profiles 1 / runs 2 / active_runs 1`), erneute Anmeldung funktioniert — kein Teilzustand |
| **EC-9** Sicherungskopien | [!] NICHT GEPRÜFT | Lokal existiert keine Backup-Infrastruktur, und die Frist ist laut `spec.md` → Open Questions selbst noch offen. Im Vertrag bewusst getragen |
| **EC-10** Name wieder vergebbar | [x] | Neuregistrierung mit demselben Namen erfolgreich, keine Meldung an irgendwen |
| **EC-11** `/account` während laufender Runde | [x] | Kein Hinweis auf die Runde, keine Wiederherstellung; zurück auf `/` steht wieder „Runde starten" |
| **EC-12** Kein Export | [x] vertragsgemäß | Kein Download, keine Export-Aktion im HTML und nirgends im Code (`/download\|Export\|\.csv\|\.json/` ohne Treffer). **Kein Befund**, wie EC-12 es vorsieht |

---

## Security Audit

- [x] **Authentifizierung** — `/account` ohne Sitzung → `307 → /login`; drei unabhängige Schranken (Beleg bei AC-4)
- [x] **Autorisierung** — fremde Kennung in 11 Feldern + 2 Positionsargumenten → eigenes Konto gelöscht, fremdes unversehrt. Datenebene: `DELETE`/`PATCH` auf fremde Zeilen je 403 (Tabellenrecht, nicht erst Policy — BUG-131-Fix bestätigt); `Accept-Profile: auth` → PGRST106
- [x] **Einschleusung** — Trainername `<img src=x onerror=alert(1)>`, `rob'); drop table runs;--`, `<script>` über die App → Zod-Feldfehler. **An Zod vorbei** über `POST /auth/v1/signup` → `500 profiles_trainer_name_format`, zweite Schicht in der DB. Passwortfeld mit `' or 1=1--`, `${jndi:ldap://x}`, `%' or key like '%` → je „Das Passwort ist falsch.", keine Auffälligkeit im Zähler
- [x] **Brute Force auf dem Zugangsdatenpfad** — greift, beide Hälften, exakt an der Vertragszahl (Beleg bei AC-15)
- [x] **Zähler vom Client nicht manipulierbar** — `DELETE`/`PATCH` auf `/rest/v1/auth_throttle` → `204`, **Zeile unverändert bei 8** (RLS ohne Policy); alle vier RPCs → 403 bzw. 401. **BUG-132 bleibt nicht ausnutzbar**
- [x] **Aufräum-Trigger frisst keine fremden Zähler** — empirisch: `account-delete:account:qa4-bulk1@…` und `…:xqa4-bulk1@…` angelegt, ersteres Konto gelöscht → nur die exakte Zeile weg, die andere **unverändert**. Der `right()`-statt-`like`-Ansatz aus `0017` ist damit gemessen
- [x] **Keine Kontoexistenz-Preisgabe auf diesem Pfad** — nicht anwendbar: Der Lösch-Pfad hat kein Adressfeld, die Kennung stammt aus der Sitzung
- [x] **Keine Zugangsdaten in der URL** — kein einziges `method="get"` im Quelltext; `/login` rendert `<form method="post">`, `/account` rendert `<form method="POST" encType="multipart/form-data">`
- [x] **Keine Geheimnisse im Client** — Service-Role-JWT kommt in `.next/static`, `.next/dev/static`, `public/` und im `/account`-HTML **nicht** vor. Im Client genau drei Env-Namen, alle `NEXT_PUBLIC_`
- [x] **Keine sensiblen Felder in Antworten** — `/account`-HTML: Konto-UUID 0 Treffer, JWT 0 Treffer; der Banner auf `/login?geloescht=1` nennt **keine** Adresse
- [ ] **BUG-4-1** — Personenbezug überlebt die Löschung in `auth.audit_log_entries`
- [ ] **BUG-4-4** — `x-forwarded-for` rotiert hebelt die IP-Hälfte aus (BUG-61-Klasse)
- [ ] **BUG-4-5** — `/account` ist der zweite Action-Host-Pfad (BUG-21-Klasse)
- [ ] **BUG-4-7** — keine Security-Header auf `/account` (BUG-12-Klasse)
- [ ] **BUG-4-8** — `X-Forwarded-Host` hebelt die Origin-Prüfung aus (BUG-18-Klasse, jetzt auf einem unumkehrbaren Pfad)
- [!] **Rate-Limit auf `GET /account`** — NICHT GEPRÜFT im Sinne von *nicht implementiert*: 40 aufeinanderfolgende Anfragen → **40× 200**, keine Drosselung. Jede Anfrage löst drei DB-Abfragen aus und liefert die E-Mail-Adresse. Für einen gewöhnlichen Endpunkt im MVP vertretbar, hier als Low geführt (BUG-4-13)

---

## Regression

- [x] **Kein einziger Test von PROJ-1, PROJ-2 oder PROJ-3 ist rot** — `npm test` 310/310 (zweimal auf nachweislich sauberem Arbeitsbaum), Playwright 197 grün / 1 übersprungen
- [x] **Migrationen 0001–0018 laufen der Reihe nach durch** — `npx supabase db reset`, Exit 0; danach DB-Wächtertests 25/25 grün
- [x] **Lint 0 · `tsc` 0 · Build Exit 0** (8 Routen)
- [x] **Kernflüsse** — Registrierung, Anmeldung, Quizrunde, Rangliste, Passwort-Reset: 12/12 grün nach Reset und Build
- [x] **Datenisolation unverändert scharf** — bei **585 Profilzeilen und 270 Runden** liefert `GET /rest/v1/profiles` mit gültiger Sitzung **genau eine** Zeile, `GET /rest/v1/runs` → `[]`
- [x] **320-px-Zusage aus PROJ-2 hält** — `PROJ-2-header-narrow.spec.ts` bei 320/360/375 px, angemeldet und ausgeloggt, drei Engines grün. Der Chip-Umbau hat die Maße nicht verändert (`py-1 pl-1 pr-1 sm:pr-3` in beiden Fassungen)
- [x] **Ein Playwright-Fehlschlag im ersten Lauf war ein Flake** — `account-guard.spec.ts:69` in Mobile Safari, Timeout bei `getByLabel('Trainername')` unter 4 Workern; im Nachlauf 4/4 grün in 5,7 s. Der dokumentierten Flake-Klasse aus `playwright.config.ts:6-19` zugeordnet, **kein Regressionsbefund**
- [ ] **BUG-4-5** — `/account` im Routen-Schutz (siehe unten)
- [ ] **BUG-4-9** — eine von PROJ-3 verifizierte Härtung wurde zurückgenommen, der zugehörige Wächtertest umgeschrieben

---

## E2E Tests

Für PROJ-4 existieren bereits vier Browser-Suiten aus dem Bau — sie sind hier als Regression **mitgelaufen**, nicht von `/e2e-tests` erzeugt:

- [x] `tests/PROJ-4-deletion-cascade.spec.ts` — Löschkette in **beide** Richtungen (AC-10, AC-13, AC-17, AC-18, AC-22; EC-2, EC-3, EC-5, EC-6, EC-10)
- [x] `tests/PROJ-4-account-guard.spec.ts` — Zugang und altes Cookie (AC-4, AC-12, AC-16, AC-21; EC-1, EC-4)
- [x] `tests/PROJ-4-account-narrow.spec.ts` — 320 px und Dialog-Bedienung (AC-1, AC-7, AC-14)
- [x] `tests/PROJ-4-delete-throttle.spec.ts` — literaler Grenzwert (AC-15, EC-7), **in WebKit übersprungen**

Ein eigener `/e2e-tests`-Durchgang für die kritischen Journeys ist damit nicht erledigt — er würde vor allem die Darstellungsfragen abdecken, die unten als NICHT GEPRÜFT stehen.

---

## Nicht geprüft in diesem Lauf

- [!] **Darstellung und Optik** — die „optische Absetzung" des Gefahrenbereichs (AC-8), Farben, Fokusring am neuen Chip-Link, Hover-Zustand, Animationen und Übergänge des Dialogs. Kein Urteil möglich, nur Klassen im Quelltext
- [!] **AC-15 in WebKit** — siehe das benannte Restrisiko unten
- [!] **Der Löschvorgang außerhalb von Chromium** — AC-9 bis AC-13, AC-16, AC-21 und EC-1 bis EC-8 sind in Chromium gemessen. AC-1, AC-7 und AC-14 liegen in drei Engines vor
- [!] **EC-9 Sicherungskopien** — keine Backup-Infrastruktur lokal, Frist laut Vertrag selbst offen
- [!] **Fehlerausgabe des Produktions-Builds** — im Dev-Build liefert eine fehlgeschlagene Action einen Stacktrace mit absoluten Serverpfaden (BUG-105-Klasse). Ein zweiter Server durfte nicht gestartet werden
- [!] **Security-Header gegen die Live-URL** — es gibt kein Deploy-Ziel (`deploy: null`)
- [!] **Verhalten gegen das gehostete Supabase-Projekt** — alle Messungen liefen gegen die lokale Instanz; die Deploy-Blocker aus `INDEX.md` bleiben unverändert offen
- [!] **Verhalten hinter einem echten Proxy** — der IP-Zähler lief lokal auf `account-delete:ip:::1` bzw. auf selbst gesetzten Headern
- [!] **BUG-4-11 zur Laufzeit** — das gemeinsame GoTrue-Anmeldekontingent auszureizen hätte die Anmeldung für die parallel laufenden Bahnen gesperrt

---

## Bekanntes Restrisiko: die Drosselung auf einem echten iPhone

**Der Serverschutz ist belegt, das Browserverhalten nicht.**

`tests/PROJ-4-delete-throttle.spec.ts:41` überspringt WebKit bewusst: Dort löst der **sechste** Klick kein Absenden aus — die Anzeige bleibt bei der Meldung von Versuch 5 stehen, auch nach 20 Sekunden Wartezeit und mit nachweislich gefülltem Feld (`toHaveValue` bestanden). Die Versuche 1 bis 5 laufen dort durch.

**Was gesichert ist:** Der Zähler sitzt vollständig im Server (`auth_throttle`, Migration `0003`) und kennt keine Browser. Beide Hälften wurden in diesem Lauf **von zwei unabhängigen Bahnen** über HTTP ausgelöst und greifen exakt an der Vertragszahl — die Sperre wird verhängt, unabhängig davon, womit man anklopft.

**Was offen bleibt:** Ob ein Mensch mit einem echten iPhone die Sperrmeldung **zu sehen bekommt**. Möglich ist, dass die Meldung dort erscheint und nur die Testautomatisierung sie nicht auslöst — möglich ist auch, dass der Dialog in WebKit nach fünf Fehlversuchen in einen Zustand gerät, in dem der Knopf nicht mehr reagiert. Das eine wäre folgenlos, das andere ein Bedienfehler auf dem verbreitetsten mobilen Browser. **Dieser Lauf unterscheidet die beiden nicht.** Ein Durchgang auf einem echten Gerät oder ein gezielter `/e2e-tests`-Versuch schließt die Lücke; bis dahin steht sie hier.

---

## Gefundene Bugs

### BUG-4-1 — Die E-Mail-Adresse überlebt die Löschung in `auth.audit_log_entries`
- **Schwere:** **High**
- **Bricht:** AC-17 und AC-22, beide im Wortlaut
- **Von zwei Bahnen unabhängig gefunden** (Acceptance und Security)
- **Schritte zur Reproduktion:**
  1. Konto anlegen, ein paar Runden spielen, über `/account` löschen
  2. `docker exec -i supabase_db_Accelerator_Praxis psql -U postgres -d postgres -c "select payload from auth.audit_log_entries order by created_at desc limit 5"`
  3. Erwartet: kein Personenbezug mehr
  4. Tatsächlich: 7 Zeilen mit der Adresse im Klartext, darunter `{"action":"user_deleted","traits":{"user_email":"…","user_id":"…"}}` — **geschrieben vom Löschvorgang selbst**
- **Zweiter, unabhängiger Beleg:** nach `delete from auth.users where email like 'qa4%'` (24 Konten) blieben **81** Audit-Zeilen mit den Adressen stehen
- **Kein Aufräum-Job:** `cron.job` kennt nur `active-runs-retention`. Die Tabelle wächst unbegrenzt (622 Zeilen nach wenigen Entwicklungstagen)
- **Einordnung:** Über PostgREST nicht erreichbar, also kein Angriffsweg von außen — aber AC-17 sagt „an **keiner** Stelle der Datenbank" und AC-22 „**kein** Protokolleintrag, der E-Mail-Adresse oder Trainernamen enthält". Beide Zusagen stimmen nicht. Der Trainername überlebt **nicht** (0 Treffer)
- **Dieselbe Fehlerklasse eine Ebene höher:** `design.md` hat für AC-17 ausschließlich `auth_throttle` untersucht — eine Aufzählung von Orten, die nicht vollständig ist. Genau das, was Migration `0017` innerhalb von `auth_throttle` behoben hat
- **Priorität:** vor dem Deploy beheben oder AC-17/AC-22 per `/refine` auf das beschränken, was das Produkt halten kann

### BUG-4-2 — Die Drosselungsmeldung nennt die Restzeit nicht
- **Schwere:** **Medium**
- **Bricht:** AC-15 („der Spieler erfährt, **in wie vielen Minuten** er es erneut versuchen kann") und `design.md` → Schritt 1 („abweisen mit Restzeit in Minuten")
- **Schritte:** sechsmal im Lösch-Dialog absenden → „Zu viele Versuche für diese E-Mail-Adresse. Bitte später erneut versuchen."
- **Warum der Code es nicht kann:** `src/lib/auth/error-mapping.ts:27-37` hält ausdrücklich fest, dass **keine** Wartezeit genannt wird — begründet für PROJ-1 mit zwei verschiedenen Fenstern (15 min / 1 h). Für PROJ-4 gibt es genau eines (15 Minuten). `registerAttempt` gibt keine Restzeit zurück
- **Priorität:** entweder Code nachziehen (Restzeit durchreichen) oder AC-15 per `/refine` korrigieren. Eine Entscheidung, keine Fleißarbeit

### BUG-4-3 — Klick neben den Dialog schließt ihn nicht
- **Schwere:** **Low**
- **Bricht:** AC-14 („… oder daneben klickt, dann schließt er sich")
- **Schritte:** `/account` → „Konto löschen" → neben den Dialog klicken → Dialog bleibt sichtbar
- **Ursache:** Radix' `AlertDialog` unterdrückt das Schließen bei Außeninteraktion; `src/components/ui/alert-dialog.tsx` ist unverändertes shadcn ohne Gegenmaßnahme. Für eine unumkehrbare Handlung ist dieses Verhalten **verteidigbar** — `design.md` behauptet aber das Gegenteil, und der Vertrag verlangt es
- **Priorität:** billigste Auflösung ist `/refine`, nicht Code

### BUG-4-4 — Rotierendes `x-forwarded-for` hebelt die IP-Hälfte aus
- **Schwere:** **Medium** (projektweit als BUG-61 bereits **High** und Deploy-Blocker)
- **Schritte:** 8 Fehlversuche gegen ein Konto, `x-forwarded-for` je Versuch rotiert → der Verbindungs-Zähler greift **kein einziges Mal**, es entstehen 8 Zeilen mit je 1 Versuch
- **Wichtig für die Einordnung:** Auf diesem Pfad **trägt die Konto-Hälfte** — sie hängt an der E-Mail der Sitzung und ist nicht rotierbar. Versuche 6–8 wurden abgewiesen. Die Löschung ist dadurch **nicht** durchprobierbar. Die Aussage aus `design.md` („der Konto-Zähler ist die Hälfte, die trägt") ist damit gemessen bestätigt

### BUG-4-5 — `/account` ist der zweite Action-Host-Pfad
- **Schwere:** **Medium** (Regressions-Bahn) / **Low** (Security-Bahn) — die beiden Bahnen sind sich uneins, das steht hier bewusst so
- **Trifft:** PROJ-1
- **Schritte:** `POST /account` mit der `next-action`-Kennung von `registerAction`, **ohne jedes Cookie** → `200`, `x-action-redirect: /`, Konto angelegt. Dieselbe Anfrage an `/leaderboard` → `307 → /login`
- **Warum das zählt:** Der QA-Lauf zu PROJ-1 hatte diese Ausnahme als BUG-21 ausdrücklich auf `/` **eingeengt** („Only `/` hosts actions that need the exception", `src/proxy.ts:97`). PROJ-4 verdoppelt sie. Eine Edge-/WAF-Regel auf `/login` wäre über zwei Pfade statt einen umgehbar
- **Was dagegen spricht, es hoch zu hängen:** kein Rechtegewinn, und die Security-Bahn hat gegengeprüft, dass **keine Daten** fließen (`getRunByRoundIdAction` mit fremder Runden-Kennung → `null`, ohne Sitzung wie als anderer Nutzer). Der Preis ist in `src/proxy.ts:115-121` benannt und für `/` bereits akzeptiert
- **Was dafür spricht:** Ohne den Eintrag sind EC-1 und EC-4 kaputt — die Ausnahme ist also **nötig**, aber ihre Begründung gehört in den Vertrag statt nur in einen Codekommentar

### BUG-4-6 — `last_sign_in_at` wird gespeichert, aber nicht gezeigt
- **Schwere:** **Low**
- **Bricht:** AC-19 im Wortlaut („dies ist alles, was über ihn gespeichert wird")
- **Beleg:** `select last_sign_in_at from auth.users` → `2026-09-09 19:49:07` für ein Testkonto
- **Dazu ein Dokumentfehler:** `design.md` begründet das Weglassen mit „die übrigen speichert die Anwendung gar nicht" — für `last_sign_in_at` ist das nachweislich falsch

### BUG-4-7 — Keine Security-Header auf `/account`
- **Schwere:** **Medium** (BUG-12-Klasse, neu betroffene Seite)
- **Beleg:** `curl -D-` → nur `X-Powered-By: Next.js`; kein `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP, HSTS
- **Neu an dieser Stelle:** `/account` ist die **einzige Seite des Produkts, die eine E-Mail-Adresse rendert**. Fehlendes `Referrer-Policy` und `X-Frame-Options` wiegen hier schwerer als auf den Bestandsseiten
- **Korrekt gesetzt sind:** `Cache-Control: no-cache, must-revalidate` und `<meta name="robots" content="noindex, nofollow">`

### BUG-4-8 — `X-Forwarded-Host` hebelt die Origin-Prüfung der Lösch-Action aus
- **Schwere:** **Medium** (BUG-18-Klasse, jetzt auf einem unumkehrbaren Pfad)
- **Beleg:** `Origin: https://evil.example.com` allein → `500 "Invalid Server Actions request."`; **zusätzlich** `X-Forwarded-Host: evil.example.com` → `200`, Action läuft. Ohne `Origin`-Header ebenfalls `200`
- **Abgefedert:** Auth-Cookie `SameSite=lax; HttpOnly`, und die Löschung verlangt zusätzlich das Passwort — aus dem Browser heraus nicht ausnutzbar. Sobald ein Proxy/CDN davorsteht, das den Header nicht verwirft, ist die einzige verbliebene Schranke die Sitzungs- und Passwortprüfung der Action selbst

### BUG-4-9 — Kein Test pinnt mehr ein Spaltenrecht
- **Schwere:** **Low**
- **Trifft:** PROJ-3
- **Was geschah:** Migration `0018` gibt `profiles.created_at` wieder für `authenticated` frei; `0016` hatte die Spalte ausdrücklich ausgeschlossen. Der zugehörige Wächtertest wurde umgeschrieben (`tests/PROJ-3-leaderboard-db-guard.spec.ts:163-197`): aus „muss einen Fehler geben" wurde „eigene Zeile lesbar, fremde Zeile leer"
- **Die tragende Zusage ist nicht geschwächt** — Zeilen-Policy unverändert, live gegengemessen (585 Profile, eine Zeile sichtbar), Test grün
- **Was verlorengegangen ist:** Nach `grep -rn "column_privileges\|grant select" tests/ src/` pinnt **kein einziger Test mehr irgendein Spaltenrecht**. Ein künftiges pauschales `grant select on profiles to authenticated` würde von der Suite **nicht** bemerkt. Vorher hätte die alte Zeile es bemerkt
- **Nebenbefund:** `features/PROJ-3-leaderboard/qa-report.md:156` führt die alte Härtung weiterhin als geprüft („`created_at` … ist damit nicht mehr freigegeben"). Der Satz stimmt seit heute nicht mehr

### BUG-4-10 — Der als „Feldlisten-Wächter" deklarierte Test wacht nicht
- **Schwere:** **Low** (Testqualität)
- **Mutation M4:** neues personenbezogenes Feld `lastLoginAt` in `AccountData` und `queries.ts` eingezogen → **`account-data-card.test.tsx:35` blieb GRÜN.** Rot wurden stattdessen `queries.test.ts` (`toEqual` über das ganze Objekt) und `npx tsc --noEmit` (TS2741)
- **Die Zusage aus AC-19 hält also** — aber nicht durch den Test, der sie im Kommentar für sich beansprucht. Er pinnt nur seine eigene Fixture
- **Dazu ein Dokumentfehler:** `design.md` → Prüfhinweise Punkt 3 beschreibt die Wirkung dieses Tests falsch

### BUG-4-11 — Jeder Löschversuch verbraucht PROJ-1s gemeinsames Anmeldekontingent
- **Schwere:** **Low**
- `src/lib/account/delete-action.ts:50-61` prüft das Passwort per echtem `signInWithPassword`. Das zählt gegen `sign_in_sign_ups = 30 je 5 Minuten pro IP` (`supabase/config.toml:224`) — in Produktion für **alle** Spieler dieselbe Server-IP. Der Code benennt den Preis selbst; der eigene Zähler deckelt auf 5/15 min
- [!] **Zur Laufzeit nicht gemessen** — hätte die Anmeldung für die parallel laufenden Bahnen gesperrt

### BUG-4-12 — Ein gescheiterter Löschversuch hinterlässt eine verwaiste Sitzung
- **Schwere:** **Low**
- `persistSession:false` verhindert nur, dass **Cookies** geschrieben werden — serverseitig entsteht trotzdem eine Sitzung. Gemessen mit künstlich zum Scheitern gebrachtem Löschvorgang: `auth.sessions 2 → 3`, `auth.refresh_tokens 2 → 3`
- Bei geglückter Löschung kaskadiert das weg. Bei EC-3 bleibt ein **nie abgemeldeter Refresh-Token** zurück, von dem weder Nutzer noch Anwendung wissen
- **Dokumentfehler:** `design.md` sagt, der sitzungslose Client „lässt die bestehende Anmeldung unberührt" — das stimmt für die Cookies, nicht für den Auth-Dienst

### BUG-4-13 — Keine Drosselung auf `GET /account`
- **Schwere:** **Low**
- 40 aufeinanderfolgende Anfragen → **40× 200**. Jede löst drei DB-Abfragen aus und liefert die E-Mail-Adresse
- Für einen gewöhnlichen Endpunkt im MVP vertretbar; steht hier, damit es eine Entscheidung bleibt

### BUG-4-14 — Testartefakt bleibt in der lokalen Datenbank zurück
- **Schwere:** **Low** (Testinfrastruktur)
- `tests/PROJ-4-deletion-cascade.spec.ts:186-203` legt `public.proj4_fail_delete()` an und löscht im `finally` **nur den Trigger**, nicht die Funktion
- Kein Angriffsweg (Rückgabetyp `trigger`, für PostgREST nicht aufrufbar), verschwindet mit `db reset`. **Bricht ein Lauf zwischen `create trigger` und `finally` ab**, bleibt zusätzlich ein Trigger auf `auth.users` stehen, der die Löschung genau eines Kontos dauerhaft scheitern lässt

### BUG-4-15 — Erfolgreiche Löschungen sperren hinter geteilter IP aus
- **Schwere:** **Low**, undokumentierter Edge Case
- `accountDeletePerIp` ist 5/15 min und wird bei **erfolgreicher** Löschung bewusst nicht erstattet (`throttle.ts:319-334` erstattet nur im technischen Fehlerfall). Hinter einem gemeinsamen Anschluss (CGNAT, Schule) sperren fünf **erfolgreiche** Löschungen in 15 Minuten den sechsten Nutzer aus — und die Meldung nennt dann „diese Verbindung"
- Bei PROJ-1 ist genau diese Klasse als BUG-54 behoben worden

---

## Zusammenfassung

- **Acceptance Criteria:** **17 von 22 vollständig bestanden**, 5 mit Bruch (AC-14, AC-15, AC-17, AC-19, AC-22) — davon 3 nur im Wortlaut eines Teilsatzes. Kein AC vollständig unerfüllt
- **Edge Cases:** **11 von 12 bestanden**, EC-9 nicht prüfbar (im Vertrag getragen)
- **Bugs:** **15** — 0 Critical, **1 High**, 5 Medium, 9 Low
- **Security:** 10 Prüfungen belegt, 5 als Befund, 1 als „nicht implementiert" — dazu 5 NICHT GEPRÜFT (Produktions-Build, Live-Header, gehostetes Projekt, echter Proxy, Browserabhängiges)
- **Regression:** keine. Kein Test der Bestandsfeatures rot; Migrationen, Lint, `tsc` und Build sauber
- **Production Ready:** **NEIN**

### Warum NEIN

**BUG-4-1 ist der einzige Grund.** Ein High-Befund, von zwei unabhängigen Bahnen gefunden, der **zwei Acceptance Criteria im Wortlaut bricht** — und zwar ausgerechnet die beiden, die dieses Feature seinem Zweck nach tragen: Es ist ein Löschfeature, das nach der Löschung eine E-Mail-Adresse zurücklässt, geschrieben vom Löschvorgang selbst.

Alles andere ist entweder Vertragsarbeit (BUG-4-2, BUG-4-3), gehört zu bereits bekannten Deploy-Blockern (BUG-4-4, BUG-4-7, BUG-4-8) oder ist Low.

> „Production Ready: NEIN" heißt hier **nicht**, dass die Löschung unsicher wäre. Die Autorisierung hält gegen einen ernsthaften Angriff, die Drosselung greift exakt an der Vertragszahl, die Atomarität ist in **beide** Richtungen gemessen, und das alte Cookie öffnet nach der Löschung nichts mehr — alles von einem Kontext belegt, der den Bau nicht kannte.
