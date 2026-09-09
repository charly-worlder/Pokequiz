# QA-Bericht — PROJ-3 Weltrangliste

## QA-Lauf 1 — 2026-09-08, Branch `feat/PROJ-3-leaderboard`

**Prüfstand:** Der Branch nach dem Merge von `main` (Kopfzeilen-Fix aus PROJ-2) und dem Spaltenüberschrift-Fix. `LEADERBOARD_PAGE_EXISTS` steht hier auf `true`, die Shell trägt also drei Bedienelemente.

**Aufbau.** Drei `qa-engineer`-Bahnen parallel, disjunkte Umfänge, **keine kannte den Bau**: Bahn 1 = Schritt 2 (Acceptance, AC-1…24 / EC-1…9), Bahn 2 = Schritt 3 (Security Red Team), Bahn 3 = Schritt 4+5 (Regression und Suiten). Jede bekam nur die Feature-Mappe, die ID-Liste, ihren Schritt aus `SKILL.md`, `.ai-eng-kit` und die Adresse der laufenden App. Zusammenführung, Bewertung und dieser Bericht: der Owner.

---

## Urteil

**NICHT PRODUKTIONSREIF — ein gebrochenes Acceptance-Kriterium.** Kein Critical, kein High. Aber **AC-24 ist gebrochen**, und es ist ein Datenschutz-Kriterium (Art. 13 DSGVO). Der Status bleibt deshalb auf **In Review**.

Nach der reinen Fehlerschwere-Regel wäre der Lauf „READY" — es gibt weder Critical noch High. Diese Regel misst aber gefundene **Fehler**, nicht erfüllte **Kriterien**, und hier ist eines nachweislich nicht erfüllt. Der Fix ist klein (ein Absatz, der an der falschen Stelle steht); ihn als akzeptiertes Restrisiko zu dokumentieren wäre teurer als ihn zu beheben.

---

## Die zwei Befunde, die zwei Bahnen unabhängig voneinander fanden

Bahn 1 (Acceptance) und Bahn 2 (Security) haben denselben Mangel getrennt entdeckt. Das ist der stärkste Beleg, den dieser Aufbau liefern kann.

### BUG-A — AC-24 gebrochen — **Medium**

**Der Datenschutz-Satz fehlt im Leerzustand und im Fehlerzustand.** `src/components/leaderboard/leaderboard-card.tsx` kehrt in **Zeile 37** (Fehler) und **Zeile 46** (leere Liste) zurück; der Absatz mit dem Satz steht erst in **Zeile 81**, hinter beiden Abbrüchen. Vom Owner nachgeprüft.

Gemessen: Zustand mit Zeilen → Satz vorhanden. Leerzustand → **nicht vorhanden**. Fehlerzustand → **nicht vorhanden**.

**Warum das mehr ist als eine Formalie:** Der Leerzustand ist genau der Bildschirm, den ein **neuer** Spieler zuerst sieht — der, dessen Trainername gleich veröffentlicht wird. Der Hinweis erreicht damit jeden außer dem, für den er gedacht ist. AC-24 leitet sich aus Art. 13 DSGVO ab.

