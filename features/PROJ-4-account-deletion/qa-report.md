# QA Test Results — Lauf 5 (Abschluss)

**Getestet:** 2026-09-10 (Läufe 3–5 am selben Tag, Läufe 1–2 am 2026-09-09)
**App-URL:** `http://localhost:3000` (lokaler Dev-Server, einmal vom Owner gestartet)
**Tester:** QA Engineer (KI) — drei unabhängige `qa-engineer`-Bahnen, getrennte Bereiche und getrennte Absender-Adressen, zusammengeführt von einem Owner

> Legende: `[x]` in diesem Lauf belegt (Beleg zwingend) · `[ ] BUG` als gebrochen belegt · `[!] NICHT GEPRÜFT` in diesem Lauf nicht prüfbar (Grund zwingend)

## Ergebnis

**Kein Critical, kein High, keine Regression.** BUG-4-32 ist behoben und **von zwei Bahnen unabhängig zur Laufzeit belegt**: 25 gleichzeitige Rennen, 23 davon vollständig sauber — beide Aufrufe enden auf `/login?geloescht=1` mit vier gelöschten Cookies. Die falsche Auskunft „Dein Konto ist unverändert" trat **in keinem Lauf** mehr auf.

**Der neue Zweig ist nicht missbrauchbar** — das war der Hauptauftrag der Sicherheits-Bahn. Die Reihenfolge Sitzung → Drosselung → Passwort hält zur Laufzeit, der Zweig sitzt hinter der Passwortprüfung, er erstattet nicht, und 17 Fehlversuche über fünf Konten haben ihn nie erreicht.

**Ein Fehler steckt im Fix selbst** — in der entgegengesetzten Richtung, siehe BUG-4-34. Er ist die einzige Empfehlung dieses Berichts.

---

## Acceptance Criteria — 21 von 22

| AC | Ergebnis | Beleg |
|---|---|---|
| **AC-1** | [x] | Chip-Link mit `aria-label`; Kopfzeile auf `/` und `/account` **identisch** (drei Links + Abmelde-Formular) |
| **AC-2** | [x] | Gerendert: E-Mail · Trainername · „Dabei seit 10.09.2026" · „Runden gespielt 3" · „Bester Lauf Serie 7 · 00:45,3" |
| **AC-3** | [x] | Im Server-HTML genau **ein** `<form>` — das Abmelde-Formular der Shell; kein Eingabefeld im Inhaltsbereich |
| **AC-4** | [x] | Anonym 307 → `/login`, Rumpf ohne Kontodaten |
| **AC-5** | [x] | Ein `<main>`, 0 zusätzliche `<nav>`, gleiche Shell wie `/` |
| **AC-6** | [x] | Konto ohne Runden → „Noch keine gewertete Runde". Der scharfe Fall (mehrere Runden, alle Serie 0) wurde in **Lauf 4** belegt |
| **AC-7** | [x] | `tests/PROJ-4-account-narrow.spec.ts:14` in drei Engines grün (Regressionsbahn, Volllauf) |
| **AC-8** | [x] inhaltlich · [!] optisch | Alle vier Folgen und „lässt sich nicht rückgängig machen" **vor** jedem Klick im HTML; die optische Absetzung nur als Klasse |
| **AC-9** | [x] | Leeres Feld → Feldfehler, **Zähler unberührt**; `required` im Markup |
| **AC-10** | [x] | Konto mit drei Runden, laufender Runde und vier Zählerzeilen: Sweep **vorher 28 Treffer in 13 Tabellen → nachher 0** |
| **AC-11** | [x] | Falsches Passwort → Feldfehler, kein Redirect, **0 Cookies gelöscht**, Konto steht |
| **AC-12** | [x] | `x-action-redirect: /login?geloescht=1`, 4 × `Max-Age=0`, Banner sichtbar; ohne Merker kein Banner |
| **AC-13** | [x] | Neuregistrierung mit gleicher Adresse **und** gleichem Trainernamen, neue Kennung, 0 Runden |
| **AC-14** | [x] | Klick daneben schließt **nicht** — in der Radix-Quelle belegt; Abbrechen/Escape per Unit-Test und in Lauf 4 in drei Engines |
| **AC-15** | [x] | **Beide Hälften buchstäblich gepinnt, von zwei Bahnen unabhängig.** Konto-Hälfte: fünf Fehlversuche von **fünf verschiedenen** Adressen, der sechste abgewiesen, alle IP-Zähler auf 1. Verbindungs-Hälfte: Fehlversuche gegen **sechs verschiedene Konten** von einer Adresse, der sechste abgewiesen, Konto-Zähler auf 1. **Fail closed:** gesperrt + **richtiges** Passwort → abgewiesen, alle sechs Konten blieben |
| **AC-16** | [x] | Untergeschobene Felder plus manipuliertes `prevState` plus drittes Positionsargument → gelöscht wurde das **eigene** Konto, das Opfer unversehrt. Von zwei Bahnen unabhängig |
| **AC-17** | [x] auf dem gewöhnlichen Pfad | Sweep nach Adresse, Kennung **und** Trainername je 0 Treffer, inkl. `audit_log_entries`, `flow_state`, `one_time_tokens`, `identities`, `sessions`, alle vier Zähler-Scopes. **Rot-Gegenprobe am lebenden Konto: 13 Fundorte** — der Sweep kann also finden. Zum Rennfenster siehe BUG-4-33 |
| **AC-18** | [x] | Rang-1-Konto gelöscht: Zeile weg, der nächste rückt auf, Zeilenzahl konstant |
| **AC-19** | [ ] **BUG-4-31** | Erste Hälfte **byte-gleich** mit dem Vertrag. Zweite Hälfte unverändert nicht zutreffend — als getragene Grenze entschieden |
| **AC-20** | [x] Text · [!] Laufzeit | Dialogtext nennt alle vier Folgen und die Unwiderruflichkeit |
| **AC-21** | [x] | Mit dem aufbewahrten Cookie: `/account`, `/`, `/leaderboard` je 307 → `/login`; Server Action → `/login` ohne Zugriff. Von zwei Bahnen |
| **AC-22** | [x] | Sweep 0 Treffer; **kein** `console.*` in `src/lib/account`, `src/components/account`, `src/app/account` |

