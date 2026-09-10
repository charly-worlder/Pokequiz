# QA Test Results — Lauf 4

**Getestet:** 2026-09-10 (Lauf 3 am selben Tag, Läufe 1–2 am 2026-09-09)
**App-URL:** `http://localhost:3000` (lokaler Dev-Server, einmal vom Owner gestartet)
**Tester:** QA Engineer (KI) — drei unabhängige `qa-engineer`-Bahnen, getrennte Bereiche **und getrennte Absender-Adressen**, zusammengeführt von einem Owner

> Legende: `[x]` in diesem Lauf belegt (Beleg zwingend) · `[ ] BUG` als gebrochen belegt · `[!] NICHT GEPRÜFT` in diesem Lauf nicht prüfbar (Grund zwingend)

## Ergebnis in vier Sätzen

**Kein Critical, kein High — und keine Regression.** Der Refine von AC-19 hat nichts anderes beschädigt: 310/310 Unit, 203 E2E in drei Engines, Lint 0, `tsc` 0, Build 0, Migrationen 0001–0020 in Reihenfolge.

**Zwei neue Medium**, beide erst durch gezielte Angriffe sichtbar: ein **Rennfenster**, das AC-17 bricht, und ein **falsch beschrifteter Ausgang**, der EC-1 bricht — Letzterer sagt einem Nutzer „Dein Konto ist unverändert", während es gelöscht ist.

**Der gestern neu gefasste AC-19-Satz überclaimt erneut** — seine zweite Hälfte hält nicht. Vierte Iteration derselben Klasse.

**Und ein Fund außerhalb von PROJ-4, der unsere eigene Dokumentation widerlegt:** `/privacy` und `/imprint` existieren gar nicht.

---

## Der Fund, der nicht zu PROJ-4 gehört, aber sofort gehört werden muss

**`/privacy` und `/imprint` liefern beide HTTP 404. Es gibt keine solchen Routen** (`ls src/app/` → `account, api, auth, leaderboard, login, reset-password`).

`features/INDEX.md:39` und die Deploy-Blocker-Tabelle (`:66`) sagen aber, sie „**tragen nur Platzhaltertext**" — im Präsens, also als existierten sie. Beim Zuschnitt am 2026-09-09 wurde entschieden, sie **ohne Spec-Zyklus direkt zu schreiben**; geschrieben wurden sie nie.

**Warum das PROJ-4 betrifft, obwohl es außerhalb liegt:** EC-9 (Sicherungskopien) und EC-14 (Betriebsprotokoll) stützen sich beide darauf, dass die Datenschutzerklärung diese Grenzen benennt. Zwei getragene Grenzen dieses Features verweisen damit auf ein Dokument, das es nicht gibt. Und die Fußzeile zeigt korrekt **keinen** Link — der Schalter `LEGAL_PAGES` ist leer geblieben, sonst wären es tote Links.

**Kein PROJ-4-Bug** (`spec.md` stellt beide Seiten ausdrücklich außerhalb), aber die INDEX-Zeile ist falsch und die Deploy-Blocker-Zeile beschreibt einen Zustand, der nicht eingetreten ist.

---

## Acceptance Criteria — 20 von 22 klar bestanden, 2 mit Einschränkung

