# PROJ-4 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Der geordnete, nachvollziehbare Bauplan — die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: Die Dateien dieser Aufgabe sind disjunkt zu jeder anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also in einen eigenen Unteragenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Innerhalb einer Ebene läuft parallel, was `[P]` trägt. Jede Aufgabe verweist auf die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur der Nutzer vornehmen kann. **PROJ-4 hat keine** — `design.md` → „Settings the user makes" ist leer, und das ist bemerkenswert: Anders als PROJ-1 braucht dieses Feature keinen einzigen Dashboard-Handgriff, weil die Drosselung vollständig selbst gebaut ist und keine E-Mail versendet wird.
> Der Status lebt ausschließlich in `features/INDEX.md`.

## Level 1 — Datenschicht

<!-- Eine Aufgabe. Sie muss vor allem anderen stehen, weil T4 sie prüft und T5 sich auf sie verlässt. -->

- [x] **T1**  Migration `0017_forget_auth_throttle_by_pattern.sql`: `forget_auth_throttle_for_user()` neu fassen. Statt drei buchstäblich aufgezählter Schlüssel (`login:`, `register:`, `password-reset:`) löscht der Trigger künftig **jede** Zeile, deren Schlüssel auf `:account:` + kleingeschriebene E-Mail-Adresse endet — damit ist der neue Scope `account-delete` und **jeder künftige** automatisch erfasst. **IP-Schlüssel bleiben ausdrücklich stehen** (Regel aus `0005`: sonst löst ein Angreifer seine eigene Bremse, indem er ein Wegwerf-Konto anlegt und wieder löscht — das war BUG-39). Unverändert `security definer` mit festem `search_path`. Der Kommentar der Migration hält fest, **warum** die Aufzählung eine Falle war: Sie schnappt genau einmal zu und bleibt danach unbemerkt  · files: supabase/migrations/0017_forget_auth_throttle_by_pattern.sql  · → AC-17

## Level 2 — Serverseitige Bausteine

<!-- Setzt T1 voraus. Drei disjunkte Dateimengen; keine schreibt in eine Datei der anderen. -->

- [x] **T2** [P]  Zähler-Scope `account-delete` in `LIMITS`: **5 Versuche je 15 Minuten**, für die Verbindung *und* für das Konto — die Zahlen kommen aus AC-15 und stehen damit erstmals in diesem Projekt im Vertrag **und** im Code, statt nur im Code (das war der offene Punkt bei `password-update`). Schlüsselbildung `account-delete:ip:<verbindung>` und `account-delete:account:<kleingeschriebene adresse>`, wie die bestehenden Scopes. Dazu die Erstattung über die vorhandene Funktion aus `0004` verfügbar machen — sie zählt um **genau eins** herunter, sie leert den Zähler nicht  · files: src/lib/auth/throttle.ts, src/lib/auth/throttle.test.ts  · → AC-15, EC-7
- [x] **T3** [P]  Kontodaten lesen: die fünf Werte aus `design.md` → Data Model (E-Mail aus der Sitzung; Trainername und Registrierdatum aus `profiles`; Rundenzahl als Anzahl **aller** eigenen Zeilen in `runs`, auch Nullrunden; bester Lauf nach der Regel aus PROJ-3 — Serie absteigend, bei Gleichstand Zeit aufsteigend, und `null`, wenn es keinen Lauf mit Serie ≥ 1 gibt). **Ausdrücklich über die Nutzersitzung mit Row Level Security, nicht über den Administrationszugang** — die Daten sind für den Eigentümer ohnehin lesbar, und der Generalschlüssel nähme hier die zweite Schutzschicht weg. Gibt einen Fehlerzustand als Rückgabewert zurück, statt zu werfen  · files: src/lib/account/queries.ts, src/lib/account/queries.test.ts  · → AC-2, AC-4, AC-6, AC-19
- [x] **T4** [P]  Der Wächtertest für die Löschkette — **in beide Richtungen**, und das ist der Punkt. Die vier Kaskaden stehen in drei Migrationen und wurden **nie im Löschfall zusammen ausgelöst**; bis heute sind sie totes Kapital. **(a) Gelingt die Löschung**, sind hinterher alle fünf Spuren weg: Auth-Zeile, Profil, **alle** Runden, der laufende Rundenzustand und die Zählerzeilen mit der Adresse — jede Tabelle einzeln nachgezählt, nicht „die Aktion warf keinen Fehler". **(b) Scheitert sie**, künstlich herbeigeführt durch einen absichtlich werfenden Trigger auf `auth.users`, ist hinterher **jede** der fünf Zeilen noch da. Dazu: Trainername und E-Mail sind danach wieder registrierbar und ergeben ein leeres Konto; die Ranglisten-Funktion zeigt den Gelöschten nicht mehr und die Nachfolger rücken auf; **IP-Zählerzeilen überleben**  · files: tests/PROJ-4-deletion-cascade.spec.ts  · → AC-10, AC-13, AC-17, AC-18, AC-22, EC-2, EC-3, EC-5, EC-6, EC-10

## Level 3 — Die Lösch-Aktion

