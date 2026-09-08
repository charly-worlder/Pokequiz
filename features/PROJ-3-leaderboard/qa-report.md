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
