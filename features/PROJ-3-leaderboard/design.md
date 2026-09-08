# PROJ-3 — Tech Design

> Der technische Entwurf (das WIE) zur Weltrangliste. Zwei Leser: der Produktverantwortliche, der ihn freigibt, und `/build`, das direkt dagegen baut. Kein Code — aber so genau, dass beim Bauen nichts geraten werden muss.
> Der Vertrag (das WAS) steht in `spec.md`, die Aufgabenliste entsteht mit `/tasks`.

---

## Eine Vertragsstelle wurde während dieses Entwurfs aufgehoben

Die frühere Technical Requirement **„Die Rangliste wertet ausschließlich Läufe verifizierter Konten"** ist am 2026-09-08 mit `/refine PROJ-3` aufgehoben worden; dieses Design baut sie nicht. Grund und vollständige Begründung stehen unten im Decision Log („Keine Kontoverifizierung als Wertungsvoraussetzung") und, als Produktentscheidung, im Decision Log von `spec.md`. Die Kurzfassung: Die Vorgabe entstand aus BUG-19 (ein einziger Aufruf an `saveRun` erzeugte Serie 386), und genau diese Ursache hat `/refine PROJ-2` am 2026-09-06 beseitigt. Der Decision Log von PROJ-2 sagt zu seiner eigenen Umstellung: *„keine Kontoverifizierung hilft dagegen"*.

**Stand jetzt:** Spec und Design sagen dasselbe. Kein AC und kein EC wurde dabei angefasst — keines hat die Verifizierung je erwähnt. Alle 24 AC und 9 EC sind unverändert und vollständig abgedeckt.

**Was offen bleibt und nicht in PROJ-3 lösbar ist:** Gegen ein Skript, das echt spielt und die Bilder erkennt, hat dieses Feature kein Mittel. Siehe Open Questions unten.

---

## Component Structure

```
/leaderboard  (Server Component, nur angemeldet)
|
+-- [ App-Shell aus PROJ-2 — Kopfzeile, Fußzeile, Seitenrahmen ]
|   unverändert übernommen, kein eigener Rahmen (AC-15)
|
+-- Seitentitel „Weltrangliste" im Inhaltsbereich (Seiten-Muster, docs/app-shell.md)
|
+-- LeaderboardCard  (die eine Karte, in der alles passiert)
|   |
|   +-- Zustand A — Es gibt gewertete Läufe
|   |   +-- LeaderboardRow  x 1..5      (Platz · Trainername · Serie · Zeit)
|   |   |     +-- Rang 1: Gold-Akzent
|   |   |     +-- eigene Zeile: hervorgehoben + „Du"-Marker (AC-8, AC-10)
|   |   +-- OwnRankRow                  nur wenn der eigene Platz > 5 ist (AC-7)
|   |   |     „Platz N — noch X bis Top 5", optisch abgesetzt, hervorgehoben
|   |   +-- NoRankedRunHint             nur wenn der Spieler keinen gewerteten Lauf hat (AC-9)
|   |
|   +-- Zustand B — LeaderboardEmpty    niemand ist gewertet (AC-17)
|   |     gedämpftes Ball-Motiv, ein Satz, „Runde starten"
|   |
|   +-- Zustand C — LeaderboardErrorCard  Abfrage fehlgeschlagen (EC-6)
|   |     Text + „Erneut versuchen", INNERHALB der Karte
|   |
|   +-- Zustand D — LeaderboardSkeleton   während die Seite lädt (AC-16)
|         5 Skelettzeilen in Zeilenhöhe + eine abgesetzte Skelettzeile
|
+-- „Runde starten"  — Primär-Button, verlinkt auf `/` (AC-14)
|
+-- Datenschutz-Satz in gedämpfter Schrift (AC-24)
```

**Die vier Zustände schließen sich gegenseitig aus.** Welcher gilt, entscheidet allein das Abfrageergebnis:

| Ergebnis der Abfrage | Zustand |
|---|---|
| Fehler | C — Fehlerkarte |
| Ergebnis liegt noch nicht vor (Seite streamt) | D — Skelett |
| Leere Liste | B — Leerzustand |
| Zeilen vorhanden, eigene Zeile dabei mit Platz ≤ 5 | A, Zeile hervorgehoben, keine Zusatzzeile |
| Zeilen vorhanden, eigene Zeile dabei mit Platz > 5 | A + `OwnRankRow` |
| Zeilen vorhanden, keine eigene Zeile | A + `NoRankedRunHint` |

