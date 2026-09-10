# QA Test Results — Lauf 3

**Getestet:** 2026-09-10 (Läufe 1 und 2 am 2026-09-09)
**App-URL:** `http://localhost:3000` (lokaler Dev-Server, einmal vom Owner gestartet)
**Tester:** QA Engineer (KI) — drei unabhängige `qa-engineer`-Bahnen mit getrennten Bereichen, zusammengeführt von einem Owner

> Legende: `[x]` in diesem Lauf belegt (Beleg zwingend) · `[ ] BUG` als gebrochen belegt · `[!] NICHT GEPRÜFT` in diesem Lauf nicht prüfbar (Grund zwingend)

## Ergebnis in drei Sätzen

**Die beiden Kriterien, an denen Lauf 2 gescheitert ist, halten jetzt** — AC-17 belegt durch einen Sweep über **496 Spalten aller Nicht-System-Schemata** (vorher Treffer in neun Tabellen, nachher **null**), AC-22 im neuen, auf die Anwendung begrenzten Wortlaut. Beide Bahnen haben dabei über die **echte Server Action** gelöscht, nicht über die Administrationsschnittstelle — genau der Weg, den das Netz vor Lauf 2 nicht abgedeckt hatte.

**Kein Critical, kein High.** Ein Acceptance Criterion ist weiterhin gebrochen (AC-19), und es wurde von Low auf **Medium** hochgestuft, weil die Begründung im Design sachlich falsch ist — nicht nur der Anzeigetext.

**Fünf Befunde aus Lauf 2 sind durch den Refine gegenstandslos geworden**, jeder einzeln gegengemessen statt geglaubt.

---

## Acceptance Criteria — 21 von 22

