# Privacy Record — was dieses Produkt mit personenbezogenen Daten macht

> Die ehrliche Übersicht, welche personenbezogenen Daten dieses Produkt verarbeitet, warum, und wie lange.
>
> - Erstellt und aktuell gehalten von `/dsgvo`, ein Eintrag pro Verarbeitungszweck.
> - Wächst mit dem Produkt: Ändert ein Feature, was gespeichert wird, ändert sich auch dieser Eintrag.
> - **Flughöhe:** Zwecke, Rechtsgrundlagen, Aufbewahrung, wer die Daten sonst sieht. Feld-Details leben in `docs/data-model.md` und den Feature-Designs.
>
> Dies bildet das Verarbeitungsverzeichnis (Art. 30 DSGVO) eng nach — ist aber ein technisches Dokument, keine rechtliche Einreichung. Ein Anwalt oder Datenschutzbeauftragter hat das letzte Wort, ob es für die konkrete Situation vollständig ist.

**Anwendbares Recht:** DSGVO (EU/DE)
**Datenschutz-Haltung:** standard (siehe `docs/PRD.md` → Rahmenbedingungen)
**Verantwortlicher:** Worlder. **Anschrift und Kontaktangaben bleiben vorerst Platzhaltertext** in Impressum und Datenschutzerklärung — bewusste Entscheidung vom 2026-09-09, weil die App nicht live geht. Vor einem Livegang zwingend durch echte Angaben zu ersetzen (`features/INDEX.md` → Deploy-Blocker)
**Zuletzt geprüft:** 2026-09-09 (`/dsgvo PROJ-4` im Rahmen von `/write-spec`)

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Wessen | Warum rechtmäßig | Aufbewahrung | Beteiligte Verarbeiter |
|-------|-------|--------|-------------------|---------------|------------------------|
| Nutzerkonten betreiben (Registrierung, Login) | E-Mail-Adresse, Passwort-Hash, Trainername | Registrierte Nutzer | Art. 6(1)(b) DSGVO — Vertrag (Konto ist die Grundlage für das Spiel) | Bis zur Kontolöschung (Mechanismus: PROJ-4) | Supabase (eu-central-1, Frankfurt) |
| Login-/Registrierungs-Missbrauch verhindern (**eigener Fehlversuchszähler** in der Datenbank, `public.auth_throttle`) | IP-Adresse **und E-Mail-Adresse** als Zählerschlüssel, Zeitpunkt und Anzahl der Versuche | Jeder, der einen Login-, Registrierungs- oder Passwort-Reset-Versuch unternimmt | Art. 6(1)(f) DSGVO — berechtigtes Interesse (Schutz vor automatisiertem Durchprobieren) | **Zwei Wege, und der erste ist keine harte Garantie.** (1) Abgelaufene Zählerfenster — älter als eine Stunde — werden **beim nächsten Anmelde-, Registrierungs- oder Reset-Versuch** entfernt (`prune_auth_throttle`, Migration `0005`), und zwar bis zu 50 Zeilen je Versuch. Ohne Datenverkehr geschieht nichts, und nach vielen Fehlversuchen kann der Abbau mehrere Versuche brauchen; im Normalbetrieb liegen die Zeilen deshalb Minuten bis Stunden, in einer ruhenden Anwendung länger. **Eine feste Höchstfrist sagt dieser Weg nicht zu** — ein zeitgesteuerter Lauf ist als Ausbau beim Deploy vorgemerkt (`features/PROJ-2-pokemon-quiz/tasks.md` → Backlog `B2`). (2) Schlüssel, die eine **E-Mail-Adresse** enthalten, verschwinden **sofort und unabhängig vom Verkehr mit dem Konto** (Trigger `on_auth_user_deleted`) — das ist der Weg, auf dem sich das Löschungsrecht stützt | Supabase (eu-central-1, Frankfurt) |
| Quizrunden speichern (Serie, Zeit, Zeitpunkt) | Erreichte Serie, benötigte Zeit, Zeitpunkt der Runde, Zuordnung zum Profil | Angemeldete Spieler | Art. 6(1)(b) DSGVO — Vertrag (das Speichern der Runden ist der Zweck des Spiels und die Grundlage der Rangliste) | Bis zur Kontolöschung; die Runden werden zusammen mit dem Profil gelöscht (Mechanismus: PROJ-4) | Supabase (eu-central-1, Frankfurt) |
| **Weltrangliste anzeigen — Offenlegung gegenüber anderen Spielern** (PROJ-3) | Trainername, beste erreichte Serie, die dazugehörige Zeit, die daraus berechnete Platzierung | Angemeldete Spieler mit mindestens einem gewerteten Lauf (Serie ≥ 1) | Art. 6(1)(b) DSGVO — Vertrag. Die Rangliste ist der Zweck, für den das Konto überhaupt existiert: `docs/PRD.md` — „Genau deshalb gibt es einen Login: Ohne Konto ist die Rangliste nicht zuordenbar." | Kein eigener Speicher — die Rangliste ist eine Abfrage über `runs`. Nach der Kontolöschung (PROJ-4) verschwindet der Eintrag mit den Runden, ohne dass ein Zwischenstand ihn weiter zeigt | Supabase (eu-central-1, Frankfurt) |
| **Eine Quizrunde serverseitig führen** (Fragen vergeben, Antworten prüfen, Serie und Zeit zählen — PROJ-2) | Zuordnung zum Profil, die in dieser Runde bereits gezogenen Pokémon-Nummern, die aktuelle Lösung mit ihrem Frage-Token, die bereits vorbereitete nächste Frage, Ausgabezeitpunkt der laufenden Frage, Zeitpunkt der letzten Berührung, aufsummierte Antwortzeit, Serienstand | Angemeldete Spieler, solange eine Runde läuft | Art. 6(1)(b) DSGVO — Vertrag. Ohne diesen Zustand ist die Runde nicht spielbar und ihr Ergebnis nicht überprüfbar; die Rangliste ist laut `docs/PRD.md` der Zweck, für den das Konto überhaupt existiert | **Drei Wege, alle mit harter Zusage.** (1) Am Rundenende gelöscht, sobald das Ergebnis als Zeile in `runs` steht. (2) Eine abgebrochene Runde verfällt **spätestens nach 2 Stunden** durch einen zeitgesteuerten Lauf (pg_cron) — bewusst **nicht** verkehrsgetrieben wie `auth_throttle`, weil ein Spieler, der nie zurückkommt, keinen Auslöser erzeugt. (3) Mit dem Profil sofort, über einen Fremdschlüssel mit Kaskade | Supabase (eu-central-1, Frankfurt) |
| Pokémon-Bilder ausliefern (Weiterleitung über den eigenen Server statt direkt vom CDN) | IP-Adresse und Zeitpunkt in den gewöhnlichen Zugriffslogs des Hosters — **keine** eigene, nutzerbezogene Bild-Historie in der Anwendung | Angemeldete Spieler | Art. 6(1)(f) DSGVO — berechtigtes Interesse (Betrieb der Anwendung und Vermeidung einer Drittlandübermittlung aus dem Browser) | Logs nach der Aufbewahrungsfrist des Hosters; in der Anwendung wird nichts gespeichert. **Ab dem 2026-09-06 enthalten diese Logs keine Pokémon-Nummer mehr:** Die Bildadresse ist pro Frage ein undurchsichtiges Token (PROJ-2, AC-32), aus dem sich ohne den Rundenzustand nicht ableiten lässt, welches Pokémon ein Spieler gesehen hat | Hosting (Vercel/Hostinger, noch nicht entschieden) |

