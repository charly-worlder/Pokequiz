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
**Verantwortlicher:** _noch offen — wird bei PROJ-4 (Impressum) ergänzt_
**Zuletzt geprüft:** 2026-09-03

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Wessen | Warum rechtmäßig | Aufbewahrung | Beteiligte Verarbeiter |
|-------|-------|--------|-------------------|---------------|------------------------|
| Nutzerkonten betreiben (Registrierung, Login) | E-Mail-Adresse, Passwort-Hash, Trainername | Registrierte Nutzer | Art. 6(1)(b) DSGVO — Vertrag (Konto ist die Grundlage für das Spiel) | Bis zur Kontolöschung (Mechanismus: PROJ-4) | Supabase (eu-central-1, Frankfurt) |
| Login-/Registrierungs-Missbrauch verhindern (Supabases eingebaute IP-Rate-Limit-Regel) | IP-Adresse, Zeitpunkt der Versuche | Jeder, der einen Login- oder Registrierungsversuch unternimmt | Art. 6(1)(f) DSGVO — berechtigtes Interesse (Schutz vor automatisiertem Durchprobieren) | Kurzfristig — Sperrfenster (5 Minuten), danach verworfen | Supabase (eu-central-1, Frankfurt) |
| Quizrunden speichern (Serie, Zeit, Zeitpunkt) | Erreichte Serie, benötigte Zeit, Zeitpunkt der Runde, Zuordnung zum Profil | Angemeldete Spieler | Art. 6(1)(b) DSGVO — Vertrag (das Speichern der Runden ist der Zweck des Spiels und die Grundlage der Rangliste) | Bis zur Kontolöschung; die Runden werden zusammen mit dem Profil gelöscht (Mechanismus: PROJ-4) | Supabase (eu-central-1, Frankfurt) |
| **Weltrangliste anzeigen — Offenlegung gegenüber anderen Spielern** (PROJ-3) | Trainername, beste erreichte Serie, die dazugehörige Zeit, die daraus berechnete Platzierung | Angemeldete Spieler mit mindestens einem gewerteten Lauf (Serie ≥ 1) | Art. 6(1)(b) DSGVO — Vertrag. Die Rangliste ist der Zweck, für den das Konto überhaupt existiert: `docs/PRD.md` — „Genau deshalb gibt es einen Login: Ohne Konto ist die Rangliste nicht zuordenbar." | Kein eigener Speicher — die Rangliste ist eine Abfrage über `runs`. Nach der Kontolöschung (PROJ-4) verschwindet der Eintrag mit den Runden, ohne dass ein Zwischenstand ihn weiter zeigt | Supabase (eu-central-1, Frankfurt) |
| Pokémon-Bilder ausliefern (Weiterleitung über den eigenen Server statt direkt vom CDN) | IP-Adresse und Zeitpunkt in den gewöhnlichen Zugriffslogs des Hosters — **keine** eigene, nutzerbezogene Bild-Historie in der Anwendung | Angemeldete Spieler | Art. 6(1)(f) DSGVO — berechtigtes Interesse (Betrieb der Anwendung und Vermeidung einer Drittlandübermittlung aus dem Browser) | Logs nach der Aufbewahrungsfrist des Hosters; in der Anwendung wird nichts gespeichert | Hosting (Vercel/Hostinger, noch nicht entschieden) |

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
| Auskunft / Kopie | Art. 15 | _noch nicht gebaut — Kandidat für PROJ-4; der Umfang ist klein: E-Mail, Trainername und die eigenen Runden_ |
| Berichtigung | Art. 16 | E-Mail/Passwort über Supabase Auth änderbar; Trainername ist bewusst nicht änderbar (Produktentscheidung PROJ-1). **Mit PROJ-3 wird dieser unveränderliche Name für andere Spieler sichtbar** — wer ihn zurücknehmen will, hat als einzigen Weg die Kontolöschung (PROJ-4). Siehe „Für einen Anwalt" |
| Löschung | Art. 17 | _Auslösung noch nicht gebaut — PROJ-4. Datenseitig vorbereitet: Quizrunden werden mit dem Profil mitgelöscht (PROJ-2, AC-26)_ |
| Datenübertragbarkeit | Art. 20 | _noch nicht gebaut — Kandidat für PROJ-4_ |
| Widerspruch | Art. 21 | Betrifft hier v. a. die berechtigte-Interesse-Verarbeitung (Login-Drosselung) — faktisch durch Konto-Nichtnutzung/-Löschung wahrnehmbar |