**Zustand B enthält den Sonderfall von AC-9.** Ist niemand gewertet, ist auch der Betrachter nicht gewertet — AC-17 (Leerzustand) und AC-9 (Hinweis „mindestens eine Frage richtig beantworten") treffen zusammen. Sie werden **nicht** übereinandergestapelt: Der eine Satz des Leerzustands **ist** der Satz aus AC-9, und sein Primär-Button ist das „Runde starten" aus AC-9. Eine Karte, ein Satz, ein Knopf.

### Dateien

| Datei | Zweck |
|---|---|
| `src/app/leaderboard/page.tsx` | Server Component: Sitzung prüfen, Daten holen, Zustand wählen |
| `src/app/leaderboard/loading.tsx` | Skelett für die streamende Seite (AC-16) |
| `src/components/leaderboard/leaderboard-card.tsx` | Die Karte mit Liste, eigener Zeile und Hinweis |
| `src/components/leaderboard/leaderboard-row.tsx` | Eine Zeile der Liste |
| `src/components/leaderboard/own-rank-row.tsx` | Die abgesetzte eigene Zeile mit „noch X bis Top 5" |
| `src/components/leaderboard/leaderboard-empty.tsx` | Leerzustand (AC-17 + AC-9) |
| `src/components/leaderboard/leaderboard-error-card.tsx` | Fehlerkarte; clientseitig, weil „Erneut versuchen" einen Klick braucht (EC-6) |
| `src/components/leaderboard/leaderboard-skeleton.tsx` | Die Skelettzeilen, von `loading.tsx` benutzt |
| `src/lib/leaderboard/queries.ts` | Serverseitiger Datenzugriff, ruft die Datenbankfunktion |
| `src/lib/leaderboard/format.ts` | Zeitformat `mm:ss,s` und der Abstand zur Top-5 |
| `supabase/migrations/0015_leaderboard.sql` | Die Datenbankfunktion samt Rechten |
| `src/lib/site-pages.ts` (Änderung) | `LEADERBOARD_PAGE_EXISTS` auf `true` |

Die letzte Zeile ist kein Nebenschauplatz: Der Zugang zur Bestenliste in der Kopfzeile (PROJ-2, AC-21) und die Aktion „Zur Bestenliste" im Ergebnis-Screen (PROJ-2, AC-7) hängen an genau diesem einen Schalter. Die Datei sagt es selbst: *„PROJ-3 baut `/leaderboard` und setzt `LEADERBOARD_PAGE_EXISTS` auf `true`."* Das ist **keine** Verhaltensänderung an der Shell — die Regel „Link erst, wenn die Zielseite existiert" ist in PROJ-2 festgeschrieben; PROJ-3 erfüllt lediglich ihre Bedingung.

---

## Data Model

**PROJ-3 legt nichts an.** Keine Tabelle, keine Spalte, kein Zwischenspeicher, kein Schnappschuss, keine Zähler (AC-21). Die Rangliste ist eine Abfrage über Daten, die es bereits gibt — so, wie `docs/data-model.md` es festhält.

### Woraus die Rangliste entsteht

```
runs      (PROJ-2)  — abgeschlossene Runden: Serie, Dauer, Zeitpunkt, Zuordnung zum Profil
profiles  (PROJ-1)  — Trainername
```

Gelesen werden genau vier Werte je Runde und einer je Profil. Nichts sonst wird angefasst.

### Was eine Ranglisten-Zeile ist (die Form, die die Datenbank herausgibt)

| Feld | Typ | Bedeutung / Grenzen |
|---|---|---|
| `rank` | Ganzzahl, ≥ 1 | Der Platz. Lückenlos und eindeutig — es gibt keine geteilten Plätze |
| `trainer_name` | Text, 3–20 Zeichen | Aus `profiles`; Format und Eindeutigkeit garantiert PROJ-1 |
| `streak` | Ganzzahl, 1–386 | Die erreichte Serie. Nur Werte ≥ 1 kommen überhaupt vor (AC-5) |
| `duration_ms` | Ganzzahl, ≥ 0 | Die servergemessene Dauer in Millisekunden |
| `is_self` | Wahrheitswert | Gehört diese Zeile dem Aufrufer? |

**Ausdrücklich nicht enthalten: keine Konto-Kennung, keine E-Mail-Adresse, kein Zeitstempel, keine Runden-Kennung** (AC-20). Der Zeitpunkt wirkt nur *innerhalb* der Sortierung und verlässt die Datenbank nie — deshalb kann ihn auch niemand aus der Netzwerkantwort ablesen.

Dass die eigene Zeile über einen Wahrheitswert markiert wird und nicht über einen Kennungs-Vergleich im Browser, ist der Grund, warum AC-20 überhaupt einhaltbar ist: Für einen Vergleich müsste die Kennung mitgeliefert werden.

### Die Sortierregel — eine einzige, vierstufig

Angewendet **zweimal an derselben Stelle** (siehe „Behaviors & Access"), nie zweimal formuliert:

1. **Serie absteigend** — mehr richtige Antworten steht oben.
2. **Dauer aufsteigend** — bei gleicher Serie gewinnt die kürzere Zeit.
3. **Zeitpunkt aufsteigend** — bei gleicher Serie *und* gleicher Dauer steht der früher erreichte Lauf oben (AC-3, EC-1, EC-5).
4. **Laufende Nummer der Runde aufsteigend** — die stille vierte Stufe für den Fall, dass selbst der Zeitstempel zweier Runden auf die Mikrosekunde gleich ist. Praktisch unerreichbar, aber ohne sie ist die Reihenfolge formal nicht total, und „die Liste springt zwischen zwei Aufrufen nicht" (EC-1) wäre eine Hoffnung statt einer Zusage. `runs` vergibt diese Nummer ohnehin fortlaufend; sie kostet nichts.

**Gewertet wird nur, was Serie ≥ 1 hat** (AC-5). Nullrunden bleiben gespeichert — PROJ-2 braucht sie für sein Erfolgskriterium —, sie erscheinen nur nirgends.

### Aufbewahrung

PROJ-3 speichert nichts und hat daher **keine eigene Aufbewahrungsregel**. Die angezeigten Daten leben so lange wie die `runs`-Zeilen, an denen sie hängen: bis zur Kontolöschung, dann verschwinden sie mit dem Profil (Fremdschlüssel mit Kaskade, PROJ-2). Weil es keine Kopie gibt, ist AC-22 nicht etwas, das gebaut wird, sondern eine Folge davon, dass nichts gebaut wird — der gelöschte Spieler ist beim nächsten Aufruf einfach nicht mehr in der Menge, und alle darunter rücken auf (EC-4).

---

## Behaviors & Access

### Die eine Operation

**„Ranglisten-Seite holen"** — nimmt die Konto-Kennung des Aufrufers entgegen, gibt höchstens sechs Zeilen zurück.

Sie arbeitet in drei Schritten, alle in **einer** Datenbankfunktion, damit sie nicht auseinanderlaufen können:

1. **Bester Lauf je Spieler.** Aus allen Runden mit Serie ≥ 1 wird pro Profil genau eine ausgewählt: die nach der Sortierregel oberste. Ein Spieler mit dreihundert Runden trägt danach genau eine Zeile bei (AC-2, EC-7).
2. **Durchnummerieren.** Diese Bestläufe werden nach **derselben** Sortierregel global durchnummeriert. Der Platz entsteht dabei — er wird nicht getrennt berechnet. Das ist die bauliche Erfüllung von AC-4: Liste und Platzierungsangabe stammen aus einer einzigen Nummerierung, es *gibt* keine zweite, die abweichen könnte.
3. **Herausgeben.** Zurück kommen alle Zeilen mit Platz ≤ 5 **plus** die Zeile des Aufrufers, falls sein Platz größer als 5 ist — nach Platz sortiert. Steht der Aufrufer in der Top-5, kommt seine Zeile genau einmal, als Teil der Liste (AC-8, EC-3). Hat er keinen gewerteten Lauf, kommt keine eigene Zeile (AC-9).

**Der Abstand zur Top-5** wird nicht in der Datenbank berechnet, sondern in der Anzeige: `Platz − 5`. Platz 6 ergibt 1 (EC-2), Platz 12 ergibt 7. Er ist eine reine Darstellung derselben Zahl und kann deshalb nicht von ihr abweichen.

### Wer darf was

| Vorgang | Erlaubt für | Durchgesetzt durch |
|---|---|---|
| `/leaderboard` öffnen | nur angemeldete Nutzer | Zwei unabhängige Prüfungen: der Routen-Schutz (`src/proxy.ts`, Umleitung auf `/login`) **und** eine Sitzungsprüfung in der Seite selbst, die vor jeder Datenabfrage steht (AC-13, EC-8) |
| Die Ranglisten-Funktion aufrufen | **nur der Server** | Das Ausführungsrecht wird `public`, `anon` und `authenticated` entzogen und ausschließlich der Server-Rolle erteilt — dasselbe Muster wie bei allen Funktionen aus `0003`, `0006`, `0009`, `0012` und `0013` |
| Fremde Runden lesen | **niemand** | Die Lesepolicy auf `runs` lässt nur eigene Zeilen zu (PROJ-2, `0002`). Die Ranglisten-Funktion läuft mit den Rechten ihres Eigentümers und ist damit der **einzige** Weg an fremde Läufe — und sie gibt je Spieler höchstens eine Zeile heraus (AC-19) |
| Trainernamen lesen | angemeldete Nutzer | Bestehende Policy aus `0001`; `anon` hat seit `0014` gar kein Tabellenrecht mehr |
| Irgendetwas schreiben | **niemand über PROJ-3** | Dieses Feature hat keinen Schreibpfad. Nicht einen |

**Abgewiesen wird bei:** fehlender Sitzung (→ `/login`), abgelaufener Sitzung (→ `/login`, EC-8), und bei jedem Versuch, die Funktion aus dem Browser aufzurufen (fehlendes Ausführungsrecht).

**Warum das AC-19 tatsächlich erfüllt und nicht nur behauptet.** Der Satz „auch dann nicht abrufbar, wenn die Oberfläche umgangen wird" verlangt, dass es hinter der Oberfläche nichts Großzügigeres gibt. Es existieren genau zwei Wege an `runs`: die Lesepolicy (nur eigene Zeilen) und diese Funktion (nur Bestläufe, ohne Parameter, mit dem sich mehr verlangen ließe, und aus dem Browser nicht aufrufbar). Ein dritter Weg müsste erst gebaut werden.

### Nicht in den Suchindex, nicht für Ausgeloggte (AC-23)

Ein nicht angemeldeter Aufruf endet vor jeder Datenabfrage bei `/login` — es entstehen also gar keine Trainernamen, die ausgeliefert werden könnten. Zusätzlich trägt die Seite die Anweisung „nicht indexieren, Links nicht verfolgen" in ihren Metadaten. Das ist bewusst doppelt: Die Umleitung ist der wirksame Schutz, die Anweisung ist die Aussage — und sie überlebt, falls jemand später den Routen-Schutz umbaut.

### Aktualität und ihr Gegenteil (AC-11, AC-12)

- **Bei jedem Aufruf frisch.** Die Seite liest die Sitzung aus dem Cookie und wird dadurch ohnehin pro Anfrage gerendert. Zusätzlich gilt für `/build` ausdrücklich: **kein** `use cache`, **kein** `unstable_cache`, **kein** `revalidate`, **kein** `force-static` auf dieser Route. Der Datenbankaufruf ist standardmäßig ungecacht (Next 16 ohne `cacheComponents`, siehe `next.config.ts`) — diese Voreinstellung darf hier nicht überschrieben werden. Eine gecachte Rangliste wäre der eine Fehler, den ein Spieler nach seiner Rekordrunde sofort bemerkt und für Datenverlust hält.
- **Und dann steht sie still.** Kein Realtime-Abo, kein Polling, kein Intervall, kein automatischer Neuaufbau (AC-12). Die Liste ändert sich nur durch eine Handlung des Nutzers: Neuladen, Navigation, oder „Erneut versuchen" nach einem Fehler.

### Fehlerverhalten (EC-6)

Die Datenabfrage wirft nicht, sondern gibt entweder Zeilen oder einen Fehlerzustand zurück. Die Seite rendert daraufhin die Fehlerkarte **an der Stelle der Liste** — Kopfzeile, Fußzeile, Seitentitel und der „Runde starten"-Knopf bleiben stehen. Nie eine ganzseitige Fehlerseite.

„Erneut versuchen" lädt die Serverseite neu (kein vollständiger Seiten-Reload), unbegrenzt oft. Dieser Knopf ist der einzige Grund, warum eine der Komponenten clientseitig ist.

---

## Darstellung

### Der Aufbau einer Zeile (AC-1, AC-18, EC-9)

Vier Felder in einem Raster, in dieser Reihenfolge:

```
[ Platz ]  [ Trainername ..............................  ]  [ Serie ]  [ Zeit ]
   fest        wächst und schrumpft, kürzt mit „…"            fest       fest
```

- **Platz, Serie und Zeit haben feste Breiten** und `tabular-nums` (`docs/design-system.md` → Typografie). Sie stehen dadurch in allen Zeilen bündig untereinander.
- **Nur der Trainername ist elastisch.** Er kürzt mit Auslassungspunkten, statt umzubrechen — ein Name mit 20 Zeichen darf die Zeile nicht zweizeilig machen (EC-9). Der vollständige Name hängt als Titel-Attribut daran, damit er per Zeigergerät lesbar bleibt.
- **Unter 640 px gibt es kein horizontales Scrollen** (AC-18). Erreicht wird das nicht durch eine Umschaltung auf ein anderes Layout, sondern dadurch, dass genau ein Feld nachgibt. Die Zeile hat damit auf jedem Bildschirm dieselbe Form.
- **Keine `<table>`, sondern eine Liste** — es gibt keine zweite Dimension, und eine Liste kürzt zuverlässiger.

### Zeitformat `mm:ss,s` (AC-1)

Minuten zweistellig, Sekunden zweistellig, ein Zehntel nach dem **Komma** (deutsches Dezimalzeichen). Aus 83.421 ms wird `01:23,4`. Gerundet wird auf das nächste Zehntel; sortiert wird immer auf Millisekunden, sodass zwei gleich dargestellte Zeiten trotzdem eine feste Reihenfolge haben.

> **Abweichung vom Quiz, bewusst und benannt:** PROJ-2 zeigt dieselbe Dauer als `m:ss` ohne Zehntel (`src/components/quiz/status-bar.tsx`). Derselbe Lauf steht auf dem Ergebnis-Screen also als `1:23` und in der Rangliste als `01:23,4`. AC-1 verlangt das Zehntel ausdrücklich — hier ist die Zeit der Tie-Breaker und muss die Unterscheidung sichtbar machen, die sie trifft. PROJ-3 bekommt deshalb eine **eigene** Formatierung und rührt die von PROJ-2 nicht an. Als Open Question notiert.

### Hervorhebung

| Was | Wie |
|---|---|
| Platz 1 | Gold (`--accent`) — die Belohnungsfarbe des Design-Systems |
| Die eigene Zeile | Hervorgehobene Fläche plus „Du"-Marker in Akzenttext (`#B7301F` auf hellem Grund). Gilt in der Liste **und** in der abgesetzten Zeile darunter, identisch (AC-10) |
| Die abgesetzte eigene Zeile | Sichtbar vom Listenblock getrennt (Abstand + Trennlinie), damit sie nicht wie Platz 6 der Liste aussieht (AC-7) |

**Bewusst nicht verwendet: `sheen` und `fall`.** Das Design-System führt `sheen` als „Lichtstreifen über der Ranglisten-Fanfare" und `fall` als Konfetti bei Top-3 — beide stammen aus einem Canvas-Entwurf mit einer Erfolgsmeldung auf der Rangliste. Die Spec hat diese Meldung ausdrücklich gestrichen (Out of Scope: „Eine erneute ‚Neue Bestleistung!'-Meldung"), weil der Ergebnis-Screen sie schon gezeigt hat. Ohne Fanfare gibt es nichts, worüber ein Lichtstreifen laufen könnte. Die Hervorhebung der eigenen Zeile trägt die Aufgabe allein.

Die Karte tritt mit `in` ein wie jeder andere Screen; alle Bewegung respektiert `prefers-reduced-motion` (Design-System).

### Ladezustand (AC-16)

`loading.tsx` zeigt **fünf** Skelettzeilen in exakter Zeilenhöhe plus eine abgesetzte sechste. Fünf, weil das die häufigste Zeilenzahl ist und ein zu kurzes Skelett genauso springt wie ein zu langes. Kein alleinstehender Spinner — das ist eine Regel der App-Shell, keine Vorliebe.

### Der Datenschutz-Satz (AC-24)

Unter der Karte, in `--muted-foreground`, ohne Aufklappen und ohne Klick — sinngemäß: *„Andere angemeldete Spieler sehen hier deinen Trainernamen, deine beste Serie und die dazugehörige Zeit. Immer nur deinen besten Lauf, nie deine übrigen Runden."* Zwei Aussagen, weil AC-24 zwei verlangt: **welche** Daten sichtbar sind und **dass nur der beste Lauf** erscheint.

---

## Dependencies

**Keine neuen Pakete.** Alles Benötigte ist da: das Skelett-Bauteil von shadcn/ui (`src/components/ui/skeleton.tsx`), der Button, der Supabase-Client und die Schriftart. Eine Ranglisten-Bibliothek gibt es nicht zu installieren — die Rangliste ist eine Sortierung.

---

## Settings the user makes

**Keine.** Dieses Feature prüft keine Zugangsdaten, verschickt keine E-Mail und braucht keine Einstellung in einem fremden Dashboard.

Zwei bereits bekannte Deploy-Blocker wirken allerdings auf diese Seite und sind dort geführt, nicht hier: die fehlenden Security-Header (BUG-12) und der `X-Forwarded-Host`-Befund (BUG-18). `Referrer-Policy` bekommt mit PROJ-3 zusätzliches Gewicht — es ist die erste Seite, deren Adresse allein schon aussagt, dass hier fremde Trainernamen stehen.

---

## Technical Decisions

| Entscheidung | Begründung | Erwogene Alternative | Preis | Datum |
| --- | --- | --- | --- | --- |
| **Keine Kontoverifizierung als Wertungsvoraussetzung** — gewertet wird jeder Lauf mit Serie ≥ 1 | Die Vorgabe stammt aus BUG-19 vom 2026-09-05: Ein einziger Aufruf an `saveRun` erzeugte Serie 386 ohne eine beantwortete Frage. Diese Ursache ist seit dem 2026-09-06 weg — die Runde wird serverseitig geführt (PROJ-2, AC-32 bis AC-41), und die Migrationen `0011` und `0013` haben auch den Weg über die Datenschnittstelle geschlossen (gemessen, mehrfach unabhängig gegengeprüft). Der verbliebene Angriff ist ein Skript, das **echt spielt** und die Bilder erkennt — dagegen wirkt weder ein Mindestalter noch eine Mindestzahl Runden, beide verzögern ihn um Stunden. Ein Kriterium ohne Wirkung, das echte Neuzugänge aussperrt, ist teurer als keines. PROJ-2 sagt es im eigenen Decision Log: „keine Kontoverifizierung hilft dagegen" | Mindestalter des Kontos (24 h), Mindestzahl abgeschlossener Runden (3), oder beides kombiniert — alle drei ohne neue Entität baubar | **Der Vertrag muss nachgezogen werden:** `spec.md` → Technical Requirements führt die Verifizierung noch als feststehend. Ein `/refine PROJ-3` vor `/tasks`. Und: Gegen ein bilderkennendes Skript hat PROJ-3 kein Mittel — das bleibt offen und ist als solches benannt, statt durch eine wirkungslose Hürde als erledigt zu gelten | 2026-09-08 |
| **Eine Datenbankfunktion statt einer Abfrage aus der Anwendung** | Die Lesepolicy auf `runs` lässt nur eigene Zeilen zu — eine Rangliste ist damit aus der Nutzersitzung heraus gar nicht abfragbar. Das ist kein Hindernis, sondern die Zusage aus `docs/data-model.md` („schlechte Runden sind privat"), festgelegt in PROJ-2 → `design.md`. Die Funktion ist die einzige Öffnung, und sie ist genau so breit wie die Anzeige: ein Lauf je Spieler, vier Werte | Die Lesepolicy für alle Angemeldeten öffnen und im Anwendungscode sortieren | Die Sortierung liegt in SQL statt in TypeScript und ist damit nur über die Datenbank testbar. Das ist der richtige Ort: Die Regel gehört dorthin, wo sie durchgesetzt wird | 2026-09-08 |
| **Die Funktion ist nur für die Server-Rolle ausführbar, nicht für `authenticated`** | Für `authenticated` freigegeben wäre sie ein bequemes Werkzeug, die Rangliste abzugreifen — genau die Überlegung, mit der `0003` und `0006` ihre Funktionen abgeriegelt haben. Die Seite braucht die Freigabe nicht: Sie rendert auf dem Server und ruft dort auf | Ausführungsrecht für `authenticated`, Aufruf direkt aus dem Browser | Der Server muss den Administrationszugang benutzen — wie schon bei allen Rundenfunktionen aus `0009`. Die Funktion ist damit selbst die Zugriffsgrenze und muss es bleiben: Sie darf nie einen Parameter bekommen, mit dem sich mehr verlangen lässt | 2026-09-08 |
| **Platz, Liste und eigene Zeile entstehen in einer einzigen Nummerierung** | AC-4 verlangt, dass Liste und Platzierungsangabe nicht auseinanderlaufen können. Zwei getrennte Berechnungen wären bei einem Gleichstand still verschieden — die Liste zeigt „Platz 4", die Zeile darunter behauptet „Platz 5". Stammen beide aus derselben Nummerierung, ist der Widerspruch nicht bloß unwahrscheinlich, sondern unmöglich | Top-5 abfragen und den eigenen Rang mit einer zweiten Abfrage zählen | Die Funktion muss die Bestläufe **aller** Spieler durchnummerieren, auch wenn nur sechs Zeilen herauskommen. Bei der zu erwartenden Größenordnung folgenlos — siehe die Zeile zur Skalierung | 2026-09-08 |
| **Vierte Sortierstufe: die laufende Nummer der Runde** | EC-1 verspricht, dass die Reihenfolge zwischen zwei Aufrufen nicht springt. Mit drei Stufen ist die Ordnung nicht total: Bei gleicher Serie, gleicher Dauer **und** gleichem Zeitstempel darf die Datenbank die Reihenfolge frei wählen — und beim nächsten Mal anders. Der Fall ist praktisch unerreichbar; eine Zusage, die nur meistens gilt, ist trotzdem keine | Bei drei Stufen bleiben und auf die Auflösung des Zeitstempels vertrauen | Eine unsichtbare Sortierspalte mehr. Sie kostet nichts, weil `runs` die Nummer ohnehin vergibt | 2026-09-08 |
| **Der Abstand zur Top-5 wird in der Anzeige gerechnet, nicht in der Datenbank** | Er ist `Platz − 5` und damit eine Darstellung derselben Zahl, die schon feststeht. In der Datenbank wäre er ein zweiter Wert, der von seinem eigenen Platz abweichen könnte | Die Funktion gibt den Abstand mit heraus | Keiner. Die Formel ist einstellig | 2026-09-08 |
| **Zeit als `mm:ss,s` mit eigener Formatierung, PROJ-2 bleibt bei `m:ss`** | AC-1 verlangt das Zehntel: Die Zeit ist hier der Tie-Breaker und muss die Unterscheidung zeigen, die sie trifft. Die Formatierung von PROJ-2 zu ändern hieße, in dessen Anzeige einzugreifen — das gehört zu PROJ-2 und nicht hierher | Die vorhandene Formatierung um Zehntel erweitern und beide Features darauf umstellen | Derselbe Lauf steht an zwei Orten unterschiedlich da (`1:23` gegen `01:23,4`). Als Open Question notiert, damit es eine Entscheidung bleibt und kein Versehen wird | 2026-09-08 |
| **Fehler wird als Rückgabewert behandelt, nicht als geworfene Ausnahme** | EC-6 verlangt den Hinweis **innerhalb** der Karte, mit stehender Kopf- und Fußzeile. Eine Ausnahme landet in der Fehlergrenze der Route und ersetzt den ganzen Inhaltsbereich; ein Rückgabewert lässt die Seite entscheiden, welcher Teil ausgetauscht wird | Auf die Fehlergrenze der Route setzen | Der Aufrufer muss den Fehlerzustand behandeln, es gibt keinen stillen Durchfall. Hier ein Vorteil | 2026-09-08 |
| **„Runde starten" verlinkt auf `/` und startet die Runde nicht selbst** | Der Rundenstart gehört PROJ-2 und ist dort ein serverseitiger Vorgang mit eigenem Zustand. Ihn von der Rangliste aus fernzusteuern hieße, in ein fremdes Feature hineinzuschreiben — über eine Adresse mit Sonderparameter, die dann zwei Features gehört | Ein Parameter an `/`, der die Runde sofort startet | Der Spieler klickt zweimal: einmal hier, einmal auf dem Startbildschirm. AC-14 verlangt die Aktion an dieser Stelle, nicht das Ausbleiben des zweiten Klicks | 2026-09-08 |
| **Leerzustand und „noch kein gewerteter Lauf" sind eine Karte, nicht zwei** | Ist niemand gewertet, ist auch der Betrachter nicht gewertet — AC-17 und AC-9 beschreiben denselben Bildschirm aus zwei Blickwinkeln. Zwei gestapelte Hinweise sagten dem Spieler zweimal dasselbe | Beide getrennt rendern | Der eine Satz des Leerzustands muss die Aussage von AC-9 tragen („mindestens eine Frage richtig beantworten"). Beim Formulieren nicht wegzukürzen | 2026-09-08 |
| **Skalierung bleibt bei der einfachen Berechnung; kein Zwischenspeicher** | Der vorhandene Index `runs_profile_best_idx` (Profil, Serie absteigend, Dauer aufsteigend) liefert die Reihenfolge, es gibt also **keine Sortierung des gesamten Bestands** — nur eine Nachsortierung innerhalb jeder Spieler-Gruppe. Herauskommt eine Zeile je Spieler, gleichgültig wie viele Runden er hat (EC-7). Es ist derselbe Index, den PROJ-2 schon benutzt — es kommt keiner dazu. **Beim Bau am 2026-09-08 gemessen, nicht angenommen:** 100.000 Runden auf 4.008 Spieler → `Index Scan using runs_profile_best_idx`, `Presorted Key: profile_id, streak, duration_ms`, Gesamtlauf 54 ms, die Funktion selbst dreimal 46,7 / 45,6 / 46,0 ms — gegen eine Zusage von einer Sekunde | Eine gepflegte Ranglisten-Tabelle oder ein Schnappschuss | **Der Scan wandert über jede gewertete Zeile** (gemessen: 99.900 gelesen, 4.008 ausgegeben). Die Kosten wachsen also mit der Zahl der **Runden**, nur mit kleinem Faktor und ohne Sortier-Spitze — eine frühere Fassung dieser Zeile behauptete, sie wüchsen allein mit der Zahl der Spieler; das war zu stark und ist nach der Messung korrigiert. Irgendwann wird das spürbar; diese Größenordnung ist weit weg, und **AC-21 verbietet den Schnappschuss ausdrücklich** — er wäre eine Kopie personenbezogener Daten mit eigener Aufbewahrungsfrage. Wenn es je so weit kommt, ist das ein eigenes Feature mit eigener Datenschutzprüfung | 2026-09-08 |
| **Kein Zwischenspeichern der Seite, ausdrücklich festgeschrieben** | AC-11 verlangt den Stand im Moment der Anfrage. Die Voreinstellung dieses Projekts liefert das bereits (die Seite liest die Sitzung, und Next 16 cacht ohne `cacheComponents` keine Datenzugriffe). Der Punkt steht trotzdem hier, weil eine später hinzugefügte Zeile ihn lautlos umkehren würde — und der Schaden erst nach einer Rekordrunde auffiele | Auf die Voreinstellung vertrauen und nichts sagen | Eine Zeile mehr im Vertrag zwischen Design und Bau | 2026-09-08 |

---

## Open Questions

- [x] **~~Der Vertrag trägt die gestrichene Verifizierung noch.~~** → **Erledigt am 2026-09-08 mit `/refine PROJ-3`**: Die Technical Requirement ist neu gefasst (gewertet wird jeder Lauf mit Serie ≥ 1), die alte Decision-Log-Zeile als aufgehoben markiert und die aufhebende Entscheidung mit Begründung ergänzt. Keine AC- oder EC-ID angefasst.
- [ ] **Gegen ein echt spielendes Skript hat PROJ-3 kein Mittel.** Die Bilder kommen zwar unter einem Token statt unter der Pokémon-Nummer (PROJ-2, AC-32), aber ein Angreifer kann sie einmalig gegen die öffentlichen Sprites abgleichen und danach fehlerfrei antworten; der Server misst dann eine echte, sehr kurze Zeit. Ein Gegenmittel läge in keinem Fall in PROJ-3, sondern in PROJ-2 (Untergrenze für die Antwortzeit, Drosselung der Runden je Konto, CAPTCHA) — und jedes davon wurde dort bereits einmal bewusst abgelehnt. Zu bewerten, sobald es echte Nutzung gibt und die Rangliste überhaupt etwas zu gewinnen bietet.
- [ ] **Zwei Zeitformate für dieselbe Dauer.** Ergebnis-Screen `1:23`, Rangliste `01:23,4`. Beide sind vertragsgemäß (PROJ-2 AC-7 bzw. PROJ-3 AC-1). Falls das im Betrieb auffällt, ist die saubere Auflösung ein `/refine PROJ-2` auf das Zehntel — nicht ein stiller Eingriff aus PROJ-3 heraus.

---

## Notizen aus dem Bau (2026-09-08)

Der Bau hat drei Dinge ergeben, die beim Entwurf nicht sichtbar waren. Alle drei
sind gemessen, nicht vermutet.

**1. Die Skalierungs-Aussage war zu stark und ist korrigiert.** Siehe die Zeile
„Skalierung bleibt bei der einfachen Berechnung" oben: Der Index liefert die
Reihenfolge, der Scan wandert aber über jede gewertete Zeile. 100.000 Runden auf
4.008 Spieler → 46 ms.

**2. Ein E2E-Test kann die zweite Zugangsschranke nicht prüfen.** `src/proxy.ts`
fängt die ausgeloggte Anfrage ab, bevor `page.tsx` läuft — entfernt man die
Umleitung in der Seite, bleibt der Browser-Test grün. `design.md` sagt aber zwei
unabhängige Prüfungen zu, und `.claude/rules/security.md` verlangt sie. Deshalb
kam `src/app/leaderboard/page.test.tsx` dazu: derselbe Nachweis eine Ebene
tiefer, mit Rot-Gegenprobe. Die Lehre ist allgemein — **eine Schranke, die hinter
einer anderen liegt, braucht einen Test auf ihrer eigenen Ebene**, sonst ist ihr
Vorhandensein eine Behauptung.

**3. Der Bestenlisten-Zugang sprengt die Kopfzeile unter 375 px.** Der Befund
gehört PROJ-2 (die Shell) und ist mit Messreihe in `tasks.md` → „Befund aus dem
Bau, der PROJ-2 gehört" festgehalten. Er verletzt kein AC von PROJ-3, trifft aber
jede Route der App und ist per `/refine PROJ-2` zu entscheiden.

**Ebenfalls beim Zusammensetzen aufgefallen:** Der Leerzustand trägt laut AC-17
selbst einen „Runde starten"-Button; der zusätzliche Seiten-Button aus AC-14
hätte daneben zwei identische Primär-Aktionen ergeben. Er entfällt deshalb genau
in diesem einen Zustand.

## Nachtrag: der Spaltenüberschrift-Fix (2026-09-08)

**Der Befund.** Bei 320 px lief die Spaltenüberschrift „TRAINER" aus ihrer nur rund 45 px breiten Spalte in den Spaltenabstand hinein und berührte „SERIE" — auf dem Bildschirm stand **„TRAINERSERIE"**. Gefunden wurde das auf einem Bildschirmfoto, nicht von einem Test: Beide Suiten waren zu diesem Zeitpunkt grün.

**Der Fix.** Unter 400 px heißt die Spalte **„Name"** statt „Trainer". Zusätzlich steht `truncate` an der Zelle — nicht für diesen Fall, sondern für die Fehlerklasse: Eine andere Schrift oder ein Zoomfaktor verschiebt die Rechnung, und dann soll die Überschrift abgeschnitten werden statt in die Nachbarspalte zu laufen. Gemessen bei 320 px: Text 45 px in 45 px Spalte, Lücke zur Serie-Spalte unverändert 12 px, kein Überlauf.

**Erwogen und verworfen:**
- *Die Zeitspalte verschmälern,* um der Namensspalte Platz zu geben. Sie ist nicht großzügig — die breiteste darstellbare Zeit („100:00,0") füllt ihre 88 px **exakt** aus, gemessen. Sie zu kürzen hieße Daten abzuschneiden statt einer Beschriftung.
- *Die Laufweite verringern.* Brachte 8 px; die Überschrift wäre trotzdem abgeschnitten dastehen geblieben (49 px Text in 45 px Spalte).
- *Die Kopfzeile der Liste unter 400 px ganz ausblenden.* Wäre konsistent mit der Wortmarke, kostet aber die Spaltenbedeutung — und „Serie" und „Zeit" sind beide Zahlen.

### Zwei Lehren aus dem Test dazu

**1. Element-Rechtecke messen den Fehler nicht.** Die erste Fassung des Tests verglich die Rechtecke der Rasterzellen — und blieb grün, als der Fehler zur Gegenprobe wieder eingebaut wurde. Der überlaufende Text wird **außerhalb** seiner Zelle gemalt; die Zelle behält ihre Breite. Erst ein `Range` über den Textinhalt liefert das Rechteck der Glyphen und ragt mit ihnen heraus. Damit meldet die Gegenprobe jetzt: „der Text ‚Trainer' (endet 144) an ‚Serie' (beginnt 144) — die Überschriften berühren sich".

**2. Auf die Überschrift „Weltrangliste" zu warten ist kein Signal, dass die Liste steht.** `loading.tsx` rendert dieselbe Überschrift wie die fertige Seite — bewusst, damit beim Eintreffen der Daten nichts springt (AC-16). Die erste Testfassung hat deshalb die **Skelettzeilen** vermessen und leere Texte der Breite 0 gefunden. Der Test wartet jetzt darauf, dass die Kopfzeile der Liste Text enthält.

**Nebenbefund, nicht behoben:** In der abgesetzten eigenen Zeile konkurriert der „Du"-Marker mit dem Trainernamen um dieselbe Spalte; bei 320 px bleibt vom Namen wenig übrig (beobachtet: „H…"). Kein Kriterienbruch — AC-18 und EC-9 verlangen, dass der Name kürzt und die Zahlen sichtbar bleiben, und das tut er. In der **eigenen** Zeile ist der Name zudem die Information, die der Leser am wenigsten braucht. Als Beobachtung festgehalten, nicht als Mangel.