**Zusätzlich weicht der Bau vom Entwurf ab:** `design.md` → Component Structure zeigt den Satz als Geschwister der Karte auf **Seitenebene** („Datenschutz-Satz in gedämpfter Schrift", unter der Karte). Gebaut ist er *innerhalb* der Karte und nur in einem von vier Zuständen. Hätte er dort gestanden, wo der Entwurf ihn vorsah, wäre der Fehler nicht entstanden.

*Repro:* Als angemeldeter Nutzer `/leaderboard` aufrufen, während kein Lauf mit Serie ≥ 1 existiert.

### N1 — Jede angemeldete Sitzung kann die vollständige Kontenliste samt Konto-Kennung abrufen — **Medium**

Die Policy `profiles_select_authenticated ... using (true)` (`supabase/migrations/0001_profiles.sql:18-21`, PROJ-1) gibt `authenticated` **alle Spalten aller Zeilen** frei — auch `id` (die Auth-Konto-UUID) und `created_at`.

```
GET /rest/v1/profiles?select=*   mit gewöhnlichem Nutzer-JWT
→ 200, [{"id":"c7bcd701-…","trainer_name":"Alpha","created_at":"…"}, …]
Prefer: count=exact → 1024 Zeilen · gewertete Spieler zum selben Zeitpunkt: 234
```

**Kein Bruch von AC-19 oder AC-20 im Wortlaut** — fremde Rundenhistorien bleiben unzugänglich, und die Ranglisten-Zeilen selbst enthalten nachweislich keine Kennung. Aber es untergräbt die **Begründung**, mit der `design.md` die `is_self`-Konstruktion rechtfertigt: „Für einen Vergleich müsste die Kennung mitgeliefert werden." Sie ist eine HTTP-Anfrage später trotzdem da — für **jedes** Konto, auch für die rund 790, die nie in der Wertung stehen und deren Existenz die Rangliste gerade nicht preisgeben soll. Ein Datensparsamkeits-Befund (Art. 5(1)(c)) an der Datenschicht, die dieses Feature erstmals für Fremddaten öffnet.

**Gehört PROJ-1** (dort liegt die Policy), **fällt aber PROJ-3 zur Last**, weil dieses Feature die Offenlegung überhaupt einführt.

---

## Ergebnis nach Kriterien

**Bestanden, mit Laufzeit-Beleg:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 (Inhalt), AC-8, AC-9, AC-10 (Markup), AC-11, AC-12, AC-13, AC-14, AC-15, AC-17, AC-19, AC-20, AC-21, AC-22, AC-23 — sowie EC-1, EC-3, EC-4, EC-5, EC-6, EC-7, EC-8.

Hervorzuheben, weil gegen gesäte Daten geprüft statt nur gelesen:
- **AC-3 / EC-1:** Alle vier Sortierstufen greifen. Drei Spieler mit identischer Serie, Dauer **und** `created_at` auf die Mikrosekunde → fünf Aufrufe, jedes Mal dieselbe Reihenfolge (vierte Stufe `runs.id`).
- **EC-5:** Ein Lauf, der den eigenen Bestwert exakt einstellt, verdrängt ihn nicht — der frühere bleibt maßgeblich, gegengeprüft mit einem dritten Spieler dazwischen.
- **EC-7:** 801 Läufe für einen Spieler → genau eine Zeile, `EXPLAIN ANALYZE` **0,847 ms**, Seitenladezeit 0,18–0,22 s gegen eine Zusage von 1 s.
- **AC-22 / EC-4:** Konto von Platz 1 gelöscht → Spieler weg, alle rücken auf, keine Fehlermeldung, keine Leerzeile.
- **EC-6:** Fehlerzustand erzwungen (Funktion kurzzeitig umbenannt) → HTTP 200, `role="alert"` **innerhalb** der Karte, Kopf- und Fußzeile stehen, **null** Trainernamen ausgeliefert.
- **AC-19:** Die Ranglisten-Funktion ist mit echtem Nutzer-JWT **403**, anonym **401**; `\df+` zeigt `postgres=X service_role=X`.
- **AC-21:** `information_schema.tables` im Schema `public` → genau vier Tabellen, alle aus PROJ-1/PROJ-2. `pg_matviews` leer. Migration `0015` enthält genau **eine** `create`-Anweisung.

**Gebrochen:** AC-24 (BUG-A, Medium) · AC-16 Satz 2 (BUG-B, Low) · EC-2 im Wortlaut (BUG-C, Low).

**`[!] NICHT GEPRÜFT:** AC-18 und EC-9 (Responsive-Verhalten unter 640 px, Kürzung eines 20-Zeichen-Namens) — kein Browser in `/qa`. Der Mechanismus ist im ausgelieferten Markup belegt (Raster, feste Zahlenspalten, `truncate` + `title` an jeder Namenszelle, kein `overflow-x`), und `tests/PROJ-3-leaderboard-narrow.spec.ts` deckt es ab — Bahn 1 hat diese Suite nicht ausgeführt, Bahn 3 schon (grün in drei Engines). · AC-10 und AC-16 in ihrem sichtbaren Anteil · Verhalten des Produktions-Builds · Security-Header gegen eine Live-URL (`deploy: null`).

---

## Weitere Befunde

| # | Kriterium | Schwere | Kurzfassung |
|---|---|---|---|
| BUG-A | AC-24 | **Medium** | Datenschutz-Satz fehlt im Leer- und Fehlerzustand (oben) |
| N1 | — | **Medium** | Vollständige Kontenliste samt UUID für jede Sitzung abrufbar (oben) |
| BUG-B | AC-16 | Low | Der Ladezustand springt beim Eintreffen der Daten |
| BUG-C | EC-2 | Low | Wortlaut „noch 1 **Platz** bis Top 5" statt „noch 1 bis Top 5" |
| N3 | — | Low | `Cache-Control` ohne `private` auf einer personalisierten Antwort |
| N6 | — | Low | Keine Drosselung auf einer Seite, deren Abfrage über jede gewertete Runde wandert |
| BUG-D | — | Low | `admin.ts`-Kommentar überholt — T2 abgehakt, Datei nie geändert |

**BUG-B (Low).** Drei strukturelle Unterschiede zwischen `loading.tsx` und der fertigen Seite: Der Untertitel-Absatz fehlt im Ladezustand (`page.tsx` hat einen `<p>`, `loading.tsx` **null** — vom Owner nachgezählt), die Spaltenüberschriften-Zeile fehlt, und der AC-24-Absatz hat keine Entsprechung. Damit springt das Layout beim Eintreffen der Daten — genau das, was AC-16 Satz 2 ausschließt. **Mein eigener Kommentar in `loading.tsx:9` behauptet „mit demselben Seitenkopf wie die fertige Seite"** und ist damit nachweislich falsch. Die Pixel-Höhe ist ohne Browser nicht messbar, die Unterschiede selbst sind es.

**BUG-C (Low).** Gerendert wird „Platz 6 — noch 1 **Platz** bis Top 5", der Vertrag zitiert „Platz N — noch X bis Top 5". Inhaltlich richtig, sprachlich sogar runder — aber nicht der Wortlaut. Entweder `/refine PROJ-3` auf den Text oder das Einheitenwort entfernen.

**BUG-D (Low).** `tasks.md` → T2 verlangt ausdrücklich, den überholten Kommentar in `src/lib/supabase/admin.ts` nachzuziehen („Einzige Aufgabe ist der Fehlversuchszähler" — tatsächlich nutzen ihn vier Module). T2 ist abgehakt, `git diff main...HEAD` listet die Datei **nicht**. Ein Task, dessen erklärter Umfang nicht vollständig erledigt wurde.

---

## Security (Bahn 2)

**Kein Critical, kein High.** Geprüft wurde gegen die laufende App und den lokalen Stack, inklusive Umgehungsversuchen, die über die üblichen hinausgehen:

**Gehalten:** Authentifizierungs-Umgehung (gefälschte Signatur, **Sub-Tausch im Cookie**, abgelaufener Token, gelöschtes Konto → jeweils 307 auf `/login`; die Sitzung wird beim Auth-Server geprüft, nicht lokal) · **CVE-2025-29927-Klasse** (`x-middleware-subrequest` in sechs Varianten → alle 307) · Pfadvarianten (`//leaderboard`, `%2f`, `.png`, Groß-/Kleinschreibung → kein Weg an der Seite vorbei) · RSC-/Prefetch-Weg (kein Trainername im Flight-Payload ohne Sitzung) · kein Open Redirect trotz `Host`- und `X-Forwarded-Host`-Injektion · Autorisierung (fremde Runden auch über PostgREST-Einbettungen leer) · Schreibpfade (`INSERT`/`PATCH`/`DELETE` auf `runs`, `PATCH` auf `profiles.trainer_name` → je 403) · Injektion (der Check-Constraint auf `^[A-Za-z0-9_]{3,20}$` schließt gespeichertes XSS an der Quelle aus) · keine Geheimnisse in 3,79 MB Client-Chunks.

**PROJ-3 nimmt keinerlei Eingabe entgegen** — kein Formular, keine Server Action, kein Query-Parameter. Der `X-Forwarded-Host`-Vektor (BUG-18) ist hier deshalb **nicht anwendbar**: Er braucht eine Server Action.

**Bestätigt, bereits in `INDEX.md` geführt:** BUG-12/116 (Security-Header fehlen) · BUG-105 (`X-Powered-By`, Serverpfade im Dev-Build) · BUG-132 (`auth_throttle`, gegengeprüft: weiterhin nicht ausnutzbar).

**N7 — die Entscheidung vom 2026-09-08 hält.** Massen-Registrierung geht am App-Zähler vorbei: 15 Konten in 3 s direkt gegen den Supabase-Endpunkt mit dem öffentlichen Schlüssel, ohne die App zu berühren — schärfer als BUG-61 es beschreibt, weil dieser Weg nicht einmal den `x-forwarded-for`-Trick braucht. **Die Rangliste bleibt davon unberührt:** Ein Lauf entsteht nur durch echtes Spielen (`INSERT runs` als `authenticated` → 403, gemessen). Die Streichung der Kontoverifizierung trägt also — der Angriff, gegen den sie geschützt hätte, ist an der Stelle geschlossen, an der er entsteht.

---

## Regression (Bahn 3)

**Keine Regression.** `npm test` **281/281** · `npm run lint` Exit 0 · `npx tsc --noEmit` Exit 0 · Playwright **147/147** über Chromium, Firefox und Mobile Safari.

Ein Fehlschlag im ersten Playwright-Lauf (`PROJ-1-throttle.spec.ts:123`, Mobile Safari, Zeitüberschreitung im Registrierungs-Aufbau). **Einstufung des Owners: Flake, kein High.** Belege: derselbe Test isoliert in derselben Engine **3/3 grün**, voller zweiter Lauf **147/147 grün**, Fehler in `tests/helpers.ts:34` (Testaufbau, nicht Zusicherung), und dieser Branch fasst den Drosselungs-Pfad nirgends an (`git diff main...HEAD --stat` listet weder `src/lib/auth/*` noch die Drosselungs-Migrationen). Es ist exakt die Kontentionsklasse, die `playwright.config.ts:4-19` selbst dokumentiert.

**Unabhängig bestätigt:** Der 320-px-Kopfzeilen-Fix trägt im Zusammenspiel — kein waagerechtes Scrollen auf `/` und `/leaderboard` bei 320/360/375/768/1440 mit **drei** Bedienelementen. Und AC-11 zur Laufzeit: eine gerade beendete Runde stand sofort in der Liste (Platz 163, Serie 2, `00:01,7`, passend zur DB-Zeile).

**Kein Test entfernt oder stillgelegt:** `git diff --diff-filter=D` leer, kein `.skip`/`.only`/`fixme` in `src/` oder `tests/`. Die beiden PROJ-2-Tests wurden vom negativen auf den positiven Zweig **umgedreht**, nicht abgeschwächt.

**Datenschicht ohne Nebenwirkung:** `0015` enthält genau zwei Rechte-Anweisungen, beide auf die eigene Funktion — kein `grant`/`revoke`/`alter table` auf `runs`, `profiles`, `active_runs` oder `auth_throttle`.

---

## E2E-Tests

Vorhandene Suite als Regression gelaufen (147/147). Neue End-to-End-Tests schreibt `/e2e-tests`.

## Unit-Tests dieses Laufs

Keine geschrieben. Die Logik des Features liegt in der Datenbankfunktion (gegen gesäte Daten geprüft) und in `format.ts` (bereits mit Grenzwerttests versehen, von Bahn 1 unabhängig nachgerechnet: 0, 12345, 12350, 59950, 83421, 6000000 — Übertrag korrekt). Es gibt keine ungeprüfte isolierte Logik.

---

## Was als Nächstes zu tun ist

**Zuerst BUG-A.** Ein Absatz an die richtige Stelle — auf Seitenebene, wie `design.md` es ohnehin vorsah, statt in einen von vier Kartenzuständen. Damit ist AC-24 in allen Zuständen erfüllt.

**Dann eine Entscheidung zu N1.** Die Policy gehört PROJ-1. Zwei Wege: die Spaltenauswahl einschränken (eine Sicht oder eine engere Policy, die nur `trainer_name` herausgibt) oder den Befund als Restrisiko in den Vertrag aufnehmen. Das ist eine Produktentscheidung, keine Bauaufgabe.

**BUG-B, BUG-C und BUG-D** sind klein und können mitlaufen. BUG-C ist eine Vertragsfrage: entweder der Text folgt dem Wortlaut, oder der Wortlaut folgt dem Text.

---

## Fix-Lauf zum QA-Lauf 1 — 2026-09-08

Alle fünf Befunde behoben. Jeder Fix ist gegen den wiederhergestellten Fehler **rot geprüft**.

| # | Kriterium | Status | Nachweis |
|---|---|---|---|
| BUG-A | AC-24 | ✅ behoben | Satz auf Seitenebene, an keine Bedingung geknüpft |
| N1 | — | ✅ behoben | Migration `0016`: eigene Zeile, zwei Spalten |
| BUG-B | AC-16 | ✅ behoben | Ladezustand strukturgleich zur fertigen Seite |
| BUG-C | EC-2 | ✅ behoben | Wortlaut folgt jetzt dem Vertrag |
| BUG-D | — | ✅ behoben | `admin.ts` nennt alle vier Aufrufer |

**BUG-A.** Der Datenschutz-Satz ist eine eigene Komponente (`privacy-note.tsx`) und steht in `page.tsx` **auf Seitenebene** — genau dort, wo `design.md` ihn von Anfang an vorsah. Damit hängt er an keiner Bedingung mehr; der Fehler kann an dieser Stelle nicht wiederkehren. `loading.tsx` rendert dieselbe Komponente (statischer Text, braucht keine Daten), was zugleich BUG-B mitbedient.
*Gepinnt* in `src/app/leaderboard/page.test.tsx` für **alle drei** Zustände (mit Zeilen, leer, Fehler) — die Ebene ist bewusst gewählt: Ein Browser-Test müsste den Leerzustand herstellen, und der hängt am globalen Datenbestand, den parallele Tests mitbenutzen.
*Rot geprüft:* Komponente aus `page.tsx` entfernt → **3 von 3** Zuständen rot, zurückgedreht → grün.

**N1.** Migration `0016_profiles_own_row_only.sql`, zwei unabhängige Schichten:
- **Zeilen:** `profiles_select_own ... using ((select auth.uid()) = id)` statt `using (true)`.
- **Spalten:** `grant select (id, trainer_name)` statt `grant select` auf die ganze Tabelle. `created_at` wird von keinem Anwendungscode gelesen (geprüft) und ist damit nicht mehr freigegeben; `id` bleibt lesbar, weil es in der `where`-Bedingung der Kopfzeile steht und ein Spaltenrecht in Postgres für **jede** Erwähnung gilt, nicht nur für die Ausgabeliste.

Vor dem Schnitt geprüft, wer `profiles` über eine **Nutzersitzung** liest: genau eine Stelle — `site-header.tsx:29`, eigene Zeile, Spalte `trainer_name`. Alles andere (`leaderboard_page`, `is_trainer_name_taken`, `handle_new_user`) ist `security definer` und hängt nicht an diesen Rechten.
*Gepinnt* in `tests/PROJ-3-leaderboard-db-guard.spec.ts` — inklusive **Gegenprobe, dass die Verengung nicht zu weit geht**: Die Abfrage der Kopfzeile muss weiterhin gelingen.
*Rot geprüft:* alte Policy zur Laufzeit wiederhergestellt → „Die Sitzung bekam **13** Profilzeilen — es darf ausschließlich die eigene sein", zurückgedreht → 9/9 grün.

**BUG-B.** Die drei Unterschiede zwischen Ladezustand und fertiger Seite waren **sämtlich statischer Text** und hatten nie einen Grund zu fehlen: Untertitel, Spaltenüberschriften-Zeile, Datenschutz-Satz. Alle drei stehen jetzt in `loading.tsx` bzw. im Skelett, und zwar als **dieselben Komponenten** wie in `page.tsx` — eine Kopie wäre die nächste Stelle, an der die beiden auseinanderlaufen. Skelettflächen bleiben nur dort, wo tatsächlich Daten erwartet werden. Der „Runde starten"-Knopf hält seine Höhe als stummer Platzhalter (`aria-hidden`), statt beim Eintreffen der Daten aufzutauchen.
*Nicht gepinnt:* Die tatsächliche Sprunghöhe in Pixeln braucht einen Browser und gehört zu `/e2e-tests`.

**BUG-C.** „noch 1 **Platz** bis Top 5" → „noch 1 bis Top 5". Von den beiden Auflösungen die billigere: dem Vertrag folgen, statt ihn für ein Füllwort zu ändern.

**BUG-D.** `admin.ts` zählt jetzt alle vier Aufrufer mit ihrem jeweiligen Grund auf und nennt den Anlass der Korrektur.

### Was der Fix-Lauf nicht behandelt hat

**N3, N6 und der `robots.txt`-Hinweis bleiben offen** — alle Low und alle beim Deploy zu entscheiden: `Cache-Control` ohne `private` (vor einem CDN mitzusetzen), keine Drosselung auf `/leaderboard`, und dass ein Crawler auf `/robots.txt` eine Umleitung statt einer Robots-Datei bekommt.

**Prüfungen nach den Fixes:** `npm test` **284/284** (drei neue) · `npm run lint` Exit 0 · `npm run build` Exit 0 · Playwright **150/150** über drei Engines (einer neu) · Datenbank aus allen 16 Migrationen neu aufgebaut.

---

## QA-Lauf 2 — 2026-09-08, Branch `feat/PROJ-3-leaderboard`

**Prüfstand:** nach dem Fix-Lauf zu QA-Lauf 1. Wieder drei `qa-engineer`-Bahnen parallel, disjunkte Umfänge, **keine kannte den Bau oder die Fixes**. Die Aufträge waren gegenüber Lauf 1 geschärft: Bahn 1 ausdrücklich auf AC-24 in **jedem** Zustand, AC-16 als **strukturellen** Vergleich, AC-4 mit aktiver Suche nach einer zweiten Rangberechnung und den **Wortlaut** von EC-2; Bahn 2 auf die Frage, ob eine gewöhnliche Sitzung über die Datenschnittstelle an Zeilen **oder Spalten** kommt, die sie nicht braucht; Bahn 3 darauf, ob eine Rechteverengung zu weit geht.

---

## Urteil

**PRODUKTIONSREIF — kein Critical, kein High, kein Medium.** Ein Low bleibt offen und ist bewusst getragen. Status: **Approved**.

**Und das ist eine Aussage über gefundene Fehler, nicht über Abdeckung.** AC-18 und EC-9 — Responsive-Verhalten unter 640 px und die Kürzung eines 20-Zeichen-Namens — sind **nicht geprüft**, weil `/qa` keinen Browser hat. `tests/PROJ-3-leaderboard-narrow.spec.ts` misst die Geometrie in drei Engines, aber ob die Seite auf einem echten Gerät gut aussieht, hat niemand gesehen. Das schließt `/e2e-tests`, nicht dieser Lauf.

---

## Alle fünf Befunde aus Lauf 1 sind unabhängig als behoben bestätigt

| # | Kriterium | Bestätigt durch | Beleg |
|---|---|---|---|
| BUG-A | AC-24 | Bahn 1 | Satz belegt in **vier** Zuständen: mit Zeilen, im Leerzustand (0 gewertete Läufe), im Fehlerzustand (Funktionsrecht entzogen) und im Ladezustand |
| N1 | — | Bahn 1 + 2 + 3 | `select * from profiles` als `authenticated` → `42501`; fremde Zeile gezielt abgefragt → `[]` |
| BUG-B | AC-16 | Bahn 1 | Struktur Knoten für Knoten verglichen: gleicher Container, gleicher Seitenkopf, gleiche Karte, gleiche Spaltenkopfzeile, identisches Raster |
| BUG-C | EC-2 | Bahn 1 | „Platz 6 — noch 1 bis Top 5" — zeichengenau der zitierte Text |
| BUG-D | — | Owner | `admin.ts` nennt alle vier Aufrufer |

**Die Verengung aus `0016` geht nicht zu weit** — von Bahn 3 an der laufenden App durchgespielt: Registrierung, Anmeldung mit falschem und richtigem Passwort, Abmeldung, belegter Trainername, Kopfzeile mit Trainernamen, vollständige Quiz-Runde bis zur gespeicherten Zeile (`runs id=176, streak=2`). Bahn 3 hat unabhängig nachgezählt, dass es genau **eine** Lesestelle über eine Nutzersitzung gibt.

---

## Der eine neue Befund — und er stammt aus dem Fix von BUG-B

**Der Datenschutz-Satz stand kurzzeitig doppelt im DOM. Behoben im selben Lauf.**

Der BUG-B-Fix ließ `loading.tsx` und `page.tsx` **dieselbe Komponente** rendern. Im Streaming-Fenster zwischen fertigem HTML und Hydration stehen Fallback und Inhalt aber gleichzeitig im DOM. Bahn 3 hat das nicht vermutet, sondern gemessen: **3 von 10 Aufrufen** mit zwei Knoten direkt nach `load`, aufgelöst nach `networkidle`. Der Test für AC-24 wurde dadurch rot — in **allen drei** Läufen, also kein Maschinenlast-Flake.

**Die Ursache war ein Denkfehler beim Fix von BUG-B:** „braucht keine Daten" wurde mit „soll doppelt im DOM stehen" gleichgesetzt. Richtig ist: Ein Ladezustand hält **Höhen**, er wiederholt keinen fertigen Text. `loading.tsx` zeigt jetzt höhengleiche Platzhalter für Untertitel, Datenschutz-Satz und Knopf; echter Text bleibt nur die Überschrift, die zum Seitenrahmen gehört und dort schon immer stand.

*Nachgemessen nach dem Fix:* **10 von 10** Aufrufen zeigen genau einen Knoten.
*Test verschärft:* Die alte Zusage deckte den Fehler nur in etwa 3 von 10 Aufrufen auf — ein Gate, das je nach Zeitpunkt rot wird, ist kein Gate. Der Test zählt jetzt über **fünf** Aufrufe hintereinander.
*Rot geprüft:* Text im Ladezustand wiederhergestellt → „Aufruf 5: Der Datenschutz-Satz steht 2× im DOM", zurückgedreht → grün.

---

## Offen, bewusst getragen

**AC-16 — ein Skelett kann nicht alle vier Ausgänge gleichzeitig treffen. Low.**
Bahn 1 hat zwei verbliebene Strukturunterschiede benannt: Der Absatz „Platz N — noch X bis Top 5" hat keinen Platzhalter, und der Ladezustand zeigt **immer** die abgesetzte sechste Zeile — steht der Betrachter in der Top-5 oder ist niemand gewertet, fällt der Block beim Eintreffen der Daten weg. Das ist keine Nachlässigkeit, sondern die Grenze der Konstruktion: Der Ladezustand kennt das Ergebnis nicht und kann sich nicht auf vier verschiedene Ausgänge gleichzeitig einstellen. Die substanzielle Forderung von AC-16 ist erfüllt (Skelettzeilen in Zeilenhöhe, kein alleinstehender Spinner, identisches Raster); der Pixel-Versatz ist ohne Browser nicht gemessen.

**Ein Prüf-Rückstand in der lokalen Datenbank, inzwischen entfernt.** Bahn 2 fand die Tabelle `qa3_runs_backup` — RLS aus, volle Rechte für `anon`, vollständige Rundenhistorie samt Konto-Kennung. Sie steht in **keiner** Migration und war das Sicherungs-Artefakt der parallel laufenden Bahn 1, die den Bestand für die Leerzustands-Prüfung räumen musste; Bahn 1 hat sie am Ende ihres Laufs selbst gelöscht (nachgeprüft: die Datenbank enthält wieder genau die vier Migrations-Tabellen). **Kein Produktfehler** — ein `supabase db push` überträgt nichts davon.

**Der systemische Punkt dahinter bleibt und ist notiert:** Jede Tabelle, die im Schema `public` ohne ausdrückliches `revoke` entsteht, ist über die Datenschnittstelle für jeden les- und schreibbar (Postgres-Standardrecht). Dieselbe Klasse wie BUG-131 und BUG-132. Die Projektkonvention „jede neue Tabelle bekommt RLS, Policy und expliziten Rechteentzug" ist damit tragend, nicht kosmetisch.

---

## Ergebnis nach Kriterien

**Bestanden mit Laufzeit-Beleg: AC-1 bis AC-17 und AC-19 bis AC-24, sowie EC-1 bis EC-8.**

Hervorzuheben, weil die Aufbauten unterscheidungskräftig waren statt bloß bestätigend:
- **EC-1:** Drei Spieler mit Serie 26, Dauer 40000 **und identischem `created_at` auf die Mikrosekunde** — acht Aufrufe, jedes Mal dieselbe Reihenfolge. Ohne die vierte Sortierstufe wäre der Fall unentschieden.
- **EC-5:** Zwei exakt gleiche Läufe eines Spielers, dazwischen ein gleichwertiger eines anderen. Ergebnis: eine Zeile, und sie steht **über** dem anderen — hätte die Funktion den späteren Lauf genommen, stünde er unten. Der Aufbau kann zwischen richtig und falsch unterscheiden.
- **AC-4:** Aktiv nach einer zweiten Rangberechnung gesucht (`row_number|rank()|.sort(` über `src/` und `supabase/migrations/`) → **genau eine** Fundstelle.
- **AC-22:** Konto von Platz 2 gelöscht → alle rücken auf, inklusive korrigiertem „noch 1" in der eigenen Zeile.
- **EC-6:** Fehler durch Rechteentzug erzwungen → HTTP 200, Hinweis **innerhalb** der Karte, Rahmen steht.
- **AC-20:** HTML **und** RSC-Payload (27.740 B) durchsucht — 0 UUIDs, 0 E-Mail-Muster, 0 `profile_id`.
- **EC-7:** 601 Läufe eines Spielers → eine Zeile, Seitenzeit 0,22–0,54 s.

**`[!] NICHT GEPRÜFT:** AC-18, EC-9 (kein Browser — gehört zu `/e2e-tests`) · der Beobachtungsteil von AC-12 (dass sich die Liste im offenen Browser nicht umsortiert; Quelltext und HTML belegen die Abwesenheit jedes Mechanismus) · der Pixel-Versatz zu AC-16 · Verhalten des Produktions-Builds bei den Laufzeitmessungen · Security-Header gegen eine Live-URL (`deploy: null`).

---

## Security (Bahn 2)

**Kein Bruch am Produkt.** Zugangsschutz mit Pfad-Tricks, Müll-Cookie und fremd platziertem JWT geprüft — durchgehend `307 → /login`, weil die Sitzung beim Auth-Server geprüft wird. Autorisierung: fremde Profilzeile `[]`, fremde Runden `[]`, `leaderboard_page` für `authenticated` 403 und für `anon` 401. Injektion: `p_profile` ist `uuid`-typisiert (`22P02`), der Trainername durch Check-Constraint auf `^[A-Za-z0-9_]{3,20}$` begrenzt — Stored-XSS an der Quelle ausgeschlossen. Keine Geheimnisse in den ausgelieferten Chunks.

**Bestätigt und bereits in `INDEX.md` geführt:** BUG-12 (Security-Header fehlen), BUG-103 (`X-Powered-By`), BUG-132. **Nicht anwendbar auf PROJ-3:** BUG-18 — das Feature hat keine Server Action und keinen Schreibpfad.

**`[!] NICHT GEPRÜFT (Security):** Drosselung auf `/leaderboard` (nicht implementiert; gewöhnlicher auth-gesperrter GET, laut Skill kein Bug, aber kein Pass) · Live-URL-Header.

---

## Regression (Bahn 3)

`npm test` **284/284** · `npm run lint` Exit 0 · Playwright **150/150** über drei Engines, in **zwei** aufeinanderfolgenden Vollläufen nach dem Fix · `npm run build` Exit 0.

Kein Regress an PROJ-1 oder PROJ-2. Genau eine Kopfzeile und eine Fußzeile auf `/leaderboard`, keine zweite Navigation. Migrationsstand `0016`, lokale Datenbank deckungsgleich mit dem Repo.

## E2E-Tests

**Geschrieben am 2026-09-09 mit `/e2e-tests`. Vier kritische Journeys, alle grün — und alle rot gegengeprüft.**

Die Auswahl folgt der Testpyramide: nicht ein Test je Kriterium, sondern die Reisen, deren stilles Brechen das Produkt kostet. Die Riegel (Zugangsschutz, Datenschicht, Spaltengeometrie) lagen bereits als Playwright-Dateien aus Bau und QA vor; **was fehlte, war jede einzelne echte Nutzerreise** — kein Test hat je eine Runde gespielt und danach in der Rangliste nachgesehen.

| Journey | Datei | Deckt | Ergebnis |
|---|---|---|---|
| **J1 — Von der Runde in die Rangliste** | `tests/PROJ-3-journey-run-to-leaderboard.spec.ts` | AC-1, AC-10, AC-11, AC-14, AC-15 | ✅ 3/3 Engines |
| **J2 — Der neue Spieler ohne gewerteten Lauf** | `tests/PROJ-3-journey-new-player.spec.ts` | AC-9, AC-14, AC-15 | ✅ 3/3 Engines |
| **J3 — Außerhalb der Top-5** | `tests/PROJ-3-journey-below-top-five.spec.ts` | AC-4, AC-6, AC-7, AC-10, EC-2 | ✅ 3/3 Engines |
| **J4 — 320 px mit 20-Zeichen-Name** | `tests/PROJ-3-journey-narrow-name.spec.ts` | **AC-18, EC-9** | ✅ 3/3 Engines |

### Die Lücke aus beiden QA-Läufen ist geschlossen

**AC-18 und EC-9 sind erstmals in einem Browser belegt.** Beide Läufe führten sie als `[!] NICHT GEPRÜFT` und verwiesen hierher. J4 registriert einen Spieler mit einem Namen, der die erlaubten 20 Zeichen voll ausschöpft (im Test zugesichert — ein kürzerer Name prüfte den Fall aus EC-9 gar nicht mehr), sät ihm einen gewerteten Lauf und liest die Zeile bei 320 px:

- Der Name kürzt **nachweislich** — gemessen als `scrollWidth > clientWidth` an der Namenszelle, nicht am Vorhandensein einer CSS-Klasse. Der vollständige Name hängt als `title` daran.
- Platz, Serie und Zeit liegen **vollständig** im Bild (Rechteck-Messung gegen die 320 px), und ihre Werte stehen inhaltlich noch da — eine Spalte, die im Bild liegt, aber leer ist, wäre von einer reinen Geometrie-Messung nicht zu unterscheiden.
- Die Seite lässt sich nicht waagerecht scrollen (`document.documentElement.scrollWidth`).

### Jede Journey ist einmal absichtlich gebrochen worden

Vier grüne Tests im ersten Anlauf sind der Zustand, dem man nicht trauen darf. Jeder Bruch wurde einzeln eingebaut, gemessen und zurückgedreht; der Baum war danach wieder sauber (`git status` zeigte ausschließlich die vier neuen Dateien).

| Bruch | Wirkung | Meldung des Tests |
|---|---|---|
| J1 · `queries.ts` gibt die eigene Zeile nicht mehr heraus | AC-11 verletzt: der gerade gespielte Lauf fehlt | „Die eigene Zeile ist nicht auffindbar — weder in der Top-5 noch darunter" (Zeile 64) |
| J2 · Hinweistext auf „eine Runde spielen" geändert | AC-9 verletzt: die Bedingung wäre falsch benannt | Treffer auf `/eine Frage richtig/` fehlt (Zeile 46) |
| J3 · Wortlaut „noch X **Plätze** bis Top 5" (= BUG-C wiederhergestellt) | EC-2 im Wortlaut verletzt | „Der Satz ‚Platz N — noch X bis Top 5' steht nicht in dieser Form da" (Zeile 135) |
| J3 · `ranksToTopFive` rechnet `rank` statt `rank − 5` | EC-2 in der Rechnung verletzt | „Bei Platz 151 müssten 146 Plätze bis Top 5 fehlen, angezeigt sind 151" (Zeile 145) |
| J4 · `truncate` an der Namenszelle entfernt | EC-9 verletzt | „Der 20-Zeichen-Name wird bei 320 px nicht gekürzt — er sprengt seine Spalte" (Zeile 98) |
| J4 · Zeitspalte auf 13 rem verbreitert | AC-18 verletzt | „Die Spalte Zeit endet bei 328 px und ragt damit über die 320 px hinaus" (Zeile 113) |

Jede Meldung nennt den gebrochenen Schritt, keine ist eine Zeitüberschreitung drei Zeilen später.

### Was die Journeys bewusst **nicht** zusichern

**Keine absoluten Plätze.** Die Suite läuft parallel in drei Browser-Projekten gegen **eine** Datenbank, in der die Nachbar-Journeys gleichzeitig Runden schreiben. „Platz 3" wäre eine Aussage über die Nachbartests, nicht über die App. J1 findet die eigene Zeile deshalb über das „Du"-Abzeichen — das sie nach AC-10 in der Top-5 **wie** in der abgesetzten Zeile trägt; J3 sät fünf unschlagbare Läufe (Serie 386) und sichert damit `Platz > 5` zu, prüft aber die **Form** des Satzes und die **Rechnung** `X = N − 5` statt der in EC-2 wörtlich genannten 6. Der Rot-Lauf hat das bestätigt: Der Platz lag bei 151.

**Der Leerzustand aus AC-17** ist keinem Browser-Test zugänglich, weil er am globalen Datenbestand hängt, den parallele Tests mitfüllen. Er ist in `src/app/leaderboard/page.test.tsx` auf Unit-Ebene gepinnt — bewusst dort, wie im Fix-Lauf zu QA-Lauf 1 festgehalten. J2 sichert stattdessen die Aussage zu, die `design.md` **beiden** Trägerkomponenten gemeinsam gibt.

**Der Pixel-Versatz zu AC-16** bleibt ungemessen. Er stand als „gehört zu `/e2e-tests`" im Fix-Lauf, ist aber im QA-Lauf 2 als bewusst getragenes Low eingeordnet worden („ein Skelett kann nicht alle vier Ausgänge gleichzeitig treffen"). Ihn jetzt zu pinnen hieße, eine Zahl festzuschreiben, die der Vertrag gar nicht fordert.

### Prüfungen dieses Laufs

`npx playwright test` **162/162** über Chromium, Firefox und Mobile Safari (vorher 150 — vier Journeys mal drei Engines) · `npm run lint` Exit 0 · `npx tsc --noEmit` Exit 0.

**Keine Regression und kein neuer Befund.** Kein zuvor bestandenes Kriterium ist gebrochen; der Status bleibt **Approved**.

## Unit-Tests dieses Laufs

Keine neuen geschrieben; die Logik liegt in der Datenbankfunktion (gegen gesäte Daten geprüft) und in `format.ts` (Grenzwerte bereits gepinnt, von Bahn 1 unabhängig nachgerechnet). Der verschärfte AC-24-Test ist ein E2E-Test und ersetzt keine Unit-Prüfung.