> Frist: **ein Kalendermonat** (Art. 12(3) DSGVO, um zwei weitere verlängerbar bei komplexen Fällen, wenn die Person innerhalb der ersten Frist informiert wird).

## Offene Punkte

- [ ] AVV mit Supabase abschließen (Checkbox im Dashboard)
- [ ] Hosting-Anbieter (Vercel/Hostinger) bei `/deploy` festlegen und hier als Verarbeiter nachtragen
- [ ] Verantwortlicher (Name/Anschrift) bei PROJ-4 ergänzen
- [ ] Auskunfts-, Berichtigungs- und Löschprozess bauen (PROJ-4)
- [ ] Die Kontolöschung in PROJ-4 muss die Quizrunden mit erfassen — die Datenbank ist dafür in PROJ-2 vorbereitet (AC-26), der auslösende Ablauf fehlt noch
- [ ] Ein Datenexport nach Art. 15/20 muss die Quizrunden enthalten (PROJ-4)
- [ ] Die Datenschutzerklärung (PROJ-4) muss die Rangliste benennen: dass Trainername und bester Lauf für alle angemeldeten Spieler sichtbar sind (Art. 13 DSGVO). Bis PROJ-3 gab es keine Offenlegung gegenüber anderen Nutzern, die Erklärung kann sie also nicht aus früheren Features geerbt haben
- [ ] Die Registrierung (PROJ-1) sagt derzeit **nicht**, dass der Trainername für andere Spieler sichtbar und dauerhaft ist — vor dem öffentlichen Start entweder per `/refine PROJ-1` als Hinweis am Feld ergänzen oder bewusst verwerfen
- [ ] Aufbewahrungsfrist der Zugriffslogs des Hosters ermitteln und hier eintragen, sobald der Anbieter bei `/deploy` feststeht — durch die Bild-Weiterleitung fallen dort deutlich mehr Anfragen pro Spieler an als bei einer gewöhnlichen Seite

## Für einen Anwalt / Datenschutzbeauftragten

- **Datenschutz-Folgenabschätzung (Art. 35 DSGVO): nach Einschätzung nicht erforderlich.** Keines der Kriterien greift — kein Profiling mit rechtlicher oder ähnlich erheblicher Wirkung, keine besonderen Kategorien nach Art. 9, keine systematische Überwachung öffentlich zugänglicher Bereiche. Pro Runde werden drei Zahlen gespeichert. Ein Anwalt kann das bestätigen; es sieht nach einem klaren Fall aus.
- Das Produkt richtet sich an ein öffentliches Publikum, das absehbar auch Minderjährige einschließt, und macht den Trainernamen dauerhaft und für alle angemeldeten Nutzer öffentlich sichtbar. Die Kontoerstellung läuft über Vertrag (Art. 6(1)(b)), nicht über Einwilligung — greift Art. 8 DSGVO (Einwilligung von Kindern) hier überhaupt, oder ist die relevante Frage stattdessen die Geschäftsfähigkeit nach BGB? Braucht es einen Hinweis, der Minderjährige davon abhält, ihren echten Namen als Trainernamen zu verwenden?
  - **Mit PROJ-3 ist diese Frage nicht mehr theoretisch.** Bis hierher war der Trainername zwar für angemeldete Nutzer lesbar, wurde aber nirgends angezeigt; die Rangliste ist der erste Ort, an dem er tatsächlich vor anderen Menschen erscheint. Zusammen mit der Produktentscheidung aus PROJ-1, den Namen dauerhaft festzuschreiben, heißt das: Ein Kind, das seinen echten Namen eingetragen hat, kann ihn nur durch Löschen des ganzen Kontos wieder aus der Rangliste bekommen. Konkret zu klären: Reicht ein Hinweis bei der Registrierung, oder sollte der Trainername (mindestens einmalig) änderbar sein?

---

_Führe `/dsgvo` erneut aus, sobald ein Feature ändert, welche personenbezogenen Daten das Produkt hält._
