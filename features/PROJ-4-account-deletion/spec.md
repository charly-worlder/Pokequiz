# PROJ-4: Kontolöschung

<!-- This file (spec.md) is the stable CONTRACT — it defines WHAT, not HOW.
     Owner: /write-spec (creates), /refine (updates). During /build this file is READ-ONLY.
     Technical design lives in design.md, QA results in qa-report.md.
     No status or date fields here: the feature's status lives ONLY in features/INDEX.md,
     and git records when this file changed. -->

## Dependencies
- **Benötigt: PROJ-1 (Benutzerkonto & Login)** — es gibt nur zu löschen, was dort angelegt wird. Die Passwortprüfung im Lösch-Dialog benutzt dieselben Zugangsdaten, und der Zähler `auth_throttle` samt seinem Trigger `on_auth_user_deleted` stammt von dort.
- **Benötigt: PROJ-2 (Pokémon-Quiz)** — die App-Shell (Kopfzeile mit Nutzer-Chip, Seitenrahmen, Fußzeile) gehört PROJ-2; `/account` benutzt sie unverändert. Der Rundenzustand `active_runs` und die Kaskade auf `runs` stammen ebenfalls von dort.
- **Benötigt: PROJ-3 (Weltrangliste)** — die Rangliste ist der einzige Ort, an dem eine Löschung für andere Menschen sichtbar wird; PROJ-3 AC-22 sagt bereits zu, dass der Eintrag verschwindet.
- **Ändert die App-Shell:** `/account` ist ein neuer Top-Level-Bereich und der Nutzer-Chip wird zum Klickziel. `docs/app-shell.md` gehört PROJ-2 — die Karte wird von `/architecture` nachgezogen, die Verhaltensänderung selbst ist mit diesem Spec beschlossen.

## User Stories
- Als Spieler möchte ich mein Konto endgültig löschen können, damit mein Trainername und meine Ergebnisse nicht dauerhaft für andere sichtbar bleiben.
- Als Spieler möchte ich an einer Stelle sehen, was über mich gespeichert ist, damit ich nicht raten muss, was ich da eigentlich lösche.
- Als Spieler möchte ich vor dem Löschen unmissverständlich erfahren, was verschwindet und dass es nicht rückholbar ist, damit ich es nicht aus Versehen tue.
- Als Spieler, der sein Konto an einem fremden oder geteilten Gerät offen gelassen hat, möchte ich, dass niemand es ohne mein Passwort löschen kann.
- Als Spieler, der seinen Trainernamen bereut, möchte ich über die Löschung einen Weg haben, ihn aus der Rangliste zu bekommen — denn ändern kann ich ihn nicht.
- Als Betreiber möchte ich, dass eine Löschung wirklich alles erfasst, damit die Zusage in der Datenschutzerklärung stimmt.