---

## Edge Cases — 13 von 14

| EC | Ergebnis | Beleg |
|---|---|---|
| **EC-1** | [x] für den gleichzeitigen Fall · [ ] Rest siehe unten | **25 Rennen gemessen: 23 vollständig sauber** — beide Aufrufe `x-action-redirect: /login?geloescht=1`, vier Cookies `Max-Age=0`, keine Fehlermeldung. Eines fiel in die Drosselung der Bahn selbst, eines war eine **einmalige, nicht reproduzierte** Auffälligkeit (siehe „Offene Einzelbeobachtung") |
| **EC-2** | [x] | `active_runs` mitgelöscht; anderer Tab → 307 `/login`, kein Absturz |
| **EC-3** | [x] | Störungstrigger: technische Meldung, nichts gelöscht, angemeldet geblieben, **genau ein Versuch erstattet**; Gegenprobe falsches Passwort → **keine** Erstattung. Nach Rücknahme lief dieselbe Löschung durch |
| **EC-4** | [x] | Sitzungszeile gelöscht, dann bestätigt → `/login`, Konto unverändert |
| **EC-5** | [x] | Rangliste während und nach der Löschung ohne Fehler, ohne Lücke |
| **EC-6** | [x] | Neues Konto: 0 Runden, neue Kennung |
| **EC-7** | [x] | Fenster auf `now()-16min` → derselbe Aufruf lief durch und löschte |
| **EC-8** | [x] teilweise | Alles-oder-nichts über den Störungstrigger belegt; ein **echter** Verbindungsabbruch wurde in diesem Lauf nicht provoziert (in Lauf 3 gemessen) |
| **EC-9** | [!] NICHT GEPRÜFT | Keine Sicherungskopien-Infrastruktur lokal |
| **EC-10** | [x] | Freigewordener Trainername sofort neu vergeben |
| **EC-11** | [x] | `/account` erwähnt die laufende Runde nicht; `active_runs` wird nirgends gelesen |
| **EC-12** | [x] vertragsgemäß | Kein Download-/Export-Pfad |
| **EC-13** | [x] | Löschung über die Aktion unter `/leaderboard` durchgeführt → Konto weg |
| **EC-14** | [x] Grenze bestätigt | Betriebsprotokoll enthält gelöschte Adressen weiter (7 bzw. 12 Zeilen) |

---

## Die eine Empfehlung dieses Berichts

### BUG-4-34 — der Fix für BUG-4-32 ist in die andere Richtung zu großzügig
- **Schwere:** **Medium** — die Bahnen sind sich uneins, und das steht hier so: die **Regressionsbahn sagt Medium**, die **Sicherheitsbahn Low** (kein Anfragewert fließt in die URL, es braucht also Fehlkonfiguration statt eines Angreifers). Ich folge der strengeren Lesart, weil die Fehlrichtung „offen" statt „geschlossen" ist
- **Der Code:** `alreadyGone = error.status === 404 || error.code === 'user_not_found'` — ein **ODER**. Damit genügt **jeder** 404
- **Die Folge:** Ein 404 aus einer Schicht **vor** dem Auth-Dienst (Gateway-Route weg, pausiertes Projekt, falsch gesetzte Basis-URL) ist von „Konto war schon weg" nicht unterscheidbar. Der Spieler wird abgemeldet und bekommt die Löschbestätigung, **während sein Konto samt Runden weiterlebt** — eine falsche Datenschutzzusage auf genau dem Pfad, für den dieses Feature existiert
- **Es ist die Umkehrung des behobenen Fehlers, und die schlechtere Richtung:** Beim alten Fehler las der Nutzer, sein Konto sei unverändert, während es weg war — ärgerlich, aber er bemerkt es. Hier geht er im Glauben, seine Daten seien gelöscht, während sie da sind
- **Von zwei Bahnen unabhängig gefunden.** Belegt durch die eigene Mutationsprobe des Bauenden: „nur `status`, `code` weggelassen" lässt den Erfolgspfad **grün**
- **Dazu ein zweiter, kleinerer Rest derselben Sache (Low):** Der `catch`-Zweig sagt weiterhin ungeprüft „Dein Konto ist unverändert". Wirft der Aufruf **nach** dem serverseitig ausgeführten DELETE (abgebrochene Verbindung, Timeout), ist das dieselbe Falschauskunft — auf dem Wurf-Pfad stehen geblieben. Aus dem Quelltext, nicht ausgelöst
- **Der Fix ist ein Zeichen:** `&&` statt `||`, oder allein auf den Fehlercode prüfen. Beides degradiert im Zweifel zum **bekannten, gemeldeten** Verhalten statt zu einer falschen Erfolgsmeldung

---

## Was das Testnetz weiterhin nicht hält

Diese drei sind keine Produktfehler, sondern fehlender Regressionsschutz. Alle drei sind in diesem Lauf **per Mutation gemessen**, nicht vermutet.

| # | Mutation | Ergebnis | Schwere |
|---|---|---|---|
| **BUG-4-19** (erweitert) | Grenzwert `5 → 19` in **beiden** Hälften | **313/313 grün** — die Vertragszahl aus AC-15 ist von **keinem** Unit-Test gepinnt. Nur der Playwright-Test fängt sie, und der **überspringt in WebKit** | Low |
| **REG-4-1** | AC-19-Aufzählung um **falsche** Angaben erweitert (`IP-Adresse, Datum der letzten Anmeldung`) | **grün geblieben** — eine falsche Art-15-Auskunft bliebe unbemerkt | Low |
| **N3** | — | Der **echte** Fehlschlag ist nur per Unit-Mock gedeckt; der E2E-Test provoziert ihn **an der Action vorbei** | Low |

---

## Security — Zusammenfassung

**Der neue Zweig, gezielt angegriffen:** kein Missbrauchsweg. Aufruf ohne Sitzung gegen eine gesperrte IP → `/login`, Zähler **vorher 12, nachher 12** (die Sitzungsprüfung liegt vor dem Zähler und verbraucht ihn nicht). Gesperrt + richtiges Passwort → Sperrmeldung, Konto blieb. Keine erzwingbare Erfolgsmeldung, kein Fremd-Abmelden, keine Drosselungsumgehung.

**Bestanden, jeweils selbst ausgelöst:** Authentifizierung · Autorisierung (fremdes `profiles`/`runs`/`auth_throttle` je `[]`; `DELETE /admin/users/<fremd>` → 403) · beide Drosselungs-Hälften an der Vertragszahl · Einschleusung (auch gezielt gegen den Suffix-Vergleich aus `0017`: Adresse mit `:account:` darin → von der Validierung abgewiesen) · **im Client-Bundle kein einziges JWT** · keine sensiblen Felder in Antworten · keine Zugangsdaten in URLs.

**Weiterhin offen, alle Medium und alle bekannte Deploy-Blocker-Klassen:** BUG-4-4 (`x-forwarded-for`), BUG-4-7 (Security-Header), BUG-4-8 (`X-Forwarded-Host`).

**Wichtige Entlastung für dieses Feature:** Bei BUG-4-4 trägt die **Konto**-Hälfte, und sie ist **nicht** header-umgehbar. Weil die Aktion eine gültige Sitzung des Zielkontos verlangt, gibt es hier kein Spraying über viele Konten.

---

## Regression — keine

- [x] `npm test` **313/313** · Playwright **203 grün / 1 übersprungen** · Lint 0 · `tsc` 0 · Build Exit 0 (abgetrennter Worktree)
- [x] Migrationen **0001–0020** in Reihenfolge, Exit 0
- [x] **Sechs Mutationen, alle rot** — darunter zwei, die eigens prüfen, ob der Fix die Wächter des **echten** Fehlerpfads entschärft hat: Erstattung entfernt → rot, technische Meldung ausgetauscht → rot. **Er hat nicht**
- [x] **Kein Test eines anderen Features verändert** — `git diff --name-only -- tests/` ist leer
- [x] Kernflüsse PROJ-1/2/3 grün; Routenschranken je 307
- [x] **BUG-4-30 (Playwright-Determinismus) trat nicht auf** — 27 Ausführungen des betroffenen Tests, null rot

---

## Zwei getragene Grenzen — Zustand bestätigt, keine Neubewertung

Beide wurden vom Nutzer am 2026-09-10 ausdrücklich als dokumentiert akzeptiert.

- **BUG-4-33** (Rennfenster in `auth_throttle`): besteht. Kein Aufräum-Lauf existiert; aktuell **66 verwaiste `*:account:<adresse>`-Zeilen** in der Datenbank. Bei 12-facher Parallelität schlug das Fenster **nicht** zu (5 durch, 7 abgewiesen); gestaffelt reproduzierte eine Bahn den Effekt 3 von 3
- **AC-19, zweiter Halbsatz** („verschwinden mit der Löschung"): unverändert nicht zutreffend — nach erfolgreicher Löschung steht der vom eigenen Löschversuch erzeugte IP-Zähler weiter

---

## Kleinere Befunde

- **EC-1, sequenzieller Rest (Low):** Der *spätere* zweite Aufruf (Sitzung bereits ungültig) landet auf `/login` **ohne** `?geloescht=1` — keine Fehlermeldung, aber auch nicht die Bestätigung, die EC-1 zusagt. In `design.md` begründet: Ihn zu unterscheiden hieße, dem **ungeprüften** Token zu glauben
- **Cookie-Löschung hängt am Aufrufpfad (Low, neu):** Dieselbe erfolgreiche Löschung liefert unter `/account` vier `Max-Age=0`, unter `/` und `/leaderboard` **keine** `Set-Cookie`-Kopfzeile. Der Nutzer landet trotzdem richtig, und das alte Cookie gewährt nichts (AC-21 belegt)
- **Dokumentationsdrift (Low):** `delete-account-dialog.tsx:28-29` behauptet weiterhin, ein Klick daneben schließe den Dialog — seit dem Refine das Gegenteil. **N4 und REG-4-4 sind behoben**, diese Stelle und N5 (`design.md` → Prüfhinweise) nicht
- **Testartefakt (Low):** `public.proj4_fail_delete()` bleibt nach jedem Testlauf in der Datenbank. **Der eigentliche Punkt:** Bricht ein Lauf zwischen `create trigger` und dem `finally` ab, bleibt ein Trigger auf `auth.users` stehen und **jede** Kontolöschung scheitert danach dauerhaft, ohne dass eine Migration die Ursache verrät
- **Grant-Inkonsistenz (Low):** `forget_auth_throttle_for_user` und `handle_new_user` behalten `EXECUTE` für `anon`/`authenticated`; die beiden von PROJ-4 neu gebauten Funktionen stehen korrekt nur auf `postgres`/`service_role`

### Offene Einzelbeobachtung

In einem von 25 Rennen lieferte der zweite Aufruf weder Redirect noch Fehlermeldung noch Cookie-Löschung; das Konto war danach gelöscht. **Einmalig, in 19 weiteren Rennen nicht wieder aufgetreten, Rumpf nicht mitgeschnitten.** Die Bahn hat es ausdrücklich als Beobachtung gemeldet, nicht als Befund — hier steht es aus demselben Grund.

---

## Nicht geprüft in diesem Lauf

- [!] **Optik und Laufzeit-Interaktion des Dialogs** — kein Browser; belegt sind Quelltext, Unit-Tests, die Radix-Quelle und die Browsertests aus Lauf 4
- [!] **EC-9** Sicherungskopien
- [!] **BUG-4-34 über einen echten Gateway-404** — nicht auslösbar, ohne die Umgebung der anderen Bahnen zu verändern
- [!] **Der `catch`-Zweig** — hätte einen werfenden Aufruf in der geteilten Datenbank verlangt
- [!] **Das exakte Rennfenster aus BUG-4-33** — bei 12-facher Parallelität nicht getroffen
- [!] **Gehostetes Projekt** — insbesondere, ob `postgres` dort `DELETE` auf `auth.audit_log_entries` **und** `auth.flow_state` hat. Fehlt eines, scheitert **jede** Kontolöschung (beide Migrationen bewusst ohne Ausnahmeblock)
- [!] **Security-Header gegen die Live-URL**, **echter Proxy**, **Produktions-Build** — kein Deploy-Ziel
- [!] **AC-15 in WebKit** — der Grenzwert-Test überspringt dort; ob ein Mensch auf einem echten iPhone die Sperrmeldung sieht, bleibt offen

### Methodik-Hinweis

Eine Bahn hat Zählerzeilen im Bereich `203.0.113.5x` gelöscht und dabei möglicherweise die Zähler einer Nachbarbahn mitgenommen — sie hat es selbst gemeldet. Für künftige Läufe: nicht nur eigene Absender-Adressen, sondern auch **nur eigene Schlüssel löschen**.

---

## Zusammenfassung

- **Acceptance Criteria:** **21 von 22** bestanden; AC-19 zur Hälfte (getragene Grenze)
- **Edge Cases:** **13 von 14**; EC-9 nicht prüfbar
- **Bugs:** 0 Critical, **0 High**, 5 Medium, 14 Low
- **Behoben und von zwei Bahnen unabhängig belegt:** BUG-4-32
- **Security:** 13 Prüfungen belegt, 3 als Befund, 1 als „nicht implementiert"
- **Regression:** keine
- **Production Ready:** **JA**

### Was „JA" hier nicht heißt

**Eine Empfehlung bleibt:** BUG-4-34 — ein Zeichen im Code, das im Zweifel eine falsche Löschbestätigung erzeugt. Es steht als Deploy-Blocker in `features/INDEX.md`, weil die Fehlrichtung „offen" statt „geschlossen" ist.

**Und drei Zusagen sind schneller gewachsen als ihre Prüfung:** Die Drosselungszahl aus AC-15, der Wortlaut aus AC-19 und der echte Fehlerpfad sind von keinem Unit-Test gepinnt — alle drei in diesem Lauf per Mutation gemessen, alle drei blieben grün. Das ist kein aktiver Fehler, sondern das Netz, das beim nächsten Umbau fehlen wird.

---

## Nachtrag vom 2026-09-10 — beim Abschluss gefunden: BUG-4-35

**Anlass war kein Testlauf, sondern das Aufräumen.** Vor dem Löschen der 554 Testkonten aus der Entwicklungsdatenbank wurde nachgezählt, was am Ende der Sitzung noch an personenbezogenen Spuren übrig war. Antwort: 21 Zeilen — und sie stammen alle aus derselben Quelle.

### Der Befund

`auth.audit_log_entries` enthielt **21 `user_deleted`-Zeilen mit E-Mail-Adresse und Konto-Kennung im Klartext**, sämtlich aus den **25 gleichzeitigen Rennen** dieses Laufs (`qa5-race1` bis `qa5-race25`).

**Die Gegenprobe macht den Befund scharf:** Aus allen übrigen rund 530 Löschungen der Sitzung — Einzelpfad, über die Server Action wie über den Administrationszugang — blieb **keine einzige Zeile** stehen. Die Bereinigung aus Migration `0019` arbeitet also korrekt; sie greift nur im gleichzeitigen Fall daneben.

**Mechanismus, derselbe wie bei BUG-4-33:** Der Anmeldedienst schreibt die `user_deleted`-Zeile, **nachdem** der `after delete`-Trigger gelaufen ist. Ein Trigger kann nichts löschen, was zum Zeitpunkt seines Laufs noch nicht existiert. Beim Einzelaufruf liegt die Schreibreihenfolge günstig, bei zwei gleichzeitigen Aufrufen in 21 von 25 Fällen nicht.

### Einordnung

| | |
|---|---|
| **Severity** | **Medium** |
| **Bricht** | AC-17 und AC-22 im Wortlaut — und zwar an der E-Mail-Adresse, dem Datum, um das es AC-17 überhaupt geht |
| **Erreichbarkeit** | Nicht über PostgREST lesbar (in Lauf 1 gemessen). Kein Angriffsweg von außen |
| **Heilt es aus?** | **Nein.** Es gibt keinen Aufräum-Lauf für diese Tabelle; die Zeilen bleiben unbegrenzt liegen |
| **Wie exotisch?** | Nicht exotisch. Es ist genau der Doppelklick- und Zwei-Tabs-Fall, für den **EC-1** geschrieben wurde |

### Warum fünf Läufe daran vorbeigesehen haben

Beide Prüfungen waren für sich richtig und haben sich gegenseitig die Lücke gelassen:

- Der **AC-17-Sweep** über alle Spalten aller Schemata lief gegen eine **einzelne** Löschung — dort ist das Ergebnis tatsächlich sauber, 28 Treffer vorher, 0 nachher.
- Das **Rennen** wurde auf sein **Antwortverhalten** geprüft (beide Aufrufe landen auf `/login?geloescht=1`, vier Cookies auf `Max-Age=0`), nicht auf seine **Rückstände**.

Niemand hat den Sweep nach dem Rennen laufen lassen. Das ist die Lehre, die über diesen einen Bug hinausgeht: **Eine Zusage über den Endzustand muss nach dem schwierigsten Pfad geprüft werden, nicht nach dem geradlinigen.**

### Was zu tun ist

**Ein Fix deckt BUG-4-33 und BUG-4-35 gemeinsam ab:** ein zeitgesteuerter Aufräum-Lauf für Spuren ohne zugehöriges Konto — verwaiste Konto-Schlüssel in `public.auth_throttle` **und** `user_deleted`-Zeilen in `auth.audit_log_entries`. Er gehört auf dieselbe `pg_cron`-Liste wie T36/T37 und ist damit ohnehin schon eine offene Deploy-Aufgabe. Ein Trigger ist der falsche Ort: Er ist genau das Werkzeug, das hier zu früh feuert.

**Nebenbefund, gleich mit erledigt:** Der Testaufbau in `tests/PROJ-4-deletion-cascade.spec.ts` räumte bisher nur seinen Trigger ab, nicht die Funktion `public.proj4_fail_delete` — im Lauf 5 als Low vermerkt. Jetzt behoben, mit Gegenprobe (Funktion vor dem Lauf entfernt, nach dem Lauf nicht wieder da, 6/6 grün).

### Zustand der Entwicklungsdatenbank nach dem Aufräumen

554 Testkonten gelöscht; `profiles`, `runs`, `active_runs` und `auth.flow_state` sind über die Kaskade auf **0** gegangen — der Löschweg funktioniert also auch im Massenlauf. Stehen geblieben waren **158 verwaiste Konto-Schlüssel** in `public.auth_throttle` (BUG-4-33; im Lauf 5 waren es 66) und die 21 Protokollzeilen aus diesem Nachtrag. Beides wurde beim Abschluss von Hand geleert.
