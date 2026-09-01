# App-Shell & Navigation

> Die app-weite Karte **des Rahmens, in dem jedes Feature gezeigt wird** — Navigation, Layout-Regionen und die Muster, die jede Seite wiederholt.
>
> - Erstellt von `/init` (der erste ganzheitliche Durchgang: Top-Level-Bereiche + Layout).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Struktur, nicht Gestaltung. Welche Bereiche es gibt, wo sie liegen, wer sie sieht, was jede Seite teilt. Farben, Schriften und Komponenten-Styling gehören in `docs/design-system.md`; die Interna einer einzelnen Seite in das `design.md` ihres Features.
>
> Ohne diese Karte wächst der Rahmen durch Anlagerung — jedes Feature ergänzt einen Navigationseintrag und eine Kopfzeilen-Variante in seinem eigenen `design.md`, und niemandem gehört das Ganze.

## Besitzendes Feature

Es gibt **kein** eigenes App-Shell-Feature: Mit nur zwei navigierbaren Bereichen und dem Standard-Auth-Unterschied „Login-Seite vs. App" wäre das Zeremonie. Der Rahmen gehört deshalb zu dem Feature, das den Hauptbildschirm baut.

**Owner: PROJ-2 — Pokémon-Quiz.** Verhaltensänderungen am Rahmen laufen über `/refine PROJ-2`, nie direkt in das `design.md` eines anderen Features.

## Top-Level-Bereiche

| Bereich | Route | Was man dort tut | Sichtbar für | Feature |
|---------|-------|------------------|--------------|---------|
| Anmeldung | `/login` | Registrieren, anmelden, Passwort-Reset anfordern | nur ausgeloggt | PROJ-1 |
| Neues Passwort | `/reset-password` | Neues Passwort setzen, nur über den E-Mail-Link erreichbar (nicht verlinkt) | ausgeloggt und eingeloggt | PROJ-1 |
| Spiel | `/` | Runde starten, spielen, Ergebnis sehen | nur angemeldet | PROJ-2 |
| Weltrangliste | `/leaderboard` | Die globale Top-5 ansehen | nur angemeldet | PROJ-3 |
| Rechtliches | `/privacy`, `/imprint` | Datenschutzerklärung, Impressum | **alle**, auch ausgeloggt | PROJ-4 |

**Start, Quiz und Ergebnis bleiben eine Route.** Es ist ein durchgehender Spielfluss; ein Reload mitten in der Runde verliert den Zustand ohnehin, und drei Routen würden vortäuschen, er sei wiederherstellbar. Ob der Fluss intern als Client-State oder anders abgebildet wird, entscheidet `/architecture`.

## Layout-Regionen

- **Kopfzeile:** durchgehend über allen Screens, leicht transparent mit Blur und dünner Trennlinie nach unten. Links das in CSS gezeichnete Ball-Motiv plus Wortmarke „Pokémon QUIZ". Rechts auth-abhängiger Inhalt (siehe Auth-Zustände).
- **Inhalt:** füllt die restliche Höhe. Die innere Aufteilung gehört dem jeweiligen Screen.
- **Fußzeile:** schlank, nur Links zu Datenschutz und Impressum. Auf jeder Seite, auch ausgeloggt.
- **Mobil (unter `md`, 768px):** kein Burger-Menü. Bei zwei Bereichen passt beides in die Kopfzeile — der Nutzer-Chip reduziert sich unter `sm` auf die Initiale. Die Inhalte stapeln sich von selbst, weil das Design durchgehend `auto-fit / minmax` verwendet.

## Seiten-Muster

- **Seitenkopf:** Die Screens tragen ihren Titel im Inhaltsbereich, nicht in der Kopfzeile — die Kopfzeile bleibt über alle Screens identisch und trägt nur Marke und Kontoinformation.
- **Ladezustand:** Skelettflächen in der Größe des erwarteten Inhalts, mit sanftem Puls. **Kein nackter Spinner** — das Quiz lädt Bilder von extern, und ein Skelett in Bildgröße verhindert, dass das Layout springt, wenn das Bild eintrifft.
- **Leerer Zustand:** gedämpftes Ball-Motiv, ein Satz in `--muted-foreground`, darunter die naheliegende Aktion als Primär-Button.
- **Fehlerzustand:** Ist die PokeAPI nicht erreichbar, wird das **innerhalb** der betroffenen Karte gezeigt, mit einer „Erneut versuchen"-Aktion — nie als ganzseitiger Fehler, der die laufende Serie visuell wegwirft.
- **Rückmeldung:** direkt am Ort der Handlung (die Antwortoption färbt sich, die Karte reagiert mit `pop` oder `nudge`), nicht über Toasts. Toasts gibt es in diesem Produkt nicht.

## Auth-Zustände

- **Ausgeloggt:** Erreichbar sind nur `/login`, `/reset-password`, `/privacy` und `/imprint`. Jeder andere Aufruf leitet auf `/login`. Die Kopfzeile zeigt rechts die Zeile „Deutsche Namen · Serie · Weltrangliste".
- **Angemeldet:** Alle Bereiche erreichbar. Die Kopfzeile zeigt rechts den Button „Bestenliste" und den Nutzer-Chip mit Initiale und Trainername.
- **Rollen:** keine. Alle angemeldeten Nutzer sind gleichberechtigt.

## Shell-Komponenten

Die genauen Dateipfade legt `/architecture` fest; die Aufteilung steht hier, damit kein Feature einen zweiten Rahmen baut.

| Komponente | Zweck |
|------------|-------|
| Kopfzeile | Marke, Bestenlisten-Zugang, Nutzer-Chip — die einzige Navigation der App |
| Wortmarke | Ball-Motiv (CSS-gezeichnet) plus Schriftzug, auch als Motiv in leeren Zuständen |
| Fußzeile | Datenschutz- und Impressums-Links |
| Seitenrahmen | Kopfzeile + Inhalt + Fußzeile, die gemeinsame Hülle jedes Screens |

## Lücke gegenüber dem Design

Die Design-Canvas kennt **keine Fußzeile** und keinen Weg zu Datenschutzerklärung und Impressum. Beides muss von jeder Seite aus erreichbar sein, auch im ausgeloggten Zustand, bevor die App öffentlich gehen kann. Die Fußzeile oben schließt diese Lücke: Der Rahmen gehört zu PROJ-2, die Inhalte der beiden Seiten zu PROJ-4.

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das einen Navigationseintrag, eine Layout-Region oder ein neues Seiten-Muster hinzufügt, aktualisiert es zuerst diese Karte. Verhaltensänderungen am Rahmen gehen über `/refine` auf das besitzende Feature — nie direkt in das `design.md` eines Features._
