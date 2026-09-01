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
**Zuletzt geprüft:** 2026-08-31

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Wessen | Warum rechtmäßig | Aufbewahrung | Beteiligte Verarbeiter |
|-------|-------|--------|-------------------|---------------|------------------------|
| Nutzerkonten betreiben (Registrierung, Login) | E-Mail-Adresse, Passwort-Hash, Trainername | Registrierte Nutzer | Art. 6(1)(b) DSGVO — Vertrag (Konto ist die Grundlage für das Spiel) | Bis zur Kontolöschung (Mechanismus: PROJ-4) | Supabase (eu-central-1, Frankfurt) |
| Login-/Registrierungs-Missbrauch verhindern (Supabases eingebaute IP-Rate-Limit-Regel) | IP-Adresse, Zeitpunkt der Versuche | Jeder, der einen Login- oder Registrierungsversuch unternimmt | Art. 6(1)(f) DSGVO — berechtigtes Interesse (Schutz vor automatisiertem Durchprobieren) | Kurzfristig — Sperrfenster (5 Minuten), danach verworfen | Supabase (eu-central-1, Frankfurt) |

## Sensible Daten

- keine

## Verarbeiter (Auftragsverarbeiter)

| Dienst | Was verarbeitet wird | Region | AVV unterschrieben | Außerhalb der angemessenen Länder? |
|--------|----------------------|--------|---------------------|--------------------------------------|
| Supabase | Alle Anwendungsdaten (Auth, `profiles`, `runs`) | eu-central-1 (Frankfurt) | ☐ | US-Unternehmen, EU-Hosting — Transfermechanismus prüfen |
| Hosting (Vercel/Hostinger) | Anfragen, Server-Logs | noch nicht entschieden (`deploy` in `.ai-eng-kit` ist `null`) | ☐ | wird bei `/deploy` festgelegt |

## Betroffenenrechte — wie sie bedient werden

| Recht | DSGVO | Wie dieses Produkt es liefert |
|-------|-------|-------------------------------|
| Auskunft / Kopie | Art. 15 | _noch nicht gebaut — Kandidat für PROJ-4_ |
| Berichtigung | Art. 16 | E-Mail/Passwort über Supabase Auth änderbar; Trainername ist bewusst nicht änderbar (Produktentscheidung PROJ-1) |
| Löschung | Art. 17 | _noch nicht gebaut — PROJ-4 (Datenschutz & Kontolöschung)_ |
| Datenübertragbarkeit | Art. 20 | _noch nicht gebaut — Kandidat für PROJ-4_ |
| Widerspruch | Art. 21 | Betrifft hier v. a. die berechtigte-Interesse-Verarbeitung (Login-Drosselung) — faktisch durch Konto-Nichtnutzung/-Löschung wahrnehmbar |

> Frist: **ein Kalendermonat** (Art. 12(3) DSGVO, um zwei weitere verlängerbar bei komplexen Fällen, wenn die Person innerhalb der ersten Frist informiert wird).

## Offene Punkte

- [ ] AVV mit Supabase abschließen (Checkbox im Dashboard)
- [ ] Hosting-Anbieter (Vercel/Hostinger) bei `/deploy` festlegen und hier als Verarbeiter nachtragen
- [ ] Verantwortlicher (Name/Anschrift) bei PROJ-4 ergänzen
- [ ] Auskunfts-, Berichtigungs- und Löschprozess bauen (PROJ-4)

## Für einen Anwalt / Datenschutzbeauftragten

- Das Produkt richtet sich an ein öffentliches Publikum, das absehbar auch Minderjährige einschließt, und macht den Trainernamen dauerhaft und für alle angemeldeten Nutzer öffentlich sichtbar. Die Kontoerstellung läuft über Vertrag (Art. 6(1)(b)), nicht über Einwilligung — greift Art. 8 DSGVO (Einwilligung von Kindern) hier überhaupt, oder ist die relevante Frage stattdessen die Geschäftsfähigkeit nach BGB? Braucht es einen Hinweis, der Minderjährige davon abhält, ihren echten Namen als Trainernamen zu verwenden?

---

_Führe `/dsgvo` erneut aus, sobald ein Feature ändert, welche personenbezogenen Daten das Produkt hält._