| AC | Ergebnis | Beleg |
|---|---|---|
| **AC-1** | [x] | Kopfzeile trägt drei Links + einen Knopf; Chip-Link mit `aria-label="Dein Konto — <Name>"`, kein zusätzliches Element |
| **AC-2** | [x] | Gerendert: E-Mail · Trainername · „Dabei seit 10.09.2026" · „Runden gespielt 3" (inkl. Nullrunde) · „Bester Lauf Serie 7 · 01:35,0" bei Runden 7/107 300 ms, 0/1 200 ms, 7/95 000 ms. Format auch am Rand geprüft: 100 ms → `00:00,1` |
| **AC-3** | [x] | `<main>`: 0 `<form>`, 0 `input/textarea/select` |
| **AC-4** | [x] | Ohne Cookie: `/account` 307, `/Account` 307, `/account.json` 307, `/account/` 308; `<meta name="robots" content="noindex, nofollow">` |
| **AC-5** | [x] | Genau ein `<main>`, eine Shell-Kopfzeile, eine Fußzeile, 0 `<nav>` |
| **AC-6** | [x] | Frisches Konto: „Runden gespielt 0 / Noch keine gewertete Runde" |
| **AC-7** | [x] | `tests/PROJ-4-account-narrow.spec.ts:14` in **drei Engines** grün (Regressionsbahn, voller Suite-Lauf): `scrollWidth = clientWidth = 320` |
| **AC-8** | [x] inhaltlich · [!] optisch | Alle vier Folgen vor jeder Interaktion im HTML. Die optische Absetzung nur als Klassen (`danger-zone-card.tsx:14,17`) — kein Auge im Lauf |
| **AC-9** | [x] | `required` im Markup; serverseitig: leeres **und** fehlendes Feld → Feldfehler, **kein Zählerverbrauch davor** |
| **AC-10** | [x] | Vorher `auth 1 / profiles 1 / runs 3 / active_runs 1 / Konto-Zähler 5` → nachher **0/0/0/0/0** in einem Aufruf |
| **AC-11** | [x] | Falsches Passwort → Feldfehler, Konto in der DB unverändert |
| **AC-12** | [x] | Redirect `/login?geloescht=1`, `Set-Cookie: …; Max-Age=0; HttpOnly`, Banner sichtbar; ohne Merker kein Banner |
| **AC-13** | [x] | Neuregistrierung mit **derselben** Adresse und **demselben** Trainernamen erfolgreich, neue Kennung ≠ alte |
| **AC-14** | [x] | „Abbrechen" und Escape schließen: `PROJ-4-account-narrow.spec.ts:43` in drei Engines. **Klick daneben schließt nicht** — strukturell garantiert, in der Komponentenquelle belegt (`@radix-ui/react-alert-dialog` → `onPointerDownOutside/onInteractOutside → preventDefault`). Entspricht dem seit dem 2026-09-10 geänderten Wortlaut |
| **AC-15** | [x] | **Von zwei Bahnen unabhängig, beide Hälften buchstäblich.** Konto-Hälfte bei rotierender IP: 1–5 erreichen die Passwortprüfung, **6 und 7 abgewiesen**. Verbindungs-Hälfte mit **sechs verschiedenen Konten** von fester IP: 1–5 durch, **6 abgewiesen**. Beide Meldungen benennen den auslösenden Zähler und nennen **keine** Minutenzahl — genau der neue Wortlaut |
| **AC-16** | [x] | **Verschärft gegenüber Lauf 2:** Angreifer mit **eigenem richtigem Passwort**, Opfer-Kennung gleichzeitig im manipulierten `prevState`, als **dritter Positionsparameter** und in fünf Formularfeldern → gelöscht wurde der **Angreifer**, das Opfer samt Daten unversehrt |
| **AC-17** | [x] | **Der Allsatz hält.** Sweep über **496 Spalten** aller Nicht-System-Schemata (`relkind r,p,m,f`), jede Spalte nach `text` gecastet, `bytea` über `encode`, Vergleich mit `strpos` statt `ilike` (der Unterstrich im Trainernamen ist ein `LIKE`-Platzhalter und erzeugte Scheintreffer). **Vorher Treffer in neun Tabellen, nachher 0 bei 0 unprüfbaren Spalten.** Verallgemeinert: bei 368 Profilen im Bestand **null verwaiste Zeilen**. Zusätzlich `pg_stat_statements` geprüft |
| **AC-18** | [x] | Spieler war Platz 1, nach der Löschung weg, Plätze 1–5 lückenlos, auch für einen zusehenden zweiten Spieler |
| **AC-19** | [ ] **BUG-4-6** | **Der Satz stimmt nicht** — siehe unten. Von Low auf **Medium** hochgestuft |
| **AC-20** | [x] Code · [!] Laufzeit | Dialogtext nennt alle vier Folgen und die Unwiderruflichkeit (`delete-account-dialog.tsx:80-83`). Der Dialog wird clientseitig gerendert, im SSR-HTML nicht enthalten |
| **AC-21** | [x] | Mit dem aufbewahrten Cookie: `/`, `/account`, `/leaderboard` je 307 → `/login`; die **Server Action** mit demselben Cookie → `/login` ohne Wirkung. Von beiden Bahnen unabhängig |
| **AC-22** | [x] | In der Datenbank kein Treffer (Sweep oben). Keine Archiv- oder Historientabelle in den Migrationen (`grep create table` → nur die vier bekannten), kein `writeFile/appendFile/fs.` in `src/`, und die einzigen `console.error` protokollieren ein Fehlerobjekt ohne Klartextfeld |

---

## Edge Cases — 13 von 14