## Out of Scope
- **Datenexport als Datei** (Art. 20 DSGVO, Datenübertragbarkeit) — bewusst weggelassen und **durch die Bildschirmanzeige auf `/account` ersetzt**. Das ist eine getroffene Entscheidung, keine Lücke: Sie steht als Zeile im Decision Log und als **EC-12** im Vertrag, damit `/qa` das Fehlen des Exports als vertragsgemäß erkennt.
- **Karenzzeit, Papierkorb, Wiederherstellung** — es gibt kein „gelöscht, aber noch da".
- **Inhalte von `/privacy` und `/imprint`** — die beiden Rechtstexte werden ohne eigenen Spec-Zyklus direkt geschrieben (Entscheidung vom 2026-09-09). Dieses Feature baut sie nicht und prüft sie nicht.
- **Trainername oder E-Mail-Adresse ändern** — gehört zu PROJ-1. Die Unveränderlichkeit des Trainernamens ist dort eine bewusste Produktentscheidung; sie zu kippen wäre `/refine PROJ-1`.
- **Passwort im angemeldeten Zustand ändern** — gibt es heute nirgends, gehört aber ebenfalls zu PROJ-1.
- **Sperrliste für Trainernamen gelöschter Konten** — siehe Product Decisions; eine solche Liste wäre gespeicherter Personenbezug nach der Löschung.
- **Bestätigungs-E-Mail nach der Löschung** — nicht zusagbar, solange kein eigener SMTP-Dienst steht (`docs/PRD.md` → Rahmenbedingungen).
- **Löschung durch den Betreiber, per E-Mail-Anfrage oder über einen Admin-Bereich** — es gibt keine Rollen in diesem Produkt.
- **Ein Grund-Abfragedialog („Warum gehst du?")** — würde eine neue personenbezogene Angabe erheben, ausgerechnet im Moment der Löschung.

## Acceptance Criteria

### Der Kontobereich `/account`

- [ ] **AC-1** — Angenommen ein Spieler ist angemeldet, wenn er in der Kopfzeile auf den Nutzer-Chip klickt, dann gelangt er auf `/account`; die Kopfzeile bekommt dafür **kein** zusätzliches Bedienelement.
- [ ] **AC-2** — Angenommen ein Spieler öffnet `/account`, wenn die Seite geladen ist, dann sieht er seine E-Mail-Adresse, seinen Trainernamen, das Datum seiner Registrierung, die Anzahl seiner gespielten Runden und seinen besten Lauf (Serie und Zeit im Format `mm:ss,s`).
- [ ] **AC-3** — Angenommen ein Spieler ist auf `/account`, wenn er die angezeigten Werte betrachtet, dann ist keiner davon änderbar — es gibt kein Eingabefeld und keine Speichern-Aktion außer im Lösch-Dialog.
- [ ] **AC-4** — Angenommen ein Nutzer ist nicht angemeldet, wenn er `/account` aufruft, dann wird er auf `/login` weitergeleitet und sieht keine Kontodaten.
- [ ] **AC-5** — Angenommen `/account` wird geöffnet, wenn die Seite steht, dann benutzt sie unverändert die App-Shell aus PROJ-2 (dieselbe Kopfzeile, derselbe Seitenrahmen, dieselbe Fußzeile); es entsteht keine zweite Navigation.
- [ ] **AC-6** — Angenommen ein Spieler hat noch keinen gewerteten Lauf, wenn er `/account` öffnet, dann steht anstelle des besten Laufs ein Hinweis, dass es noch keinen gibt — keine leere Zeile und keine Null-Werte.
- [ ] **AC-7** — Angenommen ein Spieler öffnet `/account` auf einem Bildschirm von 320 px Breite, wenn er die Seite liest, dann scrollt sie nicht waagerecht und die E-Mail-Adresse bleibt lesbar, notfalls umgebrochen oder gekürzt.

### Die Löschung auslösen

- [ ] **AC-8** — Angenommen ein Spieler ist auf `/account`, wenn er zum Lösch-Bereich scrollt, dann ist dieser optisch vom Rest abgesetzt und benennt **vor** jedem Klick, was verschwindet: das Konto, der Trainername, alle gespielten Runden und der Eintrag in der Weltrangliste.
- [ ] **AC-9** — Angenommen ein Spieler klickt auf „Konto löschen", wenn der Dialog erscheint, dann verlangt er die Eingabe des aktuellen Passworts, und die Bestätigungs-Aktion ist ohne Eingabe nicht auslösbar.
- [ ] **AC-10** — Angenommen ein Spieler gibt im Lösch-Dialog sein richtiges Passwort ein, wenn er bestätigt, dann werden sein Konto, sein Profil, **alle** seine Runden und ein etwaiger laufender Rundenzustand entfernt — in einem Vorgang, ohne dass ein Teil davon zurückbleibt.
- [ ] **AC-11** — Angenommen ein Spieler gibt ein falsches Passwort ein, wenn er bestätigt, dann bleibt der Dialog mit einer Fehlermeldung offen und es wird nichts gelöscht.
- [ ] **AC-12** — Angenommen die Löschung war erfolgreich, wenn sie abgeschlossen ist, dann wird der Spieler abgemeldet, landet auf `/login` und sieht dort die Bestätigung, dass sein Konto gelöscht wurde.
- [ ] **AC-13** — Angenommen ein Konto wurde gelöscht, wenn danach jemand denselben Trainernamen oder dieselbe E-Mail-Adresse zur Registrierung verwendet, dann ist beides wieder frei und es entsteht ein neues, leeres Konto ohne jede Verbindung zum alten.
- [ ] **AC-14** — Angenommen der Lösch-Dialog ist offen, wenn der Spieler „Abbrechen" wählt, die Escape-Taste drückt oder daneben klickt, dann schließt er sich und es ist nichts geschehen.

### Missbrauchsschutz

_Diese beiden Kriterien stammen nicht aus dem Interview: Der Dialog prüft eine Zugangsdatei, damit ist er ein Angriffsziel. Die Zahlen stehen ausdrücklich hier im Vertrag — dass sie bei PROJ-1 nur im Code standen, ist dort als offener Punkt in `features/INDEX.md` gelandet._

- [ ] **AC-15** — Angenommen im Lösch-Dialog wurde fünfmal ein falsches Passwort eingegeben, wenn innerhalb von 15 Minuten ein weiterer Versuch erfolgt, dann wird er abgewiesen und der Spieler erfährt, in wie vielen Minuten er es erneut versuchen kann. Gezählt wird auf einem eigenen Scope `account-delete`, sowohl pro Konto als auch pro Verbindung.
- [ ] **AC-16** — Angenommen jemand ruft den Löschvorgang unter Umgehung der Oberfläche auf, wenn dabei eine fremde Konto-Kennung mitgesendet wird, dann wird sie ignoriert: Gelöscht wird ausschließlich das Konto der aufrufenden Sitzung.

### Datenschutz

_Diese Kriterien stammen aus der Prüfung mit `/dsgvo PROJ-4`, nicht aus dem Interview. Der Artikel dahinter nennt die Pflicht, aus der sie folgen. Sie sind nicht in derselben Weise verhandelbar wie der Rest des Specs._

- [ ] **AC-17** — Angenommen ein Konto wird gelöscht, wenn der Vorgang abgeschlossen ist, dann ist an **keiner** Stelle der Datenbank noch ein Personenbezug zu diesem Konto vorhanden — das schließt ausdrücklich die Zeilen der Anmelde-Drosselung ein, die eine E-Mail-Adresse als Zählerschlüssel tragen (Art. 17 DSGVO).
- [ ] **AC-18** — Angenommen ein Konto wurde gelöscht, wenn ein anderer Spieler danach die Weltrangliste aufruft, dann erscheint der gelöschte Spieler dort nicht mehr und die nachfolgenden Spieler rücken auf (Art. 17, Art. 19 DSGVO).
- [ ] **AC-19** — Angenommen ein Spieler öffnet `/account`, wenn er die Anzeige liest, dann steht dort in einem Satz, dass dies alles ist, was über ihn gespeichert wird — die Anzeige aus AC-2 ist vollständig und lässt kein personenbezogenes Feld aus (Art. 15 DSGVO).
- [ ] **AC-20** — Angenommen ein Spieler steht vor der Bestätigung, wenn er den Dialog liest, dann ist in klarer, nicht juristischer Sprache gesagt, was gelöscht wird und dass der Vorgang unwiderruflich ist (Art. 12(1) DSGVO).
- [ ] **AC-21** — Angenommen ein Konto wurde gelöscht, wenn danach mit der alten Sitzung (dem alten Cookie) eine geschützte Seite oder eine Server-Aktion aufgerufen wird, dann führt das auf `/login` und gewährt keinen Zugriff (Art. 5(1)(f), Art. 17 DSGVO).
- [ ] **AC-22** — Angenommen ein Konto wird gelöscht, wenn der Vorgang durchläuft, dann legt er nirgendwo eine Kopie der gelöschten Daten ab — kein Archiv, keine Löschhistorie und kein Protokolleintrag, der E-Mail-Adresse oder Trainernamen enthält (Art. 5(1)(e), Art. 17 DSGVO).

## Edge Cases

- **EC-1** — Angenommen ein Spieler klickt zweimal schnell auf „Endgültig löschen" oder hat den Dialog in zwei Tabs offen, wenn der zweite Aufruf den Server erreicht, dann läuft er wirkungslos ins Leere; der Spieler sieht die normale Bestätigung aus AC-12 und keine Fehlermeldung.
- **EC-2** — Angenommen ein Spieler hat in einem anderen Tab eine Runde laufen, wenn er sein Konto löscht, dann wird die Runde mit gelöscht; der andere Tab zeigt bei der nächsten Handlung den Zustand „keine laufende Runde" beziehungsweise die Weiterleitung auf `/login`, statt abzustürzen.
- **EC-3** — Angenommen die Löschung schlägt technisch fehl (Datenbank- oder Netzwerkfehler), wenn der Fehler feststeht, dann ist **nichts** gelöscht — nicht das Profil ohne die Runden und nicht umgekehrt —, der Spieler bleibt angemeldet und sieht den Hinweis innerhalb der Karte mit einer „Erneut versuchen"-Aktion.
- **EC-4** — Angenommen die Sitzung eines Spielers läuft ab, während der Lösch-Dialog offen steht, wenn er bestätigt, dann wird er auf `/login` geleitet und es ist nichts gelöscht.
- **EC-5** — Angenommen ein anderer Spieler hat die Weltrangliste geöffnet, während ein Konto gelöscht wird, wenn er die Seite neu lädt, dann sieht er die neue Reihenfolge ohne Fehler und ohne Lücke an der Stelle des gelöschten Spielers (entspricht PROJ-3 EC-4).
- **EC-6** — Angenommen ein Spieler löscht sein Konto und registriert sich unmittelbar danach mit derselben E-Mail-Adresse neu, wenn er das neue Konto öffnet, dann hat er null Runden, keinen Ranglistenplatz und keinen Zugriff auf irgendetwas aus dem alten Konto.
- **EC-7** — Angenommen ein Spieler wurde nach AC-15 gedrosselt, wenn die 15 Minuten abgelaufen sind, dann kann er die Löschung ohne weiteres Zutun erneut versuchen; die Sperre hebt sich von selbst auf.
- **EC-8** — Angenommen die Verbindung bricht ab, während die Löschung läuft, wenn der Spieler die Seite erneut aufruft, dann sieht er einen der beiden eindeutigen Zustände — entweder das unveränderte Konto oder die Anmeldeseite —, aber nie ein halb gelöschtes Konto.
- **EC-9** — Angenommen ein Konto ist gelöscht, wenn eine Sicherungskopie der Datenbank aus der Zeit davor betrachtet wird, dann kann sie die Daten noch enthalten, bis sie nach der Aufbewahrungsfrist des Anbieters verfällt. **Diese Grenze wird bewusst getragen**: Die Löschung wirkt sofort und vollständig im laufenden Betrieb; Sicherungskopien werden nicht rückwirkend bearbeitet. Die Datenschutzerklärung darf deshalb nicht „vollständig gelöscht" versprechen, ohne diesen Punkt zu benennen.
- **EC-10** — Angenommen ein Trainername wird durch eine Löschung frei, wenn ein anderer Spieler ihn sich sofort nimmt, dann gelingt das; der gelöschte Spieler hat kein Anrecht auf seinen früheren Namen, und es gibt darüber keine Meldung an irgendjemanden.
- **EC-11** — Angenommen ein Spieler ruft `/account` auf, während eine Runde läuft, wenn er die Seite öffnet, dann ist die Runde damit verloren (dieselbe Regel wie bei jedem anderen Verlassen der Quiz-Seite in PROJ-2) — die Kontoseite sagt das nicht eigens an und stellt die Runde auch nicht wieder her.
- **EC-12** — Angenommen ein Spieler möchte seine Daten in maschinenlesbarer Form mitnehmen, wenn er danach sucht, dann findet er keinen Download und keine Export-Aktion: Die Anzeige auf `/account` (AC-2, AC-19) ist der einzige Weg, an die gespeicherten Werte zu kommen. **Diese Grenze wird bewusst getragen** — siehe Product Decisions. Sie steht hier, damit `/qa` das Fehlen des Exports als vertragsgemäß erkennt und nicht als Befund meldet.

## Technical Requirements
- **Sicherheit:** Der Löschvorgang läuft ausschließlich serverseitig und leitet das betroffene Konto aus der Sitzung ab (AC-16). Er ist der einzige Pfad im Produkt, der ein Auth-Konto entfernt.
- **Sicherheit:** Die Passwortprüfung im Dialog ist ein Zugangsdaten-Pfad und unterliegt der Drosselung aus AC-15.
- **Atomarität:** Löschen ist alles oder nichts (EC-3). Wie das garantiert wird — Kaskaden, Transaktion, eine Datenbankfunktion — entscheidet `/architecture`.
- **Zugang:** `/account` ist ausschließlich angemeldet erreichbar und wird nicht in den Suchindex aufgenommen.
- **Darstellung:** Untergrenze 320 px ohne waagerechten Überlauf, wie in PROJ-2 AC-43 für die ganze App festgelegt.

## Open Questions

_Zwei Punkte, die hier standen, sind am 2026-09-09 entschieden worden und in den Decision Log gewandert: der Verantwortliche (Worlder, Felder mit Platzhaltertext) und der Wegfall des Art.-20-Exports._

- [ ] **Aufbewahrungsfrist der Sicherungskopien ist unbekannt** (EC-9). Steht erst fest, wenn Hosting-Anbieter und Supabase-Tarif beim `/deploy` feststehen. Die Zahl gehört danach in die Datenschutzerklärung — **und damit erst in den Moment, in dem die App tatsächlich live gehen soll**.
- [ ] **Scheitert die Löschung wirklich als Ganzes?** (aus `/architecture`, betrifft EC-3.) **Präzisiert am 2026-09-09:** Gemeint ist nicht ein Teilzustand — den schließt die Kaskade im selben DELETE aus —, sondern das Zurückrollen der **ganzen** Transaktion. Was die Oberfläche dann zeigt und dass ein erneuter Versuch sicher ist, steht entschieden in `design.md` → „Der Fehlerfall". Offen bleibt allein die **Messung**: Die vier Kaskaden stehen in drei Migrationen und wurden nie im Löschfall zusammen ausgelöst. Beim Bau in beide Richtungen zu belegen — nach geglückter Löschung sind alle fünf Zeilen weg, nach künstlich herbeigeführtem Fehlschlag sind alle fünf noch da.
- [x] ~~**Soll `/account` mit einer Recovery-Sitzung erreichbar bleiben?**~~ — **entschieden am 2026-09-09: ja, unverändert erreichbar.** Für die Löschung ist ohnehin das Passwort nötig (AC-9); eine zusätzliche Enge hätte nur den bestraft, der sein Passwort gerade zurückgesetzt hat und dann sein Konto löschen will.
- [ ] **Bestätigungs-E-Mail nach der Löschung** — heute nicht zusagbar (kein eigener SMTP-Dienst). Sobald einer steht: nachrüsten oder bewusst verwerfen? Ohne sie merkt ein Kontoinhaber nicht, wenn jemand anderes sein Konto gelöscht hat.
- [ ] **Die Minderjährigen-Frage aus `docs/privacy.md` bleibt offen.** Die Löschung ist ab jetzt der einzige Weg, einen versehentlich echten Namen aus der Rangliste zu bekommen. Ob das genügt oder der Trainername (einmalig) änderbar sein sollte, entscheidet dieses Feature nicht — es wäre `/refine PROJ-1`.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| PROJ-4 umfasst nur die Kontolöschung; `/privacy` und `/imprint` werden ohne Spec-Zyklus direkt geschrieben | Die beiden Rechtstexte sind statisch, öffentlich und berühren keine Datenbank — ein voller Spec-Zyklus wäre Aufwand ohne Erkenntnis. Preis: `/audit` wird sie als Code ohne Feature melden, und die Zusagen darin sind von keinem Test gedeckt. In `features/INDEX.md` festgehalten | 2026-09-09 |
| **Die Bildschirmanzeige der fünf Werte auf `/account` ersetzt den Datenexport nach Art. 20 DSGVO — bewusst und endgültig für dieses Feature** | Entscheidung des Verantwortlichen vom 2026-09-09, nach ausdrücklicher Vorlage der Alternative. Gespeichert sind fünf Werte (E-Mail, Trainername, Registrierdatum, Rundenzahl, bester Lauf); AC-2 und AC-19 zeigen sie vollständig und benennen die Vollständigkeit. Ein maschinenlesbarer Download dafür wäre Zeremonie. **Das ist keine Rechtsauskunft:** Art. 20 verlangt dem Wortlaut nach ein strukturiertes, gängiges, maschinenlesbares Format — dass die Anzeige hier genügt, ist eine getragene Entscheidung, kein geprüfter Rechtsstandpunkt. Im Vertrag verankert als **EC-12**, damit `/qa` das Fehlen nicht als Befund meldet | 2026-09-09 |
| **Verantwortlicher ist Worlder; die Felder in Impressum und Datenschutzerklärung bleiben Platzhaltertext** | Die App geht vorerst **nicht** live. Ein Impressum mit echter Anschrift ist eine Pflicht des Livebetriebs (DDG), nicht der Entwicklung, und eine Anschrift ins Repository zu schreiben, die niemand braucht, ist unnötige Preisgabe. **Preis: Platzhalter sind ein Startblocker** — vor einem Livegang müssen sie durch echte Angaben ersetzt werden, sonst ist das Impressum unvollständig. Als Deploy-Blocker in `features/INDEX.md` geführt, nicht nur hier | 2026-09-09 |
| Einstieg über den vorhandenen Nutzer-Chip, nicht über ein neues Kopfzeilen-Element | Die Kopfzeile trägt bei 320 px bereits drei Elemente; ein viertes hätte den gerade erst gebauten Fix aus PROJ-2 (AC-43) sofort wieder gebrochen. Der Chip wird klickbar und kostet null zusätzliche Breite | 2026-09-09 |
| Sofortige, endgültige Löschung statt Karenzzeit | Art. 17 verlangt „unverzüglich", und PROJ-3 AC-22 sagt bereits zu, dass der Ranglisteneintrag verschwindet. Eine Karenzzeit hieße ein zweiter zeitgesteuerter Löschweg (T36/T37 stehen dafür schon offen), ein Zustand „gelöscht, aber vorhanden" in jeder Abfrage und ein Wiederherstellungs-Pfad, den niemand je prüft | 2026-09-09 |
| Der Trainername wird nach der Löschung wieder frei | Eine Sperrliste wäre gespeicherter Personenbezug nach der Löschung — genau das, was Art. 17 beendet. Der Preis (jemand anders kann den Namen nehmen, EC-10) ist geringer als eine Tabelle, die Namen gelöschter Konten aufbewahrt | 2026-09-09 |
| Bestätigung per Passwort, nicht per Abtippen des Trainernamens | Der Trainername steht in der Kopfzeile daneben — er schützt vor dem Verklicken, aber nicht vor jemandem am angemeldeten Gerät. Sitzungen laufen laut PROJ-1 AC-5 bis zu 400 Tage, und PROJ-1 EC-12 dokumentiert das Risiko am geteilten Gerät bereits | 2026-09-09 |
| Drosselung 5 Versuche je 15 Minuten, eigener Scope `account-delete` | Strenger als der bestehende Scope `password-update` (10), weil die Aktion unumkehrbar ist und ein legitimer Nutzer sein eigenes Passwort nicht fünfmal falsch tippt. Die Zahlen stehen bewusst im Vertrag und nicht nur im Code | 2026-09-09 |
| Eine laufende Runde wird mitgelöscht, statt die Löschung zu blockieren | Ein Spieler, der sein Konto loswerden will, soll nicht erst eine Quizrunde beenden müssen. `active_runs` ist ohnehin kurzlebiger Betriebszustand ohne eigenen Wert (`docs/data-model.md`) | 2026-09-09 |
| Keine Bestätigungs-E-Mail | Supabases eingebauter Versand stellt nur an Team-Adressen zu und ist auf 2 Nachrichten pro Stunde begrenzt (`docs/PRD.md` → Rahmenbedingungen). Eine Zusage im Vertrag, die für echte Spieler nicht funktioniert, ist schlimmer als keine. In den Open Questions vorgemerkt | 2026-09-09 |
| `/account` zeigt die Daten nur an, ändert nichts | Trainername und E-Mail zu ändern gehört zu PROJ-1, nicht hierher. Zwei scharfe Aktionen auf einer Seite hätten den Spec über zwei Features gespannt | 2026-09-09 |
| Kein Grund-Abfragedialog beim Löschen | Er würde ausgerechnet im Moment der Löschung eine neue personenbezogene Angabe erheben, und niemand wertet sie aus | 2026-09-09 |