| AC | Ergebnis | Beleg |
|---|---|---|
| **AC-1** | [x] | `<a aria-label="Dein Konto — …" href="/account">`; Kopfzeile weiterhin drei Links + Abmelden |
| **AC-2** | [x] | Gerendert: E-Mail · Trainername · „Dabei seit 10.09.2026" · „Runden gespielt 3" · „Bester Lauf Serie 7 · 00:45,3" |
| **AC-3** | [x] | Im Inhaltsbereich 0 `<input>`, 0 `<form>`, ein Knopf |
| **AC-4** | [x] | Anonym 307 → `/login`, keine Kontodaten im Rumpf; zweite Schranke `queries.ts:46` |
| **AC-5** | [x] | Genau ein `<main>`, eine Shell-Kopfzeile, eine Fußzeile, 0 zusätzliche `<nav>` |
| **AC-6** | [x] | Zwei Belege, darunter der scharfe Fall: **zwei Runden, beide Serie 0** → „Runden gespielt 2 / Noch keine gewertete Runde" |
| **AC-7** | [x] | `tests/PROJ-4-account-narrow.spec.ts:14` in drei Engines grün (Regressionsbahn, Volllauf) |
| **AC-8** | [x] inhaltlich · [!] optisch | Alle vier Folgen vor jedem Klick im HTML; die optische Absetzung nur als Klassen belegt |
| **AC-9** | [x] | `required` + `type=password`; serverseitig leeres Feld → Feldfehler, **und der Zähler wird dabei nicht verbraucht** (attempts unverändert 1) |
| **AC-10** | [x] | Konto mit drei Runden, laufender Runde und Zählerzeilen: Sweep **vorher 23 Fundstellen in 13 Tabellen → nachher 0** |
| **AC-11** | [x] | Falsches Passwort → Feldfehler, kein Redirect, `users 1 / runs 3` unverändert |
| **AC-12** | [x] | `x-action-redirect: /login?geloescht=1`, vier `Set-Cookie … Max-Age=0`, Banner vorhanden |
| **AC-13** | [x] | Neuregistrierung mit derselben Adresse **und** demselben Trainernamen, neue Kennung |
| **AC-14** | [x] | Abbrechen und Escape schließen (Unit-Tests grün); Klick daneben schließt **nicht** — in der Radix-Quelle belegt (`onPointerDownOutside/onInteractOutside → preventDefault`) |
| **AC-15** | [x] | **Beide Hälften erstmals einzeln gepinnt** — Konto-Hälfte: fünf Fehlversuche von **fünf verschiedenen Adressen**, der sechste von einer Adresse mit Zählerstand 1 abgewiesen. Verbindungs-Hälfte: Fehlversuche gegen **fünf verschiedene Konten** von einer Adresse, abgewiesen bei 6, während der Konto-Zähler bei 1 stand. Von beiden Bahnen unabhängig |
| **AC-16** | [x] | Vier untergeschobene Fremdfelder → gelöscht wurde das eigene Konto, das fremde unberührt. Zweite Bahn zusätzlich mit manipuliertem `prevState` |
| **AC-17** | [ ] **BUG-4-33** | Auf dem gewöhnlichen Pfad **belegt** (Sweep 23 → 0, von zwei Bahnen unabhängig). **Gebrochen durch ein Rennfenster** — siehe unten |
| **AC-18** | [x] | Rangliste vor/nach der Löschung: der Spieler weg, ein anderer nachgerückt, weiterhin genau fünf Zeilen |
| **AC-19** | [ ] **BUG-4-31** | Erste Hälfte **byte-gleich** mit dem Vertrag. Zweite Hälfte hält nicht — siehe unten |
| **AC-20** | [x] Text · [!] Laufzeit | Dialogtext nennt alle vier Folgen und die Unwiderruflichkeit; der Dialog ist clientseitig |
| **AC-21** | [x] | Mit dem aufbewahrten Cookie: `/account` und `/` je 307 → `/login`, die Server Action → `/login` ohne Zugriff |
| **AC-22** | [x] | Sweep 0 Treffer; im Anwendungscode kein Protokollaufruf mit Personenbezug |

---

## Edge Cases — 12 von 14 bestanden

