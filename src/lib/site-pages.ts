/**
 * Welche Seiten es in dieser App schon gibt.
 *
 * Hintergrund: Ein Link auf eine noch nicht gebaute Seite ist im Produktivbetrieb
 * ein toter Link — `docs/app-shell.md` verlangt deshalb, ihn erst zu zeigen, wenn
 * die Zielseite existiert. Diese Regel wurde in diesem Projekt **dreimal
 * nacheinander** verletzt, an drei verschiedenen Stellen: Fußzeile (beim Bau
 * bemerkt), Kopfzeile (BUG-23) und Ergebnis-Screen (AC-7).
 *
 * Der Grund war jedes Mal derselbe: Die Regel stand als Fließtext in einem
 * Dokument und als Open Question, aber jede Fundstelle trug ihren eigenen
 * Schalter. Deshalb liegt er jetzt hier — **ein** Wert für alle Stellen, die auf
 * dieselbe Seite zeigen.
 *
 * **PROJ-3 hat `/leaderboard` gebaut; der Schalter steht seit dem 2026-09-08 auf
 * `true`.** Das schaltet Kopfzeile und Ergebnis-Screen gemeinsam frei; es gibt
 * keine zweite Stelle, die dabei vergessen werden könnte.
 *
 * Beide Kriterien sind bedingt formuliert — PROJ-2 AC-7 und AC-21 sagen „genau
 * dann, wenn die Ranglisten-Seite existiert". Das Umlegen erfüllt sie also auf
 * der anderen Seite, statt sie zu brechen. **Geprüft war bis dahin nur der
 * negative Zweig** (alle QA-Läufe zu PROJ-2 führen `LEADERBOARD_PAGE_EXISTS=false`
 * ausdrücklich als Beleg); der positive gehört im QA-Lauf zu PROJ-3 belegt —
 * siehe `features/PROJ-3-leaderboard/tasks.md` → Prüfhinweise.
 *
 * Die Datenschutz- und Impressumsseiten laufen bewusst nicht über diese Datei:
 * Die Fußzeile führt sie in `site-footer.tsx` als Liste (`LEGAL_PAGES`), weil
 * PROJ-4 dort zwei Seiten mit Beschriftung einträgt, nicht einen Schalter
 * umlegt. `register-view.tsx` trägt aus demselben Grund seinen eigenen.
 */
export const LEADERBOARD_PAGE_EXISTS = true