## Sensible Daten

- keine

## Verarbeiter (Auftragsverarbeiter)

| Dienst | Was verarbeitet wird | Region | AVV unterschrieben | Außerhalb der angemessenen Länder? |
|--------|----------------------|--------|---------------------|--------------------------------------|
| Supabase | Alle Anwendungsdaten (Auth, `profiles`, `runs`) | eu-central-1 (Frankfurt) | ☐ | US-Unternehmen, EU-Hosting — Transfermechanismus prüfen |
| Hosting (Vercel/Hostinger) | Anfragen, Server-Logs, zusätzlich die weitergeleiteten Bildanfragen | noch nicht entschieden (`deploy` in `.ai-eng-kit` ist `null`) | ☐ | wird bei `/deploy` festgelegt |

**Kein Auftragsverarbeiter: die PokeAPI.** Bilder und deutsche Namen holt der **Server** und reicht sie an den Browser weiter (PROJ-2, AC-20). Die PokeAPI und ihr Bild-CDN sehen deshalb ausschließlich die IP-Adresse unseres Servers, nie die eines Spielers — es findet keine Übermittlung personenbezogener Daten an sie statt und es braucht keinen AVV. Würde der Browser die Bilder direkt laden, wäre das eine Drittlandübermittlung bei jeder einzelnen Frage.