| EC | Ergebnis | Beleg |
|---|---|---|
| **EC-1** | [ ] **BUG-4-32** | Gebrochen im Wortlaut — siehe unten |
| **EC-2** | [x] | `active_runs` mitgelöscht; der andere Tab bekommt 307 → `/login` statt eines Absturzes |
| **EC-3** | [x] | Mit werfendem Trigger zur Laufzeit erzwungen: technische Meldung, Konto/Profil/Sitzung unverändert, **beide Zähler erstattet**. Gegenprobe mit falschem Passwort: **keine** Erstattung. Von zwei Bahnen unabhängig |
| **EC-4** | [x] | Sitzungszeile gelöscht, dann bestätigt → `/login`, Konto unverändert |
| **EC-5** | [x] | Rangliste ohne Fehler, ohne Lücke |
| **EC-6** | [x] | Neues Konto: 0 Runden, kein Ranglistenplatz, neue Kennung |
| **EC-7** | [x] | **Gemessen statt gelesen:** bei offenem Fenster wurde selbst das **richtige** Passwort abgewiesen; nach Zurücksetzen auf `now()-16min` lief derselbe Aufruf durch |
| **EC-8** | [x] | Eine Transaktion — alle drei Fremdschlüssel mit `confdeltype='c'` in der laufenden DB, drei `after delete`-Trigger aktiv; Teilzustand war nicht herstellbar |
| **EC-9** | [!] NICHT GEPRÜFT | Keine Infrastruktur lokal, Frist laut Vertrag offen |
| **EC-10** | [x] | Freigewordener Trainername sofort vom nächsten Konto übernommen |
| **EC-11** | [x] | `/account` liest `active_runs` nirgends |
| **EC-12** | [x] vertragsgemäß | Kein Download-/Export-Pfad — kein Befund |
| **EC-13** | [x] | Löschung unter `/leaderboard` durchgeführt: erst falsches Passwort abgewiesen, dann mit richtigem gelöscht. Auch unter `/privacy` (404) lief die Aktion |
| **EC-14** | [x] Grenze bestätigt | Im Betriebsprotokoll **12 Zeilen** mit der Adresse nach der Löschung, samt `user_deleted`-Eintrag |

---

## Die zwei neuen Medium

### BUG-4-33 — AC-17 hat ein Rennfenster: die Adresse überlebt in `auth_throttle`
- **Schwere:** **Medium** · **Bricht:** AC-17 im Wortlaut
- **Auf dem echten Pfad reproduziert, 3 von 3 Versuchen:** zehn parallele Anmeldeversuche auf dieselbe Adresse, gleichzeitig die Löschung über die Server Action → `auth.users = 0`, aber `login:account:<adresse> | attempts 231` steht weiter. Vierte Bestätigung mit künstlich offen gehaltener Transaktion
- **Und die Bahn hat den Mechanismus mitgeliefert, nicht nur das Symptom:** Schreibzugriffe im `auth`-Schema **serialisieren an der Zeilensperre auf `auth.users`** — ein erfolgreicher Login im offenen Löschfenster hinterließ nachweislich **0** Protokollzeilen und **0** Sitzungen. `public.auth_throttle` fasst `auth.users` nicht an, also fehlt dort genau diese Serialisierung. Deshalb ist **nur** diese eine Tabelle betroffen
- **Wie lange die Adresse liegen bleibt: unbegrenzt.** `prune_auth_throttle` läuft nur beiläufig aus dem Zähler heraus und nur für Fenster älter als eine Stunde; einen Zeitplan gibt es nicht (`cron.job` kennt nur `active-runs-retention`)
- **Warum Medium und nicht High:** aus dem Browser nicht lesbar (RPC 403, REST `[]`), und im Betrieb heilt es aus, sobald irgendein Zählvorgang das Aufräumen auslöst
- **Der naheliegende Fix ist nicht der Trigger**, sondern ein Aufräum-Lauf, der Konto-Schlüssel ohne zugehöriges Konto entfernt — dieselbe `pg_cron`-Liste wie T36/T37