<!-- Allein, ohne [P]. Sie trägt den gesamten sicherheitsrelevanten Ablauf; ein Integrationsfehler hier ist teurer als der gesparte Durchlauf. Setzt T2 (Zähler) und T1 (Trigger) voraus. -->

- [ ] **T5**  Die Server Action, genau nach dem Ablauf in `design.md` → Behaviors & Access. **Sie nimmt genau ein Feld entgegen — das Passwort. Es gibt keinen Parameter für eine Konto-Kennung, eine Adresse oder eine Sitzungskennung**; AC-16 wird dadurch nicht geprüft, sondern unmöglich. Reihenfolge: Verbindungs-Zähler → Sitzung über den Auth-Dienst → Konto-Zähler → Passwortprüfung durch einen Anmeldeversuch auf einem **sitzungslosen** Client (schreibt keine Cookies, lässt die bestehende Sitzung unberührt) → harte Löschung über den Administrationszugang, **ausdrücklich nicht weich** → Sitzungscookies örtlich löschen, ohne den Auth-Dienst zu fragen → Umleitung auf `/login` mit Merker. **Fehlt der Service-Role-Schlüssel, wird abgewiesen, niemals stillschweigend durchgelassen.** **Scheitert die Löschung nach richtigem Passwort**, wird genau ein Versuch auf beiden Schlüsseln erstattet und der technische Fehler von der Passwort-Fehlermeldung **unterschieden** — sonst tippt der Nutzer sein richtiges Passwort neu ein. Der Erstattungszweig liegt hinter der bestandenen Prüfung und ist für einen Angreifer unerreichbar. **Nichts protokollieren, was Adresse oder Trainername enthält**  · files: src/lib/account/delete-action.ts, src/lib/account/delete-action.test.ts  · → AC-9, AC-10, AC-11, AC-12, AC-15, AC-16, AC-17, AC-20, AC-21, AC-22, EC-1, EC-3, EC-4, EC-8

## Level 4 — Anzeige-Bausteine

<!-- Setzt Level 3 voraus (die Anzeige ruft die Aktion). Zwei disjunkte Dateien; keine importiert die andere. -->