**Keine Analytics, kein Tracking, keine externen Schriften.** Das Projekt bindet keine Analyse-, Werbe- oder Fehler-Tracking-Dienste ein (geprüft in `package.json` am 2026-09-01), und die Schrift „Outfit" wird über `next/font/google` selbst ausgeliefert statt vom Google-CDN geladen. Gesetzt werden ausschließlich die für den Betrieb erforderlichen Cookies der Anmeldung — deshalb ist nach § 25 TDDDG **kein Einwilligungsbanner erforderlich**. Das ändert sich in dem Moment, in dem ein Analyse- oder Tracking-Dienst dazukommt.

## Betroffenenrechte — wie sie bedient werden

| Recht | DSGVO | Wie dieses Produkt es liefert |
|-------|-------|-------------------------------|
| Auskunft / Kopie | Art. 15 | **In PROJ-4 vertraglich zugesagt, noch nicht gebaut** (Status `Planned`): Der Kontobereich `/account` zeigt E-Mail-Adresse, Trainername, Registrierdatum, Anzahl gespielter Runden und den besten Lauf (AC-2) und benennt ausdrücklich, dass dies alles ist, was gespeichert wird (AC-19) |
| Berichtigung | Art. 16 | E-Mail/Passwort über Supabase Auth änderbar; Trainername ist bewusst nicht änderbar (Produktentscheidung PROJ-1). **Mit PROJ-3 wird dieser unveränderliche Name für andere Spieler sichtbar** — wer ihn zurücknehmen will, hat als einzigen Weg die Kontolöschung (PROJ-4). Siehe „Für einen Anwalt" |
| Löschung | Art. 17 | **In PROJ-4 vertraglich zugesagt, noch nicht gebaut** (Status `Planned`): Auslösung auf `/account`, bestätigt mit dem eigenen Passwort, **sofort und endgültig** — kein Soft-Delete, keine Karenzzeit (AC-8 bis AC-14). AC-17 verlangt ausdrücklich, dass **kein** Personenbezug zurückbleibt, einschließlich der Zählerzeilen der Anmelde-Drosselung; AC-22 verbietet jede Kopie, Löschhistorie oder Protokollzeile mit E-Mail oder Trainernamen. Datenseitig vorbereitet: Quizrunden werden mit dem Profil mitgelöscht (PROJ-2, AC-26), die Drosselungszeilen über den Trigger `on_auth_user_deleted` (Migration `0005`) — Letzteres war bis zum 2026-09-05 eine Lücke, weil die Zeilen an keinem Fremdschlüssel hängen. **Grenze, bewusst getragen:** Sicherungskopien werden nicht rückwirkend bearbeitet (PROJ-4, EC-9) |
| Datenübertragbarkeit | Art. 20 | **Wird bewusst nicht gebaut** (Entscheidung des Verantwortlichen vom 2026-09-09). An die Stelle eines maschinenlesbaren Downloads tritt die Bildschirmanzeige der fünf gespeicherten Werte auf `/account`; im Vertrag als PROJ-4 → EC-12 festgehalten, damit es eine Entscheidung bleibt und nicht als Lücke verwittert. **Keine Rechtsauskunft:** Art. 20 verlangt dem Wortlaut nach ein strukturiertes, gängiges, maschinenlesbares Format — dass die Anzeige bei diesem Datenumfang genügt, ist getragen, nicht geprüft. Siehe „Für einen Anwalt" |
| Widerspruch | Art. 21 | Betrifft hier v. a. die berechtigte-Interesse-Verarbeitung (Login-Drosselung) — faktisch durch Konto-Nichtnutzung/-Löschung wahrnehmbar |