### BUG-4-32 — EC-1: der Verlierer des Rennens bekommt eine Fehlermeldung, und sie ist sachlich falsch
- **Schwere:** **Medium** · **Bricht:** EC-1 im Wortlaut **und** eine in `design.md` benannte Garantie
- EC-1 verlangt „läuft wirkungslos ins Leere; der Spieler sieht die normale Bestätigung aus AC-12 und **keine Fehlermeldung**". `design.md` behauptet als Garantie, der unterlegene Aufruf bekomme „von Postgres den Fehler ‚nichts gelöscht', was **auf denselben Ausgang führt**"
- **Gemessen — führt es nicht.** Zwei gleichzeitige Aufrufe, gültige Sitzung, richtiges Passwort: **2 von 3 Rennen** endeten für den zweiten Aufruf mit `{"error":"Das hat gerade nicht geklappt — technisch, nicht wegen deines Passworts. **Dein Konto ist unverändert.**"}` — während das Konto weg war
- **Das ist die unangenehme Hälfte:** Die Meldung ist nicht nur eine verbotene Fehlermeldung, sie ist **falsch** bei einer unumkehrbaren Handlung. Ein Nutzer, der zweimal klickt, liest, sein Konto sei unverändert — und es ist gelöscht
- **Ursache:** Der zweite Aufruf kommt an der Sitzungsprüfung noch vorbei, die Löschung schlägt dann fehl, und der Zweig kennt nur die eine technische Meldung. Zwischen „Datenbank kaputt" und „war schon weg" wird nicht unterschieden
- **Zweite, mildere Hälfte:** Der *sequenzielle* zweite Aufruf (Sitzung bereits ungültig) leitet auf `/login` **ohne** `?geloescht=1` — die Bestätigung aus AC-12 fehlt dort

---

## Die vierte Iteration derselben Klasse

### BUG-4-31 — AC-19: die zweite Hälfte des neuen Satzes hält nicht
- **Schwere:** **Low** · **Bricht:** AC-19
- Die **erste Hälfte stimmt exakt** — die Aufzählung entspricht byte-gleich dem Vertrag und genau den fünf angezeigten Zeilen
- Die **zweite Hälfte** — „Technische Zeitstempel und Sicherheitszähler kommen zusätzlich dazu und **verschwinden mit der Löschung**" — ist zweimal widerlegt:
  1. **Ein Sicherheitszähler, den der Nutzer mit seinem eigenen Löschversuch erzeugt, verschwindet nicht.** Nach erfolgreicher Löschung steht `account-delete:ip:<adresse> | attempts 1` weiter da. Nur die `:account:`-Hälfte räumt der Trigger ab — **absichtlich so gebaut** (BUG-39); der Satz auf der Seite sagt es nur andersherum
  2. **EC-14 im selben Vertrag sagt das Gegenteil:** Die Adresse überlebt im Betriebsprotokoll. Ein Protokolleintrag ist weder Zeitstempel noch Zähler — über genau das, was die Spezifikation selbst als bleibend einräumt, gibt der Satz keine Auskunft
- **Zwei kleine Wege:** „verschwinden mit der Löschung" auf die konto-bezogenen Reste einschränken, oder den Halbsatz durch den EC-9-/EC-14-Vorbehalt ersetzen. Vertragsentscheidung, kein Codefehler

### REG-4-1 — die neue Test-Zusicherung pinnt nur den Satzanfang
- **Schwere:** **Low** (Testnetz) · **Fünf Mutationen gemessen**

| Mutation | Test |
|---|---|
| Alter Satz zurück | **rot** ✅ |
| Zweite Hälfte entfernt | **rot** ✅ |
| Aufzählung `(E-Mail, Trainername, …)` entfernt | **grün** ❌ |
| „und verschwinden mit der Löschung" entfernt | **grün** ❌ |
| Aufzählung um **falsche** Angaben erweitert (`IP-Adresse, Datum der letzten Anmeldung`) | **grün** ❌ |