| EC | Ergebnis | Beleg |
|---|---|---|
| **EC-1** | [x] | Zweiter Aufruf mit demselben Cookie → Redirect `/login`, **keine** Fehlermeldung. Garantie im Code: `delete-action.ts:93` |
| **EC-2** | [x] | `active_runs 1 → 0` in derselben Löschung; zweiter Tab → `/login`, kein Absturz |
| **EC-3** | [x] | Mit gezielt werfendem Trigger: technische Meldung, DB unverändert `1/1/1/1`, `/account` weiterhin 200, **beide Zähler erstattet (2→1)**. **Gegenprobe:** falsches Passwort → **keine** Erstattung. Der Zweig ist kein Angriffsweg |
| **EC-4** | [x] | Aktion ohne Cookie → `/login`, Konto unverändert |
| **EC-5** | [x] | Zweiter Spieler lädt die Rangliste neu: keine Lücke, kein Fehler |
| **EC-6** | [x] | Neues Konto: 0 Runden, „Noch keine gewertete Runde" |
| **EC-7** | [x] | Fenster auf `now() - 16 min` → nächster Versuch erreicht wieder die Passwortprüfung, Zähler startet bei 1 |
| **EC-8** | [x] | Anfrage nach 120 ms abgebrochen → Endzustand eindeutig `0/0/0`, kein Teilzustand |
| **EC-9** | [!] NICHT GEPRÜFT | Keine Backup-Infrastruktur lokal; die Frist ist laut Vertrag selbst offen |
| **EC-10** | [x] | Trainername sofort wieder vergebbar, keine Meldung an irgendwen |
| **EC-11** | [x] | `/account` bei laufender Runde: kein Rundenhinweis, keine Wiederherstellung |
| **EC-12** | [x] vertragsgemäß | Kein Download, kein Export — **kein Befund**, wie EC-12 es vorsieht |
| **EC-13** | [x] | Löschung gelingt über `/leaderboard` (200), `/gibtsnicht` (404), `/logo.png` (404), `/api/irgendwas` (404) — der 404 verdeckt, dass die Aktion lief und das Konto weg ist. **Eine Ausnahme:** unter `/login` fängt der Proxy die angemeldete Sitzung vorher ab (siehe N3) |
| **EC-14** | [x] Grenze existiert wie beschrieben | Im Betriebsprotokoll des Auth-Dienstes **13 Vorkommen** der Adresse **nach** ihrer Löschung, 1744 `user_deleted`-Zeilen insgesamt. Außerhalb der Datenbank, von der Anwendung nicht erreichbar |

---

## Security Audit

- [x] **Authentifizierung** — kein 200 auf `/account` ohne Sitzung, über acht Pfadvarianten und die RSC-Variante
- [x] **Autorisierung** — AC-16 oben; Datenebene: `profiles`/`runs` nur die eigene Zeile, `active_runs` → 403, fremdes `profiles` DELETE → 403 (Tabellenrecht)
- [x] **Brute Force** — beide Hälften ausgelöst, Zahlen oben. Über 7 Fehlversuche stieg der Zähler monoton, keine Rückbuchung vor der Passwortprüfung
- [x] **Zähler nicht manipulierbar** — `DELETE`/`PATCH` über PostgREST → 204, Wert **unverändert bei 5**; `INSERT` → 403; RPCs → 403 bzw. 401
- [x] **Übermäßiges Löschen ausgeschlossen** — Konto mit Unterstrich in der Adresse gelöscht: Nachbarkonto, dessen Teilzeichenketten-Verwandte, deren Audit- und `flow_state`-Zeilen **alle unverändert**. Kontrollierte Gegenprobe: 368 → 367 Profile, genau eine Zeile weniger
- [x] **Einschleusung** — fünf Nutzlasten über das einzige Eingabefeld, alle als falsches Passwort abgewiesen, `profiles` unverändert
- [x] **Keine Geheimnisse im Client** — Service-Role-Wert, `sb_secret_`, `SERVICE_ROLE` in keinem geladenen Chunk und in keiner Datei unter `.next/static`
- [x] **Keine sensiblen Felder in Antworten** — `/account`-HTML: Konto-UUID, Access- und Refresh-Token je **null**mal
- [x] **Keine Zugangsdaten in URLs** — Lösch-Dialog über Server Action (POST), Login `method="post"`, `/login?geloescht=1` ohne Personenbezug
- [ ] **BUG-4-4, BUG-4-7, BUG-4-8** — unten (bekannte Deploy-Blocker-Klassen, erneut gemessen)
- [ ] **BUG-4-22 (halb), BUG-132, BUG-4-F** — unten
- [!] **Drosselung auf `GET /account`** — NICHT GEPRÜFT im Sinne von *nicht implementiert*: 30 Anfragen → 30× 200, jede löst drei Datenbankabfragen aus

---

## Regression — grün