- [ ] **T6** [P]  Die Kontodaten-Karte: fünf Wertzeilen (E-Mail, Trainername, Dabei seit als `TT.MM.JJJJ`, Runden, Bester Lauf als Serie + `mm:ss,s`). **Nur-Lese — kein Eingabefeld, keine Speichern-Aktion.** Ohne gewerteten Lauf steht dort ein Hinweis statt einer leeren Zeile oder einer Null. Darunter der Vollständigkeits-Satz: dass dies alles ist, was gespeichert wird. Bei 320 px kein waagerechtes Scrollen — die E-Mail-Adresse bricht um oder wird gekürzt, statt die Karte zu sprengen  · files: src/components/account/account-data-card.tsx, src/components/account/account-data-card.test.tsx  · → AC-2, AC-3, AC-6, AC-7, AC-19
- [ ] **T7** [P]  Der Lösch-Dialog als `AlertDialog` (die shadcn-Komponente für unumkehrbare Handlungen, ohne Schließen-Kreuz neben den Knöpfen). Warntext in klarer, nicht juristischer Sprache: was verschwindet und dass es unwiderruflich ist. Passwortfeld; die Bestätigung ist ohne Eingabe nicht auslösbar. **Drei unterscheidbare Fehlerzustände** — falsches Passwort · gedrosselt mit Restzeit in Minuten · technisch fehlgeschlagen („nicht wegen deines Passworts, dein Konto ist unverändert") mit „Erneut versuchen". Abbrechen, Escape und Klick daneben schließen ihn folgenlos: Die Abbruchmöglichkeit soll leicht sein, nur die Bestätigung schwer  · files: src/components/account/delete-account-dialog.tsx, src/components/account/delete-account-dialog.test.tsx  · → AC-9, AC-11, AC-14, AC-20, EC-3, EC-7

## Level 5 — Zusammensetzen

<!-- Setzt Level 4 voraus. Drei disjunkte Dateimengen. -->

- [ ] **T8** [P]  Die Seite `/account` samt Gefahrenbereich. Rahmen **unverändert** aus dem Wurzel-Layout (`PageFrame`, PROJ-2) — keine zweite Kopfzeile, keine eigene Navigation; der Seitentitel steht im Inhaltsbereich, wie `docs/app-shell.md` → Seiten-Muster es für jeden Screen festlegt. Nicht angemeldet → Umleitung auf `/login`, als zweite Schranke neben `src/proxy.ts`. `robots: noindex`. Der Gefahrenbereich ist optisch abgesetzt und benennt **vor** jedem Klick, was verschwindet: Konto, Trainername, alle Runden, Ranglisten-Eintrag  · files: src/app/account/page.tsx, src/components/account/danger-zone-card.tsx  · → AC-4, AC-5, AC-8
- [ ] **T9** [P]  Der Nutzer-Chip in der Kopfzeile wird zum Link auf `/account`. **Kein viertes Bedienelement** — die Kopfzeile trägt bei 320 px bereits drei und wurde am 2026-09-08 genau auf diese Breite gebracht (PROJ-2, AC-43); ein weiteres hätte den Fix sofort gebrochen. Der Chip bekommt sichtbaren Hover- und Fokuszustand und ein `aria-label`, das sein Ziel benennt: Er wird nicht heimlich klickbar. Die bestehenden Maße bleiben unangetastet  · files: src/components/shell/site-header.tsx  · → AC-1
- [ ] **T10** [P]  Bestätigungsbanner auf `/login` nach erfolgreicher Löschung, gesteuert über den Merker aus T5. Ein Satz, keine Karte — und er darf nicht erscheinen, wenn jemand `/login` einfach so aufruft  · files: src/app/login/page.tsx  · → AC-12

## Level 6 — Was `/qa` nicht sehen kann

<!-- `/qa` hat keinen Browser. Diese drei Aufgaben sind der einzige Weg, die Darstellung, die Dialog-Interaktion und die Wirksamkeit der Drosselung zu belegen — bei PROJ-2 ist genau diese Lücke offen geblieben. Drei disjunkte Dateien. -->

- [ ] **T11** [P]  Browser-Test: `/account` bei **320 px** ohne waagerechtes Scrollen, E-Mail-Adresse lesbar; der Dialog öffnet, schließt über Abbrechen, über Escape und über Klick daneben — jeweils folgenlos. **Einmal absichtlich brechen und rot gesehen haben**, sonst belegt der Test nichts  · files: tests/PROJ-4-account-narrow.spec.ts  · → AC-7, AC-14
- [ ] **T12** [P]  Browser-Test Zugang: `/account` ausgeloggt → `/login`. **Die Gegenprobe mit dem alten Cookie:** Nach der Löschung mit dem aufbewahrten Cookie-Glas eine geschützte Seite **und** eine Server Action aufrufen — beide müssen auf `/login` führen. Das ist der Beleg für AC-21, und er ist zugleich die Mutation: Würde ein Schutzpunkt auf die lokale Token-Prüfung zurückgedreht, hielte er einen gelöschten Nutzer bis zu einer Stunde für angemeldet (`jwt_expiry = 3600`) und dieser Test würde rot. Dazu: abgelaufene Sitzung bei offenem Dialog → `/login`, nichts gelöscht  · files: tests/PROJ-4-account-guard.spec.ts  · → AC-4, AC-16, AC-21, EC-4
- [ ] **T13** [P]  Browser-Test Drosselung, **buchstäblich**: Versuch 5 wird noch verarbeitet, Versuch 6 abgewiesen, mit Restzeit in der Meldung. Kein Test, der „nach vielen Versuchen" prüft — ein solcher bleibt grün, wenn jemand die 5 auf 19 hochdreht, und genau das war BUG-101. Dazu die Gegenprobe, dass die Erstattung **nur** hinter der bestandenen Passwortprüfung greift  · files: tests/PROJ-4-delete-throttle.spec.ts  · → AC-15, EC-7

## Abdeckung

**Alle 22 AC sind zugeordnet.** Jedes trägt mindestens eine Aufgabe, die meisten zwei — eine bauende und eine prüfende.

**Drei EC haben bewusst keine Aufgabe**, weil es nichts zu bauen gibt. Sie stehen hier, damit `/qa` sie nicht als Lücke meldet:

| EC | Warum ohne Aufgabe |
|---|---|
| **EC-9** — Sicherungskopien | Eine getragene Grenze, kein Verhalten. Die Löschung wirkt sofort im laufenden Betrieb; Sicherungskopien werden nicht rückwirkend bearbeitet. Zu belegen wäre hier nichts — zu **sagen** ist etwas, und zwar in der Datenschutzerklärung (`features/INDEX.md` → Deploy-Blocker) |
| **EC-11** — `/account` während einer laufenden Runde | Bestehendes PROJ-2-Verhalten: Jedes Verlassen der Quiz-Seite verliert die Runde. PROJ-4 baut daran nichts und sagt darüber auch nichts an |
| **EC-12** — kein Datenexport | Das **Fehlen** ist die Zusage (Product Decision vom 2026-09-09). Eine Aufgabe wäre hier ein Widerspruch in sich |

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene beginnt erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Server (L2) → Aktion (L3) → Bausteine (L4) → Seite (L5) → Browser (L6).
- **`[P]` verlangt disjunkte Dateien.** Keine zwei `[P]`-Aufgaben derselben Ebene nennen denselben Pfad unter `files:`. Geprüft: Ebene 2 (`auth/throttle` · `account/queries` · `tests/…cascade`), Ebene 4 (`account-data-card` · `delete-account-dialog`), Ebene 5 (`app/account` + `danger-zone-card` · `shell/site-header` · `app/login`), Ebene 6 (drei verschiedene Testdateien) — überall disjunkt.
- **T5 läuft bewusst allein.** Sie trägt den gesamten sicherheitsrelevanten Ablauf; ein Integrationsfehler dort wiegt schwerer als der gesparte Durchlauf.
- **T4 liegt in Ebene 2, nicht neben der Migration**, weil sie diese prüft.
- **Keine `[user]`-Aufgaben.** Es gibt nichts im Dashboard zu klicken.