- AC-19 nennt den Satz **im Wortlaut**; gepinnt sind davon rund 40 %. Die letzte Mutation ist die schlimmste: Die Seite könnte eine **falsche Art-15-Auskunft** geben und der Test bliebe grün
- **Und der Kommentar über der Zusicherung behauptet mehr, als sie leistet** („geprüft werden beide Hälften … die Aufzählung der fünf Werte und der Hinweis")

### N4 · N5 · REG-4-4 — Dokumentationsdrift, je Low
- **N4:** `account-data-card.tsx:13-16` und `.test.tsx:29` sagen weiterhin, der Satz „behauptet Vollständigkeit" bzw. die Seite zeige „**alles**, was gespeichert ist" — genau die Aussage, die der Refine verworfen hat. `design.md` wurde nachgezogen, diese beiden Kommentare nicht
- **N5:** `design.md` → Prüfhinweise Nr. 3 verspricht, der Feldlisten-Test werde rot, „wenn **irgendwo** ein neues personenbezogenes Feld entsteht". Gemessen: rot wird er, wenn der **Typ** wächst — die Datenbank kennt er nicht. Genau diese Lücke hat BUG-4-6 → BUG-4-31 durchgelassen
- **REG-4-4:** `design.md:28` führt das Element im Komponentenbaum weiter als „**Vollständigkeits**-Satz"

> **Das Muster, benannt.** Dies ist die **vierte bis sechste** Überbehauptung in der Dokumentation dieses Features: der `0019`-Kommentar („hält auch bei einem neuen Feld" — widerlegt), `0020` („für beide Funktionen" — es sind drei), `design.md:77` („speichert die Anwendung gar nicht" — sie tut es), jetzt der Test-Kommentar, der Prüfhinweis und zwei Komponenten-Kommentare. Jede einzeln Low. Zusammen ist es kein Zufall, sondern eine Gewohnheit: **Zusagen werden im selben Atemzug geschrieben wie der Code, aber nicht mit ihm gemessen.**

---

## Security — Zusammenfassung

**Bestanden, jeweils selbst ausgelöst:** Authentifizierung (kein 200 ohne Sitzung), Autorisierung (mit Nutzertoken: `profiles` **1 von 179** Zeilen, `runs` `[]`), beide Drosselungs-Hälften an der Vertragszahl, fail closed vor der Passwortprüfung (gesperrt + **richtiges** Passwort → abgewiesen, Konto blieb), Zähler vom Client nicht manipulierbar (alle vier RPC → 403, die drei Löschfunktionen → **404, das `revoke` aus `0020` wirkt**), Einschleusung (vier Nutzlasten), keine Geheimnisse im Client (im Static genau **ein** JWT, Rolle `anon`), keine sensiblen Felder in Antworten, keine Zugangsdaten in URLs.

**Übermäßiges Löschen: nicht herstellbar** — sogar mit Unicode-Faltung versucht (Kelvin-Zeichen `U+212A`), scheitert schon vor der Datenbank an der Normalisierung und am Unique-Index.

**Weiterhin offen, alle Medium und alle bekannte Klassen:** BUG-4-4 (`x-forwarded-for` rotiert → 10 von 10 Versuchen durch; Bulk-Signup **10 Konten in 3,7 s**), BUG-4-7 (keine Security-Header), BUG-4-8 (`X-Forwarded-Host` → Löschung lief durch, Konto weg).

---

## Regression — keine

- [x] **Delta seit Lauf 3:** ein Commit, fünf Dateien, davon zwei Codedateien (Anzeigetext + Zusicherung). **Kein Test eines anderen Features angefasst**
- [x] `npm test` **310/310** · Playwright **203 grün / 1 übersprungen** · Lint 0 · `tsc` 0 · Build Exit 0 (im abgetrennten Worktree, damit `.next` des laufenden Servers unberührt bleibt)
- [x] Migrationen **0001–0020** in Reihenfolge, gegengeprüft in `supabase_migrations.schema_migrations`
- [x] Kernflüsse PROJ-1/2/3 in drei Engines grün; Routen-Schutz `/`, `/leaderboard`, `/account` je 307
- [x] **BUG-4-30 (Playwright-Determinismus) trat diesmal nicht auf** — das Wartefenster ohne Reserve steht aber unverändert da (60 × 500 ms Polling gegen 30 s Test-Timeout, kein `test.setTimeout`). Dass es diesmal hielt, ist kein Nachweis, dass die Reserve reicht

---

## Nicht geprüft in diesem Lauf

- [!] **Optik** (AC-8 Absetzung, Farben, Fokusringe) und **AC-14/AC-20 im echten gerenderten Dialog** — kein Auge; belegt sind Quelltext, Unit-Tests und die Radix-Quelle
- [!] **Umbruch des jetzt vier Zeilen langen AC-19-Satzes bei 320 px** — der Browsertest prüft den waagerechten Überlauf, nicht die Lesbarkeit des gewachsenen Absatzes
- [!] **Kein E2E-Test prüft den neuen Satz** — der einzige Beleg für den Text ist der Unit-Test
- [!] **EC-9** Sicherungskopien — keine Infrastruktur lokal
- [!] **Rennfenster auf `audit_log_entries` und `flow_state`** — mit 6-Sekunden-Fenster versucht, **0 zurückgebliebene Zeilen**; der Serialisierungs-Mechanismus erklärt es. Kein Befund, aber kein Beweis der Unmöglichkeit
- [!] **Gehostetes Projekt** — insbesondere, ob `postgres` dort `DELETE` auf `auth.audit_log_entries` **und** `auth.flow_state` hat. Fehlt eines, scheitert **jede** Kontolöschung (beide Migrationen bewusst ohne Ausnahmeblock)
- [!] **Security-Header gegen die Live-URL**, **echter Proxy**, **Produktions-Build** — kein Deploy-Ziel

---

## Bekanntes Restrisiko: die Drosselung auf einem echten iPhone

Unverändert. Der Serverschutz ist in diesem Lauf erneut von zwei Bahnen an der Vertragszahl ausgelöst worden. **Ungeprüft bleibt, ob ein Mensch auf einem echten iPhone die Sperrmeldung zu sehen bekommt** — in WebKit löst der sechste Klick kein Absenden aus, weshalb der Grenzwert-Test dort überspringt.

---

## Zusammenfassung

- **Acceptance Criteria:** **20 von 22** klar bestanden; AC-17 auf dem gewöhnlichen Pfad belegt, aber durch ein Rennfenster gebrochen; AC-19 zur Hälfte
- **Edge Cases:** **12 von 14**; EC-1 gebrochen, EC-9 nicht prüfbar
- **Bugs:** 0 Critical, **0 High**, **6 Medium**, 15 Low. **Behoben und bestätigt:** BUG-4-6 in seiner alten Form. **Gegenstandslos:** BUG-4-2, BUG-4-3
- **Security:** 12 Prüfungen belegt, 3 als Befund, 1 als „nicht implementiert" — dazu 7 NICHT GEPRÜFT
- **Regression:** keine
- **Production Ready:** **JA im Sinne der Regel** — kein Critical, kein High, Laufzeit-Kriterien über die echte Server Action ausgeübt

### Was „JA" hier nicht heißt

**Zwei Vertragskriterien sind gebrochen** — AC-17 durch ein Rennfenster, EC-1 durch einen falsch beschrifteten Ausgang. Das zweite ist das unangenehmere: Ein Nutzer, der zweimal klickt, liest „Dein Konto ist unverändert", während es gelöscht ist. Das ist keine Sicherheitslücke, aber eine **falsche Auskunft bei einer unumkehrbaren Handlung**.

**Und der Vertrag ist an einer Stelle schneller gewachsen als seine Prüfung:** AC-19 nennt seit gestern einen Satz im Wortlaut, das Netz pinnt davon 40 %, und die zweite Hälfte des Satzes stimmt nicht. Vier Läufe haben an dieser einen Zusage vier verschiedene Fehler gefunden — jedes Mal war der Befund kleiner als der davor, aber keiner war der letzte.