- [x] **Delta seit Lauf 2 enthält keinen Anwendungscode** — `git diff ec53d13..HEAD --name-only -- src/` ist **leer**. Fünf Dateien: Vertrag, Design, `privacy.md`, eine Migration, ein Test (+91/−0)
- [x] **Die vier Trigger auf `auth.users` brechen PROJ-1 nicht** — signup 200, login 200, recover 200, logout 204; Profilzeile danach vorhanden. Sie feuern ausschließlich auf `DELETE`, der in keinem der vier Abläufe vorkommt
- [x] **Zwei Randfälle, die beim Bau niemand geprüft hatte** — Konto **ohne** Nebenzeilen: `DELETE 1`, folgenlos. Konto **ohne E-Mail-Adresse**, gelöscht als `supabase_auth_admin`: `DELETE 1`, danach alles 0. Die `old.email is not null`-Wächter tragen, keine `NULL`-Falle, und das `revoke` aus `0020` behindert die Triggerausführung nicht
- [x] **Laufzeit** — Audit-Prädikat `explain analyze`: Seq Scan über 1113 Zeilen, **0,865 ms**; die Löschung im Auth-Log 39–43 ms
- [x] **Migrationen 0001–0020** der Reihe nach, Exit 0 (Reset als allererste Messung um 20:18:37, danach keiner mehr)
- [x] **Lint 0 · `tsc` 0 · Unit 310/310 · Build Exit 0** (Build im abgetrennten Worktree, damit `.next` der parallel messenden Bahnen unberührt bleibt)
- [x] **Kernflüsse PROJ-1/2/3** in drei Engines grün
- [x] **Kein Test eines anderen Features verändert** — einzige berührte Testdatei ist die von PROJ-4, **+91/−0**, keine Assertion gelockert, kein `skip` hinzugefügt
- [ ] **Playwright nicht deterministisch** — unten

---

## Gefundene Bugs

### BUG-4-6 — AC-19: „Das ist alles, was wir über dich gespeichert haben" stimmt nicht
- **Schwere:** **Medium** (in Lauf 2 als Low geführt — hochgestuft)
- **Bricht:** AC-19 (Art. 15 DSGVO)
- **Was zu einem lebenden Konto zusätzlich in der Datenbank steht:** `auth.users.last_sign_in_at` (gemessen: `2026-09-10 18:27:33`), `updated_at`, `confirmed_at`, `raw_user_meta_data` (enthält Adresse **und** Trainername ein zweites Mal), Protokollzeilen mit der Adresse, Zählerzeilen im Klartext
- **Warum Medium und nicht Low:** `design.md:77` begründet das Weglassen mit „die übrigen speichert die Anwendung gar nicht". Für `last_sign_in_at` ist das **nachweislich falsch** — der Fehler steckt also nicht im Anzeigetext, sondern in der Begründung, auf der AC-19 ruht
- **In Lauf 2 mitbehauptet, hier widerlegt:** `auth.sessions.ip` ist **kein** Spielerbezug — alle 313 Zeilen tragen die Adresse des App-Servers, weil die Anmeldung serverseitig läuft
- **Zwei Wege:** die Anzeige erweitern, oder den Satz auf das beschränken, was er tragen kann. Beides klein; die Entscheidung gehört dem Vertrag

### BUG-4-4 · BUG-4-7 · BUG-4-8 — die drei bekannten Deploy-Blocker-Klassen
- **Je Medium**, alle erneut auf dem unumkehrbaren Pfad gemessen:
  - **BUG-4-4** — rotierendes `x-forwarded-for`: **10 von 10** Löschversuchen kamen durch, der Verbindungs-Zähler griff kein einziges Mal. **Die Konto-Hälfte trägt** und wurde erneut belegt. Schließbedingung liegt beim Host
  - **BUG-4-7** — `/account` liefert an sicherheitsrelevanten Kopfzeilen ausschließlich `X-Powered-By: Next.js`, auf der einzigen Seite, die eine E-Mail-Adresse rendert
  - **BUG-4-8** — `Origin: evil` allein → **500**, Konto bleibt; **zusätzlich** `X-Forwarded-Host: evil` → **200**, die Aktion lief. Aus dem Browser wegen `sameSite: lax` nicht ausnutzbar