> Frist: **ein Kalendermonat** (Art. 12(3) DSGVO, um zwei weitere verlängerbar bei komplexen Fällen, wenn die Person innerhalb der ersten Frist informiert wird).

## Offene Punkte

- [ ] AVV mit Supabase abschließen (Checkbox im Dashboard)
- [ ] **Zeitgesteuerten Lauf für den Rundenzustand einrichten** (pg_cron, alle 5 Minuten, löscht alles länger als 110 Minuten Unberührte) — er ist die Zusage hinter der 2-Stunden-Frist aus PROJ-2, AC-41. Takt **und** Schwelle zusammen müssen unter zwei Stunden bleiben; ein stündlicher Takt gegen eine 2-Stunden-Schwelle ergäbe bis zu drei Stunden Verweildauer. Ohne ihn bleibt die Frist eine Absichtserklärung, genau wie beim verkehrsgetriebenen Abbau von `auth_throttle`
- [ ] **SMTP-Anbieter wird ein weiterer Auftragsverarbeiter.** Der eingebaute Supabase-Versand reicht für den Produktivbetrieb nicht (nur Team-Adressen, 2 Mails/Stunde) — siehe `docs/PRD.md` → Rahmenbedingungen. Der gewählte Anbieter (Resend, Brevo o. a.) verarbeitet E-Mail-Adressen der Nutzer und braucht daher einen AVV, einen Eintrag in der Verarbeiter-Tabelle oben und eine Prüfung, ob er außerhalb der angemessenen Länder sitzt. Vor dem Livegang zu klären, zusammen mit der Absender-Domain
- [ ] Hosting-Anbieter (Vercel/Hostinger) bei `/deploy` festlegen und hier als Verarbeiter nachtragen
- [x] ~~Verantwortlicher (Name/Anschrift) bei PROJ-4 ergänzen~~ — **entschieden am 2026-09-09:** Verantwortlicher ist Worlder; die Anschrift bleibt Platzhaltertext, solange die App nicht live geht. Als Deploy-Blocker in `features/INDEX.md` geführt
- [ ] **Auskunfts- und Löschprozess bauen — PROJ-4 ist spezifiziert (`Planned`), aber nicht gebaut.** Bis `/build` und `/qa` durch sind, hat dieses Produkt **keinen** funktionierenden Weg für Art. 15 und Art. 17. Ein Berichtigungsprozess ist bewusst nicht Teil davon (siehe Zeile „Berichtigung" oben)
- [x] ~~Die Kontolöschung in PROJ-4 muss die Quizrunden mit erfassen~~ — **im Vertrag zugesagt** (PROJ-4, AC-10 und AC-17). Gebaut ist es damit noch nicht
- [x] ~~Ein Datenexport nach Art. 15/20 muss die Quizrunden enthalten~~ — **ersetzt:** Art. 15 wird über die Anzeige auf `/account` bedient und enthält Rundenzahl und besten Lauf (PROJ-4, AC-2); ein Art.-20-Export entfällt bewusst (EC-12)
- [ ] Die Datenschutzerklärung (PROJ-4) muss die Rangliste benennen: dass Trainername und bester Lauf für alle angemeldeten Spieler sichtbar sind (Art. 13 DSGVO). Bis PROJ-3 gab es keine Offenlegung gegenüber anderen Nutzern, die Erklärung kann sie also nicht aus früheren Features geerbt haben
- [ ] Die Registrierung (PROJ-1) sagt derzeit **nicht**, dass der Trainername für andere Spieler sichtbar und dauerhaft ist — vor dem öffentlichen Start entweder per `/refine PROJ-1` als Hinweis am Feld ergänzen oder bewusst verwerfen
- [ ] **Aufbewahrungsfrist der Sicherungskopien der Datenbank ermitteln** (PROJ-4, EC-9). Die Löschung wirkt sofort im laufenden Betrieb, Sicherungskopien werden nicht rückwirkend bearbeitet — die Datenschutzerklärung darf „vollständig gelöscht" deshalb nicht ohne diesen Zusatz behaupten. Steht erst mit Hosting-Anbieter und Supabase-Tarif fest
- [ ] **Die Datenschutzerklärung muss die Kontolöschung so beschreiben, wie PROJ-4 sie tatsächlich baut** — sofort und endgültig, ohne Karenzzeit, mit dem Vorbehalt aus EC-9. Weil die Erklärung bewusst **ohne** Spec geschrieben wird, deckt sie kein Test ab: Die Übereinstimmung mit PROJ-4 ist Handarbeit und beim nächsten `/audit` zu prüfen
- [ ] Aufbewahrungsfrist der Zugriffslogs des Hosters ermitteln und hier eintragen, sobald der Anbieter bei `/deploy` feststeht — durch die Bild-Weiterleitung fallen dort deutlich mehr Anfragen pro Spieler an als bei einer gewöhnlichen Seite

## Für einen Anwalt / Datenschutzbeauftragten

- **Genügt bei fünf gespeicherten Werten die Bildschirmanzeige statt eines Downloads?** Gespeichert sind E-Mail-Adresse, Trainername, Registrierdatum, Anzahl gespielter Runden und der beste Lauf. `/account` zeigt alle fünf vollständig an (PROJ-4, AC-2/AC-19); einen maschinenlesbaren Export nach Art. 20 gibt es bewusst nicht (EC-12). Konkret zu fragen: Reicht das für Art. 15(3) („eine Kopie"), und ist Art. 20 hier überhaupt einschlägig — er gilt nur für Daten, die die betroffene Person selbst bereitgestellt hat, was auf Rundenzahl und besten Lauf womöglich nicht zutrifft? Falls nicht: Ein Ablauf für eine manuelle Anfrage existiert bisher **nicht**.
- **Datenschutz-Folgenabschätzung (Art. 35 DSGVO): nach Einschätzung nicht erforderlich.** Keines der Kriterien greift — kein Profiling mit rechtlicher oder ähnlich erheblicher Wirkung, keine besonderen Kategorien nach Art. 9, keine systematische Überwachung öffentlich zugänglicher Bereiche. Pro Runde werden drei Zahlen gespeichert. Ein Anwalt kann das bestätigen; es sieht nach einem klaren Fall aus.
- Das Produkt richtet sich an ein öffentliches Publikum, das absehbar auch Minderjährige einschließt, und macht den Trainernamen dauerhaft und für alle angemeldeten Nutzer öffentlich sichtbar. Die Kontoerstellung läuft über Vertrag (Art. 6(1)(b)), nicht über Einwilligung — greift Art. 8 DSGVO (Einwilligung von Kindern) hier überhaupt, oder ist die relevante Frage stattdessen die Geschäftsfähigkeit nach BGB? Braucht es einen Hinweis, der Minderjährige davon abhält, ihren echten Namen als Trainernamen zu verwenden?
  - **Mit PROJ-3 ist diese Frage nicht mehr theoretisch.** Bis hierher war der Trainername zwar für angemeldete Nutzer lesbar, wurde aber nirgends angezeigt; die Rangliste ist der erste Ort, an dem er tatsächlich vor anderen Menschen erscheint. Zusammen mit der Produktentscheidung aus PROJ-1, den Namen dauerhaft festzuschreiben, heißt das: Ein Kind, das seinen echten Namen eingetragen hat, kann ihn nur durch Löschen des ganzen Kontos wieder aus der Rangliste bekommen. Konkret zu klären: Reicht ein Hinweis bei der Registrierung, oder sollte der Trainername (mindestens einmalig) änderbar sein?

---

_Führe `/dsgvo` erneut aus, sobald ein Feature ändert, welche personenbezogenen Daten das Produkt hält._