### BUG-4-22 — nur zur Hälfte behoben
- **Schwere:** **Low** · **von zwei Bahnen unabhängig gefunden**
- `0020` schreibt, es hole das vergessene `revoke` „für beide Funktionen" nach. Es gibt aber **drei** Funktionen dieser Familie: `forget_auth_throttle_for_user` — die PROJ-4 in `0017` selbst neu geschrieben hat — trägt weiterhin `anon=X` und `authenticated=X`
- **Nicht ausnutzbar:** direkter Aufruf → `ERROR: trigger functions can only be called as triggers`; PostgREST exponiert Triggerfunktionen nicht (`PGRST202`)
- **Warum es trotzdem hier steht:** Die Dokumentation führt die Klasse als geschlossen. Das ist die dritte Überbehauptung in diesem Feature nach dem `0019`-Kommentar (BUG-4-20) und `design.md:77` (BUG-4-6)

### BUG-4-20 — die Aufzählung ist eine Ebene höher gewandert
- **Schwere:** **Low** (Testnetz)
- Der neue Oberflächen-Test fängt fünf Ausprägungen — weiche Löschung, Wegfall jedes der drei Trigger, gebrochene Kaskade. Er fragt aber **drei bekannte Orte** ab. Genau diese Bauart (Tabelle ohne Fremdschlüssel, von keiner Kaskade erreicht) ist in diesem Feature **dreimal** aufgetreten
- **Vorschlag der Bahn:** eine Sweep-Zusicherung nach dem Muster oben („kein Treffer auf Adresse, Kennung oder Name in **irgendeiner** Spalte") kostet ~20 Zeilen und deckt den Allsatz aus AC-17 ab statt seiner bekannten Instanzen

### BUG-4-19 — der Grenzwert-Test pinnt weiterhin keine Hälfte einzeln
- **Schwere:** **Low** · unverändert aus Lauf 2
- Der Test feuert von **einer** Verbindung gegen **ein** Konto; welche Hälfte auch immer bei 5 steht, sperrt bei 6. Die Laufzeitmessungen dieses Laufs pinnen beide Hälften — der Test tut es nicht

### BUG-4-28 — der neue Oberflächen-Test kann lautlos leer bestehen
- **Schwere:** **Low** (neu)
- `tests/PROJ-4-deletion-cascade.spec.ts:282` ruft `resetPasswordForEmail` ohne Prüfung des Rückgabewerts, und vor der Löschung fehlt die Zusicherung „die `flow_state`-Zeile ist wirklich entstanden". Schlägt der Mailversand fehl, besteht `expect(countFlowStateFor).toBe(0)` **leer** und der `0020`-Wächter wäre entschärft
- **Lokal nicht auslösbar** (8 gleichzeitige Anfragen: 8× 200), aber `config.toml` führt `email_sent = 2` pro Stunde, und im gehosteten Projekt gilt genau diese Grenze

### BUG-4-29 — `0020` hat keinen Nachlauf für Altbestand und benennt seine Deploy-Voraussetzung nicht
- **Schwere:** **Low** (neu)
- `flow_state`-Zeilen von Konten, die **vor** der Migration gelöscht wurden, bleiben liegen. `0019` löst das für sein Protokoll über die Adressvergleiche; `0020` hat kein Gegenstück. Nach dem Reset aktuell folgenlos (0 dauerhafte Waisen gemessen)
- **Und:** `0019` benennt ausdrücklich, dass vor dem Deploy zu prüfen ist, ob `postgres` im gehosteten Projekt `DELETE` auf seiner Tabelle hat. `0020` benennt das für `auth.flow_state` **nicht** — dabei gilt es dort genauso: Fehlt das Recht, scheitert **jede** Kontolöschung, weil beide Migrationen bewusst ohne Ausnahmeblock arbeiten

### BUG-4-30 — die Playwright-Suite ist unter Fremdlast nicht deterministisch
- **Schwere:** **Medium** (Verlässlichkeit des Deploy-Gates) · trifft **PROJ-1**
- Zwei Läufe: **203 grün** / **202 grün + 1 rot**. Rot war `tests/PROJ-1-password-reset.spec.ts:154` in Mobile Safari — Timeout beim Warten auf die Mail
- **Ursache eingekreist, nicht vermutet:** isoliert **3× grün** (9/9, 22–23 s). Das Wartefenster hat **null Reserve** — `resetLinkFor` pollt 60 × 500 ms = **30 s**, der Test-Timeout ist ebenfalls **30 s**. Jede Fremdlast darüber ist automatisch rot
- **Kein Produktfehler und nicht von diesen Commits verursacht** (kein `src/`-Diff, die Datei seit Lauf 2 unverändert). Billigster Fix: Wartefenster vom Test-Timeout entkoppeln

### N1 · N2 · N3 — Dokumentationsdrift
- **Je Low**, alle drei neu
- **N1:** `delete-account-dialog.tsx:28-29` und `:126` behaupten weiterhin, ein Klick daneben schließe den Dialog — seit dem Refine vom 2026-09-10 das Gegenteil von Vertrag **und** gemessenem Verhalten. Der Kommentar ist die einzige Stelle, an der jemand die Entscheidung nachliest
- **N2:** `design.md:77` — siehe BUG-4-6
- **N3:** EC-13 sagt „beliebige andere Adresse". Für `/login` stimmt das nicht: Dort fängt der Proxy die angemeldete Sitzung vorher ab. Für die Aussage von EC-13 folgenlos, für eine Hosting-Regel die relevante Nuance

### Unverändert offen aus Lauf 2
| Bug | Schwere | Stand |
|---|---|---|
| **BUG-4-12** verwaiste Sitzung nach technischem Fehlschlag | Low | Bestätigt: `auth.sessions 1→2` bei **richtigem** Passwort; bei falschem **kein** Zuwachs |
| **BUG-4-14** Testartefakt `proj4_fail_delete` in der DB | Low | Bestätigt, Funktion ohne Trigger |
| **BUG-4-23** Protokolltabelle wächst unbegrenzt | Low | 1119 Zeilen, kein Aufräum-Lauf |
| **BUG-132** `auth_throttle` volle Tabellenrechte | Low | Unabhängig gegengemessen: Schreibversuche → 204, Zähler **unverändert**. Schutz hält |
| **BUG-4-F** Dev-Build gibt Serverpfade aus | Low | Bestätigt; Produktions-Build ungeprüft |

### Durch den Refine gegenstandslos geworden — jeder einzeln gegengemessen
**BUG-4-2** (Restzeit) · **BUG-4-3** (Klick daneben) · **BUG-4-5** und **BUG-4-21** (Aufrufweg, Bild-Endungen) · **BUG-4-16** (Auth-Protokoll → jetzt EC-14). Keine der Bahnen hat das dem Bericht geglaubt; alle vier wurden am laufenden System nachgeprüft.

### Behoben und bestätigt
**BUG-4-1** (Protokollzeilen) · **BUG-4-17** (`auth.flow_state`) · **BUG-4-18** (Netz unterschied hart/weich nicht) — alle drei per **Mutation** belegt: Schaltet man einen der drei Trigger ab, bleiben genau seine Zeilen stehen; stellt man auf weiche Löschung, wird der neue Oberflächen-Test rot.

---

## Methodik — was diesmal besser lief, und was nicht

**Besser:** Die Anweisung „kein `db reset` außer für die Regressionsbahn, und nur als allererste Messung" hat gehalten. Keine Bahn hat einer anderen die Messreihe zerstört. Die Regressionsbahn hat den Build zusätzlich in einem **abgetrennten Worktree** ausgeführt, damit `next build` und der laufende `next dev` sich nicht dasselbe `.next` teilen.

**Noch offen:** Die Bahnen teilen sich weiterhin **einen Zähler-Topf**. Die Zeile `account-delete:ip:::1` stand zu Beginn einer Bahn bereits auf 6 und hat zwei ihrer Messungen als „gedrosselt" verfälscht; sie hat daraufhin auf eigene `x-forwarded-for`-Adressen umgestellt. **Für den nächsten Lauf: je Bahn eine eigene Absender-Adresse mitgeben** — billiger als getrennte Datenbanken und löst dasselbe Problem.

**Ein transientes Rennfenster, beobachtet und wieder verschwunden:** Eine verwaiste `flow_state`-Zeile stand um 18:33 in der Tabelle und zwei Minuten später nicht mehr — plausibel eine Reset-Anforderung, deren `insert` nach dem `delete` des Kontos committete. Nicht persistent, aber theoretisch der einzige Weg, wie AC-17 nachträglich brechen könnte.

---

## Nicht geprüft in diesem Lauf

- [!] **Optische Beurteilung** (AC-8), Farben, Fokusringe, Animationen — kein Auge
- [!] **AC-14 und AC-20 zur Laufzeit im gerenderten Dialog** — er wird clientseitig gerendert; belegt sind die Browsertests für Abbrechen/Escape und die Komponentenquelle für den Klick daneben
- [!] **EC-9 Sicherungskopien** — keine Infrastruktur lokal, Frist laut Vertrag offen
- [!] **AC-15 in WebKit** — siehe Restrisiko unten
- [!] **Gehostetes Projekt** — insbesondere, ob `postgres` dort `DELETE` auf `auth.audit_log_entries` **und** `auth.flow_state` hat. **Fehlt eines der beiden Rechte, scheitert jede Kontolöschung** (beide Migrationen bewusst ohne Ausnahmeblock). Lokal belegt
- [!] **Security-Header gegen die Live-URL**, **echter Reverse Proxy**, **Produktions-Build** — kein Deploy-Ziel (`deploy: null`)
- [!] **Lokale Mail-Grenze ≠ gehostete** — `config.toml` sagt `email_sent = 2`/Stunde, der Container läuft mit `360000`. Lokal fällt das nie auf; im gehosteten Projekt greift die 2

---

## Bekanntes Restrisiko: die Drosselung auf einem echten iPhone

Unverändert und bewusst wiederholt. **Der Serverschutz ist belegt** — beide Hälften in diesem Lauf erneut von zwei unabhängigen Bahnen über HTTP ausgelöst, an der Vertragszahl. **Ungeprüft bleibt, ob ein Mensch auf einem echten iPhone die Sperrmeldung zu sehen bekommt:** In WebKit löst der sechste Klick kein Absenden aus, weshalb `tests/PROJ-4-delete-throttle.spec.ts:41` dort überspringt. Der Lauf unterscheidet nicht zwischen „nur die Automatisierung stolpert" und „der Dialog reagiert nach fünf Fehlversuchen nicht mehr".

---

## E2E Tests

Fünf Browser-Suiten aus dem Bau, als Regression mitgelaufen (kein eigener `/e2e-tests`-Durchgang):

- [x] `PROJ-4-deletion-cascade.spec.ts` — Löschkette in beide Richtungen **und** über die Oberfläche (neu seit Lauf 2)
- [x] `PROJ-4-account-guard.spec.ts` · `PROJ-4-account-narrow.spec.ts` · `PROJ-4-delete-throttle.spec.ts` (in WebKit übersprungen)

---

## Zusammenfassung

- **Acceptance Criteria:** **21 von 22** bestanden, **1 gebrochen** (AC-19), AC-8 optisch nicht beurteilbar
- **Edge Cases:** **13 von 14**, EC-9 nicht prüfbar
- **Bugs:** **17 offen** — 0 Critical, **0 High**, 5 Medium, 12 Low. **3 behoben und per Mutation bestätigt**, **5 durch den Refine gegenstandslos**
- **Security:** 9 Prüfungen belegt, 5 als Befund, 1 als „nicht implementiert" — dazu 6 NICHT GEPRÜFT
- **Regression:** keine. Kein `src/`-Diff, vier Trigger geprüft inkl. zweier Randfälle, Migrationen 0001–0020 sauber
- **Production Ready:** **JA im Sinne der Regel** — kein Critical, kein High, und die Laufzeit-Kriterien wurden über die **echte Server Action** ausgeübt

### Was „JA" hier nicht heißt

**Ein Acceptance Criterion ist gebrochen** — AC-19, und die Hochstufung auf Medium hat einen Grund: Die Begründung im Design ist sachlich falsch, nicht nur der Anzeigetext. Zwei kleine Wege stehen offen (Anzeige erweitern oder Satz beschränken); welcher, ist eine Vertragsentscheidung.

**Und drei Überbehauptungen in der eigenen Dokumentation** sind in diesem Feature nacheinander aufgetreten: der `0019`-Kommentar („hält auch bei einem neuen Feld" — widerlegt), `0020` („für beide Funktionen" — es sind drei), `design.md:77` („speichert die Anwendung gar nicht" — sie tut es). Jede einzeln harmlos; zusammen ein Muster, das mehr Aufmerksamkeit verdient als die Low-Einstufungen vermuten lassen.
